import { API_BASE_URL } from "../config";

export interface GameStats {
  game_type: string;      // 'blackjack', 'slots', etc.
  game_name: string;      // 'Blackjack', 'Slots', etc. (display name)
  total_games: number;
  wins: number;
  losses: number;
  net_winnings: number;
  biggest_win: number;
  biggest_loss: number;
  win_rate: number;       // Already calculated by backend (0-100)
}

export interface UserStatsResponse {
  ok: boolean;
  stats: GameStats[];
}

export async function fetchUserStats(): Promise<GameStats[]> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/stats/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user stats");
  }

  const data: UserStatsResponse = await response.json();
  return data.stats;
}