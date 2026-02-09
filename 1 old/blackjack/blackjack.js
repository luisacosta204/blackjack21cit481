/* Blackjack with:
   - 6-deck shoe; reshuffle at 75% penetration
   - Multi-hand (1–3) with same bet per hand
   - Split once per hand (split Aces get one card)
   - Double on first action
   - Insurance when dealer shows Ace (pays 2:1)
*/
console.log('[BJ] build=dev1');
(async () => {

    // ---- DOM ----
    const dealerCardsEl = document.getElementById('dealerCards');
    const playerCardsEl = document.getElementById('playerCards'); // used when 1 hand
    const dealerScoreEl = document.getElementById('dealerScore');
    const playerScoreEl = document.getElementById('playerScore'); // used when 1 hand
    const statusEl = document.getElementById('status');

    const betAmountEl = document.getElementById('betAmount');
    const totalWagerEl = document.getElementById('totalWager');
    const bankBadgeEl = document.getElementById('bankBadge');
    const shoeInfoEl = document.getElementById('shoeInfo');
    const countInfoEl = document.getElementById('countInfo');
    const countLabelEl = document.getElementById('countLabel');

    const chipButtons = document.querySelectorAll('.chip-btn');
    const dealBtn = document.getElementById('dealBtn');
    const newRoundBtn = document.getElementById('newRoundBtn');
    const clearBetBtn = document.getElementById('clearBetBtn');
    const hitBtn = document.getElementById('hitBtn');
    const standBtn = document.getElementById('standBtn');
    const doubleBtn = document.getElementById('doubleBtn');
    const splitBtn = document.getElementById('splitBtn');
    const insuranceBtn = document.getElementById('insuranceBtn');
    const handsSelect = document.getElementById('handsSelect');
    const resetBankBtn = document.getElementById('resetBankBtn');

    const DECK_KEY = 'bjDeck';


    // ---- Constants / Config ----
    const BANK_KEY = 'bjBank';
    const START_BANK = 500;
    const NUM_DECKS = 6;
    const RESHUFFLE_PENETRATION = 0.75; // reshuffle when 75% of shoe has been dealt

    // ---- Deck style ----
    let cardTextures = {};
    let deckBackImage = '';

    async function loadDeckTheme(theme = 'style_1') {
        try {
            const res = await fetch(`assets/decks/${theme}.json`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const base = data.path ?? 'assets/cards/';
            const rawMap = data.cards ?? {};

            // Normalize suit characters AND also create ASCII aliases (e.g., "10H")
            const normSuit = s =>
                s.replace(/\u2660/g, '♠').replace(/\u2665/g, '♥').replace(/\u2666/g, '♦').replace(/\u2663/g, '♣');

            const addAliases = (map) => {
                const out = {};
                for (const [k, v] of Object.entries(map)) {
                    const key = normSuit(k.trim());
                    const val = v.includes('/') ? v : base + v;
                    out[key] = val;
                    // ASCII alias (helps if a different key format ever gets used)
                    const m = key.match(/^([AJQK]|10|[2-9])(♠|♥|♦|♣)$/);
                    if (m) {
                        const ascii = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' }[m[2]];
                        out[`${m[1]}${ascii}`] = val;
                    }
                }
                return out;
            };

            cardTextures = addAliases(rawMap);
            deckBackImage = data.back ? (data.back.includes('/') ? data.back : base + data.back) : '';

            console.log('[Deck] Loaded', Object.keys(cardTextures).length, 'textures');
            console.table(Object.entries(cardTextures).slice(0, 8));
        } catch (e) {
            console.warn('Deck theme failed to load; falling back to text cards.', e);
            cardTextures = {};
            deckBackImage = '';
        }
    }

    // Hi-Lo count
    let runningCount = 0;

    function hiLoValue(rank) {
        // 2–6: +1, 7–9: 0, 10–A: -1
        if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
        if (['7', '8', '9'].includes(rank)) return 0;
        return -1; // 10, J, Q, K, A
    }



    // ---- State ----
    let bank = loadBank();
    let shoe = [];
    let discard = [];
    let dealer = { cards: [] };
    // array of player hands: { cards:[], bet:number, stood:boolean, doubled:boolean, splitUsed:boolean, insurance:0 }
    let hands = [];
    let activeIndex = 0;
    let betPerHand = 0;
    let roundActive = false;
    let insuranceOffered = false;

    // ---- Init ----
    updateBankBadge();
    updateBetLabel();
    updateTotalWager();
    setStatus('Loading decks…');
    const selectedDeck = await populateDeckMenu();

    if (selectedDeck === 'text') {
        cardTextures = {};
        deckBackImage = '';
    } else {
        await loadDeckTheme(selectedDeck);
    }
    setStatus('Place your bet to begin.');


    buildShoe();
    updateShoeInfo();


    // wire events
    chipButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (roundActive) return;
            const add = parseInt(btn.dataset.chip, 10);
            if (bank <= 0) return;
            betPerHand = Math.min(bank, betPerHand + add);
            updateBetLabel();
            updateTotalWager();
        });
    });
    clearBetBtn.addEventListener('click', () => {
        if (roundActive) return;
        betPerHand = 0;
        updateBetLabel();
        updateTotalWager();
    });
    handsSelect.addEventListener('change', updateTotalWager);

    dealBtn.addEventListener('click', onDeal);
    newRoundBtn.addEventListener('click', onNewRound);
    hitBtn.addEventListener('click', onHit);
    standBtn.addEventListener('click', onStand);
    doubleBtn.addEventListener('click', onDouble);
    splitBtn.addEventListener('click', onSplit);
    insuranceBtn.addEventListener('click', onInsurance);
    resetBankBtn.addEventListener('click', () => {
        bank = START_BANK;
        saveBank();
        updateBankBadge();
        setStatus('Bank reset to 500 chips.');
    });
    const deckSelectEl = document.getElementById('deckSelect');

    deckSelectEl?.addEventListener('change', async () => {
        const val = deckSelectEl.value;
        localStorage.setItem(DECK_KEY, val);

        if (val === 'text') {
            cardTextures = {};
            deckBackImage = '';
        } else {
            await loadDeckTheme(val);
        }

        // Re-render table so already-dealt cards update immediately
        renderTable(roundActive); // keep hole-card hidden behavior consistent
        setStatus(`Deck changed to ${val === 'text' ? 'Text Only' : val}.`);
    });


    // ---- Helpers ----
    function setStatus(msg, type = 'info') {
        statusEl.textContent = msg;
        statusEl.className = `toast ${type}`;
    }
    async function populateDeckMenu() {
        const deckSelectEl = document.getElementById('deckSelect');
        if (!deckSelectEl) return;

        try {
            const res = await fetch('assets/decks/manifest.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(`Manifest load failed: ${res.status}`);
            const manifest = await res.json();

            deckSelectEl.innerHTML = ''; // clear existing
            for (const deck of manifest.decks) {
                const opt = document.createElement('option');
                opt.value = deck.id;
                opt.textContent = deck.name;
                deckSelectEl.appendChild(opt);
            }

            // restore saved preference or use manifest default
            const savedDeck = localStorage.getItem(DECK_KEY) || manifest.default || manifest.decks[0]?.id || 'style_1';
            deckSelectEl.value = savedDeck;
            localStorage.setItem(DECK_KEY, savedDeck);
            return savedDeck;
        } catch (err) {
            console.warn('Deck manifest failed to load:', err);
            // fallback default
            if (deckSelectEl.options.length === 0) {
                const opt = document.createElement('option');
                opt.value = 'style_1';
                opt.textContent = 'Style 1 (Images)';
                deckSelectEl.appendChild(opt);
                const opt2 = document.createElement('option');
                opt2.value = 'text';
                opt2.textContent = 'Text Only';
                deckSelectEl.appendChild(opt2);
            }
            return 'style_1';
        }
    }

    deckSelectEl?.addEventListener('change', async () => {
        const val = deckSelectEl.value;
        localStorage.setItem(DECK_KEY, val);

        if (val === 'text') {
            cardTextures = {};
            deckBackImage = '';
        } else {
            await loadDeckTheme(val);
        }

        renderTable(roundActive);
        setStatus(`Deck changed to ${val === 'text' ? 'Text Only' : val}.`);
    });


    function updateBankBadge() {
        bankBadgeEl.textContent = `Bank: ${bank} chips`;
        bankBadgeEl.className = 'badge';
    }
    function updateBetLabel() { betAmountEl.textContent = betPerHand; }
    function updateTotalWager() {
        const h = getHandsCount();
        totalWagerEl.textContent = betPerHand * h;
    }
    function getHandsCount() { return parseInt(handsSelect?.value || '1', 10); }

    function loadBank() {
        const v = localStorage.getItem(BANK_KEY);
        return Number.isFinite(+v) && +v > 0 ? +v : START_BANK;
    }
    function saveBank() { localStorage.setItem(BANK_KEY, String(bank)); }

    function buildShoe() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        shoe = [];
        for (let d = 0; d < NUM_DECKS; d++) {
            for (const s of suits) for (const r of ranks) shoe.push({ r, s });
        }
        shuffle(shoe);
        discard = [];
        runningCount = 0; // <-- add this
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
    function drawCard() {
        // reshuffle if penetration exceeded
        const used = NUM_DECKS * 52 - shoe.length;
        if (used / (NUM_DECKS * 52) >= RESHUFFLE_PENETRATION) {
            buildShoe();
            setStatus('Shuffling the shoe…', 'info');
        }
        const c = shoe.pop();

        // NEW: update Hi-Lo on every exposed card
        runningCount += hiLoValue(c.r);

        return c;
    }

    function cardValue(r) {
        if (r === 'A') return 11;
        if (['K', 'Q', 'J'].includes(r)) return 10;
        return parseInt(r, 10);
    }
    function handValue(cards) {
        let total = 0, aces = 0;
        for (const c of cards) {
            total += cardValue(c.r);
            if (c.r === 'A') aces++;
        }
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        return total;
    }
    function isBlackjack(cards) { return cards.length === 2 && handValue(cards) === 21; }
    function canSplit(hand) {
        if (hand.splitUsed) return false;
        if (hand.cards.length !== 2) return false;
        const [a, b] = hand.cards;
        const vA = a.r === 'A' ? 11 : cardValue(a.r);
        const vB = b.r === 'A' ? 11 : cardValue(b.r);
        return vA === vB;
    }

    function renderTable(hideHole = true) {
        // Dealer
        dealerCardsEl.innerHTML = '';
        dealer.cards.forEach((c, idx) => {
            const isHole = hideHole && idx === 1 && roundActive;
            dealerCardsEl.appendChild(cardNode(c, isHole));
        });
        const dealerShown = hideHole && roundActive ? cardValue(dealer.cards[0].r) : handValue(dealer.cards);
        dealerScoreEl.textContent = `Score: ${hideHole && roundActive ? dealerShown + '+' : dealerShown}`;

        // Players
        const hCount = hands.length;
        if (hCount <= 1) {
            // render in legacy single-hand area
            playerCardsEl.innerHTML = '';
            hands[0]?.cards.forEach(c => playerCardsEl.appendChild(cardNode(c, false)));
            playerScoreEl.textContent = `Score: ${handValue(hands[0]?.cards || [])}`;
        } else {
            // multi hand layout
            // build a custom container
            const container = document.createElement('div');
            container.className = 'player-hands';
            container.dataset.hands = String(hands.length);
            hands.forEach((hand, idx) => {
                const block = document.createElement('div');
                block.className = 'player-hand' + (idx === activeIndex && roundActive ? ' active' : '') + (hand.finished ? ' finished' : '');
                const label = document.createElement('div');
                label.className = 'label';
                label.textContent = `Hand ${idx + 1} — Bet ${hand.bet}${hand.insurance ? ` (+Ins ${hand.insurance})` : ''}`;
                const cardsDiv = document.createElement('div');
                cardsDiv.className = 'cards';
                hand.cards.forEach(c => cardsDiv.appendChild(cardNode(c, false)));
                const score = document.createElement('div');
                score.className = 'score';
                score.textContent = `Score: ${handValue(hand.cards)}`;
                block.appendChild(label);
                block.appendChild(cardsDiv);
                block.appendChild(score);
                container.appendChild(block);
            });
            // mount into playerCardsEl's parent hand area
            const parent = playerCardsEl.parentElement.parentElement; // .hand wrapper
            const existing = parent.querySelector('.player-hands');
            if (existing) existing.remove();
            parent.appendChild(container);
            // hide legacy single-hand nodes
            playerCardsEl.innerHTML = '';
            playerScoreEl.textContent = '—';
        }

        updateShoeInfo();
        updateActionButtons();
    }

    function cardNode(card, facedown) {
        const el = document.createElement('div');
        el.className = `card-ui${facedown ? ' back' : ''}`;

        // Back image
        if (facedown) {
            if (deckBackImage) {
                const img = document.createElement('img');
                img.src = deckBackImage;
                img.alt = 'Card Back';
                img.className = 'card-img';
                el.appendChild(img);
            }
            return el;
        }

        // Face image
        const key = `${card.r}${card.s}`; // e.g., "A♠"
        const file = cardTextures[key];

        if (file) {
            const img = document.createElement('img');
            img.src = file; // already normalized in loadDeckTheme()
            const suits = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' };
            const ranks = { 'A': 'Ace', 'J': 'Jack', 'Q': 'Queen', 'K': 'King' };
            img.alt = `${ranks[card.r] || card.r} of ${suits[card.s]}`;
            img.className = 'card-img';
            el.appendChild(img);
        } else {
            // Fallback: text-rendered card
            const red = (card.s === '♥' || card.s === '♦') ? ' red' : '';
            el.innerHTML = `
      <div class="corner${red}">${card.r}${card.s}</div>
      <div class="center${red}">${card.s}</div>
      <div class="corner${red}" style="justify-self:end; transform: rotate(180deg)">${card.r}${card.s}</div>
    `;
        }
        return el;
    }



    function updateActionButtons() {
        const playing = roundActive;
        const hand = hands[activeIndex];
        const firstMove = hand && hand.cards.length === 2 && !hand.hitOnce;
        hitBtn.disabled = !playing || !hand;
        standBtn.disabled = !playing || !hand;
        doubleBtn.disabled = !playing || !hand || !firstMove || bank < hand.bet;
        splitBtn.disabled = !playing || !hand || !canSplit(hand) || bank < hand.bet;
        insuranceBtn.disabled = !(insuranceOffered && hand && firstMove && hand.insurance === 0 && bank >= Math.floor(hand.bet / 2));
        dealBtn.disabled = playing;
        newRoundBtn.disabled = playing;
    }

    function updateShoeInfo() {
        const total = NUM_DECKS * 52;
        const remaining = shoe.length;
        const used = total - remaining;
        const pct = Math.round((used / total) * 100);
        shoeInfoEl.textContent = `${remaining}/${total} cards left (${pct}% dealt)`;

        // NEW: True Count = running / decks remaining
        const decksRemaining = Math.max(remaining / 52, 0.25); // floor to avoid divide-by-very-small
        const trueCount = runningCount / decksRemaining;

        // display like: "+5 / +1.7"
        const tcDisplay = (trueCount >= 0 ? '+' : '') + (Math.round(trueCount * 10) / 10).toFixed(1);
        if (countInfoEl) countInfoEl.textContent = `${runningCount >= 0 ? '+' : ''}${runningCount} / ${tcDisplay}`;

        // label: Hot / Neutral / Cold
        let label = 'Neutral';
        if (trueCount >= 2) label = 'Hot';
        else if (trueCount <= -2) label = 'Cold';

        if (countLabelEl) {
            countLabelEl.textContent = label;
            countLabelEl.setAttribute('data-state', label); // drives CSS color
        }
    }


    // ---- Round flow ----
    function onDeal() {
        if (roundActive) return;
        const hCount = getHandsCount();
        const totalWager = betPerHand * hCount;
        if (betPerHand <= 0) return setStatus('Please place a bet first.');
        if (totalWager > bank) return setStatus('Total wager exceeds your bank. Lower bet or hands.');

        // Deduct total wager up front
        bank -= totalWager;
        saveBank(); updateBankBadge();

        // init hands
        hands = Array.from({ length: hCount }, () => ({
            cards: [], bet: betPerHand, stood: false, doubled: false, splitUsed: false, insurance: 0, finished: false, hitOnce: false
        }));
        activeIndex = 0;
        dealer = { cards: [] };
        roundActive = true;
        insuranceOffered = false;

        // initial deal (player, dealer, player, dealer)
        for (let i = 0; i < 2; i++) {
            for (let h = 0; h < hands.length; h++) hands[h].cards.push(drawCard());
            dealer.cards.push(drawCard());
        }

        // Offer insurance if dealer shows Ace
        if (dealer.cards[0].r === 'A') {
            insuranceOffered = true;
            setStatus('Dealer shows Ace. You may take Insurance (2:1) before acting.');
        } else {
            setStatus('Your move on Hand 1: Hit, Stand, Double, or Split (if allowed).');
        }

        // Natural Blackjacks
        const anyPlayerBJ = hands.some(h => isBlackjack(h.cards));
        const dealerBJ = isBlackjack(dealer.cards);

        renderTable(true);

        if (dealerBJ) {
            // Reveal & settle immediately; insurance may pay
            settleAll(true);
            return;
        }
        if (anyPlayerBJ) {
            // Pay naturals for just those hands; others continue
            for (const hand of hands) {
                if (isBlackjack(hand.cards)) {
                    // Pay 3:2 immediately
                    const payout = Math.floor(hand.bet * 3 / 2) + hand.bet;
                    bank += payout;
                    saveBank();
                    hand.finished = true;
                }
            }
            // If all hands finished via BJ, round ends
            if (hands.every(h => h.finished)) endRound();
        }

        renderTable(true);
    }

    function onHit() {
        const hand = hands[activeIndex];
        if (!roundActive || !hand || hand.finished) return;
        hand.cards.push(drawCard());
        hand.hitOnce = true;
        if (handValue(hand.cards) > 21) {
            hand.finished = true;
            advanceHandOrDealer();
        } else {
            setStatus(`Hand ${activeIndex + 1}: Hit again or Stand.`);
        }
        renderTable(true);
    }

    function onStand() {
        const hand = hands[activeIndex];
        if (!roundActive || !hand || hand.finished) return;
        hand.stood = true;
        hand.finished = true;
        advanceHandOrDealer();
        renderTable(true);
    }

    function onDouble() {
        const hand = hands[activeIndex];
        if (!roundActive || !hand || hand.finished) return;
        if (hand.cards.length !== 2) return;
        if (bank < hand.bet) return setStatus('Not enough chips to double.');

        // Deduct additional bet
        bank -= hand.bet; saveBank(); updateBankBadge();
        hand.doubled = true;
        hand.cards.push(drawCard());
        hand.hitOnce = true;
        hand.finished = true; // forced stand after one card
        if (handValue(hand.cards) > 21) {
            // bust; move on
        }
        advanceHandOrDealer();
        renderTable(true);
    }

    function onSplit() {
        const hand = hands[activeIndex];
        if (!roundActive || !hand || hand.finished) return;
        if (!canSplit(hand)) return;
        if (bank < hand.bet) return setStatus('Not enough chips to split.');

        // Move one card into a new hand at the end; same bet
        const [c1, c2] = hand.cards;
        const second = { cards: [c2], bet: hand.bet, stood: false, doubled: false, splitUsed: false, insurance: 0, finished: false, hitOnce: false };
        hand.cards = [c1];
        hand.splitUsed = true;

        // Deduct matching bet
        bank -= hand.bet; saveBank(); updateBankBadge();

        // Insert second hand right after current to keep turn order intuitive
        hands.splice(activeIndex + 1, 0, second);

        // Deal one card to each split hand
        hand.cards.push(drawCard());
        second.cards.push(drawCard());

        // Special rule: split Aces receive one card each, then stand
        if (c1.r === 'A' && c2.r === 'A') {
            hand.finished = true;
            second.finished = true;
            setStatus('Split Aces: one card each, then stand.');
            // jump forward to dealer if needed
            advanceHandOrDealer();
        } else {
            setStatus(`Split complete. Continue playing Hand ${activeIndex + 1}.`);
        }
        renderTable(true);
    }

    function onInsurance() {
        const hand = hands[activeIndex];
        if (!roundActive || !hand || hand.finished || !insuranceOffered) return;
        if (hand.insurance > 0) return; // already taken
        const ins = Math.floor(hand.bet / 2);
        if (bank < ins) return setStatus('Not enough chips for insurance.');

        bank -= ins; saveBank(); updateBankBadge();
        hand.insurance = ins;
        setStatus(`Insurance taken on Hand ${activeIndex + 1}.`);
        renderTable(true);
    }

    function advanceHandOrDealer() {
        // move to next unfinished hand
        const next = hands.findIndex((h, idx) => idx > activeIndex && !h.finished);
        if (next !== -1) {
            activeIndex = next;
            setStatus(`Hand ${activeIndex + 1}: Your move.`);
            return;
        }
        // if all finished, dealer plays (unless already settled by dealer BJ)
        dealerPlayAndSettle();
    }

    function dealerPlayAndSettle() {
        // Reveal hole
        renderTable(false);
        // play dealer to 17+
        while (handValue(dealer.cards) < 17) {
            dealer.cards.push(drawCard());
            renderTable(false);
        }
        settleAll(false);
    }

    function settleAll(naturalCheck) {
        const dealerBJ = isBlackjack(dealer.cards);
        const dealerVal = handValue(dealer.cards);

        if (dealerBJ) {
            for (const hand of hands) {
                if (hand.insurance > 0) {
                    bank += hand.insurance * 3; // return stake + 2:1
                    hand.insurance = 0;
                }
            }
            saveBank(); updateBankBadge();
        }

        for (const hand of hands) {
            if (hand.paid) continue;
            const pv = handValue(hand.cards);
            let payout = 0;

            if (naturalCheck && dealerBJ) {
                // push only if player also has BJ
                if (isBlackjack(hand.cards)) {
                    payout = hand.bet * (hand.doubled ? 2 : 1); // return total stake on push
                }
            } else {
                if (pv > 21) {
                    payout = 0;
                } else if (dealerVal > 21 || pv > dealerVal) {
                    // win: pay even money on total stake (double = twice the stake)
                    payout = hand.bet * (hand.doubled ? 4 : 2);
                } else if (pv === dealerVal) {
                    // push: return total stake
                    payout = hand.bet * (hand.doubled ? 2 : 1);
                } else {
                    payout = 0;
                }
            }

            if (payout > 0) bank += payout;
            hand.paid = true;
        }

        saveBank(); updateBankBadge();
        endRound();
    }


    function endRound() {
        roundActive = false;
        setStatus('Round complete. Start a new round or adjust your bet.');
        updateActionButtons();
        newRoundBtn.disabled = false;
        // reset per-hand bet to 0 so the user consciously sets next wager? Keep as-is for convenience.
    }

    function onNewRound() {
        // move all to discard
        for (const h of hands) discard.push(...h.cards);
        discard.push(...dealer.cards);
        hands = [];
        dealer = { cards: [] };
        activeIndex = 0;
        roundActive = false;
        insuranceOffered = false;
        setStatus('Place your bet to begin.');
        renderTable(true);
    }

    // ---- Utility ----
    function renderHandsSimpleWhenNoGame() {
        dealerCardsEl.innerHTML = '';
        playerCardsEl.innerHTML = '';
        dealerScoreEl.textContent = 'Score: —';
        playerScoreEl.textContent = 'Score: —';
    }

    // ---- Back Button ----
    document.getElementById('backButton')?.addEventListener('click', () => {
        window.location.href = 'home.html';
    });


    // initial passive render
    renderHandsSimpleWhenNoGame();
    updateActionButtons();
})();
