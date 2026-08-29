import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/landing.css';
import '../styles/dashboard.css';

type Status = 'checking' | 'ready' | 'invalid';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let resolved = false;
    let cancelled = false;

    function markReady() {
      if (resolved) return;
      resolved = true;
      setStatus('ready');
      // Recovery tokens arrive in the URL hash; clear it once the session is
      // established so they don't linger in the address bar or browser history.
      window.history.replaceState(null, '', window.location.pathname);
    }

    // The emailed recovery link always carries `type=recovery` in the URL
    // hash. That — not "a session exists" — is what distinguishes a genuine
    // recovery visit from simply being signed in; an ordinary session must
    // never unlock this form.
    const hasRecoveryHash = window.location.hash.includes('type=recovery');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') {
        markReady();
      }
    });

    if (hasRecoveryHash) {
      // Supabase processes the hash asynchronously on client init. It either
      // fires PASSWORD_RECOVERY (caught above) or, if that event is missed
      // due to a mount-order race, leaves a session behind — check for that
      // as a fallback, but only because a recovery-typed link was already
      // confirmed above.
      supabase.auth.getSession().then(({ data }) => {
        if (!cancelled && data.session) markReady();
      });
    }

    // If neither signal shows up in a reasonable time, this wasn't opened
    // from a valid recovery link. Generous enough to tolerate a slow
    // connection validating the recovery token against Supabase.
    const timeout = setTimeout(() => {
      if (!resolved) setStatus('invalid');
    }, 8000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      if (import.meta.env.DEV) console.error('[oboost] updateUser error:', updateError.message);
      setError('לא ניתן היה לעדכן את הסיסמה. אנא בקשו קישור איפוס חדש ונסו שוב.');
      return;
    }

    setSuccess('הסיסמה עודכנה. מתנתקים…');
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    }, 1500);
  }

  if (status === 'checking') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__header">
            <h1 className="login-card__title">OBoost Manager</h1>
            <p className="login-card__subtitle">מאמתים את קישור האיפוס…</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__header">
            <h1 className="login-card__title">קישור האיפוס אינו תקין</h1>
            <p className="login-card__subtitle">
              קישור איפוס הסיסמה אינו תקין או שפג תוקפו. אנא בקשו קישור חדש מדף ההתחברות.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <h1 className="login-card__title">איפוס הסיסמה</h1>
          <p className="login-card__subtitle">בחרו סיסמה חדשה לחשבון שלכם.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form__field">
            <label className="login-form__label" htmlFor="password">סיסמה חדשה</label>
            <input
              id="password"
              type="password"
              className="login-form__input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              disabled={submitting || !!success}
            />
          </div>
          <div className="login-form__field">
            <label className="login-form__label" htmlFor="confirmPassword">אימות סיסמה</label>
            <input
              id="confirmPassword"
              type="password"
              className="login-form__input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              disabled={submitting || !!success}
            />
          </div>
          {error && <p className="login-form__error">{error}</p>}
          {success && <p className="employee-form__success">{success}</p>}
          <button type="submit" className="login-form__submit" disabled={submitting || !!success}>
            {submitting ? 'שומר…' : 'שמירת סיסמה'}
          </button>
        </form>
      </div>
    </div>
  );
}
