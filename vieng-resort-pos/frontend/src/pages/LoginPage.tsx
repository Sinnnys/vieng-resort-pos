import { useState } from 'react';
import { api, setToken, setStoredAdmin } from '../api';
import type { AdminUser } from '../api';

export default function LoginPage({ onLogin }: { onLogin: (admin: AdminUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login(username, password);
      setToken(result.token);
      setStoredAdmin(result.admin);
      onLogin(result.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-header">
          <img src="/media/logo.png" alt="Logo" className="login-logo" />
          <h1>Vieng POS</h1>
          <p>Admin Login</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <label>Username</label>
        <input className="login-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" autoFocus autoComplete="username" />
        <label>Password</label>
        <input className="login-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" />
        <button className="login-btn" type="submit" disabled={loading || !username || !password}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
