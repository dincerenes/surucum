import { formatInt } from '@/lib/format';

export function PageHead({
  title, sub, action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  title, value, note, tone,
}: {
  title: string;
  value: string;
  note?: string;
  tone?: 'positive' | 'negative' | 'warning';
}) {
  const color =
    tone === 'positive' ? 'var(--positive)'
    : tone === 'negative' ? 'var(--negative)'
    : tone === 'warning' ? 'var(--warning)'
    : 'var(--text)';

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <div className="stat-value num" style={{ color }}>{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}

export function Card({
  title, children, action,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card">
      {title || action ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {title ? <h3 className="card-title">{title}</h3> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Badge({
  children, tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function KeyValue({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <dt style={{ color: 'var(--text-soft)' }}>{k}</dt>
          <dd className="num" style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

/**
 * Sütun grafiği — bağımlılıksız, düz SVG.
 *
 * Grafik kütüphanesi eklenmedi: burada çizilen tek şey günlük bir seri ve
 * bunun için 40 satır SVG yeterli. Bir kütüphane, panele yüz kilobayt ve
 * bir sürüm bakım yükü getirirdi.
 *
 * Yükseklik en büyük değere göre ölçekleniyor; tüm değerler sıfırsa
 * çubuklar çizilmiyor (sıfıra bölme yerine boş eksen görünüyor).
 */
export function BarChart({
  points, height = 120, valueLabel,
}: {
  points: { label: string; value: number }[];
  height?: number;
  valueLabel?: (v: number) => string;
}) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const count = Math.max(points.length, 1);

  const gap = 2;
  const slot = 100 / count;
  const barWidth = Math.max(slot - gap, 0.5);

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${points.length} günlük seri, en yüksek değer ${max}`}
      >
        {points.map((p, i) => {
          const h = max > 0 ? (p.value / max) * (height - 14) : 0;
          return (
            <rect
              key={p.label}
              className={p.value > 0 ? 'chart-bar' : 'chart-bar-soft'}
              x={i * slot + gap / 2}
              y={height - 12 - h}
              width={barWidth}
              height={Math.max(h, p.value > 0 ? 1 : 0.5)}
              rx={0.4}
            >
              <title>{`${p.label}: ${valueLabel ? valueLabel(p.value) : formatInt(p.value)}`}</title>
            </rect>
          );
        })}
        <line className="chart-axis" x1="0" y1={height - 12} x2="100" y2={height - 12} />
      </svg>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-faint)',
          marginTop: 4,
        }}
      >
        <span>{points[0]?.label ?? ''}</span>
        <span>en yüksek: {valueLabel ? valueLabel(max) : formatInt(max)}</span>
        <span>{points[points.length - 1]?.label ?? ''}</span>
      </div>
    </div>
  );
}
