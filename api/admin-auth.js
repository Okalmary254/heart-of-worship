import {
  clearSessionCookie,
  createSession,
  hasValidSession,
  setSessionCookie,
  storeAdminPassword,
  validPassword,
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

  try {
    const action = String(body.action || '');

    if (action === 'session-check') {
      return res.status(200).json({ authenticated: hasValidSession(req) });
    }

    if (action === 'logout') {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (action === 'login') {
      const password = typeof body.password === 'string' ? body.password : '';
      const verified = await verifyAdminPassword(password);
      if (!verified) return res.status(401).json({ error: 'Incorrect password.' });
      setSessionCookie(res, createSession());
      return res.status(200).json({ ok: true });
    }

    if (action === 'change-password') {
      if (!hasValidSession(req)) {
        return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
      }

      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
      const verified = await verifyAdminPassword(currentPassword);

      if (!verified) return res.status(401).json({ error: 'Current password is incorrect.' });
      if (!validPassword(newPassword)) {
        return res.status(400).json({ error: 'Choose a password between 12 and 256 characters.' });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'Your new password must be different.' });
      }

      await storeAdminPassword(verified.sql, newPassword);
      setSessionCookie(res, createSession());
      return res.status(200).json({ ok: true, message: 'Password updated.' });
    }

    return res.status(400).json({ error: 'Unknown authentication action.' });
  } catch (error) {
    console.error('[admin-auth]', error);
    return res.status(500).json({
      error: 'Admin authentication failed. Check the Vercel function logs and confirm DATABASE_URL and ADMIN_KEY are configured.'
    });
  }
}
