
import 'dotenv/config';
// Set timezone to Moscow immediately
process.env.TZ = 'Europe/Moscow';

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'autopro_super_secret_2025';

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
      active_plan TEXT
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
      investor_share INTEGER DEFAULT 0
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

    CREATE TABLE IF NOT EXISTS staff (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Rentals migrations
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS extensions JSONB DEFAULT '[]'`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS prepayment INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'DAILY'`);

    // Cars migrations
    await client.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS investor_share INTEGER DEFAULT 0`);

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

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Нет токена' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Сессия истекла' });
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

// --- PUBLIC ROUTES ---

app.get('/api/public/fleet/:slug', async (req: any, res: any) => {
  try {
    const { slug } = req.params;
    // Используем id::text для корректного сравнения UUID и slug
    const userResult = await pool.query(
      'SELECT id, name, email, public_brand_name, public_slug FROM users WHERE public_slug = $1 OR id::text = $1',
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

app.post('/api/public/request', async (req: any, res: any) => {
  try {
    let { id, ownerId, carId, clientId, clientName, clientPhone, clientDob, startDate, startTime, endDate, endTime, status } = req.body;

    // Если ID не передан или имеет неверный формат (например, "req-..."), генерируем новый UUID
    if (!id || !isValidUUID(id)) {
      id = randomUUID();
    }

    // Проверяем существование владельца
    const ownerCheck = await pool.query('SELECT id FROM users WHERE id = $1', [ownerId]);
    if (ownerCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Владелец автопарка не найден' });
    }

    await pool.query(
      `INSERT INTO requests 
      (id, owner_id, car_id, client_id, client_name, client_phone, client_dob, start_date, start_time, end_date, end_time, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, ownerId, carId, clientId, clientName, clientPhone, clientDob, startDate, startTime, endDate, endTime, status]
    );

    res.status(201).json({ success: true, id });
  } catch (err: any) {
    console.error('Public Request Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// --- AUTH ---
app.post('/api/auth/register', async (req: any, res: any) => {
  const { email, password, name, role } = req.body;
  try {
    // Проверка существования email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();
    await pool.query('INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)', [id, email, hashedPassword, name, role || 'ADMIN']);
    const token = jwt.sign({ id, role: role || 'ADMIN' }, JWT_SECRET);
    res.status(201).json({ user: { id, email, name, role: role || 'ADMIN' }, token });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(400).json({ message: 'Ошибка регистрации: ' + err.message });
  }
});

app.post('/api/auth/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Не найден' });
    const user = rows[0];
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ message: 'Неверный пароль' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
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

// --- USER MANAGEMENT ---

app.get('/api/admin/users', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ message: 'Доступ запрещен' });
  try {
    const { rows } = await pool.query('SELECT id, email, name, role, public_brand_name, public_slug, subscription_until, is_trial, active_plan FROM users');
    res.json(rows.map(r => mapKeys(r, toCamelCase)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/admin/users/:id', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'SUPERADMIN' && req.user.id !== req.params.id) {
    return res.status(403).json({ message: 'Доступ запрещен' });
  }

  const { name, email, role, publicBrandName, publicSlug, subscriptionUntil, isTrial, activePlan } = req.body;
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

  if (updates.length === 0) return res.json({ message: 'Нет изменений' });

  values.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, public_brand_name, public_slug, subscription_until, is_trial, active_plan`,
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

// --- FINES PAYMENT ---
app.patch('/api/fines/:id/pay', authenticateToken, async (req: any, res: any) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM fines WHERE id = $1', [req.params.id]);
    if (rows.length === 0) throw new Error('Штраф не найден');
    const fine = rows[0];

    await db.query('UPDATE fines SET status = $1 WHERE id = $2', ['Оплачен', req.params.id]);
    await db.query('UPDATE clients SET debt = debt - $1 WHERE id = $2', [fine.amount, fine.client_id]);
    await db.query('INSERT INTO transactions (id, owner_id, amount, type, category, description, client_id, car_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [randomUUID(), req.user.id, fine.amount, 'Доход', 'Штраф', `Оплата штрафа: ${fine.description}`, fine.client_id, fine.car_id]);

    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err: any) {
    await db.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { db.release(); }
});

// --- GENERIC CRUD ---
const setupCrud = (resource: string, fields: string[]) => {
  const snakeFields = fields.map(toSnakeCase);

  app.get(`/api/${resource}`, authenticateToken, async (req: any, res: any) => {
    try {
      let query;
      let values = [req.user.id];

      // Special handling for requests to avoid Type Mismatch (UUID vs TEXT)
      if (resource === 'requests') {
         if (req.user.role === 'CLIENT') {
             query = `SELECT * FROM requests WHERE client_id = $1`;
         } else {
             // For admins/staff, we check both owner_id and client_id.
             // We explicitly cast to avoid "operator does not exist" errors
             query = `SELECT * FROM requests WHERE owner_id = $1::uuid OR client_id = $2::text`;
             values = [req.user.id, req.user.id];
         }
      }
      // Special handling for rentals for clients
      else if (resource === 'rentals' && req.user.role === 'CLIENT') {
         query = `SELECT * FROM rentals WHERE client_id = $1`;
      }
      else {
         // Standard logic
         const hasClientId = ['rentals', 'transactions', 'fines'].includes(resource);
         if (hasClientId) {
           query = `SELECT * FROM ${resource} WHERE owner_id = $1 OR client_id = $1`;
         } else {
           query = `SELECT * FROM ${resource} WHERE owner_id = $1`;
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
      console.error(`Error GET /api/${resource}:`, err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(`/api/${resource}`, authenticateToken, async (req: any, res: any) => {
    // FIX: Always use valid UUID for ID, unless it's staff (which might use custom format, but safer to use UUID)
    // Legacy 'req-' text IDs cause 500 error if DB expects UUID.
    let id = req.body.id;
    if (!id || !isValidUUID(id)) {
        id = randomUUID();
    }

    // Special exception for staff if needed, or keep uniform UUID
    if (resource === 'staff' && req.body.id && req.body.id.startsWith('staff-')) {
       // Allow legacy if your DB supports it, otherwise use UUID
    }

    const data = req.body;
    const columns = ['id', 'owner_id', ...snakeFields];

    const values = [
      id,
      req.user.id,
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
      console.error(`Error POST /api/${resource}:`, err);
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
      req.user.id // Check ownership
    ];

    try {
      const result = await pool.query(`UPDATE ${resource} SET ${setClause} WHERE id = $${fields.length + 1} AND owner_id = $${fields.length + 2} RETURNING *`, values);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Запись не найдена' });

      const item = mapKeys(result.rows[0], toCamelCase);
      if (resource === 'rentals' && typeof item.extensions === 'string') {
        try { item.extensions = JSON.parse(item.extensions); } catch (e) { item.extensions = []; }
      }
      res.json(item);
    } catch (err: any) {
      console.error(`Error PUT /api/${resource}:`, err);
      res.status(500).json({ message: err.message });
    }
  });

  // Специальный маршрут для обновления статуса заявки
  if (resource === 'requests') {
      app.patch(`/api/requests/:id/status`, authenticateToken, async (req: any, res: any) => {
          const { status } = req.body;
          const requestId = req.params.id;
          const ownerId = req.user.id;

          try {
              // 1. Получаем саму заявку
              const requestRes = await pool.query('SELECT * FROM requests WHERE id = $1 AND owner_id = $2', [requestId, ownerId]);
              if (requestRes.rows.length === 0) {
                  return res.status(404).json({ message: 'Заявка не найдена' });
              }
              const request = requestRes.rows[0];

              // 2. Если статус APPROVED, создаем бронь в rentals
              if (status === 'APPROVED') {
                  let finalClientId = request.client_id;
                  const requestPhone = request.client_phone || 'Не указан';
                  const requestName = request.client_name || 'Гость';

                  // Проверка, является ли client_id валидным UUID
                  const isUuid = isValidUUID(finalClientId);

                  // Если клиент не определен, или это "guest", или это не UUID - ищем или создаем
                  if (!finalClientId || !isUuid || finalClientId === 'guest' || finalClientId === 'null') {
                      let found = false;
                      // Пытаемся найти по телефону
                      if (requestPhone !== 'Не указан') {
                          const clientRes = await pool.query('SELECT id FROM clients WHERE phone = $1 AND owner_id = $2', [requestPhone, ownerId]);
                          if (clientRes.rows.length > 0) {
                              finalClientId = clientRes.rows[0].id;
                              found = true;
                          }
                      }

                      if (!found) {
                          // Создаем нового клиента
                          finalClientId = randomUUID();
                          await pool.query(
                              'INSERT INTO clients (id, owner_id, name, phone, created_at) VALUES ($1, $2, $3, $4, NOW())',
                              [finalClientId, ownerId, requestName, requestPhone]
                          );
                      }
                  } else {
                      // Если ID похож на UUID, проверим, есть ли он реально в базе
                      const existsRes = await pool.query('SELECT id FROM clients WHERE id = $1', [finalClientId]);
                      if (existsRes.rows.length === 0) {
                           // ID выглядит как UUID, но в базе нет -> создаем (восстанавливаем)
                           await pool.query(
                              'INSERT INTO clients (id, owner_id, name, phone, created_at) VALUES ($1, $2, $3, $4, NOW())',
                              [finalClientId, ownerId, requestName, requestPhone]
                          );
                      }
                  }

                  const rentalId = randomUUID();
                  const contractNumber = `RES-${Math.floor(1000 + Math.random() * 9000)}`;

                  // Safe dates
                  const startDate = request.start_date || new Date().toISOString().split('T')[0];
                  const endDate = request.end_date || new Date().toISOString().split('T')[0];

                  await pool.query(
                      `INSERT INTO rentals (
                          id, owner_id, car_id, client_id, start_date, start_time, end_date, end_time, 
                          total_amount, status, contract_number, payment_status, is_reservation, booking_type, extensions
                      ) VALUES ($1, $2, $3, $4, $5::date, $6, $7::date, $8, $9, $10, $11, $12, $13, $14, $15)`,
                      [
                          rentalId,
                          ownerId,
                          request.car_id,
                          finalClientId, // Используем теперь точно существующий UUID
                          startDate,
                          request.start_time || '10:00',
                          endDate,
                          request.end_time || '10:00',
                          0,
                          'ACTIVE',
                          contractNumber,
                          'DEBT',
                          true,
                          'DAILY',
                          '[]'
                      ]
                  );

                  // Обновляем заявку с реальным client_id
                  await pool.query('UPDATE requests SET status = $1, client_id = $2 WHERE id = $3', [status, finalClientId, requestId]);

                  res.json({ success: true });
              } else {
                  // Если статус REJECTED
                  await pool.query('UPDATE requests SET status = $1 WHERE id = $2 AND owner_id = $3', [status, requestId, ownerId]);
                  res.json({ success: true });
              }
          } catch(e: any) {
              console.error('Error updating request status:', e);
              res.status(500).json({message: e.message});
          }
      });
  }

  app.delete(`/api/${resource}/:id`, authenticateToken, async (req: any, res: any) => {
    try {
      await pool.query(`DELETE FROM ${resource} WHERE id = $1 AND owner_id = $2`, [req.params.id, req.user.id]);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
};

setupCrud('cars', ['brand', 'model', 'year', 'plate', 'status', 'pricePerDay', 'pricePerHour', 'category', 'mileage', 'fuel', 'transmission', 'images', 'investorId', 'investorShare']);
setupCrud('clients', ['name', 'phone', 'email', 'passport', 'driverLicense', 'debt']);
setupCrud('staff', ['name', 'login', 'passwordHash', 'role']);
setupCrud('investors', ['name', 'phone', 'email', 'totalInvested', 'balance']);
setupCrud('rentals', ['carId', 'clientId', 'startDate', 'startTime', 'endDate', 'endTime', 'totalAmount', 'prepayment', 'status', 'contractNumber', 'paymentStatus', 'isReservation', 'bookingType', 'extensions']);
setupCrud('transactions', ['amount', 'type', 'category', 'description', 'date', 'investorId', 'clientId', 'carId']);
setupCrud('fines', ['clientId', 'carId', 'amount', 'description', 'date', 'status', 'source']);
setupCrud('requests', ['carId', 'clientId', 'clientName', 'clientPhone', 'clientDob', 'startDate', 'startTime', 'endDate', 'endTime', 'status']);

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
});
