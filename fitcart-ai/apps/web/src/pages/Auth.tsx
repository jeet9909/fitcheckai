import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAppState } from '../state/AppState';

/**
 * The only auth surface in the product. Reached from "Save" on /result and
 * /saved (empty state), and from <PaywallSheet>'s plan selection — never a
 * hard entry gate on /. Bounces back to `?redirect=` on success.
 */
export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showToast } = useAppState();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const redirectTo = params.get('redirect') || '/saved';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      showToast('Sign-in isn’t connected yet — backend coming soon');
      return;
    }
    setBusy(true);
    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      showToast(error.message);
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  const handleGoogle = async () => {
    if (!supabase) {
      showToast('Sign-in isn’t connected yet — backend coming soon');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + redirectTo },
    });
  };

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '64px 28px 100px' }}>
      <div className="fc-chip" style={{ background: 'var(--teal-soft)', color: 'var(--teal)', marginBottom: 18 }}>
        Used only to save your looks and manage your plan
      </div>
      <h1 className="display" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 28px' }}>
        {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ background: 'none', border: 'none', color: 'var(--accent-dark)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', padding: 0 }}
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>

      {!isSupabaseConfigured && (
        <div style={{ background: 'var(--amber-soft)', color: 'var(--amber-text)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, marginBottom: 20 }}>
          Auth backend isn’t connected yet in this deploy — form is wired but inert.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '13px 14px', fontSize: 14, outline: 'none', background: 'var(--surface)' }}
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '13px 14px', fontSize: 14, outline: 'none', background: 'var(--surface)' }}
        />
        <button type="submit" className="fc-btn-primary" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', color: 'var(--ink-faint)', fontSize: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        or
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <button onClick={handleGoogle} className="fc-btn-secondary">
        Continue with Google
      </button>
    </main>
  );
}
