import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import '../styles/layout.css';
import '../styles/landing.css';

export default function Landing() {
  return (
    <div className="landing">
      <Header />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__eyebrow">Staff Portal</div>
          <h1 className="hero__title">
            OBoost Operations Portal
          </h1>
          <p className="hero__subtitle">
            The internal portal for OBoost staff. Manage machine assignments,
            track cleaning schedules, monitor maintenance alerts, and coordinate
            your team — all in one place.
          </p>
          <div className="hero__actions">
            <Link to="/dashboard" className="btn-primary">
              Enter Staff Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section className="features" id="about">
        <div className="features__inner">
          <p className="section-label">Portal access</p>
          <h2 className="section-title">Built for OBoost staff</h2>
          <p className="section-subtitle">
            Role-based access for employees, workers, admins, and managers.
            Each role controls what you see and what actions you can take.
          </p>
          <div className="features__grid">
            <div className="feature-card">
              <div className="feature-card__icon">📍</div>
              <h3 className="feature-card__title">Machine Assignments</h3>
              <p className="feature-card__desc">
                Workers and employees see only their assigned machines.
                Admins and managers have full visibility across all OBoost
                stations in Israel.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-card__icon">🗓</div>
              <h3 className="feature-card__title">Cleaning Schedules</h3>
              <p className="feature-card__desc">
                Track 21-day cleaning cycles per machine. Get overdue alerts
                and confirm cleanings with one click — so nothing falls through
                the cracks.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-card__icon">🔑</div>
              <h3 className="feature-card__title">Role-Based Access</h3>
              <p className="feature-card__desc">
                Four roles: employee, worker, admin, manager. Managers assign
                machines to staff. Admins oversee operations. Workers and
                employees handle their assigned stations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">
            <div className="footer__logo">
              <img src="/logos/whitelogo3.png" alt="OBoost" />
            </div>
            <span className="footer__tagline">Internal operations portal</span>
          </div>
          <div className="footer__links">
            <Link to="/dashboard" className="footer__link">Staff Dashboard</Link>
          </div>
          <p className="footer__copy">© 2026 OBoost Ltd. Internal use only.</p>
        </div>
      </footer>
    </div>
  );
}
