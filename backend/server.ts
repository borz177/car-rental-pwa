import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'autopro_super_secret_2025';

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Database Initialization
const initDB = async () => {
  const query = `
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
      mileage INTEGER,
      fuel TEXT,
      transmission TEXT,
      images TEXT[],
      investor_id TEXT,
      investor_share INTEGER
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

    CREATE TABLE IF NOT EXISTS staff (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      status TEXT NOT NULL,
      contract_number TEXT,
      payment_status TEXT
    );

    CREATE TABLE IF NOT EXISTS requests (
      id UUID PRIMARY KEY,
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
      client_id UUID REFERENCES users(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL,
      start_date DATE NOT NULL,
      start_time TEXT,
      end_date DATE NOT NULL,
      end_time TEXT,
      status TEXT NOT NULL,
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
  `;
  try {
    await pool.query(query);
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ DB Init Error:', err);
  }
};

// Utilities for Case Mapping
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamelCase = (str: string) => str.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));

const mapKeys = (obj: any, mapper: (s: string) => string) => {
  if (!obj) return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[mapper(key)] = obj[key];
  });
  return newObj;
};

// Middleware
app.use(cors());
// Fix: Added 'as any' to bypass type check for JSON middleware
app.use(express.json({ limit: '50mb' }) as any);

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

// Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
const authenticateToken = (req: any, res: any, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authorization token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = decoded as any;
    next();
  });
};

// --- AUTH ROUTES ---

// Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
app.post('/api/auth/register', async (req: any, res: any) => {
  const { email, password, name, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = randomUUID();
  try {
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, role, subscription_until) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, hashedPassword, name, role || 'ADMIN', new Date(Date.now() + 3*24*60*60*1000)]
    );
    const token = jwt.sign({ id, role: role || 'ADMIN' }, JWT_SECRET);
    res.json({ user: { id, email, name, role: role || 'ADMIN' }, token });
  } catch (err: any) {
    res.status(400).json({ message: err.message.includes('unique') ? 'User already exists' : 'Registration failed' });
  }
});

// Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
app.post('/api/auth/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    const { password_hash, ...safeUser } = user;
    res.json({ user: mapKeys(safeUser, toCamelCase), token });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
app.get('/api/auth/me', authenticateToken as any, async (req: any, res: any) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user!.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const { password_hash, ...safeUser } = rows[0];
    res.json(mapKeys(safeUser, toCamelCase));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// --- CRUD HELPER ---

const setupCrud = (resource: string, fields: string[]) => {
  const snakeFields = fields.map(toSnakeCase);

  // Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
  app.get(`/api/${resource}`, authenticateToken as any, async (req: any, res: any) => {
    try {
      // Logic for isolation: Admin sees theirs, Client sees theirs
      const query = `SELECT * FROM ${resource} WHERE owner_id = $1 OR client_id = $1`;
      const { rows } = await pool.query(query, [req.user!.id]);
      res.json(rows.map(r => mapKeys(r, toCamelCase)));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
  app.post(`/api/${resource}`, authenticateToken as any, async (req: any, res: any) => {
    const id = randomUUID();
    const data = req.body;
    const columns = ['id', 'owner_id', ...snakeFields];
    const values = [id, req.user!.id, ...fields.map(f => data[f])];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    try {
      await pool.query(`INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders})`, values);
      res.status(201).json({ ...data, id, ownerId: req.user!.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
  app.put(`/api/${resource}/:id`, authenticateToken as any, async (req: any, res: any) => {
    const data = req.body;
    const setClause = snakeFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = [...fields.map(f => data[f]), req.params.id, req.user!.id];

    try {
      const result = await pool.query(
        `UPDATE ${resource} SET ${setClause} WHERE id = $${fields.length + 1} AND owner_id = $${fields.length + 2} RETURNING *`,
        values
      );
      if (result.rowCount === 0) return res.status(404).json({ message: 'Not found or access denied' });
      res.json(mapKeys(result.rows[0], toCamelCase));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
  app.delete(`/api/${resource}/:id`, authenticateToken as any, async (req: any, res: any) => {
    try {
      const result = await pool.query(
        `DELETE FROM ${resource} WHERE id = $1 AND owner_id = $2`,
        [req.params.id, req.user!.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: 'Not found or access denied' });
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
};

// --- ENTITY ROUTES ---

setupCrud('cars', ['brand', 'model', 'year', 'plate', 'status', 'pricePerDay', 'pricePerHour', 'category', 'mileage', 'fuel', 'transmission', 'images', 'investorId', 'investorShare']);
setupCrud('clients', ['name', 'phone', 'email', 'passport', 'driverLicense', 'debt']);
setupCrud('staff', ['name', 'login', 'passwordHash', 'role']);
setupCrud('investors', ['name', 'phone', 'email', 'totalInvested', 'balance']);
setupCrud('rentals', ['carId', 'clientId', 'startDate', 'startTime', 'endDate', 'endTime', 'totalAmount', 'status', 'contractNumber', 'paymentStatus']);
setupCrud('requests', ['carId', 'clientId', 'clientName', 'startDate', 'startTime', 'endDate', 'endTime', 'status']);
setupCrud('transactions', ['amount', 'type', 'category', 'description', 'date', 'investorId', 'clientId', 'carId']);
setupCrud('fines', ['clientId', 'carId', 'amount', 'description', 'date', 'status', 'source']);

// --- ADMIN / SUPERADMIN ROUTES ---

// Fix: Use any for req and res to bypass incorrect type inference for express Request/Response
app.get('/api/admin/users', authenticateToken as any, async (req: any, res: any) => {
  if (req.user!.role !== 'SUPERADMIN') return res.status(403).send();
  const { rows } = await pool.query('SELECT id, email, name, role, subscription_until, is_trial, active_plan FROM users');
  res.json(rows.map(r => mapKeys(r, toCamelCase)));
});

// Start Server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AutoPro Backend running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});