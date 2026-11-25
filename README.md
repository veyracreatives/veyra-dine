# Veyra Academy

Football academy management: landing page, sign-up/login (email + Google), admin, manager, coach and parent apps, and the private Veyra HQ. Every app reads one academy record on the server and updates live (server-sent events). Works in a browser and installs as an app (PWA).

Prices: ₹999/month, ₹7,999/year, 10-day trial, no GST (changeable in HQ → Plans & prices).
Razorpay is used only when an academy buys a plan. Parents pay fees to the academy's own UPI ID and paste the 12-digit transaction ID.

## Run locally
    node server.js            # Node 18+, no other dependencies
    npm i nodemailer          # optional, for emails
Open http://localhost:3100 (site) and /demo (demo academy). Veyra HQ is NOT on the website: it is the Windows app in hq-windows/ (talks to /api/hq/* with the HQ password).
On first start the server prints an HQ setup code (also in data/hq-setup-code.txt). Enter it in the Veyra Academy HQ app and choose the HQ password.

## Environment
PORT (3100), HOST (127.0.0.1), BASE_URL (public https URL), DATA_DIR (./data).
Data: data/db.json (atomic writes), daily backups in data/backups (60 kept), uploads in data/files. Updates never touch data/.

## Deploy (Veyra server, next to Dine In)
1. DNS: A record `academy` -> 200.234.43.29.
2. In the hPanel Browser terminal:
       curl -fsSL https://raw.githubusercontent.com/veyracreatives/veyra-dine/claude/project-thread-7g2j4d/deploy/setup.sh | sudo bash
   It installs to /opt/veyra-academy (port 3100), adds academy.veyracreatives.com to Caddy without touching Dine In, and prints the HQ setup code. Run the same line again to update; data/ is never touched.
3. Install Veyra-Academy-HQ-Setup.exe on your PC, open it, enter the setup code, pick the HQ password, then add in Settings: Razorpay key ID + secret, webhook secret (webhook URL is shown there, event payment.captured), Google OAuth client ID (add https://academy.veyracreatives.com as an authorised JavaScript origin), SMTP for marketing@veyracreatives.com.

## Code
public/core.js   shared rules (same code runs on server and in the demo)
src/p1–p6.js     apps; `sh build.sh` builds public/app.js
public/hq.html + hq.js   Veyra HQ screens (used by hq-windows; the server never serves them)
hq-windows/      Electron app: `sh build-ui.sh && npm i && npm run dist:win` (needs wine on Linux). Settings + daily backups in %APPDATA%\Veyra Academy HQ
server.js        API, auth, live updates, Razorpay, HQ, reminders at 9 AM IST
mkdemo.py        builds the static preview (no server)
