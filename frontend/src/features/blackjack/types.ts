export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6"
  | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface Hand {
  cards: Card[];
  score: number;
}

export interface DeckState {
  shoe: Card[];
  discard: Card[];
  decks: number; // number of 52-card decks in the shoe (e.g., 6)
}
