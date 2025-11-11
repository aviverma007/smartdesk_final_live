// SMARTWORLD DEVELOPERS - Company Configuration
module.exports = {
  company: {
    name: "SMARTWORLD DEVELOPERS",
    shortName: "SMARTWORLD",
    logo: "https://customer-assets.emergentagent.com/job_employee-excel-check/artifacts/6rs593sm_company%20logo.png",
    domain: "smartworldemployee.com",
    description: "Employee Management System"
  },
  server: {
    hostname: "81096-LP2",
    ip: "192.168.166.171",
    subnet: "255.255.255.0",
    gateway: "192.168.166.1",
    port: 80,
    httpsPort: 443
  },
  deployment: {
    maxEmployees: 1000,
    networkType: "internal",
    authType: "simple",
    sslEnabled: true,
    autoStartup: true,
    storageLocation: "C:\\CompanyApps\\SmartWorldEmployee"
  }
};