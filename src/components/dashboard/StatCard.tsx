interface Props {
  label: string;
  value: number;
  subtext?: string;
  accent?: 'default' | 'green' | 'amber' | 'red';
  size?: 'md' | 'lg';
  /** Extra class(es) merged onto the root `.stat-card` element — used on the
   *  Overview page to gate individual cards to a specific breakpoint (see
   *  `.overview-critical__mobile-only` / `__desktop-only` in dashboard.css). */
  className?: string;
}

export default function StatCard({ label, value, subtext, accent = 'default', size = 'md', className }: Props) {
  const valueClass =
    accent !== 'default' ? `stat-card__value stat-card__value--${accent}` : 'stat-card__value';
  const cardClass = [size === 'lg' ? 'stat-card stat-card--lg' : 'stat-card', className]
    .filter(Boolean)
    .join(' ');
  const showDot = size === 'lg' && accent !== 'default';

  return (
    <div className={cardClass}>
      <div className="stat-card__label-row">
        {showDot && <span className={`stat-card__dot stat-card__dot--${accent}`} />}
        <span className="stat-card__label">{label}</span>
      </div>
      <div className={valueClass}>{value}</div>
      {subtext && <div className="stat-card__subtext">{subtext}</div>}
    </div>
  );
}
