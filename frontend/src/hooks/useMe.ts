import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

export type MeUser = {
  id: number;
  username: string;
  email: string;
  credits: number;
  created_at: string;
};

export function useMe() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          localStorage.removeItem("token");
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(data.user);
        setLoading(false);
      } catch {
        setUser(null);
        setLoading(false);
      }
    })();
  }, []);

  return { user, loading };
}
