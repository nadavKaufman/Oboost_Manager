import { Link } from 'react-router-dom';
import '../styles/landing.css';
import '../styles/dashboard.css';

export default function NotFound() {
  return (
    <div className="login-page">
      <div className="login-card not-found-card">
        <div className="login-card__header">
          <h1 className="login-card__title">הדף לא נמצא</h1>
          <p className="login-card__subtitle">
            הדף שחיפשתם אינו קיים או שהוסר.
          </p>
        </div>
        <Link to="/" className="btn-mark-clean">
          → חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
