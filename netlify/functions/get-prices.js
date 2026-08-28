// GET /.netlify/functions/get-prices
//
// Public, read-only. Returns the current price list as JSON, e.g.
//   { "MEGAMIN": 450, "HEPAVET": 600 }

const { getStore } = require("@netlify/blobs");
const { DEFAULT_PRICES } = require("./_shared/products");

exports.handler = async () => {
  try {
    const store = getStore({
      name: "agrifarm-prices",
      siteID: process.env.MY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN,
    });
    
    const stored = (await store.get("prices", { type: "json" })) || {};
    // Defaults first, then anything actually set via the bot overrides them.
    const prices = { ...DEFAULT_PRICES, ...stored };
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(prices),
    };
  } catch (err) {
    console.error("Blobs read error:", err);
    // Fall back to defaults if Blobs fails
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_PRICES),
    };
  }
};
