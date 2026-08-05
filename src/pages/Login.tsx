import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/landing.css';
import '../styles/dashboard.css';

const RESET_PASSWORD_REDIRECT_URL = 'https://oboost-manager.netlify.app/reset-password';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setSubmitting(false);
      if (import.meta.env.DEV && error) console.error('[oboost] login error:', error.message);
      setError('Incorrect email or password. Please try again.');
      return;
    }

    // Resolve the role directly so we land on the right home page immediately,
    // instead of always hitting the manager-only route first and bouncing.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();
    setSubmitting(false);
    navigate(profileRow?.role === 'manager' || profileRow?.role === 'preview' ? '/dashboard' : '/my-machines');
  }

  async function handleForgotPassword() {
    setForgotMessage(null);
    if (!email) {
      setForgotMessage('Enter your email above first.');
      return;
    }
    setForgotSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_PASSWORD_REDIRECT_URL,
    });
    setForgotSubmitting(false);
    if (resetError && import.meta.env.DEV) console.error('[oboost] resetPasswordForEmail error:', resetError.message);
    // Same message regardless of outcome, so the response never reveals
    // whether an account exists for this email.
    setForgotMessage('If an account exists for that email, a password reset link has been sent.');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <h1 className="login-card__title">OBoost Manager</h1>
          <p className="login-card__subtitle">Sign in to continue</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form__field">
            <label className="login-form__label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="login-form__input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="login-form__field">
            <label className="login-form__label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="login-form__input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="login-form__error">{error}</p>}
          <button type="submit" className="login-form__submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="login-form__link-btn"
            onClick={handleForgotPassword}
            disabled={forgotSubmitting}
          >
            {forgotSubmitting ? 'Sending…' : 'Forgot password?'}
          </button>
          {forgotMessage && <p className="employee-form__success">{forgotMessage}</p>}
        </form>
      </div>
    </div>
  );
}
