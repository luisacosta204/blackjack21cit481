/* Classic Slots: 3 reels, single payline.
   - Shared chip bank with Blackjack via localStorage key "bjBank"
   - Weighted symbols, paytable, animated spins
   - Max Bet helper, bank reset, status toasts
*/
console.log('[SLOTS] build=dev1');

(() => {
  // ---- DOM ----
  const bankBadgeEl = document.getElementById('bankBadge');
  const statusEl = document.getElementById('status');

  const reelEls = [ 'reel1', 'reel2', 'reel3' ].map(id => document.getElementById(id));

  const chipButtons = document.querySelectorAll('.chip-btn');
  const clearBetBtn = document.getElementById('clearBetBtn');
  const spinBtn = document.getElementById('spinBtn');
  const maxBetBtn = document.getElementById('maxBetBtn');
  const resetBankBtn = document.getElementById('resetBankBtn');

  const betAmountEl = document.getElementById('betAmount');

  // ---- Bank (shared with Blackjack) ----
  const BANK_KEY = 'bjBank';         // same key as Blackjack so chips carry across games
  const START_BANK = 500;

  // ---- Symbols / weights / paytable ----
  // Heavier weight = more common
  const SYMBOLS = [
    { glyph: '🍒', weight: 24 },
    { glyph: '🍋', weight: 18 },
    { glyph: '⭐',  weight: 12 },
    { glyph: '🔔', weight: 8  },
    { glyph: '7️⃣', weight: 6  },
    { glyph: '💎', weight: 3  },
  ];

  // Payouts are multipliers for 3-in-a-row. Consolation for two cherries.
  const PAY_MULT = {
    '💎': 50,
    '7️⃣': 25,
    '🔔': 10,
    '⭐':  8,
    '🍋':  5,
    '🍒':  3,
    };

    // ---- Symbol packs (rendering skins) ----
    // Keep logical glyphs the same; only the *rendering* changes.
    // Drop your images at: assets/slots/neon/{cherry.png, lemon.png, star.png, bell.png, seven.png, diamond.png}
    const PACKS = {
        emoji: { type: 'emoji' },
        neon: {
            type: 'image',
            basePath: 'assets/slots/neon',
            map: {
                '🍒': 'cherry.png',
                '🍋': 'lemon.png',
                '⭐': 'star.png',
                '🔔': 'bell.png',
                '7️⃣': 'seven.png',
                '💎': 'diamond.png'
            }
        }
    };
    const PACK_KEY = 'slots.symbolPack';
    let currentPackName = localStorage.getItem(PACK_KEY) || 'emoji';


  let bank = loadBank();
  let bet = 0;
  let spinning = false;

  // ---- Init ----
  updateBankBadge();
  updateBetLabel();
  setStatus('Set your bet, then press Spin.');

  // Seed reels with random symbols
    renderStatic([randSymbol(), randSymbol(), randSymbol()]);
    renderPaytable();
    updateButtons();

  // ---- Events ----
  chipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (spinning) return;
      const add = parseInt(btn.dataset.chip, 10);
      if (bank <= 0) return;
      bet = Math.min(bank, bet + add);
      updateBetLabel();
      updateButtons();
    });
  });

  clearBetBtn.addEventListener('click', () => {
    if (spinning) return;
    bet = 0;
    updateBetLabel();
    updateButtons();
  });

  maxBetBtn.addEventListener('click', () => {
    if (spinning) return;
    // Choose a friendly cap so spins remain frequent
    const cap = 100;
    bet = Math.min(bank, cap);
    updateBetLabel();
    updateButtons();
  });

  resetBankBtn.addEventListener('click', () => {
    if (spinning) return;
    bank = START_BANK;
    saveBank();
    updateBankBadge();
    setStatus('Bank reset to 500 chips.');
    updateButtons();
  });

  spinBtn.addEventListener('click', onSpin);

  // Back nav (match site)
  document.getElementById('backButton')?.addEventListener('click', () => {
    window.location.href = 'home.html';
  });

  // ---- Logic ----
  function onSpin() {
    if (spinning) return;
    if (bet <= 0) return setStatus('Please place a bet first.');
    if (bet > bank) return setStatus('Your bet exceeds your bank.');

    spinning = true;
    updateButtons();

    // Deduct bet
    bank -= bet;
    saveBank();
    updateBankBadge();
    setStatus('Spinning…');

    // Build strips and animate
    const results = [randSymbol(), randSymbol(), randSymbol()];
      animateReels(results).then((landed) => {
          const payout = evaluate(landed, bet);
      if (payout > 0) {
        bank += payout;
        saveBank();
        updateBankBadge();
        setStatus(`You won ${payout} chips!`);
        glowReels(true);
      } else {
        setStatus('No win. Try again!');
        glowReels(false);
      }
      spinning = false;
      updateButtons();
    });
  }

    function centerSymbol(el) {
        // Find the glyph exactly under the reel's payline (its vertical center)
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const elem = document.elementFromPoint(x, y);
        return (elem && elem.classList.contains('symbol')) ? elem.textContent.trim() : null;
    }

  function evaluate([a,b,c], stake) {
    // 3 of a kind
    if (a === b && b === c) {
      const mult = PAY_MULT[a] ?? 0;
      return stake * mult;
    }
    // consolation: two cherries → push (x1)
    const cherries = [a,b,c].filter(g => g === '🍒').length;
    if (cherries >= 2) return stake * 1;
    return 0;
  }

    function animateReels(plannedFinals) {
        const durations = [900, 1050, 1200]; // ms

        return new Promise(resolve => {
            let done = 0;
            const landed = Array(reelEls.length);

            reelEls.forEach((el, i) => {
                const strip = buildStrip(plannedFinals[i]);
                strip.style.setProperty('--spin-ms', `${durations[i]}ms`);
                el.innerHTML = '';
                el.appendChild(strip);
                el.classList.add('spin');

                setTimeout(() => {
                    // Freeze what the player actually sees under the payline.
                    const seen = centerSymbol(el) || plannedFinals[i];
                    el.classList.remove('spin');
                    el.innerHTML = '';
                    el.appendChild(createSymbolEl(seen)); // ← uses the active pack (emoji or images)

                    landed[i] = seen;
                    done++;
                    if (done === reelEls.length) resolve(landed);
                }, durations[i] + 30); // tiny buffer to ensure the frame has painted
            });
        });
    }

    const symbolPackSelect = document.getElementById('symbolPackSelect');
    symbolPackSelect.value = currentPackName;
    symbolPackSelect.addEventListener('change', () => {
        currentPackName = symbolPackSelect.value;
        localStorage.setItem(PACK_KEY, currentPackName);
        const visible = reelEls.map(el => el.querySelector('.symbol')?.dataset.glyph || randSymbol());
        renderStatic(visible);  // keep what’s showing, just reskin
        renderPaytable();       // rebuild paytable icons
    });

    function getCurrentPack() {
        return PACKS[currentPackName] || PACKS.emoji;
    }

    function createSymbolEl(glyph) {
        const el = document.createElement('div');
        el.className = 'symbol';
        el.dataset.glyph = glyph;

        const pack = getCurrentPack();
        if (pack.type === 'image') {
            const img = new Image();
            img.src = `${pack.basePath}/${pack.map[glyph]}`;
            img.alt = glyph;
            el.appendChild(img);
        } else {
            el.textContent = glyph;
        }
        return el;
    }

    // Rebuild paytable to match the visual style
    function renderPaytable() {
        const pt = document.getElementById('paytable');
        if (!pt) return;
        const triples = ['💎', '7️⃣', '🔔', '⭐', '🍋', '🍒'];
        const parts = triples.map(g => {
            const mult = PAY_MULT[g];
            return `
      <li>
        <span class="pt-sym">
          ${createMini(g)}${createMini(g)}${createMini(g)}
        </span>
        &nbsp;→ x${mult}
      </li>`;
        }).join('');
        const cherryPush = `
    <p class="muted small">Two ${createMini('🍒', true)} pays x1 (push) as a consolation.</p>
  `;
        pt.innerHTML = parts + cherryPush;

        function createMini(glyph, inline = false) {
            const pack = getCurrentPack();
            if (pack.type === 'image') {
                const src = `${pack.basePath}/${pack.map[glyph]}`;
                return `<img src="${src}" alt="${glyph}">`;
            }
            return inline ? glyph : `<span>${glyph}</span>`;
        }
    }

    function buildStrip(finalGlyph) {
        const strip = document.createElement('div');
        strip.className = 'symbol-strip';
        const count = 8;
        for (let i = 0; i < count; i++) {
            strip.appendChild(createSymbolEl(randSymbol()));
        }
        strip.appendChild(createSymbolEl(finalGlyph));
        return strip;
    }

    function renderStatic(glyphs) {
        reelEls.forEach((el, i) => {
            el.innerHTML = '';
            el.appendChild(createSymbolEl(glyphs[i]));
        });
    }

  function glowReels(win) {
    reelEls.forEach(el => {
      el.classList.remove('win-glow', 'lose-glow');
      // Trigger reflow so glow restarts
      void el.offsetWidth;
      el.classList.add(win ? 'win-glow' : 'lose-glow');
      setTimeout(() => el.classList.remove('win-glow', 'lose-glow'), 900);
    });
  }

    // ---- Helpers ----

    function centerSymbol(el) {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const found = document.elementFromPoint(x, y);
        const sym = found?.closest?.('.symbol') || found; // handles <img>
        return (sym && sym.classList?.contains('symbol')) ? sym.dataset.glyph : null;
    }


  function setStatus(msg, type = 'info') {
    statusEl.textContent = msg;
    statusEl.className = `toast ${type}`;
  }

  function updateButtons() {
    spinBtn.disabled = spinning || bet <= 0 || bank <= 0;
  }

  function updateBetLabel() { betAmountEl.textContent = bet; }

  function updateBankBadge() {
    bankBadgeEl.textContent = `Bank: ${bank} chips`;
    bankBadgeEl.className = 'badge';
  }

  function loadBank() {
    const v = localStorage.getItem(BANK_KEY);
    return Number.isFinite(+v) && +v > 0 ? +v : START_BANK;
  }
  function saveBank() {
    localStorage.setItem(BANK_KEY, String(bank));
  }

  function randSymbol() {
    // Weighted random
    const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const s of SYMBOLS) {
      if ((r -= s.weight) <= 0) return s.glyph;
    }
    return SYMBOLS[0].glyph;
  }
})();
