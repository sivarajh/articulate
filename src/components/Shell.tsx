import { useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { computeProgress } from '../lib/progress';
import { useStore } from '../lib/store';
import { Icon } from './Icon';

const NAV = [
  { to: '/', label: 'Today', icon: 'sun', end: true },
  { to: '/practice', label: 'Practice', icon: 'mic' },
  { to: '/progress', label: 'Progress', icon: 'trend' },
  { to: '/learn', label: 'Learn', icon: 'book' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
];

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M4 10v4M9.5 6v12M15 9v6M20.5 3v18" />
    </svg>
  );
}

export function Shell() {
  const takes = useStore((s) => s.takes);
  const progress = useMemo(() => computeProgress(takes), [takes]);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="Articulate, home">
          <span className="brand-mark">
            <Mark />
          </span>
          <span className="brand-name">Articulate</span>
        </NavLink>
        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>Level {progress.level.number}</strong>
          {progress.level.name}
          <div
            className="xp-track"
            role="meter"
            aria-label="Progress to the next level"
            aria-valuemin={0}
            aria-valuemax={progress.level.span}
            aria-valuenow={progress.level.into}
          >
            <div className="xp-fill" style={{ width: `${(progress.level.into / progress.level.span) * 100}%` }} />
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <Icon name={item.icon} size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
