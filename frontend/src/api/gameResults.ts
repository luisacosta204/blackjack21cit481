const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface RecordGameResultPayload {
  won: boolean;
  delta: number;
}

export async function recordGameResult(payload: RecordGameResultPayload): Promise<void> {
  const token = localStorage.getItem("token");
  if (!token) {
    // Guest users don't record results
    return;
  }

  const res = await fetch(`${API_BASE}/game-results`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Failed to record game result");
  }
}