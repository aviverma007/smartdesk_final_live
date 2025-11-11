import React from "react";
import { Badge } from "./ui/badge";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const { isAdmin } = useAuth();

  return (
    <header className="bg-white shadow-lg border-b border-blue-200">
      <div className="w-full px-4 py-2">
        <div className="flex justify-between items-center">
          {/* Left side - Logo and System Name */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-3">
              <img 
                src="/images/header-logo.png"
                alt="Company Logo"
                className="object-contain rounded-lg h-12 w-12 shadow-sm"
              />
              <div>
                <p className="font-semibold text-blue-600 text-lg">
                  SMARTDESK
                </p>
              </div>
            </div>
          </div>
          
          {/* Right side - Beta Badge only */}
          <div className="flex items-center space-x-2">
            {/* Beta Version Badge */}
            <Badge
              variant="outline"
              className="bg-orange-100 text-orange-700 border-orange-300 text-xs px-2 py-1"
            >
              Beta v1.0
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;