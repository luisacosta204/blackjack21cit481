import { Link } from "react-router-dom";
import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";

import "./blackjack/blackjack.css";

export default function BlackjackPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");

  const username = user?.username ?? getOrCreateGuestUsername();
  const creditsText = user ? String(user.credits ?? 0) : "—";

  return (
    <>
      <HeaderUserNav
        avatarSrc={avatarSrc}
        username={username}
        subtitle={
          <>
            Credits: <strong>{creditsText}</strong>
          </>
        }
        right={
          <div className="right cluster">
            <Link id="backButton" to="/home" className="back-button btn-secondary btn">
              ⮐ Back to Home
            </Link>

            <label htmlFor="deckSelect" className="muted">
              Deck:
            </label>
            <select id="deckSelect" className="select" disabled aria-label="Deck theme select" />

            <span className="badge" id="bankBadge" title="Your chip balance">
              Bank: —
            </span>
          </div>
        }
      />

      <main className="container bj-layout">
        {/* Playfield */}
        <section className="panel bj-table">
          <div className="bj-title">
            <div>
              <h2 className="panel-header">Table</h2>
              <p className="panel-subtle">
                Beat the dealer without going over 21. Blackjack pays 3:2. Dealer stands on 17.
              </p>
            </div>

            {/* Moved up so it stays visible */}
            <div className="bj-metrics" aria-label="Shoe and count info">
              <span className="muted">Shoe:</span> <span id="shoeInfo">—</span>
              <span className="muted"> | Count:</span> <strong id="countInfo">—</strong>
              <span className="muted"> (</span>
              <strong id="countLabel">Neutral</strong>
              <span className="muted">)</span>
            </div>
          </div>

          <div className="table-wrap">
            <div className="row">
              <div className="hand">
                <div className="label">Dealer</div>
                <div className="cards" id="dealerCards" aria-live="polite" />
                <div className="score" id="dealerScore">
                  Score: —
                </div>
              </div>
            </div>

            <div className="row">
              <div className="hand">
                <div className="label">You</div>
                <div className="cards" id="playerCards" aria-live="polite" />
                <div className="score" id="playerScore">
                  Score: —
                </div>
              </div>
            </div>
          </div>

          <div className="toast info bj-status" id="status" aria-live="polite">
            Place your bet to begin.
          </div>
        </section>

        {/* Controls */}
        <section className="bj-controls" aria-label="Betting and action controls">
          <div className="panel">
            <h3 className="panel-header">Betting</h3>
            <p className="panel-subtle">Set wager, number of hands, then Deal.</p>

            <div className="cluster bj-chips">
              <button className="chip-btn chip-5" data-chip="5" title="+5" type="button">
                +5
              </button>
              <button className="chip-btn chip-25" data-chip="25" title="+25" type="button">
                +25
              </button>
              <button className="chip-btn chip-100" data-chip="100" title="+100" type="button">
                +100
              </button>
              <button className="btn-ghost btn" id="clearBetBtn" title="Clear bet" type="button">
                Clear
              </button>
            </div>

            <div className="bet-line mt-4">
              <span className="muted">Bet per Hand:</span>
              <strong id="betAmount">0</strong>
            </div>

            <div className="bet-line mt-2">
              <label htmlFor="handsSelect" className="muted">
                Hands:
              </label>
              <select id="handsSelect" className="select" defaultValue="1">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>

              <span className="muted">Total wager:</span>
              <strong id="totalWager">0</strong>
            </div>

            <div className="mt-4 cluster">
              <button className="btn" id="dealBtn" type="button">
                Deal
              </button>
              <button className="btn-secondary btn" id="newRoundBtn" disabled type="button">
                New Round
              </button>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-header">Actions</h3>
            <p className="panel-subtle">Act on the highlighted hand.</p>

            <div className="cluster bj-actions">
              <button className="btn-secondary btn" id="hitBtn" disabled type="button">
                Hit
              </button>
              <button className="btn-secondary btn" id="standBtn" disabled type="button">
                Stand
              </button>
              <button className="btn-secondary btn" id="doubleBtn" disabled type="button">
                Double
              </button>
              <button className="btn-secondary btn" id="splitBtn" disabled type="button">
                Split
              </button>
              <button className="btn-secondary btn" id="insuranceBtn" disabled type="button">
                Take Insurance
              </button>
              <button className="btn-secondary btn" id="changeDeckBtn" title="Switch card style" disabled type="button">
                Change Deck
              </button>
              <button className="btn-danger btn" id="resetBankBtn" title="Reset bank to 500" disabled type="button">
                Reset Bank
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
