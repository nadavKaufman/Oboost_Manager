import { Link } from 'react-router-dom';
import '../styles/landing.css';
import '../styles/dashboard.css';

export default function NotFound() {
  return (
    <div className="login-page">
      <div className="login-card not-found-card">
        <div className="login-card__header">
          <h1 className="login-card__title">Page not found</h1>
          <p className="login-card__subtitle">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </div>
        <Link to="/" className="btn-mark-clean">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
