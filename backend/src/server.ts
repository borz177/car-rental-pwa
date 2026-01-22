import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'autopro_super_secret_2025';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const initDB = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, 
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
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
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
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      passport TEXT,
      driver_license TEXT,
      debt INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS investors (
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      total_invested INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      car_id TEXT REFERENCES cars(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
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
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      car_id TEXT REFERENCES cars(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL,
      start_date DATE NOT NULL,
      start_time TEXT,
      end_date DATE NOT NULL,
      end_time TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      description TEXT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      investor_id TEXT,
      client_id TEXT,
      car_id TEXT
    );

    CREATE TABLE IF NOT EXISTS fines (
      id TEXT PRIMARY KEY, 
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
      car_id TEXT REFERENCES cars(id) ON DELETE CASCADE,
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

const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamelCase = (str: string) => str.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));

const mapKeys = (obj: any, mapper: (s: string) => string) => {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[mapper(key)] = obj[key];
  });
  return newObj;
};

app.use(cors());
app.use(express.json({ limit: '50mb' }) as any);

interface AuthRequest extends express.Request {
  user?: { id: string; role: string };
}

/* Using express namespaces for types to avoid ambiguity with global Fetch Request/Response */
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { res.status(401).json({ message: 'No token' }); return; }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) { res.status(403).json({ message: 'Invalid token' }); return; }
    (req as AuthRequest).user = decoded as any;
    next();
  });
};

app.post('/api/auth/register', async (req: express.Request, res: express.Response) => {
  const { email, password, name, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = randomUUID();
  try {
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, role, subscription_until) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, hashedPassword, name, role || 'ADMIN', new Date(Date.now() + 3*24*60*60*1000)]
    );
    const token = jwt.sign({ id, role }, JWT_SECRET);
    res.json({ user: { id, email, name, role }, token });
  } catch (err) {
    res.status(400).json({ message: 'User already exists' });
  }
});

app.post('/api/auth/login', async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length === 0) return res.status(401).json({ message: 'User not found' });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: 'Wrong password' });

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
  const { password_hash, ...safeUser } = user;
  res.json({ user: mapKeys(safeUser, toCamelCase), token });
});

app.get('/api/auth/me', authenticateToken, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthRequest;
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [authReq.user!.id]);
  const { password_hash, ...safeUser } = rows[0];
  res.json(mapKeys(safeUser, toCamelCase));
});

const setupCrud = (resource: string, fields: string[]) => {
  app.get(`/api/${resource}`, authenticateToken, async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthRequest;
    const { rows } = await pool.query(`SELECT * FROM ${resource} WHERE owner_id = $1 OR client_id = $1`, [authReq.user!.id]);
    res.json(rows.map(r => mapKeys(r, toCamelCase)));
  });

  app.post(`/api/${resource}`, authenticateToken, async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthRequest;
    const id = randomUUID();
    const data = mapKeys(req.body, toSnakeCase);
    const columns = ['id', 'owner_id', ...fields];
    const values = [id, authReq.user!.id, ...fields.map(f => data[f])];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    await pool.query(`INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders})`, values);
    res.status(201).json({ ...req.body, id, ownerId: authReq.user!.id });
  });

  app.put(`/api/${resource}/:id`, authenticateToken, async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthRequest;
    const data = mapKeys(req.body, toSnakeCase);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = [...fields.map(f => data[f]), req.params.id, authReq.user!.id];

    await pool.query(`UPDATE ${resource} SET ${setClause} WHERE id = $${fields.length + 1} AND owner_id = $${fields.length + 2}`, values);
    res.json({ ...req.body, id: req.params.id });
  });

  app.delete(`/api/${resource}/:id`, authenticateToken, async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthRequest;
    await pool.query(`DELETE FROM ${resource} WHERE id = $1 AND owner_id = $2`, [req.params.id, authReq.user!.id]);
    res.status(204).send();
  });
};

setupCrud('cars', ['brand', 'model', 'year', 'plate', 'status', 'price_per_day', 'price_per_hour', 'category', 'mileage', 'fuel', 'transmission', 'images', 'investor_id', 'investor_share']);
setupCrud('clients', ['name', 'phone', 'email', 'passport', 'driver_license', 'debt']);
setupCrud('staff', ['name', 'login', 'password_hash', 'role']);
setupCrud('investors', ['name', 'phone', 'email', 'total_invested', 'balance']);
setupCrud('rentals', ['car_id', 'client_id', 'start_date', 'start_time', 'end_date', 'end_time', 'total_amount', 'status', 'contract_number', 'payment_status']);
setupCrud('requests', ['car_id', 'client_id', 'client_name', 'start_date', 'start_time', 'end_date', 'end_time', 'status']);
setupCrud('transactions', ['amount', 'type', 'category', 'description', 'date', 'investor_id', 'client_id', 'car_id']);
setupCrud('fines', ['client_id', 'car_id', 'amount', 'description', 'date', 'status', 'source']);

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API on ${PORT}`));
});
