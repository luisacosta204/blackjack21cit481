import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useMe } from "../hooks/useMe";
import { useAvatar } from "../hooks/useAvatar";
import { getOrCreateGuestUsername } from "../utils/guest";
import { updateCredits } from "../api/credits";
import { recordGameResult } from "../api/gameResults";
import { recordProfileGameResult } from "../utils/profileStats";
import { chipUrlForBank } from "../utils/chips";
import "./Slots/slots.css";

type SymbolKey = "🍒" | "🍋" | "⭐" | "🔔" | "7️⃣" | "💎";

type ReelState = SymbolKey[];

const SYMBOLS: Array<{ glyph: SymbolKey; weight: number }> = [
  { glyph: "🍒", weight: 24 },
  { glyph: "🍋", weight: 18 },
  { glyph: "⭐", weight: 12 },
  { glyph: "🔔", weight: 8 },
  { glyph: "7️⃣", weight: 6 },
  { glyph: "💎", weight: 3 },
];

const PAY_MULT: Record<SymbolKey, number> = {
  "💎": 50,
  "7️⃣": 25,
  "🔔": 10,
  "⭐": 8,
  "🍋": 5,
  "🍒": 3,
};

const SLOT_IMAGE: Record<SymbolKey, string> = {
  "🍒": "/assets/slots/neon/cherry.png",
  "🍋": "/assets/slots/neon/lemon.png",
  "⭐": "/assets/slots/neon/star.png",
  "🔔": "/assets/slots/neon/bell.png",
  "7️⃣": "/assets/slots/neon/seven.png",
  "💎": "/assets/slots/neon/diamond.png",
};

const BANK_KEY = "bjBank";
const START_BANK = 500;

function loadBank(): number {
  const v = localStorage.getItem(BANK_KEY);
  return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : START_BANK;
}

function randomSymbol(): SymbolKey {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const symbol of SYMBOLS) {
    random -= symbol.weight;
    if (random <= 0) return symbol.glyph;
  }

  return SYMBOLS[0].glyph;
}

function renderSymbol(glyph: SymbolKey, compact = false) {
  return <img src={SLOT_IMAGE[glyph]} alt={glyph} className={compact ? "symbol-mini" : "symbol-image"} />;
}

function buildStrip(finalSymbol: SymbolKey): ReelState {
  const strip: ReelState = [];
  for (let i = 0; i < 8; i += 1) strip.push(randomSymbol());
  strip.push(finalSymbol);
  return strip;
}

export default function SlotsPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = user?.username ?? getOrCreateGuestUsername();

  const [bank, setBank] = useState<number>(() => loadBank());
  const [bet, setBet] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("Set your bet, then press Spin.");
  const [reels, setReels] = useState<[SymbolKey, SymbolKey, SymbolKey]>(() => [randomSymbol(), randomSymbol(), randomSymbol()]);
  const [animatedStrips, setAnimatedStrips] = useState<[ReelState | null, ReelState | null, ReelState | null]>([null, null, null]);

  const timeoutRef = useRef<number | null>(null);

  function saveBank(value: number) {
    localStorage.setItem(BANK_KEY, String(value));
  }

  function addChip(amount: number) {
    if (spinning) return;
    if (bank <= 0) {
      setStatus("No credits available.");
      return;
    }

    const nextBet = Math.min(bank, bet + amount);
    setBet(nextBet);
    setStatus(`Bet: ${nextBet} credits. Press Spin.`);
  }

  function clearBet() {
    if (spinning) return;
    setBet(0);
    setStatus("Bet cleared. Set your bet, then press Spin.");
  }

  function maxBet() {
    if (spinning) return;
    const nextBet = Math.min(bank, 100);
    setBet(nextBet);
    setStatus(`Bet: ${nextBet} credits. Press Spin.`);
  }

  function evaluateWin(results: [SymbolKey, SymbolKey, SymbolKey], stake: number): number {
    const [a, b, c] = results;
    if (a === b && b === c) return stake * PAY_MULT[a];
    const cherries = [a, b, c].filter((g) => g === "🍒").length;
    return cherries >= 2 ? stake : 0;
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

    const bankAfterBet = bank - bet;
    setBank(bankAfterBet);
    saveBank(bankAfterBet);

    if (user) {
      try {
        await updateCredits(bankAfterBet);
      } catch (err) {
        console.error("Failed to update credits:", err);
      }
    }

    const results: [SymbolKey, SymbolKey, SymbolKey] = [randomSymbol(), randomSymbol(), randomSymbol()];
    setAnimatedStrips([buildStrip(results[0]), buildStrip(results[1]), buildStrip(results[2])]);

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(async () => {
      setAnimatedStrips([null, null, null]);
      setReels(results);

      const payout = evaluateWin(results, bet);
      const didWin = payout > 0;
      const finalBank = didWin ? bankAfterBet + payout : bankAfterBet;

      setBank(finalBank);
      saveBank(finalBank);
      recordProfileGameResult("slots", didWin);

      if (didWin) {
        setStatus(`You won ${payout} credits!`);
      } else {
        setStatus("No win. Try again!");
      }

      if (user) {
        try {
          await updateCredits(finalBank);
          await recordGameResult({ won: didWin, delta: didWin ? payout - bet : -bet });
        } catch (err) {
          console.error("Failed to record slots result:", err);
        }
      }

      setSpinning(false);
    }, 1350);
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
          <Link to="/home" className="btn btn-secondary">
            ↵ Back to Home
          </Link>
        }
      />

      <main className="container stack">
        <section className="panel">
          <h2 className="panel-header">Classic Slots</h2>
          <p className="panel-subtle">Three reels, single payline. Line up matching symbols to win. 7s and diamonds pay best.</p>

          <div className="slot-wrap">
            <div className="reels">
              {[0, 1, 2].map((index) => (
                <div className={`reel ${animatedStrips[index] ? "spin" : ""}`} key={index} aria-label={`Reel ${index + 1}`}>
                  {animatedStrips[index] ? (
                    <div className="symbol-strip" style={{ ["--spin-ms" as string]: `${900 + index * 150}ms` }}>
                      {animatedStrips[index]?.map((glyph, itemIndex) => (
                        <div className="symbol" key={`${index}-${itemIndex}-${glyph}`}>
                          {renderSymbol(glyph)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="symbol">{renderSymbol(reels[index])}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="payline-marker" aria-hidden="true"></div>
          </div>

          <div className="toast info mt-6" role="status" aria-live="polite">
            {status}
          </div>
        </section>

        <div className="grid cols-2 slots-controls-grid">
          <div className="panel">
            <h3 className="panel-header">Betting</h3>
            <p className="panel-subtle">Add chips to your bet, then spin.</p>

            <div className="bet-line">
              <span className="muted">Bet:</span>
              <strong id="betAmount">{bet}</strong>
            </div>

            <div className="cluster bj-chips slots-chip-row" style={{ marginTop: "16px" }}>
              <button className="chip-btn chip-5" title="+5" onClick={() => addChip(5)} disabled={spinning} />
              <button className="chip-btn chip-25" title="+25" onClick={() => addChip(25)} disabled={spinning} />
              <button className="chip-btn chip-100" title="+100" onClick={() => addChip(100)} disabled={spinning} />
            </div>

            <div className="btn-row slots-btn-row">
              <button className="btn btn-secondary" onClick={clearBet} disabled={spinning}>Clear Bet</button>
              <button className="btn btn-secondary" onClick={maxBet} disabled={spinning}>Max Bet</button>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-header">Paytable</h3>
            <div className="paytable">
              {(["💎", "7️⃣", "🔔", "⭐", "🍋", "🍒"] as SymbolKey[]).map((glyph) => (
                <div className="pay-row" key={glyph}>
                  <span className="pt-sym">{renderSymbol(glyph, true)}{renderSymbol(glyph, true)}{renderSymbol(glyph, true)}</span>
                  <span>{PAY_MULT[glyph]}x</span>
                </div>
              ))}
              <div className="pay-row muted small">
                <span className="pt-sym">{renderSymbol("🍒", true)}{renderSymbol("🍒", true)}*</span>
                <span>1x</span>
              </div>
            </div>

            <button className="btn btn-primary slots-spin-btn" onClick={spin} disabled={spinning || bet <= 0}>
              {spinning ? "Spinning..." : "Spin"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
