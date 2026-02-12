import { Link } from "react-router-dom";
import { useState } from "react";

import HeaderUserNav from "../components/HeaderUserNav";
import { useAvatar } from "../hooks/useAvatar";
import { useMe } from "../hooks/useMe";
import { getOrCreateGuestUsername } from "../utils/guest";

import type { Card } from "../features/blackjack/types";
import { handValue } from "../features/blackjack/engine";
import { buildShoe, draw } from "../features/blackjack/deck";

import "./blackjack/blackjack.css";

export default function BlackjackPage() {
  const { user } = useMe();
  const { avatarSrc } = useAvatar("/assets/avatars/1.png");

  const username = user?.username ?? getOrCreateGuestUsername();
  const creditsText = user ? String(user.credits ?? 0) : "—";

  // Core card state
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);

  // Shoe (6-deck default)
  const [shoe, setShoe] = useState<Card[]>(() => buildShoe(6));

  // Round state
  const [statusText, setStatusText] = useState("Place your bet to begin.");
  const [inRound, setInRound] = useState(false);
  const [roundOver, setRoundOver] = useState(false);

  const playerScore = playerCards.length ? handValue(playerCards) : null;
  const dealerScore = dealerCards.length ? handValue(dealerCards) : null;

  const canDeal = !inRound || roundOver;
  const canHit = inRound && !roundOver;
  const canStand = inRound && !roundOver;

  const reshuffle = () => {
    setShoe(buildShoe(6));
    setDealerCards([]);
    setPlayerCards([]);
    setStatusText("Reshuffled. Click Deal to start.");
    setInRound(false);
    setRoundOver(false);
  };

  const newRound = () => {
    setDealerCards([]);
    setPlayerCards([]);
    setStatusText("Place your bet to begin.");
    setInRound(false);
    setRoundOver(false);
  };

  const finishRound = (finalDealer: Card[], finalPlayer: Card[], message: string, nextShoe: Card[]) => {
    setDealerCards(finalDealer);
    setPlayerCards(finalPlayer);
    setShoe(nextShoe);
    setStatusText(message);
    setRoundOver(true);
    setInRound(false);
  };

  const stand = (shoeOverride?: Card[], playerOverride?: Card[]) => {
    let currentShoe = shoeOverride ?? shoe;
    const currentPlayer = playerOverride ?? playerCards;

    let currentDealer = [...dealerCards];

    // Dealer draws to 17+
    while (handValue(currentDealer) < 17) {
      const next = draw(currentShoe);
      currentShoe = next.shoe;
      currentDealer.push(next.card);
    }

    const pScore = handValue(currentPlayer);
    const dScore = handValue(currentDealer);

    if (dScore > 21) {
      finishRound(currentDealer, currentPlayer, `Dealer busts (${dScore}). You win!`, currentShoe);
      return;
    }

    if (pScore > dScore) {
      finishRound(currentDealer, currentPlayer, `You win! (${pScore} vs ${dScore})`, currentShoe);
      return;
    }

    if (pScore < dScore) {
      finishRound(currentDealer, currentPlayer, `Dealer wins. (${dScore} vs ${pScore})`, currentShoe);
      return;
    }

    finishRound(currentDealer, currentPlayer, `Push. (${pScore} vs ${dScore})`, currentShoe);
  };

  const hit = () => {
    let currentShoe = shoe;
    const next = draw(currentShoe);
    currentShoe = next.shoe;

    const newPlayer = [...playerCards, next.card];
    setPlayerCards(newPlayer);
    setShoe(currentShoe);

    const pScore = handValue(newPlayer);

    if (pScore > 21) {
      finishRound(dealerCards, newPlayer, `Bust (${pScore}). Dealer wins.`, currentShoe);
      return;
    }

    if (pScore === 21) {
      setStatusText("21! Standing...");
      stand(currentShoe, newPlayer);
      return;
    }

    setStatusText("Hit or Stand.");
  };

  const deal = () => {
    // If shoe is low, reshuffle and reset UI
    if (shoe.length < 20) {
      const newShoe = buildShoe(6);
      setShoe(newShoe);
      setDealerCards([]);
      setPlayerCards([]);
      setStatusText("Reshuffled. Click Deal to start.");
      setInRound(false);
      setRoundOver(false);
      return;
    }

    let currentShoe = shoe;

    const d1 = draw(currentShoe);
    currentShoe = d1.shoe;

    const p1 = draw(currentShoe);
    currentShoe = p1.shoe;

    const d2 = draw(currentShoe);
    currentShoe = d2.shoe;

    const p2 = draw(currentShoe);
    currentShoe = p2.shoe;

    const newDealer = [d1.card, d2.card];
    const newPlayer = [p1.card, p2.card];

    setDealerCards(newDealer);
    setPlayerCards(newPlayer);
    setShoe(currentShoe);

    setInRound(true);
    setRoundOver(false);

    const pScore = handValue(newPlayer);
    const dScore = handValue(newDealer);

    // Player blackjack check
    if (pScore === 21 && newPlayer.length === 2) {
      setStatusText(dScore === 21 ? "Push — both have Blackjack." : "Blackjack! You win.");
      setRoundOver(true);
      setInRound(false);
      return;
    }

    setStatusText("Your turn. Hit or Stand.");
  };

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

            {/* Shoe + count */}
            <div className="bj-metrics" aria-label="Shoe and count info">
              <span className="muted">Shoe:</span>{" "}
              <span id="shoeInfo">{shoe.length} cards</span>
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

                <div className="cards" id="dealerCards" aria-live="polite">
                  {dealerCards.map((c, i) => (
                    <div key={`${c.rank}-${c.suit}-${i}`} className="card-text">
                      {c.rank} {c.suit}
                    </div>
                  ))}
                </div>

                <div className="score" id="dealerScore">
                  Score: {dealerScore ?? "—"}
                </div>
              </div>
            </div>

            <div className="row">
              <div className="hand">
                <div className="label">You</div>

                <div className="cards" id="playerCards" aria-live="polite">
                  {playerCards.map((c, i) => (
                    <div key={`${c.rank}-${c.suit}-${i}`} className="card-text">
                      {c.rank} {c.suit}
                    </div>
                  ))}
                </div>

                <div className="score" id="playerScore">
                  Score: {playerScore ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="toast info bj-status" id="status" aria-live="polite">
            {statusText}
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
              <button className="btn" id="dealBtn" type="button" onClick={deal} disabled={!canDeal}>
                Deal
              </button>

              <button
                className="btn-secondary btn"
                id="newRoundBtn"
                type="button"
                disabled={!roundOver}
                onClick={newRound}
              >
                New Round
              </button>

              {/* Optional helper button while developing */}
              <button className="btn-secondary btn" type="button" onClick={reshuffle}>
                Reshuffle
              </button>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-header">Actions</h3>
            <p className="panel-subtle">Act on the highlighted hand.</p>

            <div className="cluster bj-actions">
              <button
                className="btn-secondary btn"
                id="hitBtn"
                type="button"
                disabled={!canHit}
                onClick={hit}
              >
                Hit
              </button>

              <button
                className="btn-secondary btn"
                id="standBtn"
                type="button"
                disabled={!canStand}
                onClick={() => stand()}
              >
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
              <button
                className="btn-secondary btn"
                id="changeDeckBtn"
                title="Switch card style"
                disabled
                type="button"
              >
                Change Deck
              </button>
              <button
                className="btn-danger btn"
                id="resetBankBtn"
                title="Reset bank to 500"
                disabled
                type="button"
              >
                Reset Bank
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
