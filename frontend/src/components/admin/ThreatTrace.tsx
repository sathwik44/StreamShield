import { useEffect, useState } from 'react';

// Define the shape of the data coming from your FastAPI backend
interface Threat {
  user: string;
  score: number;
  reason: string;
}

export default function ThreatTrace() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchThreats = async () => {
      try {
        // VITE_API_URL securely points to your live Render backend
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/threats`);
        if (!response.ok) throw new Error("Failed to fetch threat trace");
        
        const data = await response.json();
        setThreats(data);
      } catch (err) {
        setError('Connection to security server lost.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchThreats();
  }, []);

  return (
    <div style={{ padding: '2rem', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2 style={{ color: '#ff4444', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        🔴 ACTIVE THREAT TRACE
      </h2>
      
      {loading && <p style={{ color: '#888' }}>Establishing secure connection to backend...</p>}
      {error && <p style={{ color: '#ff4444' }}>{error}</p>}

      {!loading && !error && threats.length === 0 && (
        <p style={{ color: '#00cc66' }}>✅ No geographic anomalies detected. System secure.</p>
      )}

      <div style={{ marginTop: '20px' }}>
        {threats.map((threat, index) => (
          <div key={index} style={{ 
            backgroundColor: '#1e1e1e', 
            padding: '15px', 
            marginBottom: '10px', 
            borderRadius: '5px',
            borderLeft: threat.score >= 80 ? '5px solid #ff4444' : '5px solid #ffaa00'
          }}>
            <h3 style={{ margin: '0 0 5px 0', color: threat.score >= 80 ? '#ff4444' : '#ffaa00' }}>
              Risk Score: {threat.score}% {threat.score >= 80 && '(ACCOUNT LOCKED)'}
            </h3>
            <p style={{ margin: '5px 0', color: '#ccc' }}><strong>Target:</strong> {threat.user}</p>
            <p style={{ margin: '5px 0', color: '#888' }}><strong>Trace Logic:</strong> {threat.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}