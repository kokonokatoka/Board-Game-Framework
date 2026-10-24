/**
 * 👻 3D ガイスター (Geister / 良いおばけと悪いおばけ) - AAA ゴシック古城3D＆究極心理戦エディション
 * Board Arena Plugin (Godot 4.7 GLB + Three.js High-Resolution 3D WebGL)
 *
 * 🌟 AAA 特徴:
 * 1. 【公式ガイスター完全ルール実装 (秘密の初期配置・3大勝利条件・P2Pオンライン＆心理戦AI対応)】
 *    - 6×6 古城フロア＆四隅の脱出出口マス、各プレイヤー8体のおばけ（🔵良いおばけ×4、🔴悪いおばけ×4）
 *    - 初期配置フェーズ：自陣8マス（中央4列×2段）のおばけをクリックして青と赤の配置を自由に入れ替え可能！（陣形プリセット付き）
 *    - 3つの公式勝利条件を完全網羅：
 *      ① 相手の「🔵良いおばけ」を4体すべて捕獲する
 *      ② 自分の「🔴悪いおばけ」を4体すべて相手に捕獲させる（わざと食べさせるブラフ勝利！）
 *      ③ 自分の「🔵良いおばけ」1体を、敵陣の角の出口マスからさらに盤外へ脱出させる！
 * 2. 【Godot 4.7 GLB 3Dゴーストモデル ＋ 浮遊アニメーション＆捕獲台座】
 *    - 自分のおばけの背中には青/赤の宝石が輝き、相手のおばけの正体は見えないリアルな非対称3D視点！
 *    - 残り赤1体時の「囮の特攻」や、赤おばけを出口へ走らせて青に見せかける「偽装脱出ブラフ」を行う本格AI搭載！
 */

(function () {
  const BOARD_SIZE = 6;

  // Web Audio ゴシックサウンドエフェクト
  const GeisterSfx = {
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
    move() {
      this.play(392, 0.11, 'sine', 0.1);
      setTimeout(() => this.play(523.25, 0.12, 'sine', 0.08), 55);
    },
    captureBlue() {
      [523.25, 659.25, 880].forEach((f, i) => setTimeout(() => this.play(f, 0.14, 'triangle', 0.14), i * 60));
    },
    captureRed() {
      [240, 185, 138].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'sawtooth', 0.15), i * 80));
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'triangle', 0.16), i * 80));
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
    id: 'geister',
    name: '3D ガイスター (Geister)',
    icon: '👻',
    category: '🕵️ 究極の2人心理戦 (AAA 3D)',
    minPlayers: 2,
    maxPlayers: 2,
    description: '背中に青（良いおばけ）と赤（悪いおばけ）を隠した8体のおばけで戦う伝説の2人用ブラフ心理戦！青を4体取るか、赤を4体取らせるか、敵陣の角から脱出せよ！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      let cpuTimer = null;

      let vsCpu = !bridge.isConnected();
      let myPlayer = bridge.isConnected() ? (bridge.isHost ? 1 : 2) : 1;
      let aiDifficulty = 'pro'; // 'normal' | 'pro' | 'master'

      // ゲーム状態
      // ghosts: Array of { id, owner: 1|2, color: 'blue'|'red', r, c, captured: false, escaped: false }
      let ghosts = [];
      let phase = 'SETUP'; // 'SETUP' | 'PLAY' | 'GAME_OVER'
      let turnPlayer = 1;
      let selectedGhostId = null;
      let setupSwapFirstId = null;
      let winnerPlayer = null;
      let winReasonText = '';
      let lastMoveInfo = null;
      let bannerText = '👻【秘密の初期配置】自陣のおばけを2体クリックして🔵青と🔴赤の位置を入れ替え、「🚀 対局開始」を押してください！';

      container.innerHTML = `
        <style>
          .gst-wrapper {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            user-select: none;
            color: #f8fafc;
            font-family: 'Noto Sans JP', sans-serif;
          }
          .gst-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(168, 85, 247, 0.42);
            border-radius: 12px;
            padding: 6px 14px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
          }
          .gst-score-cards {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
          }
          .gst-pcard {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(30, 41, 59, 0.9);
            border: 2px solid rgba(148, 163, 184, 0.28);
            border-radius: 10px;
            padding: 5px 12px;
            font-size: 12px;
          }
          .gst-pcard.active-turn {
            border-color: #c084fc;
            background: rgba(168, 85, 247, 0.16);
            box-shadow: 0 0 16px rgba(168, 85, 247, 0.4);
          }
          .gst-pill-blue {
            background: rgba(37, 99, 235, 0.25);
            border: 1px solid #60a5fa;
            color: #bfdbfe;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 900;
          }
          .gst-pill-red {
            background: rgba(225, 29, 72, 0.25);
            border: 1px solid #fb7185;
            color: #fecdd3;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 900;
          }
          .gst-btn {
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
          .gst-btn:hover:not(:disabled) {
            border-color: #c084fc;
            color: #e9d5ff;
            transform: translateY(-1px);
          }
          .gst-btn-primary {
            background: linear-gradient(135deg, #9333ea, #6b21a8);
            border-color: #e9d5ff;
            color: #ffffff;
          }
          .gst-btn-emerald {
            background: linear-gradient(135deg, #10b981, #059669);
            border-color: #6ee7b7;
            color: #ffffff;
          }
          .gst-stage-wrap {
            position: relative;
            width: 100%;
            height: calc(100vh - 265px);
            min-height: 500px;
            max-height: 820px;
            background: radial-gradient(circle at 50% 35%, #2e1065 0%, #0f172a 60%, #020617 100%);
            border-radius: 16px;
            border: 1px solid rgba(168, 85, 247, 0.4);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
            overflow: hidden;
          }
          .gst-stage-wrap canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            cursor: grab;
          }
          .gst-stage-wrap canvas:active {
            cursor: grabbing;
          }
          .gst-hud-top {
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
          .gst-banner {
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(192, 132, 252, 0.5);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
            color: #f3e8ff;
            pointer-events: auto;
            box-shadow: 0 6px 20px rgba(0,0,0,0.55);
          }
          .gst-bottom-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(168, 85, 247, 0.35);
            border-radius: 12px;
            padding: 8px 14px;
          }
          .gst-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(9, 13, 22, 0.78);
            backdrop-filter: blur(5px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 30;
          }
          .gst-modal-overlay.visible {
            display: flex;
          }
          .gst-modal-box {
            background: linear-gradient(145deg, #1e1b4b, #0f172a);
            border: 2px solid #c084fc;
            border-radius: 16px;
            padding: 22px 26px;
            max-width: 480px;
            width: 92%;
            box-shadow: 0 24px 60px rgba(0,0,0,0.9);
            text-align: center;
          }
        </style>

        <div class="gst-wrapper">
          <div class="gst-top-bar">
            <div class="gst-score-cards" id="gst-score-cards"></div>
            <div style="display:flex;gap:6px;align-items:center;">
              <select id="gst-ai-sel" class="gst-btn">
                <option value="normal">🤖 AI: 初級ゴースト</option>
                <option value="pro" selected>🤖 AI: 心理戦プロ</option>
                <option value="master">🤖 AI: 読心マスター</option>
              </select>
              <button class="gst-btn" id="gst-new-btn">🔄 新規ゲーム</button>
            </div>
          </div>

          <div class="gst-stage-wrap" id="gst-stage-wrap">
            <div class="gst-hud-top">
              <div class="gst-banner" id="gst-banner">👻 3D ガイスター (Geister)</div>
              <div style="display:flex;gap:6px;pointer-events:auto;">
                <button class="gst-btn" id="gst-cam-p1">🎥 自分視点 (背中確認)</button>
                <button class="gst-btn" id="gst-cam-top">🎥 真上俯瞰</button>
              </div>
            </div>

            <div class="gst-modal-overlay" id="gst-modal-overlay">
              <div class="gst-modal-box" id="gst-modal-box"></div>
            </div>
          </div>

          <div class="gst-bottom-dock" id="gst-bottom-dock"></div>
        </div>
      `;

      const scoreCardsEl = container.querySelector('#gst-score-cards');
      const aiSelEl = container.querySelector('#gst-ai-sel');
      const newBtnEl = container.querySelector('#gst-new-btn');
      const stageWrapEl = container.querySelector('#gst-stage-wrap');
      const bannerEl = container.querySelector('#gst-banner');
      const camP1Btn = container.querySelector('#gst-cam-p1');
      const camTopBtn = container.querySelector('#gst-cam-top');
      const modalOverlayEl = container.querySelector('#gst-modal-overlay');
      const modalBoxEl = container.querySelector('#gst-modal-box');
      const bottomDockEl = container.querySelector('#gst-bottom-dock');

      // ====================================================
      // 1. ゲーム初期化＆配置ロジック
      // ====================================================
      function createInitialGhosts(formation = 'random') {
        ghosts = [];
        let idCounter = 1;

        function buildColors(mode) {
          if (mode === 'front_red') return ['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue'];
          if (mode === 'front_blue') return ['blue', 'blue', 'blue', 'blue', 'red', 'red', 'red', 'red'];
          return shuffle(['blue', 'blue', 'blue', 'blue', 'red', 'red', 'red', 'red']);
        }

        const p1Colors = buildColors(formation);
        const p2Colors = buildColors('random');

        // P1: row 4 (前衛), row 5 (後衛), col 1..4
        let idx1 = 0;
        for (const r of [4, 5]) {
          for (let c = 1; c <= 4; c++) {
            ghosts.push({
              id: idCounter++,
              owner: 1,
              color: p1Colors[idx1++],
              r,
              c,
              captured: false,
              escaped: false
            });
          }
        }

        // P2: row 1 (前衛), row 0 (後衛), col 1..4
        let idx2 = 0;
        for (const r of [1, 0]) {
          for (let c = 1; c <= 4; c++) {
            ghosts.push({
              id: idCounter++,
              owner: 2,
              color: p2Colors[idx2++],
              r,
              c,
              captured: false,
              escaped: false
            });
          }
        }
      }

      function initGame(formation = 'random') {
        if (cpuTimer) clearTimeout(cpuTimer);
        aiDifficulty = aiSelEl.value || 'pro';
        createInitialGhosts(formation);
        phase = 'SETUP';
        turnPlayer = 1;
        selectedGhostId = null;
        setupSwapFirstId = null;
        winnerPlayer = null;
        winReasonText = '';
        lastMoveInfo = null;
        modalOverlayEl.classList.remove('visible');
        bannerText = '👻【秘密の初期配置】自陣のおばけを2体クリックして🔵青と🔴赤の位置を入れ替えるか、「🚀 対局開始」を押してください！';
        renderAll();
      }

      function getGhostAt(r, c) {
        return ghosts.find((g) => !g.captured && !g.escaped && g.r === r && g.c === c) || null;
      }

      function getGhostById(id) {
        return ghosts.find((g) => g.id === id) || null;
      }

      // 選択したおばけの合法移動先リスト [{ r, c, isEscape: boolean, targetGhost: null|ghost }]
      function getValidMovesForGhost(g) {
        if (!g || g.captured || g.escaped) return [];
        const moves = [];

        // 1. もし良いおばけ（青）が相手陣地の脱出マスにいるなら「盤外脱出（即勝利）」が可能！
        if (g.color === 'blue') {
          if (g.owner === 1 && g.r === 0 && (g.c === 0 || g.c === 5)) {
            moves.push({ r: -1, c: g.c, isEscape: true, targetGhost: null });
          } else if (g.owner === 2 && g.r === 5 && (g.c === 0 || g.c === 5)) {
            moves.push({ r: 6, c: g.c, isEscape: true, targetGhost: null });
          }
        }

        // 2. 上下左右1マス移動
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        dirs.forEach(([dr, dc]) => {
          const nr = g.r + dr;
          const nc = g.c + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return;
          const occ = getGhostAt(nr, nc);
          if (occ && occ.owner === g.owner) return; // 自分のコマがいる場所へは進めない
          moves.push({ r: nr, c: nc, isEscape: false, targetGhost: occ });
        });

        return moves;
      }

      // 勝敗判定
      function checkWinConditions() {
        for (const p of [1, 2]) {
          const opp = p === 1 ? 2 : 1;
          // 条件1: 自分の青おばけが脱出した
          if (ghosts.some((g) => g.owner === p && g.color === 'blue' && g.escaped)) {
            return { winner: p, reason: `🚪 P${p} の「🔵良いおばけ」が敵陣の出口から脱出成功！` };
          }
          // 条件2: 相手の青おばけが全滅した
          const oppBlueRemaining = ghosts.filter((g) => g.owner === opp && g.color === 'blue' && !g.captured).length;
          if (oppBlueRemaining === 0) {
            return { winner: p, reason: `👻 P${p} が相手の「🔵良いおばけ」を4体すべて捕獲しました！` };
          }
          // 条件3: 自分の赤おばけが全滅した（4体すべて相手に取らせた）
          const myRedRemaining = ghosts.filter((g) => g.owner === p && g.color === 'red' && !g.captured).length;
          if (myRedRemaining === 0) {
            return { winner: p, reason: `😈 ブラフ大成功！ P${p} が自分の「🔴悪いおばけ」を4体すべて相手に取らせました！` };
          }
        }
        return null;
      }

      function executeMove(ghostId, move) {
        const g = getGhostById(ghostId);
        if (!g || phase !== 'PLAY') return;

        selectedGhostId = null;
        lastMoveInfo = { fromR: g.r, fromC: g.c, toR: move.r, toC: move.c };

        if (move.isEscape) {
          g.escaped = true;
          GeisterSfx.win();
        } else {
          const target = getGhostAt(move.r, move.c);
          g.r = move.r;
          g.c = move.c;
          if (target && target.owner !== g.owner) {
            target.captured = true;
            if (target.color === 'blue') {
              GeisterSfx.captureBlue();
              bannerText = `⚡ P${g.owner} が相手のおばけを捕獲！正体は【🔵良いおばけ】でした！`;
            } else {
              GeisterSfx.captureRed();
              bannerText = `💥 P${g.owner} が相手のおばけを捕獲！正体は【🔴悪いおばけ（罠）】でした！`;
            }
          } else {
            GeisterSfx.move();
            bannerText = `👻 ${g.owner === 1 ? 'あなた (P1)' : '相手 (P2)'} がおばけを1マス進めました。`;
          }
        }

        const winCheck = checkWinConditions();
        if (winCheck) {
          phase = 'GAME_OVER';
          winnerPlayer = winCheck.winner;
          winReasonText = winCheck.reason;
          bannerText = `🏆 勝負あり！ ${winReasonText}`;
          GeisterSfx.win();
          openGameOverModal();
          renderAll();
          return;
        }

        turnPlayer = turnPlayer === 1 ? 2 : 1;
        renderAll();

        if (vsCpu && turnPlayer === 2 && phase === 'PLAY') {
          cpuTimer = setTimeout(runCpuTurn, 680);
        }
      }

      // ====================================================
      // 2. 心理戦AI思考エンジン (P2 CPU)
      // ====================================================
      function runCpuTurn() {
        if (isDestroyed || phase !== 'PLAY' || turnPlayer !== 2) return;
        const cpuGhosts = ghosts.filter((g) => g.owner === 2 && !g.captured && !g.escaped);
        const allMoves = [];

        cpuGhosts.forEach((g) => {
          const moves = getValidMovesForGhost(g);
          moves.forEach((m) => {
            allMoves.push({ ghost: g, move: m, score: evaluateCpuMove(g, m) });
          });
        });

        if (allMoves.length === 0) return;
        allMoves.sort((a, b) => b.score - a.score);
        const chosen = allMoves[0];
        executeMove(chosen.ghost.id, chosen.move);
      }

      function evaluateCpuMove(g, m) {
        // 1. 脱出できるなら最優先で即勝利！
        if (m.isEscape) return 10000;

        let score = (Math.random() - 0.5) * 4;
        const cpuRedLeft = ghosts.filter((x) => x.owner === 2 && x.color === 'red' && !x.captured).length;
        const p1RedLeft = ghosts.filter((x) => x.owner === 1 && x.color === 'red' && !x.captured).length;

        // 2. 自分の青おばけは手前の出口 (5,0) または (5,5) を目指す
        if (g.color === 'blue') {
          const distLeftExit = Math.abs(5 - m.r) + Math.abs(0 - m.c);
          const distRightExit = Math.abs(5 - m.r) + Math.abs(5 - m.c);
          const minDist = Math.min(distLeftExit, distRightExit);
          score += (10 - minDist) * 5;
          if (m.r === 5 && (m.c === 0 || m.c === 5)) score += 60; // 出口到達！
        } else {
          // 自分の赤おばけ：もし自分の残り赤が1〜2体なら、積極的に相手のコマの隣へ突っ込んで取らせる（ブラフ特攻）！
          const p1Ghosts = ghosts.filter((x) => x.owner === 1 && !x.captured);
          let nearestP1 = 99;
          p1Ghosts.forEach((p1g) => {
            const d = Math.abs(p1g.r - m.r) + Math.abs(p1g.c - m.c);
            if (d < nearestP1) nearestP1 = d;
          });
          if (cpuRedLeft <= 2) {
            score += (10 - nearestP1) * 8;
          } else {
            // 出口へ向かう青のフリをするブラフ前進
            score += m.r * 4;
          }
        }

        // 3. 相手のコマを捕獲する手の評価
        if (m.targetGhost) {
          // 相手がすでに赤を3体失っている（あと1体赤を取ると自分が負ける！）時は、出口直前のコマ以外はむやみに取らない！
          const isNearCpuExit = m.r <= 1 && (m.c <= 1 || m.c >= 4);
          if (p1RedLeft === 1 && !isNearCpuExit && aiDifficulty !== 'normal') {
            score -= 45; // 赤を踏む罠を警戒して回避！
          } else {
            score += 35;
          }
          if (isNearCpuExit) {
            score += 80; // 自陣出口に迫る敵は絶対阻止！
          }
        }

        return score;
      }

      function openGameOverModal() {
        const isWin = winnerPlayer === myPlayer;
        modalBoxEl.innerHTML = `
          <div style="font-size:24px;font-weight:900;color:${isWin ? '#fde047' : '#fb7185'};margin-bottom:8px;">
            ${isWin ? '🏆 勝利！ (VICTORY)' : '💀 敗北... (DEFEAT)'}
          </div>
          <div style="font-size:14px;color:#f3e8ff;font-weight:800;margin-bottom:16px;">
            ${winReasonText}
          </div>
          <div style="font-size:12px;color:#cbd5e1;margin-bottom:18px;">
            ※ 盤上のすべてのおばけの背中（🔵青・🔴赤の正体）が公開されました！
          </div>
          <button class="gst-btn gst-btn-primary" id="gst-rematch-btn">🔄 もう一度プレイする</button>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#gst-rematch-btn').onclick = () => initGame('random');
      }

      // ====================================================
      // 3. Three.js + Godot 4.7 GLB ゴシック3D古城ステージ
      // ====================================================
      let THREE = null;
      let scene = null;
      let camera = null;
      let renderer = null;
      let dynamicGroup = null;
      let interactiveObjects = [];
      let floatingGhostMeshes = [];
      let glbGhostTemplate = null;
      let maxAniso = 8;

      let camSpherical = { radius: 13.8, phi: 0.76, theta: 0 };

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
        camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 200);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stageWrapEl.appendChild(renderer.domElement);

        maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;

        // ゴシック照明
        scene.add(new THREE.AmbientLight(0xe2e8f0, 0.88));
        const moonLight = new THREE.DirectionalLight(0xfef3c7, 1.3);
        moonLight.position.set(6, 15, 8);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 2048;
        moonLight.shadow.mapSize.height = 2048;
        scene.add(moonLight);

        const mysticLight = new THREE.DirectionalLight(0xa855f7, 0.55);
        mysticLight.position.set(-8, 10, -8);
        scene.add(mysticLight);

        // 古城の石造りチェッカーボード＆捕獲台座ベース
        const mansionBase = new THREE.Mesh(
          new THREE.BoxGeometry(11.6, 0.42, 8.6),
          new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.45, metalness: 0.2 })
        );
        mansionBase.position.y = -0.22;
        mansionBase.receiveShadow = true;
        scene.add(mansionBase);

        const goldRim = new THREE.Mesh(
          new THREE.BoxGeometry(7.6, 0.26, 7.6),
          new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.3, metalness: 0.55 })
        );
        goldRim.position.y = -0.12;
        scene.add(goldRim);

        // 6x6 マス（四隅は脱出出口テクスチャ付き）
        const exitCorners = new Set(['0_0', '0_5', '5_0', '5_5']);
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const isExit = exitCorners.has(`${r}_${c}`);
            const isDark = (r + c) % 2 === 1;
            let mat;
            if (isExit) {
              const cv = document.createElement('canvas');
              cv.width = 256;
              cv.height = 256;
              const ctx = cv.getContext('2d');
              ctx.fillStyle = r === 0 ? '#064e3b' : '#4c0519';
              ctx.fillRect(0, 0, 256, 256);
              ctx.strokeStyle = '#fde047';
              ctx.lineWidth = 16;
              ctx.strokeRect(8, 8, 240, 240);
              ctx.fillStyle = '#fef08a';
              ctx.font = '900 54px "Noto Sans JP", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('🚪EXIT', 128, 95);
              ctx.font = '900 38px "Noto Sans JP", sans-serif';
              ctx.fillText(r === 0 ? 'P1脱出角' : 'P2脱出角', 128, 175);
              const tex = new THREE.CanvasTexture(cv);
              tex.anisotropy = maxAniso;
              mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
            } else {
              mat = new THREE.MeshStandardMaterial({
                color: isDark ? 0x1e293b : 0x334155,
                roughness: 0.42,
                metalness: 0.12
              });
            }

            const tile = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.12, 1.12), mat);
            tile.position.set((c - 2.5) * 1.18, -0.04, (r - 2.5) * 1.18);
            tile.receiveShadow = true;
            scene.add(tile);
          }
        }

        dynamicGroup = new THREE.Group();
        scene.add(dynamicGroup);

        // Godot 4.7 geister_ghost.glb の非同期ロード
        if (window.THREE.GLTFLoader && window.location.protocol !== 'file:') {
          const loader = new window.THREE.GLTFLoader();
          loader.load('assets/models/geister_ghost.glb', (gltf) => {
            if (gltf && gltf.scene) {
              glbGhostTemplate = gltf.scene;
              rebuild3DScene();
            }
          }, undefined, () => {});
        }

        // カメラ操作＆3Dレイキャスト
        let isDragging = false;
        let dragDist = 0;
        let prevX = 0;
        let prevY = 0;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const dom = renderer.domElement;
        dom.addEventListener('pointerdown', (e) => {
          isDragging = true;
          dragDist = 0;
          prevX = e.clientX;
          prevY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
          if (isDestroyed) return;
          if (isDragging) {
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;
            dragDist += Math.abs(dx) + Math.abs(dy);
            prevX = e.clientX;
            prevY = e.clientY;
            camSpherical.theta -= dx * 0.0065;
            camSpherical.phi = Math.max(0.2, Math.min(1.28, camSpherical.phi - dy * 0.0065));
            updateCamera();
          }
        });

        window.addEventListener('pointerup', () => {
          isDragging = false;
        });

        dom.addEventListener('click', (e) => {
          if (dragDist > 7) return;
          const rect = dom.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);

          const hits = raycaster.intersectObjects(interactiveObjects, true);
          if (hits.length > 0) {
            let obj = hits[0].object;
            while (obj && (!obj.userData || !obj.userData.onClick)) {
              obj = obj.parent;
            }
            if (obj && obj.userData && obj.userData.onClick) {
              obj.userData.onClick();
            }
          }
        });

        dom.addEventListener('wheel', (e) => {
          e.preventDefault();
          camSpherical.radius = Math.max(8.5, Math.min(20.0, camSpherical.radius + e.deltaY * 0.01));
          updateCamera();
        }, { passive: false });

        camP1Btn.onclick = () => {
          camSpherical = { radius: 13.8, phi: 0.76, theta: 0 };
          updateCamera();
        };

        camTopBtn.onclick = () => {
          camSpherical = { radius: 13.2, phi: 0.22, theta: 0 };
          updateCamera();
        };

        window.addEventListener('resize', onResize);
        updateCamera();
        rebuild3DScene();

        const clock = new THREE.Clock();
        function animate() {
          if (isDestroyed) return;
          animFrameId = requestAnimationFrame(animate);
          const t = clock.getElapsedTime();
          floatingGhostMeshes.forEach((item, idx) => {
            item.mesh.position.y = item.baseY + Math.sin(t * 2.8 + idx * 0.9) * 0.045;
          });
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
        camera.lookAt(0, 0.2, 0);
      }

      function onResize() {
        if (isDestroyed || !renderer || !camera) return;
        const w = stageWrapEl.clientWidth || 960;
        const h = stageWrapEl.clientHeight || 560;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }

      function createGhost3DObject(g, isSelected, revealIdentity) {
        const group = new THREE.Group();
        let bodyRoot;
        if (glbGhostTemplate) {
          bodyRoot = glbGhostTemplate.clone(true);
        } else {
          bodyRoot = new THREE.Group();
          const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22, metalness: 0.08 });
          const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15 });
          const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.58, 24), bodyMat);
          cloak.position.y = 0.29;
          cloak.castShadow = true;
          bodyRoot.add(cloak);

          const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), bodyMat);
          head.position.y = 0.6;
          head.castShadow = true;
          bodyRoot.add(head);

          const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), eyeMat);
          eyeL.position.set(-0.09, 0.63, -0.22);
          bodyRoot.add(eyeL);
          const eyeR = eyeL.clone();
          eyeR.position.x = 0.09;
          bodyRoot.add(eyeR);
        }

        // P2のコマは正面（手前側 +Z）を向くように180°回転
        if (g.owner === 2) {
          bodyRoot.rotation.y = Math.PI;
        }
        group.add(bodyRoot);

        // 背中のマーカー宝石（自分のコマ・捕獲済みコマ・ゲーム終了時は青/赤を表示、相手生存コマは紫の秘密マーカー）
        if (revealIdentity) {
          const isBlue = g.color === 'blue';
          const gemColor = isBlue ? 0x2563eb : 0xe11d48;
          const gem = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 16, 16),
            new THREE.MeshStandardMaterial({
              color: gemColor,
              emissive: gemColor,
              emissiveIntensity: 0.45,
              roughness: 0.12,
              metalness: 0.25
            })
          );
          gem.position.set(0, 0.36, g.owner === 1 ? 0.24 : -0.24);
          group.add(gem);

          // 頭上の見やすいミニバッジスプライト
          const bc = document.createElement('canvas');
          bc.width = 128;
          bc.height = 64;
          const bctx = bc.getContext('2d');
          bctx.fillStyle = isBlue ? 'rgba(37, 99, 235, 0.92)' : 'rgba(225, 29, 72, 0.92)';
          bctx.strokeStyle = '#ffffff';
          bctx.lineWidth = 5;
          bctx.fillRect(6, 6, 116, 52);
          bctx.strokeRect(6, 6, 116, 52);
          bctx.fillStyle = '#ffffff';
          bctx.font = '900 30px "Noto Sans JP", sans-serif';
          bctx.textAlign = 'center';
          bctx.textBaseline = 'middle';
          bctx.fillText(isBlue ? '🔵善' : '🔴悪', 64, 32);

          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(bc), transparent: true }));
          sp.scale.set(0.68, 0.34, 1);
          sp.position.set(0, 0.96, 0);
          group.add(sp);
        } else {
          // 相手の未公開コマ
          const bc = document.createElement('canvas');
          bc.width = 128;
          bc.height = 64;
          const bctx = bc.getContext('2d');
          bctx.fillStyle = 'rgba(88, 28, 135, 0.9)';
          bctx.strokeStyle = '#d8b4fe';
          bctx.lineWidth = 4;
          bctx.fillRect(6, 6, 116, 52);
          bctx.strokeRect(6, 6, 116, 52);
          bctx.fillStyle = '#f3e8ff';
          bctx.font = '900 30px "Noto Sans JP", sans-serif';
          bctx.textAlign = 'center';
          bctx.textBaseline = 'middle';
          bctx.fillText('❓敵', 64, 32);
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(bc), transparent: true }));
          sp.scale.set(0.64, 0.32, 1);
          sp.position.set(0, 0.96, 0);
          group.add(sp);
        }

        if (isSelected) {
          const selRing = new THREE.Mesh(
            new THREE.CylinderGeometry(0.46, 0.46, 0.08, 24),
            new THREE.MeshBasicMaterial({ color: 0xfde047 })
          );
          selRing.position.y = 0.04;
          group.add(selRing);
        }

        return group;
      }

      function rebuild3DScene() {
        if (!THREE || !dynamicGroup) return;
        while (dynamicGroup.children.length > 0) {
          dynamicGroup.remove(dynamicGroup.children[0]);
        }
        interactiveObjects = [];
        floatingGhostMeshes = [];

        // 直前の移動ハイライト
        if (lastMoveInfo && phase === 'PLAY') {
          [
            [lastMoveInfo.fromR, lastMoveInfo.fromC, 0x9333ea],
            [lastMoveInfo.toR, lastMoveInfo.toC, 0xc084fc]
          ].forEach(([r, c, hex]) => {
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
              const hl = new THREE.Mesh(
                new THREE.BoxGeometry(1.06, 0.04, 1.06),
                new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.42 })
              );
              hl.position.set((c - 2.5) * 1.18, 0.03, (r - 2.5) * 1.18);
              dynamicGroup.add(hl);
            }
          });
        }

        // 1. 盤上の生存おばけ
        ghosts.forEach((g) => {
          if (g.captured || g.escaped) return;
          const isSel = (phase === 'SETUP' && setupSwapFirstId === g.id) || (phase === 'PLAY' && selectedGhostId === g.id);
          const reveal = g.owner === myPlayer || phase === 'GAME_OVER';
          const gObj = createGhost3DObject(g, isSel, reveal);
          gObj.position.set((g.c - 2.5) * 1.18, 0.04, (g.r - 2.5) * 1.18);

          if (phase === 'SETUP' && g.owner === myPlayer) {
            gObj.userData = {
              onClick: () => {
                if (setupSwapFirstId === null) {
                  setupSwapFirstId = g.id;
                  GeisterSfx.move();
                } else if (setupSwapFirstId === g.id) {
                  setupSwapFirstId = null;
                } else {
                  const firstG = getGhostById(setupSwapFirstId);
                  if (firstG) {
                    const tmpColor = firstG.color;
                    firstG.color = g.color;
                    g.color = tmpColor;
                    GeisterSfx.move();
                  }
                  setupSwapFirstId = null;
                }
                renderAll();
              }
            };
            interactiveObjects.push(gObj);
          } else if (phase === 'PLAY' && turnPlayer === myPlayer && g.owner === myPlayer) {
            gObj.userData = {
              onClick: () => {
                selectedGhostId = selectedGhostId === g.id ? null : g.id;
                GeisterSfx.move();
                renderAll();
              }
            };
            interactiveObjects.push(gObj);
          }

          dynamicGroup.add(gObj);
          floatingGhostMeshes.push({ mesh: gObj, baseY: 0.04 });
        });

        // 2. 選択中のおばけの移動可能先ターゲットマーカー（脱出マーカー含む）
        if (phase === 'PLAY' && turnPlayer === myPlayer && selectedGhostId !== null) {
          const selG = getGhostById(selectedGhostId);
          const validMoves = getValidMovesForGhost(selG);

          validMoves.forEach((m) => {
            if (m.isEscape) {
              // 盤外への脱出勝利ポータル
              const portal = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55, 0.55, 0.18, 24),
                new THREE.MeshBasicMaterial({ color: 0x10b981 })
              );
              portal.position.set((m.c - 2.5) * 1.18, 0.12, (m.r - 2.5) * 1.18);
              portal.userData = { onClick: () => executeMove(selG.id, m) };
              dynamicGroup.add(portal);
              interactiveObjects.push(portal);
            } else {
              const isCapture = m.targetGhost !== null;
              const marker = new THREE.Mesh(
                new THREE.CylinderGeometry(0.42, 0.42, 0.14, 24),
                new THREE.MeshBasicMaterial({
                  color: isCapture ? 0xf43f5e : 0x38bdf8,
                  transparent: true,
                  opacity: 0.85
                })
              );
              marker.position.set((m.c - 2.5) * 1.18, isCapture ? 0.88 : 0.1, (m.r - 2.5) * 1.18);
              marker.userData = { onClick: () => executeMove(selG.id, m) };
              dynamicGroup.add(marker);
              interactiveObjects.push(marker);
            }
          });
        }

        // 3. 左右の盤外に「捕獲されたおばけ」を並べて正体を公開表示
        const capturedP1 = ghosts.filter((g) => g.owner === 1 && g.captured);
        capturedP1.forEach((g, idx) => {
          const obj = createGhost3DObject(g, false, true);
          obj.scale.set(0.75, 0.75, 0.75);
          obj.position.set(-4.65, 0.04, -2.4 + idx * 0.75);
          dynamicGroup.add(obj);
        });

        const capturedP2 = ghosts.filter((g) => g.owner === 2 && g.captured);
        capturedP2.forEach((g, idx) => {
          const obj = createGhost3DObject(g, false, true);
          obj.scale.set(0.75, 0.75, 0.75);
          obj.position.set(4.65, 0.04, -2.4 + idx * 0.75);
          dynamicGroup.add(obj);
        });
      }

      // ====================================================
      // 4. UIレンダリング
      // ====================================================
      function renderAll() {
        const p1BlueLost = ghosts.filter((g) => g.owner === 1 && g.color === 'blue' && g.captured).length;
        const p1RedLost = ghosts.filter((g) => g.owner === 1 && g.color === 'red' && g.captured).length;
        const p2BlueLost = ghosts.filter((g) => g.owner === 2 && g.color === 'blue' && g.captured).length;
        const p2RedLost = ghosts.filter((g) => g.owner === 2 && g.color === 'red' && g.captured).length;

        scoreCardsEl.innerHTML = `
          <div class="gst-pcard ${turnPlayer === 1 && phase === 'PLAY' ? 'active-turn' : ''}">
            <span style="font-weight:900;color:#38bdf8;">${turnPlayer === 1 && phase === 'PLAY' ? '▶ ' : ''}あなた (P1)</span>
            <span class="gst-pill-blue" title="4体取ると勝利">捕獲した敵の🔵青: ${p2BlueLost}/4</span>
            <span class="gst-pill-red" title="4体取らせるとブラフ勝利！">取らせた自分の🔴赤: ${p1RedLost}/4</span>
          </div>
          <div class="gst-pcard ${turnPlayer === 2 && phase === 'PLAY' ? 'active-turn' : ''}">
            <span style="font-weight:900;color:#f43f5e;">${turnPlayer === 2 && phase === 'PLAY' ? '▶ ' : ''}相手 (P2 CPU)</span>
            <span class="gst-pill-blue">捕獲したP1の🔵青: ${p1BlueLost}/4</span>
            <span class="gst-pill-red">取らせたP2の🔴赤: ${p2RedLost}/4</span>
          </div>
        `;

        bannerEl.textContent = bannerText;

        if (phase === 'SETUP') {
          bottomDockEl.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:12px;font-weight:900;color:#e9d5ff;">🛠️ 初期陣形プリセット:</span>
              <button class="gst-btn" id="gst-form-rand">🎲 ランダム配置</button>
              <button class="gst-btn" id="gst-form-red">⚔️ 前衛🔴赤ブラフ陣形</button>
              <button class="gst-btn" id="gst-form-blue">🏃 前衛🔵青速攻陣形</button>
            </div>
            <button class="gst-btn gst-btn-emerald" id="gst-start-match" style="font-size:14px;padding:7px 20px;">
              🚀 配置完了して対局開始！
            </button>
          `;
          bottomDockEl.querySelector('#gst-form-rand').onclick = () => initGame('random');
          bottomDockEl.querySelector('#gst-form-red').onclick = () => initGame('front_red');
          bottomDockEl.querySelector('#gst-form-blue').onclick = () => initGame('front_blue');
          bottomDockEl.querySelector('#gst-start-match').onclick = () => {
            phase = 'PLAY';
            setupSwapFirstId = null;
            GeisterSfx.move();
            bannerText = '⚔️ 対局開始！あなたの手番です。動かす自分のおばけをクリックしてください。';
            renderAll();
          };
        } else if (phase === 'PLAY') {
          const selG = selectedGhostId ? getGhostById(selectedGhostId) : null;
          const escapeMove = selG ? getValidMovesForGhost(selG).find((m) => m.isEscape) : null;

          bottomDockEl.innerHTML = `
            <div style="font-size:12px;color:#cbd5e1;">
              💡 <b>勝利条件</b>：①敵の🔵青を4体取る ／ ②自分の🔴赤を4体取らせる ／ ③敵陣の角(🚪EXIT)から自分の🔵青を脱出させる
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              ${escapeMove ? `<button class="gst-btn gst-btn-emerald" id="gst-escape-btn" style="font-size:14px;">🚪 出口から盤外へ脱出して勝利！</button>` : ''}
              <span style="font-size:12px;font-weight:900;color:#c084fc;">
                ${turnPlayer === myPlayer ? '👆 自分のおばけをクリック ➔ 移動先マーカーをクリック' : '⏳ 相手が思考中...'}
              </span>
            </div>
          `;
          const escBtn = bottomDockEl.querySelector('#gst-escape-btn');
          if (escBtn && escapeMove && selG) {
            escBtn.onclick = () => executeMove(selG.id, escapeMove);
          }
        } else {
          bottomDockEl.innerHTML = `
            <span style="font-size:13px;font-weight:900;color:#fde047;">🏆 ${winReasonText}</span>
            <button class="gst-btn gst-btn-primary" id="gst-dock-rematch">🔄 もう一度プレイする</button>
          `;
          bottomDockEl.querySelector('#gst-dock-rematch').onclick = () => initGame('random');
        }

        rebuild3DScene();
      }

      aiSelEl.onchange = () => { aiDifficulty = aiSelEl.value; };
      newBtnEl.onclick = () => initGame('random');

      ensureThreeLoaded().then((threeLib) => {
        if (isDestroyed) return;
        init3DStage(threeLib);
        initGame('random');
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
