import React, { useState, useEffect } from 'react';

// Adjusted imports to match your exact folder structure
import AuthScreen from './components/auth/AuthScreen';
import AdminDashboard from './components/admin/AdminDashboard';
import WatchScreen from './components/streaming/WatchScreen';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if the user already has a valid token when they open the app
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    
    if (token) {
      setIsAuthenticated(true);
      setUserRole(role);
    }
    setIsLoading(false);
  }, []);

  // Passed to AuthScreen so it can update the app state after a successful login
  const handleLoginSuccess = (token: string, role: string) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    setIsAuthenticated(true);
    setUserRole(role);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setIsAuthenticated(false);
    setUserRole(null);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white font-mono">INITIALIZING SECURESTREAM...</div>;
  }

  // 1. ROUTE: NOT LOGGED IN
  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLoginSuccess} />;
  }

// 2. ROUTE: ADMIN CLEARANCE
  if (userRole === "admin") {
    return (
      // ADDED THE BACKGROUND CLASSES HERE 👇
      <div className="relative min-h-screen bg-neutral-950">
        <div className="absolute top-0 right-0 p-4 z-50">
          <button 
            onClick={handleLogout}
            className="bg-red-900/50 hover:bg-red-600 text-white px-4 py-2 rounded text-xs font-bold font-mono transition-colors border border-red-900"
          >
            TERMINATE SESSION
          </button>
        </div>
        <AdminDashboard />
      </div>
    );
  }
// 3. ROUTE: STANDARD USER (The Viewer)
  return (
    <div className="relative min-h-screen bg-neutral-950 pt-24">
      
      {/* 🚀 NEW: UNIFIED GLOBAL NAVBAR */}
      <div className="absolute top-0 left-0 w-full p-6 px-10 z-40 flex justify-between items-center pointer-events-none">
        
        {/* Top Left Logo */}
        <h1 className="text-red-600 font-black text-2xl tracking-tighter pointer-events-auto">
          SECURESTREAM
        </h1>
        
        {/* Top Right Controls */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="text-xs font-mono text-neutral-500 bg-neutral-900 px-3 py-2 rounded border border-neutral-800">
            VIEWER STATUS: SECURE
          </div>
          <button 
            onClick={handleLogout}
            className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded text-xs font-bold font-mono transition-colors"
          >
            LOG OUT
          </button>
        </div>

      </div>

      <WatchScreen />
    </div>
  );
}