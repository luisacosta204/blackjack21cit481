import { API_BASE_URL } from "../config";

export interface DailyBonusStatusResponse {
  ok: boolean;
  available: boolean;
  hoursRemaining?: number;
  nextBonusAt?: string;
  lastClaimedAt?: string;
  error?: string;
}

export interface ClaimDailyBonusResponse {
  ok: boolean;
  bonusAmount?: number;
  newCredits?: number;
  message?: string;
  error?: string;
  hoursRemaining?: number;
  nextBonusAt?: string;
}

export async function checkDailyBonusStatus(): Promise<DailyBonusStatusResponse> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/daily-bonus/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to check daily bonus status");
  }

  return response.json();
}

export async function claimDailyBonus(): Promise<ClaimDailyBonusResponse> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/daily-bonus`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to claim daily bonus");
  }

  return response.json();
}
