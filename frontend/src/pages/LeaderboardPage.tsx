import CenteredMain from "../components/CenteredMain";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import { useMemo } from "react";
import { Link } from "react-router-dom";

export default function LeaderboardPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);

  return (
    <>
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <>
            Credits: <strong>{user ? user.credits : "—"}</strong>
          </>
        }
        right={
          <>
            <Link to="/home" className="btn btn-secondary">
              Home
            </Link>
          </>
        }
      />

      <CenteredMain maxWidth={1200}>
        <section className="panel stack">
          <h2 className="panel-header">Leaderboard</h2>
          <p className="panel-subtle">Placeholder. Next step: real leaderboard from DB.</p>
        </section>
      </CenteredMain>
    </>
  );
}
