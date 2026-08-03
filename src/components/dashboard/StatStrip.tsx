interface StatStripItem {
  key: string;
  label: string;
  value: number;
  subtext?: string;
}

interface Props {
  items: StatStripItem[];
}

/** Compact, low-emphasis row of reference numbers (e.g. Active Machines,
 *  Orange Stock) — grouped as dense mini-stats rather than full StatCards,
 *  since these are routine figures that don't need heavy visual weight. */
export default function StatStrip({ items }: Props) {
  return (
    <div className="stat-strip">
      {items.map(item => (
        <div className="stat-strip__item" data-key={item.key} key={item.key}>
          <div className="stat-strip__value">{item.value}</div>
          <div className="stat-strip__label">{item.label}</div>
          {item.subtext && <div className="stat-strip__subtext">{item.subtext}</div>}
        </div>
      ))}
    </div>
  );
}
