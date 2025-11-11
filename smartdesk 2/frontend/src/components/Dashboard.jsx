import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  FileText,
  ExternalLink,
  BarChart2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const Dashboard = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const sliderRef = useRef(null);

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
    },
    {
      id: 'Sales-dashboard',
      title: 'SALES Dashboard',  
      description: 'Sales Analytics',
      icon: <BarChart2 className="h-6 w-6 text-indigo-600" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=cbd8199b-de56-4600-b634-3147e2357ac1&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-indigo-500 to-indigo-700'
    }
  ];

  // Auto-slide effect
  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % dashboards.length);
      }, 2000); // Change slide every 2 seconds

      return () => clearInterval(interval);
    }
  }, [isPaused, dashboards.length]);

  const handleDashboardClick = (dashboard) => {
    window.open(dashboard.url, '_blank');
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % dashboards.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + dashboards.length) % dashboards.length);
  };

  return (
    <div className="h-full p-6">
      {/* Simple Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <div className="h-px bg-gray-300 w-full"></div>
      </div>

      {/* All Dashboards in Single Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 mb-8">
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

      {/* Auto Slider Section with Power BI Previews */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Featured Dashboards</h2>
        
        <div 
          ref={sliderRef}
          className="relative bg-white rounded-2xl shadow-2xl overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Slider Container */}
          <div className="relative h-[600px]">
            {dashboards.map((dashboard, index) => (
              <div
                key={dashboard.id}
                className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                  index === currentSlide 
                    ? 'opacity-100 translate-x-0' 
                    : index < currentSlide 
                    ? 'opacity-0 -translate-x-full' 
                    : 'opacity-0 translate-x-full'
                }`}
              >
                <div className="h-full flex flex-col p-6">
                  {/* Dashboard Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${dashboard.color}`}>
                        {dashboard.icon}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-800">{dashboard.title}</h3>
                        <p className="text-sm text-gray-600">{dashboard.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDashboardClick(dashboard)}
                      className={`px-6 py-3 bg-gradient-to-r ${dashboard.color} text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center space-x-2`}
                    >
                      <span>Open Full View</span>
                      <ExternalLink className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Power BI Dashboard Preview */}
                  <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden shadow-inner relative">
                    <iframe
                      src={dashboard.url}
                      className="w-full h-full border-0"
                      allowFullScreen={true}
                      title={dashboard.title}
                    />
                    {/* Overlay to prevent interaction in preview */}
                    <div 
                      className="absolute inset-0 cursor-pointer hover:bg-blue-500/5 transition-colors"
                      onClick={() => handleDashboardClick(dashboard)}
                      title="Click to open full dashboard"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          >
            <ChevronLeft className="h-6 w-6 text-gray-800" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          >
            <ChevronRight className="h-6 w-6 text-gray-800" />
          </button>

          {/* Slide Indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
            {dashboards.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all duration-300 rounded-full ${
                  index === currentSlide 
                    ? 'w-8 h-3 bg-blue-600' 
                    : 'w-3 h-3 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          {/* Pause Indicator */}
          {isPaused && (
            <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              Paused
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;