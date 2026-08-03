interface Props {
  className?: string;
}

// Simple flat vending-machine glyph, reused for the sidebar nav icon and
// as the Machines-list thumbnail placeholder. Uses currentColor so it
// inherits whatever text color its container sets (hover/active/dark-mode/
// accent overrides all just work via CSS `color`).
export default function MachineIcon({ className }: Props) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="1.25" width="10" height="13.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="5" y="3.25" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="6.2" cy="10.4" r="0.85" fill="currentColor" />
      <circle cx="9.8" cy="10.4" r="0.85" fill="currentColor" />
      <rect x="5.5" y="12.2" width="5" height="1.2" rx="0.4" fill="currentColor" />
    </svg>
  );
}
