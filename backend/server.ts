
import 'dotenv/config';
// Set timezone to Moscow immediately
process.env.TZ = 'Europe/Moscow';

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool, types as pgTypes } from 'pg';
import { randomUUID, randomBytes } from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from './mailer';
import { getVapidPublicKey, sendPushToUser } from './push';

const app = express();
// Nginx sits in front on the same host — trust its X-Forwarded-For so rate limiting
// (and req.ip generally) keys off the real client IP, not nginx's loopback address.
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'autopro_super_secret_2025';

// Postgres DATE (OID 1082) драйвер по умолчанию превращает в JS Date на полночь
// в зоне сервера. При сериализации ответа в JSON дата уезжает в UTC и теряет сутки:
// 2026-08-24 -> "2026-08-23T21:00:00.000Z". Из-за этого аренда считалась
// просроченной на день раньше срока — фактически сразу после выдачи.
// Календарной дате часовой пояс не нужен, поэтому отдаём её строкой YYYY-MM-DD как есть.
pgTypes.setTypeParser(1082, (value: string) => value);

// TIMESTAMP WITHOUT TIME ZONE (OID 1114) — та же беда: значение хранится как
// «стенные часы» по Москве, но драйвер делает из него момент времени, и в JSON
// оно уезжает на 3 часа назад. Операция, проведённая в 01:30, попадала
// во вчерашний день — касса и отчёты врали на стыке суток.
// Отдаём как есть, заменив пробел на 'T', чтобы строка осталась валидной датой
// для JS и разбиралась как локальное время.
pgTypes.setTypeParser(1114, (value: string) => (value ? value.replace(' ', 'T') : value));

// Используем пул соединений
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Хелперы
const toCamelCase = (str: string) => str.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const mapKeys = (obj: any, mapper: (s: string) => string) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[mapper(key)] = obj[key];
  });
  return newObj;
};

// Инициализация БД
const initDB = async () => {
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      public_brand_name TEXT,
      public_slug TEXT,
      subscription_until TIMESTAMP,
      is_trial BOOLEAN DEFAULT TRUE,
      active_plan TEXT,
      settings JSONB DEFAULT '{}',
      owner_id UUID REFERENCES users(id),
      permissions JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cars (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER,
      plate TEXT NOT NULL,
      status TEXT NOT NULL,
      price_per_day INTEGER NOT NULL,
      price_per_hour INTEGER,
      category TEXT,
      mileage INTEGER DEFAULT 0,
      fuel TEXT,
      transmission TEXT,
      images TEXT[],
      investor_id TEXT,
      investor_share INTEGER DEFAULT 0,
      last_oil_change_mileage INTEGER,
      oil_change_interval INTEGER
    );

    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      passport TEXT,
      driver_license TEXT,
      debt INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      start_time TEXT,
      end_date DATE NOT NULL,
      end_time TEXT,
      total_amount INTEGER NOT NULL,
      prepayment INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      contract_number TEXT,
      payment_status TEXT,
      is_reservation BOOLEAN DEFAULT FALSE,
      booking_type TEXT DEFAULT 'DAILY',
      extensions JSONB DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      description TEXT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      investor_id TEXT,
      client_id UUID,
      car_id UUID
    );

    CREATE TABLE IF NOT EXISTS investors (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      total_invested INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fines (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      description TEXT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      source TEXT
    );
    
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      client_dob TEXT,
      start_date DATE,
      start_time TEXT,
      end_date DATE,
      end_time TEXT,
      status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Переписка суперадмина (платформенная поддержка) с владельцами автопарков.
    -- Тред определяется парой (from_user_id, to_user_id) в любом порядке.
    CREATE TABLE IF NOT EXISTS support_messages (
      id UUID PRIMARY KEY,
      from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      is_broadcast BOOLEAN DEFAULT FALSE,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Нумерация договоров и броней своя у каждого аккаунта и начинается с 1.
    -- next_number хранит СЛЕДУЮЩИЙ номер к выдаче (см. присвоение при создании аренды).
    CREATE TABLE IF NOT EXISTS contract_counters (
      owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      next_number INTEGER NOT NULL DEFAULT 1
    );
  `;

  try {
    const client = await pool.connect();

    // 1. Создание таблиц
    await client.query(createTablesQuery);

    // 2. Миграции (добавление колонок если их нет)
    // Users migrations
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS public_brand_name TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS public_slug TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_until TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_plan TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'`);
    // New migrations for Staff in Users table
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'`);
    // CRITICAL FIX: Add created_at if missing
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    // Email verification / password reset
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`);

    // Договор и штраф — финансовые документы. При ON DELETE CASCADE удаление клиента
    // или автомобиля молча стирало всю связанную историю аренд и штрафов.
    // Меняем на SET NULL: документ остаётся, теряется только ссылка,
    // а интерфейс показывает «клиент удалён» / «авто удалено».
    // owner_id намеренно оставлен CASCADE — это граница арендатора системы.
    for (const [table, column] of [
      ['rentals', 'client_id'], ['rentals', 'car_id'],
      ['fines', 'client_id'], ['fines', 'car_id']
    ]) {
      const target = column === 'client_id' ? 'clients' : 'cars';
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_${column}_fkey`);
      await client.query(
        `ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_fkey
         FOREIGN KEY (${column}) REFERENCES ${target}(id) ON DELETE SET NULL`
      );
    }

    // Rentals migrations
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS extensions JSONB DEFAULT '[]'`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS prepayment INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'DAILY'`);

    // Cars migrations
    await client.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS investor_share INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS last_oil_change_mileage INTEGER`);
    await client.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS oil_change_interval INTEGER`);

    // Requests migrations
    await client.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_phone TEXT`);
    await client.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_dob TEXT`);

    // Безопасное изменение типа колонки client_id в requests
    try {
      await client.query(`ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_client_id_fkey`);
      await client.query(`ALTER TABLE requests ALTER COLUMN client_id TYPE TEXT USING client_id::text`);
    } catch (e) {
      console.log('Migration note: requests.client_id migration skipped or already done');
    }

    client.release();
    console.log('✅ База данных готова и обновлена');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
  }
};

app.use(cors());
app.use(express.json({ limit: '50mb' }) as any);

// --- RATE LIMITING ---
// Baseline for every API call: generous enough for a real admin session's parallel
// loadData() calls, tight enough to blunt scraping/bot floods (we see plenty in the logs).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Слишком много запросов. Попробуйте позже.' }
});
app.use('/api/', apiLimiter);

// Tight limiter for login/register — the actual brute-force/credential-stuffing surface.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Слишком много попыток входа. Попробуйте через 15 минут.' }
});

// Moderate limiter for the unauthenticated guest-catalog endpoints (fleet lookup, booking requests).
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Слишком много запросов. Попробуйте позже.' }
});

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Нет токена' });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Сессия истекла' });

    // Robust Owner ID Resolution for Staff
    // If the token doesn't have ownerId (old token) or role is STAFF, ensure we have the correct context
    if (!user.ownerId) {
       if (user.role === 'STAFF') {
          // Fallback: Fetch from DB if missing in token
          try {
             const { rows } = await pool.query('SELECT owner_id FROM users WHERE id = $1', [user.id]);
             if (rows.length > 0 && rows[0].owner_id) {
                user.ownerId = rows[0].owner_id;
             } else {
                user.ownerId = user.id; // Fallback to self if orphan
             }
          } catch(e) {
             console.error('Error fetching owner_id for staff', e);
             user.ownerId = user.id;
          }
       } else {
          // Admin/Client/Superadmin owns their data (or client specific logic)
          user.ownerId = user.id;
       }
    }

    req.user = user;
    next();
  });
};

// Функция для валидации UUID
const isValidUUID = (uuid: string) => {
  if (!uuid) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

// --- УВЕДОМЛЕНИЯ ---
interface NotificationInput { type: string; title: string; body: string; link?: string }

// Кладёт запись в общий журнал уведомлений и параллельно шлёт push (если есть подписка).
// Журнал не зависит от push: уведомление видно в колокольчике, даже если пользователь
// ни разу не разрешал браузеру пуши.
const notifyUser = async (userId: string, n: NotificationInput) => {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, userId, n.type, n.title, n.body, n.link || null]
  );
  await sendPushToUser(pool, userId, { title: n.title, body: n.body, link: n.link });
};

// Новая заявка касается не только владельца автопарка, но и его сотрудников —
// они тоже оформляют аренды и должны увидеть заявку без опоздания.
const notifyOwnerTeam = async (ownerId: string, n: NotificationInput) => {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE id = $1 OR (owner_id = $1 AND role = 'STAFF')`,
    [ownerId]
  );
  await Promise.all(rows.map(r => notifyUser(r.id, n)));
};

// --- PUBLIC ROUTES ---

app.get('/api/public/fleet/:slug', publicLimiter, async (req: any, res: any) => {
  try {
    const { slug } = req.params;
    // Используем id::text для корректного сравнения UUID и slug
    const userResult = await pool.query(
      'SELECT id, name, email, public_brand_name, public_slug, settings, active_plan, is_trial FROM users WHERE public_slug = $1 OR id::text = $1',
      [slug]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Автопарк не найден' });
    }

    const owner = mapKeys(userResult.rows[0], toCamelCase);

    const carsResult = await pool.query('SELECT * FROM cars WHERE owner_id = $1', [owner.id]);
    const cars = carsResult.rows.map(r => mapKeys(r, toCamelCase));

    const rentalsResult = await pool.query(
      "SELECT * FROM rentals WHERE owner_id = $1 AND status = 'ACTIVE'",
      [owner.id]
    );
    const rentals = rentalsResult.rows.map(r => {
      const item = mapKeys(r, toCamelCase);
      if (typeof item.extensions === 'string') {
        try { item.extensions = JSON.parse(item.extensions); } catch (e) { item.extensions = []; }
      }
      return item;
    });

    res.json({ owner, cars, rentals });
  } catch (err: any) {
    console.error('Public API Error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/public/request', publicLimiter, async (req: any, res: any) => {
  try {
    let { id, ownerId, carId, clientId, clientName, clientPhone, clientDob, startDate, startTime, endDate, endTime, status } = req.body;

    if (!id || !isValidUUID(id)) id = randomUUID();

    const ownerCheck = await pool.query('SELECT id FROM users WHERE id = $1', [ownerId]);
    if (ownerCheck.rows.length === 0) return res.status(400).json({ message: 'Владелец автопарка не найден' });

    await pool.query(
      `INSERT INTO requests
      (id, owner_id, car_id, client_id, client_name, client_phone, client_dob, start_date, start_time, end_date, end_time, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, ownerId, carId, clientId, clientName, clientPhone, clientDob, startDate, startTime, endDate, endTime, status]
    );

    // Оповещаем владельца автопарка и его сотрудников — push, только если у них есть подписка.
    notifyOwnerTeam(ownerId, {
      type: 'NEW_REQUEST',
      title: 'Новая заявка',
      body: `${clientName || 'Клиент'} хочет забронировать автомобиль`,
      link: 'REQUESTS'
    }).catch((e) => console.error('Ошибка уведомления о заявке:', e.message));

    res.status(201).json({ success: true, id });
  } catch (err: any) {
    console.error('Public Request Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// --- AUTH ---
app.post('/api/auth/register', authLimiter, async (req: any, res: any) => {
  const { email, password, name } = req.body;
  // Public self-registration may only create ADMIN (new fleet owner) or CLIENT (guest catalog) accounts.
  // SUPERADMIN/STAFF must never be assignable by the caller here.
  const requestedRole = req.body.role;
  const safeRole = requestedRole === 'CLIENT' ? 'CLIENT' : 'ADMIN';
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();
    // Clients don't need email verification (no fleet/admin access at stake); admins do.
    const emailVerified = safeRole === 'CLIENT';
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, role, email_verified) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, hashedPassword, name, safeRole, emailVerified]
    );

    if (!emailVerified) {
      const verifyToken = randomBytes(32).toString('hex');
      await pool.query(
        `UPDATE users SET email_verify_token = $1, email_verify_expires = NOW() + INTERVAL '24 hours' WHERE id = $2`,
        [verifyToken, id]
      );
      sendVerificationEmail(email, name, verifyToken).catch(() => {});
    }

    // New user is Admin/Client, so they are their own owner
    const token = jwt.sign({ id, role: safeRole, ownerId: id }, JWT_SECRET);
    res.status(201).json({ user: { id, email, name, role: safeRole, emailVerified }, token });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(400).json({ message: 'Ошибка регистрации: ' + err.message });
  }
});

app.get('/api/auth/verify-email', authLimiter, async (req: any, res: any) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Не указан токен' });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE email_verify_token = $1 AND email_verify_expires > NOW()`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Ссылка недействительна или истекла' });
    }
    await pool.query(
      `UPDATE users SET email_verified = TRUE, email_verify_token = NULL, email_verify_expires = NULL WHERE id = $1`,
      [rows[0].id]
    );
    res.json({ message: 'Email подтверждён' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/resend-verification', authLimiter, authenticateToken, async (req: any, res: any) => {
  try {
    const { rows } = await pool.query('SELECT email, name, email_verified FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Пользователь не найден' });
    if (rows[0].email_verified) return res.json({ message: 'Email уже подтверждён' });

    const verifyToken = randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE users SET email_verify_token = $1, email_verify_expires = NOW() + INTERVAL '24 hours' WHERE id = $2`,
      [verifyToken, req.user.id]
    );
    await sendVerificationEmail(rows[0].email, rows[0].name, verifyToken);
    res.json({ message: 'Письмо отправлено повторно' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/change-password', authLimiter, authenticateToken, async (req: any, res: any) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Не хватает данных' });
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Новый пароль должен быть не короче 6 символов' });
  }
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Пользователь не найден' });
    // Текущий пароль обязателен: иначе перехваченная сессия позволила бы
    // сменить пароль и полностью увести аккаунт.
    if (!await bcrypt.compare(currentPassword, rows[0].password_hash)) {
      return res.status(401).json({ message: 'Текущий пароль указан неверно' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Пароль изменён' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/forgot-password', authLimiter, async (req: any, res: any) => {
  const { email } = req.body;
  const genericMessage = 'Если такой email зарегистрирован, письмо со ссылкой для сброса пароля отправлено';
  try {
    const { rows } = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (rows.length > 0) {
      const resetToken = randomBytes(32).toString('hex');
      await pool.query(
        `UPDATE users SET password_reset_token = $1, password_reset_expires = NOW() + INTERVAL '1 hour' WHERE id = $2`,
        [resetToken, rows[0].id]
      );
      sendPasswordResetEmail(email, rows[0].name, resetToken).catch(() => {});
    }
    // Always the same response — never reveal whether the email exists.
    res.json({ message: genericMessage });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req: any, res: any) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Не хватает данных' });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Ссылка недействительна или истекла' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2`,
      [hashedPassword, rows[0].id]
    );
    res.json({ message: 'Пароль обновлён' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req: any, res: any) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Не найден' });
    const user = rows[0];
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ message: 'Неверный пароль' });

    // If user is Staff, use their owner_id. If Admin, use their own id.
    const effectiveOwnerId = user.role === 'STAFF' ? user.owner_id : user.id;

    const token = jwt.sign({ id: user.id, role: user.role, ownerId: effectiveOwnerId }, JWT_SECRET);
    const { password_hash, ...safeUser } = user;
    res.json({ user: mapKeys(safeUser, toCamelCase), token });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/auth/logout', (req, res) => {
  res.status(200).json({ message: 'Logged out' });
});

app.get('/api/auth/me', authenticateToken, async (req: any, res: any) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({message: 'User not found'});
    const { password_hash, ...safeUser } = rows[0];
    res.json(mapKeys(safeUser, toCamelCase));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// --- PUSH ---
app.get('/api/push/vapid-public-key', (req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ message: 'Push не настроен на сервере' });
  res.json({ publicKey: key });
});

app.post('/api/push/subscribe', authenticateToken, async (req: any, res: any) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ message: 'Некорректная подписка' });
  try {
    // Один и тот же браузер может переподписаться (например, после очистки данных) —
    // endpoint уникален, поэтому просто обновляем владельца и ключи.
    await pool.query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $2, p256dh = $4, auth = $5`,
      [randomUUID(), req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.status(201).json({ message: 'Подписка сохранена' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/push/unsubscribe', authenticateToken, async (req: any, res: any) => {
  const { endpoint } = req.body;
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
    res.json({ message: 'Подписка удалена' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// --- NOTIFICATIONS (колокольчик) ---
app.get('/api/notifications', authenticateToken, async (req: any, res: any) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows.map(r => mapKeys(r, toCamelCase)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req: any, res: any) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [req.user.id]);
    res.status(204).send();
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req: any, res: any) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// --- SUPPORT CHAT (суперадмин <-> владельцы автопарков) ---

// Список ADMIN-тредов для инбокса суперадмина: последнее сообщение и число непрочитанных.
app.get('/api/support/threads', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ message: 'Доступ запрещён' });
  try {
    const { rows } = await pool.query(`
      SELECT u.id AS user_id, u.name, u.email,
        (SELECT body FROM support_messages
          WHERE from_user_id = u.id OR to_user_id = u.id
          ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM support_messages
          WHERE from_user_id = u.id OR to_user_id = u.id
          ORDER BY created_at DESC LIMIT 1) AS last_at,
        (SELECT COUNT(*)::int FROM support_messages
          WHERE from_user_id = u.id AND to_user_id = $1 AND is_read = FALSE) AS unread
      FROM users u
      WHERE u.role = 'ADMIN'
      ORDER BY last_at DESC NULLS LAST, u.name ASC
    `, [req.user.id]);
    res.json(rows.map(r => mapKeys(r, toCamelCase)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Для ADMIN — его переписка с поддержкой (кем бы она ни велась — считаем контрагентом
// первого найденного SUPERADMIN). Для SUPERADMIN — переписка с конкретным ADMIN (?adminId=).
app.get('/api/support/messages', authenticateToken, async (req: any, res: any) => {
  try {
    let otherUserId: string;
    if (req.user.role === 'SUPERADMIN') {
      if (!req.query.adminId) return res.status(400).json({ message: 'Не указан adminId' });
      otherUserId = req.query.adminId;
    } else if (req.user.role === 'ADMIN') {
      const { rows } = await pool.query(`SELECT id FROM users WHERE role = 'SUPERADMIN' ORDER BY created_at ASC LIMIT 1`);
      if (rows.length === 0) return res.json([]);
      otherUserId = rows[0].id;
    } else {
      return res.status(403).json({ message: 'Доступ запрещён' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM support_messages
        WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)
        ORDER BY created_at ASC`,
      [req.user.id, otherUserId]
    );
    res.json(rows.map(r => mapKeys(r, toCamelCase)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/support/messages', authenticateToken, async (req: any, res: any) => {
  const { body, toUserId, broadcast } = req.body;
  if (!body?.trim()) return res.status(400).json({ message: 'Пустое сообщение' });

  try {
    let recipients: string[] = [];

    if (req.user.role === 'SUPERADMIN') {
      if (broadcast) {
        const { rows } = await pool.query(`SELECT id FROM users WHERE role = 'ADMIN'`);
        recipients = rows.map(r => r.id);
      } else if (toUserId) {
        recipients = [toUserId];
      } else {
        return res.status(400).json({ message: 'Укажите получателя или broadcast' });
      }
    } else if (req.user.role === 'ADMIN') {
      const { rows } = await pool.query(`SELECT id FROM users WHERE role = 'SUPERADMIN' ORDER BY created_at ASC LIMIT 1`);
      if (rows.length === 0) return res.status(503).json({ message: 'Поддержка временно недоступна' });
      recipients = [rows[0].id];
    } else {
      return res.status(403).json({ message: 'Доступ запрещён' });
    }

    const isBroadcast = req.user.role === 'SUPERADMIN' && !!broadcast;
    const inserted = await Promise.all(recipients.map(async (toId) => {
      const id = randomUUID();
      const { rows } = await pool.query(
        `INSERT INTO support_messages (id, from_user_id, to_user_id, body, is_broadcast)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, req.user.id, toId, body.trim(), isBroadcast]
      );
      // Сообщение уже записано и будет доставлено получателю при следующем опросе/входе
      // независимо от уведомления — сбой push/колокольчика не должен превращать
      // успешную отправку в ошибку 500 для отправителя.
      notifyUser(toId, {
        type: 'SUPPORT_MESSAGE',
        title: req.user.role === 'SUPERADMIN' ? 'Сообщение от поддержки' : 'Новое сообщение',
        body: body.trim().slice(0, 140),
        link: 'SUPPORT_CHAT'
      }).catch((e: any) => console.error('Ошибка уведомления о сообщении:', e.message));
      return rows[0];
    }));

    res.status(201).json(mapKeys(inserted[0], toCamelCase));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/support/messages/read', authenticateToken, async (req: any, res: any) => {
  try {
    const otherUserId = req.user.role === 'SUPERADMIN' ? req.body.adminId : null;
    if (req.user.role === 'SUPERADMIN' && !otherUserId) {
      return res.status(400).json({ message: 'Не указан adminId' });
    }
    if (req.user.role === 'SUPERADMIN') {
      await pool.query(
        `UPDATE support_messages SET is_read = TRUE WHERE to_user_id = $1 AND from_user_id = $2 AND is_read = FALSE`,
        [req.user.id, otherUserId]
      );
    } else {
      await pool.query(`UPDATE support_messages SET is_read = TRUE WHERE to_user_id = $1 AND is_read = FALSE`, [req.user.id]);
    }
    res.status(204).send();
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// --- STAFF MANAGEMENT (Stored in Users Table) ---

app.get('/api/staff', authenticateToken, async (req: any, res: any) => {
  try {
    // Get users who are staff AND owned by current admin (req.user.ownerId should be correct)
    const { rows } = await pool.query(
      "SELECT id, name, email as login, email, role, permissions, created_at as \"createdAt\" FROM users WHERE role = 'STAFF' AND owner_id = $1",
      [req.user.ownerId] // Admin views their staff.
    );
    res.json(rows.map(r => mapKeys(r, toCamelCase)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post('/api/staff', authenticateToken, async (req: any, res: any) => {
  const { name, email, password, role, permissions } = req.body;

  // Use email as login if login provided, or vice versa.
  const userEmail = email || req.body.login;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email занят' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();

    // Correctly assign owner_id to the creator's ownerId (Admin)
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, role, owner_id, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, userEmail, hashedPassword, name, 'STAFF', req.user.ownerId, JSON.stringify(permissions || {})]
    );

    res.status(201).json({ id, name, email: userEmail, login: userEmail, role: 'STAFF', permissions });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/staff/:id', authenticateToken, async (req: any, res: any) => {
  const { name, email, password, permissions } = req.body;
  const userEmail = email || req.body.login;

  try {
    let query = 'UPDATE users SET name = $1, email = $2, permissions = $3 WHERE id = $4 AND owner_id = $5';
    let params = [name, userEmail, JSON.stringify(permissions || {}), req.params.id, req.user.ownerId];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET name = $1, email = $2, permissions = $3, password_hash = $4 WHERE id = $5 AND owner_id = $6';
      params = [name, userEmail, JSON.stringify(permissions || {}), hashedPassword, req.params.id, req.user.ownerId];
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Сотрудник не найден' });

    res.json({ id: req.params.id, name, email: userEmail, login: userEmail, permissions });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/staff/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 AND owner_id = $2 AND role = 'STAFF'", [req.params.id, req.user.ownerId]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Сотрудник не найден' });
    res.status(204).send();
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});


// --- GENERIC CRUD ---
const setupCrud = (resource: string, fields: string[]) => {
  const snakeFields = fields.map(toSnakeCase);

  app.get(`/api/${resource}`, authenticateToken, async (req: any, res: any) => {
    try {
      let query;
      // CRITICAL FIX: Use ownerId to scope data. This allows Staff to see Admin's data.
      let values = [req.user.ownerId];

      if (resource === 'requests') {
         if (req.user.role === 'CLIENT') {
             query = `SELECT * FROM requests WHERE client_id = $1`;
             values = [req.user.id]; // Clients use their own ID
         } else {
             query = `SELECT * FROM requests WHERE owner_id = $1::uuid OR client_id = $2::text`;
             // For Admin/Staff, owner_id matches their fleet.
             // We also allow finding requests where client_id matches (legacy logic), but owner_id is primary.
             values = [req.user.ownerId, req.user.ownerId];
         }
      }
      else if (resource === 'rentals' && req.user.role === 'CLIENT') {
         query = `SELECT * FROM rentals WHERE client_id = $1`;
         values = [req.user.id];
      }
      else {
         const hasClientId = ['rentals', 'transactions', 'fines'].includes(resource);
         if (hasClientId) {
           // Allow viewing if owner_id matches (Admin fleet) OR owner_id is NULL (Legacy data assumed to be Admin's)
           query = `SELECT * FROM ${resource} WHERE owner_id = $1 OR owner_id IS NULL OR client_id = $1`;
         } else {
           query = `SELECT * FROM ${resource} WHERE owner_id = $1 OR owner_id IS NULL`;
         }
      }

      const { rows } = await pool.query(query, values);
      res.json(rows.map(r => {
        const item = mapKeys(r, toCamelCase);
        if (resource === 'rentals' && typeof item.extensions === 'string') {
          try { item.extensions = JSON.parse(item.extensions); } catch (e) { item.extensions = []; }
        }
        return item;
      }));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(`/api/${resource}`, authenticateToken, async (req: any, res: any) => {
    let id = req.body.id;
    if (!id || !isValidUUID(id)) id = randomUUID();

    const data = req.body;

    if (resource === 'rentals') {
      // Номер договора не доверяем клиенту — раньше это было случайное 4-значное
      // число (могло повториться, не давало предсказуемой нумерации). Присваиваем
      // атомарно через счётчик на владельца: у каждого аккаунта отсчёт договоров
      // и броней начинается с 1, независимо от других аккаунтов. INSERT..ON CONFLICT
      // — один атомарный запрос, безопасен при одновременном создании нескольких аренд.
      const prefix = data.isReservation ? 'Б' : 'Д';
      const { rows } = await pool.query(
        `INSERT INTO contract_counters (owner_id, next_number) VALUES ($1, 1)
         ON CONFLICT (owner_id) DO UPDATE SET next_number = contract_counters.next_number + 1
         RETURNING next_number`,
        [req.user.ownerId]
      );
      data.contractNumber = `${prefix}-${rows[0].next_number}`;
    }

    const columns = ['id', 'owner_id', ...snakeFields];

    // CRITICAL FIX: Insert using ownerId. Staff creates records owned by Admin.
    const values = [
      id,
      req.user.ownerId,
      ...fields.map(f => {
        const val = data[f];
        if (resource === 'rentals' && f === 'extensions') return JSON.stringify(val || []);
        return val === undefined ? null : val;
      })
    ];

    const placeholders = columns.map((col, i) => {
        const index = i + 1;
        if (resource === 'rentals' && col === 'extensions') return `$${index}::jsonb`;
        return `$${index}`;
    }).join(', ');

    try {
      if (resource === 'fines') {
        await pool.query('UPDATE clients SET debt = debt + $1 WHERE id = $2', [data.amount, data.clientId]);
      }
      await pool.query(`INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders})`, values);
      res.status(201).json({ ...data, id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put(`/api/${resource}/:id`, authenticateToken, async (req: any, res: any) => {
    const data = req.body;
    const setClause = snakeFields.map((f, i) => {
        const index = i + 1;
        if (resource === 'rentals' && f === 'extensions') return `${f} = $${index}::jsonb`;
        return `${f} = $${index}`;
    }).join(', ');

    const values = [
      ...fields.map(f => {
        const val = data[f];
        if (resource === 'rentals' && f === 'extensions') return JSON.stringify(val || []);
        return val === undefined ? null : val;
      }),
      req.params.id,
      req.user.ownerId // Ensure update is on record owned by current fleet owner
    ];

    try {
      // Allow updating NULL owner_id records by implicitly claiming them (via logic) or just by ID if user has access.
      // Fix: Allow updating if owner_id IS NULL as well for legacy support.
      const result = await pool.query(`UPDATE ${resource} SET ${setClause} WHERE id = $${fields.length + 1} AND (owner_id = $${fields.length + 2} OR owner_id IS NULL) RETURNING *`, values);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Запись не найдена' });

      const item = mapKeys(result.rows[0], toCamelCase);
      if (resource === 'rentals' && typeof item.extensions === 'string') {
        try { item.extensions = JSON.parse(item.extensions); } catch (e) { item.extensions = []; }
      }
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete(`/api/${resource}/:id`, authenticateToken, async (req: any, res: any) => {
    try {
      await pool.query(`DELETE FROM ${resource} WHERE id = $1 AND (owner_id = $2 OR owner_id IS NULL)`, [req.params.id, req.user.ownerId]);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
};

// Одна машина не может быть сдана двум клиентам на пересекающиеся даты.
// Проверка обязана жить на сервере: интерфейс можно обойти прямым запросом к API.
// Регистрируется до setupCrud('rentals'), поэтому срабатывает раньше generic-обработчика.
const checkRentalConflict = async (req: any, res: any, next: any) => {
  const { carId, startDate, startTime, endDate, endTime, status } = req.body;

  // Отменённые и завершённые аренды машину не занимают.
  if (status && status !== 'ACTIVE') return next();
  if (!carId || !startDate || !endDate) return next();

  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.contract_number, r.start_date, r.start_time, r.end_date, r.end_time,
              c.name AS client_name
         FROM rentals r
         LEFT JOIN clients c ON c.id = r.client_id
        WHERE r.car_id = $1
          AND r.status = 'ACTIVE'
          AND ($2::uuid IS NULL OR r.id <> $2::uuid)
          AND (r.owner_id = $3 OR r.owner_id IS NULL)
          -- пересечение отрезков: начало одного строго раньше конца другого и наоборот
          AND (r.start_date + COALESCE(NULLIF(r.start_time, ''), '00:00')::time)
              < ($6::date + COALESCE(NULLIF($7, ''), '00:00')::time)
          AND ($4::date + COALESCE(NULLIF($5, ''), '00:00')::time)
              < (r.end_date + COALESCE(NULLIF(r.end_time, ''), '00:00')::time)
        LIMIT 1`,
      [carId, req.params.id || null, req.user.ownerId, startDate, startTime, endDate, endTime]
    );

    if (rows.length > 0) {
      const busy = rows[0];
      const until = `${new Date(busy.end_date).toLocaleDateString('ru-RU')} ${busy.end_time || ''}`.trim();
      return res.status(409).json({
        message: `Автомобиль уже занят по договору № ${busy.contract_number || '—'}`
          + (busy.client_name ? ` (${busy.client_name})` : '')
          + ` до ${until}. Выберите другое авто или другие даты.`
      });
    }
    next();
  } catch (err: any) {
    console.error('Ошибка проверки пересечения аренд:', err.message);
    next();
  }
};

app.post('/api/rentals', authenticateToken, checkRentalConflict);
app.put('/api/rentals/:id', authenticateToken, checkRentalConflict);

// Клиента и автомобиль нельзя удалить, пока за ними числятся договоры:
// иначе из учёта пропадает то, на что ссылаются деньги в кассе.
// Внешние ключи переведены на SET NULL как страховка, но нормальный путь —
// сказать об этом вслух, а не терять связи молча.
const blockDeleteWithContracts = (field: 'client_id' | 'car_id', label: string) =>
  async (req: any, res: any, next: any) => {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM rentals
          WHERE ${field} = $1 AND (owner_id = $2 OR owner_id IS NULL)`,
        [req.params.id, req.user.ownerId]
      );
      if (rows[0].count > 0) {
        return res.status(409).json({
          message: `Нельзя удалить: ${label} связан с договорами (${rows[0].count} шт.). `
            + `Они содержат финансовую историю. Сначала удалите или завершите эти договоры.`
        });
      }
      next();
    } catch (err: any) {
      console.error('Ошибка проверки связей перед удалением:', err.message);
      next();
    }
  };

app.delete('/api/clients/:id', authenticateToken, blockDeleteWithContracts('client_id', 'клиент'));
app.delete('/api/cars/:id', authenticateToken, blockDeleteWithContracts('car_id', 'автомобиль'));

setupCrud('cars', ['brand', 'model', 'year', 'plate', 'status', 'pricePerDay', 'pricePerHour', 'category', 'mileage', 'fuel', 'transmission', 'images', 'investorId', 'investorShare', 'lastOilChangeMileage', 'oilChangeInterval']);
setupCrud('clients', ['name', 'phone', 'email', 'passport', 'driverLicense', 'debt']);
// REMOVED 'staff' from generic CRUD setup, as it is now handled by custom endpoints using 'users' table
setupCrud('investors', ['name', 'phone', 'email', 'totalInvested', 'balance']);
setupCrud('rentals', ['carId', 'clientId', 'startDate', 'startTime', 'endDate', 'endTime', 'totalAmount', 'prepayment', 'status', 'contractNumber', 'paymentStatus', 'isReservation', 'bookingType', 'extensions']);
setupCrud('transactions', ['amount', 'type', 'category', 'description', 'date', 'investorId', 'clientId', 'carId']);
setupCrud('fines', ['clientId', 'carId', 'amount', 'description', 'date', 'status', 'source']);
setupCrud('requests', ['carId', 'clientId', 'clientName', 'clientPhone', 'clientDob', 'startDate', 'startTime', 'endDate', 'endTime', 'status']);

// USER MANAGEMENT (Superadmin)
app.get('/api/admin/users', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ message: 'Доступ запрещен' });
  try {
    const { rows } = await pool.query('SELECT id, email, name, role, public_brand_name, public_slug, subscription_until, is_trial, active_plan, settings FROM users');
    res.json(rows.map(r => mapKeys(r, toCamelCase)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/admin/users/:id', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'SUPERADMIN' && req.user.id !== req.params.id) {
    return res.status(403).json({ message: 'Доступ запрещен' });
  }

  const { name, email, role, publicBrandName, publicSlug, subscriptionUntil, isTrial, activePlan, settings } = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
  if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email); }
  if (role !== undefined && req.user.role === 'SUPERADMIN') { updates.push(`role = $${idx++}`); values.push(role); }
  if (publicBrandName !== undefined) { updates.push(`public_brand_name = $${idx++}`); values.push(publicBrandName); }
  if (publicSlug !== undefined) { updates.push(`public_slug = $${idx++}`); values.push(publicSlug); }
  if (subscriptionUntil !== undefined) { updates.push(`subscription_until = $${idx++}`); values.push(subscriptionUntil); }
  if (isTrial !== undefined) { updates.push(`is_trial = $${idx++}`); values.push(isTrial); }
  if (activePlan !== undefined) { updates.push(`active_plan = $${idx++}`); values.push(activePlan); }
  if (settings !== undefined) {
    updates.push(`settings = COALESCE(settings, '{}'::jsonb) || $${idx}::jsonb`);
    values.push(settings);
    idx++;
  }

  if (updates.length === 0) return res.json({ message: 'Нет изменений' });

  values.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, public_brand_name, public_slug, subscription_until, is_trial, active_plan, settings`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Пользователь не найден' });
    res.json(mapKeys(rows[0], toCamelCase));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ message: 'Доступ запрещен' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// REQUEST STATUS UPDATE
app.patch(`/api/requests/:id/status`, authenticateToken, async (req: any, res: any) => {
    const { status } = req.body;
    const requestId = req.params.id;
    const ownerId = req.user.ownerId; // Use ownerId

    try {
        const requestRes = await pool.query('SELECT * FROM requests WHERE id = $1 AND owner_id = $2', [requestId, ownerId]);
        if (requestRes.rows.length === 0) return res.status(404).json({ message: 'Заявка не найдена' });
        const request = requestRes.rows[0];

        if (status === 'APPROVED') {
            let finalClientId = request.client_id;
            const requestPhone = request.client_phone || 'Не указан';
            const requestName = request.client_name || 'Гость';
            const isUuid = isValidUUID(finalClientId);

            if (!finalClientId || !isUuid || finalClientId === 'guest' || finalClientId === 'null') {
                let found = false;
                if (requestPhone !== 'Не указан') {
                    const clientRes = await pool.query('SELECT id FROM clients WHERE phone = $1 AND owner_id = $2', [requestPhone, ownerId]);
                    if (clientRes.rows.length > 0) {
                        finalClientId = clientRes.rows[0].id;
                        found = true;
                    }
                }
                if (!found) {
                    finalClientId = randomUUID();
                    await pool.query('INSERT INTO clients (id, owner_id, name, phone, created_at) VALUES ($1, $2, $3, $4, NOW())', [finalClientId, ownerId, requestName, requestPhone]);
                }
            } else {
                const existsRes = await pool.query('SELECT id FROM clients WHERE id = $1', [finalClientId]);
                if (existsRes.rows.length === 0) {
                     await pool.query('INSERT INTO clients (id, owner_id, name, phone, created_at) VALUES ($1, $2, $3, $4, NOW())', [finalClientId, ownerId, requestName, requestPhone]);
                }
            }

            const rentalId = randomUUID();
            const contractNumber = `RES-${Math.floor(1000 + Math.random() * 9000)}`;
            const startDate = request.start_date || new Date().toISOString().split('T')[0];
            const endDate = request.end_date || new Date().toISOString().split('T')[0];

            await pool.query(
                `INSERT INTO rentals (id, owner_id, car_id, client_id, start_date, start_time, end_date, end_time, total_amount, status, contract_number, payment_status, is_reservation, booking_type, extensions) VALUES ($1, $2, $3, $4, $5::date, $6, $7::date, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [rentalId, ownerId, request.car_id, finalClientId, startDate, request.start_time || '10:00', endDate, request.end_time || '10:00', 0, 'ACTIVE', contractNumber, 'DEBT', true, 'DAILY', '[]']
            );
            await pool.query('UPDATE requests SET status = $1, client_id = $2 WHERE id = $3', [status, finalClientId, requestId]);
            res.json({ success: true });
        } else {
            await pool.query('UPDATE requests SET status = $1 WHERE id = $2 AND owner_id = $3', [status, requestId, ownerId]);
            res.json({ success: true });
        }
    } catch(e: any) {
        console.error('Error updating request status:', e);
        res.status(500).json({message: e.message});
    }
});

// FINE PAYMENT
app.patch('/api/fines/:id/pay', authenticateToken, async (req: any, res: any) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM fines WHERE id = $1', [req.params.id]);
    if (rows.length === 0) throw new Error('Штраф не найден');
    const fine = rows[0];
    await db.query('UPDATE fines SET status = $1 WHERE id = $2', ['Оплачен', req.params.id]);
    await db.query('UPDATE clients SET debt = debt - $1 WHERE id = $2', [fine.amount, fine.client_id]);
    await db.query('INSERT INTO transactions (id, owner_id, amount, type, category, description, client_id, car_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [randomUUID(), req.user.ownerId, fine.amount, 'Доход', 'Штраф', `Оплата штрафа: ${fine.description}`, fine.client_id, fine.car_id]);
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err: any) {
    await db.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { db.release(); }
});

// Суперадмин создаётся только отсюда: публичная регистрация роль SUPERADMIN
// не выдаёт. Пароль (SUPERADMIN_PASSWORD) необязателен — если он не задан,
// у существующей учётки только проверяется роль, пароль не трогается.
const seedSuperadmin = async () => {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email) return;

  try {
    const { rows } = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);

    if (rows.length === 0) {
      if (!password) {
        console.warn(`⚠️  SUPERADMIN_EMAIL задан, но пользователя нет и SUPERADMIN_PASSWORD не указан — учётка не создана`);
        return;
      }
      const id = randomUUID();
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO users (id, email, password_hash, name, role, email_verified)
         VALUES ($1, $2, $3, $4, 'SUPERADMIN', TRUE)`,
        [id, email, hash, 'Суперадмин']
      );
      console.log(`👑 Создан суперадмин: ${email}`);
      return;
    }

    const user = rows[0];
    const updates: string[] = [];

    if (user.role !== 'SUPERADMIN') {
      await pool.query(`UPDATE users SET role = 'SUPERADMIN' WHERE id = $1`, [user.id]);
      updates.push('роль повышена до SUPERADMIN');
    }
    // Суперадмину подтверждение email не нужно — иначе он заперт на экране подтверждения.
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1 AND email_verified IS NOT TRUE`, [user.id]);

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, user.id]);
      updates.push('пароль синхронизирован с .env');
    }

    if (updates.length) console.log(`👑 Суперадмин ${email}: ${updates.join(', ')}`);
  } catch (err: any) {
    console.error('Ошибка создания суперадмина:', err.message);
  }
};

initDB()
  .then(seedSuperadmin)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
  });
