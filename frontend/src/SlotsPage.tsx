import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useMe } from "../hooks/useMe";
import { useAvatar } from "../hooks/useAvatar";
import { getOrCreateGuestUsername } from "../utils/guest";
import { updateCredits } from "../api/credits";
import { recordGameResult } from "../api/gameResults";
import { chipUrlForBank } from "../utils/chips";
import "./Slots/slots.css";
import "../styles/bank-chip.css";

type SymbolGlyph = "🍒" | "🍋" | "⭐" | "🔔" | "7️⃣" | "💎";

type SymbolDef = {
  glyph: SymbolGlyph;
  weight: number;
};

const SYMBOLS: SymbolDef[] = [
  { glyph: "🍒", weight: 24 },
  { glyph: "🍋", weight: 18 },
  { glyph: "⭐", weight: 12 },
  { glyph: "🔔", weight: 8 },
  { glyph: "7️⃣", weight: 6 },
  { glyph: "💎", weight: 3 },
];

const PAY_MULT: Record<SymbolGlyph, number> = {
  "💎": 50,
  "7️⃣": 25,
  "🔔": 10,
  "⭐": 8,
  "🍋": 5,
  "🍒": 3,
};

const PACK_MAP: Record<SymbolGlyph, string> = {
  "🍒": "/assets/slots/neon/cherry.png",
  "🍋": "/assets/slots/neon/lemon.png",
  "⭐": "/assets/slots/neon/star.png",
  "🔔": "/assets/slots/neon/bell.png",
  "7️⃣": "/assets/slots/neon/seven.png",
  "💎": "/assets/slots/neon/diamond.png",
};

const LABEL_MAP: Record<SymbolGlyph, string> = {
  "🍒": "Cherry",
  "🍋": "Lemon",
  "⭐": "Star",
  "🔔": "Bell",
  "7️⃣": "Seven",
  "💎": "Diamond",
};

const BANK_KEY = "bjBank";
const START_BANK = 500;

function loadBank(): number {
  const raw = localStorage.getItem(BANK_KEY);
  const value = raw == null ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : START_BANK;
}

function randSymbol(): SymbolGlyph {
  const total = SYMBOLS.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of SYMBOLS) {
    r -= item.weight;
    if (r <= 0) return item.glyph;
  }
  return SYMBOLS[0].glyph;
}

function glyphToLabel(glyph: SymbolGlyph): string {
  return LABEL_MAP[glyph];
}

function pluralizeLabel(label: string): string {
  return label === "Cherry" ? "Cherries" : `${label}s`;
}

function createSymbolNode(glyph: SymbolGlyph): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "symbol";
  el.dataset.glyph = glyph;

  const img = document.createElement("img");
  img.src = PACK_MAP[glyph];
  img.alt = glyphToLabel(glyph);
  img.draggable = false;

  el.appendChild(img);
  return el;
}

function buildStrip(finalGlyph: SymbolGlyph): HTMLDivElement {
  const strip = document.createElement("div");
  strip.className = "symbol-strip";
  const count = 8;

  for (let i = 0; i < count; i += 1) {
    strip.appendChild(createSymbolNode(randSymbol()));
  }

  strip.appendChild(createSymbolNode(finalGlyph));
  return strip;
}

export default function SlotsPage() {
  const navigate = useNavigate();
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);

  const [bank, setBank] = useState<number>(() => loadBank());
  const [bet, setBet] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("Set your bet, then press Spin.");
  const [payoutDetails, setPayoutDetails] = useState("No payout yet.");

  const reel1Ref = useRef<HTMLDivElement>(null);
  const reel2Ref = useRef<HTMLDivElement>(null);
  const reel3Ref = useRef<HTMLDivElement>(null);

  const reelEls = [reel1Ref, reel2Ref, reel3Ref];

  function saveBank(value: number): void {
    localStorage.setItem(BANK_KEY, String(value));
  }

  function renderStatic(glyphs: SymbolGlyph[]): void {
    reelEls.forEach((ref, i) => {
      const el = ref.current;
      if (!el) return;
      el.innerHTML = "";
      el.appendChild(createSymbolNode(glyphs[i]));
    });
  }

  function centerSymbol(el: HTMLDivElement): SymbolGlyph | null {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const found = document.elementFromPoint(x, y) as HTMLElement | null;
    const sym = found?.closest?.(".symbol") as HTMLElement | null;
    const glyph = sym?.dataset?.glyph;
    return glyph && glyph in PACK_MAP ? (glyph as SymbolGlyph) : null;
  }

  function evaluate(landed: SymbolGlyph[], stake: number): { payout: number; message: string } {
    const [a, b, c] = landed;

    if (a === b && b === c) {
      const mult = PAY_MULT[a] ?? 0;
      return {
        payout: stake * mult,
        message: `3 ${pluralizeLabel(glyphToLabel(a))} — pays ${mult}x`,
      };
    }

    const cherries = landed.filter((g) => g === "🍒").length;
    if (cherries >= 2) {
      return {
        payout: stake,
        message: "2 Cherries — pays 1x",
      };
    }

    return {
      payout: 0,
      message: "No payout",
    };
  }

  function glowReels(win: boolean): void {
    reelEls.forEach((ref) => {
      const el = ref.current;
      if (!el) return;
      el.classList.remove("win-glow", "lose-glow");
      void el.offsetWidth;
      el.classList.add(win ? "win-glow" : "lose-glow");
      window.setTimeout(() => el.classList.remove("win-glow", "lose-glow"), 900);
    });
  }

  async function animateReels(plannedFinals: SymbolGlyph[]): Promise<SymbolGlyph[]> {
    const durations = [900, 1050, 1200];

    return await new Promise<SymbolGlyph[]>((resolve) => {
      let done = 0;
      const landed: SymbolGlyph[] = new Array(reelEls.length) as SymbolGlyph[];

      reelEls.forEach((ref, i) => {
        const el = ref.current;
        if (!el) {
          landed[i] = plannedFinals[i];
          done += 1;
          if (done === reelEls.length) resolve(landed);
          return;
        }

        const strip = buildStrip(plannedFinals[i]);
        strip.style.setProperty("--spin-ms", `${durations[i]}ms`);
        el.innerHTML = "";
        el.appendChild(strip);
        el.classList.add("spin");

        window.setTimeout(() => {
          const seen = centerSymbol(el) ?? plannedFinals[i];
          el.classList.remove("spin");
          el.innerHTML = "";
          el.appendChild(createSymbolNode(seen));

          landed[i] = seen;
          done += 1;
          if (done === reelEls.length) resolve(landed);
        }, durations[i] + 30);
      });
    });
  }

  function addChip(amount: number): void {
    if (spinning) return;
    if (bank <= 0) {
      setStatus("No credits available!");
      return;
    }
    const newBet = Math.min(bank, bet + amount);
    setBet(newBet);
    setStatus(`Bet: ${newBet} credits. Press Spin!`);
  }

  function clearBet(): void {
    if (spinning) return;
    setBet(0);
    setStatus("Bet cleared. Set your bet, then press Spin.");
    setPayoutDetails("No payout yet.");
  }

  function maxBet(): void {
    if (spinning) return;
    const cap = 100;
    const newBet = Math.min(bank, cap);
    setBet(newBet);
    setStatus(`Bet: ${newBet} credits. Press Spin!`);
  }

  async function onSpin(): Promise<void> {
    if (spinning) return;
    if (bet <= 0) {
      setStatus("Please place a bet first.");
      return;
    }
    if (bet > bank) {
      setStatus("Your bet exceeds your bank.");
      return;
    }

    setSpinning(true);
    setStatus("Spinning...");
    setPayoutDetails("Evaluating payout...");

    const bankAfterStake = bank - bet;
    setBank(bankAfterStake);
    saveBank(bankAfterStake);

    if (user) {
      try {
        await updateCredits(bankAfterStake);
      } catch (err) {
        console.error("Failed to update credits:", err);
      }
    }

    const planned = [randSymbol(), randSymbol(), randSymbol()] as SymbolGlyph[];
    const landed = await animateReels(planned);
    const { payout, message } = evaluate(landed, bet);

    setPayoutDetails(message);

    if (payout > 0) {
      const finalBank = bankAfterStake + payout;
      setBank(finalBank);
      saveBank(finalBank);
      setStatus(`You won ${payout} chips!`);
      glowReels(true);

      if (user) {
        try {
          await updateCredits(finalBank);
          await recordGameResult({ won: true, delta: payout - bet });
        } catch (err) {
          console.error("Failed to record win:", err);
        }
      }
    } else {
      setStatus("No win. Try again!");
      glowReels(false);

      if (user) {
        try {
          await recordGameResult({ won: false, delta: -bet });
        } catch (err) {
          console.error("Failed to record loss:", err);
        }
      }
    }

    setSpinning(false);
  }

  useEffect(() => {
    renderStatic([randSymbol(), randSymbol(), randSymbol()]);
  }, []);

  return (
    <div className="slots-page">
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <span
            id="bankBadge"
            aria-label={`Bank: ${bank} chips`}
            style={{ ["--bank-chip-url" as string]: `url("${chipUrlForBank(bank)}")` }}
          >
            {bank}
          </span>
        }
        right={
          <button onClick={() => navigate("/home")} className="back-button btn-secondary btn">
            ⮐ Back to Home
          </button>
        }
      />

      <main className="container stack">
        <section className="panel">
          <h2 className="panel-header">Classic Slots</h2>
          <p className="panel-subtle">
            Three reels, single payline. Line up matching symbols to win. 7s and diamonds pay best.
          </p>

          <div className="slot-wrap">
            <div className="reels">
              <div className="reel" id="reel1" ref={reel1Ref} aria-label="Reel 1" />
              <div className="reel" id="reel2" ref={reel2Ref} aria-label="Reel 2" />
              <div className="reel" id="reel3" ref={reel3Ref} aria-label="Reel 3" />
            </div>
            <div className="payline-marker" aria-hidden="true" />
          </div>

          <div className="slots-payout-popup" role="status" aria-live="polite">
            {payoutDetails}
          </div>

          <div className="toast info mt-6" role="status" aria-live="polite">
            {status}
          </div>
        </section>

        <div className="grid cols-2">
          <div className="panel">
            <h3 className="panel-header">Betting</h3>
            <p className="panel-subtle">Choose your wager per spin.</p>

            <div className="cluster">
              <button className="chip-btn chip-5" title="+5" onClick={() => addChip(5)} disabled={spinning}>
                +5
              </button>
              <button className="chip-btn chip-25" title="+25" onClick={() => addChip(25)} disabled={spinning}>
                +25
              </button>
              <button className="chip-btn chip-100" title="+100" onClick={() => addChip(100)} disabled={spinning}>
                +100
              </button>
              <button className="btn-ghost btn" onClick={clearBet} disabled={spinning}>
                Clear
              </button>
            </div>

            <div className="bet-line mt-4">
              <span className="muted">Bet per Spin:</span>
              <strong id="betAmount">{bet}</strong>
            </div>

            <div className="cluster mt-6">
              <button className="btn" onClick={() => void onSpin()} disabled={spinning || bet <= 0}>
                {spinning ? "Spinning..." : "Spin"}
              </button>
              <button className="btn-secondary btn" onClick={maxBet} disabled={spinning}>
                Max Bet
              </button>
              <button
                className="btn-danger btn"
                onClick={() => {
                  if (spinning) return;
                  setBank(START_BANK);
                  saveBank(START_BANK);
                  setStatus("Bank reset to 500 chips.");
                }}
                disabled={spinning}
              >
                Reset Bank
              </button>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-header">Actions</h3>
            <p className="panel-subtle">Spin the reels!</p>

            <div className="pt-wrap mt-3">
              <button type="button" className="btn-secondary btn pt-trigger" aria-haspopup="true">
                Paytable
              </button>

              <div className="pt-pop" role="dialog" aria-label="Paytable">
                <div className="pt-pop-head">
                  <strong>Paytable</strong>
                  <span className="muted small">3 in a row</span>
                </div>

                <ul className="paytable">
                  {(["💎", "7️⃣", "🔔", "⭐", "🍋", "🍒"] as SymbolGlyph[]).map((glyph) => (
                    <li key={glyph}>
                      <span className="pt-sym">
                        <img src={PACK_MAP[glyph]} alt={glyphToLabel(glyph)} />
                        <img src={PACK_MAP[glyph]} alt={glyphToLabel(glyph)} />
                        <img src={PACK_MAP[glyph]} alt={glyphToLabel(glyph)} />
                      </span>
                      {" "}
                      → x{PAY_MULT[glyph]}
                    </li>
                  ))}
                </ul>

                <p className="muted small">
                  Two <img src={PACK_MAP["🍒"]} alt="Cherry" style={{ width: 22, height: 22, verticalAlign: "middle" }} /> pay x1 as a consolation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}