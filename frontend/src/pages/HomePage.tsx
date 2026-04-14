import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import CenteredMain from "../components/CenteredMain";
import { chipUrlForBank } from "../utils/chips";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, loading } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");

  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);
  const bankValue = user?.credits ?? 0;

  const onLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  return (
    <>
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <span
            id="bankBadge"
            aria-label={`Bank: ${bankValue} chips`}
            style={{ ["--bank-chip-url" as string]: `url("${chipUrlForBank(bankValue)}")` }}
          >
            {bankValue}
          </span>
        }
        right={
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Link to="/profile" className="btn btn-secondary">
              Profile
            </Link>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={onLogout}
              disabled={loading && !!localStorage.getItem("token")}
              title={user ? "Logout" : "Guest mode"}
            >
              Logout
            </button>
          </div>
        }
      />

      <CenteredMain maxWidth={900}>
        <div style={{ textAlign: "center" }}>
          <h2 className="panel-header">Welcome to the Casino Lobby</h2>
          <p className="panel-subtle">Choose a game mode or view your stats below.</p>

          <div
            className="grid cols-2"
            style={{ maxWidth: 720, marginTop: "2rem", marginInline: "auto" }}
          >
            <Link to="/blackjack" className="btn">
              🂡 Play Blackjack
            </Link>

            <Link to="/slots" className="btn">
              🎰 Play Slots
            </Link>

            <Link to="/craps" className="btn">
              🎲 Play Craps
            </Link>

            <Link to="/roulette" className="btn">
              🎯 Play Roulette
            </Link>
          </div>

          <div className="stack mt-8" style={{ maxWidth: 400, marginInline: "auto" }}>
            <Link to="/leaderboard" className="btn btn-ghost">
              View Leaderboards
            </Link>
            <Link to="/profile" className="btn btn-ghost">
              View Profile
            </Link>
          </div>
        </div>
      </CenteredMain>
    </>
  );
}