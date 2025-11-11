# SMARTWORLD DEVELOPERS - Employee Portal Deployment Guide

## 🏢 Company Configuration
- **Company:** SMARTWORLD DEVELOPERS PVT. LTD.
- **Server:** 81096-LP2 (Windows 11 Pro, 16GB RAM)
- **IP Address:** 192.168.166.171
- **Domain:** smartworldemployee.com
- **Capacity:** 1000 employees
- **Network:** Internal only with HTTPS

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### ✅ Required Software (Verify Installation)
```
□ Node.js (v18+) - Check: node --version
□ Python (v3.8+) - Check: python --version  
□ MongoDB Community - Check: net start MongoDB
□ IIS (Internet Information Services) - Check: inetmgr
□ PM2 Process Manager - Check: pm2 --version
```

### ✅ Network Requirements
```
□ Firewall ports open: 80, 443, 8001
□ SSL Certificate available for smartworldemployee.com
□ DNS configured to point to 192.168.166.171
□ Admin access to Windows Server
```

---

## 🚀 AUTOMATED INSTALLATION

### Step 1: Copy Deployment Package
1. Copy the entire `DEPLOYMENT_PACKAGE` folder to your server
2. Extract to: `C:\Temp\SmartWorldDeployment\`

### Step 2: Run Installation Script
```cmd
# Open Command Prompt as Administrator
cd C:\Temp\SmartWorldDeployment
install_smartworld.bat
```

### Step 3: Verify Installation
```cmd
# Check services status
pm2 status

# Check application
http://192.168.166.171/
```

---

## 🔧 MANUAL CONFIGURATION (If needed)

### IIS SSL Certificate Setup
1. **Open IIS Manager** (Run as Administrator)
2. **Select 'SmartWorldEmployee' site**
3. **Click 'Bindings'** in Actions panel
4. **Add HTTPS binding:**
   - Type: https
   - Port: 443
   - SSL certificate: [Your certificate]
   - Host name: smartworldemployee.com

### DNS Configuration
**Contact your IT Department to configure:**
```
smartworldemployee.com → 192.168.166.171
```

### Firewall Verification
```cmd
# Verify ports are open
netstat -an | findstr :80
netstat -an | findstr :443
netstat -an | findstr :8001
```

---

## 📁 FILE STRUCTURE

After installation, your server will have:
```
C:\CompanyApps\SmartWorldEmployee\
├── backend\                 # API server files
├── frontend\               # Web application
│   └── build\             # Production build
│   └── public\            # Static files
│       └── company policies\  # PDF policy files (14 policies)
├── company policies\       # PDF policy files (backup location)
├── employee_directory.xlsx # Employee data
├── ecosystem.config.js    # PM2 configuration
├── production-server.js   # Main web server
└── logs\                  # Application logs
```

## 📋 COMPANY POLICIES INCLUDED

Your Employee Portal includes these 14 company policies:
1. **Business Hours Attendance Policy** - Attendance requirements and guidelines
2. **Sexual Harassment At Work Redressal Policy** - Workplace harassment prevention
3. **Dress Code Policy** - Professional dress code guidelines  
4. **Employee Referral Policy** - Employee referral program procedures
5. **Leave Policy (Revised)** - Comprehensive leave policy
6. **Local Conveyance Policy** - Local travel reimbursement guidelines
7. **Whistle Blower Policy** - Whistleblower protection procedures
8. **Tour Travel Policy** - Business travel guidelines and expenses
9. **Revised Attendance Policy** - Updated attendance policy (May 2025)
10. **Night Shift Meal & Conveyance Allowance** - Night shift benefits
11. **Flexible Work Schedule Policy** - Remote work and flexible arrangements
12. **Holiday List 2023** - Official holiday calendar for 2023
13. **Holiday List 2025** - Official holiday calendar for 2025  
14. **Proposed Holiday List 2024** - Proposed holiday calendar for 2024

All policies are accessible via the "Policies" tab with individual "View PDF" buttons.

---

## 🔐 SECURITY CONFIGURATION

### SSL/HTTPS Setup
1. **Certificate Installation** (Contact IT if needed)
2. **HTTP to HTTPS Redirect** (Configured automatically)
3. **Security Headers** (Included in web.config)

### Access Control
- **Internal Network Only** ✅
- **Simple Login System** ✅
- **Role-based Access** (Admin/User) ✅

---

## 📊 MONITORING & MAINTENANCE

### Check Application Status
```cmd
# PM2 Dashboard
pm2 monit

# Service Status
pm2 status

# View Logs
pm2 logs smartworld-backend
pm2 logs smartworld-frontend
```

### Restart Services (if needed)
```cmd
# Restart all services
pm2 restart all

# Restart specific service
pm2 restart smartworld-backend
pm2 restart smartworld-frontend
```

### Update Employee Data
1. **Replace Excel File:**
   ```
   C:\CompanyApps\SmartWorldEmployee\employee_directory.xlsx
   ```
2. **Restart Backend:**
   ```cmd
   pm2 restart smartworld-backend
   ```

---

## 🌐 ACCESS URLS

### For Employees:
- **Primary:** https://smartworldemployee.com/
- **Backup:** http://192.168.166.171/

### For IT Support:
- **Server Monitoring:** http://192.168.166.171:8001/health
- **PM2 Dashboard:** pm2 web (if enabled)

---

## 🆘 TROUBLESHOOTING

### Common Issues & Solutions

**1. Application Not Loading**
```cmd
# Check PM2 services
pm2 status

# Check logs
pm2 logs

# Restart services
pm2 restart all
```

**2. SSL Certificate Issues**
```cmd
# Verify certificate in IIS Manager
# Contact IT department for certificate renewal
```

**3. Database Connection Issues**
```cmd
# Check MongoDB service
net start MongoDB

# Restart backend
pm2 restart smartworld-backend
```

**4. Network Access Issues**
```cmd
# Verify firewall rules
netsh advfirewall firewall show rule name="SmartWorld Employee Portal HTTP"

# Check network connectivity
ping 192.168.166.171
```

---

## 📞 SUPPORT CONTACTS

### Internal IT Support
- **Server Issues:** IT Department
- **Network/DNS:** IT Department  
- **SSL Certificates:** IT Department

### Application Issues
- **Login Problems:** Check PM2 logs
- **Data Updates:** Replace Excel file and restart
- **Performance Issues:** Check server resources

---

## 📈 PERFORMANCE OPTIMIZATION

### For 1000 Employees
- **PM2 Cluster Mode:** Enabled (2 instances)
- **Database Indexing:** Automatic
- **Static File Caching:** 7 days
- **Compression:** Enabled (gzip)

### Monitoring Recommendations
```cmd
# Monitor server resources
taskmgr

# Check application performance  
pm2 monit

# View access logs
type C:\CompanyApps\SmartWorldEmployee\logs\frontend.log
```

---

## 🔄 UPDATES & MAINTENANCE

### Regular Maintenance
1. **Monthly:** Check PM2 logs for errors
2. **Quarterly:** Update employee data
3. **Annually:** Review SSL certificates

### Application Updates
1. **Backup current installation**
2. **Replace application files**  
3. **Run install script**
4. **Test functionality**

---

**🎉 Installation Complete!**  
**Your SMARTWORLD DEVELOPERS Employee Portal is ready for use!**