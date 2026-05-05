/**
 * AuthScreen — shown before CampaignSelect when the user isn't logged in.
 * Matches the existing campaign-select visual style (topo bg, splash logo, etc.)
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import TopoBackground from '../common/TopoBackground';
import LandingPage from './LandingPage';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode]       = useState('landing'); // 'landing' | 'login' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [betaKey, setBetaKey] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const splashLogo = '/logo/splash.svg';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, betaKey.trim().toUpperCase());
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setConfirm('');
    setBetaKey('');
  }

  // ── Landing page ──
  if (mode === 'landing') {
    return <LandingPage onGetStarted={(m) => setMode(m)} />;
  }

  return (
    <div className="campaign-select" style={{ position: 'relative', isolation: 'isolate' }}>
      <TopoBackground style={{ zIndex: 0 }} opacity={0.9} />

      <img
        src={splashLogo}
        alt="Flux Atlas"
        className="splash-logo"
        style={{ position: 'relative', zIndex: 1 }}
      />
      <p className="subtitle" style={{ position: 'relative', zIndex: 1 }}>
        Campaign World Manager
      </p>

      <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => { setMode('landing'); setError(''); }}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 12,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            marginBottom: 12, padding: 0,
            transition: 'color 180ms',
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseOut={(e)  => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          ← Back
        </button>
        <h2 className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-group">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="field-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'signup' && (
            <div className="field-group">
              <label htmlFor="auth-confirm">Confirm Password</label>
              <input
                id="auth-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {mode === 'signup' && (
            <div className="field-group">
              <label htmlFor="auth-beta-key">
                Beta Access Key
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                  required
                </span>
              </label>
              <input
                id="auth-beta-key"
                type="text"
                value={betaKey}
                onChange={(e) => setBetaKey(e.target.value)}
                placeholder="FLUX-XXXXX-XXXXX"
                required
                autoComplete="off"
                spellCheck={false}
                style={{ fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Flux Atlas is currently invite-only. Get a key from the team.
              </p>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button type="button" className="auth-switch-btn" onClick={switchMode}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
