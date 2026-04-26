export type GameKey = "blackjack" | "slots" | "craps" | "roulette";

export type GameStatLine = {
  key: GameKey;
  label: string;
  wins: number;
  losses: number;
};

export type ProfileStats = {
  games: Record<GameKey, { wins: number; losses: number }>;
};

const STORAGE_KEY = "bj21.profileStats";

const GAME_META: Array<{ key: GameKey; label: string }> = [
  { key: "blackjack", label: "Blackjack" },
  { key: "slots", label: "Slots" },
  { key: "craps", label: "Craps" },
  { key: "roulette", label: "Roulette" },
];

function createEmptyStats(): ProfileStats {
  return {
    games: {
      blackjack: { wins: 0, losses: 0 },
      slots: { wins: 0, losses: 0 },
      craps: { wins: 0, losses: 0 },
      roulette: { wins: 0, losses: 0 },
    },
  };
}

export function getProfileStats(): ProfileStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStats();

    const parsed = JSON.parse(raw) as Partial<ProfileStats>;
    const base = createEmptyStats();

    for (const { key } of GAME_META) {
      base.games[key].wins = Number(parsed.games?.[key]?.wins ?? 0);
      base.games[key].losses = Number(parsed.games?.[key]?.losses ?? 0);
    }

    return base;
  } catch {
    return createEmptyStats();
  }
}

export function saveProfileStats(stats: ProfileStats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function recordProfileGameResult(game: GameKey, won: boolean) {
  const stats = getProfileStats();
  if (won) stats.games[game].wins += 1;
  else stats.games[game].losses += 1;
  saveProfileStats(stats);
}

export function resetProfileStats() {
  saveProfileStats(createEmptyStats());
}

export function getProfileOverview() {
  const stats = getProfileStats();
  const lines: GameStatLine[] = GAME_META.map(({ key, label }) => ({
    key,
    label,
    wins: stats.games[key].wins,
    losses: stats.games[key].losses,
  }));

  const totals = lines.reduce(
    (acc, line) => {
      acc.wins += line.wins;
      acc.losses += line.losses;
      return acc;
    },
    { wins: 0, losses: 0 }
  );

  const favorite = [...lines].sort((a, b) => {
    const aGames = a.wins + a.losses;
    const bGames = b.wins + b.losses;
    if (bGames !== aGames) return bGames - aGames;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.label.localeCompare(b.label);
  })[0];

  return {
    lines,
    total: {
      wins: totals.wins,
      losses: totals.losses,
      games: totals.wins + totals.losses,
    },
    favorite:
      favorite && favorite.wins + favorite.losses > 0
        ? {
            key: favorite.key,
            label: favorite.label,
            wins: favorite.wins,
            losses: favorite.losses,
            games: favorite.wins + favorite.losses,
            winRate: Math.round((favorite.wins / Math.max(1, favorite.wins + favorite.losses)) * 100),
          }
        : null,
  };
}
