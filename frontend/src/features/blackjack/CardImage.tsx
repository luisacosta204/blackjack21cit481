import type { Card } from "./types";
import { cardKey, SUIT_SYMBOL } from "./useDeckTheme";

interface CardImageProps {
  card?: Card;            // undefined = face-down hole card
  faceDown?: boolean;     // explicit override to show back
  textures: Record<string, string>;
  backImage: string;
  index?: number;         // used for React key externally, ignored internally
}

const SUIT_LABEL: Record<string, string> = {
  spades:   "Spades",
  hearts:   "Hearts",
  diamonds: "Diamonds",
  clubs:    "Clubs",
};

const RANK_LABEL: Record<string, string> = {
  A: "Ace", J: "Jack", Q: "Queen", K: "King",
};

export default function CardImage({
  card,
  faceDown = false,
  textures,
  backImage,
}: CardImageProps) {
  // ── Face-down / hole card ─────────────────────────────────────────────────
  if (faceDown || !card) {
    return (
      <div className="card-ui back" aria-label="Face-down card">
        {backImage ? (
          <img src={backImage} alt="Card back" className="card-img" draggable={false} />
        ) : null}
        {/* CSS ::after shows ★ when no back image — handled in blackjack.css */}
      </div>
    );
  }

  // ── Build lookup key e.g. "A♠" ────────────────────────────────────────────
  const key = cardKey(card.rank, card.suit);
  const imgSrc = textures[key];

  const suitSymbol = SUIT_SYMBOL[card.suit] ?? card.suit;
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const colorClass = isRed ? " red" : "";

  const altText = `${RANK_LABEL[card.rank] ?? card.rank} of ${SUIT_LABEL[card.suit] ?? card.suit}`;

  // ── Image card ────────────────────────────────────────────────────────────
  if (imgSrc) {
    return (
      <div className="card-ui" aria-label={altText}>
        <img
          src={imgSrc}
          alt={altText}
          className="card-img"
          draggable={false}
          loading="eager"
        />
      </div>
    );
  }

  // ── Text fallback (no texture loaded or "text" mode) ──────────────────────
  return (
    <div className="card-ui" aria-label={altText}>
      <div className={`corner${colorClass}`}>
        {card.rank}
        {suitSymbol}
      </div>
      <div className={`center${colorClass}`}>{suitSymbol}</div>
      <div
        className={`corner${colorClass}`}
        style={{ justifySelf: "end", transform: "rotate(180deg)" }}
      >
        {card.rank}
        {suitSymbol}
      </div>
    </div>
  );
}