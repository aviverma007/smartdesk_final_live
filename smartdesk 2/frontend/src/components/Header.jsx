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
                <p className="font-extrabold text-blue-700 text-xl typing-text">
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
          0% {
            width: 0;
          }
          33% {
            width: 100%;
          }
          66% {
            width: 100%;
          }
          100% {
            width: 0;
          }
        }

        @keyframes blink {
          50% {
            border-color: transparent;
          }
        }

        @keyframes textGlow {
          0%, 100% {
            text-shadow: 0 0 8px rgba(37, 99, 235, 0.3),
                         0 0 15px rgba(37, 99, 235, 0.2);
          }
          50% {
            text-shadow: 0 0 12px rgba(37, 99, 235, 0.5),
                         0 0 20px rgba(37, 99, 235, 0.3),
                         0 0 25px rgba(37, 99, 235, 0.2);
          }
        }

        .typing-text {
          display: inline-block;
          overflow: hidden;
          border-right: 3px solid #2563eb;
          white-space: nowrap;
          padding: 2px 8px;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(59, 130, 246, 0.15) 100%);
          border-radius: 4px;
          animation: 
            typing 6s steps(10, end) infinite,
            blink 0.75s step-end infinite,
            textGlow 2s ease-in-out infinite;
        }
      `}</style>
    </header>
  );
};

export default Header;