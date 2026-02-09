import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import AvatarPicker from "../components/AvatarPicker";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import CenteredMain from "../components/CenteredMain";


const AVATAR_OPTIONS = [
  { src: "/assets/avatars/Flower.png", alt: "Flower" },
  { src: "/assets/avatars/Hot Streak.png", alt: "Hot Streak" },
  { src: "/assets/avatars/robot.png", alt: "Robot" },
  { src: "/assets/avatars/silly_cat.png", alt: "Kitty" },
  { src: "/assets/avatars/galaxy_spade.png", alt: "Spade Galaxy" },
  { src: "/assets/avatars/Dollarydoos.png", alt: "Dollarydoos" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useMe();
  const { avatarSrc, setAvatarSrc } = useAvatar("/assets/avatars/1.png");

  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);
  const emailText = user?.email ?? "you@casino.com";

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
          <>
            Credits: <strong>{user ? user.credits : "-"}</strong>
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

      <CenteredMain maxWidth={1200}>
        <section className="panel stack">
          <div className="cluster" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <AvatarPicker
              avatarSrc={avatarSrc}
              setAvatarSrc={setAvatarSrc}
              options={AVATAR_OPTIONS}
            />

            <div className="cluster">
              <a href="#" className="btn btn-secondary" onClick={(e) => e.preventDefault()}>
                Edit Profile
              </a>

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

          <div className="grid cols-3">
            <div className="panel">
              <h3 className="panel-header">Overview</h3>
              <p className="panel-subtle">Quick stats</p>
              <div className="grid cols-3">
                <div className="stack">
                  <strong>Games</strong>
                  <div>512</div>
                </div>
                <div className="stack">
                  <strong>Wins</strong>
                  <div>318</div>
                </div>
                <div className="stack">
                  <strong>Best Streak</strong>
                  <div>11</div>
                </div>
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-header">Recent Activity</h3>
              <p className="panel-subtle">Last 5 sessions</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Result</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Today</td>
                    <td>Standard</td>
                    <td>
                      <span className="badge win">Win</span>
                    </td>
                    <td>420</td>
                  </tr>
                  <tr>
                    <td>Yesterday</td>
                    <td>Standard</td>
                    <td>
                      <span className="badge lose">Loss</span>
                    </td>
                    <td>180</td>
                  </tr>
                  <tr>
                    <td>2 days ago</td>
                    <td>High Roller</td>
                    <td>
                      <span className="badge win">Win</span>
                    </td>
                    <td>890</td>
                  </tr>
                  <tr>
                    <td>3 days ago</td>
                    <td>Standard</td>
                    <td>
                      <span className="badge lose">Loss</span>
                    </td>
                    <td>120</td>
                  </tr>
                  <tr>
                    <td>4 days ago</td>
                    <td>Standard</td>
                    <td>
                      <span className="badge win">Win</span>
                    </td>
                    <td>370</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h3 className="panel-header">Account</h3>
              <p className="panel-subtle">Settings</p>
              <div className="stack">
                <div className="cluster" style={{ justifyContent: "space-between" }}>
                  <div>Email</div>
                  <div>{emailText}</div>
                </div>
                <div className="cluster" style={{ justifyContent: "space-between" }}>
                  <div>Two-Factor Auth</div>
                  <div>
                    <span className="badge">Off</span>
                  </div>
                </div>
                <div className="cluster" style={{ justifyContent: "space-between" }}>
                  <div>Newsletter</div>
                  <div>
                    <span className="badge">Subscribed</span>
                  </div>
                </div>
                <a href="#" className="btn btn-ghost" onClick={(e) => e.preventDefault()}>
                  Manage Settings
                </a>
              </div>
            </div>
          </div>
        </section>
      </CenteredMain>
    </>
  );
}
