interface Props {
  label: string;
  value: number;
  subtext?: string;
  accent?: 'default' | 'green' | 'amber' | 'red';
}

export default function StatCard({ label, value, subtext, accent = 'default' }: Props) {
  const valueClass =
    accent !== 'default' ? `stat-card__value stat-card__value--${accent}` : 'stat-card__value';

  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className={valueClass}>{value}</div>
      {subtext && <div className="stat-card__subtext">{subtext}</div>}
    </div>
  );
}
