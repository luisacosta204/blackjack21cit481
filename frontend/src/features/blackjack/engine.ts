import type { Card } from "./types";

export function cardValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
}

export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;

  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === "A") aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}
