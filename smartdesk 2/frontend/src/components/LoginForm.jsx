import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LoginForm = () => {
  const { login, isAuthenticated } = useAuth();
  const [loadingText, setLoadingText] = useState('Initializing');

  useEffect(() => {
    // Loading text changes
    const textTimers = [
      setTimeout(() => setLoadingText('Loading Resources'), 1000),
      setTimeout(() => setLoadingText('Almost Ready'), 2000),
    ];

    // Auto-login after 3 seconds only if not already authenticated
    const redirectTimer = setTimeout(() => {
      if (!isAuthenticated) {
        const userData = {
          name: 'User',
          role: 'user',
          employeeId: '',
          loginTime: new Date().toISOString()
        };
        login(userData);
        toast.success('Welcome to SmartDesk! 👋', {
          description: 'Your employee directory system is ready',
          duration: 3000
        });
      }
    }, 3000);

    return () => {
      textTimers.forEach(timer => clearTimeout(timer));
      clearTimeout(redirectTimer);
    };
  }, [login, isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-purple-300/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute w-64 h-64 bg-blue-300/10 rounded-full blur-3xl top-1/2 left-1/2 animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center space-y-8 max-w-md w-full">
        {/* Enhanced Breathing Logo with glow effect */}
        <div className="relative">
          {/* Glow rings */}
          <div className="absolute inset-0 breathing-glow-1"></div>
          <div className="absolute inset-0 breathing-glow-2"></div>
          <div className="absolute inset-0 breathing-glow-3"></div>
          
          {/* Logo container */}
          <div className="breathing-logo relative z-10 bg-white rounded-3xl p-8 shadow-2xl">
            <img 
              src="/images/header-logo.png"
              alt="SmartDesk Logo"
              className="h-32 w-32 object-contain"
            />
          </div>
        </div>
        
        {/* Company Name with fade-in animation */}
        <div className="text-center fade-in-up">
          <h1 className="text-5xl font-bold text-white tracking-wide mb-2 drop-shadow-lg">
            SMARTDESK
          </h1>
          <p className="text-xl text-blue-100 mt-2 font-light">
            Employee Directory System
          </p>
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent w-64 mx-auto"></div>
        </div>

        {/* Enhanced Loading Section */}
        <div className="w-full space-y-4 fade-in-up" style={{animationDelay: '0.3s'}}>
          {/* Loading Text */}
          <div className="text-center">
            <p className="text-white text-lg font-medium drop-shadow-lg loading-text">
              {loadingText}
            </p>
          </div>

          {/* Animated dots */}
          <div className="flex justify-center space-x-2 mt-4">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce shadow-lg" style={{animationDelay: '0ms'}}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce shadow-lg" style={{animationDelay: '150ms'}}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce shadow-lg" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-20 h-20 border-4 border-white/20 rounded-full animate-spin-slow"></div>
        <div className="absolute bottom-32 left-10 w-16 h-16 border-4 border-white/20 rounded-full animate-spin-slow" style={{animationDelay: '1s'}}></div>
      </div>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }

        @keyframes breatheGlow1 {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.6;
          }
        }

        @keyframes breatheGlow2 {
          0%, 100% {
            transform: scale(1);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.4;
          }
        }

        @keyframes breatheGlow3 {
          0%, 100% {
            transform: scale(1);
            opacity: 0.1;
          }
          50% {
            transform: scale(1.7);
            opacity: 0.3;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes textPulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .breathing-logo {
          animation: breathe 3s ease-in-out infinite;
        }

        .breathing-glow-1 {
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, transparent 70%);
          border-radius: 50%;
          animation: breatheGlow1 3s ease-in-out infinite;
        }

        .breathing-glow-2 {
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(147, 197, 253, 0.4) 0%, transparent 70%);
          border-radius: 50%;
          animation: breatheGlow2 3s ease-in-out infinite 0.5s;
        }

        .breathing-glow-3 {
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(196, 181, 253, 0.3) 0%, transparent 70%);
          border-radius: 50%;
          animation: breatheGlow3 3s ease-in-out infinite 1s;
        }

        .fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .shimmer {
          animation: shimmer 2s infinite;
        }

        .loading-text {
          animation: textPulse 2s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spinSlow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginForm;