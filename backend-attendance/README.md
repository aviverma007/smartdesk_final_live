# SmartDesk Live Attendance API

Connects to your eTimeTracklite SQL Server and exposes secure REST endpoints for the SmartDesk frontend.

## Quick Start

```bash
cd backend-attendance
npm install
```

**Set your SQL password** — open `server.js`, find line:
```js
password: '',  // ← SET YOUR PASSWORD HERE
```
Replace the empty string with your SQL Server `sa` password.

Then:
```bash
npm start
# API running on http://localhost:5001
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Test connection to SQL Server |
| `GET /api/attendance?date=YYYY-MM-DD` | All employees for a date |
| `GET /api/attendance/summary?date=YYYY-MM-DD` | Present/Absent/Leave totals |
| `GET /api/attendance/departments?date=YYYY-MM-DD` | Breakdown by department |
| `GET /api/attendance/live` | Real-time today stats (refreshes every 30s) |
| `GET /api/attendance/tables` | List all DB tables (schema discovery) |

## SQL Server Details
- Server: `192.168.66.33`
- Database: `etimetracklite1AI`
- Port: `1433`

## Running in Production
For 24/7 uptime, run with PM2:
```bash
npm install -g pm2
pm2 start server.js --name smartdesk-attendance
pm2 save
```
