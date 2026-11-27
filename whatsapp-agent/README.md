# Veyra WhatsApp agent

AI replies on Veyra's WhatsApp Business number (official WhatsApp Cloud API) plus a phone inbox
where Rutvi and Dibesh see every chat, take over, and work a daily list of found leads.

## What it does
- Someone messages the Veyra WhatsApp number -> the bot answers in their language, explains Dine In / Academy /
  agency services with real prices, collects name, business, area and need, and sends the trial link.
- It hands over (and goes quiet in that chat) when the person asks for a call, a custom quote, has a complaint or the bot is unsure.
  Those chats appear under **For you**, with an email alert to marketing@veyracreatives.com if SMTP is set.
- The bot never starts a chat. WhatsApp only allows replies within 24 hours of the customer's last message.
- **Leads** tab: restaurants/cafes and sports academies in Navi Mumbai + Thane, found every day at 9 AM IST
  (Google Places if a key is saved, otherwise OpenStreetMap). Each has a ready opening message; tapping
  **WhatsApp** opens your own WhatsApp with it, and you press send. Nothing goes out without you.

## Install / update (hPanel > VPS > Browser terminal)
    curl -fsSL https://raw.githubusercontent.com/veyracreatives/veyra-dine/claude/project-thread-r4isup/whatsapp-agent/deploy/setup.sh | sudo bash -s wa.veyracreatives.com
Needs an A record `wa` -> 200.234.43.29 first. Prints the inbox password, webhook URL and verify token.
Then paste keys in the inbox **Setup** tab (stored in data/secrets.json, mode 600).

## Keys
| Key | Where |
|---|---|
| WA_TOKEN, WA_PHONE_ID, WA_APP_SECRET | Meta developer app with the WhatsApp product (permanent System User token) |
| ANTHROPIC_API_KEY | console.anthropic.com (without it the bot uses simple rule replies) |
| GOOGLE_PLACES_KEY | Google Cloud, Places API (New) |
| SMTP_USER / SMTP_PASS | Gmail address + app password for alerts |

Optional env: WA_MODEL (default claude-opus-5-5), WA_EFFORT (default low), LEADS_PER_DAY (25), LEAD_AREAS, MAX_BOT_REPLIES_PER_DAY (40), LEAD_FINDER=off.

## Test locally
    npm install
    PORT=3299 INBOX_PASSWORD=pw-test-123 WA_VERIFY_TOKEN=vt WA_APP_SECRET=test-secret LEAD_FINDER=off node server.js &
    BASE=http://localhost:3299 node test/sim.js
