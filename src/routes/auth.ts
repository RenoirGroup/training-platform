import { Hono } from 'hono';
import { comparePassword, generateToken, hashPassword } from '../utils/auth';
import type { Bindings } from '../types';

const auth = new Hono<{ Bindings: Bindings }>();

// Login
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND active = 1'
    ).bind(email).first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const validPassword = await comparePassword(password, user.password_hash as string);
    
    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();

    // Update login streak
    await updateLoginStreak(c.env.DB, user.id as number);

    const token = await generateToken({
      userId: user.id as number,
      email: user.email as string,
      role: user.role as string,
    });

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        boss_id: user.boss_id,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Register (only for testing - in production, admins create users)
auth.post('/register', async (c) => {
  try {
    const { email, password, name, role = 'consultant', boss_id } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name required' }, 400);
    }

    // Check if user exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return c.json({ error: 'User already exists' }, 400);
    }

    const passwordHash = await hashPassword(password);

    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, name, role, boss_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(email, passwordHash, name, role, boss_id || null).run();

    const userId = result.meta.last_row_id;

    // Initialize streaks
    await c.env.DB.prepare(
      'INSERT INTO user_streaks (user_id) VALUES (?)'
    ).bind(userId).run();

    // Initialize leaderboard
    await c.env.DB.prepare(
      'INSERT INTO leaderboard (user_id, league) VALUES (?, ?)'
    ).bind(userId, 'bronze').run();

    return c.json({ message: 'User created successfully', userId });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// Get current user info
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const { verifyToken } = await import('../utils/auth');
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, boss_id, active, created_at, last_login FROM users WHERE id = ?'
  ).bind(payload.userId).first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

async function updateLoginStreak(db: D1Database, userId: number) {
  const today = new Date().toISOString().split('T')[0];
  
  const streak = await db.prepare(
    'SELECT * FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();

  if (!streak) {
    // Create streak record
    await db.prepare(
      'INSERT INTO user_streaks (user_id, current_login_streak, longest_login_streak, last_login_date) VALUES (?, 1, 1, ?)'
    ).bind(userId, today).run();
    
    // Log activity
    await db.prepare(
      'INSERT INTO activity_log (user_id, activity_type, activity_date) VALUES (?, ?, ?)'
    ).bind(userId, 'login', today).run();
    
    return;
  }

  const lastLogin = streak.last_login_date as string | null;
  
  if (lastLogin === today) {
    // Already logged in today
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak = streak.current_login_streak as number;

  if (lastLogin === yesterdayStr) {
    // Consecutive day
    newStreak += 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const longestStreak = Math.max(newStreak, streak.longest_login_streak as number);

  await db.prepare(
    'UPDATE user_streaks SET current_login_streak = ?, longest_login_streak = ?, last_login_date = ? WHERE user_id = ?'
  ).bind(newStreak, longestStreak, today, userId).run();

  // Log activity
  await db.prepare(
    'INSERT INTO activity_log (user_id, activity_type, activity_date) VALUES (?, ?, ?)'
  ).bind(userId, 'login', today).run();
}

export default auth;
