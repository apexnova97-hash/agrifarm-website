// GET /.netlify/functions/get-prices
//
// Public, read-only. Returns the current price list as JSON when prices
// are enabled. When the Telegram admin hides prices, an empty object is
// returned so the website shows no prices and no order total.

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
    const showPrices = stored.showPrices !== false;

    // The visibility flag lives alongside the stored prices so the Telegram
    // bot can switch the public website between price-visible and hidden.
    delete stored.showPrices;

    if (!showPrices) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({}),
      };
    }

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
    // If Blobs fails, preserve the existing behaviour and show defaults.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_PRICES),
    };
  }
};
