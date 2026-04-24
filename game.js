// =========================================================
// Loaded Lies — single-player vs bots (v1)
// Rules:
//  - 1 human + 2 bots, 3 HP each.
//  - Chamber has 6 slots, 2 bullets placed at random.
//  - Active player claims the next slot is "empty" or "loaded".
//  - Next living player decides BELIEVE or CHALLENGE.
//    - CHALLENGE: slot revealed. Liar loses 1 HP.
//    - BELIEVE: active pulls trigger on self. -1 HP if loaded.
//  - Slot consumed either way. Turn passes. Chamber reloads when empty.
//  - Last player standing wins.
// =========================================================

const CHAMBER_SIZE = 6;
const BULLETS = 2;
const START_HP = 3;

const el = {
  card: document.getElementById("game-card"),
  lobbyCard: document.getElementById("lobby-card"),
  playBtn: document.getElementById("play-bots-btn"),
  players: document.getElementById("game-players"),
  chamber: document.getElementById("game-chamber"),
  status: document.getElementById("game-status"),
  actions: document.getElementById("game-actions"),
  log: document.getElementById("game-log"),
  exitBtn: document.getElementById("game-exit"),
  userName: document.getElementById("user-name"),
};

let state = null;
let botTimer = null;

el.playBtn?.addEventListener("click", () => {
  el.lobbyCard.classList.add("hidden");
  el.card.classList.remove("hidden");
  startGame(el.userName.textContent?.trim() || "You");
});

el.exitBtn?.addEventListener("click", () => {
  clearTimeout(botTimer);
  state = null;
  el.card.classList.add("hidden");
  el.lobbyCard.classList.remove("hidden");
});

function startGame(humanName) {
  clearTimeout(botTimer);
  state = {
    players: [
      { id: "you", name: humanName, hp: START_HP, isBot: false },
      { id: "bot1", name: "The Drifter", hp: START_HP, isBot: true },
      { id: "bot2", name: "Miss Calico", hp: START_HP, isBot: true },
    ],
    turn: 0,
    chamber: newChamber(),
    slotIndex: 0,
    phase: "CLAIM",
    pendingClaim: null,
    log: [],
  };
  pushLog(`Chamber loaded. ${BULLETS} bullets. ${CHAMBER_SIZE} slots.`);
  render();
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

function nextTurn() {
  state.turn = nextAliveFrom(state.turn);
}

function remainingBullets() {
  let b = 0;
  for (let i = state.slotIndex; i < state.chamber.length; i++) {
    if (state.chamber[i]) b++;
  }
  return b;
}

function remainingSlots() {
  return state.chamber.length - state.slotIndex;
}

function loadedProbability() {
  const slots = remainingSlots();
  if (slots <= 0) return 0;
  return remainingBullets() / slots;
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
    pushLog(`New chamber. ${BULLETS} bullets reloaded.`);
  }

  state.phase = "CLAIM";
  state.pendingClaim = null;
  render();

  const active = activePlayer();
  if (active.isBot) botTimer = setTimeout(botClaim, 900);
}

function botClaim() {
  const actualLoaded = state.chamber[state.slotIndex];
  // Simple strategy: usually claim empty. Occasionally bluff/truth the opposite.
  // Bots lean toward "empty" because it's the safer social move.
  let claim;
  if (actualLoaded) claim = Math.random() < 0.7 ? "empty" : "loaded"; // often bluff
  else claim = Math.random() < 0.85 ? "empty" : "loaded"; // mostly truth
  submitClaim(claim);
}

function submitClaim(claim) {
  const claimerIdx = state.turn;
  const targetIdx = nextAliveFrom(claimerIdx);
  state.pendingClaim = { claimerIdx, targetIdx, claim };
  state.phase = "DECISION";

  const claimer = state.players[claimerIdx];
  pushLog(`${claimer.name} claims: next slot is ${claim.toUpperCase()}.`);
  render();

  const target = state.players[targetIdx];
  if (target.isBot) botTimer = setTimeout(botDecide, 1100);
}

function botDecide() {
  const { claim } = state.pendingClaim;
  const p = loadedProbability();
  // If claimer says "empty" but odds of loaded are high → suspicious.
  // If claimer says "loaded" but odds of loaded are low → suspicious.
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
    pushLog(`${target.name} calls the bluff.`);
    const liar = (claim === actual) ? target : claimer;
    pushLog(`Slot reveals: ${actual.toUpperCase()}. ${liar.name} takes the hit.`);
    liar.hp -= 1;
    if (liar.hp <= 0) pushLog(`${liar.name} is out.`);
  } else {
    pushLog(`${target.name} lets it ride.`);
    if (actualLoaded) {
      claimer.hp -= 1;
      pushLog(`BANG. ${claimer.name} eats a round.`);
      if (claimer.hp <= 0) pushLog(`${claimer.name} is out.`);
    } else {
      pushLog(`Click. Empty.`);
    }
  }
  state.slotIndex++;

  nextTurn();
  botTimer = setTimeout(advance, 1500);
}

function pushLog(msg) {
  state.log.push(msg);
  if (state.log.length > 20) state.log.shift();
}

function render() {
  renderPlayers();
  renderChamber();
  renderStatus();
  renderActions();
  renderLog();
}

function renderPlayers() {
  el.players.innerHTML = state.players.map((p, i) => {
    const isActive = i === state.turn && p.hp > 0 && state.phase !== "GAME_OVER";
    const isTarget = state.pendingClaim && i === state.pendingClaim.targetIdx && state.phase === "DECISION";
    const dead = p.hp <= 0;
    const hearts = "♥".repeat(Math.max(0, p.hp)) + "♡".repeat(Math.max(0, START_HP - p.hp));
    const tag = isActive ? "claims" : isTarget ? "decides" : "";
    return `<div class="player${isActive ? " active" : ""}${isTarget ? " target" : ""}${dead ? " dead" : ""}">
      <div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-hp">${hearts}</div>
      <div class="player-tag">${tag}</div>
    </div>`;
  }).join("");
}

function renderChamber() {
  el.chamber.innerHTML = state.chamber.map((isBullet, i) => {
    const consumed = i < state.slotIndex;
    const current = i === state.slotIndex && state.phase !== "GAME_OVER";
    let cls = "slot";
    if (consumed) cls += isBullet ? " consumed bullet" : " consumed empty";
    if (current) cls += " current";
    const symbol = consumed ? (isBullet ? "●" : "○") : "";
    return `<div class="${cls}">${symbol}</div>`;
  }).join("");
}

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
  el.status.textContent = `${b}/${s} loaded • next shot ${pct}%`;
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
        <p class="muted">Your claim for the next slot:</p>
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
        <p class="muted">${escapeHtml(claimer.name)} says the slot is <b>${state.pendingClaim.claim.toUpperCase()}</b>.</p>
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
