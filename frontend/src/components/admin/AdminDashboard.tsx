import { useState, useEffect } from 'react';

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
  const [activity, setActivity] = useState<any[]>([]); // New Activity State
  const [isLoading, setIsLoading] = useState(true);

  const [traceId, setTraceId] = useState('');
  const [traceResult, setTraceResult] = useState<any>(null);
  const [traceError, setTraceError] = useState('');
  const [isTracing, setIsTracing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Users
      const usersResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users`, { cache: "no-store" });
      if (usersResponse.ok) setRegisteredUsers(await usersResponse.json());

      // 2. Fetch Threats
      const threatsResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/threats`, { cache: "no-store" });
      if (threatsResponse.ok) setThreats(await threatsResponse.json());

      // 3. Fetch Activity Logs
      const activityResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/activity`, { cache: "no-store" });
      if (activityResponse.ok) setActivity(await activityResponse.json());
      
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  const handleSeedDB = async () => {
    setIsSeeding(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/admin/seed`, { method: 'POST' });
      fetchDashboardData();
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
        {/* Tracer & Threat Queue */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl space-y-4 backdrop-blur-md shadow-xl">
          <h3 className="font-bold text-lg border-b border-neutral-800 pb-2 text-white">Forensic Leak Tracer</h3>
          <div className="flex space-x-3">
            <input 
              value={traceId}
              onChange={(e) => setTraceId(e.target.value)}
              className="bg-black border border-neutral-700 rounded px-4 py-3 text-sm flex-1 font-mono focus:border-red-500 outline-none text-white" 
              placeholder="SESSION ID (e.g. sess_...)"
            />
            <button onClick={handleTrace} disabled={isTracing} className="bg-white text-black font-bold px-6 rounded text-sm hover:bg-neutral-300">
              {isTracing ? 'TRACING...' : 'TRACE'}
            </button>
          </div>
          {traceResult && (
            <div className="mt-4 p-4 bg-black border-l-4 border-red-500 rounded shadow-lg">
              <h4 className="text-red-500 font-bold font-mono">{traceResult.status}</h4>
              <p className="text-sm text-neutral-400">Culprit: {traceResult.culprit_email}</p>
            </div>
          )}
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl space-y-4 backdrop-blur-md shadow-xl">
          <h3 className="font-bold text-lg border-b border-neutral-800 pb-2 text-white">Priority Threat Queue</h3>
          {threats.map((t, i) => (
            <div key={i} className="bg-black p-3 rounded flex justify-between items-center border border-neutral-800">
              <span className="font-mono text-sm text-white">{t.user}</span>
              <span className="text-red-500 font-black text-xl">{t.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Directory & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-white">System User Directory</h3>
              <button onClick={handleSeedDB} className="text-green-500 text-xs font-bold border border-green-900/50 px-3 py-1 rounded">🧪 INJECT TEST DATA</button>
           </div>
           <table className="w-full text-left text-sm text-neutral-400">
             <thead className="text-xs uppercase bg-neutral-950/50">
               <tr>
                 <th className="px-4 py-3">Email</th>
                 <th className="px-4 py-3">Risk Score</th>
                 <th className="px-4 py-3">Status</th>
               </tr>
             </thead>
             <tbody>
               {registeredUsers.map((user) => (
                 <tr key={user.id} className="border-b border-neutral-800/50">
                   <td className="px-4 py-4">{user.email}</td>
                   <td className="px-4 py-4 font-bold text-yellow-500">{user.risk_score}%</td>
                   <td className="px-4 py-4 text-green-500">{user.is_active}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-xl">
          <h2 className="text-white font-bold mb-4 font-mono">LIVE ACTIVITY FEED</h2>
          <div className="space-y-2">
            {activity.map((log: any, idx: number) => (
              <div key={idx} className="flex justify-between text-xs font-mono border-b border-neutral-800 py-2">
                <span className="text-blue-400 truncate">{log.email}</span>
                <span className="text-white truncate mx-2">{log.movie_title}</span>
                <span className="text-neutral-500">{log.location}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}