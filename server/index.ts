import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT || 3001);
const adminName = process.env.ADMIN_USERNAME || 'ehsan';
const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || '232111Eee@', 10);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      admin_username TEXT NOT NULL REFERENCES admins(username) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('آنلاین', 'آفلاین')),
      plan TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);
  `);

  await pool.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    [adminName, adminHash],
  );
  const usersCount = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  if (usersCount.rows[0]?.count === '0') {
    await pool.query(
      `INSERT INTO users (name, username, status, plan, last_seen) VALUES
       ('آرمان رضایی', 'arman.r', 'آنلاین', 'حرفه‌ای', 'هم‌اکنون'),
       ('سارا محمدی', 'sara.m', 'آنلاین', 'پایه', 'هم‌اکنون'),
       ('نیما کریمی', 'nima.k', 'آفلاین', 'حرفه‌ای', '۲ ساعت پیش'),
       ('نگار احمدی', 'negar.a', 'آنلاین', 'آزمایشی', 'هم‌اکنون'),
       ('پارسا حیدری', 'parsa.h', 'آفلاین', 'پایه', 'دیروز'),
       ('یلدا موسوی', 'yalda.m', 'آنلاین', 'حرفه‌ای', 'هم‌اکنون')
       ON CONFLICT (username) DO NOTHING`,
    );
  }
}

app.use(express.json());
app.post('/api/login', async (req, res, next) => {
  try {
  const { username, password } = req.body ?? {};
  const result = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM admins WHERE username = $1',
    [username],
  );
  if (typeof password !== 'string' || !result.rows[0] || !bcrypt.compareSync(password, result.rows[0].password_hash)) {
    return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است.' });
  }
  const token = crypto.randomUUID();
  await pool.query(
    `INSERT INTO sessions (token, admin_username, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [token, username],
  );
  res.json({ token, username });
  } catch (error) { next(error); }
});
app.use('/api', async (req, res, next) => {
  try {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'برای ادامه وارد شوید.' });
  const result = await pool.query(
    'SELECT 1 FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token],
  );
  if (!result.rowCount) return res.status(401).json({ message: 'نشست شما منقضی شده است؛ دوباره وارد شوید.' });
  next();
  } catch (error) { next(error); }
});
app.get('/api/users', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, username, status, plan, last_seen AS "lastSeen" FROM users ORDER BY id`,
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});
app.get('/api/subscriptions', (_req, res) => res.json([
  { name: 'حرفه‌ای', users: 128, price: '۲۹۹٬۰۰۰', color: 'violet', change: '+۱۲٪' },
  { name: 'پایه', users: 86, price: '۱۴۹٬۰۰۰', color: 'blue', change: '+۸٪' },
  { name: 'آزمایشی', users: 34, price: 'رایگان', color: 'amber', change: '+۳٪' },
]));
app.get('/api/chat', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, author, message AS text, created_at AS time
       FROM chat_messages ORDER BY created_at DESC LIMIT 100`,
    );
    res.json(result.rows.reverse());
  } catch (error) { next(error); }
});
app.post('/api/chat', async (req, res, next) => {
  try {
  const text = String(req.body?.message || '').trim();
  if (!text) return res.status(400).json({ message: 'پیام خالی است.' });
  const result = await pool.query(
    `INSERT INTO chat_messages (author, message) VALUES ('شما', $1)
     RETURNING id, author, message AS text, created_at AS time`,
    [text],
  );
  res.json(result.rows[0]);
  } catch (error) { next(error); }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../dist')));
  app.get('*', (_req, res) => res.sendFile(path.resolve(__dirname, '../dist/index.html')));
}
async function start() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL تنظیم نشده است. آدرس اتصال PostgreSQL را در محیط اجرا قرار دهید.');
  }
  await initializeDatabase();
  app.listen(port, () => console.log(`FilterShekan server running on http://localhost:${port}`));
}

start().catch((error: unknown) => {
  console.error('Could not start FilterShekan server:', error);
  process.exit(1);
});
