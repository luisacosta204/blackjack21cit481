import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useMe } from "../hooks/useMe";
import { useAvatar } from "../hooks/useAvatar";
import { getOrCreateGuestUsername } from "../utils/guest";
import { updateCredits } from "../api/credits";
import { recordGameResult } from "../api/gameResults";
import { recordProfileGameResult } from "../utils/profileStats";
import "./Slots/slots.css";

const SYMBOLS = [
  { glyph: "🍒", weight: 24 },
  { glyph: "🍋", weight: 18 },
  { glyph: "⭐", weight: 12 },
  { glyph: "🔔", weight: 8 },
  { glyph: "7️⃣", weight: 6 },
  { glyph: "💎", weight: 3 },
];

const PAY_MULT: { [key: string]: number } = {
  "💎": 50,
  "7️⃣": 25,
  "🔔": 10,
  "⭐": 8,
  "🍋": 5,
  "🍒": 3,
};

const BANK_KEY = "bjBank";
const START_BANK = 500;

function loadBank(): number {
  const value = localStorage.getItem(BANK_KEY);
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : START_BANK;
}

function randomSymbol(): string {
  const totalWeight = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.glyph;
  }

  return SYMBOLS[0].glyph;
}

export default function SlotsPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = user?.username ?? getOrCreateGuestUsername();

  const [bank, setBank] = useState<number>(() => loadBank());
  const [bet, setBet] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("Set your bet, then press Spin.");
  const [reels, setReels] = useState(() => [randomSymbol(), randomSymbol(), randomSymbol()]);

  const reel1Ref = useRef<HTMLDivElement>(null);
  const reel2Ref = useRef<HTMLDivElement>(null);
  const reel3Ref = useRef<HTMLDivElement>(null);

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
  }

  function maxBet() {
    if (spinning) return;
    const newBet = Math.min(bank, 100);
    setBet(newBet);
    setStatus(`Bet: ${newBet} credits. Press Spin!`);
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

    setSpinning(true);
    setStatus("Spinning…");

    const bankAfterStake = bank - bet;
    setBank(bankAfterStake);
    saveBank(bankAfterStake);

    if (user) {
      try {
        await updateCredits(bankAfterStake);
      } catch (error) {
        console.error("Failed to update credits:", error);
      }
    }

    const results = [randomSymbol(), randomSymbol(), randomSymbol()];
    await animateReels(results);

    const payout = evaluateWin(results, bet);
    const won = payout > 0;

    if (won) {
      const finalBank = bankAfterStake + payout;
      setBank(finalBank);
      saveBank(finalBank);
      setStatus(`You won ${payout} credits!`);
      glowReels(true);

      try {
        if (user) {
          await updateCredits(finalBank);
          await recordGameResult({ won: true, delta: payout - bet });
        }
        recordProfileGameResult("slots", true);
      } catch (error) {
        console.error("Failed to record slot win:", error);
      }
    } else {
      setStatus("No win. Try again!");
      glowReels(false);

      try {
        if (user) {
          await recordGameResult({ won: false, delta: -bet });
        }
        recordProfileGameResult("slots", false);
      } catch (error) {
        console.error("Failed to record slot loss:", error);
      }
    }

    setSpinning(false);
  }

  async function animateReels(results: string[]): Promise<void> {
    const reelRefs = [reel1Ref, reel2Ref, reel3Ref];

    reelRefs.forEach((ref, index) => {
      if (!ref.current) return;

      ref.current.classList.add("spin");

      const strip = document.createElement("div");
      strip.className = "symbol-strip";

      for (let i = 0; i < 8; i += 1) {
        const symbol = document.createElement("div");
        symbol.className = "symbol";
        symbol.textContent = randomSymbol();
        strip.appendChild(symbol);
      }

      const finalSymbol = document.createElement("div");
      finalSymbol.className = "symbol";
      finalSymbol.textContent = results[index];
      strip.appendChild(finalSymbol);

      ref.current.innerHTML = "";
      ref.current.appendChild(strip);
      ref.current.style.setProperty("--spin-ms", `${900 + index * 100}ms`);
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));
    setReels(results);

    reelRefs.forEach((ref) => {
      if (ref.current) ref.current.classList.remove("spin");
    });
  }

  function evaluateWin(results: string[], stake: number): number {
    const [a, b, c] = results;

    if (a === b && b === c) {
      return stake * (PAY_MULT[a] || 1);
    }

    if ((a === "🍒" && b === "🍒") || (b === "🍒" && c === "🍒")) {
      return stake;
    }

    return 0;
  }

  function glowReels(win: boolean) {
    const reelRefs = [reel1Ref, reel2Ref, reel3Ref];

    reelRefs.forEach((ref) => {
      if (!ref.current) return;

      ref.current.classList.remove("win-glow", "lose-glow");
      void ref.current.offsetWidth;
      ref.current.classList.add(win ? "win-glow" : "lose-glow");

      setTimeout(() => {
        ref.current?.classList.remove("win-glow", "lose-glow");
      }, 900);
    });
  }

  return (
    <div className="slots-page">
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <span id="bankBadge" aria-label={`Bank: ${bank} chips`}>
            {bank}
          </span>
        }
        right={
          <div className="right cluster slots-header-actions">
            <Link to="/home" className="back-button btn-secondary btn">
              ⮐ Back to Home
            </Link>
          </div>
        }
      />

      <main className="container stack slots-layout">
        <section className="panel">
          <h2 className="panel-header">Classic Slots</h2>
          <p className="panel-subtle">
            Three reels, single payline. Line up matching symbols to win. 7s and 💎 pay best.
          </p>

          <div className="slot-wrap">
            <div className="reels">
              <div className="reel" ref={reel1Ref} aria-label="Reel 1">
                <div className="symbol">{reels[0]}</div>
              </div>
              <div className="reel" ref={reel2Ref} aria-label="Reel 2">
                <div className="symbol">{reels[1]}</div>
              </div>
              <div className="reel" ref={reel3Ref} aria-label="Reel 3">
                <div className="symbol">{reels[2]}</div>
              </div>
            </div>
            <div className="payline-marker" aria-hidden="true" />
          </div>

          <div className="toast info mt-6" role="status" aria-live="polite">
            {status}
          </div>
        </section>

        <section className="grid cols-2 slots-controls-grid">
          <div className="panel">
            <h3 className="panel-header">Betting</h3>
            <p className="panel-subtle">Add chips to your bet, then Spin.</p>

            <div className="bet-line">
              <span className="muted">Bet:</span>
              <strong id="betAmount">{bet}</strong>
            </div>

            <div className="cluster bj-chips slots-chip-row">
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

            <div className="slots-button-row">
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
              <div className="pay-row"><span>💎 💎 💎</span><span>50x</span></div>
              <div className="pay-row"><span>7️⃣ 7️⃣ 7️⃣</span><span>25x</span></div>
              <div className="pay-row"><span>🔔 🔔 🔔</span><span>10x</span></div>
              <div className="pay-row"><span>⭐ ⭐ ⭐</span><span>8x</span></div>
              <div className="pay-row"><span>🍋 🍋 🍋</span><span>5x</span></div>
              <div className="pay-row"><span>🍒 🍒 🍒</span><span>3x</span></div>
              <div className="pay-row muted small"><span>🍒 🍒 *</span><span>1x</span></div>
            </div>

            <button className="btn btn-primary slots-spin-button" onClick={spin} disabled={spinning || bet <= 0}>
              {spinning ? "Spinning..." : "Spin"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
