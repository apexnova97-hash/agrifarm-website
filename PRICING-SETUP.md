# Setting up the Agrifarm price bot on Netlify

This connects a private Telegram bot to your website so you can update
prices by sending a message, without ever touching code. Everything here
is on the free tier — Netlify's free plan, Netlify Blobs, and the
Telegram Bot API are all free at this scale (a handful of price updates
a day, a small product catalog). There's nothing to pay for.

Do these steps in order. It takes about 15–20 minutes the first time.

---

## 1. Deploy the site to Netlify — via GitHub, not drag-and-drop

**Important:** Netlify's drag-and-drop upload won't work for the price
bot, because it skips the step that installs the one small helper
package the bot needs (`@netlify/blobs`). Connecting a GitHub repo
instead makes Netlify run that install step automatically. The rest of
the site (all the HTML/CSS/JS) works exactly the same either way.

1. Create a free GitHub account if you don't have one: https://github.com/signup
2. Create a new repository (e.g. `agrifarm-website`) and upload this
   entire project folder to it — including the `netlify/` folder,
   `netlify.toml`, and `package.json`. (GitHub's website lets you drag
   files in directly, no command line needed.)
3. Go to https://app.netlify.com and sign up / log in.
4. Click **Add new site → Import an existing project**.
5. Choose **GitHub**, authorize it, and pick your `agrifarm-website` repo.
6. Netlify will detect the settings from `netlify.toml` automatically
   (publish directory `.`, functions in `netlify/functions`). Just click
   **Deploy**.
7. Wait for the deploy to finish, then open the site URL Netlify gives
   you (something like `agrifarm-plc.netlify.app`) to confirm it loads.
   You can add your own domain later in Netlify's Domain settings.

## 2. Create your Telegram bot

1. In Telegram, search for **@BotFather** and start a chat with it.
2. Send `/newbot` and follow the prompts (pick a name and a username
   ending in `bot`, e.g. `AgrifarmPriceBot`).
3. BotFather replies with a **token** — a long string like
   `123456789:AAExampleTokenTextHere`. Save this somewhere safe. Anyone
   with this token can control your bot, so don't share it.

## 3. Find your own Telegram user ID

1. Search for **@userinfobot** in Telegram and start a chat.
2. It immediately replies with your numeric **user ID** (e.g.
   `987654321`). Save this — it's what makes the bot private to only you.

## 4. Add your secrets to Netlify

1. In your Netlify site dashboard, go to **Site configuration →
   Environment variables**.
2. Add these three variables:

   | Key | Value |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | the token from BotFather (step 2) |
   | `TELEGRAM_ADMIN_ID` | your numeric user ID (step 3) |
   | `TELEGRAM_WEBHOOK_SECRET` | any random password you make up — e.g. mash your keyboard for 20+ characters |

3. Click **Save**, then trigger a redeploy (**Deploys → Trigger deploy →
   Deploy site**) so the functions pick up the new variables.

## 5. Connect the bot to your site (set the webhook)

This tells Telegram where to send your messages. Replace the
placeholders and open this URL once in any web browser:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_SITE>.netlify.app/.netlify/functions/telegram-webhook&secret_token=<YOUR_WEBHOOK_SECRET>
```

- `<YOUR_BOT_TOKEN>` — from step 2
- `<YOUR_SITE>` — your actual Netlify site name
- `<YOUR_WEBHOOK_SECRET>` — the same random string you set as
  `TELEGRAM_WEBHOOK_SECRET` in step 4

If it worked, the browser shows `{"ok":true,"result":true,...}`.

## 6. Try it

Open a chat with your bot in Telegram and send:

```
/help
```

You should get a list of commands back. Then try:

```
/prices
```

to see every product with its starter placeholder price (I seeded all
25 with round example numbers so the site isn't blank — see below).
Update them with:

```
/setprice MEGAMIN 450
```

or set many at once:

```
/setprices
MEGAMIN 450
GARLI MINT 380
HEPAVET 600
```

Prices appear on the site within about a minute (there's a short cache
so the site isn't hammering the function on every page view).

---

## About the starter prices

I filled in a placeholder price for all 25 products so the site shows
real numbers immediately instead of blanks — but **these are example
round numbers, not researched market prices.** Please go through
`/prices` and update every one to your actual pricing before customers
see them. Until you change a price via the bot, the site shows the
placeholder from `netlify/functions/_shared/products.js`.

## If something's not working

- **Prices don't show on the site at all:** the function probably isn't
  deployed yet, or `@netlify/blobs` didn't install — check **Deploys**
  in Netlify for a failed build, and confirm you deployed via GitHub
  (step 1), not drag-and-drop.
- **Bot doesn't reply:** double-check the webhook URL in step 5 actually
  returned `"ok":true`, and that `TELEGRAM_BOT_TOKEN` is exactly right
  (no extra spaces).
- **Bot says "you're not authorized":** your `TELEGRAM_ADMIN_ID` doesn't
  match the Telegram account you're messaging from — redo step 3.

  BY ABRHAM TEKUAM
