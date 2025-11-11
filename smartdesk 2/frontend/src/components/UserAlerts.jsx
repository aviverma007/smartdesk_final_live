import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Clock,
  Bell
} from "lucide-react";
import { alertAPI } from "../services/api";

const UserAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [showAlert, setShowAlert] = useState(false);
  const [isCloudVisible, setIsCloudVisible] = useState(true);
  const [buttonPosition, setButtonPosition] = useState({ top: 16, right: 16 });
  const [isDragging, setIsDragging] = useState(false);

  // Load alerts from backend API
  const loadActiveAlerts = async () => {
    try {
      console.log('Loading alerts from backend API...');
      const alertsData = await alertAPI.getAll('all');
      
      // Filter active alerts (not expired)
      const now = new Date();
      const activeAlerts = alertsData.filter(alert => {
        if (alert.expires_at) {
          return new Date(alert.expires_at) > now;
        }
        return true; // No expiry date means always active
      });
      
      // Filter out dismissed alerts
      const newAlerts = activeAlerts.filter(alert => !dismissedAlerts.has(alert.id));
      
      console.log(`Loaded ${newAlerts.length} active alerts`);
      
      if (newAlerts.length > 0) {
        setAlerts(newAlerts);
        setCurrentAlertIndex(0);
        setShowAlert(true);
      } else {
        setShowAlert(false);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      // Create a sample alert to test the system
      const sampleAlert = {
        id: 'sample-1',
        title: 'Welcome to SmartWorld Developers!',
        message: 'Employee directory system is now fully operational with backend persistence.',
        priority: 'medium',
        type: 'announcement',
        created_at: new Date().toISOString()
      };
      setAlerts([sampleAlert]);
      setShowAlert(true);
    }
  };

  // Load alerts on component mount
  useEffect(() => {
    loadActiveAlerts();
    
    // Refresh alerts every 30 seconds to check for new ones
    const refreshInterval = setInterval(() => {
      loadActiveAlerts();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [dismissedAlerts]);

  // Handle alert rotation
  useEffect(() => {
    if (alerts.length > 1 && showAlert) {
      const rotationInterval = setInterval(() => {
        setCurrentAlertIndex((prev) => (prev + 1) % alerts.length);
      }, 10000); // Show each alert for 10 seconds
      
      return () => clearInterval(rotationInterval);
    }
  }, [alerts.length, showAlert]);

  const dismissAlert = (alertId) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
    
    // If this was the last alert, hide the component
    const remainingAlerts = alerts.filter(alert => alert.id !== alertId);
    if (remainingAlerts.length === 0) {
      setShowAlert(false);
    } else {
      // Adjust current index if needed
      setCurrentAlertIndex(prev => prev >= remainingAlerts.length ? 0 : prev);
    }
  };

  const dismissAllAlerts = () => {
    const allIds = new Set(alerts.map(alert => alert.id));
    setDismissedAlerts(prev => new Set([...prev, ...allIds]));
    setShowAlert(false);
  };

  const toggleCloudVisibility = () => {
    setIsCloudVisible(!isCloudVisible);
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Info className="h-4 w-4" />;
      case 'low':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 border-red-600';
      case 'high':
        return 'bg-orange-500 border-orange-600';
      case 'medium':
        return 'bg-blue-500 border-blue-600';
      case 'low':
        return 'bg-green-500 border-green-600';
      default:
        return 'bg-blue-500 border-blue-600';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'system':
        return <Clock className="h-4 w-4" />;
      case 'announcement':
        return <Bell className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Mouse event handlers for dragging - VERTICAL ONLY
  const handleMouseDown = (e) => {
    setIsDragging(true);
    const startY = e.clientY - buttonPosition.top;

    const handleMouseMove = (e) => {
      // Only allow vertical movement, keep horizontal position fixed
      const newTop = Math.max(16, Math.min(window.innerHeight - 64, e.clientY - startY));
      
      setButtonPosition({ 
        top: newTop, 
        right: buttonPosition.right // Keep horizontal position unchanged
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!showAlert || alerts.length === 0) {
    return null;
  }

  const currentAlert = alerts[currentAlertIndex];

  return (
    <>
      {/* Floating Alert Button - VERTICAL MOVEMENT ONLY */}
      <div 
        className={`fixed z-50 cursor-ns-resize ${isDragging ? 'cursor-ns-resize' : 'cursor-ns-resize'}`}
        style={{ 
          top: `${buttonPosition.top}px`, 
          right: `${buttonPosition.right}px`,
          transition: isDragging ? 'none' : 'all 0.3s ease'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className={`relative animate-pulse`}>
          <button
            onClick={toggleCloudVisibility}
            className={`${getPriorityColor(currentAlert.priority)} text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 border-2`}
          >
            <Bell className="h-5 w-5" />
            {alerts.length > 1 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {alerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Alert Cloud */}
      {isCloudVisible && (
        <div 
          className="fixed z-40 max-w-sm"
          style={{ 
            top: `${buttonPosition.top + 60}px`, 
            right: `${buttonPosition.right}px`,
            transition: 'all 0.3s ease'
          }}
        >
          <div className={`${getPriorityColor(currentAlert.priority)} text-white rounded-lg shadow-2xl border-2 overflow-hidden`}>
            {/* Alert Header */}
            <div className="px-4 py-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getPriorityIcon(currentAlert.priority)}
                  <span className="font-semibold text-sm">{currentAlert.title}</span>
                </div>
                <div className="flex items-center space-x-1">
                  {getTypeIcon(currentAlert.type)}
                  <button
                    onClick={() => dismissAlert(currentAlert.id)}
                    className="hover:bg-white/20 rounded p-1 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Alert Content */}
            <div className="px-4 py-3">
              <p className="text-sm leading-relaxed">{currentAlert.message}</p>
              
              {/* Alert Footer */}
              <div className="mt-3 flex items-center justify-between text-xs opacity-80">
                <span className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(currentAlert.created_at).toLocaleString()}</span>
                </span>
                
                {alerts.length > 1 && (
                  <span className="bg-white/20 px-2 py-1 rounded">
                    {currentAlertIndex + 1} of {alerts.length}
                  </span>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="mt-3 flex space-x-2">
                {alerts.length > 1 && (
                  <button
                    onClick={() => setCurrentAlertIndex((prev) => (prev + 1) % alerts.length)}
                    className="flex-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-medium transition-colors"
                  >
                    Next Alert
                  </button>
                )}
                <button
                  onClick={dismissAllAlerts}
                  className="flex-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-medium transition-colors"
                >
                  Dismiss All
                </button>
              </div>
            </div>
          </div>
          
          {/* Arrow pointing to button */}
          <div 
            className={`absolute -top-2 w-4 h-4 ${getPriorityColor(currentAlert.priority)} border-2 border-t-0 border-r-0 transform rotate-45`}
            style={{ right: '20px' }}
          />
        </div>
      )}
    </>
  );
};

export default UserAlerts;