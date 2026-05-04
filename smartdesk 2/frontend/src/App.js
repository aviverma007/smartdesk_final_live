import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginForm from "./components/LoginForm";
import EmployeeDirectory from "./components/EmployeeDirectory";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { Toaster } from "./components/ui/sonner";
import Home from "./components/Home";
import Policies from "./components/Policies";
import MeetingRooms from "./components/MeetingRooms";
import HolidayCalendar from "./components/HolidayCalendar";
import Dashboard from "./components/Dashboard";

const NAV_ITEMS = [
  { value: "home", label: "HOME", icon: "⬡" },
  { value: "directory", label: "DIRECTORY", icon: "◈" },
  { value: "policies", label: "POLICIES", icon: "◉" },
  { value: "meeting-rooms", label: "ROOMS", icon: "◫" },
  { value: "holiday-calendar", label: "CALENDAR", icon: "◷" },
  { value: "dashboard", label: "DASHBOARD", icon: "◈" },
];

const AppContent = () => {
  const { isAuthenticated, showLoading, initializeAuth } = useAuth();
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => { initializeAuth(); }, []);

  if (showLoading || !isAuthenticated) return <LoginForm />;

  return (
    <div className="App" style={{ minHeight: '100vh', background: 'var(--cyber-bg)', position: 'relative', zIndex: 1 }}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Header />
                <div style={{ flex: 1, width: '100%', padding: '16px 16px 0' }}>
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full h-full flex flex-col cyber-tabs"
                  >
                    {/* Futuristic nav bar */}
                    <div style={{
                      marginBottom: 16,
                      overflowX: 'auto',
                      paddingBottom: 2,
                    }}>
                      <TabsList className="cyber-tab-list" style={{
                        display: 'flex', width: 'auto', height: 'auto',
                        minWidth: 'max-content', gap: 2,
                      }}>
                        {NAV_ITEMS.map(item => (
                          <TabsTrigger
                            key={item.value}
                            value={item.value}
                            style={{ whiteSpace: 'nowrap', borderRadius: 5, padding: '6px 14px', transition: 'all 0.2s' }}
                          >
                            <span style={{ marginRight: 5, opacity: 0.7 }}>{item.icon}</span>
                            {item.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      <TabsContent value="home" className="mt-0 tab-fade-in"><Home /></TabsContent>
                      <TabsContent value="directory" className="mt-0 tab-fade-in"><EmployeeDirectory /></TabsContent>
                      <TabsContent value="policies" className="mt-0 tab-fade-in"><Policies /></TabsContent>
                      <TabsContent value="meeting-rooms" className="mt-0 tab-fade-in"><MeetingRooms /></TabsContent>
                      <TabsContent value="holiday-calendar" className="mt-0 tab-fade-in"><HolidayCalendar /></TabsContent>
                      <TabsContent value="dashboard" className="mt-0 tab-fade-in"><Dashboard /></TabsContent>
                    </div>
                  </Tabs>
                </div>
                <Toaster />
                <Footer />
              </div>
            }
          />
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
