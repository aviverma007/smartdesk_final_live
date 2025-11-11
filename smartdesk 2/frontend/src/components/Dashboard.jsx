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
      url: 'https://app.powerbi.com/reportEmbed?reportId=8eff9893-39e5-44ff-8393-eed2716e5c86&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-blue-500 to-blue-700'
    },
    {
      id: 'qms-dashboard',
      title: 'QMS Dashboard',
      description: 'Quality Management System Analytics',
      icon: <TrendingUp className="h-6 w-6 text-green-600" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=ff391e55-8a76-42c8-b62c-1c209a6c2663&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-green-500 to-green-700'
    },
    {
      id: 'assets-dashboard',
      title: 'Asset Dashboard',
      description: 'Asset Management and Tracking',
      icon: <BarChart3 className="h-6 w-6 text-purple-600" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=95bc0742-cbfd-46a6-81da-e05ee4b628e8&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-purple-500 to-purple-700'
    },
    {
      id: 'attendance-dashboard',
      title: 'Employee Attendance',
      description: 'Employee Attendance Analytics',
      icon: <Users className="h-6 w-6 text-orange-600" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=4be8796e-c0a4-4712-879c-9cd9a183e365&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-orange-500 to-orange-700'
    },
    {
      id: 'pr-dashboard',
      title: 'PR Dashboard',  
      description: 'Purchase Request Analytics',
      icon: <FileText className="h-6 w-6 text-indigo-600" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=b9bb2eaa-6315-4235-a051-d41d2219a899&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-indigo-500 to-indigo-700'
    },
    {
      id: 'Cost-dashboard',
      title: 'COST Dashboard',  
      description: 'Cost Analytics',
      icon: <BarChart3 className="h-6 w-6 text-purple-600" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=f4504691-4814-43a1-819b-593c95de9489&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-purple-500 to-purple-700'
    }
    ,
    {
      id: 'Sales-dashboard',
      title: 'SALES Dashboard',  
      description: 'Sales Analytics',
      icon: <BarChart2 className="h-6 w-6 text-indigo-600" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=cbd8199b-de56-4600-b634-3147e2357ac1&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-indigo-500 to-indigo-700'
    }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
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