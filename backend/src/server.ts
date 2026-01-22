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

// === POSTGRESQL CONNECTION ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.query('SELECT NOW()', (err) => {
  if (err) console.error('❌ Failed to connect to PostgreSQL:', err);
  else console.log('✅ Connected to PostgreSQL');
});

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json({ limit: '50mb' }));

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
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
  } catch (err: any) {
    console.error('Registration error:', err);
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
  } catch (err: any) {
    console.error('Login error:', err);
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
  } catch (err: any) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// === CAR ROUTES ===
app.get('/api/cars', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cars WHERE owner_id = $1', [req.user!.id]);
    res.json(rows);
  } catch (err: any) {
    console.error('Get cars error:', err);
    res.status(500).json({ message: 'Failed to fetch cars' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ AutoPro Backend running on port ${PORT}`);
});