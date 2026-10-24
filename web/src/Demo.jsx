import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './api';

const SIZES = [10000, 15000, 20000];
const fmt = (n) => Math.round(n).toLocaleString();
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Four plain-language steps, shown as the pipeline.
const STEPS = [
  { key: 'send', title: 'Fire requests', sub: '100 parallel clients', icon: '⚡' },
  { key: 'queue', title: 'Buffer in memory', sub: 'Go channel, 10k slots', icon: '📥' },
  { key: 'batch', title: 'Batch by 100', sub: '3 worker goroutines', icon: '📦' },
  { key: 'store', title: 'Bulk insert', sub: 'PostgreSQL partitions', icon: '🗄️' },
];

const USE_CASES = [
  ['Central logging for microservices', 'Every service POSTs JSON to one endpoint instead of running its own log stack.'],
  ['Traffic-spike absorption', 'The bounded queue soaks up bursts; when full it returns 503 so clients back off instead of crashing the server.'],
  ['Cheap, self-hosted observability', 'JSONB metadata + level/service filters give a Datadog-style search without the bill.'],
  ['Automatic retention', 'Monthly partitions are dropped after 3 months, so old data is deleted instantly, not row by row.'],
];

export default function Demo({ onFinished }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(0); // 0..1 animation progress
  const [result, setResult] = useState(null);
  const startedAt = useRef(0);
  const statusRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const running = busy || status?.state === 'running' || status?.state === 'draining';

  const start = async (count) => {
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/demo/run?count=${count}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      startedAt.current = performance.now();
      setStatus(data);
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof TypeError
          ? 'Cannot reach the backend. If it is hosted on a free tier it may be waking up, so retry in ~30s.'
          : e.message
      );
    }
  };

  const clear = async () => {
    setError('');
    try {
      await fetch(`${API_BASE_URL}/demo/clear`, { method: 'POST' });
      setResult(null);
      setStatus(null);
      onFinished?.();
    } catch {
      setError('Could not clear demo logs.');
    }
  };

  // Poll real progress from the backend while a run is active.
  useEffect(() => {
    if (!busy) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/demo/status`);
        const data = await res.json();
        setStatus(data);
      } catch {
        /* keep polling */
      }
    }, 200);
    return () => clearInterval(id);
  }, [busy]);

  // The real run can finish in under a second, so pace the visual to at least
  // MIN_MS. All numbers shown are capped by what the backend actually reported.
  const MIN_MS = 4500;
  useEffect(() => {
    if (!busy) return undefined;
    let raf;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      const real = statusRef.current;
      const realDone = real?.state === 'done';
      // Never run ahead of reality: hold at 0.9 until the backend is done.
      const cap = realDone ? 1 : 0.9;
      setClock(clamp(elapsed / MIN_MS, 0, cap));
      if (realDone && elapsed >= MIN_MS) {
        setBusy(false);
        setResult(real);
        onFinished?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [busy, onFinished]);

  const target = status?.target || 0;
  const real = status || {};
  // Each stage starts a little after the previous one.
  const sentFrac = clamp(clock / 0.55);
  const queueFrac = clamp((clock - 0.05) / 0.55);
  const storeFrac = clamp((clock - 0.3) / 0.7);
  const sentShown = Math.min(real.sent ?? 0, target * sentFrac);
  const persistedShown = Math.min(real.persisted ?? 0, target * storeFrac);
  const inFlight = clamp(sentShown - persistedShown, 0, real.queue_cap || 10000);
  const queueFill = target ? clamp(inFlight / (real.queue_cap || 10000)) : 0;
  const batchesShown = Math.floor(persistedShown / 100);

  const stage = !running ? -1 : storeFrac > 0 ? 3 : queueFrac > 0.15 ? 2 : sentFrac > 0 ? 1 : 0;
  const activeStage = running ? Math.max(stage, 0) : -1;

  const resetIdle = !running && !result;

  const dbCallsSaved = result ? Math.round(result.accepted / Math.max(result.batches, 1)) : 0;

  return (
    <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-200 shadow-xl overflow-hidden">
      <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-zinc-800/80">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold tracking-[0.2em] text-emerald-400 mb-2">LIVE LOAD TEST</div>
            <h2 className="text-2xl sm:text-3xl font-serif text-white tracking-tight">
              Watch it swallow thousands of logs
            </h2>
            <p className="text-sm text-zinc-400 mt-2">
              A Go ingestion pipeline that accepts logs fast, batches them, and stores them safely.
              Pick a size: the server sends real HTTP requests to its own <code className="text-zinc-300">/ingest</code> endpoint.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SIZES.map((n) => (
              <button
                key={n}
                onClick={() => start(n)}
                disabled={running}
                className="px-5 py-3 rounded-xl bg-emerald-500 text-zinc-950 font-semibold text-sm hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Send {n / 1000}K logs
              </button>
            ))}
            <button
              onClick={clear}
              disabled={running}
              className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-white hover:border-zinc-500 disabled:opacity-40 transition"
            >
              Clear demo data
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Pipeline animation */}
      <div className="px-6 sm:px-8 py-8">
        <ol className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-3 md:gap-0">
          {STEPS.map((s, i) => {
            const lit = activeStage === i || (result && !running);
            const done = running ? i < activeStage : !!result;
            return (
              <FragmentWithArrow key={s.key} showArrow={i < STEPS.length - 1} flowing={running && activeStage > i - 0.01 && activeStage >= i}>
                <li
                  className={`relative rounded-xl border px-4 py-4 transition-all duration-500 ${
                    lit
                      ? 'border-emerald-500/70 bg-emerald-500/10 shadow-[0_0_30px_-8px_rgba(16,185,129,0.6)]'
                      : done
                        ? 'border-emerald-900 bg-zinc-900'
                        : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 text-lg">
                    <span className={lit && running ? 'animate-bounce' : ''}>{s.icon}</span>
                    <span className="text-xs font-mono text-zinc-500">0{i + 1}</span>
                  </div>
                  <div className="mt-2 font-semibold text-white text-sm">{s.title}</div>
                  <div className="text-xs text-zinc-400">{s.sub}</div>

                  <div className="mt-3 font-mono text-lg text-emerald-300 min-h-[1.75rem]">
                    {i === 0 && (resetIdle ? '—' : `${fmt(sentShown)}`)}
                    {i === 1 && (resetIdle ? '—' : `${fmt(inFlight)} waiting`)}
                    {i === 2 && (resetIdle ? '—' : `${fmt(batchesShown)} batches`)}
                    {i === 3 && (resetIdle ? '—' : `${fmt(persistedShown)} saved`)}
                  </div>
                  {i === 1 && (
                    <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden" aria-label="Queue fill">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-[width] duration-150"
                        style={{ width: `${queueFill * 100}%` }}
                      />
                    </div>
                  )}
                </li>
              </FragmentWithArrow>
            );
          })}
        </ol>

        <div className="mt-6">
          <div className="flex justify-between text-xs font-mono text-zinc-500 mb-1">
            <span>
              {running
                ? activeStage < 3
                  ? 'Ingesting…'
                  : 'Writing to PostgreSQL…'
                : result
                  ? 'Done'
                  : 'Ready'}
            </span>
            <span>{target ? `${fmt(persistedShown)} / ${fmt(target)}` : ''}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-150"
              style={{ width: `${target ? (persistedShown / target) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Result: the selling point */}
      {result && !running && (
        <div className="px-6 sm:px-8 pb-8 animate-[fadeUp_0.6s_ease-out]">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
            <div className="text-xs font-semibold tracking-[0.2em] text-emerald-400 mb-3">RESULT</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Metric label="Ingest throughput" value={`${fmt(result.ingest_rps)}/s`} hint={`${fmt(result.accepted)} logs in ${(result.ingest_ms / 1000).toFixed(2)}s`} />
              <Metric label="Logs lost" value={fmt(result.target - result.persisted)} hint={`${fmt(result.persisted)} of ${fmt(result.target)} stored`} />
              <Metric label="DB round trips" value={fmt(result.batches)} hint={`~${dbCallsSaved}× fewer than one insert per log`} />
              <Metric label="Backpressure hits" value={fmt(result.backpressure)} hint={result.backpressure ? 'queue filled, clients retried' : 'queue never filled'} />
            </div>
            {result.error && <p className="mt-4 text-sm text-amber-300">{result.error}</p>}
            <p className="mt-4 text-xs text-zinc-500">
              Numbers are measured by the backend during this run (end-to-end, including the database).
              The animation is paced for visibility; it never shows more than was really processed.
            </p>
          </div>

          <h3 className="mt-8 mb-3 text-sm font-semibold tracking-widest text-zinc-400">WHERE YOU WOULD USE THIS</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {USE_CASES.map(([t, d]) => (
              <div key={t} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-sm font-semibold text-white">{t}</div>
                <div className="text-sm text-zinc-400 mt-1">{d}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            Scroll down: the dashboard below now shows those logs, filterable by level and paginated.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-2xl sm:text-3xl font-light text-white font-mono">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{hint}</div>
    </div>
  );
}

// Renders a step followed by an animated arrow (horizontal on desktop).
function FragmentWithArrow({ children, showArrow, flowing }) {
  return (
    <>
      {children}
      {showArrow && (
        <div className="hidden md:flex items-center justify-center w-12" aria-hidden="true">
          <div className="relative h-0.5 w-full bg-zinc-800 overflow-hidden rounded">
            {flowing && <div className="absolute inset-y-0 w-1/2 bg-emerald-400 animate-[flow_0.7s_linear_infinite]" />}
          </div>
        </div>
      )}
    </>
  );
}
