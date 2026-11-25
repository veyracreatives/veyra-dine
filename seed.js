// Creates a demo restaurant ("The Masala Table") with a full menu, 8 tables and a few sample orders.
// Run: npm run seed   (safe to run again: it replaces only the demo restaurant)
'use strict';
const path = require('path');
const { db, saveNow, newRestaurant, id } = require('./server');
const { fillDemo } = require('./lib/demo');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const old = db.restaurants.find(r => r.slug === 'masala-table');
if (old) db.tables = db.tables.filter(x => x.restaurantId !== old.id);
const r = old || newRestaurant({ name: 'The Masala Table', slug: 'masala-table', password: 'demo1234', email: 'demo@veyradine.app', ownerName: 'Demo owner' });
r.trialEnds = new Date(Date.now() + 22.5 * 86400000).toISOString(); // shows the trial bar
Object.assign(r, {
  tagline: 'Home-style Indian kitchen · Vashi',
  brandColor: '#C2410C',
  address: 'Sector 17, Vashi, Navi Mumbai',
  footerNote: 'All prices include taxes. Tell us about any allergies.',
  socials: { instagram: 'https://instagram.com/', google: 'https://g.page/' },
});
const tables = fillDemo(r, { db, id, uploadDir: UPLOAD_DIR });

saveNow();
console.log('Demo restaurant ready.');
console.log('  Admin:  /admin  ->  Restaurant ID: masala-table   Password: demo1234');
console.log('  Menu:   /m/masala-table?t=' + tables[4].token + '   (Table 5)');
