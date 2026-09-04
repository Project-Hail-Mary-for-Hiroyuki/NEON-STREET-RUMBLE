"use strict";
/* NEON STREET RUMBLE - 依存なし DOMスタブ スモークテスト
   index.html のゲームスクリプトを vm 上で起動し、主要機能をシミュレート検証する。 */
const fs = require("fs");
const vm = require("vm");

const GAME_SRC = "/tmp/opencode/game.js";

/* ---------------------- 2D Context スタブ ---------------------- */
function makeCtx() {
  const grad = { addColorStop() {} };
  const target = {
    canvas: null,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => grad,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData() {},
    setTransform() {}, clearRect() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {}, fill() {},
    stroke() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
    drawImage() {}, clip() {}, resetTransform() {}, setLineDash() {}
  };
  return new Proxy(target, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k === "symbol") return undefined;
      return o[k] !== undefined ? o[k] : (() => {});
    },
    set(o, k, v) { o[k] = v; return true; }
  });
}

/* ---------------------- Element スタブ ---------------------- */
function makeEl(tag) {
  const classSet = new Set();
  const el = {
    tagName: (tag || "div").toUpperCase(),
    id: "",
    dataset: {},
    style: {},
    children: [],
    value: "",
    textContent: "",
    innerHTML: "",
    className: "",
    disabled: false,
    width: 0,
    height: 0,
    _listeners: {},
    classList: {
      add: (...cs) => cs.forEach(c => classSet.add(c)),
      remove: (...cs) => cs.forEach(c => classSet.delete(c)),
      toggle: (c, force) => {
        const on = force === undefined ? !classSet.has(c) : !!force;
        if (on) classSet.add(c); else classSet.delete(c);
        return on;
      },
      contains: c => classSet.has(c)
    },
    addEventListener(type, fn) { (el._listeners[type] = el._listeners[type] || []).push(fn); },
    removeEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    closest() { return null; },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0 };
    },
    getContext() { if (!el._ctx) el._ctx = makeCtx(); return el._ctx; },
    appendChild(c) { el.children.push(c); return c; },
    removeChild(c) { el.children = el.children.filter(x => x !== c); return c; },
    insertBefore() {},
    querySelector() { return makeEl("div"); },
    querySelectorAll() { return []; },
    focus() {},
    select() {},
    click() {}
  };
  return el;
}

/* 武器スロット + 主要IDのマップ */
const WEAPON_IDS = ["player-hpbar","enemy-hpbar","enemy-name","timer","score","combo-hud",
  "combo-hits","final-score","final-combo","final-time","final-kills","title-best",
  "best-score","new-record","pause-screen","pause-btn","fullscreen-btn","stage-label","stage-message",
  "enemies-left","weapon-dur","stageclear-screen","clear-score","title-screen","gameover-screen",
  "weapon-slots","weapon-label","copy-code-btn","code-close","code-text","code-copy","code-download",
  "code-status","touch-ui","stick","stick-zone","stick-base","stick-knob","ambient","cabinet",
  "scanlines","vignette","glass","scanline-move","hud","player-hud","enemy-hud","meta-hud",
  "ws-count-bat","ws-count-sword","ws-count-hammer","ws-count-nunchaku","ws-count-staff","mute-note",
  "title-stages"];
const WEAPON_TYPES = ["bat","sword","hammer","nunchaku","staff"];

function makeDocument() {
  const els = new Map();
  const canvas = makeEl("canvas");
  canvas.id = "game";
  canvas.width = 960; canvas.height = 540;
  els.set("game", canvas);
  for (const id of WEAPON_IDS) {
    const e = makeEl("div");
    e.id = id;
    if (id === "weapon-slots") {
      e.querySelectorAll = () => WEAPON_TYPES.map(t => {
        const s = makeEl("button");
        s.dataset.wtype = t;
        return s;
      });
    }
    els.set(id, e);
  }
  const doc = {
    body: makeEl("body"),
    documentElement: makeEl("html"),
    hidden: false,
    _els: els,
    getElementById(id) {
      if (!els.has(id)) { const e = makeEl("div"); e.id = id; els.set(id, e); }
      return els.get(id);
    },
    createElement(tag) {
      if (tag === "canvas") { const c = makeEl("canvas"); c.width = 960; c.height = 540; return c; }
      return makeEl(tag);
    },
    querySelector() { return makeEl("div"); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {}
  };
  return { doc, els };
}

/* ---------------------- サンドボックス構築 ---------------------- */
function buildSandbox() {
  const { doc, els } = makeDocument();
  const rafQueue = [];
  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    setTimeout,
    clearTimeout,
    __clock: 0,
    performance: { now: () => sandbox.__clock },
    requestAnimationFrame: cb => { rafQueue.push(cb); return rafQueue.length; },
    document: doc,
    navigator: { maxTouchPoints: 0, clipboard: undefined, userAgent: "node-smoke" },
    localStorage: {
      _d: {},
      getItem: k => (k in sandbox.localStorage._d ? sandbox.localStorage._d[k] : null),
      setItem: (k, v) => { sandbox.localStorage._d[k] = String(v); },
      removeItem: k => { delete sandbox.localStorage._d[k]; }
    },
    fetch: () => Promise.resolve({ text: () => Promise.resolve("") }),
    Blob: function (parts, opts) { this.parts = parts; this.opts = opts; },
    URL: { createObjectURL: () => "blob:stub", revokeObjectURL() {} },
    addEventListener() {},
    removeEventListener() {},
    location: { href: "http://localhost/index.html" },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    devicePixelRatio: 1,
    innerWidth: 960,
    innerHeight: 540,
    _raf: rafQueue,
    _els: els
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

/* ---------------------- ヘルパー ---------------------- */
function frame(sandbox, game, dt) {
  sandbox._raf.length = 0;               /* 内部 rAF キューは破棄(手動駆動) */
  sandbox.__clock += dt * 1000;          /* 時計を進めて dt を正確にする */
  game.frame(sandbox.__clock);
}

function step(sandbox, game, dt, n) {
  for (let i = 0; i < n; i++) frame(sandbox, game, dt);
}

function press(sandbox, code) {
  sandbox.__expose.input.reset();
  for (const l of sandbox._keydownListeners || []) l({ code, repeat: false, preventDefault() {} });
}

/* ---------------------- メイン ---------------------- */
const asserts = [];
function ok(cond, msg) {
  asserts.push({ cond, msg });
  if (!cond) console.log("  FAIL: " + msg);
}

function run() {
  const src = fs.readFileSync(GAME_SRC, "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  const sandbox = buildSandbox();
  vm.runInContext(src + "\n;globalThis.__expose = { game, input, Player, Enemy, KungFu, Drone, PickupWeapon, WEAPON_SPECS, WEAPON_HIT_FX, getWeaponAttackSummary };", sandbox);
  const { game, input, WEAPON_SPECS, WEAPON_HIT_FX, PickupWeapon, KungFu, Drone, getWeaponAttackSummary } = sandbox.__expose;
  sandbox.__expose.W = sandbox.__expose.game;

  /* キーdownを記録するフック(実際のwindow addEventListenerをスタブしているため) */
  const keydownFns = [];
  const origAdd = sandbox.addEventListener;
  sandbox.addEventListener = (type, fn) => { if (type === "keydown") keydownFns.push(fn); };
  sandbox._keydownListeners = keydownFns;
  /* 上記スタブは boot 後に設定されるため、boot時に既に登録されたハンドラを引き継ぐ */
  vm.runInContext("", sandbox);

  console.log("== smoke test ==");
  ok(src.includes('e.code === "KeyP") input.pickupPressed = true'), "P key is pickup");
  ok(src.includes('e.code === "Escape") game.togglePause()'), "Escape key is pause");
  ok(!src.includes('e.code === "KeyE") input.pickupPressed = true'), "E key no longer picks up weapons");
  ok(html.includes('id="fullscreen-btn"'), "mobile fullscreen button exists");
  ok(src.includes("requestFullscreen") && src.includes("webkitRequestFullscreen"), "fullscreen API includes standard + webkit fallback");
  ok(html.includes("viewport-fit=cover") && html.includes("apple-mobile-web-app-capable"), "mobile fullscreen safe-area/PWA meta is present");
  for (const kind of ["ninja", "robot", "kungfu", "drone"]) {
    const builder = "buildChibi" + ({ ninja: "Ninja", robot: "Robot", kungfu: "KungFu", drone: "Drone" }[kind]);
    ok(src.includes("function " + builder + "("), kind + " has dedicated chibi builder");
    ok(src.includes('o.kind === "' + kind + '") ' + builder + '(cells, pose, pal)'), kind + " routes through dedicated chibi builder");
  }

  /* 1. 起動: title状態 */
  ok(game.state === "title", "boot -> state is 'title'");
  ok(typeof game.player.x === "number", "player.x is number");
  ok(game.enemies.length === 0, "no enemies at title");

  /* 2. start -> playing, AREA 1 敵出現 */
  game.start();
  ok(game.state === "playing", "start() -> state 'playing'");
  ok(game.areaIndex === 0, "areaIndex 0");
  ok(game.enemies.length > 0, "area 1 spawns enemies");
  const enemyCount = game.enemies.length;

  /* 3. 敵を倒して次エリアへ */
  let guard = 0;
  while (game.enemies.some(e => e.alive) && guard < 20000) {
    for (const e of game.enemies) if (e.alive) e.hurt(9999, 0);
    step(sandbox, game, 1 / 60, 60);
    guard += 60;
  }
  ok(guard < 20000, "enemies can be killed");
  step(sandbox, game, 1 / 60, 300);
  ok(game.areaIndex >= 1 || game.autoScroll || game.state !== "playing", "area advances after clear");

  /* 3b. Weapon Feedback V2: 各AREA最低1個 + 拾得猶予 */
  game.start();
  for (const e of game.enemies) if (e.alive) e.hurt(9999, 0);
  step(sandbox, game, 1 / 60, 80);
  ok(game.droppedWeapons.length >= 1, "area guarantees at least one weapon drop");
  ok(game.areaTransitionDelay > 0 && !game.autoScroll, "area clear waits for weapon pickup before scroll");
  ok(game.droppedWeapons[0] instanceof PickupWeapon, "drop is PickupWeapon entity");
  ok(game.droppedWeapons[0].pickupRadius >= 50, "pickup radius is forgiving");

  /* 3c. Weapon durability + feedback metadata */
  ok(WEAPON_SPECS.bat.durability === 18, "bat durability = 18");
  ok(WEAPON_SPECS.sword.durability === 15, "sword durability = 15");
  ok(WEAPON_SPECS.hammer.durability === 10, "hammer durability = 10");
  ok(WEAPON_SPECS.nunchaku.durability === 22, "nunchaku durability = 22");
  ok(WEAPON_SPECS.staff.durability === 16, "staff durability = 16");
  ok(WEAPON_HIT_FX.hammer.word === "ドゴォン!!" && WEAPON_HIT_FX.hammer.hitstop > WEAPON_HIT_FX.sword.hitstop,
    "hammer has distinctive heavy feedback");

  /* 4. 攻撃・コンボ (punch1->punch2->kick->spinKick) */
  game.start();
  for (const e of game.enemies) e.hurt(9999, 0);   /* 敵を排除し干渉を防ぐ */
  const names = ["punch1", "punch2", "kick", "spinKick"];
  let seqOk = true;
  game.player.comboStep = 0;
  for (let i = 0; i < 4; i++) {
    input.attackPressed = true;
    frame(sandbox, game, 1 / 60);                  /* frame内で1回だけ startAttack */
    if (!game.player.attackData || game.player.attackData.name !== names[i]) seqOk = false;
    step(sandbox, game, 1 / 60, 40);               /* 攻撃モーション完了まで待機 */
  }
  ok(seqOk, "combo order = punch1->punch2->kick->spinKick");
  ok(game.player.comboStep === 0, "comboStep wraps back to 0 (4-hit loop)");

  /* 5. ジャンプ + 攻撃 = flykick */
  input.jumpPressed = true;
  frame(sandbox, game, 1 / 60);
  input.attackPressed = true;
  frame(sandbox, game, 1 / 60);
  ok(game.player.attackData && game.player.attackData.name === "flykick", "air attack -> flykick");
  const flykickRef = game.player.attackData;
  input.attackHeld = true;
  step(sandbox, game, 1 / 60, 12);
  ok(game.player.attackData === flykickRef || game.player.z === 0, "air attack does not restart while attack is held");
  input.attackHeld = false;
  ok(flykickRef.dmg === 12 && flykickRef.reach === 115, "flykick trial is toned down to dmg 12 / reach 115");

  /* 6. 武器ピックアップ(既存 + 新武器 nunchaku/staff) */
  game.start();
  game.droppedWeapons.push({
    x: game.player.x, yDepth: game.player.y || 0, type: "bat", alive: true, pickupRadius: 60,
    vx: 0, vz: 0, z: 0, rotation: 0, rotationSpeed: 0, gravity: 0,
    update() {}, render() {}
  });
  input.pickupPressed = true;
  game.update(1 / 60);
  ok(game.player.currentWeapon === "bat", "pickup weapon equips it");
  const allWeaponTypes = Object.keys(WEAPON_SPECS);
  ok(allWeaponTypes.indexOf("nunchaku") >= 0 && allWeaponTypes.indexOf("staff") >= 0, "WEAPON_SPECS includes nunchaku/staff");
  game.player.inventory.nunchaku = 1;
  ok(game.player.equipWeapon("nunchaku"), "nunchaku weapon equips");
  ok(game.player.currentWeapon === "nunchaku", "nunchaku is current weapon");
  ok(game.player.weaponDurability === WEAPON_SPECS.nunchaku.durability, "nunchaku has durability");
  game.player.inventory.staff = 1;
  game.player.equipWeapon("staff");
  ok(game.player.currentWeapon === "staff", "staff weapon equips");

  /* 拾った別武器は即座に持ち替え、ATK表示用の実ダメージも上がる */
  game.player.pickupWeapon("sword");
  ok(game.player.currentWeapon === "sword", "newly picked different weapon auto-equips");
  ok(game.player.inventory.staff >= 1, "previous equipped weapon returns to inventory on auto-equip");
  const swordAtk = getWeaponAttackSummary("sword");
  ok(swordAtk.min === 18 && swordAtk.max === 18, "sword ground attack damage is visibly 18");
  ok(src.includes("drawEquippedWeapon(this, g);"), "equipped weapon is rendered on player");

  /* 6a. Pキー拾得 + 実ゲームの拾得半径（以前の28pxでは拾えなかった距離） */
  game.start();
  game.droppedWeapons.length = 0;
  const nearbyWeapon = new PickupWeapon(game, "bat", game.player.x + 60, 0);
  nearbyWeapon.z = 0; nearbyWeapon.vz = 0; nearbyWeapon.vx = 0;
  game.droppedWeapons.push(nearbyWeapon);
  input.pickupPressed = true;
  game.update(1 / 60);
  ok(game.player.currentWeapon === "bat", "pickup radius allows nearby dropped weapon");
  ok(src.includes('if (e.code === "KeyP") input.pickupPressed = true;'), "P key is mapped to weapon pickup");
  ok(src.includes('if (e.code === "Escape") game.togglePause();'), "Escape key is mapped to pause");

  /* 6a-2. 後半ステージでも遭遇ごとに最低1個は武器が落ちる */
  game.start();
  game.stageIndex = 1;
  game.startArea(0);
  game.droppedWeapons.length = 0;
  for (const e of game.enemies) if (e.alive) e.hurt(9999, 0);
  step(sandbox, game, 1 / 60, 120);
  ok(game.droppedWeapons.length > 0, "stage 2 encounter guarantees at least one weapon drop");

  /* 6a-3. 防御: 正面からの被ダメージを80%軽減する */
  game.start();
  game.player.facing = 1;
  input.guardHeld = true;
  game.player.update(1 / 60);
  const hpBeforeGuard = game.player.hp;
  game.player.hurt(20, game.player.x + 50);
  ok(game.player.state === "guard", "holding guard enters guard state");
  ok(game.player.hp === hpBeforeGuard - 4, "guard reduces frontal 20 damage to 4 chip damage");

  /* 6a-4. 接近戦が数回続くと敵がいったん後退して間合いを作る */
  game.start();
  const retreatEnemy = game.enemies[0];
  retreatEnemy.robot = false;
  retreatEnemy.exchangeCount = 0;
  retreatEnemy.registerExchange();
  retreatEnemy.registerExchange();
  retreatEnemy.registerExchange();
  ok(retreatEnemy.retreatTimer > 0, "enemy starts retreat after several close exchanges");
  const retreatX = retreatEnemy.x;
  game.player.x = retreatX - 30;
  retreatEnemy.update(0.2);
  ok(retreatEnemy.x > retreatX, "enemy retreats away from player to reset spacing");

  /* 6a-5. 近接擬音は同位置に重ならず別レーンへ散る */
  game.effects.reset();
  game.effects.popText(400, 300, 0, "バシッ!", "#fff");
  game.effects.popText(400, 300, 0, "ドガッ!", "#fff");
  ok(game.effects.texts.length === 2 && game.effects.texts[0].x !== game.effects.texts[1].x,
    "onomatopoeia pop text uses separated lanes");

  /* 6b. 新敵クラスを生成・撃破できる */
  game.enemies.length = 0;
  const kf = new KungFu(game);
  kf.reset(500, 0.5);
  const dr = new Drone(game);
  dr.reset(600, 0.5);
  game.enemies.push(kf, dr);
  ok(kf.hp > 0 && dr.hp > 0, "KungFu & Drone spawn with hp");
  kf.hurt(9999, 0);
  dr.hurt(9999, 0);
  ok(!kf.alive && !dr.alive, "KungFu & Drone can be killed");

  /* 7. ゲームオーバー */
  game.start();
  game.player.hp = 1;
  const g = game;
  let gotGameover = false;
  for (let i = 0; i < 600 && !gotGameover; i++) {
    for (const e of g.enemies) if (e.alive && e.onAttackActive) e.hurt(9999, 0);
    g.player.hurt(2, g.player.x - 1);
    g.player.invincible = 0;
    step(sandbox, g, 1 / 60, 10);
    gotGameover = g.state === "gameover";
  }
  ok(gotGameover, "player death -> gameover state");

  /* 8. 2D化後のフル進行: STAGE1-3 × AREA1-4 → 各中ボス → ALL CLEAR (複数ステージ回帰テスト) */
  game.start();
  let maxAreaSeen = 0, sawMidBoss = false, stageIndexSeen = 0, sawClear = false;
  let guard2 = 0;
  while (guard2++ < 40000 && !sawClear) {
    for (const e of game.enemies) if (e.alive) e.hurt(9999, 0);
    step(sandbox, game, 1 / 60, 30);
    maxAreaSeen = Math.max(maxAreaSeen, game.areaIndex);
    if (game.enemies.some(e => e.alive && e.type === "midboss")) sawMidBoss = true;
    stageIndexSeen = Math.max(stageIndexSeen, game.stageIndex);
    if (game.state === "clear") sawClear = true;
    if (game.state === "gameover") break;
  }
  ok(maxAreaSeen >= 3, "progression reaches AREA 4 (maxArea=" + maxAreaSeen + ")");
  ok(stageIndexSeen >= 2, "progression reaches STAGE 3 (maxStage=" + stageIndexSeen + ")");
  ok(sawMidBoss, "mid boss spawns after AREA 4");
  ok(sawClear, "clearing final stage boss reaches 'clear' state");
  let allFinite = true;
  for (const e of game.enemies) if (!Number.isFinite(e.y)) allFinite = false;
  ok(allFinite, "all enemy y values are finite (2D fixed depth)");

  const failed = asserts.filter(a => !a.cond);
  console.log("passed: " + (asserts.length - failed.length) + " / " + asserts.length);
  if (failed.length) {
    console.log("FAILED " + failed.length + " assertion(s)");
    process.exit(1);
  }
  console.log("ALL SMOKE TESTS PASSED");
  process.exit(0);
}

run();
