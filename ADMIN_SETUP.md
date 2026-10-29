# Admin dashboard setup

## Vercel environment variables

In Vercel, open **Project → Settings → Environment Variables** and configure:

- `DATABASE_URL`: the connection string from your Neon PostgreSQL project.
- `ADMIN_KEY`: a long, random initial admin password and session-signing secret. Use at least 16 characters; 32 or more random characters is recommended.

Apply the variables to the environments you deploy (Production and Preview as appropriate), then redeploy. A local `.env` file is not automatically uploaded to Vercel. Never commit real credentials.

## Sign in and set a custom password

1. Open `/admin` on the deployed site.
2. Sign in using the value configured as `ADMIN_KEY`.
3. In **Change admin password**, enter the current password and a new password of at least 12 characters, then confirm it.
4. After saving, use the new custom password for future logins. The database stores a salted scrypt password hash, not the plain-text password. Keep `ADMIN_KEY` configured because it signs the admin session cookie.

If the database has no saved custom password yet, `ADMIN_KEY` remains the initial login password. If the custom password is forgotten, an operator with deployment access can remove the single row from the `admin_credentials` table in Neon; the initial `ADMIN_KEY` will then work again. Do this only after verifying database access and authorisation.

## Check-in workflow

- Open **Check in by ticket number** and enter the attendee's ticket number, e.g. `HOW-ABCDE`.
- Verify the ticket and attendee name shown by the dashboard.
- Select **Confirm check-in**. Repeated check-ins are detected and do not overwrite the original check-in timestamp.
- The attendee table can also be used to check in a row directly. Export CSV to download the attendance list.

The API requires a signed, HTTP-only session cookie. Attendee data and check-in endpoints reject requests without a valid session. Sessions expire after eight hours; sign out when leaving a shared device.
