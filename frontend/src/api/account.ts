import { API_BASE_URL } from "../config";

export async function updateEmail(email: string): Promise<{ email: string | null }> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to update your email.");
  }

  const res = await fetch(`${API_BASE_URL}/account/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Failed to update email");
  }

  return { email: data.email ?? null };
}
