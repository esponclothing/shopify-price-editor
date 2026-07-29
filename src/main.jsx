import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function PasswordGate() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    localStorage.getItem('11fit_auth') === 'true'
  );
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [pwShake, setPwShake] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pwInput === '11Fit@2026') {
      localStorage.setItem('11fit_auth', 'true');
      setIsAuthenticated(true);
    } else {
      setPwError(true);
      setPwShake(true);
      setPwInput('');
      setTimeout(() => setPwShake(false), 600);
    }
  };

  if (isAuthenticated) return <App />;

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F19', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{
        width: '100%', maxWidth: '360px',
        background: '#0F172A', border: '1px solid #1e293b',
        borderRadius: '24px', padding: '2rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        animation: pwShake ? 'shake 0.5s ease' : 'none'
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(16,185,129,0.3)'
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem' }}>11</span>
          </div>
          <h1 style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', margin: '0 0 0.25rem' }}>11Fit Admin</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Enter your password to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Password"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#020617', border: `1px solid ${pwError ? '#f43f5e' : '#334155'}`,
              borderRadius: '12px', padding: '0.875rem 1rem',
              color: 'white', fontSize: '0.875rem', outline: 'none',
              marginBottom: '0.5rem'
            }}
          />
          {pwError && (
            <p style={{ color: '#f87171', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
              ⚠️ Incorrect password. Try again.
            </p>
          )}
          <button
            type="submit"
            style={{
              width: '100%', background: '#10b981', border: 'none',
              borderRadius: '12px', padding: '0.875rem',
              color: 'white', fontWeight: 700, fontSize: '0.875rem',
              cursor: 'pointer', marginTop: '0.5rem',
              boxShadow: '0 4px 16px rgba(16,185,129,0.3)'
            }}
          >
            Unlock Dashboard
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.7rem', marginTop: '1.5rem' }}>
          🔒 11Fit Internal Tool — Authorized Access Only
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PasswordGate />
  </StrictMode>,
)
