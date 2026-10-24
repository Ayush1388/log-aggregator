import { useState, useCallback } from 'react';
import Demo from './Demo';
import Logs from './Logs';
import Fits from './Fits';

const TABS = [
  ['live', 'Live run'],
  ['logs', 'Logs'],
  ['fits', 'Where it fits'],
];

export default function App() {
  const [tab, setTab] = useState('live');
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('theme') !== 'light'; // dark unless the user chose light
    } catch {
      return true;
    }
  });
  const toggleTheme = () =>
    setIsDark((v) => {
      try {
        localStorage.setItem('theme', v ? 'light' : 'dark');
      } catch {
        /* storage unavailable: the choice just won't persist */
      }
      return !v;
    });
  const [refreshKey, setRefreshKey] = useState(0);
  const onFinished = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] transition-colors">
        <header className="max-w-[1320px] mx-auto px-4 sm:px-8 pt-6 pb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="font-display text-xl font-semibold tracking-tight">Log Aggregator</div>

          <nav aria-label="Views" className="flex rounded-full bg-[var(--surface)] border border-[var(--line)] p-1">
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === id ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}>
                {label}
              </button>
            ))}
          </nav>

          <button onClick={toggleTheme} aria-pressed={isDark}
            className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-1.5 text-sm font-medium hover:border-[var(--ink)] transition">
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
        </header>

        <main className="max-w-[1320px] mx-auto px-4 sm:px-8 pb-12">
          {/* Demo stays mounted so a run keeps going while you look at other views. */}
          <div hidden={tab !== 'live'}><Demo onFinished={onFinished} onSeeFits={() => setTab('fits')} /></div>
          {tab === 'logs' && <Logs refreshKey={refreshKey} />}
          {tab === 'fits' && <Fits />}
        </main>
      </div>
    </div>
  );
}
