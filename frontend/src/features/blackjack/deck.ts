import type { Card, Rank, Suit } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function buildShoe(decks: number): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit });
      }
    }
  }
  return shuffle(shoe);
}

// Fisher–Yates shuffle
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function draw(shoe: Card[]): { card: Card; shoe: Card[] } {
  if (shoe.length === 0) {
    // Should never happen if we reshuffle before empty, but guard anyway
    throw new Error("Shoe is empty");
  }
  const [card, ...rest] = shoe;
  return { card, shoe: rest };
}
