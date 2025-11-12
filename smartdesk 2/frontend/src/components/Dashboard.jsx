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
  ChevronRight,
  LogIn,
  LogOut,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { PowerBIEmbed } from 'powerbi-client-react';
import { models } from 'powerbi-client';

const Dashboard = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [embedToken, setEmbedToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const sliderRef = useRef(null);

  const dashboards = [
    {
      id: 'po-dashboard',
      title: 'PO Dashboard',
      description: 'Purchase Order Analytics and Tracking',
      icon: <FileText className="h-6 w-6 text-white" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=8eff9893-39e5-44ff-8393-eed2716e5c86&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-blue-600 to-blue-800'
    },
    {
      id: 'qms-dashboard',
      title: 'QMS Dashboard',
      description: 'Quality Management System Analytics',
      icon: <TrendingUp className="h-6 w-6 text-white" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=ff391e55-8a76-42c8-b62c-1c209a6c2663&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-blue-500 to-blue-700'
    },
    {
      id: 'assets-dashboard',
      title: 'Asset Dashboard',
      description: 'Asset Management and Tracking',
      icon: <BarChart3 className="h-6 w-6 text-white" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=95bc0742-cbfd-46a6-81da-e05ee4b628e8&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-blue-400 to-blue-600'
    },
    {
      id: 'attendance-dashboard',
      title: 'Employee Attendance',
      description: 'Employee Attendance Analytics',
      icon: <Users className="h-6 w-6 text-white" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=4be8796e-c0a4-4712-879c-9cd9a183e365&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-sky-500 to-blue-700'
    },
    {
      id: 'pr-dashboard',
      title: 'PR Dashboard',  
      description: 'Purchase Request Analytics',
      icon: <FileText className="h-6 w-6 text-white" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=b9bb2eaa-6315-4235-a051-d41d2219a899&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-blue-700 to-blue-900'
    },
    {
      id: 'Cost-dashboard',
      title: 'COST Dashboard',  
      description: 'Cost Analytics',
      icon: <BarChart3 className="h-6 w-6 text-white" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=f4504691-4814-43a1-819b-593c95de9489&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-sky-600 to-blue-800'
    },
    {
      id: 'Sales-dashboard',
      title: 'SALES Dashboard',  
      description: 'Sales Analytics',
      icon: <BarChart2 className="h-6 w-6 text-white" />,
      url: 'https://app.powerbi.com/reportEmbed?reportId=cbd8199b-de56-4600-b634-3147e2357ac1&autoAuth=true&ctid=711f4066-07b7-45a1-9e32-978e86528cad',
      color: 'from-blue-500 to-sky-700'
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

  // Handle Power BI authentication
  const handleSignIn = () => {
    setIsLoading(true);
    setError(null);
    
    // Open Power BI authentication in popup
    const width = 600;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    const authWindow = window.open(
      'https://app.powerbi.com/',
      'Power BI Sign In',
      `width=${width},height=${height},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    // Check if popup was blocked
    if (!authWindow) {
      setError('Popup blocked! Please allow popups for this site.');
      setIsLoading(false);
      return;
    }

    // Monitor popup
    const checkPopup = setInterval(() => {
      if (authWindow.closed) {
        clearInterval(checkPopup);
        setIsLoading(false);
        // Simulate successful authentication
        setIsAuthenticated(true);
        setShowAuthModal(false);
        setError(null);
      }
    }, 500);
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setEmbedToken(null);
    setError(null);
  };

  const handleDashboardClick = (dashboard) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      window.open(dashboard.url, '_blank');
    }
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
      {/* Header with Auth Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Power BI Dashboard</h1>
            <p className="text-sm text-gray-600">View and analyze your business intelligence reports</p>
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Signed In</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <LogIn className="h-5 w-5" />
                <span className="font-semibold">Sign In to Power BI</span>
              </button>
            )}
          </div>
        </div>
        <div className="h-px bg-gray-300 w-full mt-4"></div>
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Sign In to Power BI</h2>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-blue-100">Access your Power BI reports and dashboards</p>
            </div>
            
            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">Authentication Error</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Before you continue:</h3>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Make sure popups are enabled for this site</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>You'll be redirected to Microsoft login</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Sign in with your organization account</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span className="font-semibold">Opening Sign In...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      <span className="font-semibold">Sign In with Microsoft</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowAuthModal(false)}
                  className="w-full px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show sign-in prompt if not authenticated */}
      {!isAuthenticated && (
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="mb-4">
              <BarChart3 className="h-16 w-16 text-blue-600 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Power BI Dashboard</h2>
            <p className="text-gray-600 mb-6">
              Sign in to access your business intelligence reports and interactive dashboards. 
              View real-time analytics, track KPIs, and make data-driven decisions.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <LogIn className="h-6 w-6" />
              <span className="font-semibold text-lg">Sign In to Get Started</span>
            </button>
          </div>
        </div>
      )}

      {/* All Dashboards in Single Grid Layout */}
      {isAuthenticated && (
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
      )}

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