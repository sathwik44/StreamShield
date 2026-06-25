import { useState } from 'react';

// Define the shape of the data coming from your new FastAPI endpoint
interface TraceResult {
  status: string;
  culprit_email: string;
  risk_score: number;
  compromised_location: string;
  login_time: string;
}

export default function ThreatTrace() {
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSeedDB = async () => {
    setLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/admin/seed`, { method: 'POST' });
      alert("Test targets injected into live database! Try tracing 'sess_hacker999' or 'sess_bob456'.");
    } catch (err) {
      alert("Failed to seed database.");
    } finally {
      setLoading(false);
    }
  };

  const handleTrace = async () => {
    if (!sessionId.trim()) {
      setError('Please enter a valid Session ID.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Calling the specific session trace endpoint on your live Render backend
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/trace/${sessionId.trim()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to trace session.');
      }
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2 style={{ color: '#ff4444', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        🔴 ACTIVE THREAT TRACE
      </h2>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Enter sess_..." 
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          style={{ padding: '10px', width: '300px', backgroundColor: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
        />
        
        {/* BUTTON 1: THE MISSING TRACE BUTTON */}
        <button 
          onClick={handleTrace}
          disabled={loading}
          style={{ padding: '10px 20px', backgroundColor: '#e63946', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          EXECUTE TRACE
        </button>

        {/* BUTTON 2: YOUR NEW INJECTION BUTTON */}
        <button 
          onClick={handleSeedDB}
          disabled={loading}
          style={{ padding: '10px 20px', backgroundColor: '#00cc66', color: '#121212', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🧪 INJECT TEST DATA
        </button>
      </div>

      {error && <p style={{ color: '#ff4444', backgroundColor: '#330000', padding: '10px', borderRadius: '4px' }}>⚠️ {error}</p>}

      {result && (
        <div style={{ 
          backgroundColor: '#1e1e1e', 
          padding: '20px', 
          borderRadius: '5px',
          borderLeft: result.risk_score >= 80 ? '5px solid #ff4444' : '5px solid #00cc66'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>
            {result.status}
          </h3>
          <p style={{ margin: '8px 0', color: '#ccc' }}><strong>Culprit Target:</strong> <span style={{ color: '#ffaa00' }}>{result.culprit_email}</span></p>
          <p style={{ margin: '8px 0', color: '#ccc' }}><strong>Compromised Location:</strong> {result.compromised_location}</p>
          <p style={{ margin: '8px 0', color: '#ccc' }}><strong>Timestamp:</strong> {result.login_time}</p>
          <p style={{ margin: '8px 0', color: '#ccc' }}>
            <strong>Current Risk Score:</strong> 
            <span style={{ color: result.risk_score >= 80 ? '#ff4444' : '#00cc66', marginLeft: '10px', fontWeight: 'bold' }}>
              {result.risk_score}% {result.risk_score >= 80 && '(ACCOUNT LOCKED)'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}