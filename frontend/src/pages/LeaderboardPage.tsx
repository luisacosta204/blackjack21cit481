import CenteredMain from "../components/CenteredMain";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLeaderboard, type LeaderboardEntry } from "../api/leaderboard";
import { chipUrlForBank } from "../utils/chips";

type GameTab = 'all' | 'blackjack' | 'slots' | 'roulette' | 'craps';

export default function LeaderboardPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);
  const bankValue = Number(localStorage.getItem("bjBank") ?? 500);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GameTab>('all');

  useEffect(() => {
    loadLeaderboard(activeTab);
  }, [activeTab]);

  async function loadLeaderboard(gameType?: string) {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLeaderboard(gameType === 'all' ? undefined : gameType);
      setLeaderboard(data);
    } catch (err) {
      setError((err as Error)?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<{ id: GameTab; label: string; emoji: string }> = [
    { id: 'all', label: 'All Games', emoji: '🎰' },
    { id: 'blackjack', label: 'Blackjack', emoji: '🃏' },
    { id: 'slots', label: 'Slots', emoji: '🎰' },
    { id: 'roulette', label: 'Roulette', emoji: '🎡' },
    { id: 'craps', label: 'Craps', emoji: '🎲' },
  ];

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
          <p className="panel-subtle">
            Top players by net winnings
            {activeTab !== 'all' && ` • ${tabs.find(t => t.id === activeTab)?.label}`}
          </p>

          {/* Game Tabs */}
          <div className="cluster" style={{ gap: '8px', marginBottom: '16px' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'btn btn-secondary' : 'btn btn-ghost'}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontSize: '14px',
                  padding: '8px 16px',
                }}
              >
                <span style={{ marginRight: '6px' }}>{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {loading && <p>Loading leaderboard...</p>}
          {error && <p className="error">{error}</p>}

          {!loading && !error && leaderboard.length === 0 && (
            <div className="toast info" style={{ display: 'block' }}>
              No players yet for {activeTab === 'all' ? 'any game' : tabs.find(t => t.id === activeTab)?.label}. 
              Be the first to play!
            </div>
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
                    <tr key={`${entry.username}-${index}`}>
                      <td>
                        <strong>#{index + 1}</strong>
                      </td>
                      <td>{entry.username}</td>
                      <td>{entry.total_games}</td>
                      <td className="text-success">{entry.wins}</td>
                      <td className="text-danger">{entry.losses}</td>
                      <td>
                        <strong className={entry.net_winnings >= 0 ? "text-success" : "text-danger"}>
                          {entry.net_winnings >= 0 ? "+" : ""}
                          {entry.net_winnings}
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
