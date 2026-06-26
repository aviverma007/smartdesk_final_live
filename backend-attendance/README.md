# SmartDesk Attendance API

## Ports
- **Frontend:** http://localhost:92 (or http://YOUR-IP:92)
- **Backend API:** http://localhost:5092 (or http://YOUR-IP:5092)

## Start Backend
```bash
cd backend-attendance
npm install
npm start
# Runs on port 5092
```

## Start Frontend
```bash
cd "smartdesk 2/frontend"
npm install
npm start
# Runs on port 92
```

## Open Firewall (run as Admin on the server)
```cmd
netsh advfirewall firewall add rule name="SmartDesk Frontend" protocol=TCP dir=in localport=92 action=allow
netsh advfirewall firewall add rule name="SmartDesk API" protocol=TCP dir=in localport=5092 action=allow
```

## Access from other machines
- App: http://192.168.10.99:92
- API health check: http://192.168.10.99:5092/api/health
