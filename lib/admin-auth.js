import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'how_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

function secret() {
  const key = process.env.ADMIN_KEY;
  if (!key) {
    throw new Error('ADMIN_KEY is missing. Configure your existing admin password in Vercel Environment Variables.');
  }
  return key;
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

export function verifyAdminPassword(password) {
  const configuredPassword = process.env.ADMIN_KEY;
  if (!configuredPassword) {
    throw new Error('ADMIN_KEY is missing. Configure the original admin password in Vercel Environment Variables.');
  }
  const submitted = Buffer.from(typeof password === 'string' ? password : '');
  const expected = Buffer.from(configuredPassword);
  return submitted.length === expected.length && timingSafeEqual(submitted, expected);
}
