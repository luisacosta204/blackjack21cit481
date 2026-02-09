import { Link } from "react-router-dom";

type Props = {
  avatarSrc: string;
  username: string;
  subtitle?: React.ReactNode; // ✅ ADD THIS
  right?: React.ReactNode;
};

export default function HeaderUserNav({ avatarSrc, username, subtitle, right }: Props) {
  return (
    <header className="header">
      <nav className="nav container">
        <div className="left user-info">
          <img id="headerAvatar" src={avatarSrc} alt="User avatar" />

          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span id="headerUsername" className="username">
              {username}
            </span>

            {subtitle && (
              <span className="panel-subtle" style={{ fontSize: "0.9rem" }}>
                {subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="right">{right ?? <DefaultRight />}</div>
      </nav>
    </header>
  );
}

function DefaultRight() {
  return (
    <>
      <Link to="/home" className="btn btn-secondary">
        Home
      </Link>
      <Link to="/leaderboard" className="btn btn-secondary">
        Leaderboards
      </Link>
    </>
  );
}
