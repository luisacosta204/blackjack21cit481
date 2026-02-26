import CenteredMain from "../components/CenteredMain";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLeaderboard, type LeaderboardEntry } from "../api/leaderboard";

export default function LeaderboardPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      setLoading(true);
      const data = await fetchLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      setError((err as Error)?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

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
          <p className="panel-subtle">Top players by net winnings</p>

          {loading && <p>Loading leaderboard...</p>}
          {error && <p className="error">{error}</p>}

          {!loading && !error && leaderboard.length === 0 && (
            <p>No players yet. Be the first to play!</p>
          )}

          {!loading && !error && leaderboard.length > 0 && (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Games</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Net Winnings</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={entry.username}>
                      <td><strong>#{index + 1}</strong></td>
                      <td>{entry.username}</td>
                      <td>{entry.total_games}</td>
                      <td className="text-success">{entry.wins}</td>
                      <td className="text-danger">{entry.losses}</td>
                      <td>
                        <strong className={entry.net_winnings >= 0 ? "text-success" : "text-danger"}>
                          {entry.net_winnings >= 0 ? "+" : ""}{entry.net_winnings}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </CenteredMain>
    </>
  );
}