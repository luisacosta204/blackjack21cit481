import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import { updateCredits } from "../api/credits";
import { recordProfileGameResult } from "../utils/profileStats";
import { recordGameResult } from "../api/gameResults";
import { chipUrlForBank } from "../utils/chips";
import "./Roulette/roulette.css";
import "../styles/bank-chip.css";

const BANK_KEY = "bjBank";
const START_BANK = 500;
const CHIP_VALUES = [5, 25, 100] as const;
const EURO_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
  6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26,
] as const;
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type BetType = "red" | "black" | "even" | "odd" | "number";
type BetState = { type: BetType | null; value: number | null };
type HistoryItem = { n: number; c: "red" | "black" | "green" };

function loadBank(): number {
  const raw = localStorage.getItem(BANK_KEY);
  const value = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    localStorage.setItem(BANK_KEY, String(START_BANK));
    return START_BANK;
  }
  return value;
}

function saveBank(value: number): void {
  localStorage.setItem(BANK_KEY, String(value));
}

function spinNumber(): number {
  return Math.floor(Math.random() * 37);
}

function colorOf(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

function payoutMultiplier(spin: number, bet: BetState): number {
  if (!bet.type) return 0;

  if (bet.type === "number") {
    return spin === bet.value ? 35 : 0;
  }

  if (spin === 0) return 0;

  switch (bet.type) {
    case "red":
      return colorOf(spin) === "red" ? 1 : 0;
    case "black":
      return colorOf(spin) === "black" ? 1 : 0;
    case "even":
      return spin % 2 === 0 ? 1 : 0;
    case "odd":
      return spin % 2 === 1 ? 1 : 0;
    default:
      return 0;
  }
}

export default function RoulettePage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);

  const [bank, setBank] = useState<number>(() => loadBank());
  const [betAmount, setBetAmount] = useState(0);
  const [bet, setBet] = useState<BetState>({ type: null, value: null });
  const [selectedNumber, setSelectedNumber] = useState(7);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("Place your bet to begin.");
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [ballRotation, setBallRotation] = useState(0);

  useEffect(() => {
    saveBank(bank);
  }, [bank]);

  const syncBackendCredits = async (nextBank: number) => {
    if (!user) return;
    try {
      await updateCredits(nextBank);
    } catch (error) {
      console.error("Failed to sync roulette credits:", error);
    }
  };

  const addChip = (amount: number) => {
    if (spinning) return;
    if (bank <= 0) {
      setStatus("Not enough chips.");
      return;
    }
    setBetAmount((prev) => Math.min(bank, prev + amount));
    if (!bet.type) setStatus("Choose a bet type, then spin.");
  };

  const clearBet = () => {
    if (spinning) return;
    setBetAmount(0);
    setBet({ type: null, value: null });
    setStatus("Bet cleared.");
  };

  const resetBank = async () => {
    if (spinning) return;
    setBank(START_BANK);
    setStatus("Bank reset to 500 chips.");
    await syncBackendCredits(START_BANK);
  };

  const selectBetType = (type: BetType) => {
    if (spinning) return;
    if (type === "number") {
      setBet({ type: "number", value: selectedNumber });
      setStatus(`Selected: Straight ${selectedNumber} (35:1).`);
      return;
    }
    setBet({ type, value: null });
    setStatus(`Selected: ${type.toUpperCase()} (1:1).`);
  };

  const animateBallToResult = async (n: number) => {
    const idx = EURO_WHEEL.indexOf(n as (typeof EURO_WHEEL)[number]);
    if (idx < 0) return;

    const seg = 360 / EURO_WHEEL.length;
    const startOffset = -(seg / 2);
    const pocketAngle = startOffset + (idx + 0.5) * seg;
    const turns = 360 * (4 + Math.floor(Math.random() * 3));
    const jitter = (Math.random() - 0.5) * 1.2;
    const startNorm = ((ballRotation % 360) + 360) % 360;
    const pocketNorm = ((pocketAngle % 360) + 360) % 360;
    const delta = (pocketNorm - startNorm + 360) % 360;
    const destination = ballRotation + turns + delta + jitter;

    setBallRotation(destination);
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  };

  const onSpin = async () => {
    if (spinning) return;
    if (betAmount <= 0) {
      setStatus("Place a bet amount first.");
      return;
    }
    if (!bet.type) {
      setStatus("Select a bet type first.");
      return;
    }

    const effectiveBet = bet.type === "number" ? { type: "number" as const, value: selectedNumber } : bet;
    if (betAmount > bank) {
      setStatus("Not enough chips.");
      return;
    }

    const bankAfterStake = bank - betAmount;
    setBank(bankAfterStake);
    setSpinning(true);
    setStatus("Spinning…");
    await syncBackendCredits(bankAfterStake);

    const n = spinNumber();
    await animateBallToResult(n);

    const mult = payoutMultiplier(n, effectiveBet);
    const winnings = mult > 0 ? betAmount * (mult + 1) : 0;
    const nextBank = bankAfterStake + winnings;
    const didWin = winnings > 0;

    setResultNumber(n);
    setHistory((prev) => [{ n, c: colorOf(n) }, ...prev].slice(0, 8));
    setBank(nextBank);
    setSpinning(false);
    setStatus(didWin ? `You won! Payout x${mult}: +${winnings} chips.` : "No win this spin.");
    recordProfileGameResult("roulette", didWin);

    if (user) {
      try {
        await updateCredits(nextBank);
        await recordGameResult({ won: didWin, delta: didWin ? winnings - betAmount : -betAmount });
      } catch (error) {
        console.error("Failed to persist roulette result:", error);
      }
    }
  };

  const resultColor = resultNumber == null ? undefined : colorOf(resultNumber);
  const selectedBetText =
    bet.type == null ? "—" : bet.type === "number" ? `Straight ${selectedNumber}` : bet.type.toUpperCase();

  const seg = 360 / EURO_WHEEL.length;
  const startOffset = -(seg / 2);
  const stops = EURO_WHEEL.map((n, i) => {
    const c = colorOf(n);
    const col = c === "red" ? "#b71c1c" : c === "black" ? "#111315" : "#0f7a44";
    const a0 = (i * seg).toFixed(4);
    const a1 = ((i + 1) * seg).toFixed(4);
    return `${col} ${a0}deg ${a1}deg`;
  }).join(", ");

  return (
    <div className="roulette-page">
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
          <div className="right cluster roulette-header-actions">
            <Link to="/home" className="back-button btn-secondary btn">
              ⮐ Back to Home
            </Link>
            
          </div>
        }
      />

      <main className="container stack roulette-layout">
        <section className="panel">
          <h2 className="panel-header">Roulette</h2>
          <p className="panel-subtle">Place a bet, then spin. Payouts: Straight (35:1), Color/Even/Odd (1:1).</p>

          <div className="roulette-wrap">
            <div className="wheel-card">
              <div className="wheel">
                <div
                  className="wheel-ring"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.55) 54%, rgba(0,0,0,0) 56%), conic-gradient(from ${startOffset}deg, ${stops})`,
                  }}
                >
                  {EURO_WHEEL.map((n, i) => {
                    const angleDeg = startOffset + (i + 0.5) * seg;
                    const rad = angleDeg * (Math.PI / 180);
                    const xPct = 50 + Math.sin(rad) * 36;
                    const yPct = 50 - Math.cos(rad) * 36;
                    return (
                      <div
                        key={n}
                        className={`number-label ${colorOf(n)}`}
                        style={{ left: `${xPct}%`, top: `${yPct}%`, transform: `translate(-50%, -50%) rotate(${angleDeg}deg)` }}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
                <div className="ball" style={{ transform: `translate(-50%, -50%) rotate(${ballRotation}deg) translateY(-128px)` }} aria-hidden="true" />
                <div className={`result ${resultColor ?? ""}`} data-color={resultColor} aria-live="polite">
                  {resultNumber == null ? "—" : `Result: ${resultNumber} (${resultColor})`}
                </div>
              </div>

              <div className="history">
                <div className="muted">Last spins</div>
                <div className="history-row">
                  {history.map((entry, index) => (
                    <span key={`${entry.n}-${index}`} className={`pill ${entry.c}`}>
                      {entry.n}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bet-card">
              <div className="betting-head">
                <div>
                  <h3 className="panel-header">Betting</h3>
                  <p className="panel-subtle">Set wager, choose bet, then Spin.</p>
                </div>
                <button className="btn btn-ghost" type="button" onClick={clearBet} disabled={spinning}>
                  Clear
                </button>
              </div>

              <div className="chip-row roulette-chip-row">
                {CHIP_VALUES.map((value) => (
                  <button
                    key={value}
                    className={`chip-btn chip-${value}`}
                    type="button"
                    title={`+${value}`}
                    onClick={() => addChip(value)}
                    disabled={spinning}
                  >
                    +{value}
                  </button>
                ))}
              </div>

              <div className="bet-line mt-4">
                <span className="muted">Bet amount:</span>
                <strong>{betAmount}</strong>
              </div>

              <div className="bet-types mt-4">
                <div className="muted mb-2">Bet type</div>
                <div className="bet-grid">
                  {(["red", "black", "even", "odd"] as const).map((type) => (
                    <button
                      key={type}
                      className={`btn btn-secondary bet-btn ${bet.type === type ? "active" : ""}`}
                      type="button"
                      onClick={() => selectBetType(type)}
                      disabled={spinning}
                    >
                      {type === "red" || type === "black" ? `${type[0].toUpperCase()}${type.slice(1)} (1:1)` : `${type[0].toUpperCase()}${type.slice(1)} (1:1)`}
                    </button>
                  ))}
                </div>

                <div className="straight mt-3">
                  <label className="muted" htmlFor="numberSelect">Straight (35:1)</label>
                  <select
                    id="numberSelect"
                    className="select"
                    value={selectedNumber}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setSelectedNumber(next);
                      if (bet.type === "number") {
                        setBet({ type: "number", value: next });
                      }
                    }}
                    disabled={spinning}
                  >
                    {Array.from({ length: 37 }, (_, n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    className={`btn btn-secondary bet-btn ${bet.type === "number" ? "active" : ""}`}
                    type="button"
                    onClick={() => selectBetType("number")}
                    disabled={spinning}
                  >
                    Set Number Bet
                  </button>
                </div>

                <div className="mt-3">
                  <span className="muted">Selected bet:</span>
                  <strong id="selectedBet"> {selectedBetText}</strong>
                </div>
              </div>

              <div className="mt-4 cluster roulette-action-row">
                <button className="btn" type="button" onClick={() => void onSpin()} disabled={spinning}>
                  {spinning ? "Spinning..." : "Spin"}
                </button>
                <button className="btn btn-danger" type="button" onClick={() => void resetBank()} disabled={spinning}>
                  Reset Bank
                </button>
              </div>

              <div className="toast info mt-4" role="status" aria-live="polite">
                {status}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
