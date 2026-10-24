/**
 * 🤿 3D 海底探険 (Deep Sea Adventure) - AAA 深海スパイラル3D＆公式完全ルール版
 * Board Arena Plugin (Godot 4.7 GLB + Three.js High-Resolution 3D WebGL)
 *
 * 🌟 AAA 特徴:
 * 1. 【オインクゲームズ『海底探険』公式ルール完全実装 (2〜6人対戦・欲張り＆堅実AI搭載)】
 *    - 全3ラウンド制、全員で共有する「🫧空気(酸素) 25」ゲージ！
 *    - 4段階の遺跡チップ全32枚：Lv1(▽ 0〜3点)・Lv2(□ 4〜7点)・Lv3(⬠ 8〜11点)・Lv4(⬢ 12〜15点)
 *    - 手番の4ステップ完全再現：
 *      ① 所持チップ数だけ共有の空気を減らす
 *      ② 潜り続けるか、潜水艦へ引き返す(Uターン)かを宣言
 *      ③ 1〜3の目のみの特殊ダイス2個を振り、(出目合計 − 所持チップ数)だけ前進（他のダイバーがいるマスはカウントせずジャンプ飛び越え！）
 *      ④ 止まったマスで「遺跡を拾う(跡地は空白に)」「空白マスに手持ちチップを置いて身軽になる」「何もしない」を選択
 *    - ラウンド終了時の公式処理：
 *      ・溺れたプレイヤーのチップは一番奥へ落とされ、3枚ごとに1マスの「📦まとめ財宝スタック(重さ1で3枚分！)」として配置！
 *      ・すべての空白マス(ブランク)を除去してコースを詰めるため、第2・第3ラウンドはいきなり深海へ突入！
 * 2. 【Godot 4.7 GLB 3D潜水艦＆3Dダイバー ＋ 深海スパイラルジオラマ】
 *    - 海面の黄色い3D潜水艦から深海へ渦巻く3D遺跡コースと、ダイバーの背中に積み上がる獲得チップを立体描画！
 */

(function () {
  const MAX_AIR = 25;
  const TOTAL_ROUNDS = 3;

  // レベル別の遺跡チップ設定
  const LEVEL_META = {
    1: { level: 1, name: 'Lv.1 浅瀬遺跡', shape: '▽', sides: 3, hex: 0xbae6fd, css: '#7dd3fc', textCss: '#0f172a', pointsPool: [0, 0, 1, 1, 2, 2, 3, 3] },
    2: { level: 2, name: 'Lv.2 中層遺跡', shape: '□', sides: 4, hex: 0x38bdf8, css: '#38bdf8', textCss: '#0f172a', pointsPool: [4, 4, 5, 5, 6, 6, 7, 7] },
    3: { level: 3, name: 'Lv.3 深海遺跡', shape: '⬠', sides: 5, hex: 0x0284c7, css: '#0284c7', textCss: '#ffffff', pointsPool: [8, 8, 9, 9, 10, 10, 11, 11] },
    4: { level: 4, name: 'Lv.4 超深海遺跡', shape: '⬢', sides: 6, hex: 0x1e3a8a, css: '#1e3a8a', textCss: '#fef08a', pointsPool: [12, 12, 13, 13, 14, 14, 15, 15] }
  };

  const PLAYER_THEMES = [
    { name: 'あなた (赤)', css: '#ef4444', hex: 0xef4444, style: 'balanced' },
    { name: 'CPU 2 (青・堅実派)', css: '#3b82f6', hex: 0x3b82f6, style: 'cautious' },
    { name: 'CPU 3 (緑・欲張り派)', css: '#10b981', hex: 0x10b981, style: 'greedy' },
    { name: 'CPU 4 (紫・深海ハンター)', css: '#a855f7', hex: 0xa855f7, style: 'hunter' },
    { name: 'CPU 5 (橙・バランス)', css: '#f97316', hex: 0xf97316, style: 'balanced' },
    { name: 'CPU 6 (桃・ギャンブラー)', css: '#ec4899', hex: 0xec4899, style: 'greedy' }
  ];

  // Web Audio サウンドエフェクト
  const DeepSeaSfx = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    play(freq, dur, type = 'sine', gainVal = 0.1) {
      if (localStorage.getItem('ba_sfx_enabled') === 'false') return;
      try {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },
    bubble() {
      [420, 580, 760].forEach((f, i) => setTimeout(() => this.play(f, 0.08, 'sine', 0.1), i * 45));
    },
    dice() {
      [320, 480, 640].forEach((f, i) => setTimeout(() => this.play(f, 0.07, 'triangle', 0.11), i * 40));
    },
    pickup() {
      [523.25, 659.25, 987.77].forEach((f, i) => setTimeout(() => this.play(f, 0.12, 'triangle', 0.13), i * 50));
    },
    returnSafe() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.play(f, 0.18, 'triangle', 0.15), i * 65));
    },
    drown() {
      [260, 210, 160, 115].forEach((f, i) => setTimeout(() => this.play(f, 0.24, 'sawtooth', 0.15), i * 85));
    }
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  window.BoardArena.registerGame({
    id: 'deep_sea',
    name: '3D 海底探険 (Deep Sea Adventure)',
    icon: '🤿',
    category: '🫧 酸素共有チキンレース (AAA 3D)',
    minPlayers: 2,
    maxPlayers: 6,
    description: '全員で1つの酸素タンク(空気25)を共有しながら深海の財宝を奪い合う傑作チキンレース！財宝を抱えるほど空気も移動力も減る極限のジレンマをフル3Dで体験せよ！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      let cpuTimer = null;

      let playerCount = 4;
      let vsCpu = !bridge.isConnected();
      let mySeat = bridge.isConnected() ? (bridge.isHost ? 0 : 1) : 0;

      // ゲーム状態
      let roundNum = 1;
      let air = MAX_AIR;
      // path: Array of tiles
      // 各要素: { type: 'ruin' | 'blank' | 'stack', chips: Array<{ level, points }> }
      // ※ 通常ruinは chips.length === 1、溺没スタックは chips.length <= 3（重さ1として扱われる！）
      let path = [];
      let players = [];
      let turnIndex = 0;
      let lastStarterIdx = 0;
      // turnSubPhase: 'DIRECTION' | 'ACTION' | 'ROUND_END' | 'GAME_OVER'
      let turnSubPhase = 'DIRECTION';
      let lastDice = [2, 2];
      let bannerText = '🤿 第1ラウンド開始！空気は全員共有で「25」です。深海の財宝を目指して潜항開始！';

      container.innerHTML = `
        <style>
          .dsa-wrapper {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            user-select: none;
            color: #f8fafc;
            font-family: 'Noto Sans JP', sans-serif;
          }
          .dsa-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(56, 189, 248, 0.42);
            border-radius: 12px;
            padding: 6px 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
          }
          .dsa-players-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            flex: 1;
          }
          .dsa-pcard {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(30, 41, 59, 0.9);
            border: 2px solid rgba(148, 163, 184, 0.28);
            border-radius: 10px;
            padding: 5px 10px;
            font-size: 12px;
          }
          .dsa-pcard.active-turn {
            border-color: #38bdf8;
            background: rgba(56, 189, 248, 0.16);
            box-shadow: 0 0 16px rgba(56, 189, 248, 0.4);
          }
          .dsa-score-pill {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #0f172a;
            font-weight: 900;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 12px;
          }
          .dsa-btn {
            background: rgba(30, 41, 59, 0.94);
            border: 1px solid rgba(148, 163, 184, 0.42);
            color: #f8fafc;
            font-size: 12px;
            font-weight: 800;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .dsa-btn:hover:not(:disabled) {
            border-color: #38bdf8;
            color: #38bdf8;
            transform: translateY(-1px);
          }
          .dsa-btn:disabled {
            opacity: 0.38;
            cursor: not-allowed;
          }
          .dsa-btn-dive {
            background: linear-gradient(135deg, #0284c7, #1d4ed8);
            border-color: #7dd3fc;
            color: #ffffff;
          }
          .dsa-btn-turn {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-color: #fef08a;
            color: #0f172a;
          }
          .dsa-btn-emerald {
            background: linear-gradient(135deg, #10b981, #059669);
            border-color: #6ee7b7;
            color: #ffffff;
          }
          .dsa-stage-wrap {
            position: relative;
            width: 100%;
            height: calc(100vh - 270px);
            min-height: 500px;
            max-height: 820px;
            background: radial-gradient(circle at 50% 25%, #0369a1 0%, #0c4a6e 40%, #082f49 75%, #020617 100%);
            border-radius: 16px;
            border: 1px solid rgba(56, 189, 248, 0.42);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
            overflow: hidden;
          }
          .dsa-stage-wrap canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            cursor: grab;
          }
          .dsa-stage-wrap canvas:active {
            cursor: grabbing;
          }
          .dsa-hud-top {
            position: absolute;
            top: 10px;
            left: 14px;
            right: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: none;
            z-index: 10;
            gap: 10px;
          }
          .dsa-banner {
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(56, 189, 248, 0.5);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
            color: #e0f2fe;
            pointer-events: auto;
            box-shadow: 0 6px 20px rgba(0,0,0,0.55);
          }
          .dsa-air-meter {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(15, 23, 42, 0.92);
            border: 2px solid #38bdf8;
            padding: 5px 14px;
            border-radius: 12px;
            pointer-events: auto;
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
          }
          .dsa-air-bar-bg {
            width: 120px;
            height: 12px;
            background: #1e293b;
            border-radius: 999px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.2);
          }
          .dsa-air-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #ef4444, #38bdf8, #22d3ee);
            transition: width 0.3s;
          }
          .dsa-bottom-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(56, 189, 248, 0.38);
            border-radius: 12px;
            padding: 8px 14px;
          }
          .dsa-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(9, 13, 22, 0.78);
            backdrop-filter: blur(5px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 30;
          }
          .dsa-modal-overlay.visible {
            display: flex;
          }
          .dsa-modal-box {
            background: linear-gradient(145deg, #0c4a6e, #0f172a);
            border: 2px solid #38bdf8;
            border-radius: 16px;
            padding: 22px 26px;
            max-width: 540px;
            width: 92%;
            box-shadow: 0 24px 60px rgba(0,0,0,0.9);
            text-align: center;
          }
        </style>

        <div class="dsa-wrapper">
          <div class="dsa-top-bar">
            <div class="dsa-players-row" id="dsa-players-row"></div>
            <div style="display:flex;gap:6px;align-items:center;">
              <select id="dsa-pcount-sel" class="dsa-btn">
                <option value="2">👥 2人探険</option>
                <option value="3">👥 3人探険</option>
                <option value="4" selected>👥 4人探険 (標準)</option>
                <option value="5">👥 5人探険</option>
                <option value="6">👥 6人探険 (カオス)</option>
              </select>
              <button class="dsa-btn" id="dsa-new-btn">🔄 新規ゲーム</button>
            </div>
          </div>

          <div class="dsa-stage-wrap" id="dsa-stage-wrap">
            <div class="dsa-hud-top">
              <div class="dsa-banner" id="dsa-banner">🤿 3D 海底探険 (Deep Sea Adventure)</div>
              <div style="display:flex;gap:8px;align-items:center;">
                <div class="dsa-air-meter">
                  <span style="font-size:13px;font-weight:900;color:#7dd3fc;" id="dsa-round-txt">R1/3</span>
                  <span style="font-size:15px;font-weight:900;color:#fef08a;" id="dsa-air-txt">🫧 空気: 25/25</span>
                  <div class="dsa-air-bar-bg">
                    <div class="dsa-air-bar-fill" id="dsa-air-fill" style="width:100%;"></div>
                  </div>
                  <span style="font-size:13px;font-weight:900;color:#f8fafc;" id="dsa-dice-txt">🎲 [2][2]</span>
                </div>
                <button class="dsa-btn" id="dsa-cam-reset" style="pointer-events:auto;">🎥 視点リセット</button>
              </div>
            </div>

            <div class="dsa-modal-overlay" id="dsa-modal-overlay">
              <div class="dsa-modal-box" id="dsa-modal-box"></div>
            </div>
          </div>

          <div class="dsa-bottom-dock" id="dsa-bottom-dock"></div>
        </div>
      `;

      const playersRowEl = container.querySelector('#dsa-players-row');
      const pcountSelEl = container.querySelector('#dsa-pcount-sel');
      const newBtnEl = container.querySelector('#dsa-new-btn');
      const stageWrapEl = container.querySelector('#dsa-stage-wrap');
      const bannerEl = container.querySelector('#dsa-banner');
      const roundTxtEl = container.querySelector('#dsa-round-txt');
      const airTxtEl = container.querySelector('#dsa-air-txt');
      const airFillEl = container.querySelector('#dsa-air-fill');
      const diceTxtEl = container.querySelector('#dsa-dice-txt');
      const camResetBtn = container.querySelector('#dsa-cam-reset');
      const modalOverlayEl = container.querySelector('#dsa-modal-overlay');
      const modalBoxEl = container.querySelector('#dsa-modal-box');
      const bottomDockEl = container.querySelector('#dsa-bottom-dock');

      // ====================================================
      // 1. コース＆プレイヤー初期化
      // ====================================================
      function buildInitialPath() {
        const p = [];
        [1, 2, 3, 4].forEach((lv) => {
          const pts = shuffle(LEVEL_META[lv].pointsPool);
          pts.forEach((pt) => {
            p.push({
              type: 'ruin',
              chips: [{ level: lv, points: pt }]
            });
          });
        });
        return p;
      }

      function createPlayer(idx) {
        return {
          idx,
          name: PLAYER_THEMES[idx].name,
          css: PLAYER_THEMES[idx].css,
          hex: PLAYER_THEMES[idx].hex,
          style: PLAYER_THEMES[idx].style,
          isCpu: vsCpu && idx !== mySeat,
          pos: -1,             // -1 = 潜水艦内, 0 .. path.length-1 = 海底タイルインデックス
          returning: false,    // true = 潜水艦へ引き返し中
          returnedSafe: false, // true = このラウンドで潜水艦に帰還済み
          carried: [],         // Array of item objects (1要素＝重さ1。通常は[{level, points}]、スタックは最大3枚入り)
          savedChips: [],      // 確定持ち帰り済みチップ配列 {level, points}
          score: 0
        };
      }

      function initGame() {
        if (cpuTimer) clearTimeout(cpuTimer);
        playerCount = parseInt(pcountSelEl.value, 10) || 4;
        roundNum = 1;
        path = buildInitialPath();
        players = [];
        for (let i = 0; i < playerCount; i++) {
          players.push(createPlayer(i));
        }
        lastStarterIdx = 0;
        startRound(1, 0);
      }

      function startRound(rNum, starterIdx) {
        roundNum = rNum;
        air = MAX_AIR;
        players.forEach((p) => {
          p.pos = -1;
          p.returning = false;
          p.returnedSafe = false;
          p.carried = [];
        });
        modalOverlayEl.classList.remove('visible');
        turnIndex = starterIdx;
        beginPlayerTurn();
      }

      // ====================================================
      // 2. 手番開始（ステップ1：空気減少）➔ 方向選択＆ダイス移動 ➔ 探索アクション
      // ====================================================
      function beginPlayerTurn() {
        // 全員帰還済み、またはすでに前のターン終了時点で空気0ならラウンド終了
        if (players.every((p) => p.returnedSafe)) {
          endRound();
          return;
        }

        // 帰還済みプレイヤーはスキップ
        let safety = 0;
        while (players[turnIndex].returnedSafe && safety < playerCount) {
          turnIndex = (turnIndex + 1) % playerCount;
          safety++;
        }

        const p = players[turnIndex];
        // ステップ1: 所持している財宝アイテム数だけ空気を減らす
        const weight = p.carried.length;
        if (weight > 0) {
          air = Math.max(0, air - weight);
          DeepSeaSfx.bubble();
        }

        // すでに一番奥にいる場合は強制的に引き返し状態になる
        if (p.pos >= path.length - 1) {
          p.returning = true;
        }

        turnSubPhase = 'DIRECTION';
        bannerText = `🫧 ${p.name} の手番（所持重さ:${weight} ➔ 残り空気:${air}）！${p.returning ? '⬆️引き返し中：ダイスを振って潜水艦へ急げ！' : '⬇️潜り続けるか、⬆️潜水艦へ引き返すか選択してください。'}`;
        renderAll();

        if (p.isCpu) {
          cpuTimer = setTimeout(runCpuTurn, 650);
        }
      }

      // ステップ2 & 3: 方向を確定して特殊ダイス(1〜3)×2を振り、ジャンプ移動！
      function rollAndMove(p, turnBackNow) {
        if (turnBackNow && p.pos >= 0) {
          p.returning = true;
        }

        // 1〜3の目が出る特殊ダイス2個
        const d1 = Math.floor(Math.random() * 3) + 1;
        const d2 = Math.floor(Math.random() * 3) + 1;
        lastDice = [d1, d2];
        DeepSeaSfx.dice();

        const rawRoll = d1 + d2;
        const weight = p.carried.length;
        let steps = Math.max(0, rawRoll - weight);

        // 他のダイバーがいるマス一覧（潜水艦 -1 は除く）
        const occupiedSet = new Set(
          players
            .filter((other) => other.idx !== p.idx && !other.returnedSafe && other.pos >= 0)
            .map((other) => other.pos)
        );

        let curr = p.pos;
        if (!p.returning) {
          // 潜る方向（インデックス増加）
          while (steps > 0 && curr < path.length - 1) {
            curr++;
            if (!occupiedSet.has(curr)) {
              steps--;
            }
          }
          // もし最深部が他のプレイヤーで埋まっていて着地できない場合は手前の空きマスに止まる
          while (occupiedSet.has(curr) && curr > p.pos) {
            curr--;
          }
          p.pos = curr;
          if (p.pos >= path.length - 1) {
            p.returning = true; // 最深部到達で次回から自動引き返し
          }
        } else {
          // 潜水艦へ引き返す方向（インデックス減少）
          while (steps > 0 && curr > -1) {
            curr--;
            if (curr === -1) {
              steps = 0;
              break;
            }
            if (!occupiedSet.has(curr)) {
              steps--;
            }
          }
          p.pos = curr;
          if (p.pos <= -1) {
            p.pos = -1;
            p.returnedSafe = true;
            DeepSeaSfx.returnSafe();
            bannerText = `🎉 ${p.name} が🎲[${d1}+${d2}=${rawRoll}]で潜水艦に無事生還しました！（財宝${p.carried.length}個確保！）`;
            finishPlayerTurn();
            return;
          }
        }

        turnSubPhase = 'ACTION';
        bannerText = `🎲 ${p.name} の出目 [${d1}+${d2}=${rawRoll}]（重さ-${weight} ➔ ${Math.max(0, rawRoll - weight)}歩移動）！止まったマスで探索アクションを選択してください。`;
        renderAll();
      }

      // ステップ4: 探索アクション（拾う / 置く / 何もしない）
      function executeSearchAction(p, actionType) {
        const tile = path[p.pos];
        if (actionType === 'PICKUP' && tile && (tile.type === 'ruin' || tile.type === 'stack')) {
          p.carried.push(tile.chips);
          path[p.pos] = { type: 'blank', chips: [] };
          DeepSeaSfx.pickup();
          bannerText = `💎 ${p.name} が海底から財宝を拾いました！（現在所持: ${p.carried.length}個）`;
        } else if (actionType === 'DROP' && tile && tile.type === 'blank' && p.carried.length > 0) {
          // 一番価値の低そうな最初の手持ちアイテムを置く
          const droppedChips = p.carried.shift();
          path[p.pos] = {
            type: droppedChips.length > 1 ? 'stack' : 'ruin',
            chips: droppedChips
          };
          DeepSeaSfx.bubble();
          bannerText = `📦 ${p.name} が空白マスに財宝1個を置いて身軽になりました！（現在所持: ${p.carried.length}個）`;
        } else {
          bannerText = `🏊 ${p.name} は何もせず移動を終えました。`;
        }

        finishPlayerTurn();
      }

      function finishPlayerTurn() {
        // 潜水艦にまだ戻っていない最後の行動者を記録（次ラウンドの親用）
        if (!players[turnIndex].returnedSafe) {
          lastStarterIdx = turnIndex;
        }

        // 手番終了時に空気が0以下、または全員帰還済みならラウンド終了！
        if (air <= 0 || players.every((p) => p.returnedSafe)) {
          endRound();
          return;
        }

        turnIndex = (turnIndex + 1) % playerCount;
        beginPlayerTurn();
      }

      // ====================================================
      // 3. ラウンド終了処理（生還者の得点確定・溺没者の3枚スタック投棄・空白マス圧縮）
      // ====================================================
      function endRound() {
        turnSubPhase = 'ROUND_END';
        const safeLogs = [];
        const drownLogs = [];

        // 1. 潜水艦に帰還できたプレイヤーは持ち帰ったチップを公開してスコア加算
        players.forEach((p) => {
          if (p.returnedSafe && p.carried.length > 0) {
            let gainedPts = 0;
            let chipCnt = 0;
            p.carried.forEach((bundle) => {
              bundle.forEach((ch) => {
                p.savedChips.push(ch);
                p.score += ch.points;
                gainedPts += ch.points;
                chipCnt++;
              });
            });
            p.carried = [];
            safeLogs.push(`🎉 <b>${p.name}</b>：無事生還！財宝 ${chipCnt}枚（<b>+${gainedPts}点</b>）を獲得！`);
          }
        });

        // 2. 海底に残されたプレイヤー（溺没）は潜水艦に近い順→遠い順で整理し、財宝を一番奥へ3枚ずつスタック投棄
        const drownedPlayers = players
          .filter((p) => !p.returnedSafe && p.pos >= 0)
          .sort((a, b) => a.pos - b.pos);

        if (drownedPlayers.length > 0) {
          DeepSeaSfx.drown();
        }

        const droppedPool = [];
        drownedPlayers.forEach((p) => {
          let lostCnt = 0;
          p.carried.forEach((bundle) => {
            bundle.forEach((ch) => {
              droppedPool.push(ch);
              lostCnt++;
            });
          });
          p.carried = [];
          drownLogs.push(`🌊 <b>${p.name}</b>：酸素切れで溺没…（抱えていた財宝 ${lostCnt}枚を海底最深部へ喪失）`);
        });

        // 3枚ごとに1つのスタックタイルとしてコース最後尾に追加
        for (let i = 0; i < droppedPool.length; i += 3) {
          const chunk = droppedPool.slice(i, i + 3);
          path.push({
            type: chunk.length > 1 ? 'stack' : 'ruin',
            chips: chunk
          });
        }

        // 3. 盤上のすべての「⬜ブランク（空白マス）」を取り除いてコースを詰める！
        path = path.filter((tile) => tile.type !== 'blank');

        renderAll();
        openRoundSummaryModal(safeLogs, drownLogs);
      }

      function openRoundSummaryModal(safeLogs, drownLogs) {
        const isFinalRound = roundNum >= TOTAL_ROUNDS;

        if (isFinalRound) {
          turnSubPhase = 'GAME_OVER';
          const ranked = players.slice().sort((a, b) => b.score - a.score);
          const winner = ranked[0];
          const rankHtml = ranked.map((p, idx) => `
            <div style="display:flex;justify-content:space-between;padding:8px 12px;margin-bottom:6px;background:rgba(255,255,255,0.08);border-radius:8px;border-left:4px solid ${p.css};">
              <span><b>${idx + 1}位: ${p.name}</b></span>
              <span>💎 <b>${p.score} 点</b> （獲得チップ: ${p.savedChips.length}枚）</span>
            </div>
          `).join('');

          modalBoxEl.innerHTML = `
            <div style="font-size:22px;font-weight:900;color:#fef08a;margin-bottom:8px;">🏆 全3ラウンド終了！勝者: ${winner.name}</div>
            <div style="text-align:left;font-size:12px;color:#cbd5e1;margin-bottom:12px;">
              ${[...safeLogs, ...drownLogs].join('<br>')}
            </div>
            <div style="margin-bottom:16px;text-align:left;">${rankHtml}</div>
            <button class="dsa-btn dsa-btn-turn" id="dsa-rematch-btn">🔄 もう一度潜る</button>
          `;
          modalOverlayEl.classList.add('visible');
          modalBoxEl.querySelector('#dsa-rematch-btn').onclick = () => initGame();
          return;
        }

        modalBoxEl.innerHTML = `
          <div style="font-size:20px;font-weight:900;color:#7dd3fc;margin-bottom:10px;">
            🌊 第 ${roundNum} ラウンド終了！（残り遺跡マス: ${path.length}個）
          </div>
          <div style="text-align:left;font-size:13px;line-height:1.7;color:#f1f5f9;margin-bottom:16px;background:rgba(0,0,0,0.28);padding:10px 14px;border-radius:10px;">
            ${[...safeLogs, ...drownLogs].length > 0 ? [...safeLogs, ...drownLogs].join('<br>') : '全員財宝を持たずに帰還しました。'}
            <div style="margin-top:8px;color:#fef08a;font-size:12px;">
              ※ 空白マスがすべて取り除かれ、次のラウンドはさらに深い海底遺跡へすぐ到達できます！
            </div>
          </div>
          <button class="dsa-btn dsa-btn-emerald" id="dsa-next-round-btn" style="font-size:14px;padding:8px 20px;">
            🤿 第 ${roundNum + 1} ラウンドへ進む！
          </button>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#dsa-next-round-btn').onclick = () => {
          startRound(roundNum + 1, lastStarterIdx);
        };
      }

      // ====================================================
      // 4. CPU思考エンジン（空気残量・深さ・所持重さからUターン＆拾得を判断）
      // ====================================================
      function runCpuTurn() {
        if (isDestroyed || turnSubPhase !== 'DIRECTION') return;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu) return;

        // 1. 引き返すか潜り続けるかの判断
        let wantReturn = cpu.returning;
        if (!wantReturn && cpu.pos >= 0) {
          const carriedCnt = cpu.carried.length;
          // 潜水艦までの帰還に必要な推定ターン数と空気消費量を見積もる
          const avgSpeed = Math.max(1, 4 - carriedCnt);
          const estTurnsBack = Math.ceil((cpu.pos + 1) / avgSpeed);
          const totalCarriedAll = players.reduce((s, pl) => s + (pl.returnedSafe ? 0 : pl.carried.length), 0) || 1;
          const airThreshold = estTurnsBack * totalCarriedAll;

          if (cpu.style === 'cautious') {
            if (carriedCnt >= 1 && (air <= airThreshold + 4 || cpu.pos >= 5)) wantReturn = true;
          } else if (cpu.style === 'greedy') {
            if (carriedCnt >= 3 || (carriedCnt >= 1 && air <= airThreshold - 1)) wantReturn = true;
          } else {
            if (carriedCnt >= 2 || (carriedCnt >= 1 && air <= airThreshold + 2)) wantReturn = true;
          }
        }

        rollAndMove(cpu, wantReturn);

        // もし潜水艦に帰還完了してターンが進んでいたら終了
        if (turnSubPhase !== 'ACTION' || players[turnIndex] !== cpu) return;

        // 2. 止まったマスでの探索アクション判断
        setTimeout(() => {
          if (isDestroyed || turnSubPhase !== 'ACTION') return;
          const tile = path[cpu.pos];
          if (!tile) {
            executeSearchAction(cpu, 'PASS');
            return;
          }

          if (tile.type === 'ruin' || tile.type === 'stack') {
            const maxCarry = cpu.style === 'cautious' ? 2 : (cpu.style === 'greedy' ? 4 : 3);
            // 帰還中に空気がピンチならこれ以上拾わない
            if (cpu.returning && air <= 5 && cpu.carried.length >= 1) {
              executeSearchAction(cpu, 'PASS');
            } else if (cpu.carried.length < maxCarry) {
              executeSearchAction(cpu, 'PICKUP');
            } else {
              executeSearchAction(cpu, 'PASS');
            }
          } else if (tile.type === 'blank') {
            // 帰還中で空気が残り少なく、3個以上抱えていて動けない時は1個捨てて身軽にする！
            if (cpu.returning && air <= 6 && cpu.carried.length >= 3) {
              executeSearchAction(cpu, 'DROP');
            } else {
              executeSearchAction(cpu, 'PASS');
            }
          } else {
            executeSearchAction(cpu, 'PASS');
          }
        }, 550);
      }

      // ====================================================
      // 5. Three.js + Godot 4.7 GLB 深海スパイラル3Dステージ
      // ====================================================
      let THREE = null;
      let scene = null;
      let camera = null;
      let renderer = null;
      let oceanGroup = null;
      let maxAniso = 8;
      let glbSub = null;
      let glbDiver = null;

      let camSpherical = { radius: 19.5, phi: 0.75, theta: 0 };

      function ensureThreeLoaded() {
        return new Promise((resolve) => {
          if (window.THREE) return resolve(window.THREE);
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
          s.onload = () => resolve(window.THREE);
          document.head.appendChild(s);
        });
      }

      function init3DStage(threeLib) {
        THREE = threeLib;
        const w = stageWrapEl.clientWidth || 960;
        const h = stageWrapEl.clientHeight || 560;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 200);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stageWrapEl.appendChild(renderer.domElement);

        maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;

        // 海中ライティング
        scene.add(new THREE.AmbientLight(0xe0f2fe, 0.9));
        const sunRay = new THREE.DirectionalLight(0xfffbeb, 1.3);
        sunRay.position.set(6, 18, 10);
        sunRay.castShadow = true;
        sunRay.shadow.mapSize.width = 2048;
        sunRay.shadow.mapSize.height = 2048;
        scene.add(sunRay);

        const abyssLight = new THREE.DirectionalLight(0x0284c7, 0.6);
        abyssLight.position.set(-10, -8, -8);
        scene.add(abyssLight);

        oceanGroup = new THREE.Group();
        scene.add(oceanGroup);

        // Godot 4.7 GLBモデルのロード
        if (window.THREE.GLTFLoader && window.location.protocol !== 'file:') {
          const loader = new window.THREE.GLTFLoader();
          loader.load('assets/models/deepsea_sub.glb', (gltf) => {
            if (gltf && gltf.scene) {
              glbSub = gltf.scene;
              rebuild3DOceanScene();
            }
          }, undefined, () => {});
          loader.load('assets/models/deepsea_diver.glb', (gltf) => {
            if (gltf && gltf.scene) {
              glbDiver = gltf.scene;
              rebuild3DOceanScene();
            }
          }, undefined, () => {});
        }

        // カメラ操作
        let isDragging = false;
        let prevX = 0;
        let prevY = 0;
        const dom = renderer.domElement;

        dom.addEventListener('pointerdown', (e) => {
          isDragging = true;
          prevX = e.clientX;
          prevY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
          if (isDestroyed || !isDragging) return;
          const dx = e.clientX - prevX;
          const dy = e.clientY - prevY;
          prevX = e.clientX;
          prevY = e.clientY;
          camSpherical.theta -= dx * 0.0065;
          camSpherical.phi = Math.max(0.22, Math.min(1.32, camSpherical.phi - dy * 0.0065));
          updateCamera();
        });

        window.addEventListener('pointerup', () => {
          isDragging = false;
        });

        dom.addEventListener('wheel', (e) => {
          e.preventDefault();
          camSpherical.radius = Math.max(11.0, Math.min(28.0, camSpherical.radius + e.deltaY * 0.01));
          updateCamera();
        }, { passive: false });

        camResetBtn.onclick = () => {
          camSpherical = { radius: 19.5, phi: 0.75, theta: 0 };
          updateCamera();
        };

        window.addEventListener('resize', onResize);
        updateCamera();
        rebuild3DOceanScene();

        function animate() {
          if (isDestroyed) return;
          animFrameId = requestAnimationFrame(animate);
          renderer.render(scene, camera);
        }
        animate();
      }

      function updateCamera() {
        if (!camera) return;
        const { radius, phi, theta } = camSpherical;
        camera.position.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(0, -0.3, 0);
      }

      function onResize() {
        if (isDestroyed || !renderer || !camera) return;
        const w = stageWrapEl.clientWidth || 960;
        const h = stageWrapEl.clientHeight || 560;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }

      // コースのインデックス i に対する3Dスパイラル座標を計算
      function getTilePosition3D(index) {
        // 8タイルごとに1列折り返す蛇行＋深海への段差レイアウト（全体の視認性が抜群！）
        const cols = 8;
        const row = Math.floor(index / cols);
        const colInRow = index % cols;
        const col = row % 2 === 0 ? colInRow : (cols - 1 - colInRow);
        const x = -5.6 + col * 1.62;
        const z = -2.4 + row * 2.15;
        const y = 1.2 - index * 0.085;
        return { x, y, z };
      }

      function createRuinTile3D(tile, index) {
        const group = new THREE.Group();
        if (tile.type === 'blank') {
          const blankMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.58, 0.58, 0.08, 24),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, transparent: true, opacity: 0.65 })
          );
          group.add(blankMesh);
          return group;
        }

        // 通常遺跡チップ または 3枚まとめスタック
        tile.chips.forEach((ch, cIdx) => {
          const lm = LEVEL_META[ch.level];
          const cv = document.createElement('canvas');
          cv.width = 256;
          cv.height = 256;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = lm.css;
          ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 14;
          ctx.strokeRect(10, 10, 236, 236);

          ctx.fillStyle = lm.textCss;
          ctx.font = '900 72px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(lm.shape.repeat(ch.level), 128, 105);

          ctx.font = '900 44px "Noto Sans JP", sans-serif';
          ctx.fillText(tile.type === 'stack' ? `📦×${tile.chips.length}` : `Lv.${ch.level}`, 128, 185);

          const tex = new THREE.CanvasTexture(cv);
          tex.anisotropy = maxAniso;

          const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.64, 0.66, 0.16, lm.sides === 3 ? 3 : (lm.sides === 4 ? 4 : (lm.sides === 5 ? 5 : 6))),
            [
              new THREE.MeshStandardMaterial({ color: lm.hex, roughness: 0.3 }),
              new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 }),
              new THREE.MeshStandardMaterial({ color: lm.hex, roughness: 0.3 })
            ]
          );
          mesh.position.y = cIdx * 0.17;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        });

        return group;
      }

      function createDiver3D(p, isActiveTurn) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: p.hex, roughness: 0.25, metalness: 0.2 });

        if (glbDiver) {
          const clone = glbDiver.clone(true);
          clone.traverse((c) => {
            if (c.isMesh && c.name.startsWith('ColorPart')) {
              c.material = mat;
            }
          });
          group.add(clone);
        } else {
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.45, 16), mat);
          body.position.y = 0.22;
          body.castShadow = true;
          group.add(body);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), mat);
          head.position.y = 0.56;
          group.add(head);
        }

        // 抱えている財宝の数だけ背中にミニチップを積む
        p.carried.forEach((bundle, bIdx) => {
          const topChip = bundle[0];
          const lm = LEVEL_META[topChip.level];
          const bag = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12),
            new THREE.MeshStandardMaterial({ color: lm.hex, roughness: 0.2 })
          );
          bag.position.set(0, 0.85 + bIdx * 0.12, 0);
          group.add(bag);
        });

        // プレイヤー名＆進行方向ビルボード
        const lc = document.createElement('canvas');
        lc.width = 220;
        lc.height = 80;
        const lctx = lc.getContext('2d');
        lctx.fillStyle = isActiveTurn ? 'rgba(14, 165, 233, 0.95)' : 'rgba(15, 23, 42, 0.88)';
        lctx.strokeStyle = isActiveTurn ? '#fef08a' : p.css;
        lctx.lineWidth = 6;
        lctx.fillRect(4, 4, 212, 72);
        lctx.strokeRect(4, 4, 212, 72);
        lctx.fillStyle = '#ffffff';
        lctx.font = '900 32px "Noto Sans JP", sans-serif';
        lctx.textAlign = 'center';
        lctx.textBaseline = 'middle';
        const dirIcon = p.returnedSafe ? '🎉帰還' : (p.returning ? '⬆️帰路' : '⬇️潜航');
        lctx.fillText(`P${p.idx + 1} ${dirIcon} (💎${p.carried.length})`, 110, 40);

        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true }));
        sp.scale.set(1.45, 0.52, 1);
        sp.position.set(0, 1.15 + p.carried.length * 0.12, 0);
        group.add(sp);

        return group;
      }

      function rebuild3DOceanScene() {
        if (!THREE || !oceanGroup) return;
        while (oceanGroup.children.length > 0) {
          oceanGroup.remove(oceanGroup.children[0]);
        }

        // 1. 左上に黄色い3D潜水艦 (Submarine Pos: X=-6.2, Y=2.1, Z=-4.3)
        const subGroup = new THREE.Group();
        subGroup.position.set(-5.2, 1.85, -4.45);
        if (glbSub) {
          const sClone = glbSub.clone(true);
          sClone.scale.set(1.35, 1.35, 1.35);
          subGroup.add(sClone);
        } else {
          const hull = new THREE.Mesh(
            new THREE.SphereGeometry(0.9, 24, 18),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.25 })
          );
          hull.scale.set(1.6, 0.75, 0.9);
          hull.position.y = 0.5;
          subGroup.add(hull);
        }
        oceanGroup.add(subGroup);

        // 潜水艦内にいる（未出発 または 帰還済み）ダイバーを潜水艦の横に並べる
        let subSlot = 0;
        players.forEach((p) => {
          if (p.pos === -1) {
            const dv = createDiver3D(p, p.idx === turnIndex && turnSubPhase !== 'ROUND_END');
            dv.position.set(-2.5 + subSlot * 1.15, 1.75, -4.45);
            oceanGroup.add(dv);
            subSlot++;
          }
        });

        // 2. 海底遺跡タイルコースとダイバー
        path.forEach((tile, idx) => {
          const pos = getTilePosition3D(idx);
          const tileObj = createRuinTile3D(tile, idx);
          tileObj.position.set(pos.x, pos.y, pos.z);
          oceanGroup.add(tileObj);

          // 前後のタイルを繋ぐガイドライン
          if (idx > 0) {
            const prevPos = getTilePosition3D(idx - 1);
            const midX = (prevPos.x + pos.x) / 2;
            const midY = (prevPos.y + pos.y) / 2 - 0.05;
            const midZ = (prevPos.z + pos.z) / 2;
            const dist = Math.hypot(pos.x - prevPos.x, pos.y - prevPos.y, pos.z - prevPos.z);
            const conn = new THREE.Mesh(
              new THREE.BoxGeometry(0.14, 0.04, dist),
              new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 })
            );
            conn.position.set(midX, midY, midZ);
            conn.lookAt(pos.x, pos.y, pos.z);
            oceanGroup.add(conn);
          }

          // このタイル上にいるダイバー
          const diverHere = players.find((p) => !p.returnedSafe && p.pos === idx);
          if (diverHere) {
            const dv = createDiver3D(diverHere, diverHere.idx === turnIndex && turnSubPhase !== 'ROUND_END');
            dv.position.set(pos.x, pos.y + 0.14 + tile.chips.length * 0.14, pos.z);
            oceanGroup.add(dv);
          }
        });
      }

      // ====================================================
      // 6. UIレンダリング
      // ====================================================
      function renderAll() {
        // 1. プレイヤー一覧
        playersRowEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && turnSubPhase !== 'ROUND_END' && turnSubPhase !== 'GAME_OVER';
          const statusLabel = p.returnedSafe
            ? '🎉帰還済'
            : (p.pos === -1 ? '🚢潜水艦' : (p.returning ? `⬆️帰路(深さ${p.pos + 1})` : `⬇️潜航(深さ${p.pos + 1})`));

          return `
            <div class="dsa-pcard ${isTurn ? 'active-turn' : ''}">
              <span style="font-weight:900;color:${p.css};">${isTurn ? '▶ ' : ''}${p.name}</span>
              <span class="dsa-score-pill">💎 確定:${p.score}点</span>
              <span style="color:#cbd5e1;">${statusLabel} / 抱え:${p.carried.length}個</span>
            </div>
          `;
        }).join('');

        // 2. 空気メーター＆ダイス＆バナー
        roundTxtEl.textContent = `R${roundNum}/${TOTAL_ROUNDS}`;
        airTxtEl.textContent = `🫧 空気: ${air}/${MAX_AIR}`;
        airFillEl.style.width = `${(air / MAX_AIR) * 100}%`;
        diceTxtEl.textContent = `🎲 [${lastDice[0]}][${lastDice[1]}]`;
        bannerEl.textContent = bannerText;

        // 3. 下部アクションドック
        const activeP = players[turnIndex];
        const isMyTurn = activeP && !activeP.isCpu && turnSubPhase !== 'ROUND_END' && turnSubPhase !== 'GAME_OVER';

        if (!isMyTurn) {
          bottomDockEl.innerHTML = `<span style="color:#94a3b8;font-size:13px;">⏳ ${activeP ? activeP.name : ''} が深海を行動中...</span>`;
        } else if (turnSubPhase === 'DIRECTION') {
          if (activeP.returning) {
            bottomDockEl.innerHTML = `
              <span style="font-size:13px;font-weight:900;color:#fde047;">⬆️ 潜水艦へ引き返し中！（抱えている財宝: ${activeP.carried.length}個）</span>
              <button class="dsa-btn dsa-btn-turn" id="dsa-roll-return" style="font-size:14px;padding:8px 20px;">
                🎲 ダイスを振って潜水艦へ戻る！
              </button>
            `;
            bottomDockEl.querySelector('#dsa-roll-return').onclick = () => rollAndMove(activeP, false);
          } else {
            const canTurnBack = activeP.pos >= 0;
            bottomDockEl.innerHTML = `
              <span style="font-size:13px;font-weight:900;color:#7dd3fc;">
                🤿 方向を選択してください（抱えている財宝: ${activeP.carried.length}個 ➔ 出目から -${activeP.carried.length} されます）
              </span>
              <div style="display:flex;gap:8px;">
                <button class="dsa-btn dsa-btn-dive" id="dsa-keep-diving" style="font-size:14px;padding:8px 18px;">
                  ⬇️ このまま深く潜る ＆ 🎲ダイスロール
                </button>
                <button class="dsa-btn dsa-btn-turn" id="dsa-turn-back" style="font-size:14px;padding:8px 18px;" ${canTurnBack ? '' : 'disabled'}>
                  ⬆️ 潜水艦へ引き返す(Uターン) ＆ 🎲ダイスロール
                </button>
              </div>
            `;
            bottomDockEl.querySelector('#dsa-keep-diving').onclick = () => rollAndMove(activeP, false);
            const tbBtn = bottomDockEl.querySelector('#dsa-turn-back');
            if (tbBtn && canTurnBack) {
              tbBtn.onclick = () => rollAndMove(activeP, true);
            }
          }
        } else if (turnSubPhase === 'ACTION') {
          const tile = path[activeP.pos];
          const canPickup = tile && (tile.type === 'ruin' || tile.type === 'stack');
          const canDrop = tile && tile.type === 'blank' && activeP.carried.length > 0;
          const tileDesc = canPickup
            ? (tile.type === 'stack' ? `📦 3枚まとめ財宝スタック` : `${LEVEL_META[tile.chips[0].level].name}`)
            : '⬜ 空白マス（ブランク）';

          bottomDockEl.innerHTML = `
            <span style="font-size:13px;font-weight:900;color:#fef08a;">
              📍 現在の足元：【${tileDesc}】（手持ち重さ: ${activeP.carried.length}個）
            </span>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${canPickup ? `<button class="dsa-btn dsa-btn-emerald" id="dsa-act-pickup" style="font-size:14px;padding:8px 18px;">💎 遺跡チップを拾う (重さ+1)</button>` : ''}
              ${canDrop ? `<button class="dsa-btn dsa-btn-turn" id="dsa-act-drop">📦 手持ち財宝を1個置いて身軽になる (重さ-1)</button>` : ''}
              <button class="dsa-btn" id="dsa-act-pass" style="font-size:14px;padding:8px 18px;">🏊 何もしない (ターン終了)</button>
            </div>
          `;
          const pBtn = bottomDockEl.querySelector('#dsa-act-pickup');
          if (pBtn) pBtn.onclick = () => executeSearchAction(activeP, 'PICKUP');
          const dBtn = bottomDockEl.querySelector('#dsa-act-drop');
          if (dBtn) dBtn.onclick = () => executeSearchAction(activeP, 'DROP');
          bottomDockEl.querySelector('#dsa-act-pass').onclick = () => executeSearchAction(activeP, 'PASS');
        }

        rebuild3DOceanScene();
      }

      pcountSelEl.onchange = () => initGame();
      newBtnEl.onclick = () => initGame();

      ensureThreeLoaded().then((threeLib) => {
        if (isDestroyed) return;
        init3DStage(threeLib);
        initGame();
      });

      return () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
        if (animFrameId) cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', onResize);
        if (renderer) renderer.dispose();
      };
    }
  });
})();
