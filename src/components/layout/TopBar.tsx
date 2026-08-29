interface Props {
  title: string;
  userName: string;
  onMenuClick: () => void;
}

export default function TopBar({
  title,
  userName,
  onMenuClick,
}: Props) {
  return (
    <div className="topbar">
      <div className="topbar__left">
        <button
          className="topbar__hamburger"
          aria-label="פתיחת תפריט צד"
          onClick={onMenuClick}
        >
          <span />
          <span />
          <span />
        </button>
        <h1 className="topbar__title">{title}</h1>
      </div>

      <div className="topbar__right">
        {userName && <span className="topbar__user-name">{userName}</span>}
      </div>
    </div>
  );
}
