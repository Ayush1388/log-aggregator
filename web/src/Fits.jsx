import { useState } from 'react';
import { API_BASE_URL } from './api';

const CASES = [
  ['One logging backend for many services', 'Every service sends JSON to a single endpoint. There is no agent to run on each machine.'],
  ['Surviving traffic spikes', 'A 10,000-log queue absorbs bursts. When it is full the API answers 503, so clients back off instead of taking the server down.'],
  ['Searchable without a vendor bill', 'Metadata is stored as JSONB and logs can be filtered by level and service.'],
  ['Retention that costs nothing', 'Monthly partitions mean old data is dropped in one statement, not millions of deletes.'],
];

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <div className="rounded-2xl bg-[var(--stage)] border border-[var(--stage-line)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--stage-line)]">
        <span className="text-xs text-[var(--s-mid)] font-mono">{label}</span>
        <button onClick={copy} className="text-xs text-[var(--s-hi)] hover:text-white rounded-full border border-[var(--stage-line)] px-3 py-1 transition">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-[var(--s-hi)]"><code>{code}</code></pre>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="relative pl-12 pb-10 last:pb-0 border-l border-[var(--line)] ml-4">
      <span className="absolute -left-4 top-0 h-8 w-8 rounded-full bg-[var(--active-bg)] text-[var(--active-fg)] grid place-items-center text-sm font-semibold">{n}</span>
      <h3 className="font-display text-xl font-semibold leading-8">{title}</h3>
      <div className="mt-2 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">{children}</div>
    </li>
  );
}

export default function Fits() {
  const [lang, setLang] = useState('node');
  const endpoint = `${API_BASE_URL || window.location.origin}/ingest`;

  const nodeCode = `import { Logger } from './logger.js';

const logger = new Logger({
  endpoint: "${endpoint}",
  token: process.env.LOG_TOKEN,
  serviceId: "payment-service",
});

logger.info("Order created", { order_id: 1042 });
logger.warn("Card processor slow", { latency_ms: 840 });
logger.error("Payment failed", { user_id: 88471, retry: 3 });`;

  const curlCode = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $LOG_TOKEN" \\
  -d '{
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "Payment failed",
    "metadata": { "user_id": 88471, "retry": 3 }
  }'`;

  return (
    <div className="grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-6 lg:gap-8 items-start">
      <aside className="rounded-3xl bg-[var(--surface)] border border-[var(--line)] p-7 sm:p-9 lg:sticky lg:top-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight leading-[1.05] text-balance"
          style={{ fontVariationSettings: '"wdth" 90' }}>
          Use it in your project
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
          A self-hosted logging backend for teams that want to own their data.
        </p>
        <ul className="mt-7 space-y-5">
          {CASES.map(([t, d]) => (
            <li key={t}>
              <div className="text-sm font-semibold">{t}</div>
              <div className="text-[13px] leading-snug text-[var(--muted)] mt-0.5">{d}</div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-3xl bg-[var(--surface)] border border-[var(--line)] p-7 sm:p-9">
        <h2 className="font-display text-2xl font-semibold">Quick start</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Five minutes from zero to logs in the dashboard.</p>

        <ol className="mt-8">
          <Step n={1} title="Get an endpoint and a token">
            <p>
              Run your own copy with Docker (<code className="font-mono text-[13px] text-[var(--ink)]">docker compose up --build -d</code>) or
              deploy it to Render. Set <code className="font-mono text-[13px] text-[var(--ink)]">INGEST_TOKEN</code> to a long random string.
              This server's ingest URL is:
            </p>
            <CodeBlock label="endpoint" code={endpoint} />
          </Step>

          <Step n={2} title="Add the client to your app">
            <p>
              For Node.js, copy <code className="font-mono text-[13px] text-[var(--ink)]">sdk/node/logger.js</code> from the repository into your
              project. It has no dependencies. Any other language can call the HTTP endpoint directly.
            </p>
            <CodeBlock label="terminal" code={`curl -O https://raw.githubusercontent.com/Ayush1388/log-aggregator/main/sdk/node/logger.js`} />
          </Step>

          <Step n={3} title="Send your first log">
            <div className="flex gap-1 rounded-full bg-[var(--bg)] p-1 w-fit" role="tablist" aria-label="Language">
              {[['node', 'Node.js'], ['http', 'Any language (HTTP)']].map(([id, label]) => (
                <button key={id} role="tab" aria-selected={lang === id} onClick={() => setLang(id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${lang === id ? 'bg-[var(--active-bg)] text-[var(--active-fg)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                  {label}
                </button>
              ))}
            </div>
            {lang === 'node'
              ? <CodeBlock label="app.js" code={nodeCode} />
              : <CodeBlock label="terminal" code={curlCode} />}
            <p>
              Levels are <code className="font-mono text-[13px] text-[var(--ink)]">ERROR</code>, <code className="font-mono text-[13px] text-[var(--ink)]">WARN</code>,{' '}
              <code className="font-mono text-[13px] text-[var(--ink)]">INFO</code> and <code className="font-mono text-[13px] text-[var(--ink)]">DEBUG</code>.
              Metadata can be any JSON object. The Node client never waits for the network, so logging does not slow your app down.
            </p>
          </Step>

          <Step n={4} title="See it in the dashboard">
            <p>
              Open the Logs view. Your entries appear within a few seconds: logs are written in batches of 100, or every 5 seconds,
              whichever comes first. Filter by level, expand a row to read its metadata.
            </p>
          </Step>

          <Step n={5} title="Handle the edge cases">
            <p>
              A <code className="font-mono text-[13px] text-[var(--ink)]">401</code> means the token is wrong. A{' '}
              <code className="font-mono text-[13px] text-[var(--ink)]">503</code> means the queue is full, so retry after a short pause.
              Logs older than three months are removed automatically.
            </p>
          </Step>
        </ol>
      </section>
    </div>
  );
}
