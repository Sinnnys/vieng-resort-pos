const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./db');

const app = express();
const port = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-pos-secret';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const frontendDist = process.env.FRONTEND_DIST_PATH || path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

const now = () => new Date().toISOString();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.admin = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// ── Auth ────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin.id, username: admin.username, displayName: admin.displayName, role: admin.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, admin: { id: admin.id, username: admin.username, displayName: admin.displayName, role: admin.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.admin);
});

// ── Admin Management (owner only) ───────────────────────
app.get('/api/admins', authMiddleware, (req, res) => {
  if (req.admin.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  res.json(db.prepare('SELECT id, username, displayName, role, createdAt FROM admins ORDER BY id').all());
});

app.post('/api/admins', authMiddleware, (req, res) => {
  if (req.admin.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  const { username, displayName, password, role } = req.body;
  if (!username || !password || !displayName) return res.status(400).json({ error: 'username, displayName, password required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const { lastInsertRowid } = db.prepare('INSERT INTO admins (username, displayName, passwordHash, role) VALUES (?, ?, ?, ?)').run(username, displayName, hash, role || 'admin');
    res.status(201).json(db.prepare('SELECT id, username, displayName, role, createdAt FROM admins WHERE id = ?').get(lastInsertRowid));
  } catch (e) { res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Username already exists' : e.message }); }
});

app.delete('/api/admins/:id', authMiddleware, (req, res) => {
  if (req.admin.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  if (Number(req.params.id) === req.admin.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.put('/api/admins/:id/password', authMiddleware, (req, res) => {
  const targetId = Number(req.params.id);
  if (req.admin.role !== 'owner' && req.admin.id !== targetId) return res.status(403).json({ error: 'Forbidden' });
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password too short' });
  db.prepare('UPDATE admins SET passwordHash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), targetId);
  res.json({ ok: true });
});

// ── Upload ──────────────────────────────────────────────
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: now() }));

// ── Public routes (customer page needs these) ───────────
app.get('/api/categories', (_req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sortOrder, name').all());
});

app.get('/api/menu', (_req, res) => {
  res.json(db.prepare(`
    SELECT m.*, c.name as categoryName
    FROM menu_items m LEFT JOIN categories c ON c.id = m.categoryId
    ORDER BY c.sortOrder, c.name, m.name
  `).all());
});

app.get('/api/orders/table/:table', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE tableNumber = ? AND status != 'cancelled' ORDER BY createdAt DESC").all(Number(req.params.table));
  const getItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?');
  res.json(orders.map((o) => ({ ...o, items: getItems.all(o.id) })));
});

app.post('/api/orders', (req, res) => {
  const { tableNumber, items, note, customerContact } = req.body;
  if (!tableNumber || !items?.length) return res.status(400).json({ error: 'tableNumber and items required' });

  const getMenuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?');
  const insertOrder = db.prepare('INSERT INTO orders (tableNumber, totalAmount, note, customerContact) VALUES (?, ?, ?, ?)');
  const insertItem = db.prepare('INSERT INTO order_items (orderId, menuItemId, name, price, quantity, note) VALUES (?, ?, ?, ?, ?, ?)');

  const txn = db.transaction(() => {
    let total = 0;
    const resolvedItems = items.map((it) => {
      const menu = getMenuItem.get(it.menuItemId);
      if (!menu) throw new Error(`Menu item ${it.menuItemId} not found`);
      if (!menu.available) throw new Error(`${menu.name} is not available`);
      const qty = Math.max(1, Number(it.quantity) || 1);
      total += menu.price * qty;
      return { menuItemId: menu.id, name: menu.name, price: menu.price, quantity: qty, note: it.note || null };
    });
    const { lastInsertRowid } = insertOrder.run(Number(tableNumber), total, note || null, customerContact || null);
    resolvedItems.forEach((it) => insertItem.run(lastInsertRowid, it.menuItemId, it.name, it.price, it.quantity, it.note));
    return lastInsertRowid;
  });

  try {
    const orderId = txn();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId);
    res.status(201).json({ ...order, items: orderItems });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/orders/:id/receipt', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(order.id);
  res.json({ ...order, items });
});

// ── Protected admin routes ──────────────────────────────
app.post('/api/categories', authMiddleware, (req, res) => {
  const { name, sortOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { lastInsertRowid } = db.prepare('INSERT INTO categories (name, sortOrder) VALUES (?, ?)').run(name, sortOrder || 0);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(lastInsertRowid));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/categories/:id', authMiddleware, (req, res) => {
  const { name, sortOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('UPDATE categories SET name = ?, sortOrder = ? WHERE id = ?').run(name, sortOrder || 0, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

app.delete('/api/categories/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.post('/api/menu', authMiddleware, (req, res) => {
  const { name, categoryId, price, imageUrl, available, description } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO menu_items (name, categoryId, price, imageUrl, available, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, categoryId || null, Number(price), imageUrl || null, available !== undefined ? (available ? 1 : 0) : 1, description || null);
  res.status(201).json(db.prepare('SELECT m.*, c.name as categoryName FROM menu_items m LEFT JOIN categories c ON c.id = m.categoryId WHERE m.id = ?').get(lastInsertRowid));
});

app.put('/api/menu/:id', authMiddleware, (req, res) => {
  const { name, categoryId, price, imageUrl, available, description } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  db.prepare(
    'UPDATE menu_items SET name = ?, categoryId = ?, price = ?, imageUrl = ?, available = ?, description = ?, updatedAt = ? WHERE id = ?'
  ).run(name, categoryId || null, Number(price), imageUrl || null, available ? 1 : 0, description || null, now(), req.params.id);
  res.json(db.prepare('SELECT m.*, c.name as categoryName FROM menu_items m LEFT JOIN categories c ON c.id = m.categoryId WHERE m.id = ?').get(req.params.id));
});

app.delete('/api/menu/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const { status, table, from, to } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
  if (table) { sql += ' AND tableNumber = ?'; params.push(Number(table)); }
  if (from) { sql += ' AND DATE(createdAt) >= ?'; params.push(from); }
  if (to) { sql += ' AND DATE(createdAt) <= ?'; params.push(to); }
  sql += ' ORDER BY createdAt DESC LIMIT 200';
  const orders = db.prepare(sql).all(...params);
  const getItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?');
  res.json(orders.map((o) => ({ ...o, items: getItems.all(o.id) })));
});

app.get('/api/orders/active', authMiddleware, (_req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status IN ('pending','preparing','served') ORDER BY createdAt DESC").all();
  const getItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?');
  res.json(orders.map((o) => ({ ...o, items: getItems.all(o.id) })));
});

app.patch('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'preparing', 'served', 'paid', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?').run(status, now(), req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(order.id);
  res.json({ ...order, items });
});

app.get('/api/inventory', authMiddleware, (_req, res) => {
  res.json(db.prepare('SELECT * FROM inventory ORDER BY category, name').all());
});

app.post('/api/inventory', authMiddleware, (req, res) => {
  const { name, quantity, unit, minStock, category, imageUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO inventory (name, quantity, unit, minStock, category, imageUrl) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, Number(quantity) || 0, unit || 'pcs', Number(minStock) || 0, category || null, imageUrl || null);
  res.status(201).json(db.prepare('SELECT * FROM inventory WHERE id = ?').get(lastInsertRowid));
});

app.put('/api/inventory/:id', authMiddleware, (req, res) => {
  const { name, quantity, unit, minStock, category, imageUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('UPDATE inventory SET name = ?, quantity = ?, unit = ?, minStock = ?, category = ?, imageUrl = ?, updatedAt = ? WHERE id = ?')
    .run(name, Number(quantity) || 0, unit || 'pcs', Number(minStock) || 0, category || null, imageUrl || null, now(), req.params.id);
  res.json(db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id));
});

app.delete('/api/inventory/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ── Stats (protected) ───────────────────────────────────
app.get('/api/stats/summary', authMiddleware, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayRevenue = db.prepare("SELECT COALESCE(SUM(totalAmount),0) as total FROM orders WHERE status = 'paid' AND DATE(createdAt) = ?").get(today);
  const todayOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE DATE(createdAt) = ?").get(today);
  const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending','preparing','served')").get();
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(totalAmount),0) as total FROM orders WHERE status = 'paid'").get();
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE quantity <= minStock').get();
  const avgOrder = db.prepare("SELECT COALESCE(AVG(totalAmount),0) as avg FROM orders WHERE status = 'paid'").get();
  res.json({ todayRevenue: todayRevenue.total, todayOrders: todayOrders.count, activeOrders: activeOrders.count, totalRevenue: totalRevenue.total, lowStockItems: lowStock.count, avgOrderValue: Math.round(avgOrder.avg) });
});

app.get('/api/stats/daily', authMiddleware, (req, res) => {
  const days = Number(req.query.days) || 7;
  res.json(db.prepare(`
    SELECT DATE(createdAt) as date, COUNT(*) as orders,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN totalAmount ELSE 0 END), 0) as revenue
    FROM orders WHERE createdAt >= datetime('now', '-' || ? || ' days')
    GROUP BY DATE(createdAt) ORDER BY date
  `).all(days));
});

app.get('/api/stats/top-items', authMiddleware, (_req, res) => {
  res.json(db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as totalQty, SUM(oi.price * oi.quantity) as totalRevenue
    FROM order_items oi JOIN orders o ON o.id = oi.orderId WHERE o.status = 'paid'
    GROUP BY oi.menuItemId ORDER BY totalQty DESC LIMIT 10
  `).all());
});

app.get('/api/stats/hourly', authMiddleware, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json(db.prepare(`
    SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as orders,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN totalAmount ELSE 0 END), 0) as revenue
    FROM orders WHERE DATE(createdAt) = ? GROUP BY hour ORDER BY hour
  `).all(today));
});

app.get('/api/stats/category-sales', authMiddleware, (_req, res) => {
  res.json(db.prepare(`
    SELECT COALESCE(c.name, 'Other') as category, SUM(oi.quantity) as totalQty, SUM(oi.price * oi.quantity) as totalRevenue
    FROM order_items oi JOIN orders o ON o.id = oi.orderId LEFT JOIN menu_items m ON m.id = oi.menuItemId LEFT JOIN categories c ON c.id = m.categoryId
    WHERE o.status = 'paid' GROUP BY c.name ORDER BY totalRevenue DESC
  `).all());
});

app.delete('/api/tables/:table/orders', authMiddleware, (req, res) => {
  const table = Number(req.params.table);
  db.prepare("DELETE FROM order_items WHERE orderId IN (SELECT id FROM orders WHERE tableNumber = ?)").run(table);
  db.prepare("DELETE FROM orders WHERE tableNumber = ?").run(table);
  res.json({ ok: true });
});

app.get('/api/tables/overview', authMiddleware, (_req, res) => {
  const totalTables = 20;
  const occupied = db.prepare("SELECT DISTINCT tableNumber FROM orders WHERE status IN ('pending','preparing','served')").all().map(r => r.tableNumber);
  const tableAmounts = db.prepare("SELECT tableNumber, SUM(totalAmount) as total FROM orders WHERE status IN ('pending','preparing','served') GROUP BY tableNumber").all();
  const orderCounts = db.prepare("SELECT tableNumber, COUNT(*) as cnt FROM orders WHERE status IN ('pending','preparing','served') GROUP BY tableNumber").all();
  const amountMap = {}; tableAmounts.forEach(r => { amountMap[r.tableNumber] = r.total; });
  const countMap = {}; orderCounts.forEach(r => { countMap[r.tableNumber] = r.cnt; });
  const tables = [];
  for (let i = 1; i <= totalTables; i++) {
    tables.push({ number: i, occupied: occupied.includes(i), activeAmount: amountMap[i] || 0, orderCount: countMap[i] || 0 });
  }
  res.json(tables);
});

// ── SPA fallback ────────────────────────────────────────
app.get('*', (_req, res) => { res.sendFile(path.join(frontendDist, 'index.html')); });

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => { console.log(`POS server listening on http://0.0.0.0:${port}`); });
