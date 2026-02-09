export function getOrCreateGuestUsername() {
  const key = "bj21.username";
  const stored = localStorage.getItem(key);
  if (stored) return stored;

  const generated = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  localStorage.setItem(key, generated);
  return generated;
}
