// GET /.netlify/functions/get-prices
//
// Public, read-only. Returns the current price list as JSON, e.g.
//   { "MEGAMIN": 450, "HEPAVET": 600 }
// Products with no price set simply won't appear in this object — the
// website treats a missing key as "no price shown yet", not an error.
//
// No authentication needed here: reading prices is safe for anyone.
// Only the Telegram webhook (telegram-webhook.js) can change them.

const { getStore } = require("@netlify/blobs");
const { DEFAULT_PRICES } = require("./_shared/products");

exports.handler = async () => {
  try {
    const store = getStore("agrifarm-prices");
    const stored = (await store.get("prices", { type: "json" })) || {};
    // Defaults first, then anything actually set via the bot overrides them.
    const prices = { ...DEFAULT_PRICES, ...stored };
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Short cache so a price change shows up within a minute without
        // hammering the function on every single page view.
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(prices),
    };
  } catch (err) {
    // If Blobs isn't set up yet, or anything else goes wrong, fall back to
    // the defaults rather than showing no prices at all.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_PRICES),
    };
  }
};
