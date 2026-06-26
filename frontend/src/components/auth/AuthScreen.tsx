import React, { useState } from 'react';

interface AuthScreenProps {
  onLogin: (token: string, role: string) => void;
}

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState(""); 
  
  // State to hold our fake GPS location for testing
  const [mockCity, setMockCity] = useState("Vijayawada"); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(""); 
    setSuccessMsg(""); 

    const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "X-Mock-City": mockCity 
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.detail || "Authentication failed");
        return;
      }

      if (isRegistering) {
        setIsRegistering(false);
        setSuccessMsg("Registration successful! Please log in."); 
        setPassword(""); 
      } else {
        // 🚀 THE FIX: Save the session ID so the video player can read it
        if (data.session_id) {
          localStorage.setItem("session_id", data.session_id);
        }
        
        // Send the token and the role (admin or user) back up to App.tsx
        onLogin(data.access_token, data.role);
      }
      
    } catch (error) {
      setErrorMsg("Cannot connect to backend server. Is FastAPI running?");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-red-600 font-black text-3xl tracking-tighter">SECURESTREAM</h1>
          <p className="text-neutral-400 text-sm">
            {isRegistering ? "Create your secure account." : "Enter your credentials to continue."}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-950/50 border border-red-900 text-red-500 text-xs p-3 rounded text-center font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-950/50 border border-green-900 text-green-500 text-xs p-3 rounded text-center font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400 tracking-wider">EMAIL ADDRESS</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600 transition-colors"
              placeholder="admin@securestream.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400 tracking-wider">PASSWORD</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {!isRegistering && (
            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-yellow-500 tracking-wider">SIMULATE LOGIN LOCATION (TESTING)</label>
              <select 
                value={mockCity}
                onChange={(e) => setMockCity(e.target.value)}
                className="w-full bg-neutral-900 border border-yellow-700/50 rounded-lg px-4 py-3 text-yellow-500 focus:outline-none focus:border-yellow-500 transition-colors appearance-none"
              >
                <option value="Vijayawada">Vijayawada (Home)</option>
                <option value="Delhi">Delhi (1,400km Away)</option>
                <option value="Mumbai">Mumbai (800km Away)</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-red-900/20 tracking-wide text-sm mt-4"
          >
            {isRegistering ? "REGISTER ACCOUNT" : "SECURE LOGIN"}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-neutral-800">
          <button 
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg(""); 
              setSuccessMsg(""); 
            }}
            className="text-neutral-500 hover:text-white text-xs font-medium transition-colors"
          >
            {isRegistering ? "Already have an account? Sign In" : "Need access? Register here"}
          </button>
        </div>
      </div>
    </div>
  );
}