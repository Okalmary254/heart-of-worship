import { hasValidSession } from '../lib/admin-auth.js';
import { getDatabase, sendServerError } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!hasValidSession(req)) {
    return res.status(401).json({ error: 'Please sign in to the admin dashboard.' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = await getDatabase();

    if (req.method === 'POST') {
      const body = typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});
      const ticketId = String(body.ticket_id || '').trim().toUpperCase();

      if (!/^HOW-[A-Z0-9]{5,6}$/.test(ticketId)) {
        return res.status(400).json({ error: 'Enter a valid ticket number, for example HOW-ABCDE.' });
      }

      const result = await sql`
        UPDATE registrations
        SET checked_in_at = COALESCE(checked_in_at, NOW())
        WHERE ticket_id = ${ticketId}
        RETURNING ticket_id, name, checked_in_at
      `;

      if (!result.length) {
        return res.status(404).json({ error: 'Ticket not found. Check the number and try again.' });
      }

      return res.status(200).json({
        ...result[0],
        already_checked_in: Boolean(result[0].checked_in_at && new Date(result[0].checked_in_at).getTime() < Date.now() - 1000)
      });
    }

    const rows = await sql`
      SELECT ticket_id, name, created_at, checked_in_at
      FROM registrations
      ORDER BY created_at DESC
    `;

    return res.status(200).json({
      total: rows.length,
      checked_in: rows.filter((row) => row.checked_in_at).length,
      rows
    });
  } catch (error) {
    return sendServerError(res, error, 'attendees');
  }
}
