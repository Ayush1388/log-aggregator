// The animated pipeline stage. Pure presentation: every number comes from props.
const PATHS = {
  in: 'M170 150 L170 210',
  queue: 'M170 340 L170 400',
  out: 'M170 570 L170 630',
};

const fmt = (n) => Math.round(n).toLocaleString();

function Packets({ path, count, dur, active, color = 'var(--signal)' }) {
  if (!active) return null;
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => (
        <circle
          key={i}
          r="3.5"
          fill={color}
          className="packet"
          style={{
            offsetPath: `path("${path}")`,
            '--dur': `${dur}s`,
            '--delay': `${(i * dur) / count}s`,
          }}
        />
      ))}
    </g>
  );
}

export default function Pipeline({ phase, sent, inFlight, queueCap, batches, persisted, target }) {
  const idle = phase === 'idle';
  const sending = phase === 'sending' || phase === 'storing';
  const storing = phase === 'storing';
  const fill = queueCap ? Math.min(1, inFlight / queueCap) : 0;
  const crates = Math.min(batches, 24);
  const tiles = 20;
  const lit = target ? Math.round((persisted / target) * tiles) : 0;

  const node = (active) => ({
    fill: active ? '#12404b' : '#0e3039',
    stroke: active ? '#f2a93b' : 'var(--stage-line)',
    strokeWidth: active ? 1.5 : 1,
  });

  const Caption = ({ y, title, sub, stat }) => (
    <g>
      <text x="340" y={y} fill="#ffffff" fontSize="22" fontWeight="600" fontFamily="var(--font-display)">{title}</text>
      <text x="340" y={y + 24} fill="#9fc0c9" fontSize="15">{sub}</text>
      <text x="340" y={y + 52} fill="#f2a93b" fontSize="15" fontFamily="var(--font-mono)">{stat}</text>
    </g>
  );

  return (
    <svg viewBox="0 0 640 760" className="w-full h-auto lg:max-h-[calc(100vh-8.5rem)]" role="img"
      aria-label="Pipeline: requests enter the API, wait in a queue, are batched by workers, then written to PostgreSQL">
      {Object.values(PATHS).map((d) => (
        <path key={d} d={d} fill="none" stroke="var(--stage-line)" strokeWidth="1.5" strokeDasharray="3 5" />
      ))}
      <Packets path={PATHS.in} count={5} dur={0.8} active={phase === 'sending'} />
      <Packets path={PATHS.queue} count={5} dur={0.9} active={sending && inFlight > 0} />
      <Packets path={PATHS.out} count={4} dur={1.1} active={storing} color="#8fd0e0" />

      {/* 1. Requests */}
      <rect x="40" y="20" width="260" height="130" rx="16" {...node(phase === 'sending')} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={66 + i * 20} cy="56" r="6"
          fill={phase === 'sending' ? '#f2a93b' : '#2b5d6a'} style={{ transition: 'fill .4s' }} />
      ))}
      <rect x="62" y="82" width="216" height="44" rx="10" fill="#0a252d" stroke="var(--stage-line)" />
      <text x="170" y="110" textAnchor="middle" fill="#cfe3e8" fontSize="15" fontFamily="var(--font-mono)">POST /ingest</text>
      <Caption y={68} title="Requests arrive" sub="100 clients at once" stat={`${fmt(sent)} sent`} />

      {/* 2. Queue */}
      <rect x="40" y="210" width="260" height="130" rx="16" {...node(inFlight > 0)} />
      <text x="62" y="252" fill="#ffffff" fontSize="26" fontWeight="600" fontFamily="var(--font-display)">
        {idle ? '0' : fmt(inFlight)}
      </text>
      <text x="278" y="252" textAnchor="end" fill="#9fc0c9" fontSize="13" fontFamily="var(--font-mono)">of {fmt(queueCap)}</text>
      <rect x="62" y="276" width="216" height="36" rx="8" fill="#082026" stroke="var(--stage-line)" />
      <rect x="62" y="276" width={216 * fill} height="36" rx="8" fill="#f2a93b" fillOpacity="0.9" />
      <Caption y={258} title="Queue absorbs" sub="Bounded Go channel" stat={fill > 0.95 ? 'full, pushing back' : 'waiting in memory'} />

      {/* 3. Workers */}
      <rect x="40" y="400" width="260" height="170" rx="16" {...node(storing)} />
      {[0, 1, 2].map((w) => (
        <g key={w}>
          <rect x="58" y={416 + w * 50} width="224" height="40" rx="8" fill="#0a252d" stroke="var(--stage-line)" />
          <text x="70" y={441 + w * 50} fill="#9fc0c9" fontSize="12" fontFamily="var(--font-mono)">worker {w + 1}</text>
          {Array.from({ length: 8 }).map((_, c) => (
            <rect key={c} x={162 + c * 14} y={426 + w * 50} width="10" height="20" rx="2"
              fill={w * 8 + c < crates ? '#f2a93b' : '#12404b'} style={{ transition: 'fill .2s' }} />
          ))}
        </g>
      ))}
      <Caption y={455} title="Workers batch" sub="100 logs per write" stat={`${fmt(batches)} batches`} />

      {/* 4. PostgreSQL */}
      <rect x="40" y="630" width="260" height="120" rx="16" {...node(storing)} />
      {Array.from({ length: tiles }).map((_, i) => (
        <rect key={i} x={58 + (i % 10) * 22.4} y={652 + Math.floor(i / 10) * 40} width="18" height="30" rx="4"
          fill={i < lit ? '#8fd0e0' : '#12404b'} style={{ transition: 'fill .2s' }} />
      ))}
      <Caption y={662} title="Postgres stores" sub="Monthly partitions" stat={`${fmt(persisted)} stored`} />
    </svg>
  );
}
