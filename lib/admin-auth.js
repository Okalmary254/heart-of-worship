import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDatabase } from './db.js';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'how_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

function secret() {
  if (!process.env.ADMIN_KEY || process.env.ADMIN_KEY.length < 16) {
    throw new Error('ADMIN_KEY must be configured as a random secret of at least 16 characters.');
  }
  return process.env.ADMIN_KEY;
}

function sign(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

export function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function hasValidSession(req) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(COOKIE_NAME + '='));
    if (!cookie) return false;
    const token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.exp) && data.exp > Date.now();
  } catch {
    return false;
  }
}

async function getStoredPasswordHash(sql) {
  await sql`CREATE TABLE IF NOT EXISTS admin_credentials (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows = await sql`SELECT password_hash FROM admin_credentials WHERE id = 1`;
  return rows[0]?.password_hash || null;
}

export async function verifyAdminPassword(password) {
  const sql = await getDatabase();
  const storedHash = await getStoredPasswordHash(sql);
  if (!storedHash) {
    const initial = process.env.ADMIN_KEY || '';
    return Boolean(initial) && safeStringEqual(password, initial) && { sql, firstLogin: true };
  }
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived) ? { sql, firstLogin: false } : false;
}

function safeStringEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function storeAdminPassword(sql, password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  const passwordHash = `${salt}:${hash.toString('hex')}`;
  await sql`INSERT INTO admin_credentials (id, password_hash, updated_at)
    VALUES (1, ${passwordHash}, NOW())
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`;
}

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 256;
}
