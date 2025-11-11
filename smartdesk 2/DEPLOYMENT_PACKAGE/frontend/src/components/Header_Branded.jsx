import React from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { LogOut, RefreshCw, Building } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Company branding */}
          <div className="flex items-center space-x-4">
            {/* Company Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center border">
                <img 
                  src="https://customer-assets.emergentagent.com/job_employee-excel-check/artifacts/6rs593sm_company%20logo.png"
                  alt="SMARTWORLD DEVELOPERS"
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="w-8 h-8 bg-blue-600 rounded hidden items-center justify-center">
                  <Building className="w-4 h-4 text-white" />
                </div>
              </div>
              
              {/* Company Name and System Title */}
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-blue-600">
                  SMARTWORLD DEVELOPERS
                </h1>
                <p className="text-xs text-gray-500 -mt-1">Employee Management System</p>
              </div>
            </div>
          </div>

          {/* Center - System Status (Optional) */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500">System Online</span>
            </div>
          </div>

          {/* Right side - User info and actions */}
          <div className="flex items-center space-x-3">
            {/* User Info */}
            <div className="flex items-center space-x-2">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-900">
                  {isAdmin() ? 'Administrator' : 'User'}
                </div>
                <div className="text-xs text-gray-500">
                  ID: {user?.id}
                </div>
              </div>
              
              {/* User Role Badge */}
              <Badge 
                variant={isAdmin() ? "default" : "secondary"}
                className={`text-xs ${
                  isAdmin() 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {isAdmin() ? 'Admin' : 'User'}
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-1">
              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="text-gray-500 hover:text-gray-700"
                title="Refresh Application"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              {/* Logout Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-600"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Company Name */}
      <div className="sm:hidden px-4 pb-2">
        <div className="text-sm font-semibold text-blue-600">SMARTWORLD DEVELOPERS</div>
        <div className="text-xs text-gray-500">Employee Management System</div>
      </div>
    </header>
  );
};

export default Header;