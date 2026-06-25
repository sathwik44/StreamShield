import { useState, useEffect } from 'react';

// Added risk_score to the expected data
interface DatabaseUser {
  id: number;
  email: string;
  session_id?: string; 
  is_active: string;
  joined: string;
  risk_score: number; 
}

export default function AdminDashboard() {
  const [threats, setThreats] = useState<any[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<DatabaseUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // NEW: State for the Trace feature
  const [traceId, setTraceId] = useState('');
  const [traceResult, setTraceResult] = useState<any>(null);
  const [traceError, setTraceError] = useState('');
  const [isTracing, setIsTracing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Fetch both Users and Threats from Python
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const usersResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users`, { cache: "no-store" });
      if (usersResponse.ok) {
        const userData = await usersResponse.json();
        setRegisteredUsers(userData);
      }

      const threatsResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/threats`, { cache: "no-store" });
      if (threatsResponse.ok) {
        const threatData = await threatsResponse.json();
        setThreats(threatData);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Run once on load
  useEffect(() => {
    fetchDashboardData();
  }, []); 

  // NEW: The actual Trace Logic
  const handleTrace = async () => {
    if (!traceId.trim()) return;
    setIsTracing(true);
    setTraceError('');
    setTraceResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/trace/${traceId.trim()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Trace Failed.');
      setTraceResult(data);
    } catch (err: any) {
      setTraceError(err.message);
    } finally {
      setIsTracing(false);
    }
  };

  // NEW: The Injection Logic
  const handleSeedDB = async () => {
    setIsSeeding(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/admin/seed`, { method: 'POST' });
      alert("Test targets injected into live database!");
      fetchDashboardData(); // Automatically refreshes the table below!
    } catch (err) {
      alert("Failed to seed database.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950 min-h-screen">
      
      <div className="border border-red-900/50 bg-red-950/20 p-4 rounded-xl flex items-center space-x-4 text-red-400 shadow-inner">
        <span className="text-2xl animate-pulse">🔴</span>
        <p className="font-mono text-sm tracking-wide">FORENSIC TELEMETRY ACTIVE. SECURE ADMIN CLEARANCE GRANTED.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* TRACER SECTION WITH WIRING */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl space-y-4 backdrop-blur-md shadow-xl">
          <h3 className="font-bold text-lg border-b border-neutral-800 pb-2 text-white">Forensic Leak Tracer</h3>
          <p className="text-sm text-neutral-400">Enter the watermark session ID found on the pirated stream to extract the culprit's footprint.</p>
          <div className="flex space-x-3">
            <input 
              type="text" 
              placeholder="SESSION ID (e.g. USR-942-X7)" 
              value={traceId}
              onChange={(e) => setTraceId(e.target.value)}
              className="bg-black border border-neutral-700 rounded px-4 py-3 text-sm flex-1 font-mono focus:border-red-500 outline-none transition-colors text-white" 
            />
            <button 
              onClick={handleTrace}
              disabled={isTracing}
              className="bg-white text-black font-bold px-6 rounded text-sm hover:bg-neutral-300 transition-colors disabled:opacity-50"
            >
              {isTracing ? 'TRACING...' : 'TRACE'}
            </button>
          </div>

          {/* Trace Results Display */}
          {traceError && (
            <div className="mt-4 p-3 bg-red-950/50 border border-red-900 text-red-500 text-sm rounded font-mono">
              ⚠️ {traceError}
            </div>
          )}
          {traceResult && (
            <div className="mt-4 p-4 bg-black border-l-4 border-red-500 rounded shadow-lg">
              <h4 className="text-red-500 font-bold font-mono tracking-wide mb-2">{traceResult.status}</h4>
              <p className="text-sm text-neutral-400 mb-1">Culprit Target: <span className="text-yellow-500 font-mono ml-2">{traceResult.culprit_email}</span></p>
              <p className="text-sm text-neutral-400 mb-1">Compromised Location: <span className="text-white ml-2">{traceResult.compromised_location}</span></p>
              <p className="text-sm text-neutral-400">Risk Score: 
                <span className={`ml-2 font-bold ${traceResult.risk_score >= 80 ? 'text-red-500' : 'text-green-500'}`}>
                  {traceResult.risk_score}% {traceResult.risk_score >= 80 && '(LOCKED)'}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl space-y-4 backdrop-blur-md shadow-xl">
          <h3 className="font-bold text-lg border-b border-neutral-800 pb-2 text-white">Priority Threat Queue (Max-Heap)</h3>
          <div className="space-y-3">
            {threats.length === 0 ? (
              <div className="text-neutral-500 font-mono text-sm p-4 text-center border border-neutral-800 border-dashed rounded">
                NO ANOMALIES DETECTED
              </div>
            ) : (
              threats.map((t, i) => (
                <div key={i} className="bg-black border border-neutral-800 p-3 rounded flex justify-between items-center hover:border-neutral-600 transition-colors">
                  <div>
                    <div className="font-mono text-sm font-bold text-white">{t.user}</div>
                    <div className="text-xs text-neutral-500 mt-1">{t.reason}</div>
                  </div>
                  <div className={`font-mono text-xl font-black ${t.score >= 80 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>{t.score}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl space-y-4 backdrop-blur-md shadow-xl">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <h3 className="font-bold text-lg text-white">System User Directory (Live DB)</h3>
          
          <div className="flex items-center space-x-4">
            <span className="text-xs text-neutral-500 font-mono">
              {isLoading ? "CONNECTING..." : `TOTAL RECORDS: ${registeredUsers.length}`}
            </span>
            
            {/* NEW INJECT BUTTON PLACED PERFECTLY HERE */}
            <button 
              onClick={handleSeedDB}
              disabled={isSeeding}
              className="bg-green-900/30 border border-green-900/50 hover:bg-green-900/60 text-green-500 text-xs font-bold py-1 px-3 rounded transition-colors"
            >
              {isSeeding ? 'INJECTING...' : '🧪 INJECT TEST DATA'}
            </button>
            
            <button 
              onClick={fetchDashboardData}
              className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold py-1 px-3 rounded transition-colors"
            >
              REFRESH LIVE DATA
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-400">
            <thead className="text-xs text-neutral-500 bg-neutral-950/50 uppercase font-mono">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">ID</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Session ID</th>
                <th className="px-4 py-3">Join Date</th>
                <th className="px-4 py-3 text-yellow-500 font-bold">Risk Score</th>
                <th className="px-4 py-3 rounded-tr-lg">Status</th>
              </tr>
            </thead>
            <tbody>
              {registeredUsers.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 font-mono">No users found in database. Please register a user.</td>
                </tr>
              ) : (
                registeredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-4 font-mono text-white">{user.id}</td>
                    <td className="px-4 py-4 font-bold text-white">{user.email}</td>
                    <td className="px-4 py-4 font-mono text-yellow-500/80">{user.session_id || "N/A"}</td>
                    <td className="px-4 py-4">{user.joined}</td>
                    <td className={`px-4 py-4 font-mono font-bold ${user.risk_score >= 80 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>
                      {user.risk_score}%
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        user.is_active === 'Active' ? 'bg-green-900/30 text-green-500 border border-green-900/50' : 'bg-red-900/30 text-red-500 border border-red-900/50'
                      }`}>
                        {user.is_active}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}