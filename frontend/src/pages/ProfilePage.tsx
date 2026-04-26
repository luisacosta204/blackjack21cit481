import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AvatarPicker from "../components/AvatarPicker";
import HeaderUserNav from "../components/HeaderUserNav";
import { updateEmail } from "../api/account";
import { updateCredits } from "../api/credits";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import CenteredMain from "../components/CenteredMain";
import { getProfileOverview, resetProfileStats, type GameKey } from "../utils/profileStats";
import "./ProfilePage.css";

const AVATAR_OPTIONS = [
  { src: "/assets/avatars/Flower.png", alt: "Flower" },
  { src: "/assets/avatars/Hot Streak.png", alt: "Hot Streak" },
  { src: "/assets/avatars/robot.png", alt: "Robot" },
  { src: "/assets/avatars/silly_cat.png", alt: "Kitty" },
  { src: "/assets/avatars/galaxy_spade.png", alt: "Spade Galaxy" },
  { src: "/assets/avatars/Dollarydoos.png", alt: "Dollarydoos" },
];

const START_BANK = 500;
const BANK_KEY = "bjBank";

const GAME_ROUTE: Record<GameKey, string> = {
  blackjack: "/blackjack",
  slots: "/slots",
  craps: "/craps",
  roulette: "/roulette",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useMe();
  const { avatarSrc, setAvatarSrc } = useAvatar("/assets/avatars/robot.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);

  const [overviewVersion, setOverviewVersion] = useState(0);
  const overview = useMemo(() => getProfileOverview(), [overviewVersion]);
  const [emailValue, setEmailValue] = useState(user?.email ?? "");
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [resettingBank, setResettingBank] = useState(false);

  useEffect(() => {
    setEmailValue(user?.email ?? "");
  }, [user?.email]);

  const onLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const onResetBank = async () => {
    setResettingBank(true);
    localStorage.setItem(BANK_KEY, String(START_BANK));
    resetProfileStats();
    setOverviewVersion((value) => value + 1);

    if (localStorage.getItem("token")) {
      try {
        await updateCredits(START_BANK);
      } catch (err) {
        console.error("Failed to reset bank in database:", err);
      }
    }

    setResettingBank(false);
  };

  const onSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus("");

    if (!localStorage.getItem("token")) {
      setEmailStatus("Log in to save an email address.");
      return;
    }

    const nextEmail = emailValue.trim();
    if (!nextEmail) {
      setEmailStatus("Enter an email address first.");
      return;
    }

    setSavingEmail(true);
    try {
      const result = await updateEmail(nextEmail);
      setEmailValue(result.email ?? nextEmail);
      setEmailStatus("Email updated.");
      navigate(0);
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : "Could not update email.");
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <div className="profile-page-shell">
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <>
            Credits: <strong>{user ? user.credits : localStorage.getItem(BANK_KEY) ?? START_BANK}</strong>
          </>
        }
        right={
          <>
            <Link to="/home" className="btn btn-secondary">
              Home
            </Link>
            <Link to="/leaderboard" className="btn btn-secondary">
              Leaderboards
            </Link>
          </>
        }
      />

      <CenteredMain maxWidth={1320}>
        <div className="profile-main">
        <section className="panel stack profile-shell-panel">
          <div className="profile-hero">
            <div className="profile-hero-left">
              <AvatarPicker avatarSrc={avatarSrc} setAvatarSrc={setAvatarSrc} options={AVATAR_OPTIONS} />

              <div className="profile-hero-copy">
                <h2 className="panel-header profile-hero-name">{username}</h2>
                <p className="panel-subtle profile-hero-subtitle">
                  Tap the avatar to change your profile picture.
                </p>
              </div>
            </div>

            <div className="profile-hero-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onResetBank}
                disabled={resettingBank}
              >
                {resettingBank ? "Resetting..." : "Reset Bank"}
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={onLogout}
                disabled={loading && !!localStorage.getItem("token")}
              >
                Log Out
              </button>
            </div>
          </div>

          <div className="grid cols-3 profile-grid">
            <div className="panel profile-card">
              <h3 className="panel-header">Overview</h3>
              <p className="panel-subtle">Wins and losses for all four games plus your total.</p>

              <div className="table-wrapper profile-table-wrap">
                <table className="table profile-table">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Wins</th>
                      <th>Losses</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.lines.map((line) => (
                      <tr key={line.key}>
                        <td>{line.label}</td>
                        <td>{line.wins}</td>
                        <td>{line.losses}</td>
                        <td>{line.wins + line.losses}</td>
                      </tr>
                    ))}
                    <tr className="profile-total-row">
                      <td><strong>Total</strong></td>
                      <td><strong>{overview.total.wins}</strong></td>
                      <td><strong>{overview.total.losses}</strong></td>
                      <td><strong>{overview.total.games}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel profile-card">
              <h3 className="panel-header">Favorite Game</h3>
              <p className="panel-subtle">Your most played game right now.</p>

              {overview.favorite ? (
                <div className="stack profile-favorite-stack">
                  <div className="profile-favorite-top">
                    <div className="profile-favorite-title">{overview.favorite.label}</div>
                    <div className="panel-subtle profile-favorite-caption">
                      {overview.favorite.games} total games played
                    </div>
                  </div>

                  <div className="profile-favorite-stats">
                    <div className="panel profile-mini-stat">
                      <div className="panel-subtle profile-mini-label">Wins</div>
                      <strong>{overview.favorite.wins}</strong>
                    </div>
                    <div className="panel profile-mini-stat">
                      <div className="panel-subtle profile-mini-label">Losses</div>
                      <strong>{overview.favorite.losses}</strong>
                    </div>
                    <div className="panel profile-mini-stat">
                      <div className="panel-subtle profile-mini-label">Win Rate</div>
                      <strong>{overview.favorite.winRate}%</strong>
                    </div>
                  </div>

                  <div>
                    <Link to={GAME_ROUTE[overview.favorite.key]} className="btn btn-ghost">
                      Play {overview.favorite.label}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="toast info" style={{ display: "block" }}>
                  No game history yet. Play a few rounds and your favorite game will show up here.
                </div>
              )}
            </div>

            <div className="panel profile-card">
              <h3 className="panel-header">Account</h3>
              <p className="panel-subtle">Email on file and the option to update it.</p>

              <div className="stack profile-account-stack">
                <div className="panel profile-account-current">
                  <div className="panel-subtle profile-current-label">Current email</div>
                  <strong className="profile-current-email">
                    {user?.email?.trim() ? user.email : "No email associated with this account yet."}
                  </strong>
                </div>

                <form className="stack profile-email-form" onSubmit={onSaveEmail}>
                  <label htmlFor="profileEmail">{user?.email ? "Change email" : "Add email"}</label>
                  <div className="input-wrap">
                    <input
                      id="profileEmail"
                      type="email"
                      placeholder="name@example.com"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" disabled={savingEmail}>
                    {savingEmail ? "Saving..." : user?.email ? "Change Email" : "Add Email"}
                  </button>
                </form>

                {!user ? (
                  <div className="toast info" style={{ display: "block" }}>
                    Log in to attach an email address to your account.
                  </div>
                ) : null}

                {emailStatus ? <div className="toast info" style={{ display: "block" }}>{emailStatus}</div> : null}
              </div>
            </div>
          </div>
        </section>
        </div>
      </CenteredMain>
    </div>
  );
}
