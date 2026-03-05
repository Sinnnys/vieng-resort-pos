const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databasePath =
  process.env.DATABASE_PATH ||
  path.join(__dirname, '..', 'data', 'app.sqlite');

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new sqlite3.Database(databasePath);
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomNumber TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'available',
      imageUrl TEXT,
      notes TEXT,
      price REAL,
      contactNumber TEXT,
      address TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
});

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onComplete(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

module.exports = { db, run, all, get, databasePath };
