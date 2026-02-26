import { API_BASE_URL } from "../config";

export interface LeaderboardEntry {
  username: string;
  total_games: number;
  wins: number;
  losses: number;
  net_winnings: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE_URL}/leaderboard`);

  if (!res.ok) {
    throw new Error("Failed to fetch leaderboard");
  }

  const data = await res.json();
  return data.leaderboard || [];
}