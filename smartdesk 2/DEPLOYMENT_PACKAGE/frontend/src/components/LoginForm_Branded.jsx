import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Building, Users, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginForm = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (role) => {
    setLoading(true);
    try {
      await login(role === 'admin' ? 'ADMIN001' : 'USER001', role);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" 
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
             }}>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Company Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center">
              <img 
                src="https://customer-assets.emergentagent.com/job_employee-excel-check/artifacts/6rs593sm_company%20logo.png"
                alt="SMARTWORLD DEVELOPERS Logo"
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="w-16 h-16 bg-blue-600 rounded-full hidden items-center justify-center">
                <Building className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            SMARTWORLD DEVELOPERS
          </h1>
          <p className="text-gray-600 text-lg font-medium mb-1">PVT. LTD.</p>
          <p className="text-gray-500 text-sm">Employee Management System</p>
        </div>

        {/* Login Cards */}
        <div className="space-y-4">
          {/* Administrator Access */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="text-center text-gray-700 font-semibold">
                Administrator Access
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleLogin('admin')}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                {loading ? 'Connecting...' : 'Enter Admin Dashboard'}
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Full access to all features
              </p>
            </CardContent>
          </Card>

          {/* User Access */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="text-center text-gray-700 font-semibold">
                User Access
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleLogin('user')}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <User className="w-5 h-5" />
                {loading ? 'Connecting...' : 'Enter User Dashboard'}
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Access to essential features
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Company Information Footer */}
        <div className="mt-8 text-center">
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">
              <strong>SMARTWORLD DEVELOPERS PVT. LTD.</strong>
            </p>
            <p className="text-xs text-gray-500">
              Secure Employee Portal • Internal Network Access Only
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Server: 81096-LP2 • Network: 192.168.166.171
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            This system is for authorized personnel only. 
            <br />
            All activities are logged and monitored.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;