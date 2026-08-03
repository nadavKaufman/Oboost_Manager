interface Props {
  className?: string;
}

// Shared broom glyph for anything cleaning-related — the cleaning-status
// badge (Clean / Clean Due / Overdue) and the task-type "Cleaning" badge.
// Single source of truth for the path data so both call sites stay in sync.
export default function BroomIcon({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13 2L7.6 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.9 7.3L8.3 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.8 7L8.4 8L9.6 14.6L2.2 13.4Z" fill="currentColor" />
    </svg>
  );
}
