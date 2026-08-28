import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8080';
const PAGE_SIZE = 50;

const getBadgeStyles = (level) => {
  switch (level?.toUpperCase()) {
    case 'ERROR':
      return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
    case 'WARN':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
    case 'INFO':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
    case 'DEBUG':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
    default:
      return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-400';
  }
};

export default function App() {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('');
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);

  const [globalStats, setGlobalStats] = useState({
    total: 0,
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');

  const offset = (currentPage - 1) * PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalEvents / PAGE_SIZE));

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setExpandedIndex(null);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });

      if (filterLevel) {
        params.set('level', filterLevel);
      }

      const response = await fetch(
        `${API_BASE_URL}/logs?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      const pageLogs = Array.isArray(data.logs) ? data.logs : [];
      const total = Number(data.total) || 0;
      const stats = data.global_stats || {};

      setLogs(pageLogs);
      setTotalEvents(total);

      setGlobalStats({
        total: Number(stats.total) || 0,
        error: Number(stats.error) || 0,
        warn: Number(stats.warn) || 0,
        info: Number(stats.info) || 0,
        debug: Number(stats.debug) || 0,
      });

      setLastUpdated(new Date());
    } catch (fetchError) {
      console.error('Failed to fetch logs', fetchError);
      setError('Unable to load logs. Make sure the backend is running.');
      setLogs([]);
      setTotalEvents(0);
      setGlobalStats({
        total: 0,
        error: 0,
        warn: 0,
        info: 0,
        debug: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [filterLevel, offset]);

  useEffect(() => {
    fetchLogs();

    if (!isLive) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchLogs, isLive]);

  const handleFilterChange = (level) => {
    setFilterLevel(level);
    setCurrentPage(1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((page) => page + 1);
    }
  };

  const toggleExpand = (index) => {
    setExpandedIndex((current) => (current === index ? null : index));
  };

  const pageStart = totalEvents === 0 ? 0 : offset + 1;
  const pageEnd = totalEvents === 0
    ? 0
    : Math.min(offset + logs.length, totalEvents);

  return (
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className="min-h-screen bg-[#faf9f6] dark:bg-[#121212] text-zinc-800 dark:text-zinc-300 font-sans transition-colors duration-200">

        {/* Header */}
        <header className="px-8 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600"></div>

              <h1 className="text-3xl font-serif text-zinc-800 dark:text-zinc-100 tracking-tight">
                Log Aggregator Console
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLive((value) => !value)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
              >
                {isLive ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000 1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}

                {isLive ? 'Pause' : 'Resume'}
              </button>

              <select
                value={filterLevel}
                onChange={(event) => handleFilterChange(event.target.value)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] outline-none cursor-pointer appearance-none pr-8"
              >
                <option value="">All levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="DEBUG">DEBUG</option>
              </select>

              <button
                onClick={() => setIsDark((value) => !value)}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <svg
                    className="w-5 h-5 text-zinc-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-zinc-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-8 pb-12">

          {/* Global Summary Cards */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-sm">
              <div className="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-500 mb-2">
                TOTAL EVENTS
              </div>

              <div className="text-4xl font-light text-zinc-800 dark:text-zinc-100">
                {globalStats.total.toLocaleString()}
              </div>
            </div>

            {[
              ['ERROR', globalStats.error],
              ['WARN', globalStats.warn],
              ['INFO', globalStats.info],
              ['DEBUG', globalStats.debug],
            ].map(([level, count]) => (
              <div
                key={level}
                className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-sm"
              >
                <div className="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-500 mb-2">
                  {level}
                </div>

                <div className="text-4xl font-light text-zinc-800 dark:text-zinc-100">
                  {count.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Active Filter */}
          {filterLevel && (
            <div className="mb-4 flex items-center justify-between text-sm">
              <div className="text-zinc-500">
                Showing{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {filterLevel}
                </span>{' '}
                events only
              </div>

              <button
                onClick={() => handleFilterChange('')}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-4"
              >
                Clear filter
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Table Container */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-sm overflow-hidden">

            {/* Table Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#18181b]">
              <div>
                <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  Live Stream
                </h2>

                <div className="text-xs text-zinc-400 mt-1">
                  {isLoading
                    ? 'Refreshing...'
                    : lastUpdated
                      ? `Updated ${lastUpdated.toLocaleTimeString()}`
                      : 'Waiting for data'}
                </div>
              </div>

              <div className="text-xs font-mono text-zinc-500 text-right">
                <div>
                  Showing {pageStart > 0 ? `${pageStart}-${pageEnd}` : '0'} of{' '}
                  {totalEvents.toLocaleString()}
                </div>

                <div className="mt-1">
                  Page {currentPage} of {totalPages} •{' '}
                  {isLive ? 'streaming' : 'paused'}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <th className="px-6 py-4 font-medium">Timestamp</th>
                    <th className="px-6 py-4 font-medium">Level</th>
                    <th className="px-6 py-4 font-medium">Service</th>
                    <th className="px-6 py-4 font-medium w-1/2">Message</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {logs.map((log, index) => (
                    <React.Fragment
                      key={`${log.timestamp}-${log.service_id}-${index}`}
                    >
                      <tr
                        onClick={() => toggleExpand(index)}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4 text-sm font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-mono font-bold ${getBadgeStyles(log.level)}`}
                          >
                            {log.level}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-zinc-800 dark:text-zinc-300">
                          {log.service_id}
                        </td>

                        <td className="px-6 py-4 text-sm font-mono text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                          {log.message}
                        </td>
                      </tr>

                      {expandedIndex === index && (
                        <tr>
                          <td
                            colSpan="4"
                            className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t-0"
                          >
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 bg-white dark:bg-[#18181b]">
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-semibold uppercase tracking-widest">
                                Attached Metadata
                              </p>

                              <pre className="font-mono text-sm text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                                {log.metadata &&
                                Object.keys(log.metadata).length > 0
                                  ? JSON.stringify(log.metadata, null, 2)
                                  : JSON.stringify(
                                      { note: 'No metadata attached' },
                                      null,
                                      2
                                    )}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {isLoading && logs.length === 0 && (
                <div className="p-12 text-center text-zinc-500 font-mono">
                  Loading logs...
                </div>
              )}

              {!isLoading && logs.length === 0 && (
                <div className="p-12 text-center text-zinc-500 font-mono">
                  No logs found for this filter.
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#18181b]">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1 || isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Previous
              </button>

              <div className="text-sm font-mono text-zinc-500">
                Page {currentPage} of {totalPages}
              </div>

              <button
                onClick={goToNextPage}
                disabled={currentPage >= totalPages || isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}