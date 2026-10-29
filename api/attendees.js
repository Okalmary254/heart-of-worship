import { getDatabase, sendServerError } from '../lib/db.js';

export default async function handler(req, res) {
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({
      error: 'Admin access is not configured. Add ADMIN_KEY to Vercel Environment Variables and redeploy.'
    });
  }

  const authorization = req.headers.authorization || '';
  if (authorization !== `Bearer ${process.env.ADMIN_KEY}`) {
    return res.status(401).json({ error: 'Unauthorised. Enter the correct admin key.' });
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

      if (!ticketId) {
        return res.status(400).json({ error: 'Ticket ID is required.' });
      }

      const result = await sql`
        UPDATE registrations
        SET checked_in_at = COALESCE(checked_in_at, NOW())
        WHERE ticket_id = ${ticketId}
        RETURNING ticket_id, name, checked_in_at
      `;

      if (!result.length) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      return res.status(200).json(result[0]);
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
