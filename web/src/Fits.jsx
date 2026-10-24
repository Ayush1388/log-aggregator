const CASES = [
  {
    title: 'One logging backend for many services',
    how: 'Each service sends JSON to a single endpoint with the included Node SDK. No agent to run on every machine.',
  },
  {
    title: 'Surviving traffic spikes',
    how: 'The queue holds 10,000 logs in memory. When it is full the API answers 503, so clients back off instead of taking the server down.',
  },
  {
    title: 'Searchable without a vendor bill',
    how: 'Arbitrary metadata is stored as JSONB, and logs can be filtered by level and service and paged through in the Logs view.',
  },
  {
    title: 'Retention that costs nothing',
    how: 'Logs live in monthly partitions. Dropping a month older than three months is one instant statement, not millions of deletes.',
  },
];

export default function Fits() {
  return (
    <div className="grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-6 lg:gap-8 items-start">
      <section className="rounded-3xl bg-[var(--surface)] border border-[var(--line)] p-7 sm:p-9">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]"
          style={{ fontVariationSettings: '"wdth" 90' }}>
          Where it fits in a real project
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)] max-w-[40ch]">
          A self-hosted alternative to a hosted logging service, for teams that want to own their data.
        </p>
        <p className="mt-6 text-sm text-[var(--muted)]">Built with Go, PostgreSQL, React and Docker.</p>
      </section>
      <section className="grid sm:grid-cols-2 gap-4">
        {CASES.map((c) => (
          <article key={c.title} className="rounded-3xl bg-[var(--surface)] border border-[var(--line)] p-7">
            <h2 className="font-display text-xl font-semibold leading-snug">{c.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{c.how}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
