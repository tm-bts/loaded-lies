// =========================================================
// Loaded Lies — single-player vs bots
// Top-down table view. Revolver rotates to point at active player.
// =========================================================

const CHAMBER_SIZE = 6;
const BULLETS = 2;
const START_HP = 3;

// ---------- Flavor pools ----------
const BOT_NAMES = [
  "Drifter", "Calico", "Hatch", "Mule", "Vicente", "Rook", "Pilgrim",
  "Flint", "Magpie", "Deacon", "Vega", "Dusty", "Crane", "Iris",
  "Hollow", "Wren", "Creed", "Scrap", "Ash", "Solas", "Mercer",
  "Juno", "Cottonmouth", "Bishop", "Ruby", "Nox", "Cassidy", "Teller",
];

const CLAIM_VERBS = {
  empty: [
    "shrugs and calls it",
    "drawls",
    "barely looks up",
    "says, flat",
    "says",
    "taps the table",
    "mutters",
  ],
  loaded: [
    "grins",
    "leans in",
    "stares across the table",
    "says, slow",
    "says",
    "sets their jaw",
    "doesn't blink",
  ],
};

const BELIEVE_LINES = [
  "lets it ride.",
  "shrugs it off.",
  "nods, says nothing.",
  "takes the word.",
  "waves it through.",
];

const CHALLENGE_LINES = [
  "calls the bluff.",
  "slams the table.",
  "says, 'liar.'",
  "laughs, calls it.",
  "points. 'no.'",
];

const CLICK_LINES = [
  "Click. Empty.",
  "Nothing. Dry chamber.",
  "Click. The room exhales.",
  "Hammer falls. Silence.",
  "Empty. Just oil and air.",
];

const BANG_LINES = [
  "BANG.",
  "The hammer drops. Crack.",
  "Muzzle flash.",
  "Powder and blood.",
  "CRACK.",
];

const HIT_LINES = [
  (n) => `${n} eats the round.`,
  (n) => `${n} takes a hit.`,
  (n) => `${n} buckles, stays up.`,
  (n) => `${n} bleeds.`,
  (n) => `${n} doesn't flinch. Much.`,
];

const OUT_LINES = [
  (n) => `${n} is out.`,
  (n) => `${n} slumps. Done.`,
  (n) => `${n} leaves the table.`,
  (n) => `${n} has nothing left.`,
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
};

const SHIRT_COLORS = ["#a83232", "#3a6abf", "#3a8a4a", "#7a3a8a", "#b88a2a", "#2a8a8a", "#8a4a2a", "#5a5a5a"];
const SKIN_COLORS  = ["#d4a980", "#e6c79a", "#a87858", "#8a5a3a", "#5a3a2a", "#c89878"];
const HAIR_COLORS  = ["#1a0e08", "#3a2a1a", "#7a4a2a", "#a87838", "#5a2a1a", "#2a2a2a", "#8a8a8a"];

function makeFigureSVG(colors) {
  const { skin, hair } = colors;
  // Top-down view of an NPC's head: hair-covered scalp from above,
  // small skin patch & eyes hint at the front (south side of SVG).
  return `<svg class="token-figure" viewBox="0 0 24 24" shape-rendering="auto">
    <!-- shadow under head -->
    <ellipse cx="12" cy="13.5" rx="11" ry="11" fill="rgba(0,0,0,0.85)"/>
    <!-- shoulders ring (peeking under head) -->
    <circle cx="12" cy="12" r="11.4" fill="#1a1310"/>
    <!-- head/scalp -->
    <circle cx="12" cy="12" r="9.4" fill="${hair}" stroke="#000" stroke-width="0.4"/>
    <!-- subtle scalp highlight -->
    <ellipse cx="10.5" cy="9.5" rx="3" ry="2" fill="rgba(255,255,255,0.08)"/>
    <!-- forehead / face hint at south side (toward table center after rotation) -->
    <path d="M7.5 16.2 Q12 18.5 16.5 16.2 Q15 14 12 14 Q9 14 7.5 16.2 Z" fill="${skin}" opacity="0.92"/>
    <!-- ears -->
    <ellipse cx="2.8" cy="12.2" rx="1.1" ry="1.7" fill="${skin}" opacity="0.9"/>
    <ellipse cx="21.2" cy="12.2" rx="1.1" ry="1.7" fill="${skin}" opacity="0.9"/>
    <!-- eyes -->
    <circle cx="10" cy="15.5" r="0.6" fill="#0a0706"/>
    <circle cx="14" cy="15.5" r="0.6" fill="#0a0706"/>
    <!-- nose hint -->
    <rect x="11.6" y="16.3" width="0.8" height="0.6" fill="rgba(0,0,0,0.4)"/>
  </svg>`;
}

function rollColors() {
  return {
    shirt: pick(SHIRT_COLORS),
    skin: pick(SKIN_COLORS),
    hair: pick(HAIR_COLORS),
  };
}

const el = {
  card: document.getElementById("game-card"),
  lobbyCard: document.getElementById("lobby-card"),
  playBtn: document.getElementById("play-bots-btn"),
  table: document.getElementById("game-table"),
  revolver: document.getElementById("revolver"),
  flash: document.getElementById("muzzle-flash"),
  smoke: document.getElementById("smoke-puff"),
  tokens: document.getElementById("player-tokens"),
  blood: document.getElementById("blood-layer"),
  screenFlash: document.getElementById("screen-flash"),
  status: document.getElementById("game-status"),
  actions: document.getElementById("game-actions"),
  log: document.getElementById("game-log"),
  exitBtn: document.getElementById("game-exit"),
  userName: document.getElementById("user-name"),
};

let state = null;
let botTimer = null;
let revolverAngle = 0; // cumulative rotation in degrees

el.playBtn?.addEventListener("click", () => {
  el.lobbyCard.classList.add("hidden");
  el.card.classList.remove("hidden");
  document.body.classList.add("in-game");
  startGame(el.userName.textContent?.trim() || "You");
});

el.exitBtn?.addEventListener("click", () => {
  clearTimeout(botTimer);
  state = null;
  el.card.classList.add("hidden");
  el.lobbyCard.classList.remove("hidden");
  document.body.classList.remove("in-game");
  if (el.blood) el.blood.innerHTML = "";
});

function startGame(humanName) {
  clearTimeout(botTimer);
  if (el.blood) el.blood.innerHTML = "";
  const [b1, b2] = pickN(BOT_NAMES, 2);
  state = {
    players: [
      { id: "you",  name: humanName, hp: START_HP, isBot: false, colors: rollColors() },
      { id: "bot1", name: b1,        hp: START_HP, isBot: true,  colors: rollColors() },
      { id: "bot2", name: b2,        hp: START_HP, isBot: true,  colors: rollColors() },
    ],
    turn: 0,
    chamber: newChamber(),
    slotIndex: 0,
    phase: "CLAIM",
    pendingClaim: null,
    log: [],
  };
  pushLog(`Chamber loaded. ${BULLETS} rounds among ${CHAMBER_SIZE} slots.`);
  layoutTokens();
  render();
  pointRevolverAt(state.turn, /*extraSpin*/ true);
  advance();
}

function newChamber() {
  const arr = Array(CHAMBER_SIZE).fill(false);
  let placed = 0;
  while (placed < BULLETS) {
    const i = Math.floor(Math.random() * CHAMBER_SIZE);
    if (!arr[i]) { arr[i] = true; placed++; }
  }
  return arr;
}

function aliveCount() {
  return state.players.filter((p) => p.hp > 0).length;
}

function activePlayer() {
  return state.players[state.turn];
}

function nextAliveFrom(fromIdx) {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (state.players[idx].hp > 0) return idx;
  }
  return fromIdx;
}

function nextTurn() { state.turn = nextAliveFrom(state.turn); }

function remainingBullets() {
  let b = 0;
  for (let i = state.slotIndex; i < state.chamber.length; i++) {
    if (state.chamber[i]) b++;
  }
  return b;
}
function remainingSlots() { return state.chamber.length - state.slotIndex; }
function loadedProbability() {
  const s = remainingSlots();
  return s > 0 ? remainingBullets() / s : 0;
}

// ---------- Table layout ----------
// Angle convention: 0° = top, 90° = right, 180° = bottom, 270° = left.
// Human (index 0) sits at the bottom. Others spaced clockwise.
function playerAngle(i, n) {
  return (180 + i * (360 / n)) % 360;
}

function layoutTokens() {
  const n = state.players.length;
  el.tokens.innerHTML = state.players.map((p, i) => {
    const angle = playerAngle(i, n);
    return `<div class="player-token" data-idx="${i}" style="--angle:${angle}deg">
      ${makeFigureSVG(p.colors)}
      <div class="token-name">${escapeHtml(p.name)}</div>
      <div class="token-hp" id="hp-${i}"></div>
    </div>`;
  }).join("");
}

function pointRevolverAt(idx, extraSpin = false) {
  const target = playerAngle(idx, state.players.length);
  // Shortest forward delta (always rotate clockwise so it feels alive)
  let delta = ((target - (revolverAngle % 360)) + 360) % 360;
  if (delta === 0) delta = 0;
  if (extraSpin) delta += 720; // dramatic start-of-game/turn spin
  else delta += 360; // one extra spin per turn — keeps motion going
  revolverAngle += delta;
  el.revolver.style.transform = `translate(-50%, -50%) rotate(${revolverAngle}deg)`;
}

function advance() {
  if (aliveCount() <= 1) {
    state.phase = "GAME_OVER";
    const winner = state.players.find((p) => p.hp > 0);
    pushLog(winner ? `${winner.name} is the last one standing.` : "Everyone's dead.");
    render();
    return;
  }

  if (state.slotIndex >= state.chamber.length) {
    state.chamber = newChamber();
    state.slotIndex = 0;
    pushLog(`New chamber. ${BULLETS} fresh rounds.`);
  }

  state.phase = "CLAIM";
  state.pendingClaim = null;
  pointRevolverAt(state.turn);
  render();

  if (activePlayer().isBot) botTimer = setTimeout(botClaim, 1300);
}

function botClaim() {
  const actualLoaded = state.chamber[state.slotIndex];
  let claim;
  if (actualLoaded) claim = Math.random() < 0.7 ? "empty" : "loaded";
  else claim = Math.random() < 0.85 ? "empty" : "loaded";
  submitClaim(claim);
}

function submitClaim(claim) {
  const claimerIdx = state.turn;
  const targetIdx = nextAliveFrom(claimerIdx);
  state.pendingClaim = { claimerIdx, targetIdx, claim };
  state.phase = "DECISION";

  const claimer = state.players[claimerIdx];
  const verb = pick(CLAIM_VERBS[claim]);
  pushLog(`${claimer.name} ${verb}: "${claim.toUpperCase()}."`);
  render();

  if (state.players[targetIdx].isBot) botTimer = setTimeout(botDecide, 1200);
}

function botDecide() {
  const { claim } = state.pendingClaim;
  const p = loadedProbability();
  let challengeProb;
  if (claim === "empty") challengeProb = Math.max(0, p - 0.15);
  else challengeProb = Math.max(0, (1 - p) - 0.1);
  challengeProb = Math.min(0.85, challengeProb + 0.05 * Math.random());
  resolveDecision(Math.random() < challengeProb ? "challenge" : "believe");
}

function resolveDecision(decision) {
  const { claimerIdx, targetIdx, claim } = state.pendingClaim;
  const claimer = state.players[claimerIdx];
  const target = state.players[targetIdx];
  const actualLoaded = state.chamber[state.slotIndex];
  const actual = actualLoaded ? "loaded" : "empty";

  if (decision === "challenge") {
    pushLog(`${target.name} ${pick(CHALLENGE_LINES)}`);
    const liar = (claim === actual) ? target : claimer;
    const liarIdx = (liar === target) ? targetIdx : claimerIdx;
    pushLog(`Reveal — ${actual.toUpperCase()}. ${pick(HIT_LINES)(liar.name)}`);
    liar.hp -= 1;
    animateHit(liarIdx);
    if (liar.hp <= 0) pushLog(pick(OUT_LINES)(liar.name));
  } else {
    pushLog(`${target.name} ${pick(BELIEVE_LINES)}`);
    pointRevolverAt(claimerIdx);
    if (actualLoaded) {
      claimer.hp -= 1;
      pushLog(`${pick(BANG_LINES)} ${pick(HIT_LINES)(claimer.name)}`);
      setTimeout(() => animateHit(claimerIdx, true), 300);
      if (claimer.hp <= 0) pushLog(pick(OUT_LINES)(claimer.name));
    } else {
      pushLog(pick(CLICK_LINES));
      setTimeout(() => el.revolver.classList.add("click"), 300);
      setTimeout(() => el.revolver.classList.remove("click"), 700);
    }
  }
  state.slotIndex++;

  nextTurn();
  botTimer = setTimeout(advance, 1800);
}

function animateHit(playerIdx, withFlash = false) {
  const token = el.tokens.querySelector(`[data-idx="${playerIdx}"]`);
  if (token) {
    token.classList.add("hit");
    setTimeout(() => token.classList.remove("hit"), 700);
    spawnBlood(token);
  }
  if (withFlash) {
    el.flash.classList.add("fire");
    el.smoke?.classList.add("fire");
    el.revolver.classList.add("recoil");
    el.screenFlash?.classList.add("fire");
    document.body.classList.add("shake");
    setTimeout(() => {
      el.flash.classList.remove("fire");
      el.smoke?.classList.remove("fire");
      el.revolver.classList.remove("recoil");
      el.screenFlash?.classList.remove("fire");
      document.body.classList.remove("shake");
    }, 600);
  }
  render(); // update HP pips
}

function spawnBlood(token) {
  if (!el.blood) return;
  const tableRect = el.table.getBoundingClientRect();
  const tokenRect = token.getBoundingClientRect();
  const cx = tokenRect.left + tokenRect.width / 2 - tableRect.left;
  const cy = tokenRect.top  + tokenRect.height / 2 - tableRect.top;

  // Drift drops outward
  const count = 14;
  for (let i = 0; i < count; i++) {
    const drop = document.createElement("div");
    drop.className = "blood";
    const angle = Math.random() * Math.PI * 2;
    const dist  = 30 + Math.random() * 70;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const size = 4 + Math.floor(Math.random() * 5);
    const shade = ["#8b1a1a", "#a82a2a", "#6b0f0f", "#5a0a0a"][i % 4];
    drop.style.setProperty("--dx", dx + "px");
    drop.style.setProperty("--dy", dy + "px");
    drop.style.left = (cx - size / 2) + "px";
    drop.style.top  = (cy - size / 2) + "px";
    drop.style.width = size + "px";
    drop.style.height = size + "px";
    drop.style.background = shade;
    drop.style.animationDelay = (Math.random() * 80) + "ms";
    el.blood.appendChild(drop);
    setTimeout(() => drop.remove(), 1300);
  }

  // Persistent stains under the player
  for (let i = 0; i < 4; i++) {
    const stain = document.createElement("div");
    stain.className = "blood-stain";
    const size = 3 + Math.floor(Math.random() * 4);
    const ox = (Math.random() - 0.5) * 30;
    const oy = (Math.random() - 0.5) * 25 + 10;
    stain.style.left = (cx + ox - size / 2) + "px";
    stain.style.top  = (cy + oy - size / 2) + "px";
    stain.style.width = size + "px";
    stain.style.height = size + "px";
    el.blood.appendChild(stain);
  }
}

function pushLog(msg) {
  state.log.push(msg);
  if (state.log.length > 20) state.log.shift();
}

function render() {
  renderTokens();
  renderStatus();
  renderActions();
  renderLog();
}

function renderTokens() {
  state.players.forEach((p, i) => {
    const token = el.tokens.querySelector(`[data-idx="${i}"]`);
    if (!token) return;
    const isActive = i === state.turn && p.hp > 0 && state.phase !== "GAME_OVER";
    const isTarget = state.pendingClaim && i === state.pendingClaim.targetIdx && state.phase === "DECISION";
    const dead = p.hp <= 0;
    token.classList.toggle("active", isActive);
    token.classList.toggle("target", isTarget);
    token.classList.toggle("dead", dead);
    const hpEl = token.querySelector(".token-hp");
    hpEl.innerHTML = "";
    for (let h = 0; h < START_HP; h++) {
      const pip = document.createElement("span");
      pip.className = "hp-pip" + (h < p.hp ? " filled" : "");
      hpEl.appendChild(pip);
    }
  });
}

// Also clear blood on play-again
function resetBlood() { if (el.blood) el.blood.innerHTML = ""; }

function renderStatus() {
  if (state.phase === "GAME_OVER") {
    const winner = state.players.find((p) => p.hp > 0);
    el.status.textContent = winner?.id === "you"
      ? "You survived."
      : winner ? `${winner.name} wins.` : "No survivors.";
    return;
  }
  const b = remainingBullets();
  const s = remainingSlots();
  const pct = s > 0 ? Math.round(100 * b / s) : 0;
  el.status.textContent = `${b}/${s} loaded · next shot ${pct}%`;
}

function renderActions() {
  if (state.phase === "GAME_OVER") {
    el.actions.innerHTML = `<button class="primary" id="play-again">Play Again</button>`;
    document.getElementById("play-again").onclick = () => startGame(state.players[0].name);
    return;
  }
  const active = activePlayer();
  if (state.phase === "CLAIM") {
    if (active.isBot) {
      el.actions.innerHTML = `<p class="muted">${escapeHtml(active.name)} is deciding…</p>`;
    } else {
      el.actions.innerHTML = `
        <p class="muted">Claim the next slot:</p>
        <div class="action-row">
          <button class="primary" id="claim-empty">Empty</button>
          <button class="primary danger" id="claim-loaded">Loaded</button>
        </div>`;
      document.getElementById("claim-empty").onclick = () => submitClaim("empty");
      document.getElementById("claim-loaded").onclick = () => submitClaim("loaded");
    }
  } else if (state.phase === "DECISION") {
    const target = state.players[state.pendingClaim.targetIdx];
    if (target.isBot) {
      el.actions.innerHTML = `<p class="muted">${escapeHtml(target.name)} is thinking…</p>`;
    } else {
      const claimer = state.players[state.pendingClaim.claimerIdx];
      el.actions.innerHTML = `
        <p class="muted">${escapeHtml(claimer.name)} says: <b>${state.pendingClaim.claim.toUpperCase()}</b></p>
        <div class="action-row">
          <button class="primary" id="believe">Believe</button>
          <button class="primary danger" id="challenge">Challenge</button>
        </div>`;
      document.getElementById("believe").onclick = () => resolveDecision("believe");
      document.getElementById("challenge").onclick = () => resolveDecision("challenge");
    }
  }
}

function renderLog() {
  el.log.innerHTML = state.log.map((l) => `<div class="log-line">${escapeHtml(l)}</div>`).join("");
  el.log.scrollTop = el.log.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
