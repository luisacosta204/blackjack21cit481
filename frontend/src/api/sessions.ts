import { API_BASE_URL } from "../config";
const API_BASE = API_BASE_URL;

export interface StartSessionPayload {
  game_type: string; // 'blackjack' | 'slots' | 'roulette' | 'craps'
}

export interface StartSessionResponse {
  ok: boolean;
  session_id: number;
  starting_credits: number;
}

export async function startSession(payload: StartSessionPayload): Promise<StartSessionResponse | null> {
  const token = localStorage.getItem("token");
  if (!token) {
    // Guest users don't have sessions
    return null;
  }

  const res = await fetch(`${API_BASE}/sessions/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Failed to start session");
  }

  const data = await res.json();
  return data;
}

export interface EndSessionPayload {
  session_id: number;
}

export async function endSession(payload: EndSessionPayload): Promise<void> {
  const token = localStorage.getItem("token");
  if (!token) {
    return;
  }

  const res = await fetch(`${API_BASE}/sessions/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Failed to end session");
  }
}