import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { useStore } from './lib/store';
import { Home } from './pages/Home';
import { Learn } from './pages/Learn';
import { Practice } from './pages/Practice';
import { ProgressPage } from './pages/Progress';
import { Review } from './pages/Review';
import { SessionRoute } from './pages/Session';
import { SettingsPage } from './pages/Settings';

/** Applies the chosen theme; "system" leaves it to the OS setting. */
function ThemeSync() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}

export function App() {
  return (
    // Hash routing so the built app works from any static host or sub-path.
    <HashRouter>
      <ThemeSync />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="practice" element={<Practice />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="review/:takeId" element={<Review />} />
          <Route path="learn" element={<Learn />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="session" element={<SessionRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
