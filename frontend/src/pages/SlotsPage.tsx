import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../hooks/useMe';
import { useAvatar } from '../hooks/useAvatar';
import { getOrCreateGuestUsername } from '../utils/guest';
import { updateCredits } from '../api/credits';
import { recordGameResult } from '../api/gameResults';
import { chipUrlForBank } from '../utils/chips';
import HeaderUserNav from "../components/HeaderUserNav";
import './Slots/slots.css';
import '../styles/bank-chip.css';

// Symbols with weighted probabilities
const SYMBOLS = [
  { glyph: '🍒', weight: 24 },
  { glyph: '🍋', weight: 18 },
  { glyph: '⭐', weight: 12 },
  { glyph: '🔔', weight: 8 },
  { glyph: '7️⃣', weight: 6 },
  { glyph: '💎', weight: 3 },
];

// Payout multipliers for 3-of-a-kind
const PAY_MULT: { [key: string]: number } = {
  '💎': 50,
  '7️⃣': 25,
  '🔔': 10,
  '⭐': 8,
  '🍋': 5,
  '🍒': 3,
};

// Bank constants (shared with Blackjack)
const BANK_KEY = 'bjBank';
const START_BANK = 500;

function loadBank(): number {
  const v = localStorage.getItem(BANK_KEY);
  return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : START_BANK;
}

// Weighted random symbol selection (move outside component)
function randomSymbol(): string {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const symbol of SYMBOLS) {
    random -= symbol.weight;
    if (random <= 0) return symbol.glyph;
  }
  
  return SYMBOLS[0].glyph;
}

export default function SlotsPage() {
  const navigate = useNavigate();
  const { user } = useMe();
  const { avatarSrc } = useAvatar('/assets/avatars/1.png');
  
  const username = user?.username ?? getOrCreateGuestUsername();
  
  const [bank, setBank] = useState<number>(() => loadBank());
  const [bet, setBet] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState('Set your bet, then press Spin.');
  
  const reel1Ref = useRef<HTMLDivElement>(null);
  const reel2Ref = useRef<HTMLDivElement>(null);
  const reel3Ref = useRef<HTMLDivElement>(null);

  // Save bank to localStorage
  function saveBank(value: number) {
    localStorage.setItem(BANK_KEY, String(value));
  }

  // Initialize with random symbols
  const [reels, setReels] = useState(() => [randomSymbol(), randomSymbol(), randomSymbol()]);

  // Add chips to bet
  function addChip(amount: number) {
    if (spinning) return;
    if (bank <= 0) {
      setStatus('No credits available!');
      return;
    }
    
    const newBet = Math.min(bank, bet + amount);
    setBet(newBet);
    setStatus(`Bet: ${newBet} credits. Press Spin!`);
  }

  // Clear bet
  function clearBet() {
    if (spinning) return;
    setBet(0);
    setStatus('Bet cleared. Set your bet, then press Spin.');
  }

  // Max bet (cap at 100)
  function maxBet() {
    if (spinning) return;
    const cap = 100;
    const newBet = Math.min(bank, cap);
    setBet(newBet);
    setStatus(`Bet: ${newBet} credits. Press Spin!`);
  }

  // Spin the reels
  async function spin() {
    if (spinning) return;
    if (bet <= 0) {
      setStatus('Please place a bet first.');
      return;
    }
    if (bet > bank) {
      setStatus('Your bet exceeds your credits.');
      return;
    }

    setSpinning(true);
    setStatus('Spinning…');

    // Deduct bet from bank
    const newBank = bank - bet;
    setBank(newBank);
    saveBank(newBank);

    // Update credits on backend (if logged in)
    if (user) {
      try {
        await updateCredits(newBank);
      } catch (err) {
        console.error('Failed to update credits:', err);
      }
    }

    // Generate results
    const results = [randomSymbol(), randomSymbol(), randomSymbol()];

    // Animate reels
    await animateReels(results);

    // Evaluate win
    const payout = evaluateWin(results, bet);
    
    if (payout > 0) {
      const finalBank = newBank + payout;
      setBank(finalBank);
      saveBank(finalBank);
      setStatus(`You won ${payout} credits!`);
      glowReels(true);

      // Update backend (if logged in)
      if (user) {
        try {
          await updateCredits(finalBank);
          await recordGameResult({ won: true, delta: payout - bet });
        } catch (err) {
          console.error('Failed to record win:', err);
        }
      }
    } else {
      setStatus('No win. Try again!');
      glowReels(false);

      // Record loss (if logged in)
      if (user) {
        try {
          await recordGameResult({ won: false, delta: -bet });
        } catch (err) {
          console.error('Failed to record loss:', err);
        }
      }
    }

    setSpinning(false);
  }

  // Animate the reels spinning
  async function animateReels(results: string[]): Promise<void> {
    const reelRefs = [reel1Ref, reel2Ref, reel3Ref];
    
    // Add spinning class and create symbol strips
    reelRefs.forEach((ref, i) => {
      if (!ref.current) return;
      
      ref.current.classList.add('spin');
      
      // Create strip of random symbols ending with final result
      const strip = document.createElement('div');
      strip.className = 'symbol-strip';
      
      // Add 8 random symbols
      for (let j = 0; j < 8; j++) {
        const symbol = document.createElement('div');
        symbol.className = 'symbol';
        symbol.textContent = randomSymbol();
        strip.appendChild(symbol);
      }
      
      // Add final result
      const finalSymbol = document.createElement('div');
      finalSymbol.className = 'symbol';
      finalSymbol.textContent = results[i];
      strip.appendChild(finalSymbol);
      
      ref.current.innerHTML = '';
      ref.current.appendChild(strip);
      
      // Set animation duration (stagger each reel slightly)
      const duration = 900 + i * 100;
      ref.current.style.setProperty('--spin-ms', `${duration}ms`);
    });

    // Wait for animations to complete
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Update state with final results
    setReels(results);

    // Remove spinning class
    reelRefs.forEach(ref => {
      if (ref.current) ref.current.classList.remove('spin');
    });
  }

  // Evaluate win and calculate payout
  function evaluateWin(results: string[], stake: number): number {
    const [a, b, c] = results;
    
    // 3 of a kind
    if (a === b && b === c) {
      const mult = PAY_MULT[a] || 1;
      return stake * mult;
    }
    
    // 2 cherries consolation prize
    if ((a === '🍒' && b === '🍒') || (b === '🍒' && c === '🍒')) {
      return stake;
    }
    
    return 0;
  }

  // Add glow effect to reels
  function glowReels(win: boolean) {
    const reelRefs = [reel1Ref, reel2Ref, reel3Ref];
    
    reelRefs.forEach(ref => {
      if (!ref.current) return;
      
      ref.current.classList.remove('win-glow', 'lose-glow');
      void ref.current.offsetWidth; // Trigger reflow
      ref.current.classList.add(win ? 'win-glow' : 'lose-glow');
      
      setTimeout(() => {
        if (ref.current) {
          ref.current.classList.remove('win-glow', 'lose-glow');
        }
      }, 900);
    });
  }

  return (
    <div className="slots-page">
      {/* Header */}
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

      {/* Main content */}
      <main className="container stack">
        <section className="panel">
          <h2 className="panel-header">Classic Slots</h2>
          <p className="panel-subtle">
            Three reels, single payline. Line up matching symbols to win. 7s and 💎 pay best.
          </p>

          {/* Reels */}
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
            <div className="payline-marker" aria-hidden="true"></div>
          </div>

          <div className="toast info mt-6" role="status" aria-live="polite">
            {status}
          </div>
        </section>

        {/* Controls */}
        <div className="grid cols-2">
          <div className="panel">
            <h3 className="panel-header">Betting</h3>
            <p className="panel-subtle">Add chips to your bet, then Spin.</p>

            <div className="bet-line">
              <span className="muted">Bet:</span>
              <strong id="betAmount">{bet}</strong>
            </div>

            <div className="cluster bj-chips" style={{ marginTop: '16px' }}>
              <button
                className="chip-btn chip-5"
                title="+5"
                onClick={() => addChip(5)}
                disabled={spinning}
              >
                +5
              </button>
              <button
                className="chip-btn chip-25"
                title="+25"
                onClick={() => addChip(25)}
                disabled={spinning}
              >
                +25
              </button>
              <button
                className="chip-btn chip-100"
                title="+100"
                onClick={() => addChip(100)}
                disabled={spinning}
              >
                +100
              </button>
            </div>

            <div className="btn-row" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={clearBet}
                disabled={spinning}
              >
                Clear Bet
              </button>
              <button
                className="btn btn-secondary"
                onClick={maxBet}
                disabled={spinning}
              >
                Max Bet
              </button>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-header">Paytable</h3>
            <div className="paytable">
              <div className="pay-row">
                <span>💎 💎 💎</span>
                <span>50x</span>
              </div>
              <div className="pay-row">
                <span>7️⃣ 7️⃣ 7️⃣</span>
                <span>25x</span>
              </div>
              <div className="pay-row">
                <span>🔔 🔔 🔔</span>
                <span>10x</span>
              </div>
              <div className="pay-row">
                <span>⭐ ⭐ ⭐</span>
                <span>8x</span>
              </div>
              <div className="pay-row">
                <span>🍋 🍋 🍋</span>
                <span>5x</span>
              </div>
              <div className="pay-row">
                <span>🍒 🍒 🍒</span>
                <span>3x</span>
              </div>
              <div className="pay-row muted small">
                <span>🍒 🍒 *</span>
                <span>1x</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={spin}
              disabled={spinning || bet <= 0}
              style={{ marginTop: '16px', width: '100%' }}
            >
              {spinning ? 'Spinning...' : 'Spin'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
