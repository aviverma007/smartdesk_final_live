import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  FileText,
  ExternalLink,
  BarChart2
} from 'lucide-react';

const Dashboard = () => {
  const dashboards = [
    {
      id: 'po-dashboard',
      title: 'PO Dashboard',
      description: 'Purchase Order Analytics and Tracking',
      icon: <FileText className="h-6 w-6 text-blue-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiYWI3MmFhNmEtZGY4Yy00MjhkLTgwOTYtZDM2ZjEwMDFkY2QzIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-blue-500 to-blue-700'
    },
    {
      id: 'pr-dashboard',
      title: 'PR Dashboard',  
      description: 'Purchase Request Analytics',
      icon: <FileText className="h-6 w-6 text-indigo-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiMjgyNTI0NzgtMmZiMS00MWFlLTkyMzUtNTMyNTYyY2I1MTZjIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-indigo-500 to-indigo-700'
    },
    {
      id: 'qms-dashboard',
      title: 'QMS Dashboard',
      description: 'Quality Management System Analytics',
      icon: <TrendingUp className="h-6 w-6 text-green-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiY2Y0YjA4ZDUtZjg5ZC00YjE5LThjYzYtY2QyOTE5YzlmYzk1IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-green-500 to-green-700'
    },
       
    {
      id: 'Cost-dashboard',
      title: 'COST Dashboard',  
      description: 'Cost Analytics',
      icon: <BarChart3 className="h-6 w-6 text-purple-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiZjBjYjk1MTItMjI4OS00Y2MzLTg1OGUtZWU1NjgzMTk3MDJlIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-purple-500 to-purple-700'
    }
    ,
    {
      id: 'Sales-dashboard',
      title: 'SALES Dashboard',  
      description: 'Sales Analytics',
      icon: <BarChart2 className="h-6 w-6 text-indigo-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiNjQyODljZDItYmVkNy00YTE0LWE0MGMtYTAxNDk4NGQ1YWE0IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-indigo-500 to-indigo-700'
    },
    {
      id: 'assets-dashboard',
      title: 'Asset Dashboard',
      description: 'Asset Management and Tracking',
      icon: <BarChart3 className="h-6 w-6 text-purple-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiNWM4YzRkMjctOTZmMC00ZDJhLWFhYmMtZWQ2MWU1ZDUyMzMzIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-purple-500 to-purple-700'
    }, 
    {
      id: 'DPR-Report',
      title: 'Daily Progress Report',
      description: 'Daily Progress Report',
      icon: <Users className="h-6 w-6 text-orange-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiOWJlZmRlYWMtYTkwMC00NWY4LWIzNTEtYzcxNDg2Zjg2Mjg0IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-orange-500 to-orange-700'
    },
    {
      id: 'Case-Management',
      title: 'Case Management Report',
      description: 'Case Management Report-CRM',
      icon: <Users className="h-6 w-6 text-orange-500" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiZjk0NjE0YTgtNDAyMy00ZWEwLThkMjYtNzFlYmVlMmY5ZmUxIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-orange-500 to-orange-700'
    },
    {
      id: 'attendance-dashboard',
      title: 'Employee Attendance',
      description: 'Employee Attendance Analytics',
      icon: <Users className="h-6 w-6 text-orange-600" />,
      url: 'https://app.powerbi.com/view?r=eyJrIjoiM2ZjM2JlMTMtYmRjYi00MTViLTljOTQtM2UyODAwNDkyNTQxIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9',
      color: 'from-orange-500 to-orange-700'
    },
  ];

  const handleDashboardClick = (dashboard) => {
    window.open(dashboard.url, '_blank');
  };

  return (
    <div className="h-full p-6">
      {/* Simple Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <div className="h-px bg-gray-300 w-full"></div>
      </div>

      {/* All Dashboards in Single Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {dashboards.map(dashboard => (
          <div
            key={dashboard.id}
            onClick={() => handleDashboardClick(dashboard)}
            className="cursor-pointer group relative overflow-hidden rounded-xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className={`h-32 bg-gradient-to-br ${dashboard.color} p-4 flex flex-col justify-between text-white`}>
              <div className="flex items-center justify-between">
                {dashboard.icon}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <ExternalLink className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{dashboard.title}</h3>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600">{dashboard.description}</p>
              <div className="mt-3 flex items-center text-blue-600 text-sm font-medium">
                <span>View Dashboard</span>
                <ExternalLink className="ml-1 h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;