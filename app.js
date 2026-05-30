// --- DOM refs -----------------------------------------------------------------

// Home screen
const homeScreen       = document.getElementById('homeScreen');
const soloBtn          = document.getElementById('soloBtn');
const joinSessionBtn   = document.getElementById('joinSessionBtn');
const joinModal        = document.getElementById('joinModal');
const sessionToken     = document.getElementById('sessionToken');
const username         = document.getElementById('username');
const joinConfirmBtn   = document.getElementById('joinConfirmBtn');
const joinCancelBtn    = document.getElementById('joinCancelBtn');
const joinError        = document.getElementById('joinError');

// App
const appContainer     = document.querySelector('.app');

// Session sidebar
const sessionSidebar   = document.getElementById('sessionSidebar');
const sessionTokenDisplay = document.getElementById('sessionTokenDisplay');
const copyTokenBtn     = document.getElementById('copyTokenBtn');
const sessionPlayersList = document.getElementById('sessionPlayersList');
const sessionRollsList  = document.getElementById('sessionRollsList');
const exitSessionBtn   = document.getElementById('exitSessionBtn');

// Roll button and related
const rollBtn         = document.getElementById('rollBtn');
const resetBtn        = document.getElementById('resetBtn');
const diceCount       = document.getElementById('diceCount');
const diceType        = document.getElementById('diceType');
const diceGrid        = document.getElementById('diceGrid');
const results         = document.getElementById('results');
const rollSummaryEl   = document.getElementById('rollSummary');
const totalEl         = document.getElementById('total');
const unresolvedArea  = document.getElementById('unresolvedArea');

const poolNumber      = document.getElementById('poolNumber');
const poolAddBtn      = document.getElementById('poolAddBtn');
const poolReplaceBtn  = document.getElementById('poolReplaceBtn');
const poolDecBtn      = document.getElementById('poolDecBtn');
const poolIncBtn      = document.getElementById('poolIncBtn');

const historyEl       = document.getElementById('history');
const historyClearBtn = document.getElementById('historyClearBtn');

const settingsBtn      = document.getElementById('settingsBtn');
const settingsOverlay  = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const lightModeToggle  = document.getElementById('lightModeToggle');

// --- State -------------------------------------------------------------------

let currentSides      = 6;
let poolCount         = 0;
let isAnimating       = false;
let skipAnimation     = false;
let pendingAnimations = []; // land() fns for each in-flight die
let sortTimer         = null; // pending sortDiceByValue timeout
let appMode           = null; // 'solo' or 'session'
let sessionId         = null; // current session token
let currentUsername   = null; // current player username
let sessionPlayers    = {}; // { userId: { name, status } }
let sessionRolls      = []; // array of { username, sides, count, rolls, timestamp }

// --- Initialization ----------------------------------------------------------

// Restore light-mode preference on load
if (localStorage.getItem('lightMode') === 'true') {
  document.documentElement.classList.add('light-mode');
  lightModeToggle.checked = true;
}

// Initialize app mode from sessionStorage
function initializeMode() {
  appMode = sessionStorage.getItem('appMode');
  currentUsername = sessionStorage.getItem('currentUsername');
  sessionId = sessionStorage.getItem('sessionId');

  if (appMode === 'solo' || appMode === 'session') {
    showApp();
  } else {
    showHomeScreen();
  }
}

function showHomeScreen() {
  homeScreen.classList.remove('hidden');
  appContainer.classList.add('hidden');
  sessionSidebar.classList.add('hidden');
  appMode = null;
}

function showApp() {
  homeScreen.classList.add('hidden');
  appContainer.classList.remove('hidden');
  if (appMode === 'session') {
    sessionSidebar.classList.remove('hidden');
  }
}

// Call on page load
initializeMode();

// --- Constants ---------------------------------------------------------------

const STAGGER_MS = 120; // delay between each die's reveal start
const SPIN_MS    = 200; // how long each die tumbles before landing

// Pip layout for d6 faces: 3x3 grid, 1 = filled dot
const PIP_PATTERNS = {
  1: [0,0,0, 0,1,0, 0,0,0],
  2: [0,0,1, 0,0,0, 1,0,0],
  3: [0,0,1, 0,1,0, 1,0,0],
  4: [1,0,1, 0,0,0, 1,0,1],
  5: [1,0,1, 0,1,0, 1,0,1],
  6: [1,0,1, 1,0,1, 1,0,1],
};

// --- Utilities ---------------------------------------------------------------

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

/** Builds the visual face for a die — pip grid for d6 and below, number otherwise. */
function createDieFace(value, sides) {
  if (sides === 6 && value === 6) {
    const span = document.createElement('span');
    span.className = 'die-skull';
    span.textContent = '💀';
    return span;
  }
  if (sides <= 6) {
    const grid = document.createElement('div');
    grid.className = 'die-pips';
    (PIP_PATTERNS[value] || []).forEach(filled => {
      const pip = document.createElement('div');
      pip.className = filled ? 'pip' : 'pip empty';
      grid.appendChild(pip);
    });
    return grid;
  }
  const span = document.createElement('span');
  span.textContent = value;
  return span;
}

/** Returns the number of dice currently visible in a sorted row. */
function rowDieCount(row) {
  const inner = row.querySelector('.dice-row-inner');
  return inner ? inner.querySelectorAll('.die').length : 0;
}

/** Creates a row-action button and attaches a click handler. */
function makeBtn(text, cls, title, handler) {
  const btn = document.createElement('button');
  btn.className = 'row-btn ' + cls;
  btn.textContent = text;
  btn.title = title;
  btn.addEventListener('click', handler);
  return btn;
}

/** Clears the roll area DOM — shared by runRoll, recallRolls, reset, and pool-replace. */
function clearRollDisplay() {
  diceGrid.innerHTML       = '';
  unresolvedArea.innerHTML = '';
  unresolvedArea.classList.add('hidden');
  rollSummaryEl.textContent = '';
}

/**
 * Attaches a right-click / long-press handler that works on desktop and mobile.
 * Android fires contextmenu after the touch timer, so we guard against double-firing.
 */
function addContextMenuOrLongPress(el, handler) {
  let timer;
  let handledByTouch = false;

  el.addEventListener('touchstart', () => {
    handledByTouch = false;
    timer = setTimeout(() => { handledByTouch = true; handler(); }, 600);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev =>
    el.addEventListener(ev, () => clearTimeout(timer)));

  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!handledByTouch) handler();
    handledByTouch = false;
  });
}

// --- Die animation -----------------------------------------------------------

/**
 * Spins a die through random faces then lands on finalValue.
 * Registers a land() fn in pendingAnimations so clicking the roll area
 * can skip all remaining animations instantly.
 */
function animateDie(dieEl, finalValue, sides, delay, onReveal) {
  let done = false;

  function land() {
    if (done) return;
    done = true;
    dieEl.innerHTML = '';
    dieEl.appendChild(createDieFace(finalValue, sides));
    dieEl.classList.replace('spinning', 'revealed');
    onReveal();
  }

  pendingAnimations.push(land);

  setTimeout(() => {
    if (done || skipAnimation) { land(); return; }

    const start = Date.now();

    function tick() {
      if (done || skipAnimation) { land(); return; }

      const progress = Math.min((Date.now() - start) / SPIN_MS, 1);
      if (progress >= 1) { land(); return; }

      dieEl.innerHTML = '';
      dieEl.appendChild(createDieFace(rollDie(sides), sides));
      setTimeout(tick, 50 + progress * progress * 200); // eases from fast to slow
    }

    tick();
  }, delay);
}

// --- FLIP sort animation -----------------------------------------------------

/**
 * Sorts dice into per-value rows using the FLIP animation technique.
 * Action buttons and overflow badges are built before the position snapshot
 * so their space is already reserved — revealing them later causes no layout shift.
 */
function sortDiceByValue(dieEls, rolls) {
  // FIRST: snapshot positions while dice are still in the staging row
  const firstRect = new Map(dieEls.map(el => [el, el.getBoundingClientRect()]));

  // Group dice by face value
  const groups = new Map();
  dieEls.forEach((el, i) => {
    const v = rolls[i];
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(el);
  });

  // Row-level statistics for the count label highlights
  const counts      = [...groups.values()].map(g => g.length);
  const maxCount    = Math.max(...counts);
  const minCount    = Math.min(...counts);
  const hasVariance = maxCount > minCount;
  const allValues   = [...groups.keys()];
  const maxRollVal  = Math.max(...allValues);
  const minRollVal  = Math.min(...allValues);

  // Rebuild grid: one row per possible face value (including empty ones)
  diceGrid.innerHTML = '';
  for (let value = 1; value <= currentSides; value++) {
    diceGrid.appendChild(buildSortedRow(value, groups, hasVariance, maxCount, minCount, maxRollVal, minRollVal));
  }

  // Add action buttons (hidden) + overflow badges BEFORE the position snapshot
  // so their space is already reserved in the layout
  diceGrid.querySelectorAll('.dice-row.sorted').forEach(row => {
    row.appendChild(buildRowActions(row));
    updateRowButtonStates(row);
  });
  diceGrid.querySelectorAll('.dice-row-inner').forEach(refreshRowOverflow);

  // FLIP: read final positions, apply inverse offsets, then release to natural
  const lastRect = new Map(dieEls.map(el => [el, el.getBoundingClientRect()]));

  dieEls.forEach(el => {
    const { left: fx, top: fy } = firstRect.get(el);
    const { left: lx, top: ly } = lastRect.get(el);
    el.style.animation  = 'none';
    el.style.transition = 'none';
    el.style.transform  = 'translate(' + (fx - lx) + 'px, ' + (fy - ly) + 'px)';
  });

  diceGrid.offsetHeight; // flush pending style writes (single reflow)

  dieEls.forEach(el => {
    el.style.transition = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    el.style.transform  = '';
  });

  setTimeout(() => {
    dieEls.forEach(el => {
      el.classList.remove('revealed');
      el.style.cssText = ''; // clear all inline styles at once
    });
    diceGrid.querySelectorAll('.row-actions').forEach(a => a.style.visibility = '');
    resetBtn.classList.remove('hidden');
  }, 700);
}

/** Builds a single sorted .dice-row with label, inner dice, and dataset attributes. */
function buildSortedRow(value, groups, hasVariance, maxCount, minCount, maxRollVal, minRollVal) {
  const elems = groups.get(value) || [];
  const row   = document.createElement('div');
  row.className = 'dice-row sorted';
  if (elems.length === 0) row.classList.add('dice-row--empty');

  Object.assign(row.dataset, {
    value,
    originalCount: elems.length,
    isMax:    String(hasVariance && elems.length > 0 && elems.length === maxCount),
    isMin:    String(hasVariance && elems.length > 0 && elems.length === minCount),
    isDieMax: String(currentSides > 1 && value === maxRollVal),
    isDieMin: String(currentSides > 1 && value === minRollVal),
  });

  const valueSpan = document.createElement('span');
  valueSpan.className = 'row-value';
  valueSpan.textContent = value;

  const countSpan = document.createElement('span');
  countSpan.className = 'row-count';
  countSpan.textContent = elems.length + 'x';
  if (hasVariance && elems.length > 0) {
    if      (elems.length === maxCount) countSpan.classList.add('high');
    else if (elems.length === minCount) countSpan.classList.add('low');
  }

  const label = document.createElement('div');
  label.className = 'row-label';
  label.append(valueSpan, countSpan);

  const inner = document.createElement('div');
  inner.className = 'dice-row-inner';
  elems.forEach(el => inner.appendChild(el));

  row.append(label, inner);
  return row;
}

/** Builds the hidden .row-actions grid for a sorted row. */
function buildRowActions(row) {
  const deleteBtn = makeBtn('-', 'btn-delete',
    'Remove original count from this row | Right-click: clear this row and all below',
    () => removeDiceFromRow(row));
  addContextMenuOrLongPress(deleteBtn, () => clearRowAndBelow(row));

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  actions.style.visibility = 'hidden';
  actions.append(
    makeBtn('+',  'btn-double',      'Add original dice count to this row', () => addDiceToRow(row)),
    deleteBtn,
    makeBtn('P+', 'btn-pool',        'Add current dice count to side pool',      () => adjustPool(row, +1)),
    makeBtn('P-', 'btn-pool-remove', 'Remove current dice count from side pool', () => adjustPool(row, -1)),
  );
  return actions;
}

// --- Row operations ----------------------------------------------------------

/** Hides overflow dice and shows a '...' badge at the right edge of the row. */
function refreshRowOverflow(inner) {
  inner.querySelector('.row-overflow')?.remove();
  inner.querySelectorAll('.die').forEach(d => (d.style.display = ''));

  if (inner.scrollWidth <= inner.clientWidth) return;

  const badge = document.createElement('span');
  badge.className = 'row-overflow';
  badge.textContent = '...';
  inner.appendChild(badge);

  const dies = [...inner.querySelectorAll('.die')];
  let hidden = 0;
  while (inner.scrollWidth > inner.clientWidth && hidden < dies.length - 1) {
    dies[dies.length - 1 - hidden++].style.display = 'none';
  }
}

/** Syncs disabled state for all action buttons on a sorted row. */
function updateRowButtonStates(row) {
  const empty    = rowDieCount(row) === 0;
  const neverHad = parseInt(row.dataset.originalCount, 10) === 0;
  row.querySelector('.btn-double')?.toggleAttribute('disabled', neverHad);
  row.querySelector('.btn-delete')?.toggleAttribute('disabled', neverHad || empty);
  row.querySelector('.btn-pool')?.toggleAttribute('disabled', empty);
  row.querySelector('.btn-pool-remove')?.toggleAttribute('disabled', empty);
}

function removeDiceFromRow(row) {
  const inner    = row.querySelector('.dice-row-inner');
  const original = parseInt(row.dataset.originalCount, 10);
  const dies     = [...inner.querySelectorAll('.die')];
  dies.splice(-Math.min(original, dies.length)).forEach(d => d.remove());

  const remaining = inner.querySelectorAll('.die').length;
  row.querySelector('.row-count').textContent = remaining + 'x';
  row.classList.toggle('dice-row--empty', remaining === 0);
  refreshRowOverflow(inner);
  updateRowButtonStates(row);
  updateDiceTotal();
}

/** Clears all dice from the given row and every row with a lower face value. */
function clearRowAndBelow(row) {
  const threshold = parseInt(row.dataset.value, 10);
  diceGrid.querySelectorAll('.dice-row.sorted').forEach(r => {
    if (parseInt(r.dataset.value, 10) > threshold) return;
    const inner = r.querySelector('.dice-row-inner');
    inner.querySelectorAll('.die').forEach(d => d.remove());
    inner.querySelector('.row-overflow')?.remove();
    r.querySelector('.row-count').textContent = '0x';
    r.classList.add('dice-row--empty');
    updateRowButtonStates(r);
  });
  updateDiceTotal();
}

function addDiceToRow(row) {
  const inner    = row.querySelector('.dice-row-inner');
  const value    = parseInt(row.dataset.value, 10);
  const original = parseInt(row.dataset.originalCount, 10);
  const isMax    = row.dataset.isDieMax === 'true';
  const isMin    = row.dataset.isDieMin === 'true';

  for (let i = 0; i < original; i++) {
    const die = document.createElement('div');
    die.className = 'die';
    if (isMax)      die.classList.add('max');
    else if (isMin) die.classList.add('min');
    die.appendChild(createDieFace(value, currentSides));
    inner.appendChild(die);
  }

  const count = inner.querySelectorAll('.die').length;
  row.querySelector('.row-count').textContent = count + 'x';
  row.classList.remove('dice-row--empty');
  refreshRowOverflow(inner);
  updateRowButtonStates(row);
  updateDiceTotal();
}

// --- Totals & pool -----------------------------------------------------------

function updateDiceTotal() {
  const resolved   = diceGrid.querySelectorAll('.dice-row-inner .die').length;
  const unresolved = unresolvedArea.querySelectorAll('.unresolved-die').length;
  totalEl.textContent = (resolved + unresolved) || '-';
}

function updatePoolDisplay() {
  poolNumber.textContent  = poolCount;
  const empty = poolCount === 0;
  poolAddBtn.disabled     = empty;
  poolReplaceBtn.disabled = empty;
  poolDecBtn.disabled     = empty;
}

/** Adds (+1) or removes (-1) the row's current die count from the pool. */
function adjustPool(row, direction) {
  const count = rowDieCount(row);
  if (count === 0) return;
  poolCount = Math.max(0, poolCount + direction * count);
  updatePoolDisplay();
}

function createUnresolvedDice(count) {
  unresolvedArea.innerHTML = '';

  const valueSpan = document.createElement('span');
  valueSpan.className = 'row-value';
  valueSpan.textContent = '?';

  const countSpan = document.createElement('span');
  countSpan.className = 'row-count';
  countSpan.textContent = count + 'x';

  const label = document.createElement('div');
  label.className = 'row-label';
  label.append(valueSpan, countSpan);

  const inner = document.createElement('div');
  inner.className = 'dice-row-inner unresolved-inner';
  for (let i = 0; i < count; i++) {
    const die = document.createElement('div');
    die.className = 'die unresolved-die';
    die.textContent = '?';
    inner.appendChild(die);
  }

  const row = document.createElement('div');
  row.className = 'dice-row';
  row.append(label, inner);

  unresolvedArea.appendChild(row);
  unresolvedArea.classList.remove('hidden');
  results.classList.remove('hidden');
  resetBtn.classList.remove('hidden');
  updateDiceTotal();
}

// --- Roll logic --------------------------------------------------------------

function runRoll(count, sides, fixedRolls = null) {
  isAnimating       = true;
  skipAnimation     = false;
  pendingAnimations = [];
  rollBtn.classList.add('rolling');
  rollBtn.disabled = true;
  resetBtn.classList.add('hidden');

  setTimeout(() => {
    rollBtn.classList.remove('rolling');

    const rolls  = fixedRolls ?? Array.from({ length: count }, () => rollDie(sides));
    const maxVal = Math.max(...rolls);
    const minVal = Math.min(...rolls);

    clearRollDisplay();
    totalEl.textContent = '-';
    results.classList.remove('hidden');

    // Place all dice in a single staging row before animation
    const stagingRow = document.createElement('div');
    stagingRow.className = 'dice-row';
    diceGrid.appendChild(stagingRow);

    const dieEls = rolls.map(() => {
      const die = document.createElement('div');
      die.className = 'die spinning';
      die.appendChild(createDieFace(rollDie(sides), sides));
      stagingRow.appendChild(die);
      return die;
    });

    rollSummaryEl.textContent = count + 'd' + sides;
    addHistoryEntry(count, sides, rolls);

    // Reveal dice one at a time with staggered delays
    let revealed = 0;
    dieEls.forEach((dieEl, i) => {
      animateDie(dieEl, rolls[i], sides, i * STAGGER_MS, () => {
        if (sides > 1) {
          if      (rolls[i] === maxVal) dieEl.classList.add('max');
          else if (rolls[i] === minVal) dieEl.classList.add('min');
        }
        if (++revealed === count) {
          totalEl.textContent = count;
          rollBtn.disabled    = false;
          isAnimating         = false;
          sortTimer = setTimeout(() => {
            sortDiceByValue(dieEls, rolls);
            // Emit roll to session after sorting completes
            if (appMode === 'session' && typeof emitRoll !== 'undefined') {
              setTimeout(() => emitRoll(sides, count, rolls), 700);
            }
          }, skipAnimation ? 0 : 250);
        }
      });
    });
  }, 350);
}

/** Re-rolls existing dice if any are present, otherwise uses the input values. */
function roll() {
  const resolved   = diceGrid.querySelectorAll('.dice-row-inner .die').length;
  const unresolved = unresolvedArea.querySelectorAll('.unresolved-die').length;
  const existing   = resolved + unresolved;

  if (existing > 0) {
    runRoll(existing, currentSides);
  } else {
    const count = Math.max(1, Math.min(100, parseInt(diceCount.value, 10) || 1));
    const sides = parseInt(diceType.value, 10);
    currentSides = sides;
    runRoll(count, sides);
  }
}

/** Instantly displays a past roll from history, cancelling any in-flight animation. */
function recallRolls(rolls, sides) {
  isAnimating       = false;
  skipAnimation     = false;
  pendingAnimations = [];
  clearTimeout(sortTimer);
  rollBtn.disabled = false;
  rollBtn.classList.remove('rolling');

  currentSides = sides;
  const maxVal = Math.max(...rolls);
  const minVal = Math.min(...rolls);

  clearRollDisplay();
  rollSummaryEl.textContent = rolls.length + 'd' + sides;
  totalEl.textContent       = rolls.length;
  results.classList.remove('hidden');
  resetBtn.classList.add('hidden');

  const stagingRow = document.createElement('div');
  stagingRow.className = 'dice-row';
  diceGrid.appendChild(stagingRow);

  const dieEls = rolls.map(value => {
    const die = document.createElement('div');
    die.className = 'die revealed';
    if (sides > 1) {
      if      (value === maxVal) die.classList.add('max');
      else if (value === minVal) die.classList.add('min');
    }
    die.appendChild(createDieFace(value, sides));
    stagingRow.appendChild(die);
    return die;
  });

  sortDiceByValue(dieEls, rolls);
}

// --- History -----------------------------------------------------------------

function addHistoryEntry(count, sides, rolls) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const li = document.createElement('li');
  li.innerHTML = '<span>' + count + 'd' + sides + ': ' + formatRollsForHistory(rolls) + '</span>'
    + '<span class="h-total">' + count + '</span>'
    + '<span class="h-time">' + timeStr + '</span>';
  li.title = 'Click to recall this roll';
  li.addEventListener('click', () => recallRolls(rolls, sides));
  historyEl.prepend(li);
  while (historyEl.children.length > 20) historyEl.lastChild.remove();
  historyClearBtn.disabled = false;
}

function formatRollsForHistory(rolls) {
  const counts = new Map();
  rolls.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([v, c]) => c + 'x' + v)
    .join('  ');
}

// --- Event listeners ---------------------------------------------------------

// Home screen
soloBtn.addEventListener('click', () => {
  appMode = 'solo';
  currentUsername = null;
  sessionId = null;
  sessionStorage.setItem('appMode', 'solo');
  sessionStorage.removeItem('currentUsername');
  sessionStorage.removeItem('sessionId');
  showApp();
});

joinSessionBtn.addEventListener('click', () => {
  joinModal.classList.remove('hidden');
  sessionToken.focus();
});

joinCancelBtn.addEventListener('click', () => {
  joinModal.classList.add('hidden');
  sessionToken.value = '';
  username.value = '';
  joinError.textContent = '';
  joinError.classList.add('hidden');
});

joinConfirmBtn.addEventListener('click', () => {
  const token = sessionToken.value.trim();
  const user = username.value.trim();

  if (!token || !user) {
    joinError.textContent = 'Please enter both token and name';
    joinError.classList.remove('hidden');
    return;
  }

  joinConfirmBtn.disabled = true;
  joinError.textContent = 'Connecting...';
  joinError.classList.remove('hidden');

  // Initialize Socket.io and join session
  if (!window.socket) {
    initializeSocket().then(() => {
      joinSessionSocket(token, user);
    }).catch(err => {
      joinError.textContent = 'Failed to connect to server';
      joinConfirmBtn.disabled = false;
    });
  } else {
    joinSessionSocket(token, user);
  }
});

function joinSessionSocket(token, user) {
  joinSession(token, user, (response) => {
    if (!response.success) {
      joinError.textContent = response.error || 'Failed to join session';
      joinError.classList.remove('hidden');
      joinConfirmBtn.disabled = false;
      return;
    }

    appMode = 'session';
    currentUsername = user;
    sessionId = token;
    sessionStorage.setItem('appMode', 'session');
    sessionStorage.setItem('currentUsername', user);
    sessionStorage.setItem('sessionId', token);
    sessionTokenDisplay.textContent = token;

    joinModal.classList.add('hidden');
    sessionToken.value = '';
    username.value = '';
    joinError.textContent = '';
    joinError.classList.add('hidden');
    joinConfirmBtn.disabled = false;

    showApp();
  });
}

exitSessionBtn.addEventListener('click', () => {
  if (confirm('Leave session?')) {
    disconnectSession();
    appMode = 'solo';
    currentUsername = null;
    sessionId = null;
    sessionStorage.removeItem('appMode');
    sessionStorage.removeItem('currentUsername');
    sessionStorage.removeItem('sessionId');
    sessionSidebar.classList.add('hidden');
    sessionPlayersList.innerHTML = '';
    sessionRollsList.innerHTML = '';
    showHomeScreen();
  }
});

copyTokenBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(sessionId).then(() => {
    copyTokenBtn.textContent = '✓';
    setTimeout(() => { copyTokenBtn.textContent = '📋'; }, 1500);
  });
});

// Skip ongoing animation by clicking the roll area
results.addEventListener('click', () => {
  if (!isAnimating) return;
  skipAnimation = true;
  pendingAnimations.splice(0).forEach(land => land());
});

// Roll / Reset
rollBtn.addEventListener('click', roll);

resetBtn.addEventListener('click', () => {
  currentSides = parseInt(diceType.value, 10);
  const count  = Math.max(1, Math.min(100, parseInt(diceCount.value, 10) || 1));
  clearRollDisplay();
  createUnresolvedDice(count);
});

// Pool
poolAddBtn.addEventListener('click', () => {
  const count = poolCount;
  poolCount = 0;
  updatePoolDisplay();
  createUnresolvedDice(count);
});

poolReplaceBtn.addEventListener('click', () => {
  const count = poolCount;
  poolCount = 0;
  updatePoolDisplay();
  clearRollDisplay();
  createUnresolvedDice(count);
});

poolDecBtn.addEventListener('click', () => { if (poolCount > 0) { poolCount--; updatePoolDisplay(); } });
poolIncBtn.addEventListener('click', () => { poolCount++; updatePoolDisplay(); });

// History
historyClearBtn.addEventListener('click', () => {
  historyEl.innerHTML = '';
  historyClearBtn.disabled = true;
});

// Settings
settingsBtn.addEventListener('click',      () => settingsOverlay.classList.remove('hidden'));
settingsCloseBtn.addEventListener('click', () => settingsOverlay.classList.add('hidden'));
settingsOverlay.addEventListener('click',  e => {
  if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') settingsOverlay.classList.add('hidden');
});

lightModeToggle.addEventListener('change', () => {
  document.documentElement.classList.toggle('light-mode', lightModeToggle.checked);
  localStorage.setItem('lightMode', lightModeToggle.checked);
});

// Trigger roll on Enter from either input
[diceCount, diceType].forEach(el => el.addEventListener('keydown', e => {
  if (e.key === 'Enter') roll();
}));