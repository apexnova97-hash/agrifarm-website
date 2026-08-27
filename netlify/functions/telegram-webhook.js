// POST /.netlify/functions/telegram-webhook
//
// This is the URL you give Telegram when you register your bot's webhook.
// Every message sent to the bot arrives here as a POST from Telegram's
// servers. Two independent checks keep it private:
//
//   1. Telegram sends a secret header on every webhook call, which must
//      match TELEGRAM_WEBHOOK_SECRET (set when you register the webhook).
//   2. Even if that header were somehow spoofed, the handler still checks
//      the sender's numeric Telegram user ID against TELEGRAM_ADMIN_ID
//      before touching any price. Anyone else gets a polite refusal.
//
// Commands (send these to your bot in Telegram):
//   /setprice PRODUCT NAME PRICE      e.g. /setprice MEGAMIN 450
//   /setprices                        then one "NAME PRICE" per line —
//                                      for setting many prices in one go
//   /removeprice PRODUCT NAME         reverts that product to its default
//   /prices                           lists every product and its price
//   /help                             shows this command list

const { getStore } = require("@netlify/blobs");
const { PRODUCT_NAMES, DEFAULT_PRICES } = require("./_shared/products");

function matchProduct(nameRaw) {
  const needle = nameRaw.trim().toLowerCase();
  const exact = PRODUCT_NAMES.find((p) => p.toLowerCase() === needle);
  if (exact) return { match: exact };
  const contains = PRODUCT_NAMES.filter((p) => p.toLowerCase().includes(needle));
  if (contains.length === 1) return { match: contains[0] };
  return { suggestions: contains.length ? contains : PRODUCT_NAMES };
}

function parseSetPrice(text) {
  const rest = text.replace(/^\/setprice(@\w+)?\s*/i, "").trim();
  if (!rest) return { error: "usage" };
  const parts = rest.split(/\s+/);
  const priceStr = parts[parts.length - 1];
  const price = Number(priceStr);
  if (!isFinite(price) || price < 0) return { error: "bad_price" };
  const nameRaw = parts.slice(0, -1).join(" ").trim();
  if (!nameRaw) return { error: "usage" };
  const found = matchProduct(nameRaw);
  if (found.match) return { name: found.match, price };
  return { error: "not_found", suggestions: found.suggestions };
}

async function getPrices(store) {
  const stored = (await store.get("prices", { type: "json" })) || {};
  return { ...DEFAULT_PRICES, ...stored };
}

async function setPrice(store, name, price) {
  const stored = (await store.get("prices", { type: "json" })) || {};
  stored[name] = price;
  await store.setJSON("prices", stored);
}

async function removePrice(store, name) {
  const stored = (await store.get("prices", { type: "json" })) || {};
  delete stored[name];
  await store.setJSON("prices", stored);
}

function fmt(n) {
  return Number(n).toLocaleString("en-US");
}

function helpText() {
  return [
    "Agrifarm price bot — commands:",
    "",
    "/setprice NAME PRICE",
    "  e.g. /setprice MEGAMIN 450",
    "",
    "/setprices — then send one product per line:",
    "  MEGAMIN 450",
    "  GARLI MINT 380",
    "  HEPAVET 600",
    "",
    "/removeprice NAME — reverts to the site default",
    "/prices — show every product and its current price",
    "/help — show this message",
  ].join("\n");
}

async function pricesText(store) {
  const prices = await getPrices(store);
  return PRODUCT_NAMES.map((p) => {
    const price = prices[p];
    return price !== undefined ? `${p}: ${fmt(price)} ETB` : `${p}: (not set)`;
  }).join("\n");
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    // If Telegram's API is briefly unreachable there's nothing useful to
    // do here — the price change itself already succeeded or failed
    // independently of whether the confirmation message goes out.
  }
}

exports.handler = async (event) => {
  const secretHeader =
    event.headers["x-telegram-bot-api-secret-token"] ||
    event.headers["X-Telegram-Bot-Api-Secret-Token"];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return { statusCode: 401, body: "unauthorized" };
  }

  let update;
  try {
    update = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: "bad request" };
  }

  const message = update.message;
  if (!message || !message.text || !message.chat) {
    return { statusCode: 200, body: "ok" };
  }

  const chatId = message.chat.id;
  const fromId = String((message.from && message.from.id) || "");
  const adminId = String(process.env.TELEGRAM_ADMIN_ID || "");

  if (!adminId || fromId !== adminId) {
    await sendTelegramMessage(chatId, "This bot is private — you're not authorized to use it.");
    return { statusCode: 200, body: "ok" };
  }

  const store = getStore("agrifarm-prices");
  const text = message.text.trim();

  if (/^\/(start|help)/i.test(text)) {
    await sendTelegramMessage(chatId, helpText());
  } else if (/^\/prices/i.test(text)) {
    await sendTelegramMessage(chatId, await pricesText(store));
  } else if (/^\/removeprice/i.test(text)) {
    const nameRaw = text.replace(/^\/removeprice(@\w+)?\s*/i, "").trim();
    const found = matchProduct(nameRaw);
    if (!found.match) {
      await sendTelegramMessage(
        chatId,
        "Couldn't match that product. Closest options:\n" + found.suggestions.slice(0, 10).join("\n")
      );
    } else {
      await removePrice(store, found.match);
      await sendTelegramMessage(chatId, `Reverted "${found.match}" to its default price.`);
    }
  } else if (/^\/setprices/i.test(text)) {
    const lines = text.split("\n").slice(1).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      await sendTelegramMessage(
        chatId,
        "Send /setprices then one product per line, e.g.:\n\n/setprices\nMEGAMIN 450\nGARLI MINT 380"
      );
    } else {
      const results = [];
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const priceStr = parts[parts.length - 1];
        const price = Number(priceStr);
        const nameRaw = parts.slice(0, -1).join(" ").trim();
        if (!nameRaw || !isFinite(price) || price < 0) {
          results.push(`✗ Couldn't read: "${line}"`);
          continue;
        }
        const found = matchProduct(nameRaw);
        if (!found.match) {
          results.push(`✗ Unknown product: "${nameRaw}"`);
          continue;
        }
        await setPrice(store, found.match, price);
        results.push(`✅ ${found.match}: ${fmt(price)} ETB`);
      }
      await sendTelegramMessage(chatId, results.join("\n"));
    }
  } else if (/^\/setprice/i.test(text)) {
    const parsed = parseSetPrice(text);
    if (parsed.error === "usage") {
      await sendTelegramMessage(chatId, "Usage: /setprice PRODUCT NAME PRICE\nExample: /setprice MEGAMIN 450");
    } else if (parsed.error === "bad_price") {
      await sendTelegramMessage(chatId, "The price must be a positive number, e.g. /setprice MEGAMIN 450");
    } else if (parsed.error === "not_found") {
      await sendTelegramMessage(
        chatId,
        "Couldn't match that product. Closest options:\n" + parsed.suggestions.slice(0, 10).join("\n")
      );
    } else {
      await setPrice(store, parsed.name, parsed.price);
      await sendTelegramMessage(chatId, `✅ ${parsed.name}: ${fmt(parsed.price)} ETB`);
    }
  } else {
    await sendTelegramMessage(chatId, "Unknown command. Send /help to see what I can do.");
  }

  return { statusCode: 200, body: "ok" };
};
