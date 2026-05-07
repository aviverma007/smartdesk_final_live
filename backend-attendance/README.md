# SmartDesk Attendance API

## Ports
- **Frontend:** http://localhost:82 (or http://YOUR-IP:82)
- **Backend API:** http://localhost:5082 (or http://YOUR-IP:5082)

## Start Backend
```bash
cd backend-attendance
npm install
npm start
# Runs on port 5082
```

## Start Frontend
```bash
cd "smartdesk 2/frontend"
npm install
npm start
# Runs on port 82
```

## Open Firewall (run as Admin on the server)
```cmd
netsh advfirewall firewall add rule name="SmartDesk Frontend" protocol=TCP dir=in localport=82 action=allow
netsh advfirewall firewall add rule name="SmartDesk API" protocol=TCP dir=in localport=5082 action=allow
```

## Access from other machines
- App: http://192.168.10.99:82
- API health check: http://192.168.10.99:5082/api/health
