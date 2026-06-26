# SmartDesk — User Rights & Assets backend

Node/Express + SQL Server service powering the **User Rights & Assets** tab in the portal.
Runs on **port 5093** and auto-creates its tables on first boot.

## Workflows
1. **Onboarding / User-ID** — HR captures a new joiner (pending), assigns Employee ID after they join.
2. **Asset allocation** — HR requests assets → set-password link emailed → employee confirms receipt → locked to HR/IT.
3. **Application & rights** — request → manager approves (+ optional note) → IT marks given → submitted.

## Setup

1. Create the database + a login (run once in SSMS as an admin):
   ```sql
   CREATE DATABASE SmartDeskApp;
   GO
   CREATE LOGIN smartapp_user WITH PASSWORD = 'YourStrongPassword';
   GO
   USE SmartDeskApp;
   CREATE USER smartapp_user FOR LOGIN smartapp_user;
   ALTER ROLE db_owner ADD MEMBER smartapp_user;
   ```
   Make sure the server has **mixed-mode auth** and **TCP/IP** enabled.

2. Copy `.env.example` to `.env` and fill in real values (the `.env` is gitignored — never commit it):
   ```
   cp .env.example .env
   ```
   Set `DB_PASSWORD`, the Outlook `SMTP_PASS`, and `APP_BASE_URL` (the address employees reach the portal at).

3. Install and run:
   ```
   npm install
   npm start
   ```
   Health check: `http://localhost:5093/api/health`

## Notes
- Emails send a **set-password link**, never a plaintext password. If SMTP isn't configured, the link is logged to the console (and returned in the API response) so you can test before SMTP is live.
- If Outlook rejects the password, the tenant likely blocks basic SMTP auth — use an **app password** (needs MFA) or switch to OAuth2.
- Role gating uses `x-user-role` headers from the portal (matches the existing client-side auth model). Keep this service on the internal network only.

## Roles (set in the portal's AuthContext)
- `hr` / `it` / `manager` — fixed logins (default password `SmartWorld@2026`, change these).
- New employees set their own password via the emailed link, then log in with their Employee ID or email.
