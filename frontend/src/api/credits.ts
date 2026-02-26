import { API_BASE_URL } from "../config";

export async function updateCredits(credits: number): Promise<void> {
  const token = localStorage.getItem("token");
  if (!token) {
    return; // Guest users don't update credits
  }

  const res = await fetch(`${API_BASE_URL}/update-credits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ credits }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Failed to update credits");
  }
}