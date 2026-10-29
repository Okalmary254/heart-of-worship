# Admin dashboard setup

## Vercel environment variables

In Vercel, open **Project → Settings → Environment Variables** and configure:

- `DATABASE_URL`: the connection string from your Neon PostgreSQL project.
- `ADMIN_KEY`: the existing admin password/secret used to sign admin sessions. Keep the same value you previously configured in Vercel. It must be at least 16 characters.

Apply the variables to the environments you deploy (Production and Preview as appropriate), then redeploy. A local `.env` file is not automatically uploaded to Vercel. Never commit real credentials.

## Admin sign-in

1. Open `/admin` on the deployed site.
2. Sign in using the value of `ADMIN_KEY` configured in Vercel.
3. There is no custom-password feature. To change the admin password, update `ADMIN_KEY` in Vercel and redeploy.

Admin login now verifies `ADMIN_KEY` directly and does not query Neon. This means a temporary database connection issue will no longer prevent the operator from signing in; attendee data still requires a working `DATABASE_URL`.

## Check-in workflow

- Open **Check in by ticket number** and enter the attendee's ticket number, e.g. `HOW-ABCDE`.
- Verify the ticket and attendee name shown by the dashboard.
- Select **Confirm check-in**. Repeated check-ins are detected and do not overwrite the original check-in timestamp.
- The attendee table can also be used to check in a row directly. Export CSV to download the attendance list.

The API requires a signed, HTTP-only session cookie. Attendee data and check-in endpoints reject requests without a valid session. Sessions expire after eight hours; sign out when leaving a shared device.

## If attendee data still fails

If sign-in succeeds but attendee data does not load, check Vercel **Project → Settings → Environment Variables** for `DATABASE_URL`, verify the Neon connection string and database availability, and redeploy after changing variables. Inspect the Vercel Function logs for the specific database error.
