import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Building2, User, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LoginForm = () => {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const ADMIN_PASSWORD = 'Smart@12345';

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    
    if (role === 'user') {
      // Direct login for user
      handleUserLogin();
    } else if (role === 'admin') {
      // Show password dialog for admin
      setShowPasswordDialog(true);
      setPassword('');
    }
  };

  const handleAdminLogin = () => {
    const userData = {
      name: 'Administrator',
      role: 'admin',
      employeeId: 'ADMIN001',
      loginTime: new Date().toISOString()
    };
    login(userData);
    toast.success('Welcome Administrator! 🛡️');
  };

  const handleUserLogin = () => {
    const userData = {
      name: 'User',
      role: 'user',
      employeeId: '',
      loginTime: new Date().toISOString()
    };
    login(userData);
    toast.success('Welcome User! 👋');
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      toast.error('Please enter the password');
      return;
    }

    setIsLoading(true);

    // Simulate loading for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (password === ADMIN_PASSWORD) {
      setShowPasswordDialog(false);
      handleAdminLogin();
    } else {
      toast.error('Incorrect password. Please try again.');
    }
    
    setIsLoading(false);
    setPassword('');
  };

  const handleDialogClose = () => {
    setShowPasswordDialog(false);
    setPassword('');
    setSelectedRole('');
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-8">
          {/* Header */}
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center space-x-4">
              <div className="p-6 bg-white rounded-3xl shadow-xl">
                <img 
                  src="/images/company-logo.png" 
                  alt="SMARTWORLD DEVELOPERS Logo" 
                  className="h-20 w-20 object-contain"
                />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                SMARTWORLD DEVELOPERS
              </h1>
              <p className="text-lg text-blue-600 font-medium">
                SMARTDESK
              </p>
            </div>
          </div>

          {/* Main Login Card */}
          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-lg">
              <CardTitle className="text-white text-center text-xl font-semibold">
                Access Portal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    Select Your Access Level
                  </h3>
                  <p className="text-sm text-gray-500">
                    Choose your role to access the system
                  </p>
                </div>

                {/* Role Selection Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                    Access Level
                  </Label>
                  <Select value={selectedRole} onValueChange={handleRoleSelection}>
                    <SelectTrigger className="w-full h-14 text-lg border-2 border-gray-200 hover:border-blue-400 transition-colors">
                      <SelectValue placeholder="Choose your access level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user" className="cursor-pointer">
                        <div className="flex items-center space-x-3 py-2">
                          <User className="h-5 w-5 text-green-600" />
                          <div>
                            <div className="font-medium">User Access</div>
                            <div className="text-sm text-gray-500">Standard employee access</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin" className="cursor-pointer">
                        <div className="flex items-center space-x-3 py-2">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <div>
                            <div className="font-medium">Administrator Access</div>
                            <div className="text-sm text-gray-500">Full system control</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                    </div>
                    <div className="text-sm text-blue-700">
                      <strong>User Access:</strong> Direct access to employee portal and features
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 mt-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                    </div>
                    <div className="text-sm text-blue-700">
                      <strong>Admin Access:</strong> Requires password for administrative functions
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Password Dialog for Admin */}
      <Dialog open={showPasswordDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5 text-blue-600" />
              <span>Administrator Authentication</span>
            </DialogTitle>
            <DialogDescription>
              Enter the administrator password to access the admin dashboard.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="pr-10"
                  onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={handleDialogClose}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordSubmit}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? 'Authenticating...' : 'Login'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginForm;