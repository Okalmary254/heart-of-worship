import { getDatabase, sendServerError } from '../lib/db.js';

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeTicketId = () => 'HOW-' + Array.from(
  { length: 6 },
  () => chars[Math.floor(Math.random() * chars.length)]
).join('');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    const name = String(body.name || '').trim().slice(0, 120);

    if (name.length < 3) {
      return res.status(400).json({ error: 'Enter your full name (at least 3 characters).' });
    }

    const sql = await getDatabase();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ticketId = makeTicketId();

      try {
        await sql`
          INSERT INTO registrations
            (ticket_id, name, event_name, location, event_time)
          VALUES (
            ${ticketId},
            ${name},
            ${String(body.event || '').trim().slice(0, 200)},
            ${String(body.loc || '').trim().slice(0, 200)},
            ${String(body.time || '').trim().slice(0, 100)}
          )
        `;

        return res.status(201).json({ ticket_id: ticketId });
      } catch (error) {
        if (error?.code !== '23505') throw error;
      }
    }

    return res.status(500).json({ error: 'Could not issue a ticket. Please try again.' });
  } catch (error) {
    return sendServerError(res, error, 'registration');
  }
}
