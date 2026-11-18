// Veyra only: make a license key for a customer who paid.
// Needs the PRIVATE key file, which must never be shipped with the app or shared.
//
//   node tools/make-license.js --name "Hotel Sai Palace" --phone 9820000000 --plan lifetime
//   node tools/make-license.js --name "Cafe Bloom" --plan yearly --days 365
//   (optional) --key path/to/veyra-dine-private-key.pem   (default: ./veyra-dine-private-key.pem)
'use strict';
const crypto = require('crypto');
const fs = require('fs');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.name) { console.log('Usage: node tools/make-license.js --name "Restaurant name" [--phone 98xxxxxxx] [--plan lifetime|yearly] [--days 365]'); process.exit(1); }

const keyFile = args.key || 'veyra-dine-private-key.pem';
if (!fs.existsSync(keyFile)) { console.error(`Private key not found at ${keyFile}. Pass --key with its path.`); process.exit(1); }
const privateKey = fs.readFileSync(keyFile, 'utf8');

const payload = { n: args.name, p: args.plan || 'lifetime', iat: new Date().toISOString().slice(0, 10), id: crypto.randomBytes(4).toString('hex') };
if (args.phone) payload.ph = args.phone;
if (args.days) payload.exp = new Date(Date.now() + Number(args.days) * 86400000).toISOString().slice(0, 10);

const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.sign(null, Buffer.from(body), privateKey).toString('base64url');
const key = `VD1-${body}.${sig}`;

console.log('\nLicense for:', payload.n, `(${payload.p}${payload.exp ? ', until ' + payload.exp : ''})`);
console.log('\n' + key + '\n');
fs.appendFileSync('licenses-issued.csv', `${payload.iat},${JSON.stringify(payload.n)},${payload.ph || ''},${payload.p},${payload.exp || ''},${payload.id},${key}\n`);
console.log('Saved to licenses-issued.csv\n');
