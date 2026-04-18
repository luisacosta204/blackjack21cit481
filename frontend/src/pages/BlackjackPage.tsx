import { useMemo } from "react";
import { Link } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";
import CenteredMain from "../components/CenteredMain";
import { chipUrlForBank } from "../utils/chips";
import { useDeckTheme } from "../hooks/useDeckTheme";

export default function BlackjackPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");
  const username = useMemo(
    () => user?.username ?? getOrCreateGuestUsername(),
    [user]
  );

  const bank = Number(localStorage.getItem("bjBank") ?? 500);

  const { deckId, setDeckId, deckOptions } = useDeckTheme();

  // --- YOUR EXISTING GAME STATE ---
  // (these should already exist in your file)
  const shoe: any[] = [];
  const playerCards: any[] = [];
  const dealerCards: any[] = [];

  const playerScore = 0;
  const dealerScore = 0;

  // =========================
  // ✅ COUNT LOGIC (SAFE)
  // =========================
  function hiLoValue(card: any): number {
    if (["2", "3", "4", "5", "6"].includes(card.rank)) return 1;
    if (["10", "J", "Q", "K", "A"].includes(card.rank)) return -1;
    return 0;
  }

  const decksRemaining = Math.max(shoe.length / 52, 1);

  const runningCount = [...playerCards, ...dealerCards].reduce(
    (sum, card) => sum + hiLoValue(card),
    0
  );

  const trueCount = runningCount / decksRemaining;

  let countLabel = "Neutral";
  if (trueCount >= 2) countLabel = "Hot";
  else if (trueCount <= -2) countLabel = "Cold";

  // =========================

  return (
    <>
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <span
            id="bankBadge"
            aria-label={`Bank: ${bank} chips`}
            style={{
              ["--bank-chip-url" as string]: `url("${chipUrlForBank(bank)}")`,
            }}
          >
            {bank}
          </span>
        }
        right={
          <div className="bj-header-controls">
            <Link
              to="/home"
              className="btn btn-secondary bj-header-home"
            >
              ↩ Back to Home
            </Link>

            <label className="select bj-deck-select">
              <span>Deck:</span>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
              >
                {deckOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      <CenteredMain maxWidth={1200}>
        <main className="container bj-layout">
          <section className="bj-table">
            <div className="table-wrap">
              <div className="bj-title">
                <div>
                  <h2 className="panel-header">Table</h2>
                  <p className="panel-subtle">
                    Beat the dealer without going over 21. Blackjack pays 3:2. Dealer stands on 17.
                  </p>
                </div>

                {/* ✅ COUNT DISPLAY */}
                <div className="bj-metrics">
                  <span className="muted">Shoe:</span>{" "}
                  {shoe.length} cards
                  <span className="muted"> | Count:</span>{" "}
                  <strong>
                    {trueCount >= 0 ? "+" : ""}
                    {trueCount.toFixed(1)}
                  </strong>
                  <span className="muted"> (</span>
                  <strong>{countLabel}</strong>
                  <span className="muted">)</span>
                </div>
              </div>

              {/* DEALER */}
              <div className="row">
                <div className="hand">
                  <div className="label">Dealer</div>
                  <div className="cards">
                    {dealerCards.map((c, i) => (
                      <img key={i} src={`/assets/decks/${deckId}/${c.image}`} />
                    ))}
                  </div>
                  <div className="score">Score: {dealerScore}</div>
                </div>
              </div>

              {/* PLAYER */}
              <div className="row">
                <div className="hand">
                  <div className="label">You</div>
                  <div className="cards">
                    {playerCards.map((c, i) => (
                      <img key={i} src={`/assets/decks/${deckId}/${c.image}`} />
                    ))}
                  </div>
                  <div className="score">Score: {playerScore}</div>
                </div>
              </div>

              <div className="toast info">
                Game state message here
              </div>
            </div>
          </section>

          <section className="bj-controls">
            <div className="panel">
              <h3>Betting</h3>
              {/* your betting UI */}
            </div>

            <div className="panel">
              <h3>Actions</h3>
              <div className="cluster bj-actions">
                <button className="btn">Hit</button>
                <button className="btn">Stand</button>
                <button className="btn">Double</button>
                <button className="btn">Split</button>
                <button className="btn">Take Insurance</button>
                <button className="btn btn-danger" id="resetBankBtn">
                  Reset Bank
                </button>
              </div>
            </div>
          </section>
        </main>
      </CenteredMain>
    </>
  );
}