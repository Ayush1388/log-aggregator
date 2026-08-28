import React, { useState, useEffect, useMemo } from 'react';

const getBadgeStyles = (level) => {
  switch (level?.toUpperCase()) {
    case 'ERROR': return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
    case 'WARN': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
    case 'INFO': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
    case 'DEBUG': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
    default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-400';
  }
};

export default function App() {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('');
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isDark, setIsDark] = useState(false); // Default to light mode

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const url = filterLevel 
          ? `http://localhost:8080/logs?level=${filterLevel}` 
          : 'http://localhost:8080/logs';

        const response = await fetch(url);
        const data = await response.json();
        setLogs(data || []);
      } catch (error) {
        console.error("Failed to fetch logs", error);
      }
    };

    fetchLogs();
    
    let interval;
    if (isLive) {
      interval = setInterval(() => {
        fetchLogs();
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [filterLevel, isLive]);

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Calculate stats for the top cards
  const stats = useMemo(() => {
    const counts = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
    logs.forEach(log => {
      if (counts[log.level] !== undefined) counts[log.level]++;
    });
    return counts;
  }, [logs]);

  return (
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className="min-h-screen bg-[#faf9f6] dark:bg-[#121212] text-zinc-800 dark:text-zinc-300 font-sans transition-colors duration-200">
        
        {/* Header */}
        <header className="px-8 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600"></div>
              <h1 className="text-3xl font-serif text-zinc-800 dark:text-zinc-100 tracking-tight">Log Aggregator Console</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLive(!isLive)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
              >
                {isLive ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                )}
                {isLive ? 'Pause' : 'Resume'}
              </button>

              <select 
                value={filterLevel} 
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] outline-none cursor-pointer appearance-none pr-8"
              >
                <option value="">All levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="DEBUG">DEBUG</option>
              </select>

              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
              >
                {isDark ? (
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                ) : (
                  <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-8 pb-12">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {['ERROR', 'WARN', 'INFO', 'DEBUG'].map((level) => (
              <div key={level} className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-sm">
                <div className="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-500 mb-2">{level}</div>
                <div className="text-4xl font-light text-zinc-800 dark:text-zinc-100">{stats[level]}</div>
              </div>
            ))}
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-sm overflow-hidden">
            
            {/* Table Header Row */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#18181b]">
              <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Live Stream</h2>
              <div className="text-xs font-mono text-zinc-500">
                {logs.length} events • {isLive ? 'streaming' : 'paused'}
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
                  {logs.map((log, i) => (
                    <React.Fragment key={i}>
                      <tr 
                        onClick={() => toggleExpand(i)}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4 text-sm font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-GB', { 
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-mono font-bold ${getBadgeStyles(log.level)}`}>
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

                      {expandedIndex === i && (
                        <tr>
                          <td colSpan="4" className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t-0">
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 bg-white dark:bg-[#18181b]">
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-semibold uppercase tracking-widest">
                                Attached Metadata
                              </p>
                              <pre className="font-mono text-sm text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                                {log.metadata && Object.keys(log.metadata).length > 0 
                                  ? JSON.stringify(log.metadata, null, 2) 
                                  : JSON.stringify({ note: "No metadata attached" }, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              
              {logs.length === 0 && (
                <div className="p-12 text-center text-zinc-500 animate-pulse font-mono">
                  No logs found for this filter.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}