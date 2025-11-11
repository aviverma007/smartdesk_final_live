import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LoginForm = () => {
  const { login } = useAuth();

  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      const userData = {
        name: 'User',
        role: 'user',
        employeeId: '',
        loginTime: new Date().toISOString()
      };
      login(userData);
      toast.success('Welcome! 👋');
    }, 3000);

    return () => clearTimeout(timer);
  }, [login]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-6">
        {/* Breathing Logo Animation */}
        <div className="breathing-logo">
          <img 
            src="/images/header-logo.png"
            alt="Company Logo"
            className="h-32 w-32 object-contain rounded-lg shadow-2xl"
          />
        </div>
        
        {/* Company Name */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-600 tracking-wide">SMARTDESK</h1>
          <p className="text-sm text-gray-600 mt-2">Employee Directory System</p>
        </div>

        {/* Loading indicator */}
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.9;
          }
        }

        .breathing-logo {
          animation: breathe 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginForm;