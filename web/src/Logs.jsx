import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from './api';

const PAGE_SIZE = 50;
const LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
const levelColor = (l) => `var(--lvl-${(l || 'debug').toLowerCase()})`;
const EMPTY_STATS = { total: 0, error: 0, warn: 0, info: 0, debug: 0 };

export default function Logs({ refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState('');

  const offset = (page - 1) * PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    setExpanded(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (filterLevel) params.set('level', filterLevel);
      const res = await fetch(`${API_BASE_URL}/logs?${params}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const s = data.global_stats || {};
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(Number(data.total) || 0);
      setStats({
        total: Number(s.total) || 0,
        error: Number(s.error) || 0,
        warn: Number(s.warn) || 0,
        info: Number(s.info) || 0,
        debug: Number(s.debug) || 0,
      });
      setUpdated(new Date());
    } catch {
      setError('Could not load logs. The server may be waking up; try again in a few seconds.');
      setLogs([]);
      setTotal(0);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, [filterLevel, offset]);

  useEffect(() => {
    fetchLogs();
    if (!isLive) return undefined;
    const id = setInterval(fetchLogs, 2000);
    return () => clearInterval(id);
  }, [fetchLogs, isLive, refreshKey]);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = total === 0 ? 0 : Math.min(offset + logs.length, total);
  const btn =
    'rounded-full border border-[var(--line)] bg-[var(--raised)] px-4 py-2 text-sm font-medium hover:border-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed transition';

  return (
    <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] gap-6 lg:gap-8 items-start">
      {/* Left rail: totals and filters */}
      <aside className="rounded-3xl bg-[var(--surface)] border border-[var(--line)] p-7">
        <div className="text-sm text-[var(--muted)]">Stored in PostgreSQL</div>
        <div className="font-display text-5xl font-semibold tracking-tight mt-1">{stats.total.toLocaleString()}</div>

        <div className="mt-6 text-sm text-[var(--muted)] mb-2">Filter by level</div>
        <div className="flex flex-col gap-1.5">
          <button onClick={() => { setFilterLevel(''); setPage(1); }}
            aria-pressed={filterLevel === ''}
            className={`flex justify-between rounded-xl px-3 py-2 text-sm text-left transition ${filterLevel === '' ? 'bg-[var(--ink)] text-[var(--surface)]' : 'hover:bg-[var(--bg)]'}`}>
            <span>All levels</span><span className="font-mono">{stats.total.toLocaleString()}</span>
          </button>
          {LEVELS.map((l) => (
            <button key={l} onClick={() => { setFilterLevel(l); setPage(1); }}
              aria-pressed={filterLevel === l}
              className={`flex justify-between items-center rounded-xl px-3 py-2 text-sm text-left transition ${filterLevel === l ? 'bg-[var(--ink)] text-[var(--surface)]' : 'hover:bg-[var(--bg)]'}`}>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: levelColor(l) }} />{l}
              </span>
              <span className="font-mono">{stats[l.toLowerCase()].toLocaleString()}</span>
            </button>
          ))}
        </div>

        <button onClick={() => setIsLive((v) => !v)} aria-pressed={isLive} className={`${btn} mt-6 w-full`}>
          {isLive ? 'Pause live refresh' : 'Start live refresh'}
        </button>
      </aside>

      {/* Table */}
      <section className="rounded-3xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden">
        <div className="flex flex-wrap justify-between gap-2 px-6 py-4 border-b border-[var(--line)] text-sm text-[var(--muted)]">
          <span>{loading ? 'Refreshing' : updated ? `Updated ${updated.toLocaleTimeString()}` : 'Waiting for data'}</span>
          <span className="font-mono">
            {pageStart > 0 ? `${pageStart}–${pageEnd}` : '0'} of {total.toLocaleString()}
          </span>
        </div>

        {error && <p role="alert" className="m-6 rounded-xl border border-[var(--lvl-error)]/40 bg-[var(--lvl-error)]/10 px-4 py-3 text-sm text-[var(--lvl-error)]">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-[var(--muted)] border-b border-[var(--line)]">
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-3 py-3 font-medium">Level</th>
                <th className="px-3 py-3 font-medium">Service</th>
                <th className="px-6 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <React.Fragment key={`${log.timestamp}-${log.service_id}-${i}`}>
                  <tr onClick={() => setExpanded(expanded === i ? null : i)}
                    className="border-b border-[var(--line)]/60 hover:bg-[var(--bg)] cursor-pointer transition-colors">
                    <td className="px-6 py-3 font-mono text-[13px] text-[var(--muted)] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('en-GB')}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: levelColor(log.level) }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: levelColor(log.level) }} />{log.level}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">{log.service_id}</td>
                    <td className="px-6 py-3 font-mono text-[13px]">{log.message}</td>
                  </tr>
                  {expanded === i && (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 bg-[var(--bg)]">
                        <pre className="font-mono text-[13px] whitespace-pre-wrap overflow-x-auto">
                          {log.metadata && Object.keys(log.metadata).length
                            ? JSON.stringify(log.metadata, null, 2)
                            : 'No metadata attached'}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {!loading && logs.length === 0 && !error && (
            <p className="p-12 text-center text-[var(--muted)]">
              No logs yet. Run a test in the Live run view and they will appear here.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--line)]">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className={btn}>Previous</button>
          <span className="text-sm font-mono text-[var(--muted)]">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className={btn}>Next</button>
        </div>
      </section>
    </div>
  );
}
