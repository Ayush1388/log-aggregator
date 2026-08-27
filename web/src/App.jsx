import React, { useState, useEffect } from 'react';

export default function App() {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('');
  
  // NEW: State to track which row is clicked
  const [expandedIndex, setExpandedIndex] = useState(null);

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
    const interval = setInterval(fetchLogs, 3000);

    return () => clearInterval(interval);
  }, [filterLevel]);

  // NEW: Toggle function for the rows
  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse"></div>
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Log Aggregator Console</h1>
          </div>

          <div className="flex items-center gap-4">
            <select 
              value={filterLevel} 
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none cursor-pointer"
            >
              <option value="">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>

            <div className="text-sm text-zinc-500 border border-zinc-800 rounded-full px-3 py-1 bg-zinc-900/50">
              {logs.length} events
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-8">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-widest text-zinc-500">
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Level</th>
                  <th className="px-6 py-4 font-medium">Service</th>
                  <th className="px-6 py-4 font-medium w-1/2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {logs.map((log, i) => (
                  /* Use React.Fragment so we can return TWO rows per log without breaking the table HTML */
                  <React.Fragment key={i}>
                    {/* Main Row - Now Clickable */}
                    <tr 
                      onClick={() => toggleExpand(i)}
                      className="hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-zinc-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString(undefined, { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                          log.level === 'ERROR' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          log.level === 'WARN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-300">
                        {log.service_id}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {log.message}
                      </td>
                    </tr>

                    {/* Expandable Metadata Row */}
                    {expandedIndex === i && log.metadata && Object.keys(log.metadata).length > 0 && (
                      <tr>
                        {/* colSpan="4" forces this cell to stretch across all 4 columns of the table */}
                        <td colSpan="4" className="p-0 border-t-0">
                          <div className="px-6 py-4 bg-black/40 border-l-2 border-indigo-500">
                            <p className="text-[10px] text-zinc-500 mb-2 font-bold uppercase tracking-widest">
                              Attached Metadata
                            </p>
                            <pre className="text-sm font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.metadata, null, 2)}
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
              <div className="p-12 text-center text-zinc-500 animate-pulse">
                No logs found for this filter.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}