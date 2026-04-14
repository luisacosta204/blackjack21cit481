import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useMe } from "../hooks/useMe";
import { useAvatar } from "../hooks/useAvatar";
import { getOrCreateGuestUsername } from "../utils/guest";
import { updateCredits } from "../api/credits";
import { recordGameResult } from "../api/gameResults";
import { chipUrlForBank } from "../utils/chips";
import "./slots/slots.css";
import "../styles/bank-chip.css";

type SlotSymbol = {
  id: "cherry" | "lemon" | "star" | "bell" | "seven" | "diamond";
  label: string;
  image: string;
  weight: number;
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

  const reel1Ref = useRef<HTMLDivElement>(null);
  const reel2Ref = useRef<HTMLDivElement>(null);
  const reel3Ref = useRef<HTMLDivElement>(null);

  function saveBank(value: number) {
    localStorage.setItem(BANK_KEY, String(value));
  }

  const [reels, setReels] = useState<SlotSymbol[]>(() => [
    randomSymbol(),
    randomSymbol(),
    randomSymbol(),
  ]);

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
    const cap = 100;
    const newBet = Math.min(bank, cap);
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
    setStatus("Spinning...");

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

    const results = [randomSymbol(), randomSymbol(), randomSymbol()];

    await animateReels(results);

    const payout = evaluateWin(results, bet);

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

  async function animateReels(results: SlotSymbol[]): Promise<void> {
    const reelRefs = [reel1Ref, reel2Ref, reel3Ref];

    reelRefs.forEach((ref, i) => {
      if (!ref.current) return;

      ref.current.classList.add("spin");

      const strip = document.createElement("div");
      strip.className = "symbol-strip";

      for (let j = 0; j < 8; j++) {
        const symbol = randomSymbol();
        const symbolEl = document.createElement("div");
        symbolEl.className = "symbol";

        const img = document.createElement("img");
        img.src = symbol.image;
        img.alt = symbol.label;
        img.className = "slot-symbol-image";
        img.draggable = false;

        symbolEl.appendChild(img);
        strip.appendChild(symbolEl);
      }

      const finalSymbolEl = document.createElement("div");
      finalSymbolEl.className = "symbol";

      const finalImg = document.createElement("img");
      finalImg.src = results[i].image;
      finalImg.alt = results[i].label;
      finalImg.className = "slot-symbol-image";
      finalImg.draggable = false;

      finalSymbolEl.appendChild(finalImg);
      strip.appendChild(finalSymbolEl);

      ref.current.innerHTML = "";
      ref.current.appendChild(strip);

      const duration = 900 + i * 100;
      ref.current.style.setProperty("--spin-ms", `${duration}ms`);
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    setReels(results);

    reelRefs.forEach((ref) => {
      if (ref.current) ref.current.classList.remove("spin");
    });
  }

  function evaluateWin(results: SlotSymbol[], stake: number): number {
    const [a, b, c] = results;

    if (a.id === b.id && b.id === c.id) {
      const mult = PAY_MULT[a.id] || 1;
      return stake * mult;
    }

    if (
      (a.id === "cherry" && b.id === "cherry") ||
      (b.id === "cherry" && c.id === "cherry")
    ) {
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
        if (ref.current) {
          ref.current.classList.remove("win-glow", "lose-glow");
        }
      }, 900);
    });
  }

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
              <div className="reel" ref={reel1Ref} aria-label="Reel 1">
                <div className="symbol">
                  <SymbolImage symbol={reels[0]} className="slot-symbol-image" />
                </div>
              </div>
              <div className="reel" ref={reel2Ref} aria-label="Reel 2">
                <div className="symbol">
                  <SymbolImage symbol={reels[1]} className="slot-symbol-image" />
                </div>
              </div>
              <div className="reel" ref={reel3Ref} aria-label="Reel 3">
                <div className="symbol">
                  <SymbolImage symbol={reels[2]} className="slot-symbol-image" />
                </div>
              </div>
            </div>
            <div className="payline-marker" aria-hidden="true"></div>
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