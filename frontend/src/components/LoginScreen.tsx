import { useState, useEffect } from 'react';
import { Lock, User, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import logo from '../assets/logo.png';

interface Props {
  onLoginSuccess: (token: string) => void;
}

export function LoginScreen({ onLoginSuccess }: Props) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Check backend status on mount and keep checking periodically
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl || apiUrl === 'undefined') {
        if (active) setBackendStatus('offline');
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${apiUrl}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok && active) {
          setBackendStatus('online');
        } else if (active) {
          setBackendStatus('offline');
        }
      } catch {
        if (active) setBackendStatus('offline');
      }
    };
    checkStatus();

    const interval = setInterval(checkStatus, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError('Please enter both User ID and Password');
      return;
    }

    setLoading(true);
    setError(null);

    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl || apiUrl === 'undefined') {
      setError('Backend API URL is not configured. Please set VITE_API_URL in environment variables.');
      setLoading(false);
      return;
    }

    try {
      console.debug('[LoginScreen] sending login request', { apiUrl });
      const res = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId.trim(), password: password.trim() }),
      });

      const rawText = await res.text();
      console.debug('[LoginScreen] login response', { status: res.status, statusText: res.statusText });

      if (!res.ok) {
        let errorMsg = `Login failed (HTTP ${res.status})`;
        try {
          const data = JSON.parse(rawText);
          errorMsg = data.detail || data.message || errorMsg;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        console.error('[LoginScreen] failed to parse login response JSON', parseError);
        throw new Error('Login response is not valid JSON');
      }

      if (!data.access_token) {
        throw new Error('Server response missing access token');
      }

      console.debug('[LoginScreen] login succeeded, access_token received');
      onLoginSuccess(data.access_token);
    } catch (err: unknown) {
      console.error('[LoginScreen] login error', err);
      if (err instanceof TypeError) {
        setError('Connection Error: Cannot connect to the admin server. The backend appears offline or unreachable. Please verify the server is running and try again.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-background text-foreground transition-colors duration-300">
      {/* Background Decorative Blurs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-20 dark:opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gold/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-gold/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-card rounded-[2rem] border border-border shadow-luxury overflow-hidden p-8 sm:p-10">
          {/* Header Area */}
          <div className="flex flex-col items-center mb-8 gap-3 text-center">
            <div className="bg-gold/5 p-3 rounded-2xl border border-gold/15">
              <img src={logo} alt="Crednco logo" className="h-8 w-auto" />
            </div>
            <h2 className="text-2xl font-black font-serif text-ink tracking-tight mt-2">
              Admin Portal
            </h2>
            <p className="text-xs text-ink-mute px-4">
              Sign in to manage risk strategy & applications.
            </p>

            {/* Connection Status Badge */}
            <div className="mt-2">
              {backendStatus === 'checking' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Checking Connection
                </span>
              ) : backendStatus === 'online' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Server Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Server Offline
                </span>
              )}
            </div>
          </div>

          {/* Connection Error Warning Box */}
          {backendStatus === 'offline' && !error && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl text-xs font-medium mb-6 flex items-start gap-2 animate-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> The admin server is unreachable. Submitting the form will fail until the backend server is started.
              </span>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-xs font-semibold mb-6 animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* User ID Field */}
            <div className="space-y-2">
              <label htmlFor="userId" className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-ink-mute ml-1">
                <User size={12} className="text-gold" />
                Admin ID
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={loading}
                className="w-full h-12 px-4 text-sm bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/20 placeholder:text-ink-mute transition-all shadow-sm text-ink font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter your admin ID"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-ink-mute ml-1">
                <Lock size={12} className="text-gold" />
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full h-12 px-4 text-sm bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/20 placeholder:text-ink-mute transition-all shadow-sm text-ink font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter your password"
                required
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full h-12 rounded-xl text-[11px] font-bold tracking-wider shadow-lg shadow-gold/25 group mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <>Sign In</>
              )}
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold text-ink-mute uppercase tracking-widest opacity-60">
            © 2026 Crednco. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

