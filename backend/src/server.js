const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { all } = require('./db');

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(cors({ origin: allowedOrigins, credentials: allowedOrigins !== '*' }));
app.use(express.json({ limit: '1mb' }));

const frontendDist = process.env.FRONTEND_DIST_PATH
  || path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/public/rooms', async (_req, res, next) => {
  try {
    const rows = await all(
      "SELECT * FROM rooms WHERE status = 'available' ORDER BY roomNumber COLLATE NOCASE"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});
