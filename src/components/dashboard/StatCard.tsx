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
  /** Optional icon (transparent-background PNG) shown directly on the
   *  card, on the opposite side from the label/value — the Overview
   *  cleaning-status cards. No colored square/background behind it: the
   *  icon sits plainly on the card, which itself gets a very soft
   *  orange-to-white gradient wash (see .stat-card--tinted). A card with
   *  an icon also drops the colored edge/border accent and the small
   *  accent dot. Omitted by default, in which case the card renders
   *  exactly as it always has. */
  iconSrc?: string;
  iconAlt?: string;
}

export default function StatCard({ label, value, subtext, accent = 'default', size = 'md', className, iconSrc, iconAlt }: Props) {
  const cardClass = [
    size === 'lg' ? 'stat-card stat-card--lg' : 'stat-card',
    !iconSrc && accent !== 'default' && `stat-card--${accent}`,
    iconSrc && 'stat-card--tinted',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass}>
      <div className="stat-card__content">
        <div className="stat-card__label-row">
          {!iconSrc && accent !== 'default' && <span className={`stat-card__dot stat-card__dot--${accent}`} />}
          <span className="stat-card__label">{label}</span>
        </div>
        <div className="stat-card__value">{value}</div>
        {subtext && <div className="stat-card__subtext">{subtext}</div>}
      </div>
      {iconSrc && (
        <span className="stat-card__icon">
          <img src={iconSrc} alt={iconAlt ?? ''} className="stat-card__icon-img" />
        </span>
      )}
    </div>
  );
}
