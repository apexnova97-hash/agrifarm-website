// Shared between get-prices.js and telegram-webhook.js so the two
// functions can never drift out of sync on product names.
//
// PRODUCT_NAMES must exactly match the `value="..."` on each product's
// checkbox in products.html — that's the string FormSubmit receives as
// the order line item, and the string the price bot matches against.
//
// DEFAULT_PRICES are illustrative placeholders only (round numbers, not
// real market research) so the site shows *something* before the first
// /setprice command is ever sent. Update every one of these to your real
// price via the Telegram bot — see the setup guide (PRICING-SETUP.md).

const PRODUCT_NAMES = [
  "MEGAMIN",
  "GARLI MINT",
  "MEGA MASS",
  "Poultry Drinkers",
  "Livestock Ear Tags",
  "Livestock Ear Tags (Yellow/Green)",
  "STRESSPACK PLUS",
  "SYNBIOTIC VETLINES",
  "HEPAVET",
  "AD3 COMBAT",
  "STARTER",
  "FINISHER",
  "AMINOTECH",
  "Drinker Indonesia 3 Liter",
  "Feeder China",
  "FEEDER ITALY",
  "Red Chick Feeder Tray",
  "Yellow Plastic Feeder Cones",
  "Red Hanging Poultry Drinker",
  "KNAPSACK AK Sprayer",
  "Yellow Backpack Sprayer",
  "TREY (Plastic Egg Tray)",
  "Red Poultry Transport Crate",
  "Red Transport Crate (Side View)",
  "Yellow Transport Crate",
];

const DEFAULT_PRICES = {
  "MEGAMIN": 450,
  "GARLI MINT": 380,
  "MEGA MASS": 520,
  "Poultry Drinkers": 350,
  "Livestock Ear Tags": 25,
  "Livestock Ear Tags (Yellow/Green)": 30,
  "STRESSPACK PLUS": 400,
  "SYNBIOTIC VETLINES": 480,
  "HEPAVET": 550,
  "AD3 COMBAT": 420,
  "STARTER": 650,
  "FINISHER": 650,
  "AMINOTECH": 500,
  "Drinker Indonesia 3 Liter": 320,
  "Feeder China": 380,
  "FEEDER ITALY": 950,
  "Red Chick Feeder Tray": 180,
  "Yellow Plastic Feeder Cones": 220,
  "Red Hanging Poultry Drinker": 300,
  "KNAPSACK AK Sprayer": 1800,
  "Yellow Backpack Sprayer": 2200,
  "TREY (Plastic Egg Tray)": 90,
  "Red Poultry Transport Crate": 950,
  "Red Transport Crate (Side View)": 950,
  "Yellow Transport Crate": 900,
};

module.exports = { PRODUCT_NAMES, DEFAULT_PRICES };