import { useMemo, useState } from "react";
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

type SlotSymbol = {
  id: "cherry" | "lemon" | "star" | "bell" | "seven" | "diamond";
  label: string;
  image: string;
  weight: number;
};

type ReelState = {
  symbols: SlotSymbol[];
  stopIndex: number;
  durationMs: number;
};

const SYMBOLS: SlotSymbol[] = [
  { id: "cherry", label: "Cherry", image: "/assets/slots/neon/cherry.png", weight: 24 },
  { id: "lemon", label: "Lemon", image: "/assets/slots/neon/lemon.png", weight: 18 },
  { id: "star", label: "Star", image: "/assets/slots/neon/star.png", weight: 12 },
  { id: "bell", label: "Bell", image: "/assets/slots/neon/bell.png", weight: 8 },
  { id: "seven", label: "Seven", image: "/assets/slots/neon/seven.png", weight: 6 },
  { id: "diamond", label: "Diamond", image: "/assets/slots/neon/diamond.png", weight: 3 },
];

const PAY_MULT: Record<SlotSymbol["id"], number> = {
  diamond: 50,
  seven: 25,
  bell: 10,
  star: 8,
  lemon: 5,
  cherry: 3,
};

const BANK_KEY = "bjBank";
const START_BANK = 500;
const REEL_ITEM_HEIGHT = 96;
const BASE_REEL_COUNT = 10;
const STOP_INDEX = BASE_REEL_COUNT - 1;

function loadBank(): number {
  const v = localStorage.getItem(BANK_KEY);
  return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : START_BANK;
}

function randomSymbol(): SlotSymbol {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const symbol of SYMBOLS) {
    random -= symbol.weight;
    if (random <= 0) return symbol;
  }

  return SYMBOLS[0];
}

function pluralizeLabel(label: string): string {
  if (label === "Cherry") return "Cherries";
  return `${label}s`;
}

function buildReel(result: SlotSymbol, durationMs: number): ReelState {
  const symbols: SlotSymbol[] = [];

  for (let i = 0; i < BASE_REEL_COUNT - 2; i += 1) {
    symbols.push(randomSymbol());
  }

  symbols.push(randomSymbol()); // near miss
  symbols.push(result); // final visible stop

  return {
    symbols,
    stopIndex: STOP_INDEX,
    durationMs,
  };
}

function SymbolImage({
  symbol,
  className = "",
}: {
  symbol: SlotSymbol;
  className?: string;
}) {
  return (
    <img
      src={symbol.image}
      alt={symbol.label}
      className={className}
      draggable={false}
    />
  );
}

export default function SlotsPage() {
  const navigate = useNavigate();
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");

  const username = user?.username ?? getOrCreateGuestUsername();

  const [bank, setBank] = useState<number>(() => loadBank());
  const [bet, setBet] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("Set your bet, then press Spin.");
  const [payoutDetails, setPayoutDetails] = useState("No payout yet.");

  const [results, setResults] = useState<SlotSymbol[]>(() => [
    randomSymbol(),
    randomSymbol(),
    randomSymbol(),
  ]);

  const [reels, setReels] = useState<ReelState[]>(() =>
    [0, 1, 2].map(() =>
      buildReel(randomSymbol(), 1200)
    )
  );

  const [spinCycle, setSpinCycle] = useState(0);

  function saveBank(value: number) {
    localStorage.setItem(BANK_KEY, String(value));
  }

  function addChip(amount: number) {
    if (spinning) return;
    if (bank <= 0) {
      setStatus("No credits available!");
      return;
    }

    const newBet = Math.min(bank, bet + amount);
    setBet(newBet);
    setStatus(`Bet: ${newBet} credits. Press Spin!`);
  }

  function clearBet() {
    if (spinning) return;
    setBet(0);
    setStatus("Bet cleared. Set your bet, then press Spin.");
    setPayoutDetails("No payout yet.");
  }

  function maxBet() {
    if (spinning) return;
    const cap = 100;
    const newBet = Math.min(bank, cap);
    setBet(newBet);
    setStatus(`Bet: ${newBet} credits. Press Spin!`);
  }

  function evaluateWin(spinResults: SlotSymbol[], stake: number): { payout: number; message: string } {
    const [a, b, c] = spinResults;

    if (a.id === b.id && b.id === c.id) {
      const mult = PAY_MULT[a.id] || 1;
      return {
        payout: stake * mult,
        message: `3 ${pluralizeLabel(a.label)} — pays ${mult}x`,
      };
    }

    if ((a.id === "cherry" && b.id === "cherry") || (b.id === "cherry" && c.id === "cherry")) {
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

  function glowReels(win: boolean) {
    window.setTimeout(() => {
      const els = document.querySelectorAll(".slots-page .reel");
      els.forEach((el) => {
        el.classList.remove("win-glow", "lose-glow");
        void (el as HTMLElement).offsetWidth;
        el.classList.add(win ? "win-glow" : "lose-glow");
      });

      window.setTimeout(() => {
        els.forEach((el) => el.classList.remove("win-glow", "lose-glow"));
      }, 900);
    }, 20);
  }

  async function spin() {
    if (spinning) return;
    if (bet <= 0) {
      setStatus("Please place a bet first.");
      return;
    }
    if (bet > bank) {
      setStatus("Your bet exceeds your credits.");
      return;
    }

    const nextResults: SlotSymbol[] = [randomSymbol(), randomSymbol(), randomSymbol()];
    const reelDurations = [1200, 1450, 1700];
    const nextReels: ReelState[] = nextResults.map((result, i) =>
      buildReel(result, reelDurations[i])
    );
    const { payout, message } = evaluateWin(nextResults, bet);

    setSpinning(true);
    setStatus("Spinning...");
    setPayoutDetails("Evaluating payout...");

    const newBank = bank - bet;
    setBank(newBank);
    saveBank(newBank);

    if (user) {
      try {
        await updateCredits(newBank);
      } catch (err) {
        console.error("Failed to update credits:", err);
      }
    }

    setResults(nextResults);
    setReels(nextReels);
    setSpinCycle((prev) => prev + 1);

    await new Promise((resolve) => setTimeout(resolve, Math.max(...reelDurations) + 100));

    setPayoutDetails(message);

    if (payout > 0) {
      const finalBank = newBank + payout;
      setBank(finalBank);
      saveBank(finalBank);
      setStatus(`You won ${payout} credits!`);
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

  const reelTranslateY = useMemo(
    () => reels.map((reel) => -(reel.stopIndex * REEL_ITEM_HEIGHT)),
    [reels]
  );

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
              {reels.map((reel, reelIndex) => (
                <div className="reel" aria-label={`Reel ${reelIndex + 1}`} key={`reel-${reelIndex}-${spinCycle}`}>
                  <div
                    className={`symbol-strip-react ${spinning ? "spinning" : ""}`}
                    style={{
                      transform: `translateY(${reelTranslateY[reelIndex]}px)`,
                      transitionDuration: `${reel.durationMs}ms`,
                    }}
                  >
                    {reel.symbols.map((symbol, symbolIndex) => (
                      <div className="symbol symbol-fixed" key={`${spinCycle}-${reelIndex}-${symbol.id}-${symbolIndex}`}>
                        <SymbolImage symbol={symbol} className="slot-symbol-image" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="payline-marker" aria-hidden="true"></div>
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
            <p className="panel-subtle">Add chips to your bet, then Spin.</p>

            <div className="bet-line">
              <span className="muted">Bet:</span>
              <strong id="betAmount">{bet}</strong>
            </div>

            <div className="cluster bj-chips" style={{ marginTop: "16px" }}>
              <button className="chip-btn chip-5" title="+5" onClick={() => addChip(5)} disabled={spinning}>
                +5
              </button>
              <button className="chip-btn chip-25" title="+25" onClick={() => addChip(25)} disabled={spinning}>
                +25
              </button>
              <button className="chip-btn chip-100" title="+100" onClick={() => addChip(100)} disabled={spinning}>
                +100
              </button>
            </div>

            <div className="btn-row" style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <button className="btn btn-secondary" onClick={clearBet} disabled={spinning}>
                Clear Bet
              </button>
              <button className="btn btn-secondary" onClick={maxBet} disabled={spinning}>
                Max Bet
              </button>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-header">Paytable</h3>
            <div className="paytable">
              <div className="pay-row">
                <span className="pay-symbol-group">
                  <img src="/assets/slots/neon/diamond.png" alt="Diamond" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/diamond.png" alt="Diamond" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/diamond.png" alt="Diamond" className="paytable-symbol-image" />
                </span>
                <span>50x</span>
              </div>
              <div className="pay-row">
                <span className="pay-symbol-group">
                  <img src="/assets/slots/neon/seven.png" alt="Seven" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/seven.png" alt="Seven" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/seven.png" alt="Seven" className="paytable-symbol-image" />
                </span>
                <span>25x</span>
              </div>
              <div className="pay-row">
                <span className="pay-symbol-group">
                  <img src="/assets/slots/neon/bell.png" alt="Bell" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/bell.png" alt="Bell" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/bell.png" alt="Bell" className="paytable-symbol-image" />
                </span>
                <span>10x</span>
              </div>
              <div className="pay-row">
                <span className="pay-symbol-group">
                  <img src="/assets/slots/neon/star.png" alt="Star" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/star.png" alt="Star" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/star.png" alt="Star" className="paytable-symbol-image" />
                </span>
                <span>8x</span>
              </div>
              <div className="pay-row">
                <span className="pay-symbol-group">
                  <img src="/assets/slots/neon/lemon.png" alt="Lemon" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/lemon.png" alt="Lemon" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/lemon.png" alt="Lemon" className="paytable-symbol-image" />
                </span>
                <span>5x</span>
              </div>
              <div className="pay-row">
                <span className="pay-symbol-group">
                  <img src="/assets/slots/neon/cherry.png" alt="Cherry" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/cherry.png" alt="Cherry" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/cherry.png" alt="Cherry" className="paytable-symbol-image" />
                </span>
                <span>3x</span>
              </div>
              <div className="pay-row muted small">
                <span className="pay-symbol-group">
                  <img src="/assets/slots/neon/cherry.png" alt="Cherry" className="paytable-symbol-image" />
                  <img src="/assets/slots/neon/cherry.png" alt="Cherry" className="paytable-symbol-image" />
                  <span>*</span>
                </span>
                <span>1x</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={spin}
              disabled={spinning || bet <= 0}
              style={{ marginTop: "16px", width: "100%" }}
            >
              {spinning ? "Spinning..." : "Spin"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}