import { useState, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const DECK_KEY = "bjDeck";

export interface DeckOption {
  id: string;
  name: string;
}

export interface DeckTheme {
  /** e.g. { "A♠": "/assets/decks/style_1/Ace of Spades.png" } */
  textures: Record<string, string>;
  backImage: string;
  deckId: string;
  setDeckId: (id: string) => void;
  deckOptions: DeckOption[];
  loading: boolean;
}

// ── Suit word → symbol ────────────────────────────────────────────────────────
export const SUIT_SYMBOL: Record<string, string> = {
  spades:   "♠",
  hearts:   "♥",
  diamonds: "♦",
  clubs:    "♣",
};

/** Build the lookup key used in deck JSON files, e.g. "A♠" or "10♥" */
export function cardKey(rank: string, suit: string): string {
  return `${rank}${SUIT_SYMBOL[suit] ?? suit}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDeckTheme(): DeckTheme {
  const [deckId, setDeckIdState] = useState<string>(
    () => localStorage.getItem(DECK_KEY) ?? "style_1"
  );
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [textures, setTextures] = useState<Record<string, string>>({});
  const [backImage, setBackImage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Persist selection and notify listeners
  const setDeckId = (id: string) => {
    localStorage.setItem(DECK_KEY, id);
    setDeckIdState(id);
  };

  // Load manifest once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/assets/decks/manifest.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
        const manifest = await res.json();
        const options: DeckOption[] = manifest.decks ?? [];
        setDeckOptions(options);

        // If saved deckId is no longer in the manifest, fall back to default
        const valid = options.some((d) => d.id === deckId);
        if (!valid) {
          const fallback = manifest.default ?? options[0]?.id ?? "style_1";
          setDeckId(fallback);
        }
      } catch (err) {
        console.warn("[useDeckTheme] Manifest load failed:", err);
        // Provide sensible fallback options so the select isn't empty
        setDeckOptions([
          { id: "style_1", name: "Style 1 (Images)" },
          { id: "style_2", name: "Style 2 (Images)" },
          { id: "text",    name: "Text Only" },
        ]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load textures whenever deckId changes
  useEffect(() => {
    // "text" mode — no images needed
    if (deckId === "text") {
      setTextures({});
      setBackImage("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/assets/decks/${deckId}.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Deck JSON fetch failed: ${res.status}`);
        const data = await res.json();

        const base = data.path ?? `/assets/decks/${deckId}/`;

        // Normalize suit unicode and build full URLs
        const normSuit = (s: string) =>
          s
            .replace(/\u2660/g, "♠")
            .replace(/\u2665/g, "♥")
            .replace(/\u2666/g, "♦")
            .replace(/\u2663/g, "♣");

        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.cards ?? {})) {
          const key = normSuit(k.trim());
          const url = (v as string).includes("/") ? (v as string) : base + (v as string);
          map[key] = url;
        }

        const back = data.back
          ? (data.back as string).includes("/")
            ? (data.back as string)
            : base + (data.back as string)
          : "";

        if (!cancelled) {
          setTextures(map);
          setBackImage(back);
          setLoading(false);
        }
      } catch (err) {
        console.warn("[useDeckTheme] Deck theme load failed:", err);
        if (!cancelled) {
          setTextures({});
          setBackImage("");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [deckId]);

  return { textures, backImage, deckId, setDeckId, deckOptions, loading };
}