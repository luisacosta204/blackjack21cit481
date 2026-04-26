import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import { updateCredits } from "../api/credits";
import { recordProfileGameResult } from "../utils/profileStats";
import { recordGameResult } from "../api/gameResults";
import { chipUrlForBank, chipUrlForTableTotal } from "../utils/chips";
import "./craps/craps.css";
import "../styles/bank-chip.css";

const BANK_KEY = "bjBank";
const START_BANK = 500;
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"] as const;
const CHIP_VALUES = [5, 25, 100] as const;

type BetKey = "pass" | "dont" | "field" | "any7";
type Phase = "comeout" | "point";
type Bets = Record<BetKey, number>;

type RollResolution = {
  total: number;
  phaseBefore: Phase;
  pointBefore: number | null;
  phaseAfter: Phase;
  pointAfter: number | null;
  events: string[];
  isSeven: boolean;
  isFieldWin: boolean;
};

const BET_LABEL: Record<BetKey, string> = {
  pass: "Pass Line",
  dont: "Don't Pass",
  field: "Field",
  any7: "Any 7",
};

const EMPTY_BETS: Bets = {
  pass: 0,
  dont: 0,
  field: 0,
  any7: 0,
};

function loadBank(): number {
  const raw = localStorage.getItem(BANK_KEY);
  const n = raw == null ? NaN : parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    localStorage.setItem(BANK_KEY, String(START_BANK));
    return START_BANK;
  }
  return n;
}

function saveBank(value: number): void {
  localStorage.setItem(BANK_KEY, String(value));
}

function rand1to6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sumBets(bets: Bets): number {
  return Object.values(bets).reduce((a, b) => a + b, 0);
}

function resolveRoll(total: number, phase: Phase, point: number | null): RollResolution {
  const result: RollResolution = {
    total,
    phaseBefore: phase,
    pointBefore: point,
    phaseAfter: phase,
    pointAfter: point,
    events: [],
    isSeven: total === 7,
    isFieldWin: [2, 3, 4, 9, 10, 11, 12].includes(total),
  };

  if (phase === "comeout") {
    if (total === 7 || total === 11) {
      result.events.push("Natural on the come-out.");
    } else if (total === 2 || total === 3 || total === 12) {
      result.events.push("Craps on the come-out.");
    } else {
      result.phaseAfter = "point";
      result.pointAfter = total;
      result.events.push(`Point is set to ${total}.`);
    }
    return result;
  }

  if (total === 7) {
    result.phaseAfter = "comeout";
    result.pointAfter = null;
    result.events.push("Seven out. New come-out roll.");
  } else if (total === point) {
    result.phaseAfter = "comeout";
    result.pointAfter = null;
    result.events.push(`Hit the point (${point}). New come-out roll.`);
  } else {
    result.events.push("No decision on line bets.");
  }

  return result;
}

export default function CrapsPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = useMemo(() => user?.username ?? getOrCreateGuestUsername(), [user]);

  const [bank, setBank] = useState<number>(() => loadBank());
  const [phase, setPhase] = useState<Phase>("comeout");
  const [point, setPoint] = useState<number | null>(null);
  const [bets, setBets] = useState<Bets>(EMPTY_BETS);
  const [selectedBet, setSelectedBet] = useState<BetKey>("pass");
  const [rolling, setRolling] = useState(false);
  const [status, setStatus] = useState("Click a betting area, add chips, then Roll.");
  const [payoutLine, setPayoutLine] = useState("—");
  const [lastRoll, setLastRoll] = useState("—");
  const [dieA, setDieA] = useState(1);
  const [dieB, setDieB] = useState(1);

  const totalBet = sumBets(bets);

  useEffect(() => {
    saveBank(bank);
  }, [bank]);

  const syncBackendCredits = async (nextBank: number) => {
    if (!user) return;
    try {
      await updateCredits(nextBank);
    } catch (error) {
      console.error("Failed to sync craps credits:", error);
    }
  };

  const addChip = async (amount: number) => {
    if (rolling) return;
    if (bank <= 0) {
      setStatus("Bank is empty. Reset bank to continue.");
      return;
    }
    if (amount > bank) {
      setStatus("Not enough chips in bank.");
      return;
    }

    const nextBank = bank - amount;
    setBank(nextBank);
    setBets((prev) => ({ ...prev, [selectedBet]: prev[selectedBet] + amount }));
    setPayoutLine("—");
    setStatus(`${BET_LABEL[selectedBet]} +${amount}`);
    void syncBackendCredits(nextBank);
  };

  const clearSelected = async () => {
    if (rolling || bets[selectedBet] <= 0) return;
    const refund = bets[selectedBet];
    const nextBank = bank + refund;
    setBets((prev) => ({ ...prev, [selectedBet]: 0 }));
    setBank(nextBank);
    setPayoutLine("—");
    setStatus(`Cleared ${BET_LABEL[selectedBet]} bet.`);
    void syncBackendCredits(nextBank);
  };

  const clearAll = async () => {
    if (rolling || totalBet <= 0) return;
    const refund = totalBet;
    const nextBank = bank + refund;
    setBets(EMPTY_BETS);
    setBank(nextBank);
    setPayoutLine("—");
    setStatus("All bets cleared.");
    void syncBackendCredits(nextBank);
  };

  const resetBank = async () => {
    if (rolling) return;
    setBank(START_BANK);
    setStatus(`Bank reset to ${START_BANK} chips.`);
    setPayoutLine("—");
    void syncBackendCredits(START_BANK);
  };

  const applyPayouts = async (resolution: RollResolution): Promise<void> => {
    let delta = 0;
    const lines: string[] = [];
    const nextBets: Bets = { ...bets };

    if (nextBets.field > 0) {
      const stake = nextBets.field;
      if (resolution.isFieldWin) {
        const mult = resolution.total === 2 || resolution.total === 12 ? 2 : 1;
        const win = stake * mult;
        delta += stake + win;
        lines.push(`Field wins x${mult}: +${win}`);
      } else {
        lines.push(`Field loses: -${stake}`);
      }
      nextBets.field = 0;
    }

    if (nextBets.any7 > 0) {
      const stake = nextBets.any7;
      if (resolution.isSeven) {
        const win = stake * 4;
        delta += stake + win;
        lines.push(`Any 7 hits x4: +${win}`);
      } else {
        lines.push(`Any 7 loses: -${stake}`);
      }
      nextBets.any7 = 0;
    }

    const decidedComeout =
      resolution.phaseBefore === "comeout" &&
      [7, 11, 2, 3, 12].includes(resolution.total);
    const decidedPoint =
      resolution.phaseBefore === "point" &&
      (resolution.total === 7 || resolution.total === resolution.pointBefore);

    if (nextBets.pass > 0) {
      const stake = nextBets.pass;
      if (resolution.phaseBefore === "comeout" && decidedComeout) {
        if (resolution.total === 7 || resolution.total === 11) {
          const win = stake;
          delta += stake + win;
          lines.push(`Pass wins: +${win}`);
        } else {
          lines.push(`Pass loses: -${stake}`);
        }
        nextBets.pass = 0;
      } else if (resolution.phaseBefore === "point" && decidedPoint) {
        if (resolution.total === resolution.pointBefore) {
          const win = stake;
          delta += stake + win;
          lines.push(`Pass hits point: +${win}`);
        } else {
          lines.push(`Pass seven-out: -${stake}`);
        }
        nextBets.pass = 0;
      }
    }

    if (nextBets.dont > 0) {
      const stake = nextBets.dont;
      if (resolution.phaseBefore === "comeout" && decidedComeout) {
        if (resolution.total === 2 || resolution.total === 3) {
          const win = stake;
          delta += stake + win;
          lines.push(`Don't Pass wins: +${win}`);
        } else if (resolution.total === 12) {
          delta += stake;
          lines.push("Don't Pass pushes on 12: +0");
        } else {
          lines.push(`Don't Pass loses: -${stake}`);
        }
        nextBets.dont = 0;
      } else if (resolution.phaseBefore === "point" && decidedPoint) {
        if (resolution.total === 7) {
          const win = stake;
          delta += stake + win;
          lines.push(`Don't Pass wins (7-out): +${win}`);
        } else {
          lines.push(`Don't Pass loses (point hit): -${stake}`);
        }
        nextBets.dont = 0;
      }
    }

    const nextBank = Math.max(0, bank + delta);
    setBets(nextBets);
    setBank(nextBank);
    setPayoutLine(lines.length ? `${delta >= 0 ? "+" : ""}${delta}` : "—");
    setStatus(`${resolution.events.join(" ")} ${lines.join(" • ")}`.trim() || "No payouts.");

    if (delta !== 0) {
      recordProfileGameResult("craps", delta > 0);
    }

    if (user) {
      try {
        await updateCredits(nextBank);
        if (delta !== 0) {
          await recordGameResult({ won: delta > 0, delta });
        }
      } catch (error) {
        console.error("Failed to persist craps result:", error);
      }
    }
  };

  const roll = async () => {
    if (rolling) return;
    if (totalBet <= 0) {
      setStatus("Place at least one bet first.");
      return;
    }

    setRolling(true);
    setPayoutLine("—");

    for (let i = 0; i < 10; i += 1) {
      setDieA(rand1to6());
      setDieB(rand1to6());
      await wait(45);
    }

    const a = rand1to6();
    const b = rand1to6();
    const total = a + b;
    const resolution = resolveRoll(total, phase, point);

    setDieA(a);
    setDieB(b);
    setLastRoll(`${a} + ${b} = ${total}`);
    setPhase(resolution.phaseAfter);
    setPoint(resolution.pointAfter);

    await applyPayouts(resolution);
    setRolling(false);
  };

  return (
    <div className="craps-page">
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
          <div className="right cluster craps-header-actions">
            <Link to="/home" className="back-button btn-secondary btn">
              ⮐ Back to Home
            </Link>
            
          </div>
        }
      />

      <main className="container stack craps-layout">
        <section className="panel craps-wrap" aria-label="Craps table">
          <div className="craps-head">
            <div>
              <h2 className="panel-header">Table</h2>
              <div className="panel-subtle">{phase === "comeout" ? "Come-out roll" : "Point established"}</div>
            </div>
            <div className="point-pill" aria-label="Point">
              <span className="muted">Point</span>
              <strong>{point ?? "—"}</strong>
            </div>
          </div>

          <div className="table-grid" role="group" aria-label="Betting areas">
            {([
              ["pass", "Pays 1:1"],
              ["dont", "Pays 1:1 (12 push)"],
              ["field", "2/12 pay 2:1"],
              ["any7", "Pays 4:1"],
            ] as [BetKey, string][]).map(([key, meta]) => (
              <button
                key={key}
                className={`bet-spot ${selectedBet === key ? "selected" : ""}`}
                type="button"
                onClick={() => !rolling && setSelectedBet(key)}
                aria-pressed={selectedBet === key}
              >
                <div className="spot-title">{key === "dont" ? "DON'T PASS" : BET_LABEL[key].toUpperCase()}</div>
                <div className="spot-meta">{meta}</div>
                <div className="spot-amt">
                  <span className="muted">Bet</span>
                  <strong>{bets[key]}</strong>
                </div>
              </button>
            ))}
          </div>

          <div className="dice-row" aria-label="Dice">
            <div className={`dice ${rolling ? "rolling" : ""}`}>{DICE_FACES[dieA - 1]}</div>
            <div className={`dice ${rolling ? "rolling" : ""}`}>{DICE_FACES[dieB - 1]}</div>
            <div className="roll-info">
              <div className="muted small">Last roll</div>
              <div className="big">{lastRoll}</div>
            </div>
          </div>

          <div className="status" role="status" aria-live="polite">
            {status}
          </div>
        </section>

        <section className="grid cols-2 craps-controls" aria-label="Controls">
          <div className="panel">
            <div className="row between">
              <div>
                <div className="muted small">Selected bet</div>
                <div className="big">{BET_LABEL[selectedBet]}</div>
              </div>
              <div>
                <div className="muted small">Total on table</div>
                <div
                  className="craps-chip-badge total"
                  id="totalBet"
                  aria-label={`Total on table: ${totalBet} chips`}
                  style={{ ["--bank-chip-url" as string]: `url("${chipUrlForTableTotal(totalBet)}")` }}
                >
                  {totalBet}
                </div>
              </div>
            </div>

            <div className="chip-row" aria-label="Chips">
              {CHIP_VALUES.map((value) => (
                <button
                  key={value}
                  className={`chip-btn chip-${value}`}
                  type="button"
                  title={`+${value}`}
                  onClick={() => void addChip(value)}
                  disabled={rolling || bank < value}
                >
                  +{value}
                </button>
              ))}
            </div>

            <div className="btn-row">
              <button className="btn btn-secondary" type="button" onClick={() => void clearSelected()} disabled={rolling || bets[selectedBet] <= 0}>
                Clear Selected
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => void clearAll()} disabled={rolling || totalBet <= 0}>
                Clear All
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => void resetBank()} disabled={rolling}>
                Reset Bank
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="row between">
              <div>
                <div className="muted small">Bank</div>
                <div
                  className="craps-chip-badge bank"
                  id="bankLine"
                  aria-label={`Bank: ${bank} chips`}
                  style={{ ["--bank-chip-url" as string]: `url("${chipUrlForBank(bank)}")` }}
                >
                  {bank}
                </div>
              </div>
              <div>
                <div className="muted small">Payout</div>
                <div className="big">{payoutLine}</div>
              </div>
            </div>

            <button className="btn btn-primary" type="button" onClick={() => void roll()} disabled={rolling || totalBet <= 0}>
              {rolling ? "Rolling..." : "Roll"}
            </button>
            <div className="muted small mt-2">Tip: click a betting area to select it, then tap chips to add.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
