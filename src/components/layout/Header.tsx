import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  function close() {
    setMenuOpen(false);
  }

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__logo">
          <img src="/logos/oboostlogoblack.png" alt="OBoost" />
        </Link>

        <nav className="header__nav" aria-label="Main navigation">
          <a href="#about" className="header__nav-link">About</a>
          <Link to="/dashboard" className="header__cta">
            Staff Dashboard →
          </Link>
        </nav>

        <button
          className={`header__hamburger${menuOpen ? ' open' : ''}`}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav
        className={`header__mobile-nav${menuOpen ? ' open' : ''}`}
        aria-hidden={!menuOpen}
        aria-label="Mobile navigation"
      >
        <a href="#about" onClick={close}>About</a>
        <Link to="/dashboard" className="header__mobile-cta" onClick={close}>
          Staff Dashboard →
        </Link>
      </nav>
    </header>
  );
}
