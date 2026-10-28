import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
export default async function handler(req, res) {
  if (!process.env.ADMIN_KEY || req.headers.authorization !== 'Bearer ' + process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'Unauthorised' });
  if (req.method === 'POST') {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const r = await sql`update registrations set checked_in_at = coalesce(checked_in_at, now())
      where ticket_id = ${String(b.ticket_id || '').trim().toUpperCase()} returning ticket_id, name, checked_in_at`;
    return r.length ? res.json(r[0]) : res.status(404).json({ error: 'Ticket not found' });
  }
  const rows = await sql`select ticket_id, name, created_at, checked_in_at from registrations order by created_at desc`;
  res.json({ total: rows.length, checked_in: rows.filter(r => r.checked_in_at).length, rows });
}
