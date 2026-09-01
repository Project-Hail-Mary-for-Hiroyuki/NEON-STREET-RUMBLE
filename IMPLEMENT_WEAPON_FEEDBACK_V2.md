# NEON STREET RUMBLE — Weapon Feedback V2

## Goal
武器を「存在するだけの補助要素」から、プレイヤーが積極的に探して拾い、当てた瞬間に快感がある主役級のギミックへ強化する。

## Non-negotiable constraints
- `master` の3ステージ×4エリア進行を壊さない。
- 完全2D（X左右 + Zジャンプ）を維持し、Y奥行きを復活させない。
- `Player / Enemy / Ninja / Robot / KungFu / Drone / Projectile / PickupWeapon / HitEffect / Combo / Game` の既存構造を維持する。
- 外部画像・外部音源・新しいビルド依存は追加しない。Canvas + Web Audio のみ。
- PCとスマホの両対応を維持する。
- 実装後は既存 `tests/run.sh` / `tests/harness.js` を壊さない。

## 1. Pickup key
PCの武器拾得キーを `E` から `P` に変更する。

### Required edits
- `Input` の keydown で `KeyE` を使っている拾得処理を `KeyP` に変更。
- タイトル画面・操作説明の `E` 表記を `P` に変更。
- コメントも `Eキー` → `Pキー` に更新。
- スマホの「拾う」ボタンは変更しない。
- `P` が既存ポーズ操作と競合する場合は、ポーズ側を `Escape` または `Enter` に寄せ、**拾う操作をP優先**とする。タイトル/ポーズ表示も一致させる。

## 2. Weapon availability
武器をもっと多用できるようにする。

### Drop rules
- 通常の敵撃破時ドロップ率: `0.30` → `0.65`。
- 各AREAで最低1個は武器が出る保証を入れる。
- ボス撃破時の武器ドロップは不要。
- 同時に地面に存在する武器が多すぎないよう最大4個程度を上限とする。

### Suggested state
`Game` に以下を追加する。
```js
this.areaWeaponDropped = false;
```
`startArea()` で `false` に戻す。
通常ドロップに成功したら `true`。
AREA内最後の通常敵が消える直前まで一度も武器が出なかった場合、最後の敵から必ず1個落とす。

## 3. Durability rebalance
武器を拾った直後に壊れる感覚を減らす。

推奨値:
- bat: 18
- sword: 15
- hammer: 10
- nunchaku: 22
- staff: 16

既存のdmg/rangeは原則変更しない。

## 4. Dropped weapon visibility
`PickupWeapon` を強化する。

### New visual behavior
- 落下後は常時ゆっくり脈動。
- 約0.18〜0.25秒周期で明滅感のあるハイライトを出す。
- 武器の下にネオンリングを描く。
- 武器の上に小さく `WEAPON!` を表示。
- プレイヤーとの距離で拡大:
  - 150px超: 1.0x
  - 100〜150px: 1.2x
  - 60〜100px: 1.4x
  - 60px以内: 1.6x
- 60px以内では `P 拾う` を大きく表示。
- スマホでは `拾う!` と表示。
- 画面外にある武器を知らせる矢印までは今回は追加しない。

### Suggested fields
```js
this.life = 0;
this.pulse = rand(0, TAU);
```
`update(dt)` で加算。

### Render guidance
```js
const dist = Math.abs(this.game.player.x - this.x);
const proximityScale = dist < 60 ? 1.6 : dist < 100 ? 1.4 : dist < 150 ? 1.2 : 1.0;
const pulse = 1 + Math.sin(this.life * 8 + this.pulse) * 0.08;
const sc = proximityScale * pulse;
```
描画前に `ctx.scale(sc, sc)`。
武器色を `WEAPON_SPECS[this.type].color` から取得して `shadowColor` / `shadowBlur` に利用する。

## 5. Pickup feedback
拾った瞬間を小イベント化する。

### Required feedback
- `XXX GET!!` を現在より大きく表示。
- ネオンリング/スパークを同時発生。
- 軽い画面揺れ: 4〜6。
- 短いhitstop: 0.035〜0.05秒。
- 新SFX `weaponGet` を鳴らす。

Web Audio例:
- 高めのsquare/sineを短時間上昇させる。
- 外部音声ファイルは使わない。

## 6. Per-weapon hit feedback
武器の違いを数値ではなく感触で分からせる。

`WEAPON_SPECS` または別テーブルに以下を持たせる。

| type | onomatopoeia | hitSfx | hitstop | shake |
|---|---|---|---:|---:|
| unarmed punch | バシッ! | punchHit | 0.045 | 4 |
| unarmed kick | ドガッ! | kickHit | 0.055 | 6 |
| bat | バキッ! | batHit | 0.065 | 7 |
| sword | ザシュッ! | swordHit | 0.055 | 6 |
| hammer | ドゴォン!! | hammerHit | 0.095 | 12 |
| nunchaku | バババッ! | nunchakuHit | 0.05 | 6 |
| staff | バシーン! | staffHit | 0.065 | 8 |

### Onomatopoeia rendering
既存 `effects.text()` を流用してもよいが、可能なら `HitEffect` に専用の `impactText()` を追加する。

動き:
- 出現時 1.8〜2.2x
- 0.1秒で1.0x付近へ
- ±8〜12度程度ランダム回転
- 0.35〜0.55秒でフェードアウト
- 武器の色に寄せる

漢字フォント依存を避ける必要はない。現状と同じCanvas font fallbackを使う。

## 7. SFX
既存 `sfx(type, vol)` を拡張する。

新タイプ:
- `weaponGet`
- `punchHit`
- `kickHit`
- `batHit`
- `swordHit`
- `hammerHit`
- `nunchakuHit`
- `staffHit`

外部音源なし。oscillator + noise + filterで作る。

### Sound character
- punchHit: 中高域の短いスナップ + 小ノイズ
- kickHit: punchより低く太い
- batHit: 木/硬質を感じる短いclick + 中低域
- swordHit: 高域ノイズをbandpassして短くスイープ
- hammerHit: 低域triangle + lowpass noise。最も低く重い
- nunchakuHit: 2〜3連の非常に短い高域クリック
- staffHit: batより鋭い中域

## 8. `Game.onAttackHit()` integration
現在の共通処理を中心に実装する。

処理順の推奨:
1. damage
2. durability consume
3. score/combo
4. weapon-specific hit FX
5. 擬音
6. weapon-specific shake
7. weapon-specific hitstop
8. weapon-specific SFX

`attackData` だけでなく `this.player.currentWeapon` を参照して現在武器を判定する。

注意: 武器耐久がこのヒットで0になり `currentWeapon` が解除される実装なら、`consumeWeaponDurability()` **前に武器typeを退避**する。

例:
```js
const weaponType = this.player.currentWeapon;
e.hurt(dmg, knock);
this.player.consumeWeaponDurability();
```

## 9. Heavy weapon identity
hammerだけは明確に特別扱いする。
- `ドゴォン!!`
- shake 12前後
- hitstop 0.09〜0.11
- 通常より大きいring/spark
- ノックバックを既存値より強めてもよいが、進行不能になるほど敵を画面外へ飛ばさない。

## 10. Test additions
既存テストに以下を追加する。

### Key test
- `KeyP` で `pickupPressed === true`
- `KeyE` では拾得しない

### Drop test
乱数を固定/差し替え可能なら:
- 通常敵撃破時に65%ルールが使われること
- AREA最低1武器保証ロジックが存在すること

### Pickup visual/state smoke
- `PickupWeapon` が `life` を持ち、updateで増える
- プレイヤー近接時でもNaNが発生しない

### Weapon feedback
各5武器で `onAttackHit` を呼んでも例外が出ない。
hammerのshake/hitstopがbatより大きいことを確認できるなら確認する。

### Existing regression
- 4-hit combo
- flykick
- weapon pickup/equip
- KungFu/Drone
- STAGE1-3 full progression
- ALL CLEAR
を必ずPassさせる。

## 11. Acceptance criteria
- PCで武器拾得はP。
- スマホ拾うボタンは従来通り。
- 1 AREAにつき少なくとも1回は武器を見る設計。
- 落ちた武器が戦闘中でも視認できる。
- 近づくと明確に巨大化し、拾えることが分かる。
- 武器取得時に音・文字・発光がある。
- 素手/各武器で命中音と擬音が違う。
- hammerは明らかに重い。
- 既存3ステージ進行を破壊しない。
- テスト全Pass。

## Suggested commit
`feat: make weapons frequent, visible, and punchier`
