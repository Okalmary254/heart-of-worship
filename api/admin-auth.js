import {
  clearSessionCookie,
  createSession,
  hasValidSession,
  setSessionCookie,
  verifyAdminPassword
} from '../lib/admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON request.' });
  }

  const action = String(body.action || '');
  if (action === 'session-check') {
    try {
      return res.status(200).json({ authenticated: hasValidSession(req) });
    } catch (error) {
      console.error('[admin-auth:session-check]', error);
      return res.status(500).json({ error: error.message || 'Admin session configuration is invalid.' });
    }
  }

  if (action === 'logout') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (action !== 'login') {
    return res.status(400).json({ error: 'Unknown authentication action.' });
  }

  try {
    if (!verifyAdminPassword(body.password)) {
      return res.status(401).json({ error: 'Incorrect admin password. Use the ADMIN_KEY configured in Vercel.' });
    }
    setSessionCookie(res, createSession());
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[admin-auth:login]', error);
    return res.status(500).json({
      error: error.message || 'Admin authentication configuration failed. Check ADMIN_KEY in Vercel.'
    });
  }
}
