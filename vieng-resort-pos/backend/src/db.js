const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'pos.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    sortOrder INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    categoryId INTEGER,
    price REAL NOT NULL DEFAULT 0,
    imageUrl TEXT,
    description TEXT,
    available INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tableNumber INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','served','paid','cancelled')),
    totalAmount REAL DEFAULT 0,
    note TEXT,
    customerContact TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    menuItemId INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER DEFAULT 1,
    note TEXT,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menuItemId) REFERENCES menu_items(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    minStock REAL DEFAULT 0,
    category TEXT,
    imageUrl TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );
`);

try { db.prepare('ALTER TABLE menu_items ADD COLUMN description TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE orders ADD COLUMN customerContact TEXT').run(); } catch (_) {}
try { db.prepare('ALTER TABLE inventory ADD COLUMN imageUrl TEXT').run(); } catch (_) {}

const bcrypt = require('bcryptjs');

function seedAdmins() {
  const count = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
  if (count > 0) return;
  const hash = bcrypt.hashSync('vx1234', 10);
  db.prepare('INSERT INTO admins (username, displayName, passwordHash, role) VALUES (?, ?, ?, ?)').run('viengxong', 'Viengxong', hash, 'owner');
  console.log('Seeded default admin account');
}
seedAdmins();

function seed() {
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  if (catCount > 0) return;

  const insertCat = db.prepare('INSERT INTO categories (name, sortOrder) VALUES (?, ?)');
  const insertItem = db.prepare('INSERT INTO menu_items (name, categoryId, price) VALUES (?, ?, ?)');

  const cats = [
    { name: 'Drinks', items: [
      { name: 'Iced Coffee', price: 15000 },
      { name: 'Iced Tea', price: 12000 },
      { name: 'Coca-Cola', price: 10000 },
      { name: 'Pepsi', price: 10000 },
      { name: 'Sprite', price: 10000 },
      { name: 'Water', price: 5000 },
      { name: 'Fresh Orange Juice', price: 20000 },
      { name: 'Smoothie', price: 25000 },
    ]},
    { name: 'Food', items: [
      { name: 'Fried Rice', price: 30000 },
      { name: 'Pad Thai', price: 35000 },
      { name: 'Spring Rolls (4pcs)', price: 20000 },
      { name: 'Grilled Chicken', price: 40000 },
      { name: 'French Fries', price: 18000 },
      { name: 'Club Sandwich', price: 28000 },
    ]},
    { name: 'Snacks', items: [
      { name: 'Chips', price: 8000 },
      { name: 'Ice Cream', price: 15000 },
      { name: 'Fruit Plate', price: 22000 },
    ]},
    { name: 'Beer & Cocktails', items: [
      { name: 'Beerlao', price: 15000 },
      { name: 'Tiger Beer', price: 18000 },
      { name: 'Mojito', price: 35000 },
      { name: 'Margarita', price: 38000 },
    ]},
  ];

  const txn = db.transaction(() => {
    cats.forEach((cat, idx) => {
      const { lastInsertRowid } = insertCat.run(cat.name, idx);
      cat.items.forEach((item) => insertItem.run(item.name, lastInsertRowid, item.price));
    });
  });
  txn();
  console.log('Seeded menu categories and items');
}

seed();

module.exports = db;
