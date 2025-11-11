import React from "react";
import { Badge } from "./ui/badge";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const { isAdmin } = useAuth();

  const handleLogoClick = () => {
    window.location.href = '/';
  };

  return (
    <header className="bg-white shadow-lg border-b border-blue-200">
      <div className="w-full px-4 py-2">
        <div className="flex justify-between items-center">
          {/* Left side - Logo and System Name */}
          <div className="flex items-center space-x-3">
            <div 
              className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity duration-200"
              onClick={handleLogoClick}
            >
              <img 
                src="/images/header-logo.png"
                alt="Company Logo"
                className="object-contain rounded-lg h-12 w-12 shadow-sm"
              />
              <div>
                <p className="font-semibold text-blue-600 text-lg typing-text">
                  SMARTDESKK
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

      <style jsx>{`
        @keyframes typing {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }

        @keyframes blink {
          50% {
            border-color: transparent;
          }
        }

        .typing-text {
          display: inline-block;
          overflow: hidden;
          border-right: 2px solid #2563eb;
          white-space: nowrap;
          animation: typing 2s steps(10, end) infinite alternate, blink 0.75s step-end infinite;
        }
      `}</style>
    </header>
  );
};

export default Header;