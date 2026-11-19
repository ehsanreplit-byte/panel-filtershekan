import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const app = express();
const port = Number(process.env.PORT || 3001);
const adminName = process.env.ADMIN_USERNAME || 'ehsan';
const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || '232111Eee@', 10);
const sessions = new Set<string>();

app.use(express.json());
app.post('/api/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (username !== adminName || typeof password !== 'string' || !bcrypt.compareSync(password, adminHash)) {
    return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است.' });
  }
  const token = crypto.randomUUID();
  sessions.add(token);
  res.json({ token, username: adminName });
});
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || !sessions.has(token)) return res.status(401).json({ message: 'برای ادامه وارد شوید.' });
  next();
});
app.get('/api/users', (_req, res) => res.json([
  { id: '1', name: 'آرمان رضایی', username: 'arman.r', status: 'آنلاین', plan: 'حرفه‌ای', lastSeen: 'هم‌اکنون' },
  { id: '2', name: 'سارا محمدی', username: 'sara.m', status: 'آنلاین', plan: 'پایه', lastSeen: 'هم‌اکنون' },
  { id: '3', name: 'نیما کریمی', username: 'nima.k', status: 'آفلاین', plan: 'حرفه‌ای', lastSeen: '۲ ساعت پیش' },
  { id: '4', name: 'نگار احمدی', username: 'negar.a', status: 'آنلاین', plan: 'آزمایشی', lastSeen: 'هم‌اکنون' },
  { id: '5', name: 'پارسا حیدری', username: 'parsa.h', status: 'آفلاین', plan: 'پایه', lastSeen: 'دیروز' },
  { id: '6', name: 'یلدا موسوی', username: 'yalda.m', status: 'آنلاین', plan: 'حرفه‌ای', lastSeen: 'هم‌اکنون' },
]));
app.get('/api/subscriptions', (_req, res) => res.json([
  { name: 'حرفه‌ای', users: 128, price: '۲۹۹٬۰۰۰', color: 'violet', change: '+۱۲٪' },
  { name: 'پایه', users: 86, price: '۱۴۹٬۰۰۰', color: 'blue', change: '+۸٪' },
  { name: 'آزمایشی', users: 34, price: 'رایگان', color: 'amber', change: '+۳٪' },
]));
app.post('/api/chat', (req, res) => {
  const text = String(req.body?.message || '').trim();
  if (!text) return res.status(400).json({ message: 'پیام خالی است.' });
  res.json({ id: crypto.randomUUID(), author: 'شما', text, time: new Date().toISOString() });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../dist')));
  app.get('*', (_req, res) => res.sendFile(path.resolve(__dirname, '../dist/index.html')));
}
app.listen(port, () => console.log(`FilterShekan server running on http://localhost:${port}`));
