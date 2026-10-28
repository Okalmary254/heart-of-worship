import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const mk = () => 'HOW-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const name = String(b.name || '').trim().slice(0, 120);
  if (name.length < 3) return res.status(400).json({ error: 'Name required' });
  for (let i = 0; i < 5; i++) {
    const id = mk();
    try {
      await sql`insert into registrations (ticket_id, name, event_name, location, event_time)
        values (${id}, ${name}, ${String(b.event || '').slice(0, 200)}, ${String(b.loc || '').slice(0, 200)}, ${String(b.time || '').slice(0, 100)})`;
      return res.status(201).json({ ticket_id: id });
    } catch (e) {
      if (e.code !== '23505') return res.status(500).json({ error: 'Database error' });
    }
  }
  res.status(500).json({ error: 'Could not issue ticket' });
}
