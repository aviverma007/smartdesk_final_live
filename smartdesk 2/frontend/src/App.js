import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginForm from "./components/LoginForm";
import EmployeeDirectory from "./components/EmployeeDirectory";
import Header from "./components/Header";
import { Toaster } from "./components/ui/sonner";

// Import required components for user features
import Home from "./components/Home";
import Policies from "./components/Policies";
import MeetingRooms from "./components/MeetingRooms";
import HolidayCalendar from "./components/HolidayCalendar";
import Dashboard from "./components/Dashboard";

const AppContent = () => {
  const { isAuthenticated, initializeAuth } = useAuth();
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    initializeAuth();
  }, []);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="App min-h-screen bg-blue-50">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <div className="w-full min-h-screen flex flex-col">
              <Header />
              <div className="flex-1 w-full px-2 sm:px-4 lg:px-6 py-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                  {/* Navigation Tabs - User Only */}
                  <div className="flex justify-start mb-4 overflow-x-auto">
                    <TabsList className="flex w-auto h-10 shadow-md border rounded-lg p-1 min-w-max bg-white border-blue-200">
                      <TabsTrigger 
                        value="home" 
                        className="text-xs sm:text-sm font-medium rounded-md px-2 sm:px-4 py-2 whitespace-nowrap transition-all duration-200 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-blue-700"
                      >
                        Home
                      </TabsTrigger>
                      
                      <TabsTrigger 
                        value="directory" 
                        className="text-xs sm:text-sm font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-blue-700 rounded-md px-2 sm:px-4 py-2 whitespace-nowrap"
                      >
                        Employee Directory
                      </TabsTrigger>
                      
                      <TabsTrigger 
                        value="policies" 
                        className="text-xs sm:text-sm font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-blue-700 rounded-md px-2 sm:px-4 py-2 whitespace-nowrap"
                      >
                        Policies
                      </TabsTrigger>
                      
                      <TabsTrigger 
                        value="meeting-rooms" 
                        className="text-xs sm:text-sm font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-blue-700 rounded-md px-2 sm:px-4 py-2 whitespace-nowrap"
                      >
                        Meeting Rooms
                      </TabsTrigger>
                      
                      <TabsTrigger 
                        value="holiday-calendar" 
                        className="text-xs sm:text-sm font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-blue-700 rounded-md px-2 sm:px-4 py-2 whitespace-nowrap"
                      >
                        Holiday Calendar
                      </TabsTrigger>
                      
                      <TabsTrigger 
                        value="dashboard" 
                        className="text-xs sm:text-sm font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-blue-700 rounded-md px-2 sm:px-4 py-2 whitespace-nowrap"
                      >
                        Dashboard
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <div className="flex-1 overflow-auto">
                    <TabsContent value="home" className="mt-0 h-full">
                      <Home />
                    </TabsContent>
                    
                    <TabsContent value="directory" className="mt-0 h-full">
                      <EmployeeDirectory />
                    </TabsContent>
                    
                    <TabsContent value="policies" className="mt-0 h-full">
                      <Policies />
                    </TabsContent>
                    
                    <TabsContent value="meeting-rooms" className="mt-0 h-full">
                      <MeetingRooms />
                    </TabsContent>
                    
                    <TabsContent value="holiday-calendar" className="mt-0 h-full">
                      <HolidayCalendar />
                    </TabsContent>
                    
                    <TabsContent value="dashboard" className="mt-0 h-full">
                      <Dashboard />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
              <Toaster />
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
