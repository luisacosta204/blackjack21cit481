/*
  Hold’em — shared bank (aggressive bot) v=bank-agg1
  - Uses localStorage 'bjBank' (shared with Blackjack).
  - Bot has unlimited chips but all actions are capped by your cover.
  - "Rebuy" sets bank to 500 (per your edit).
  - UI: panel label reads Bank and shows live value.
*/
console.log('[Holdem] bank-aggressive build');

(() => {
    // ---------- DOM ----------
    const $ = (id) => document.getElementById(id);
    const communityEl = $('communityCards'), oppEl = $('opponentCards'), youEl = $('yourCards');
    const statusEl = $('status'), stageEl = $('stageLabel'), potEl = $('potAmount'), toCallEl = $('toCall'), actionLogEl = $('actionLog');
    const oppRoleEl = $('oppRole'), youRoleEl = $('youRole'), oppStackEl = $('oppStack'), youStackEl = $('youStack');
    const youHandText = $('youHandText'), oppHandText = $('oppHandText');
    const sbLabel = $('sbLabel'), bbLabel = $('bbLabel'), stackLabel = $('stackSizeLabel'); // shows "Bank:" value now
    const dealBtn = $('dealBtn'), rebuyBtn = $('rebuyBtn');
    const foldBtn = $('foldBtn'), checkCallBtn = $('checkCallBtn'), betRaiseBtn = $('betRaiseBtn');
    const betSlider = $('betSlider'), betInput = $('betInput');
    const quickBtns = [...document.querySelectorAll('.qb')];
    const backButton = $('backButton'), deckSelect = $('deckSelect'), bankBadge = $('bankBadge'), turnBadge = $('turnBadge');

    // Showdown overlay
    const sdn = $('showdownOverlay'), sdnClose = $('closeShowdown'), sdnOppCards = $('sdnOppCards'), sdnYouCards = $('sdnYouCards'), sdnOppText = $('sdnOppText'), sdnYouText = $('sdnYouText');

    // ---------- Config ----------
    const DECK_KEY = 'bjDeck', BANK_KEY = 'bjBank';
    const START_BANK = 500, SB = 5, BB = 10;

    // ---------- State ----------
    const Stage = Object.freeze({ Idle: 'Idle', Preflop: 'Preflop', Flop: 'Flop', Turn: 'Turn', River: 'River', Showdown: 'Showdown' });
    let stage = Stage.Idle, dealerIsYou = true, pot = 0, deck = [], textures = {}, backImg = '';
    let you = [], opp = [], board = [];
    let committed = { you: 0, opp: 0 }, currentBet = 0, minRaise = BB, lastAggressor = null, turn = null, handOver = false;

    // ---------- Bank (shared) ----------
    let bank = loadBank(); updateBankBadge();

    // ---------- Init ----------
    sbLabel.textContent = SB; bbLabel.textContent = BB;

    (async function init() {
        setStatus('Click “Deal New Hand” to start.');
        await populateDeckMenu(); await loadDeckTheme(deckSelect?.value || 'style_1');
        rebuyBtn.textContent = 'Set Bank to 500'; // your change
        render();
    })();

    // ---------- Events ----------
    backButton?.addEventListener('click', () => location.href = 'home.html');
    dealBtn.addEventListener('click', startHand);
    rebuyBtn.addEventListener('click', () => { bank = 500; saveBank(); updateBankBadge(); setStatus('Bank reset to 500.', 'success'); render(); });

    foldBtn.addEventListener('click', onFold);
    checkCallBtn.addEventListener('click', onCheckCall);
    betRaiseBtn.addEventListener('click', onBetRaise);
    betSlider.addEventListener('input', () => syncBet(+betSlider.value));
    betInput.addEventListener('input', () => syncBet(+betInput.value, true));
    quickBtns.forEach(b => b.addEventListener('click', onQuick));

    deckSelect?.addEventListener('change', async () => { localStorage.setItem(DECK_KEY, deckSelect.value); await loadDeckTheme(deckSelect.value); render(); });
    sdnClose.addEventListener('click', () => sdn.classList.add('hidden'));
    sdn.addEventListener('click', e => { if (e.target === sdn) sdn.classList.add('hidden'); });

    // ---------- Utilities ----------
    function setStatus(msg, type = 'info') { statusEl.textContent = msg; statusEl.className = `toast ${type}`; }
    function log(msg) { actionLogEl.textContent = msg; }
    function loadBank() { const v = localStorage.getItem(BANK_KEY); return Number.isFinite(+v) && +v >= 0 ? +v : START_BANK; }
    function saveBank() { localStorage.setItem(BANK_KEY, String(bank)); }
    function updateBankBadge() { bankBadge.textContent = `Bank: ${bank} chips`; bankBadge.className = 'badge'; }

    async function populateDeckMenu() {
        try {
            const res = await fetch('assets/decks/manifest.json', { cache: 'no-store' }); if (!res.ok) throw 0;
            const m = await res.json(); deckSelect.innerHTML = '';
            for (const d of m.decks) deckSelect.add(new Option(d.name, d.id));
            const saved = localStorage.getItem(DECK_KEY) || m.default || m.decks[0]?.id || 'style_1';
            deckSelect.value = saved; localStorage.setItem(DECK_KEY, saved);
        } catch {
            if (deckSelect.options.length === 0) { deckSelect.add(new Option('Style 1 (Images)', 'style_1')); deckSelect.add(new Option('Text Only', 'text')); }
        }
    }

    async function loadDeckTheme(theme = 'style_1') {
        try {
            if (theme === 'text') { textures = {}; backImg = ''; return; }
            const res = await fetch(`assets/decks/${theme}.json`, { cache: 'no-store' }); if (!res.ok) throw 0;
            const data = await res.json(); const base = data.path ?? 'assets/cards/';
            const norm = s => s.replace(/\u2660/g, '♠').replace(/\u2665/g, '♥').replace(/\u2666/g, '♦').replace(/\u2663/g, '♣');
            const out = {};
            for (const [k, v] of Object.entries(data.cards || {})) {
                const key = norm(k.trim()); const val = v.includes('/') ? v : base + v; out[key] = val;
                const m = key.match(/^([AJQK]|10|[2-9])(♠|♥|♦|♣)$/); if (m) { const ascii = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' }[m[2]]; out[`${m[1]}${ascii}`] = val; }
            }
            textures = out; backImg = data.back ? (data.back.includes('/') ? data.back : base + data.back) : '';
        } catch { textures = {}; backImg = ''; }
    }

    function buildDeck() {
        const suits = ['♠', '♥', '♦', '♣'], ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        deck = []; for (const s of suits) for (const r of ranks) deck.push({ r, s });
        for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[deck[i], deck[j]] = [deck[j], deck[i]]; }
    }
    const draw = () => deck.pop();
    const cardKey = c => `${c.r}${c.s}`;

    function nodeFor(card, facedown = false, highlight = false) {
        const el = document.createElement('div'); el.className = `card-ui${facedown ? ' back' : ''}${highlight ? ' hl' : ''}`;
        if (facedown) { if (backImg) { const img = document.createElement('img'); img.src = backImg; img.alt = 'Back'; img.className = 'card-img'; el.appendChild(img); } return el; }
        const file = textures[cardKey(card)];
        if (file) { const img = document.createElement('img'); img.src = file; img.alt = cardKey(card); img.className = 'card-img'; el.appendChild(img); }
        else { el.textContent = cardKey(card); el.style.fontWeight = '800'; el.style.color = (card.s === '♥' || card.s === '♦') ? '#d22525' : '#fff'; el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'; }
        return el;
    }

    function render(highlights = { you: new Set(), opp: new Set(), board: new Set() }) {
        communityEl.innerHTML = ''; board.forEach(c => communityEl.appendChild(nodeFor(c, false, highlights.board.has(cardKey(c)))));
        oppEl.innerHTML = ''; const oppDown = stage !== Stage.Showdown; opp.forEach(c => oppEl.appendChild(nodeFor(c, oppDown, !oppDown && highlights.opp.has(cardKey(c)))));
        youEl.innerHTML = ''; you.forEach(c => youEl.appendChild(nodeFor(c, false, highlights.you.has(cardKey(c)))));

        potEl.textContent = pot; stageEl.textContent = stage; toCallEl.textContent = toCall(turn === 'you' ? 'you' : 'opp');

        // Player/opp displays
        youStackEl.textContent = `Bank: ${bank}`;
        oppStackEl.textContent = `Stack: ∞ (cap ${bank})`;
        oppRoleEl.textContent = dealerIsYou ? 'BB' : 'SB (Dealer)';
        youRoleEl.textContent = dealerIsYou ? 'SB (Dealer)' : 'BB';

        // Panel Bank value
        if (stackLabel) stackLabel.textContent = String(bank);

        if (stage !== Stage.Showdown) { youHandText.textContent = ''; oppHandText.textContent = ''; }
        updateActionUI();
    }

    function setTurn(who) { turn = who; turnBadge.hidden = !(turn === 'you' && !handOver && stage !== Stage.Idle && stage !== Stage.Showdown); updateActionUI(); }
    const enable = (el, on = true) => el.disabled = !on;

    function updateActionUI() {
        const myToCall = toCall('you'); const canAct = (turn === 'you' && !handOver && stage !== Stage.Idle && stage !== Stage.Showdown);
        enable(foldBtn, canAct && (myToCall > 0 || stage !== Stage.Preflop || committed.you > 0));
        enable(checkCallBtn, canAct);

        const myStack = bank; const allowBet = canAct && myStack > 0 && (currentBet === 0 || myToCall < myStack);
        checkCallBtn.textContent = myToCall > 0 ? `Call ${Math.min(myToCall, myStack)}` : 'Check';

        enable(betRaiseBtn, allowBet); enable(betSlider, allowBet); enable(betInput, allowBet);
        const minNow = (currentBet === 0) ? Math.min(BB, myStack) : Math.min(Math.max(myToCall + minRaise, 0), myStack);
        const maxNow = myStack;
        betSlider.min = String(minNow); betSlider.max = String(maxNow); betSlider.step = '5';
        betInput.min = '0'; betInput.max = String(maxNow); betInput.step = '5';
        if (+betInput.value < minNow || +betInput.value > maxNow || !allowBet) { betSlider.value = String(minNow); betInput.value = String(minNow); }
        betRaiseBtn.textContent = (currentBet === 0 ? 'Bet' : 'Raise');
        quickBtns.forEach(b => enable(b, allowBet));
    }
    function syncBet(v, fromInput = false) { v = Math.max(0, Math.min(bank, Math.round(v / 5) * 5)); if (fromInput) betSlider.value = String(v); else betInput.value = String(v); }

    // Effective cap: max the bot can still add while you can cover
    function oppRemainingCap() { return Math.max(0, bank + committed.you - committed.opp); }

    function toCall(who) { return Math.max(0, currentBet - committed[who]); }
    function clearStreet() { committed.you = 0; committed.opp = 0; currentBet = 0; minRaise = BB; lastAggressor = null; }

    // Commit helpers
    function commitYou(put) { const amt = Math.min(bank, put); bank -= amt; saveBank(); updateBankBadge(); pot += amt; committed.you += amt; }
    function commitOpp(put) { const cap = oppRemainingCap(); const amt = Math.min(put, cap); pot += amt; committed.opp += amt; }

    // ---------- Evaluator ----------
    const rv = r => r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : parseInt(r, 10);
    const byDesc = (a, b) => rv(b.r) - rv(a.r);
    function best5(cards) {
        const all = cards.slice().sort(byDesc), cnt = {}; for (const c of all) { const v = rv(c.r); cnt[v] = (cnt[v] || 0) + 1; }
        const suit = { '♠': [], '♥': [], '♦': [], '♣': [] }; for (const c of all) suit[c.s].push(c);
        const flushSuit = Object.entries(suit).find(([, arr]) => arr.length >= 5)?.[0];
        const flush = flushSuit ? suit[flushSuit].slice().sort(byDesc) : null;

        function straightOn(list) {
            const vals = [...new Set(list.map(c => rv(c.r)))].sort((a, b) => b - a);
            for (let i = 0; i <= vals.length - 5; i++) { const run = [vals[i], vals[i + 1], vals[i + 2], vals[i + 3], vals[i + 4]]; if (run[0] - run[4] === 4) return run.map(v => list.find(c => rv(c.r) === v)); }
            if ([5, 4, 3, 2, 14].every(v => vals.includes(v))) return [5, 4, 3, 2, 14].map(v => list.find(c => rv(c.r) === v));
            return null;
        }

        let sf = null; if (flush) sf = straightOn(flush); if (sf) return { score: [8, ...sf.map(c => rv(c.r))], used: sf };

        const four = Object.entries(cnt).find(([, n]) => n === 4)?.[0];
        if (four) { const v = +four; const quad = all.filter(c => rv(c.r) === v).slice(0, 4); const k = all.find(c => rv(c.r) !== v); return { score: [7, v, rv(k.r)], used: [...quad, k] }; }

        const trips = Object.entries(cnt).filter(([, n]) => n === 3).map(([v]) => +v).sort((a, b) => b - a);
        const pairs = Object.entries(cnt).filter(([, n]) => n >= 2).map(([v]) => +v).sort((a, b) => b - a);
        if ((trips.length >= 1 && pairs.length >= 2) || trips.length >= 2) {
            const t = trips[0]; let p = pairs.find(v => v !== t); if (!p) p = trips[1];
            const three = all.filter(c => rv(c.r) === t).slice(0, 3); const two = all.filter(c => rv(c.r) === p).slice(0, 2);
            return { score: [6, t, p], used: [...three, ...two] };
        }

        if (flush) { const top = flush.slice(0, 5); return { score: [5, ...top.map(c => rv(c.r))], used: top }; }

        const st = straightOn(all); if (st) return { score: [4, ...st.map(c => rv(c.r))], used: st };

        if (trips.length >= 1) {
            const t = trips[0]; const three = all.filter(c => rv(c.r) === t).slice(0, 3); const k = all.filter(c => rv(c.r) !== t).slice(0, 2);
            return { score: [3, t, ...k.map(c => rv(c.r))], used: [...three, ...k] };
        }

        if (pairs.length >= 2) {
            const [p1, p2] = pairs.slice(0, 2); const a = all.filter(c => rv(c.r) === p1).slice(0, 2); const b = all.filter(c => rv(c.r) === p2).slice(0, 2);
            const k = all.find(c => ![p1, p2].includes(rv(c.r))); return { score: [2, p1, p2, rv(k.r)], used: [...a, ...b, k] };
        }

        if (pairs.length >= 1) {
            const p = pairs[0]; const pair = all.filter(c => rv(c.r) === p).slice(0, 2); const k = all.filter(c => rv(c.r) !== p).slice(0, 3);
            return { score: [1, p, ...k.map(c => rv(c.r))], used: [...pair, ...k] };
        }

        const top = all.slice(0, 5); return { score: [0, ...top.map(c => rv(c.r))], used: top };
    }
    const cmp = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) { const A = a[i] ?? 0, B = b[i] ?? 0; if (A !== B) return A > B ? 1 : -1; } return 0; };
    function handName(score) {
        const cat = score[0], r = v => v === 14 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : String(v);
        const word = v => ({ A: 'Aces', K: 'Kings', Q: 'Queens', J: 'Jacks', '10': 'Tens', '9': 'Nines', '8': 'Eights', '7': 'Sevens', '6': 'Sixes', '5': 'Fives', '4': 'Fours', '3': 'Threes', '2': 'Deuces' })[v] || v;
        const R = score.slice(1).map(r);
        switch (cat) {
            case 8: return `Straight Flush (${R[0]} high)`;
            case 7: return `Four of a Kind (${word(R[0])})`;
            case 6: return `Full House (${word(R[1])} over ${word(R[2])})`;
            case 5: return `Flush (${R[0]} high)`;
            case 4: return `Straight (${R[0]} high)`;
            case 3: return `Three of a Kind (${word(R[1])})`;
            case 2: return `Two Pair (${word(R[1])} & ${word(R[2])})`;
            case 1: return `Pair of ${word(R[1])}`;
            default: return `High Card (${R[1]})`;
        }
    }

    // ---------- Flow ----------
    function startHand() {
        if (bank <= 0) { setStatus('You’re out of chips. Set your bank to 500 to continue.', 'error'); return; }
        sdn.classList.add('hidden'); dealerIsYou = !dealerIsYou; handOver = false; stage = Stage.Preflop; board = []; you = []; opp = []; pot = 0;
        buildDeck(); committed.you = 0; committed.opp = 0; currentBet = 0; minRaise = BB; lastAggressor = null;

        const sbPlayer = dealerIsYou ? 'you' : 'opp', bbPlayer = dealerIsYou ? 'opp' : 'you';
        postBlind(sbPlayer, SB); postBlind(bbPlayer, BB);

        you.push(draw(), draw()); opp.push(draw(), draw());
        setTurn(dealerIsYou ? 'you' : 'opp');
        log(`${role('you')} posts ${dealerIsYou ? Math.min(SB, bank + committed.you) : Math.min(BB, bank + committed.you)}; ${role('opp')} posts ${dealerIsYou ? Math.min(BB, bank + committed.you) : Math.min(SB, bank + committed.you)}. ${turn === 'you' ? 'You' : 'Opponent'} to act.`);
        render(); if (turn === 'opp') setTimeout(botAct, 500);
    }

    function postBlind(who, amt) {
        if (who === 'you') { commitYou(Math.min(amt, bank)); currentBet = Math.max(currentBet, committed.you); }
        else { const cap = oppRemainingCap(); commitOpp(Math.min(amt, cap)); currentBet = Math.max(currentBet, committed.opp); }
    }
    const burn = () => { draw(); }; function dealBoard(n) { for (let i = 0; i < n; i++) board.push(draw()); }

    function nextStreet() {
        if (handOver) return;
        clearStreet();
        if (stage === Stage.Preflop) { burn(); dealBoard(3); stage = Stage.Flop; setTurn(dealerIsYou ? 'opp' : 'you'); }
        else if (stage === Stage.Flop) { burn(); dealBoard(1); stage = Stage.Turn; setTurn(dealerIsYou ? 'opp' : 'you'); }
        else if (stage === Stage.Turn) { burn(); dealBoard(1); stage = Stage.River; setTurn(dealerIsYou ? 'opp' : 'you'); }
        else if (stage === Stage.River) { return showdown(); }
        log(`${stage}: ${turn === 'you' ? 'You' : 'Opponent'} to act.`); render(); if (turn === 'opp') setTimeout(botAct, 600);
    }

    function onFold() { if (turn !== 'you') return; setStatus('You fold.', 'error'); log('You folded.'); pot = 0; handOver = true; render(); }
    function onCheckCall() {
        if (turn !== 'you') return; const need = Math.min(toCall('you'), bank);
        if (need === 0) { setStatus('You check.'); log('You check.'); pass(); }
        else { commitYou(need); if (committed.you === committed.opp) currentBet = 0; setStatus(`You call ${need}.`); log('You call.'); pass(true); }
    }
    function onBetRaise() {
        if (turn !== 'you') return;
        let put = Math.round(+betInput.value / 5) * 5; if (!Number.isFinite(put) || put <= 0) return;
        const need = toCall('you'); const minNow = (currentBet === 0 ? BB : need + minRaise);
        put = Math.max(minNow, Math.min(put, bank)); commitYou(put);
        if (committed.you > currentBet) { minRaise = Math.max(minRaise, committed.you - currentBet); currentBet = committed.you; lastAggressor = 'you'; }
        setStatus(`${currentBet === committed.you ? 'You bet' : 'You raise'} to ${committed.you}.`); log(`You make it ${committed.you}.`); pass(true);
    }
    function onQuick(e) {
        if (turn !== 'you') return; const k = e.currentTarget.dataset.qb, need = toCall('you'), potAfterCall = pot + need;
        let v = 0; if (k === 'half') v = need + Math.round(potAfterCall * 0.5 / 5) * 5;
        else if (k === 'twoThirds') v = need + Math.round(potAfterCall * 0.66 / 5) * 5;
        else if (k === 'pot') v = need + Math.round(potAfterCall * 1.0 / 5) * 5;
        else if (k === 'allin') v = bank;
        v = Math.max((currentBet === 0 ? BB : need + minRaise), Math.min(v, bank)); syncBet(v, true);
    }
    function pass(afterPutting = false) {
        setTurn(turn === 'you' ? 'opp' : 'you'); render();
        if (currentBet === 0 && committed.you === committed.opp && (stage !== Stage.River || !afterPutting)) { setTimeout(nextStreet, 400); return; }
        if (turn === 'opp' && !handOver) setTimeout(botAct, 600);
    }

    // ---------- Bot (more aggressive, still capped by your cover) ----------
    function botAct() {
        if (turn !== 'opp' || handOver) return;
        const need = toCall('opp'), cap = oppRemainingCap();
        const s = estimateStrength();

        // Tunables: lower thresholds & higher bluffing
        const RAISE_STRONG = 0.80;       // was ~0.85
        const VALUE_BET = 0.70;       // was ~0.75
        const CALL_THRESH = 0.55;       // will call lighter
        const BLUFF_FREQ = 0.25;       // was 0.12–0.15
        const CBET_FREQ = 0.60;       // continuation bet when checked to

        let action = 'check', raiseTo = null;

        if (need > 0) {
            // Facing a bet
            if (s > CALL_THRESH || need <= Math.min(40, cap * 0.20)) {
                if (s > RAISE_STRONG && cap > need + minRaise) {
                    action = 'raise';
                    const potAfterCall = pot + need;
                    const target = need + Math.round(Math.min(cap, potAfterCall * 1.25)); // ~1.25x pot raise when strong
                    raiseTo = committed.opp + clamp5(Math.min(cap, target));
                } else {
                    // some semi-bluff raises
                    if (Math.random() < BLUFF_FREQ && cap > need + minRaise) {
                        action = 'raise';
                        const target = need + Math.round(Math.min(cap, pot * 0.9)); // ~pot-ish
                        raiseTo = committed.opp + clamp5(Math.min(cap, target));
                    } else {
                        action = 'call';
                    }
                }
            } else {
                action = (Math.random() < 0.10 && cap > need + minRaise) ? 'raise' : 'fold';
                if (action === 'raise') {
                    const target = need + Math.round(Math.min(cap, pot * 0.8));
                    raiseTo = committed.opp + clamp5(Math.min(cap, target));
                }
            }
        } else {
            // No bet yet
            if (s > VALUE_BET && cap > BB) {
                action = 'bet';
                const size = clamp5(Math.min(cap, Math.round((pot + BB) * 0.9))); // bigger value bets
                raiseTo = committed.opp + size;
            } else if (Math.random() < CBET_FREQ && cap > BB) {
                action = 'bet';
                const size = clamp5(Math.min(cap, Math.max(BB, Math.round((pot + BB) * 0.6)))); // frequent c-bet
                raiseTo = committed.opp + size;
            } else {
                action = 'check';
            }
        }

        if (action === 'fold') { setStatus('Opponent folds. You win!', 'success'); bank += pot; saveBank(); updateBankBadge(); pot = 0; handOver = true; render(); return; }
        if (action === 'call') {
            const put = Math.min(need, cap); commitOpp(put); if (committed.you === committed.opp) currentBet = 0;
            setStatus(`Opponent calls ${put}.`); log('Opponent calls.');
            if (currentBet === 0 && committed.you === committed.opp) { render(); setTimeout(nextStreet, 450); } else { setTurn('you'); render(); }
            return;
        }
        if (action === 'check') { setStatus('Opponent checks.'); log('Opponent checks.'); setTurn('you'); render(); return; }

        // bet/raise
        let putNow = Math.max(need + minRaise, (raiseTo - committed.opp) || 0); putNow = Math.min(putNow, cap);
        commitOpp(putNow);
        if (committed.opp > currentBet) { minRaise = Math.max(minRaise, committed.opp - currentBet); currentBet = committed.opp; lastAggressor = 'opp'; }
        setStatus(`Opponent ${committed.opp === currentBet ? 'bets' : 'raises'} to ${committed.opp}.`); log(`Opponent makes it ${committed.opp}.`); setTurn('you'); render();
    }

    const clamp5 = x => Math.max(0, Math.round(x / 5) * 5);
    function estimateStrength() {
        // same base, tiny bump to make board textures feel tougher
        const cat = best5([...you, ...board]).score[0];
        const tex = board.length < 3 ? 0.08 : (board.length === 3 ? 0.13 : 0.18);
        return Math.min(0.98, Math.max(0.02, cat / 8 + tex - 0.01));
    }

    // ---------- Showdown ----------
    function showdown() {
        stage = Stage.Showdown;
        const yourBest = best5([...you, ...board]), oppBest = best5([...opp, ...board]);
        const cmpRes = cmp(yourBest.score, oppBest.score);

        const usedYou = new Set(yourBest.used.map(cardKey)), usedOpp = new Set(oppBest.used.map(cardKey));
        const usedBd = new Set(board.filter(c => usedYou.has(cardKey(c)) || usedOpp.has(cardKey(c))).map(cardKey));

        const youName = handName(yourBest.score), oppName = handName(oppBest.score);
        youHandText.textContent = (cmpRes > 0 ? 'You win — ' : cmpRes < 0 ? 'You lose — ' : 'Split — ') + youName;
        oppHandText.textContent = oppName;

        if (cmpRes > 0) { bank += pot; saveBank(); updateBankBadge(); setStatus('You win the pot!', 'success'); log('Showdown: You win.'); }
        else if (cmpRes < 0) { setStatus('Opponent wins the pot.', 'error'); log('Showdown: Opponent wins.'); }
        else { const half = Math.floor(pot / 2); bank += half; saveBank(); updateBankBadge(); setStatus('Pot is split.'); log('Showdown: Split pot.'); }
        pot = 0; handOver = true;

        render({ you: usedYou, opp: usedOpp, board: usedBd });
        sdnOppCards.innerHTML = ''; opp.forEach(c => sdnOppCards.appendChild(nodeFor(c, false, usedOpp.has(cardKey(c)))));
        sdnYouCards.innerHTML = ''; you.forEach(c => sdnYouCards.appendChild(nodeFor(c, false, usedYou.has(cardKey(c)))));
        sdnOppText.textContent = oppName; sdnYouText.textContent = youName; sdn.classList.remove('hidden');
    }

    // ---------- Misc ----------
    function role(who) { return who === 'you' ? (dealerIsYou ? 'SB (Dealer)' : 'BB') : (dealerIsYou ? 'BB' : 'SB (Dealer)'); }
})();
