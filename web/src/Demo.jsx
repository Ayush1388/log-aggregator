import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './api';
import Pipeline from './Pipeline';

const SIZES = [10000, 15000, 20000];
const fmt = (n) => Math.round(n).toLocaleString();
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const MIN_MS = 4500; // pace the visual; the real run can finish in under a second

export default function Demo({ onFinished, onSeeFits }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(0);
  const [result, setResult] = useState(null);
  const startedAt = useRef(0);
  const statusRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const start = async (count) => {
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/demo/run?count=${count}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      startedAt.current = performance.now();
      setClock(0);
      setStatus(data);
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof TypeError
          ? 'The server is not responding. On the free tier it can take about 30 seconds to wake up. Try again shortly.'
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
      setClock(0);
      onFinished?.();
    } catch {
      setError('Could not clear the demo logs. Check the connection and try again.');
    }
  };

  useEffect(() => {
    if (!busy) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/demo/status`);
        setStatus(await res.json());
      } catch {
        /* keep polling */
      }
    }, 200);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => {
    if (!busy) return undefined;
    let raf;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      const real = statusRef.current;
      const realDone = real?.state === 'done';
      setClock(clamp(elapsed / MIN_MS, 0, realDone ? 1 : 0.9)); // never ahead of the backend
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

  const real = status || {};
  const target = real.target || 0;
  const queueCap = real.queue_cap || 10000;
  const sentShown = Math.min(real.sent ?? 0, target * clamp(clock / 0.55));
  const persistedShown = Math.min(real.persisted ?? 0, target * clamp((clock - 0.3) / 0.7));
  const inFlight = clamp(sentShown - persistedShown, 0, queueCap);
  const batchesShown = Math.floor(persistedShown / 100);

  let phase = 'idle';
  if (busy) phase = persistedShown > 0 ? 'storing' : 'sending';
  else if (result) phase = 'done';

  const headline = result
    ? `${fmt(result.persisted)} of ${fmt(result.target)} stored`
    : busy
      ? `${fmt(persistedShown)} stored so far`
      : 'Every log in. None lost.';

  const sub = result
    ? 'Measured by the server for this run, including the database writes.'
    : busy
      ? phase === 'sending'
        ? 'Requests are arriving and filling the queue.'
        : 'Workers are writing batches to PostgreSQL.'
      : 'A Go pipeline that queues, batches and stores logs in PostgreSQL. Pick a size to run a real load test against this server.';

  return (
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 lg:gap-8 items-start">
      {/* Left: story + controls + result */}
      <section className="rounded-3xl bg-[var(--surface)] border border-[var(--line)] p-7 sm:p-9">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-[var(--ink)] text-balance"
          style={{ fontVariationSettings: '"wdth" 90' }}>
          {headline}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)] max-w-[44ch]">{sub}</p>

        <div className="mt-8 flex flex-wrap gap-2.5" role="group" aria-label="Choose how many logs to send">
          {SIZES.map((n) => (
            <button
              key={n}
              onClick={() => start(n)}
              disabled={busy}
              className="rounded-full bg-[var(--petrol)] text-[var(--on-accent)] px-6 py-3 text-sm font-semibold hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Send {fmt(n)} logs
            </button>
          ))}
        </div>
        <button
          onClick={clear}
          disabled={busy}
          className="mt-3 text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)] disabled:opacity-40"
        >
          Clear demo logs
        </button>

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-[var(--lvl-error)]/40 bg-[var(--lvl-error)]/10 px-4 py-3 text-sm text-[var(--lvl-error)]">
            {error}
          </p>
        )}

        {result && !busy && (
          <div className="rise mt-9 pt-7 border-t border-[var(--line)]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
              <Metric label="Logs per second" value={fmt(result.ingest_rps)}
                note={`${fmt(result.accepted)} accepted in ${(result.ingest_ms / 1000).toFixed(2)} s`} />
              <Metric label="Logs lost" value={fmt(result.target - result.persisted)}
                note="Every accepted log reached PostgreSQL" />
              <Metric label="Database writes" value={fmt(result.batches)}
                note={`instead of ${fmt(result.accepted)} single inserts`} />
              <Metric label="Queue pushbacks" value={fmt(result.backpressure)}
                note={result.backpressure ? 'Full queue returned 503, clients retried' : 'The queue never filled up'} />
            </dl>
            {result.error && <p className="mt-4 text-sm text-[var(--lvl-warn)]">{result.error}</p>}
            <button onClick={onSeeFits}
              className="mt-8 rounded-full border border-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--active-bg)] hover:text-[var(--active-fg)] transition">
              See where this fits
            </button>
          </div>
        )}
      </section>

      {/* Right: the pipeline stage */}
      <section className="rounded-3xl bg-[var(--stage)] p-5 sm:p-8 border border-[var(--stage-line)] overflow-hidden lg:sticky lg:top-4">
        <Pipeline
          phase={phase === 'done' ? 'done' : phase}
          sent={phase === 'done' ? result.accepted : sentShown}
          inFlight={phase === 'done' ? 0 : inFlight}
          queueCap={queueCap}
          batches={phase === 'done' ? result.batches : batchesShown}
          persisted={phase === 'done' ? result.persisted : persistedShown}
          target={target}
        />
        <p className="mt-3 text-xs text-[var(--s-mid)] max-w-[60ch]">
          Counts come from the server. The animation is slowed so you can follow it, and it never shows more than was processed.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value, note }) {
  return (
    <div>
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)] mt-1">{value}</dd>
      <p className="text-[13px] leading-snug text-[var(--muted)] mt-1">{note}</p>
    </div>
  );
}
