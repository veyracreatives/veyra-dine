// The demo restaurant, "The Masala Table": a full menu with photos, dish choices, 8 tables and 30 days of orders.
// Used by `npm run seed` (local demo) and by the public demo on the website (/demo), which is rebuilt every day.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const SPICE = { id: 'spice', name: 'Spice level', req: true, multi: false, choices: [{ id: 'mild', name: 'Mild', price: 0 }, { id: 'medium', name: 'Medium', price: 0 }, { id: 'hot', name: 'Hot', price: 0 }] };
const JAIN = { id: 'jain', name: 'Jain', req: false, multi: true, choices: [{ id: 'jain', name: 'Make it Jain (no onion, garlic)', price: 0 }] };
const PORTION = (half, full) => ({ id: 'portion', name: 'Portion', req: true, multi: false, choices: [{ id: 'full', name: 'Full', price: full }, { id: 'half', name: 'Half', price: half }] });
const PIECES = { id: 'pieces', name: 'Pieces', req: true, multi: false, choices: [{ id: 'p6', name: '6 pieces', price: 0 }, { id: 'p12', name: '12 pieces', price: 150 }] };
const ADDONS = { id: 'addons', name: 'Add-ons', req: false, multi: true, max: 3, choices: [{ id: 'cheese', name: 'Extra cheese', price: 40 }, { id: 'butter', name: 'Extra butter', price: 20 }, { id: 'naan', name: 'Butter naan', price: 45 }] };

// Clears the restaurant's menu, orders, calls, coupons, guests and scores, then fills it again. Tables are kept.
function fillDemo(r, { db, id, uploadDir }) {
  const UPLOAD_DIR = uploadDir;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const k of ['categories', 'items', 'orders', 'requests', 'coupons', 'scores', 'guests', 'customers']) if (Array.isArray(db[k])) db[k] = db[k].filter(x => x.restaurantId !== r.id);
  r.orderSeq = 100;
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="100" fill="#C2410C"/><circle cx="100" cy="100" r="84" fill="none" stroke="#FED7AA" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/><text x="100" y="92" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#FFF7ED" letter-spacing="3">THE</text><text x="100" y="128" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="40" fill="#FFF7ED">Masala</text><text x="100" y="152" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#FED7AA" letter-spacing="5">TABLE</text></svg>`;
  fs.writeFileSync(path.join(UPLOAD_DIR, 'demo-logo.svg'), logoSvg);
  r.logo = '/uploads/demo-logo.svg';
  fs.copyFileSync(path.join(ROOT, 'seed-photos', 'paneer-tikka.jpg'), path.join(UPLOAD_DIR, 'demo-cover.jpg'));
  r.cover = '/uploads/demo-cover.jpg';

  const menu = {
    'Starters': [
      ['Paneer Tikka', 'Cottage cheese, peppers and onion, charred in the tandoor. Served with mint chutney.', 249, 'veg', 'paneer-tikka', { bestseller: true }],
      ['Chicken Tikka Skewers', 'Boneless chicken in yoghurt and Kashmiri chilli, grilled on coal.', 299, 'nonveg', 'chicken-tikka', { spicy: true }],
      ['Punjabi Samosa (2 pcs)', 'Crisp pastry with spiced potato and peas, with green and tamarind chutney.', 89, 'veg', 'samosa'],
      ['Chole Chaat', 'Chickpeas, onion, tomato, sev and tangy chutneys.', 119, 'veg', 'chole-chaat'],
    ],
    'Main Course': [
      ['Butter Chicken with Naan', 'Tandoori chicken in a silky tomato-butter gravy, with one butter naan.', 349, 'nonveg', 'butter-chicken', { bestseller: true }],
      ['Paneer Butter Masala', 'Soft paneer in a rich, mildly sweet tomato and cashew gravy.', 279, 'veg', 'paneer-butter-masala'],
      ['Chicken Handi', 'Slow-cooked chicken curry finished with fresh coriander.', 329, 'nonveg', 'chicken-handi'],
      ['Mutton Rogan Josh', 'Kashmiri-style mutton in a deep red, aromatic gravy.', 399, 'nonveg', 'mutton-rogan-josh', { spicy: true }],
      ['Veg Dum Biryani', 'Basmati rice and vegetables layered and dum-cooked. With raita.', 249, 'veg', 'veg-biryani'],
    ],
    'Mumbai Street': [
      ['Pav Bhaji', 'Butter-toasted pav with spicy mashed vegetable bhaji, onion and lemon.', 149, 'veg', 'pav-bhaji', { bestseller: true }],
      ['Misal Pav', 'Spicy sprouts curry topped with farsan, served with pav.', 139, 'veg', 'misal-pav', { spicy: true }],
    ],
    'South Indian': [
      ['Idli Sambar (3 pcs)', 'Steamed rice cakes with sambar and coconut chutney.', 99, 'veg', 'idli'],
      ['Idli Vada Combo', 'Two idlis and one medu vada with sambar and chutneys.', 129, 'veg', 'idli-vada'],
    ],
    'Burgers & Pizza': [
      ['Smash Burger & Fries', 'Double chicken patty, cheese, pickles and house sauce, with fries.', 249, 'nonveg', 'smash-burger'],
      ['Crispy Chicken Burger', 'Fried chicken thigh, slaw and chipotle mayo in a brioche bun.', 219, 'nonveg', 'crispy-chicken-burger'],
      ['Classic Veg Burger', 'Crunchy veg patty, lettuce, tomato and cheese.', 169, 'veg', 'classic-burger'],
      ['Margherita Pizza', 'Tomato sauce, mozzarella and basil on a thin crust.', 299, 'veg', 'margherita'],
    ],
    'Desserts': [
      ['Gajar Halwa', 'Slow-cooked carrot halwa with khoya and nuts. Served warm.', 129, 'veg', 'gajar-halwa'],
      ['Oreo Chocolate Sundae', 'Vanilla ice cream, chocolate sauce and crushed Oreo.', 159, 'veg', 'oreo-sundae'],
      ['Ice Cream (2 scoops)', 'Ask your server for today\'s flavours.', 99, 'veg', 'ice-cream'],
    ],
    'Drinks': [
      ['Fresh Fruit Smoothie', 'Banana, mango or mixed berry. Made with fresh fruit.', 149, 'veg', 'smoothie'],
      ['Signature Mocktail', 'Kala khatta, virgin mojito or blue lagoon.', 179, 'veg', 'mocktail'],
      ['Masala Chaas', 'Spiced buttermilk with roasted cumin.', 59, 'veg', null],
      ['Fresh Lime Soda', 'Sweet, salted or mixed.', 79, 'veg', null],
    ],
  };

  let sort = 0, csort = 0;
  for (const [cat, dishes] of Object.entries(menu)) {
    const c = { id: id(), restaurantId: r.id, name: cat, sort: csort++ };
    db.categories.push(c);
    for (const [name, description, price, diet, photo, extra = {}] of dishes) {
      let url = '';
      if (photo) { const file = 'demo-' + photo + '.jpg'; fs.copyFileSync(path.join(ROOT, 'seed-photos', photo + '.jpg'), path.join(UPLOAD_DIR, file)); url = '/uploads/' + file; }
      db.items.push({ id: id(), restaurantId: r.id, categoryId: c.id, name, description, price, diet, photo: url, available: true, bestseller: !!extra.bestseller, spicy: !!extra.spicy, sort: sort++ });
    }
  }
  db.items.find(i => i.name === 'Mutton Rogan Josh' && i.restaurantId === r.id).available = false;

  let tables = db.tables.filter(t => t.restaurantId === r.id).sort((a, b) => a.sort - b.sort); // a reset keeps the tables, so their QR links keep working
  for (let n = tables.length + 1; n <= 8; n++) { const t = { id: id(), restaurantId: r.id, name: 'Table ' + n, token: id(10), active: true, sort: n, createdAt: new Date().toISOString() }; db.tables.push(t); tables.push(t); }

  // sample orders so the admin screen is not empty
  const item = n => db.items.find(i => i.restaurantId === r.id && i.name === n);
  const mk = (table, lines, status, minsAgo, note = '', name = '') => {
    r.orderSeq += 1;
    const items = lines.map(([n, qty, lnote = '']) => { const it = item(n); return { itemId: it.id, name: it.name, price: it.price, qty, diet: it.diet, note: lnote }; });
    const t = new Date(Date.now() - minsAgo * 60000).toISOString();
    db.orders.push({ id: id(16), restaurantId: r.id, number: r.orderSeq, tableId: table.id, tableName: table.name, items, note, customerName: name, total: items.reduce((s, l) => s + l.price * l.qty, 0), status, createdAt: t, updatedAt: t });
  };
  // 30 days of past orders, so "Sales by date" has something to show
  {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const menuNames = db.items.filter(i => i.restaurantId === r.id && i.available !== false).map(i => i.name);
    for (let day = 30; day >= 1; day--) {
      const weekend = [0, 6].includes(new Date(Date.now() - day * 86400000).getDay());
      const count = Math.round((weekend ? 14 : 7) + rnd() * 8);
      for (let k = 0; k < count; k++) {
        const hour = rnd() < 0.4 ? 13 + rnd() * 2 : 19 + rnd() * 3;
        const when = new Date(Date.now() - day * 86400000); when.setHours(Math.floor(hour), Math.floor(rnd() * 60), 0, 0);
        const lines = []; const n = 1 + Math.floor(rnd() * 4);
        for (let j = 0; j < n; j++) { const nm = menuNames[Math.floor(rnd() * menuNames.length)]; if (!lines.some(l => l[0] === nm)) lines.push([nm, 1 + Math.floor(rnd() * 2)]); }
        mk(tables[Math.floor(rnd() * tables.length)], lines, rnd() < 0.04 ? 'cancelled' : 'served', (Date.now() - when) / 60000);
        { const o = db.orders[db.orders.length - 1]; const base = Math.max(...o.items.map(l => 8 + (l.name.length * 7) % 15)); o.readyAt = new Date(Date.parse(o.createdAt) + (base + rnd() * 5) * 60000).toISOString(); }
      }
    }
  }
  mk(tables[6], [['Paneer Tikka', 1], ['Pav Bhaji', 2], ['Masala Chaas', 2]], 'served', 62);
  mk(tables[3], [['Butter Chicken with Naan', 2], ['Veg Dum Biryani', 1], ['Fresh Lime Soda', 3]], 'ready', 21, '', 'Priya');
  mk(tables[1], [['Chicken Tikka Skewers', 1, 'Less spicy'], ['Margherita Pizza', 1]], 'preparing', 9);
  mk(tables[4], [['Paneer Butter Masala', 1], ['Idli Vada Combo', 2], ['Gajar Halwa', 2]], 'new', 1, 'No onion in the paneer please', 'Rahul');
  for (const o of db.orders) if (o.restaurantId === r.id && ['new', 'preparing'].includes(o.status)) o.readyBy = new Date(Date.parse(o.createdAt) + 16 * 60000).toISOString();
  db.coupons = (db.coupons || []).filter(c => c.restaurantId !== r.id);
  db.coupons.push({ id: id(), restaurantId: r.id, code: 'WELCOME10', type: 'percent', value: 10, minOrder: 400, maxOff: 150, maxUses: null, expires: null, active: true, showOnMenu: true, note: 'For every table', uses: 0, createdAt: new Date().toISOString() });
  db.coupons.push({ id: id(), restaurantId: r.id, code: 'WEEKDAY50', type: 'flat', value: 50, minOrder: 300, maxOff: null, maxUses: 100, expires: null, active: true, showOnMenu: false, note: '', uses: 12, createdAt: new Date().toISOString() });
  db.requests.push({ id: id(12), restaurantId: r.id, tableId: tables[7].id, tableName: tables[7].name, type: 'bill', done: false, createdAt: new Date(Date.now() - 60000).toISOString() });


  // dish choices, so people can try spice level, Jain, half / full and add-ons
  const set = (n, opts, extra = {}) => { const it = item(n); if (it) Object.assign(it, { options: opts }, extra); };
  set('Paneer Tikka', [SPICE, JAIN], { chef: true });
  set('Chicken Tikka Skewers', [SPICE, PIECES]);
  set('Butter Chicken with Naan', [PORTION(-100, 0), ADDONS]);
  set('Paneer Butter Masala', [JAIN, PORTION(-90, 0), ADDONS]);
  set('Pav Bhaji', [SPICE, JAIN, ADDONS], { isNew: true });
  set('Misal Pav', [SPICE]);
  set('Margherita Pizza', [ADDONS]);
  return tables;
}

module.exports = { fillDemo };
