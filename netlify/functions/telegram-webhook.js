// POST /.netlify/functions/telegram-webhook
//
// Private Telegram price-management bot. In addition to changing prices,
// the admin can globally hide or show every price on the public website.

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
  const showPrices = stored.showPrices !== false;
  delete stored.showPrices;
  return { prices: { ...DEFAULT_PRICES, ...stored }, showPrices };
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

async function setPricesVisible(store, visible) {
  const stored = (await store.get("prices", { type: "json" })) || {};
  stored.showPrices = visible;
  await store.setJSON("prices", stored);
}

function fmt(n) {
  return Number(n).toLocaleString("en-US");
}

// Simple Telegram reply keyboard so the most common actions are one tap away.
function mainKeyboard() {
  return {
    keyboard: [
      [{ text: "🟢 Show All Prices" }, { text: "🔴 Hide All Prices" }],
      [{ text: "📊 Price Status" }, { text: "💰 View All Prices" }],
      [{ text: "✏️ Set a Price" }, { text: "↩️ Reset a Price" }],
      [{ text: "❓ Help" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function helpText() {
  return [
    "🌾 Agrifarm Price Manager",
    "",
    "Use the buttons below for the common actions.",
    "",
    "✏️ To change one price:",
    "/setprice PRODUCT NAME PRICE",
    "Example: /setprice MEGAMIN 450",
    "",
    "📋 To change several prices at once:",
    "/setprices",
    "Then put one product per line:",
    "MEGAMIN 450",
    "GARLI MINT 380",
    "HEPAVET 600",
    "",
    "↩️ Reset a product with /removeprice PRODUCT NAME",
  ].join("\n");
}

async function pricesText(store) {
  const { prices, showPrices } = await getPrices(store);
  const header = `Website prices: ${showPrices ? "VISIBLE 🟢" : "HIDDEN 🔴"}`;
  return header + "\n\n" + PRODUCT_NAMES.map((p) => {
    const price = prices[p];
    return price !== undefined ? `${p}: ${fmt(price)} ETB` : `${p}: (not set)`;
  }).join("\n");
}

async function sendTelegramMessage(chatId, text, withKeyboard = true) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is missing — set it in Netlify environment variables.");
    return;
  }
  try {
    const payload = { chat_id: chatId, text };
    if (withKeyboard) payload.reply_markup = mainKeyboard();
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Telegram sendMessage failed:", res.status, body);
    }
  } catch (err) {
    console.error("Telegram sendMessage threw:", err && err.message);
  }
}

exports.handler = async (event) => {
  console.log("telegram-webhook invoked");

  const secretHeader =
    event.headers["x-telegram-bot-api-secret-token"] ||
    event.headers["X-Telegram-Bot-Api-Secret-Token"];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.error("Webhook secret mismatch — check TELEGRAM_WEBHOOK_SECRET matches what you registered with Telegram.");
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
    await sendTelegramMessage(
      chatId,
      "This bot is private — you're not authorized to use it.\n\n" +
        "Your Telegram ID: " + fromId + "\n" +
        "ID this bot is configured to allow: " + (adminId || "(not set)") +
        "\n\nIf this is actually you, update TELEGRAM_ADMIN_ID in Netlify to match your ID above, then redeploy."
    );
    return { statusCode: 200, body: "ok" };
  }

  const store = getStore({
    name: "agrifarm-prices",
    siteID: process.env.MY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN,
  });

  const text = message.text.trim();

  // Button labels are handled exactly like commands, so buttons and commands
  // always operate on the same underlying price settings.
  if (/^\/(start|help)/i.test(text) || text === "❓ Help") {
    await sendTelegramMessage(chatId, helpText());
  } else if (/^\/showprices(?:@\w+)?\s*$/i.test(text) || text === "🟢 Show All Prices") {
    await setPricesVisible(store, true);
    await sendTelegramMessage(chatId, "✅ All prices are now VISIBLE on the website.\n\nCustomers can see prices again.");
  } else if (/^\/hideprices(?:@\w+)?\s*$/i.test(text) || text === "🔴 Hide All Prices") {
    await setPricesVisible(store, false);
    await sendTelegramMessage(chatId, "🔒 All prices are now HIDDEN on the website.\n\nCustomers will not see product prices or the order total.");
  } else if (/^\/pricestatus(?:@\w+)?\s*$/i.test(text) || text === "📊 Price Status") {
    const { showPrices } = await getPrices(store);
    await sendTelegramMessage(chatId, showPrices ? "🟢 Prices are VISIBLE on the website." : "🔴 Prices are HIDDEN on the website.");
  } else if (/^\/prices/i.test(text) || text === "💰 View All Prices") {
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
      await sendTelegramMessage(chatId, `↩️ Reverted "${found.match}" to its default price.`);
    }
  } else if (text === "✏️ Set a Price") {
    await sendTelegramMessage(
      chatId,
      "✏️ Set a product price\n\nType it like this:\n/setprice PRODUCT NAME PRICE\n\nExample:\n/setprice MEGAMIN 450\n\nFor a product with spaces:\n/setprice GARLI MINT 380"
    );
  } else if (text === "↩️ Reset a Price") {
    await sendTelegramMessage(
      chatId,
      "↩️ Reset a product to its default price\n\nType:\n/removeprice PRODUCT NAME\n\nExample:\n/removeprice MEGAMIN"
    );
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
    await sendTelegramMessage(chatId, "Unknown command. Tap ❓ Help or use the buttons below.");
  }

  return { statusCode: 200, body: "ok" };
};
