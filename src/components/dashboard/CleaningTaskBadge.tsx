import BroomIcon from './BroomIcon';

export default function CleaningTaskBadge() {
  return (
    <span className="status-badge status-badge--task-type">
      <BroomIcon className="status-badge__icon" />
      Cleaning
    </span>
  );
}
