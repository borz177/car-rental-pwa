import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// === CONFIGURATION ===
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'autopro_dev_secret_fallback_2025_DO_NOT_USE_IN_PROD';

// === ALLOWED ROLES FOR REGISTRATION ===
const ALLOWED_ROLES = ['CLIENT', 'ADMIN'];

// === POSTGRESQL CONNECTION ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err);
  } else {
    console.log('✅ Connected to PostgreSQL');
  }
});

// === MIDDLEWARE ===
app.use(cors({
  origin: [
    'https://prokatauto95.ru',
    'http://localhost:3000' // for local development
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded as { id: string; role: string };
    next();
  });
};

// === AUTH ROUTES ===
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password and name are required' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Only CLIENT or ADMIN allowed.' });
    }

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, hashedPassword, name, role]
    );

    const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id: userId, email, name, role }, token });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Registration error:', err.message);
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Login error:', err.message);
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name, role FROM users WHERE id = $1', [req.user!.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Me error:', err.message);
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// === CAR ROUTES ===
app.get('/api/cars', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cars WHERE owner_id = $1', [req.user!.id]);
    res.json(rows);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Get cars error:', err.message);
    }
    res.status(500).json({ message: 'Failed to fetch cars' });
  }
});

app.post('/api/cars', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { brand, model, plate } = req.body;
    if (!brand || !model || !plate) {
      return res.status(400).json({ message: 'Brand, model and plate are required' });
    }

    const carId = randomUUID();
    await pool.query(
      `INSERT INTO cars (id, owner_id, brand, model, plate, status, price_per_day, fuel, transmission)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        carId,
        req.user!.id,
        brand,
        model,
        plate,
        req.body.status || 'AVAILABLE',
        req.body.price_per_day || 0,
        req.body.fuel || null,
        req.body.transmission || null
      ]
    );

    res.status(201).json({ id: carId, ownerId: req.user!.id, ...req.body });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Create car error:', err.message);
    }
    res.status(500).json({ message: 'Failed to create car' });
  }
});

app.put('/api/cars/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT id FROM cars WHERE id = $1 AND owner_id = $2', [id, req.user!.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Car not found or access denied' });
    }

    await pool.query(
      `UPDATE cars 
       SET brand = $1, model = $2, plate = $3, status = $4, price_per_day = $5, fuel = $6, transmission = $7
       WHERE id = $8`,
      [
        req.body.brand,
        req.body.model,
        req.body.plate,
        req.body.status,
        req.body.price_per_day,
        req.body.fuel,
        req.body.transmission,
        id
      ]
    );

    res.json({ id, ...req.body });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Update car error:', err.message);
    }
    res.status(500).json({ message: 'Failed to update car' });
  }
});

app.delete('/api/cars/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM cars WHERE id = $1 AND owner_id = $2', [id, req.user!.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Car not found or access denied' });
    }
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Delete car error:', err.message);
    }
    res.status(500).json({ message: 'Failed to delete car' });
  }
});

// === CLIENTS ROUTE ===
app.get('/api/clients', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE owner_id = $1', [req.user!.id]);
    res.json(rows);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Get clients error:', err.message);
    }
    res.status(500).json({ message: 'Failed to fetch clients' });
  }
});

// === START SERVER ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ AutoPro Backend running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});