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
import { getProfileOverview, resetProfileStats } from "../utils/profileStats";

const AVATAR_OPTIONS = [
  { src: "/assets/avatars/Flower.png", alt: "Flower" },
  { src: "/assets/avatars/Hot Streak.png", alt: "Hot Streak" },
  { src: "/assets/avatars/robot.png", alt: "Robot" },
  { src: "/assets/avatars/silly_cat.png", alt: "Kitty" },
  { src: "/assets/avatars/galaxy_spade.png", alt: "Spade Galaxy" },
  { src: "/assets/avatars/Dollarydoos.png", alt: "Dollarydoos" },
];

const START_BANK = 500;
const BANK_KEY = "bank";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useMe();
  const { avatarSrc, setAvatarSrc } = useAvatar("/assets/avatars/robot.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);

  const overview = useMemo(() => getProfileOverview(), []);
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

    if (localStorage.getItem("token")) {
      try {
        await updateCredits(START_BANK);
      } catch (err) {
        console.error("Failed to reset bank in database:", err);
      }
    }

    setResettingBank(false);
    navigate(0);
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
      await updateEmail(nextEmail);
      setEmailStatus("Email updated.");
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : "Could not update email.");
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <>
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

      <CenteredMain maxWidth={1280}>
        <section className="panel stack">
          <div className="cluster" style={{ alignItems: "flex-start", justifyContent: "space-between" }}>
            <div className="stack" style={{ gap: 12 }}>
              <AvatarPicker avatarSrc={avatarSrc} setAvatarSrc={setAvatarSrc} options={AVATAR_OPTIONS} />
              <div>
                <h2 className="panel-header" style={{ marginBottom: 4 }}>{username}</h2>
                <p className="panel-subtle" style={{ marginBottom: 0 }}>Tap the avatar to change your profile picture.</p>
              </div>
            </div>

            <div className="stack" style={{ gap: 12, minWidth: 220 }}>
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
            <div className="panel">
              <h3 className="panel-header">Overview</h3>
              <p className="panel-subtle">Wins and losses by game</p>

              <table className="table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Wins</th>
                    <th>Losses</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.lines.map((line) => (
                    <tr key={line.key}>
                      <td>{line.label}</td>
                      <td>{line.wins}</td>
                      <td>{line.losses}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{overview.total.wins}</strong></td>
                    <td><strong>{overview.total.losses}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h3 className="panel-header">Favorite Game</h3>
              <p className="panel-subtle">Most played game so far</p>

              {overview.favorite ? (
                <div className="stack" style={{ gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{overview.favorite.label}</div>
                    <div className="panel-subtle" style={{ marginTop: 6, marginBottom: 0 }}>
                      {overview.favorite.games} total games played
                    </div>
                  </div>

                  <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                    <div className="panel" style={{ padding: 16 }}>
                      <div className="panel-subtle" style={{ marginBottom: 8 }}>Wins</div>
                      <strong>{overview.favorite.wins}</strong>
                    </div>
                    <div className="panel" style={{ padding: 16 }}>
                      <div className="panel-subtle" style={{ marginBottom: 8 }}>Losses</div>
                      <strong>{overview.favorite.losses}</strong>
                    </div>
                    <div className="panel" style={{ padding: 16 }}>
                      <div className="panel-subtle" style={{ marginBottom: 8 }}>Win Rate</div>
                      <strong>{overview.favorite.winRate}%</strong>
                    </div>
                  </div>

                  <div>
                    <Link
                      to={overview.favorite.key === "slots" ? "/slots" : overview.favorite.key === "blackjack" ? "/blackjack" : "/home"}
                      className="btn btn-ghost"
                    >
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

            <div className="panel">
              <h3 className="panel-header">Account</h3>
              <p className="panel-subtle">Email on file</p>

              <div className="stack" style={{ gap: 16 }}>
                <div className="panel" style={{ padding: 18 }}>
                  <div className="panel-subtle" style={{ marginBottom: 8 }}>Current email</div>
                  <strong>{user?.email?.trim() ? user.email : "No email associated with this account yet."}</strong>
                </div>

                <form className="stack" style={{ gap: 12 }} onSubmit={onSaveEmail}>
                  <label htmlFor="profileEmail">Change email</label>
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

                {emailStatus ? <div className="toast info" style={{ display: "block" }}>{emailStatus}</div> : null}
              </div>
            </div>
          </div>
        </section>
      </CenteredMain>
    </>
  );
}
