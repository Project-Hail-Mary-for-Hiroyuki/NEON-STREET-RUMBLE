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
  vm.runInContext(src + "\n;globalThis.__expose = { game, input, Player, Enemy, KungFu, Drone, PickupWeapon, WEAPON_SPECS, WEAPON_HIT_FX, WEAPON_RECIPES, STAGE_DIFFICULTY, BGM_PATTERNS, DIFFICULTY_MODES, setDifficultyMode, applyStageDifficulty, canCraftWeaponRecipe, craftWeaponRecipe, getWeaponAttackSummary };", sandbox);
  const { game, input, WEAPON_SPECS, WEAPON_HIT_FX, WEAPON_RECIPES, STAGE_DIFFICULTY, BGM_PATTERNS, DIFFICULTY_MODES, setDifficultyMode, canCraftWeaponRecipe, craftWeaponRecipe, PickupWeapon, KungFu, Drone, getWeaponAttackSummary } = sandbox.__expose;
  sandbox.__expose.W = sandbox.__expose.game;

  /* キーdownを記録するフック(実際のwindow addEventListenerをスタブしているため) */
  const keydownFns = [];
  const origAdd = sandbox.addEventListener;
  sandbox.addEventListener = (type, fn) => { if (type === "keydown") keydownFns.push(fn); };
  sandbox._keydownListeners = keydownFns;
  /* 上記スタブは boot 後に設定されるため、boot時に既に登録されたハンドラを引き継ぐ */
  vm.runInContext("", sandbox);

  console.log("== smoke test ==");
  ok(src.includes('e.code === "Escape") game.togglePause()'), "Escape key is pause");
  ok(!src.includes('input.pickupPressed') && !src.includes('input.switchPressed') && !src.includes('input.craftPressed'),
    "manual pickup/switch/craft inputs are removed");
  ok(html.includes('id="fullscreen-btn"'), "mobile fullscreen button exists");
  ok(src.includes('fighter: "bat"'), "fighter visibly carries bat");
  ok(src.includes('ninja: "sword"'), "ninja visibly carries sword");
  ok(src.includes('robot: "hammer"'), "robot visibly carries hammer");
  ok(src.includes('kungfu: "nunchaku"'), "kungfu visibly carries nunchaku");
  ok(src.includes('midboss: "staff"'), "midboss visibly carries staff");
  ok(src.includes("drawEnemyHeldWeapon(this, g, alpha)"), "enemy render draws held weapon");
  const touchBlock = html.match(/<div id="touch-ui">[\s\S]*?<\/div>\s*<!-- Title -->/);
  const touchActions = touchBlock ? [...touchBlock[0].matchAll(/data-action="([^"]+)"/g)].map(m => m[1]) : [];
  ok(touchActions.length === 3 && touchActions.includes("jump") && touchActions.includes("attack") && touchActions.includes("guard"),
    "mobile controls are exactly jump/attack/guard");
  ok(!src.includes('e.code === "KeyP"') && !src.includes('e.code === "KeyQ"') &&
    !src.includes('e.code === "KeyC"') && !src.includes('e.code === "KeyI"'),
    "manual weapon/special keyboard shortcuts are removed");
  ok(src.includes('name: "uppercut"') && src.includes('name: "dashstrike"') && src.includes('name: "aircombo"'),
    "uppercut, dash strike, and air combo are defined");
  ok(BGM_PATTERNS.length === 3, "stage-specific BGM has three patterns");
  ok(BGM_PATTERNS[0].bpm < BGM_PATTERNS[1].bpm && BGM_PATTERNS[1].bpm < BGM_PATTERNS[2].bpm,
    "BGM tempo rises by stage");
  ok(src.includes("updateBgm(this.stageIndex, dt, this.bossActive)"), "game update drives BGM sequencer");
  ok(src.includes('case "guard"') && src.includes('case "stage"') && src.includes('case "warning"'),
    "guard/stage/warning SFX are available");
  ok(html.includes('id="settings-screen"') && html.includes('id="sound-volume"') && html.includes('id="difficulty-select"'),
    "settings screen has sound and difficulty controls");
  ok(DIFFICULTY_MODES.easy.dmg < 1 && DIFFICULTY_MODES.hard.dmg > 1,
    "settings difficulty has easy/normal/hard combat profiles");
  ok(typeof game.startCinematic === "function", "game exposes cinematic camera cue");
  game.startCinematic(1, 1.1, 30);
  ok(game.cinematicTimer === 1 && game.cinematicZoomTarget === 1.1 && game.cinematicBarsTarget === 30,
    "cinematic cue stores zoom and letterbox targets");
  ok(src.includes("Math.sin(Math.PI * clamp(cineProgress, 0, 1))"),
    "cinematic camera eases in and out instead of snapping");
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

  /* 4. 攻撃連打: 基本4段からアッパー・突進へ自然に派生 */
  game.start();
  for (const e of game.enemies) e.hurt(9999, 0);   /* 敵を排除し干渉を防ぐ */
  const names = ["punch1", "punch2", "kick", "spinKick", "uppercut", "dashstrike"];
  let seqOk = true;
  game.player.comboStep = 0;
  for (let i = 0; i < names.length; i++) {
    input.attackPressed = true;
    frame(sandbox, game, 1 / 60);
    if (!game.player.attackData || game.player.attackData.name !== names[i]) seqOk = false;
    step(sandbox, game, 1 / 60, 40);
  }
  ok(seqOk, "attack mash chains basic combo -> uppercut -> dash strike");
  ok(game.player.comboStep === 0, "comboStep wraps after six-hit natural combo");

  /* 5. ジャンプ + 攻撃 = flykick */
  input.jumpPressed = true;
  frame(sandbox, game, 1 / 60);
  input.attackPressed = true;
  frame(sandbox, game, 1 / 60);
  ok(game.player.attackData && game.player.attackData.name === "flykick", "first air attack -> flykick");
  const flykickRef = game.player.attackData;
  ok(flykickRef.dmg === 12 && flykickRef.reach === 115, "flykick remains dmg 12 / reach 115");
  input.attackPressed = true;
  frame(sandbox, game, 1 / 60);
  ok(game.player.attackData && game.player.attackData.name === "aircombo", "second air attack naturally upgrades to air combo");
  ok(game.player.attackData.multiHitTimes.length === 3, "air combo has three kick timings");

  /* 6. 武器ピックアップ(既存 + 新武器 nunchaku/staff) */
  game.start();
  game.droppedWeapons.push({
    x: game.player.x, yDepth: game.player.y || 0, type: "bat", alive: true, pickupRadius: 60,
    vx: 0, vz: 0, z: 0, rotation: 0, rotationSpeed: 0, gravity: 0,
    update() {}, render() {}
  });
  game.update(1 / 60);
  ok(game.player.currentWeapon === "bat", "nearby weapon auto-pickup equips it");
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

  /* 6.1 武器合成: 刀2 + バット2 -> ヌンチャク1。装備中も素材として数える。 */
  game.start();
  const craftRecipe = WEAPON_RECIPES[0];
  game.player.inventory.sword = 2;
  game.player.inventory.bat = 2;
  ok(craftRecipe.inputs.sword === 2 && craftRecipe.inputs.bat === 2,
    "craft recipe requires sword x2 + bat x2");
  ok(craftRecipe.output.type === "nunchaku" && craftRecipe.output.count === 1,
    "craft recipe outputs nunchaku x1");
  ok(canCraftWeaponRecipe(game.player, craftRecipe), "craft recipe detects enough materials");
  ok(craftWeaponRecipe(game.player, craftRecipe), "craft recipe succeeds");
  ok(game.player.inventory.sword === 0 && game.player.inventory.bat === 0,
    "craft consumes sword/bat materials");
  ok(game.player.currentWeapon === "nunchaku", "crafted nunchaku auto-equips");
  ok(!canCraftWeaponRecipe(game.player, craftRecipe), "craft recipe fails after materials are consumed");

  game.start();
  game.player.inventory.sword = 1;
  game.player.inventory.bat = 2;
  game.player.currentWeapon = "sword";
  game.player.weaponDurability = 5;
  ok(canCraftWeaponRecipe(game.player, craftRecipe), "equipped weapon counts toward automatic evolution recipe");

  game.start();
  game.player.inventory.sword = 2;
  game.player.inventory.bat = 2;
  game.update(1 / 60);
  ok(game.player.currentWeapon === "nunchaku", "game update automatically evolves materials into nunchaku");
  ok(game.player.inventory.sword === 0 && game.player.inventory.bat === 0, "automatic evolution consumes recipe materials");

  /* 6a. 近づくだけで自動取得し、Pキー操作は不要 */
  game.start();
  game.droppedWeapons.length = 0;
  const nearbyWeapon = new PickupWeapon(game, "bat", game.player.x + 60, 0);
  nearbyWeapon.z = 0; nearbyWeapon.vz = 0; nearbyWeapon.vx = 0;
  game.droppedWeapons.push(nearbyWeapon);
  game.update(1 / 60);
  ok(game.player.currentWeapon === "bat", "auto pickup collects nearby dropped weapon");
  ok(game.droppedWeapons.length === 0, "auto pickup removes collected drop from ground");
  ok(src.includes('if (e.code === "Escape") game.togglePause();'), "Escape key is mapped to pause");

  /* 6a-2. 後半ステージでも遭遇ごとに最低1個は武器が落ちる */
  game.start();
  game.stageIndex = 1;
  game.startArea(0);
  game.droppedWeapons.length = 0;
  for (const e of game.enemies) if (e.alive) e.hurt(9999, 0);
  step(sandbox, game, 1 / 60, 120);
  ok(game.droppedWeapons.length > 0, "stage 2 encounter guarantees at least one weapon drop");

  /* 6a-2b. 通常敵はStage 1を基準にStage 2/3で段階的に強化される */
  game.stageIndex = 0;
  const diffS1 = game.makeStageEnemy({ type: "fighter", x: 700 });
  game.stageIndex = 1;
  const diffS2 = game.makeStageEnemy({ type: "fighter", x: 700 });
  game.stageIndex = 2;
  const diffS3 = game.makeStageEnemy({ type: "fighter", x: 700 });
  ok(STAGE_DIFFICULTY[0].hp === 1 && STAGE_DIFFICULTY[0].dmg === 1,
    "stage 1 difficulty preserves base stats");
  ok(diffS1.maxHp < diffS2.maxHp && diffS2.maxHp < diffS3.maxHp,
    "enemy HP scales up each stage");
  ok(diffS1.dmg < diffS2.dmg && diffS2.dmg < diffS3.dmg,
    "enemy damage scales up each stage");
  ok(diffS1.speed < diffS2.speed && diffS2.speed < diffS3.speed,
    "enemy speed scales up each stage");
  ok(diffS1.score < diffS2.score && diffS2.score < diffS3.score,
    "higher stages award more enemy score");
  game.stageIndex = 0;

  setDifficultyMode("easy", false);
  const easyEnemy = game.makeStageEnemy({ type: "fighter", x: 700 });
  setDifficultyMode("hard", false);
  const hardEnemy = game.makeStageEnemy({ type: "fighter", x: 700 });
  ok(easyEnemy.maxHp < hardEnemy.maxHp && easyEnemy.dmg < hardEnemy.dmg,
    "difficulty setting changes newly spawned enemy strength");
  setDifficultyMode("normal", false);

  /* 6a-3. 防御: 正面からの被ダメージを80%軽減する */
  game.start();
  game.player.facing = 1;
  input.guardHeld = true;
  game.player.update(1 / 60);
  const hpBeforeGuard = game.player.hp;
  game.player.hurt(20, game.player.x + 50);
  ok(game.player.state === "guard", "holding guard enters guard state");
  ok(game.player.hp === hpBeforeGuard - 4, "guard reduces frontal 20 damage to 4 chip damage");

  /* 6a-3b. 防御+ジャンプでバク転。攻撃技は専用ボタンなし。 */
  game.start();
  input.guardHeld = true;
  game.player.update(1 / 60);
  const backflipStartX = game.player.x;
  game.player.jump();
  ok(game.player.state === "backflip", "guard + jump starts backflip");
  ok(game.player.z > 0 && game.player.vx < 0, "backflip rises and moves backward when facing right");
  ok(game.player.invincible > 0, "backflip grants a short evade window");
  step(sandbox, game, 1 / 60, 50);
  ok(game.player.x < backflipStartX, "backflip creates defensive distance");
  ok(src.includes('ctx.rotate(-this.facing * p * TAU)'), "backflip visibly rotates the character");
  input.guardHeld = false;

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
