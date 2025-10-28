import { Context, Next } from 'hono';
import { verifyToken } from './auth';
import type { Bindings } from '../types';

export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', payload);
  await next();
}

export async function adminOnly(c: Context<{ Bindings: Bindings }>, next: Next) {
  const user = c.get('user');
  
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  await next();
}

export async function bossOnly(c: Context<{ Bindings: Bindings }>, next: Next) {
  const user = c.get('user');
  
  if (!user || (user.role !== 'boss' && user.role !== 'admin')) {
    return c.json({ error: 'Boss access required' }, 403);
  }

  await next();
}

export async function consultantOnly(c: Context<{ Bindings: Bindings }>, next: Next) {
  const user = c.get('user');
  
  if (!user || user.role !== 'consultant') {
    return c.json({ error: 'Consultant access required' }, 403);
  }

  await next();
}
