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

  // Auto-slide effect - only works when authenticated
  useEffect(() => {
    if (isAuthenticated && !isPaused) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % dashboards.length);
      }, 2000); // Change slide every 2 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isPaused, dashboards.length]);

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

  // Demo/Testing function - remove in production
  const handleDemoAuth = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsAuthenticated(true);
      setShowAuthModal(false);
      setIsLoading(false);
      setError(null);
    }, 1000);
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

                {/* Demo/Testing Button - Remove in production */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or for testing</span>
                  </div>
                </div>

                <button
                  onClick={handleDemoAuth}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-3 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="font-medium">Simulate Successful Auth (Demo)</span>
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
        <div className="mb-4 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="mb-3">
              <BarChart3 className="h-12 w-12 text-blue-600 mx-auto" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Welcome to Power BI Dashboard</h2>
            <p className="text-sm text-gray-600 mb-4">
              Sign in to access your business intelligence reports and interactive dashboards.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <LogIn className="h-5 w-5" />
              <span className="font-semibold">Sign In to Get Started</span>
            </button>
          </div>
        </div>
      )}

      {/* Removed grid layout - all reports now shown in slider after authentication */}

      {/* Auto-Rotating Slider with All Reports - Shows after authentication */}
      {isAuthenticated && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Your Power BI Reports</h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Auto-rotating every 2 seconds • Hover to pause • {dashboards.length} reports
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-600">
                Report {currentSlide + 1} of {dashboards.length}
              </span>
              {isPaused && (
                <div className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium border border-yellow-300">
                  Paused
                </div>
              )}
            </div>
          </div>
          
          {/* Main Slider Container */}
          <div 
            ref={sliderRef}
            className="relative bg-white rounded-xl shadow-xl overflow-hidden border-2 border-gray-200"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Slider Content */}
            <div className="relative h-[500px]">
              {dashboards.map((dashboard, index) => (
                <div
                  key={dashboard.id}
                  className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                    index === currentSlide 
                      ? 'opacity-100 translate-x-0 z-10' 
                      : index < currentSlide 
                      ? 'opacity-0 -translate-x-full z-0' 
                      : 'opacity-0 translate-x-full z-0'
                  }`}
                >
                  <div className="h-full flex flex-col">
                    {/* Dashboard Header */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${dashboard.color} shadow-md`}>
                          {React.cloneElement(dashboard.icon, { className: "h-5 w-5 text-white" })}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{dashboard.title}</h3>
                          <p className="text-xs text-gray-600">{dashboard.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => window.open(dashboard.url, '_blank')}
                        className={`px-4 py-2 bg-gradient-to-r ${dashboard.color} text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center space-x-2`}
                      >
                        <span>Open Full View</span>
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Power BI Dashboard Embed */}
                    <div className="flex-1 bg-gray-50 relative">
                      <iframe
                        src={dashboard.url}
                        className="w-full h-full border-0"
                        allowFullScreen={true}
                        title={dashboard.title}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white p-2 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-20 border border-blue-200"
              aria-label="Previous report"
            >
              <ChevronLeft className="h-5 w-5 text-gray-800" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white p-2 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-20 border border-blue-200"
              aria-label="Next report"
            >
              <ChevronRight className="h-5 w-5 text-gray-800" />
            </button>

            {/* Slide Indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-white/90 px-3 py-1.5 rounded-full shadow-md z-20">
              {dashboards.map((dashboard, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentSlide 
                      ? 'w-8 h-2.5 bg-blue-600' 
                      : 'w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to ${dashboard.title}`}
                  title={dashboard.title}
                />
              ))}
            </div>

            {/* Auto-rotate indicator */}
            {!isPaused && (
              <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 shadow-md z-20 animate-pulse">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                <span>Auto</span>
              </div>
            )}
          </div>

          {/* Quick Navigation Grid */}
          <div className="mt-3 grid grid-cols-7 gap-2">
            {dashboards.map((dashboard, index) => (
              <button
                key={dashboard.id}
                onClick={() => goToSlide(index)}
                className={`p-2 rounded-lg border transition-all duration-300 ${
                  index === currentSlide
                    ? 'border-blue-600 bg-blue-50 shadow-md scale-105'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'
                }`}
              >
                <div className={`mb-1 p-1.5 rounded-md bg-gradient-to-br ${dashboard.color} inline-block`}>
                  {React.cloneElement(dashboard.icon, { className: "h-4 w-4 text-white" })}
                </div>
                <h4 className="text-xs font-semibold text-gray-800 truncate">{dashboard.title}</h4>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;