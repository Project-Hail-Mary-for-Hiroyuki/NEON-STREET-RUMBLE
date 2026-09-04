from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HARNESS = ROOT / "tests" / "harness.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"pattern not found: {label}")
    return text.replace(old, new, 1)


def replace_all(text: str, old: str, new: str, label: str) -> str:
    if old not in text and new in text:
        return text
    if old not in text:
        raise RuntimeError(f"pattern not found: {label}")
    return text.replace(old, new)


src = INDEX.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# Controls: pickup E -> P, pause P -> Escape.
# ---------------------------------------------------------------------------
src = replace_once(src,
    '<span class="k">E</span><span>武器を拾う</span>',
    '<span class="k">P</span><span>武器を拾う</span>',
    "title pickup key")
src = replace_once(src,
    '<span class="k">P</span><span>ポーズ</span>',
    '<span class="k">ESC</span><span>ポーズ</span>',
    "title pause key")
src = replace_all(src, 'P / ENTER: RESUME', 'ESC / ENTER: RESUME', "pause help")
src = replace_once(src,
    'if (e.code === "KeyE") input.pickupPressed = true;\n  if (e.code === "KeyQ") input.switchPressed = true;   /* 武器切替 */\n  if (e.code === "KeyP") game.togglePause();   /* ポーズ */',
    'if (e.code === "KeyP") input.pickupPressed = true;\n  if (e.code === "KeyQ") input.switchPressed = true;   /* 武器切替 */\n  if (e.code === "Escape") game.togglePause();   /* ポーズ */',
    "keyboard mapping")
src = src.replace('Eキー / タッチ「拾う」ボタン', 'Pキー / タッチ「拾う」ボタン')

# Correct stale 2.5D header while touching this area.
src = replace_once(src,
    'NEON STREET RUMBLE - 2.5D belt-action game (Phase 1)\n   ----------------------------------------------------------------------------\n   座標系:  X = 左右, Y = ベルトライン奥行き(0=奥,1=手前), Z = ジャンプ高さ',
    'NEON STREET RUMBLE - pure 2D side-scrolling action game\n   ----------------------------------------------------------------------------\n   座標系:  X = 左右, Z = ジャンプ高さ（Y奥行きは廃止）',
    "stale 2.5D header")

# ---------------------------------------------------------------------------
# SFX: synthetic pickup and weapon impacts (no external assets).
# ---------------------------------------------------------------------------
sfx_anchor = '''    case "combo": {
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(990, t + 0.06);
      g.gain.setValueAtTime(0.13, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + 0.08);
      break;
    }
'''
sfx_insert = sfx_anchor + '''    case "pickup": {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(1180, t + 0.14);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + 0.19);
      break;
    }
    case "batHit": case "staffHit": {
      const src = noise();
      const f = audioCtx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(type === "batHit" ? 620 : 820, t);
      f.Q.value = 1.8;
      const ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0.55, t);
      ng.gain.exponentialRampToValueAtTime(0.01, t + 0.10);
      src.connect(f); f.connect(ng); ng.connect(out);
      src.start(t); src.stop(t + 0.12);
      break;
    }
    case "swordHit": {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1450, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.10);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.11);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + 0.12);
      break;
    }
    case "hammerHit": {
      const src = noise();
      const f = audioCtx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(520, t);
      f.frequency.exponentialRampToValueAtTime(75, t + 0.20);
      const ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0.8, t);
      ng.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
      src.connect(f); f.connect(ng); ng.connect(out);
      src.start(t); src.stop(t + 0.24);
      break;
    }
    case "nunchakuHit": {
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1120, t + 0.035);
      osc.frequency.setValueAtTime(760, t + 0.07);
      g.gain.setValueAtTime(0.30, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.11);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + 0.12);
      break;
    }
'''
src = replace_once(src, sfx_anchor, sfx_insert, "weapon sfx")

# ---------------------------------------------------------------------------
# HitEffect: pop text for manga-style onomatopoeia / pickup calls.
# ---------------------------------------------------------------------------
src = replace_once(src,
    '''  text(x, y, yDepth, str, color) {
    this.texts.push({ x, y, depth: yDepth, str, color, t: 0, max: 0.85 });
  }
''',
    '''  text(x, y, yDepth, str, color) {
    this.texts.push({ x, y, depth: yDepth, str, color, t: 0, max: 0.85, size: 13, pop: false, rot: 0 });
  }
  popText(x, y, yDepth, str, color, size = 24, max = 0.62) {
    this.texts.push({ x, y, depth: yDepth, str, color, t: 0, max, size, pop: true, rot: rand(-0.10, 0.10) });
  }
''',
    "pop text method")

old_text_render = '''    for (const t of this.texts) {
      const alpha = 1 - (t.t / t.max);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "bold 13px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#fff";
      ctx.fillText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
      ctx.restore();
    }
'''
new_text_render = '''    for (const t of this.texts) {
      const progress = t.t / t.max;
      const alpha = 1 - progress;
      const popScale = t.pop ? (progress < 0.18 ? 0.55 + (progress / 0.18) * 1.15 : 1.7 - Math.min(1, (progress - 0.18) / 0.32) * 0.7) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(t.x, t.y);
      if (t.pop) { ctx.rotate(t.rot || 0); ctx.scale(popScale, popScale); }
      ctx.font = "bold " + (t.size || 13) + "px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = t.color;
      ctx.shadowBlur = t.pop ? 14 : 8;
      ctx.fillStyle = "#fff";
      ctx.fillText(t.str, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
'''
src = replace_once(src, old_text_render, new_text_render, "pop text render")

# ---------------------------------------------------------------------------
# PickupWeapon: screen-space fix + pulse/ring/proximity enlargement/prompts.
# ---------------------------------------------------------------------------
old_pickup_class = '''class PickupWeapon {
  constructor(game, type, x, z) {
    this.game = game;
    this.type = type;
    this.x = x;
    this.z = z || 0;
    this.vx = rand(-80, 80);
    this.vz = rand(80, 140);
    this.gravity = 500;
    this.rotation = rand(0, TAU);
    this.rotationSpeed = rand(-3, 3);
    this.alive = true;
    this.pickupRadius = 28;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.vz -= this.gravity * dt;
    this.rotation += this.rotationSpeed * dt;
    if (this.z <= 0) { this.z = 0; this.vz = 0; this.vx = 0; this.rotationSpeed = 0; }
  }

  render() {
    const d = depthInfo();
    const rx = this.x - this.game.cameraX;
    const ry = d.groundY - 12 - this.z * d.scale;
    const s = d.scale * 0.35;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.scale(s, s);
    ctx.rotate(this.rotation);
    if (WEAPON_SPECS[this.type] && WEAPON_SPECS[this.type].renderFunc) {
      WEAPON_SPECS[this.type].renderFunc(ctx);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-10, -30, 20, 60);
    }
    ctx.restore();
  }
}
'''
new_pickup_class = '''class PickupWeapon {
  constructor(game, type, x, z) {
    this.game = game;
    this.type = type;
    this.x = x;
    this.z = z || 0;
    this.vx = rand(-80, 80);
    this.vz = rand(80, 140);
    this.gravity = 500;
    this.rotation = rand(0, TAU);
    this.rotationSpeed = rand(-3, 3);
    this.alive = true;
    this.pickupRadius = 56;
    this.age = rand(0, 1);
  }

  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.vz -= this.gravity * dt;
    this.rotation += this.rotationSpeed * dt;
    if (this.z <= 0) { this.z = 0; this.vz = 0; this.vx = 0; this.rotationSpeed = 0; }
  }

  render() {
    const d = depthInfo();
    /* Enemy / Player と同じ画面座標で管理されているので cameraX は引かない。 */
    const rx = this.x;
    const ry = d.groundY - 12 - this.z * d.scale;
    const playerDist = this.game.player ? Math.abs(this.game.player.x - this.x) : 9999;
    const nearScale = playerDist < 60 ? 1.60 : playerDist < 100 ? 1.40 : playerDist < 150 ? 1.20 : 1.0;
    const pulse = 1 + Math.sin(this.age * TAU * 2.1) * 0.07;
    const flash = 0.60 + (0.5 + 0.5 * Math.sin(this.age * TAU * 4.5)) * 0.40;
    const spec = WEAPON_SPECS[this.type];
    const color = spec ? spec.color : "#ffffff";
    const s = d.scale * 0.35 * nearScale * pulse;

    /* 地面のネオンリング: 落ちている武器だと一目で分かる。 */
    ctx.save();
    ctx.globalAlpha = 0.45 + flash * 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = playerDist < 100 ? 4 : 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = playerDist < 100 ? 22 : 14;
    ctx.beginPath();
    ctx.ellipse(rx, d.groundY - 2, 34 * nearScale, 9 * nearScale, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = flash;
    ctx.translate(rx, ry);
    ctx.scale(s, s);
    ctx.rotate(this.rotation);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + 14 * flash;
    if (spec && spec.renderFunc) {
      spec.renderFunc(ctx);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-10, -30, 20, 60);
    }
    ctx.restore();

    if (this.z <= 1) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#fff";
      ctx.font = "bold " + (playerDist < 90 ? 14 : 10) + "px 'Press Start 2P', monospace";
      ctx.fillText(playerDist < 90 ? "P 拾う!" : "WEAPON!", rx, ry - 62 * nearScale);
      ctx.restore();
    }
  }
}
'''
src = replace_once(src, old_pickup_class, new_pickup_class, "PickupWeapon feedback")

# ---------------------------------------------------------------------------
# Durability rebalance.
# ---------------------------------------------------------------------------
for old, new, label in [
    ('displayName: "バット", dmg: 12, range: 90, durability: 10', 'displayName: "バット", dmg: 12, range: 90, durability: 18', 'bat durability'),
    ('displayName: "刀", dmg: 18, range: 100, durability: 8', 'displayName: "刀", dmg: 18, range: 100, durability: 15', 'sword durability'),
    ('displayName: "ハンマー", dmg: 25, range: 80, durability: 6', 'displayName: "ハンマー", dmg: 25, range: 80, durability: 10', 'hammer durability'),
    ('displayName: "ヌンチャク", dmg: 14, range: 105, durability: 14', 'displayName: "ヌンチャク", dmg: 14, range: 105, durability: 22', 'nunchaku durability'),
    ('displayName: "杖", dmg: 20, range: 120, durability: 9', 'displayName: "杖", dmg: 20, range: 120, durability: 16', 'staff durability'),
]:
    src = replace_once(src, old, new, label)

# Weapon-specific feedback metadata.
old_fx = '''const WEAPON_HIT_FX = {
  "bat":    { color: "#ffe76b", shake: 1.15 },   /* 黄: 軽快な打撃 */
  "sword":  { color: "#a8e8ff", shake: 1.0, slash: true },  /* 水色: 鋭い斬撃 */
  "hammer": { color: "#ff9d5e", shake: 1.6 },    /* 橙: 重い衝撃 */
  "nunchaku": { color: "#d8c8a0", shake: 1.05 }, /* 木色: 高速の連打 */
  "staff":  { color: "#ff7a6e", shake: 1.3 }     /* 赤: 長い一閃 */
};
'''
new_fx = '''const WEAPON_HIT_FX = {
  "bat":      { color: "#ffe76b", shake: 1.35, sfx: "batHit",      word: "バキッ!",   hitstop: 0.055, knock: 1.20 },
  "sword":    { color: "#a8e8ff", shake: 1.15, sfx: "swordHit",    word: "ザシュッ!", hitstop: 0.050, knock: 1.12, slash: true },
  "hammer":   { color: "#ff9d5e", shake: 2.05, sfx: "hammerHit",   word: "ドゴォン!!", hitstop: 0.105, knock: 1.70 },
  "nunchaku": { color: "#d8c8a0", shake: 1.20, sfx: "nunchakuHit", word: "バババッ!", hitstop: 0.045, knock: 1.10 },
  "staff":     { color: "#ff7a6e", shake: 1.55, sfx: "staffHit",    word: "バシーン!", hitstop: 0.070, knock: 1.35 }
};
'''
src = replace_once(src, old_fx, new_fx, "weapon feedback metadata")

old_apply = '''  return { ...d,
    dmg: Math.max(d.dmg, spec.dmg),
    reach: Math.max(d.reach, spec.range),
    hitColor: WEAPON_HIT_FX[currentWeapon] ? WEAPON_HIT_FX[currentWeapon].color : null,
    hitShakeMul: WEAPON_HIT_FX[currentWeapon] ? WEAPON_HIT_FX[currentWeapon].shake : 1
  };
'''
new_apply = '''  const fx = WEAPON_HIT_FX[currentWeapon] || {};
  return { ...d,
    dmg: Math.max(d.dmg, spec.dmg),
    reach: Math.max(d.reach, spec.range),
    weaponType: currentWeapon,
    hitColor: fx.color || null,
    hitShakeMul: fx.shake || 1,
    hitSfx: fx.sfx || "hit",
    hitWord: fx.word || "バシッ!",
    hitstop: fx.hitstop || 0.04,
    knockMul: fx.knock || 1
  };
'''
src = replace_once(src, old_apply, new_apply, "apply weapon feedback")

# ---------------------------------------------------------------------------
# Game state: drop guarantee, max 4 on ground, and post-clear pickup window.
# ---------------------------------------------------------------------------
src = replace_once(src,
    '''    this.autoScroll = false;
    this.bossActive = false;
    this.messageTimer = 0;
''',
    '''    this.autoScroll = false;
    this.bossActive = false;
    this.areaWeaponDropped = false;
    this.areaTransitionDelay = 0;
    this.messageTimer = 0;
''',
    "game weapon state")

src = replace_once(src,
    '''    this.areaResolved = false;
    this.areaScroll = 0;
    this.enemies.length = 0;
    for (const spec of stage.areas[index].enemies) this.enemies.push(this.makeStageEnemy(spec));
''',
    '''    this.areaResolved = false;
    this.areaScroll = 0;
    this.areaWeaponDropped = false;
    this.areaTransitionDelay = 0;
    this.droppedWeapons.length = 0;  /* 前AREAの取り残し武器は次AREAへ持ち越さない */
    this.enemies.length = 0;
    for (const spec of stage.areas[index].enemies) this.enemies.push(this.makeStageEnemy(spec));
''',
    "startArea weapon reset")

src = replace_once(src,
    '''      /* 敵全滅後は自動で背景をスクロールして次面へ移行する(キャラはその場に立つ)。 */
      this.autoScroll = true;
      this.areaLocked = true;
      this.showStageMessage("AREA CLEAR · NEXT AREA", 2);
''',
    '''      /* 最後の敵から落ちた武器を拾えるよう、スクロール前に短い猶予を置く。 */
      this.autoScroll = false;
      this.areaTransitionDelay = 2.4;
      this.areaLocked = true;
      this.showStageMessage("AREA CLEAR · WEAPON CHANCE!", 2.2);
''',
    "area pickup grace")

old_drop = '''        if (e.deathTime <= 0) {
          // 敵が死んだら武器をドロップ (30%確率)
          if (Math.random() < 0.3) {
            const weaponTypes = Object.keys(WEAPON_SPECS);
            const type = choice(weaponTypes);
            this.droppedWeapons.push(new PickupWeapon(this, type, e.x, 20));
          }
          this.enemies.splice(i, 1);
        }
'''
new_drop = '''        if (e.deathTime <= 0) {
          /* 通常敵は65%ドロップ。AREA内で一度も出なければ最後の通常敵が必ず落とす。 */
          const isBoss = e.type === "midboss";
          const otherRegularAlive = this.enemies.some((x, j) => j !== i && x.type !== "midboss" && x.alive);
          const guarantee = !isBoss && !this.areaWeaponDropped && !otherRegularAlive;
          const canDrop = !isBoss && this.droppedWeapons.length < 4;
          if (canDrop && (guarantee || Math.random() < 0.65)) {
            const weaponTypes = Object.keys(WEAPON_SPECS);
            const type = choice(weaponTypes);
            this.droppedWeapons.push(new PickupWeapon(this, type, e.x, 20));
            this.areaWeaponDropped = true;
          }
          this.enemies.splice(i, 1);
        }
'''
src = replace_once(src, old_drop, new_drop, "drop rules")

# Pickup feedback.
old_pickup = '''          // 拾った演出: テキスト表示
          this.effects.text(w.x, depthInfo().groundY - 90 * CHAR_SCALE, 0, name + " GET!", "#ffe76b");
          sfx("ui");
'''
new_pickup = '''          /* 拾得は小さなイベントとして強く見せる。 */
          const py = depthInfo().groundY - 82 * CHAR_SCALE;
          this.effects.spark(w.x, py + 35, 0, WEAPON_SPECS[w.type].color, 16, 260);
          this.effects.ring(w.x, py + 35, 0, WEAPON_SPECS[w.type].color, 54);
          this.effects.popText(w.x, py, 0, name + " GET!!", "#ffe76b", 22, 0.72);
          this.hitstop = Math.max(this.hitstop, 0.07);
          sfx("pickup", 0.34);
'''
src = replace_once(src, old_pickup, new_pickup, "pickup feedback")

# Attack-hit feedback and weapon feel.
old_hit = '''  onAttackHit(e, dmg, knock, hy, hx, attackData) {
    e.hurt(dmg, knock);
    this.player.consumeWeaponDurability();   /* 武器ヒット時: 耐久-1(B-2) */
    this.score += 10;
    /* 武器ごとのヒットエフェクト色・揺れ(同じ操作で感触が変わる設計) */
    const fx = attackData && attackData.hitColor ? attackData.hitColor : null;
    this.effects.hit(hx, hy, e.y, fx || undefined);
    this.effects.text(hx, hy - 10, e.y, "-" + dmg, fx || "#ffe9a8");
    this.combo.add();
    const shakeMul = attackData && attackData.hitShakeMul ? attackData.hitShakeMul : 1;
    this.shake = Math.max(this.shake, (3 + dmg * 0.35) * shakeMul);
    this.hitstop = Math.max(this.hitstop, 0.04);
    sfx("hit", 0.3);
  }
'''
new_hit = '''  onAttackHit(e, dmg, knock, hy, hx, attackData) {
    const data = attackData || {};
    const knockMul = data.knockMul || 1;
    e.hurt(dmg, knock * knockMul);
    this.player.consumeWeaponDurability();   /* 武器ヒット時: 耐久-1(B-2) */
    this.score += 10;
    const fx = data.hitColor || null;
    this.effects.hit(hx, hy, e.y, fx || undefined);
    this.effects.text(hx, hy - 10, e.y, "-" + dmg, fx || "#ffe9a8");

    /* 漫画的な擬音。素手もパンチ/キックで言葉を変える。 */
    let hitWord = data.hitWord;
    if (!hitWord) hitWord = (data.name === "kick" || data.name === "spinKick" || data.name === "flykick") ? "ドガッ!" : "バシッ!";
    this.effects.popText(hx + rand(-8, 8), hy - 30, e.y, hitWord, fx || "#fff1a8", data.weaponType === "hammer" ? 30 : 23, data.weaponType === "hammer" ? 0.72 : 0.58);

    this.combo.add();
    const shakeMul = data.hitShakeMul || 1;
    this.shake = Math.max(this.shake, (3 + dmg * 0.35) * shakeMul);
    this.hitstop = Math.max(this.hitstop, data.hitstop || 0.04);
    sfx(data.hitSfx || "hit", data.weaponType === "hammer" ? 0.48 : 0.34);
  }
'''
src = replace_once(src, old_hit, new_hit, "attack hit feedback")

# Delay auto-scroll after clear so the newly dropped weapon can actually be collected.
src = replace_once(src,
    '''    /* 敵全滅後の自動スクロール(キャラはその場に立ち、背景を流して次面へ)。 */
    if (this.autoScroll) this.advanceAreaScroll(AREA_SCROLL_SPEED * dt);
''',
    '''    /* AREA CLEAR後は武器拾得の猶予を置いてから自動スクロール。 */
    if (this.areaTransitionDelay > 0) {
      this.areaTransitionDelay -= dt;
      if (this.areaTransitionDelay <= 0) this.autoScroll = true;
    }
    if (this.autoScroll) this.advanceAreaScroll(AREA_SCROLL_SPEED * dt);
''',
    "transition delay update")

INDEX.write_text(src, encoding="utf-8")

# ---------------------------------------------------------------------------
# Smoke tests: expose pickup/FX and add deterministic regression checks.
# ---------------------------------------------------------------------------
h = HARNESS.read_text(encoding="utf-8")
h = replace_once(h,
    'globalThis.__expose = { game, input, Player, Enemy, KungFu, Drone, WEAPON_SPECS };',
    'globalThis.__expose = { game, input, Player, Enemy, KungFu, Drone, PickupWeapon, WEAPON_SPECS, WEAPON_HIT_FX };',
    "test expose")
h = replace_once(h,
    'const { game, input, WEAPON_SPECS, KungFu, Drone } = sandbox.__expose;',
    'const { game, input, WEAPON_SPECS, WEAPON_HIT_FX, PickupWeapon, KungFu, Drone } = sandbox.__expose;',
    "test destructure")

insert_after = '''  ok(game.areaIndex >= 1 || game.autoScroll || game.state !== "playing", "area advances after clear");
'''
new_checks = insert_after + '''
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
'''
h = replace_once(h, insert_after, new_checks, "weapon feedback tests")

# Static key mapping regression is reliable even with the DOM event stub.
run_anchor = '''  console.log("== smoke test ==");
'''
h = replace_once(h, run_anchor, run_anchor + '''  ok(src.includes('e.code === "KeyP") input.pickupPressed = true'), "P key is pickup");
  ok(src.includes('e.code === "Escape") game.togglePause()'), "Escape key is pause");
  ok(!src.includes('e.code === "KeyE") input.pickupPressed = true'), "E key no longer picks up weapons");
''', "key mapping tests")

HARNESS.write_text(h, encoding="utf-8")

print("Weapon Feedback V2 applied successfully")
