# Veyra Dine In: QR table ordering for restaurants

Guests scan the QR code on their table, see the menu, order and call a waiter from their phone.
The restaurant sees every order live, with the table number, a sound and a pop-up.
White-label: each restaurant has its own logo, colour, cover photo and social links.

## Run it on your computer (Windows, Mac or Linux)

1. Install Node.js 18 or newer from https://nodejs.org (the LTS version).
2. Open a terminal in this folder and run:
   ```
   npm install
   npm run seed
   npm start
   ```
3. Open http://localhost:3000

`npm run seed` adds a demo restaurant, "The Masala Table", with 24 dishes, 8 tables and a few sample orders.

| Page | Address | Login |
|---|---|---|
| Restaurant admin | /admin | Restaurant ID `masala-table`, password `demo1234` |
| Customer menu | Scan a QR from Tables & QR, or click "Test" on a table | none |
| Veyra platform (add restaurants) | /platform | The password printed in the terminal the first time the server starts |

### Test with a real phone
Phones can't open "localhost". Connect the phone to the same Wi-Fi as the computer and open the admin
using the "On your Wi-Fi" address the terminal prints (for example http://192.168.1.5:3000/admin).
The QR codes then point to that address and the phone can scan them.

## What each side can do

**Customer (phone, no app or login):** menu with photos, veg / non-veg marks, bestseller and spicy tags,
search, "Veg only" filter, category tabs, add to order, cooking instructions, place order, live order status
(sent, preparing, ready, served), order more, call a waiter, ask for the bill, ask for water, follow on
Instagram, rate on Google.

**Restaurant admin (computer, tablet or phone):** live order board (New, Preparing, Ready) with sound and
browser pop-up alerts, waiter and bill requests, today's orders and sales, order history by date, pause or
resume ordering, menu manager (categories, dishes, photos, prices, sold-out switch), tables with one QR code
each (download PNG, print 4 cards per A4 page, make a new code if one is misused), branding (logo, cover
photo, colour, Instagram, Facebook, WhatsApp, Google reviews, website, YouTube, Zomato, Swiggy, phone,
address) with a live phone preview, password change.

**Veyra platform:** add a restaurant (it gets its own login and menu link), reset a restaurant's password,
turn the "Powered by Veyra Dine In" credit on or off.

## Standout features
- **Table Together:** everyone at a table scans the same QR and adds to one shared order from their own phone, live. The order shows who added what ("for Asha").
- **Split the bill:** by what each person ate (tap a dish to share it across the table) or equally. Each person pays their share straight to the restaurant's UPI ID (Settings, "Split bill and UPI payments"). No gateway, no fees. "I've paid" alerts the counter; "Bill paid, clear table" starts a fresh bill.
- **Wait-time promise:** the app learns how long each dish really takes in this kitchen and tells guests "ready in about X min". The counter sees "Due in X min" or a red "Late by X min".
- **Coupons:** % or flat off, minimum order, maximum discount, expiry, usage limit, optional banner on the menu.

## Windows app
`npm run desktop` opens the counter app. `npm run dist:win` builds the Windows installer into `dist/`
(on Linux it needs wine).
- If `desktop/config.json` has `"serverUrl": "https://your-server"`, the app opens that online server, so guests'
  phones work on mobile data. Rebuild the installer after changing it.
- If `serverUrl` is empty, the app runs the server on the counter computer itself. Guests must then be on the
  restaurant Wi-Fi, and the computer should keep the same Wi-Fi address (reserve it in the router).
- Closing the window keeps it running in the tray so orders are not missed. It starts with Windows.

## Free trial and license keys
- Owners sign up at `/signup` (or in the Windows app) and get 30 days free. Prices are in `PLANS` in `server.js`.
- When the trial ends, guests can still see the menu but cannot order, and the admin asks for a license key.
- Veyra makes keys with `tools/make-license.js` and the private key (keep it secret, never put it in the app):
  `node tools/make-license.js --name "Cafe Bloom" --phone 98xxxxxxxx --plan lifetime`
  Yearly: `--plan yearly --days 365`. Each key works for one restaurant only.
- The `/platform` page shows every restaurant's plan and days left, and can extend a trial or mark it paid.

## Going live (later)
To put it online for a real restaurant it needs a server with a fixed web address (for example a small VPS,
Render or Railway) so the QR codes keep working. Set `PUBLIC_URL=https://your-address` so QR codes use that
address. Data is stored in `data/db.json` and photos in `data/uploads/`; back up the `data` folder.
Payments (UPI / Razorpay) and printing kitchen tickets are not built yet.
