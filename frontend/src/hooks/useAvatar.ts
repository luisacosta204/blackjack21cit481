import { useEffect, useState } from "react";

const AVATAR_KEY = "bj21.avatar";

export function useAvatar(defaultSrc = "/assets/avatars/1.png") {
  const [avatarSrc, setAvatarSrc] = useState<string>(defaultSrc);

  useEffect(() => {
    const saved = localStorage.getItem(AVATAR_KEY);
    if (saved) setAvatarSrc(saved);

    const onStorage = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY && e.newValue) setAvatarSrc(e.newValue);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setAndPersist = (src: string) => {
    setAvatarSrc(src);
    localStorage.setItem(AVATAR_KEY, src);
  };

  return { avatarSrc, setAvatarSrc: setAndPersist };
}
