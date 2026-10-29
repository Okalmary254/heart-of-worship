import { neon } from '@neondatabase/serverless';

let sqlClient;
let schemaPromise;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL is not configured in the deployment environment.');
    error.code = 'DATABASE_URL_MISSING';
    throw error;
  }

  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export async function getDatabase() {
  const sql = getSql();

  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS registrations (
          ticket_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          event_name TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          event_time TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          checked_in_at TIMESTAMPTZ
        )
      `;
      await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS event_name TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS event_time TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
      await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ`;
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }

  await schemaPromise;
  return sql;
}

export function sendServerError(res, error, context) {
  console.error(`[${context}]`, error);

  if (error?.code === 'DATABASE_URL_MISSING') {
    return res.status(500).json({
      error: 'Database is not configured. Add DATABASE_URL to Vercel Project Settings > Environment Variables, then redeploy.'
    });
  }

  return res.status(500).json({
    error: 'A server error occurred. Check the Vercel function logs for details.'
  });
}
