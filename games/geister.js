/**
 * ガイスター (Geister) 2人
 * 背中に青 (良いおばけ) と赤 (悪いおばけ) の印を隠した8体のおばけで戦う読み合いのゲーム。
 *
 * - 公式ルール: 6×6 の盤。自分の青を敵陣の角から盤外へ出す、相手の青を4体取る、
 *   自分の赤を4体すべて取らせる、のいずれかで勝ち。駒は上下左右に1マス動き、相手の駒に重なると取る。
 * - 配置: 自陣の2体を選ぶと位置を入れ替えられる。並びの型 (ランダム・赤を前・青を前) も選べる
 * - CPU は青を出口へ急がせ、赤が減ると相手に取らせに行く。出口に迫る駒は優先して取る
 * - 卓は共通エンジン (arena-3d-engine.js) のステージに、寄木の盤とおばけの駒を置いて描く
 */

(function () {
  const BOARD_SIZE = 6;
  const UI_FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic UI", sans-serif';

  // Web Audio サウンド
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

  // ====================================================
  // 盤の印刷面 (canvas)
  // ====================================================
  // 盤は 7×7 (マス 1.0 × 6 と縁 0.5)。canvas の上が奥 (相手側)。
  function paintBoard(ctx, w, h) {
    const B3D = window.BoardArena3D;
    const unit = w / 7;
    const rng = B3D.mulberry32(4242);

    // 縁
    B3D.canvas.paintWood(ctx, 0, 0, w, h, B3D.WOODS.darkWalnut, 31, false);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, w, h);

    // 寄木のマス
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = unit * (0.5 + c);
        const y = unit * (0.5 + r);
        const vertical = (r + c) % 2 === 0;
        B3D.canvas.paintWood(ctx, x, y, unit, unit, B3D.WOODS.oak, 100 + r * 7 + c, vertical);
        ctx.fillStyle = vertical ? 'rgba(255, 236, 205, 0.06)' : 'rgba(30, 16, 6, 0.1)';
        ctx.fillRect(x, y, unit, unit);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.02 + rng() * 0.06})`;
        ctx.fillRect(x, y, unit, unit);
      }
    }

    // 古い屋敷の床らしく、全体を少し沈んだ色に
    ctx.fillStyle = 'rgba(64, 34, 14, 0.24)';
    ctx.fillRect(unit * 0.5, unit * 0.5, unit * 6, unit * 6);

    // 溝
    ctx.lineWidth = 3;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      const p = unit * (0.5 + i);
      ctx.strokeStyle = 'rgba(18, 10, 4, 0.7)';
      ctx.beginPath();
      ctx.moveTo(p, unit * 0.5);
      ctx.lineTo(p, h - unit * 0.5);
      ctx.moveTo(unit * 0.5, p);
      ctx.lineTo(w - unit * 0.5, p);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 238, 210, 0.12)';
    for (let i = 0; i <= BOARD_SIZE; i++) {
      const p = unit * (0.5 + i) + 2;
      ctx.beginPath();
      ctx.moveTo(p, unit * 0.5);
      ctx.lineTo(p, h - unit * 0.5);
      ctx.moveTo(unit * 0.5, p);
      ctx.lineTo(w - unit * 0.5, p);
      ctx.stroke();
    }

    // 真鍮の縁取り
    ctx.strokeStyle = 'rgba(201, 166, 96, 0.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(unit * 0.32, unit * 0.32, w - unit * 0.64, h - unit * 0.64);
    ctx.lineWidth = 1;
    ctx.strokeRect(unit * 0.4, unit * 0.4, w - unit * 0.8, h - unit * 0.8);

    // 初期配置の枠 (中央4列×2段)
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(240, 226, 196, 0.32)';
    ctx.lineWidth = 2;
    [[0, 1], [4, 5]].forEach(([r0]) => {
      ctx.strokeRect(unit * 1.5 + 8, unit * (0.5 + r0) + 8, unit * 4 - 16, unit * 2 - 16);
    });
    ctx.setLineDash([]);

    // 四隅の出口 (盤の外を指す矢印)
    [[0, 0], [0, 5], [5, 0], [5, 5]].forEach(([r, c]) => {
      const cx = unit * (1 + c);
      const cy = unit * (1 + r);
      const dx = c === 0 ? -1 : 1;
      const dy = r === 0 ? -1 : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = 'rgba(232, 208, 150, 0.85)';
      const s = unit * 0.3;
      for (let k = 0; k < 2; k++) {
        const o = k * s * 0.55 - s * 0.1;
        ctx.beginPath();
        ctx.moveTo(o - s * 0.35, -s * 0.5);
        ctx.lineTo(o + s * 0.15, 0);
        ctx.lineTo(o - s * 0.35, s * 0.5);
        ctx.lineTo(o - s * 0.5, s * 0.35);
        ctx.lineTo(o - s * 0.15, 0);
        ctx.lineTo(o - s * 0.5, -s * 0.35);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(232, 208, 150, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, unit * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(232, 208, 150, 0.55)';
    ctx.font = `500 ${Math.round(unit * 0.15)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [[0, 0], [0, 5], [5, 0], [5, 5]].forEach(([r, c]) => {
      ctx.fillText('出口', unit * (1 + c), unit * (r === 0 ? 0.25 : 6.75));
    });
  }

  // 出口の矢印 (盤外の脱出先に置く)
  function arrowShape(THREE) {
    const s = new THREE.Shape();
    s.moveTo(-0.18, -0.2);
    s.lineTo(0.12, -0.2);
    s.lineTo(0.12, -0.32);
    s.lineTo(0.36, 0);
    s.lineTo(0.12, 0.32);
    s.lineTo(0.12, 0.2);
    s.lineTo(-0.18, 0.2);
    s.closePath();
    return s;
  }

  window.BoardArena.registerGame({
    id: 'geister',
    name: 'ガイスター',
    icon: '',
    category: 'ブラフ',
    minPlayers: 2,
    maxPlayers: 2,
    description: '背中に青と赤の印を隠した8体のおばけで戦う2人用の読み合い。青を出口から逃がすか、相手の青を4体取るか、赤を4体取らせれば勝ち。',

    mount(container, bridge) {
      let isDestroyed = false;
      let cpuTimer = null;

      let vsCpu = !bridge.isConnected();
      let myPlayer = bridge.isConnected() ? (bridge.isHost ? 1 : 2) : 1;
      let aiDifficulty = 'pro'; // 'normal' | 'pro' | 'master'

      // ゲーム状態
      // ghosts: { id, owner: 1|2, color: 'blue'|'red', r, c, captured, escaped }
      let ghosts = [];
      let phase = 'SETUP'; // 'SETUP' | 'PLAY' | 'GAME_OVER'
      let turnPlayer = 1;
      let selectedGhostId = null;
      let setupSwapFirstId = null;
      let winnerPlayer = null;
      let winReasonText = '';
      let lastMoveInfo = null;
      let gameSerial = 0;
      let bannerText = '';

      const nameOf = (p) => (p === myPlayer ? 'あなた' : (vsCpu ? 'CPU' : '相手'));

      container.innerHTML = `
        <style>
          .gst-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: var(--text);
            font-family: var(--font-ui);
          }
          .gst-top-bar, .gst-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px 16px;
            padding: 10px 12px;
            background: var(--bg-raised);
            border: 1px solid var(--line);
            border-radius: 6px;
          }
          .gst-players-row { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 420px; min-width: 0; }
          .gst-player {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px 7px 10px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 4px;
            transition: border-color 0.25s, background 0.25s;
          }
          .gst-player.is-turn { border-color: rgba(226, 184, 103, 0.6); background: rgba(226, 184, 103, 0.07); }
          .gst-swatch { flex: none; width: 12px; height: 12px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35); }
          .gst-player-name { font-size: 13px; font-weight: 700; white-space: nowrap; }
          .gst-player-sub { display: flex; gap: 12px; margin-top: 3px; font-size: 11px; color: var(--text-3); white-space: nowrap; }
          .gst-track { display: inline-flex; align-items: center; gap: 3px; }
          .gst-track span { margin-right: 3px; }
          .gst-track i { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--t); opacity: 0.8; }
          .gst-track i.on { background: var(--t); opacity: 1; }
          .gst-controls, .gst-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .gst-actions { justify-content: flex-end; }
          .gst-btn, .gst-select {
            appearance: none;
            -webkit-appearance: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid var(--line-strong);
            border-radius: 4px;
            color: var(--text-2);
            font: 500 12px/1.4 var(--font-ui);
            letter-spacing: 0.04em;
            white-space: nowrap;
            cursor: pointer;
            transition: color 0.2s, border-color 0.2s, background 0.2s;
          }
          .gst-select {
            padding-right: 28px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a8a6a0' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
          }
          .gst-select option { background: #161618; color: #ecebe6; }
          .gst-btn:hover:not(:disabled), .gst-select:hover { color: var(--text); border-color: rgba(255, 255, 255, 0.34); }
          .gst-btn:disabled { opacity: 0.35; cursor: not-allowed; }
          .gst-btn.is-primary { background: var(--text); border-color: var(--text); color: var(--text-inverse); font-weight: 700; }
          .gst-btn.is-primary:hover:not(:disabled) { background: #fff; color: var(--text-inverse); }
          .gst-btn.is-active { border-color: rgba(226, 184, 103, 0.7); color: #e2b867; }

          .gst-stage-wrap { position: relative; }
          .gst-stage-wrap .ba3d-stage {
            height: clamp(440px, calc(100vh - 290px), 860px);
            background: radial-gradient(90% 80% at 50% 40%, #241d24 0%, #120e12 60%, #070507 100%);
          }
          .gst-status {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 5;
            max-width: min(500px, calc(100% - 130px));
            padding: 9px 13px;
            background: rgba(14, 12, 11, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #ecebe6;
            pointer-events: none;
          }
          .gst-phase { font-size: 10px; letter-spacing: 0.14em; color: rgba(236, 235, 230, 0.55); }
          .gst-announce { margin-top: 3px; font-size: 13px; line-height: 1.55; }

          .gst-dock-info { display: flex; flex-direction: column; gap: 4px; flex: 1 1 360px; min-width: 0; }
          .gst-dock-label { font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
          .gst-rules { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--text-2); }
          .gst-rules b { font-weight: 700; color: var(--text); }
          .gst-wait { font-size: 12px; color: var(--text-3); }
          .gst-prompt { font-size: 12px; color: #e2b867; }

          .ba3d-label.gst-tray { padding: 0; background: none; color: rgba(236, 235, 230, 0.58); font-size: 11px; letter-spacing: 0.08em; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); }

          .gst-modal-overlay {
            position: absolute;
            inset: 0;
            z-index: 20;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(8, 7, 6, 0.55);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
          }
          .gst-modal-overlay.visible { display: flex; }
          .gst-modal-box {
            width: min(420px, 100%);
            padding: 24px;
            text-align: center;
            background: var(--bg-raised);
            border: 1px solid var(--line-strong);
            border-radius: 6px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          }
          .gst-modal-title { font-size: 19px; font-weight: 700; }
          .gst-modal-desc { margin-top: 8px; font-size: 13px; line-height: 1.7; color: var(--text-2); }
          .gst-modal-actions { display: flex; gap: 6px; justify-content: center; margin-top: 18px; }

          @media (max-width: 640px) {
            .gst-stage-wrap .ba3d-stage { height: min(64vh, 480px); }
            .gst-status { max-width: calc(100% - 110px); }
            .gst-announce { font-size: 12px; }
          }
        </style>

        <div class="gst-wrapper">
          <div class="gst-top-bar">
            <div class="gst-players-row" id="gst-players-row"></div>
            <div class="gst-controls">
              <select id="gst-ai-sel" class="gst-select" aria-label="CPU の強さ">
                <option value="normal">CPU: やさしい</option>
                <option value="pro" selected>CPU: ふつう</option>
                <option value="master">CPU: つよい</option>
              </select>
              <button class="gst-btn" id="gst-new-btn">新しいゲーム</button>
            </div>
          </div>

          <div class="gst-stage-wrap" id="gst-stage-wrap">
            <div class="gst-status">
              <div class="gst-phase" id="gst-phase"></div>
              <div class="gst-announce" id="gst-announce"></div>
            </div>
            <div class="gst-modal-overlay" id="gst-modal-overlay">
              <div class="gst-modal-box" id="gst-modal-box"></div>
            </div>
          </div>

          <div class="gst-dock" id="gst-dock"></div>
        </div>
      `;

      const playersRowEl = container.querySelector('#gst-players-row');
      const aiSelEl = container.querySelector('#gst-ai-sel');
      const newBtnEl = container.querySelector('#gst-new-btn');
      const stageWrapEl = container.querySelector('#gst-stage-wrap');
      const phaseEl = container.querySelector('#gst-phase');
      const announceEl = container.querySelector('#gst-announce');
      const modalOverlayEl = container.querySelector('#gst-modal-overlay');
      const modalBoxEl = container.querySelector('#gst-modal-box');
      const dockEl = container.querySelector('#gst-dock');

      // ====================================================
      // 1. 初期配置
      // ====================================================
      function createInitialGhosts(formation = 'random') {
        ghosts = [];
        let idCounter = 1;

        function buildColors(mode) {
          if (mode === 'front_red') return ['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue'];
          if (mode === 'front_blue') return ['blue', 'blue', 'blue', 'blue', 'red', 'red', 'red', 'red'];
          return shuffle(['blue', 'blue', 'blue', 'blue', 'red', 'red', 'red', 'red']);
        }

        const p1Colors = buildColors(myPlayer === 1 ? formation : 'random');
        const p2Colors = buildColors(myPlayer === 2 ? formation : 'random');

        // P1: 前列 row 4、後列 row 5 (手前側)
        let idx1 = 0;
        for (const r of [4, 5]) {
          for (let c = 1; c <= 4; c++) {
            ghosts.push({ id: idCounter++, owner: 1, color: p1Colors[idx1++], r, c, captured: false, escaped: false });
          }
        }
        // P2: 前列 row 1、後列 row 0 (奥側)
        let idx2 = 0;
        for (const r of [1, 0]) {
          for (let c = 1; c <= 4; c++) {
            ghosts.push({ id: idCounter++, owner: 2, color: p2Colors[idx2++], r, c, captured: false, escaped: false });
          }
        }
      }

      function initGame(formation = 'random', keepSerial = false) {
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
        if (!keepSerial) gameSerial++;
        modalOverlayEl.classList.remove('visible');
        bannerText = '配置を決めます。自分のおばけを2体選ぶと位置が入れ替わります。背中の印が青なら良いおばけ、赤なら悪いおばけです。';
        renderAll();
      }

      function getGhostAt(r, c) {
        return ghosts.find((g) => !g.captured && !g.escaped && g.r === r && g.c === c) || null;
      }

      function getGhostById(id) {
        return ghosts.find((g) => g.id === id) || null;
      }

      // 合法手 [{ r, c, isEscape, targetGhost }]
      function getValidMovesForGhost(g) {
        if (!g || g.captured || g.escaped) return [];
        const moves = [];

        // 敵陣の角にいる青は盤外へ出られる
        if (g.color === 'blue') {
          if (g.owner === 1 && g.r === 0 && (g.c === 0 || g.c === 5)) {
            moves.push({ r: -1, c: g.c, isEscape: true, targetGhost: null });
          } else if (g.owner === 2 && g.r === 5 && (g.c === 0 || g.c === 5)) {
            moves.push({ r: 6, c: g.c, isEscape: true, targetGhost: null });
          }
        }

        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
          const nr = g.r + dr;
          const nc = g.c + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return;
          const occ = getGhostAt(nr, nc);
          if (occ && occ.owner === g.owner) return;
          moves.push({ r: nr, c: nc, isEscape: false, targetGhost: occ });
        });

        return moves;
      }

      function checkWinConditions() {
        for (const p of [1, 2]) {
          const opp = p === 1 ? 2 : 1;
          if (ghosts.some((g) => g.owner === p && g.color === 'blue' && g.escaped)) {
            return { winner: p, reason: `${nameOf(p)}の青いおばけが出口から抜け出しました。` };
          }
          const oppBlueRemaining = ghosts.filter((g) => g.owner === opp && g.color === 'blue' && !g.captured).length;
          if (oppBlueRemaining === 0) {
            return { winner: p, reason: `${nameOf(p)}が相手の青いおばけを4体すべて取りました。` };
          }
          const myRedRemaining = ghosts.filter((g) => g.owner === p && g.color === 'red' && !g.captured).length;
          if (myRedRemaining === 0) {
            return { winner: p, reason: `${nameOf(p)}の赤いおばけが4体すべて取られました。` };
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
              bannerText = `${nameOf(g.owner)}がおばけを取りました。正体は青（良いおばけ）でした。`;
            } else {
              GeisterSfx.captureRed();
              bannerText = `${nameOf(g.owner)}がおばけを取りました。正体は赤（悪いおばけ）でした。`;
            }
          } else {
            GeisterSfx.move();
            bannerText = `${nameOf(g.owner)}がおばけを1マス動かしました。`;
          }
        }

        const winCheck = checkWinConditions();
        if (winCheck) {
          phase = 'GAME_OVER';
          winnerPlayer = winCheck.winner;
          winReasonText = winCheck.reason;
          bannerText = winReasonText;
          GeisterSfx.win();
          renderAll();
          // 正体が明かされる様子を見せてから結果を出す
          cpuTimer = setTimeout(openGameOverModal, 1300);
          return;
        }

        turnPlayer = turnPlayer === 1 ? 2 : 1;
        renderAll();

        if (vsCpu && turnPlayer !== myPlayer && phase === 'PLAY') {
          cpuTimer = setTimeout(runCpuTurn, 900);
        }
      }

      // ====================================================
      // 2. CPU (相手側)
      // ====================================================
      function runCpuTurn() {
        const cpuSide = myPlayer === 1 ? 2 : 1;
        if (isDestroyed || phase !== 'PLAY' || turnPlayer !== cpuSide) return;
        const cpuGhosts = ghosts.filter((g) => g.owner === cpuSide && !g.captured && !g.escaped);
        const allMoves = [];
        cpuGhosts.forEach((g) => {
          getValidMovesForGhost(g).forEach((m) => {
            allMoves.push({ ghost: g, move: m, score: evaluateCpuMove(g, m) });
          });
        });
        if (allMoves.length === 0) return;
        allMoves.sort((a, b) => b.score - a.score);
        executeMove(allMoves[0].ghost.id, allMoves[0].move);
      }

      function evaluateCpuMove(g, m) {
        if (m.isEscape) return 10000;

        const me = g.owner;
        const opp = me === 1 ? 2 : 1;
        const goalRow = me === 2 ? 5 : 0;   // CPU の脱出口がある段
        const homeRow = me === 2 ? 0 : 5;   // CPU 自陣の段
        let score = (Math.random() - 0.5) * 4;
        const cpuRedLeft = ghosts.filter((x) => x.owner === me && x.color === 'red' && !x.captured).length;
        const oppRedLeft = ghosts.filter((x) => x.owner === opp && x.color === 'red' && !x.captured).length;

        if (g.color === 'blue') {
          // 青は出口を目指す
          const minDist = Math.min(Math.abs(goalRow - m.r) + m.c, Math.abs(goalRow - m.r) + Math.abs(5 - m.c));
          score += (10 - minDist) * 5;
          if (m.r === goalRow && (m.c === 0 || m.c === 5)) score += 60;
        } else {
          // 赤: 残りが少なければ相手の近くへ寄って取らせる。多いうちは青のふりをして前進
          let nearest = 99;
          ghosts.filter((x) => x.owner === opp && !x.captured && !x.escaped).forEach((x) => {
            nearest = Math.min(nearest, Math.abs(x.r - m.r) + Math.abs(x.c - m.c));
          });
          if (cpuRedLeft <= 2) score += (10 - nearest) * 8;
          else score += Math.abs(m.r - homeRow) * 4;
        }

        if (m.targetGhost) {
          // 自陣の出口に迫る駒は必ず取る。相手の赤が残り1体なら、むやみに取らない
          const isNearCpuExit = Math.abs(m.r - homeRow) <= 1 && (m.c <= 1 || m.c >= 4);
          if (oppRedLeft === 1 && !isNearCpuExit && aiDifficulty !== 'normal') score -= 45;
          else score += 35;
          if (isNearCpuExit) score += 80;
        }
        return score;
      }

      function openGameOverModal() {
        if (isDestroyed || phase !== 'GAME_OVER') return;
        const isWin = winnerPlayer === myPlayer;
        modalBoxEl.innerHTML = `
          <div class="gst-modal-title">${isWin ? 'あなたの勝ちです' : 'あなたの負けです'}</div>
          <p class="gst-modal-desc">${winReasonText}<br>すべてのおばけの正体を公開しました。</p>
          <div class="gst-modal-actions">
            <button class="gst-btn" id="gst-modal-close">盤面を見る</button>
            <button class="gst-btn is-primary" id="gst-rematch-btn">もう一度遊ぶ</button>
          </div>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#gst-modal-close').onclick = () => modalOverlayEl.classList.remove('visible');
        modalBoxEl.querySelector('#gst-rematch-btn').onclick = () => initGame('random');
      }

      // ====================================================
      // 3. 3D の卓
      // ====================================================
      const B3D = window.BoardArena3D;
      const STEP = 1.0;
      const BOARD_W = 7.0;
      const BOARD_T = 0.24;
      const TABLE_Y = -BOARD_T;
      const TRAY_X = 4.75;
      const COLORS = { blue: '#2f6fd0', red: '#c4343f' };
      const BODY = { 1: '#ddd6e6', 2: '#4a3f5c' };

      let THREE = null;
      let st = null;
      let picker = null;
      const view = {
        gameKey: -1,
        pieces: null,
        objs: new Map(), // ghost id -> obj
        moveMarks: null,
        lastMarks: null,
        hoverMark: null,
        escapeMark: null,
        glow: null,
        labels: []
      };

      const cellPos = (r, c) => ({ x: (c - 2.5) * STEP, z: (r - 2.5) * STEP });

      function isMyTurnToMove() {
        return phase === 'PLAY' && turnPlayer === myPlayer && !(vsCpu && turnPlayer !== myPlayer);
      }

      // ---- 盤 ----
      function buildBoard() {
        const body = new THREE.Mesh(st.geo.slab(BOARD_W, BOARD_W, BOARD_T, { bevel: 0.035, radius: 0.12 }), st.kit.wood('darkWalnut', { repeat: 0.14, clearcoat: 0.4 }));
        body.position.y = -BOARD_T / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        st.root.add(body);

        const c = B3D.canvas.cached('gst-board', 1400, 1400, paintBoard);
        const top = new THREE.Mesh(
          new THREE.PlaneGeometry(BOARD_W - 0.07, BOARD_W - 0.07).rotateX(-Math.PI / 2),
          new THREE.MeshPhysicalMaterial({
            map: st.kit.texture(c),
            roughness: 0.5,
            clearcoat: 0.35,
            clearcoatRoughness: 0.35,
            envMapIntensity: 0.55
          })
        );
        top.position.y = 0.001;
        top.receiveShadow = true;
        st.root.add(top);

        // 取ったおばけを置くフェルト
        [-1, 1].forEach((side) => {
          const pad = new THREE.Mesh(st.geo.slab(1.5, 4.4, 0.03, { bevel: 0.01, radius: 0.12 }), st.kit.felt(side > 0 ? '#2a2333' : '#2b2526', { repeat: 0.5 }));
          pad.position.set(side * TRAY_X, TABLE_Y + 0.015, 0);
          pad.receiveShadow = true;
          st.root.add(pad);
        });

        view.pieces = new THREE.Group();
        view.moveMarks = new THREE.Group();
        view.lastMarks = new THREE.Group();
        st.root.add(view.lastMarks, view.moveMarks, view.pieces);

        view.hoverMark = st.markers.square(0.94, '#f4ede1', 0.12);
        view.hoverMark.position.y = 0.004;
        view.hoverMark.visible = false;
        st.root.add(view.hoverMark);

        // 脱出の矢印 (選んだ青が角にいるときだけ出る)
        const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape(THREE), 4).rotateX(-Math.PI / 2), view.glow);
        arrow.renderOrder = 3;
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32).rotateX(-Math.PI / 2), st.kit.invisible());
        view.escapeMark = new THREE.Group();
        view.escapeMark.add(pad, arrow);
        view.escapeMark.visible = false;
        st.root.add(view.escapeMark);
        st.pick(view.escapeMark, {
          enabled: () => view.escapeMark.visible,
          clickable: () => true,
          onClick: () => {
            const g = getGhostById(selectedGhostId);
            const m = g && getValidMovesForGhost(g).find((x) => x.isEscape);
            if (g && m && isMyTurnToMove()) executeMove(g.id, m);
          }
        });

        picker = st.gridPicker({
          rows: BOARD_SIZE,
          cols: BOARD_SIZE,
          step: STEP,
          y: 0.01,
          enabled: () => !modalOverlayEl.classList.contains('visible'),
          clickable: cellClickable,
          onHover: (r, c) => showHover(r, c),
          onLeave: () => { view.hoverMark.visible = false; },
          onClick: handleCell
        });

        const left = st.label(`${nameOf(myPlayer === 1 ? 2 : 1)}が取ったおばけ`, { className: 'gst-tray' });
        left.at(-TRAY_X, TABLE_Y, -2.45);
        const right = st.label('あなたが取ったおばけ', { className: 'gst-tray' });
        right.at(TRAY_X, TABLE_Y, -2.45);
        view.labels.push(left, right);
      }

      // ---- おばけの駒 ----
      function ghostGeometry() {
        return st.geo.cached('gst-ghost', () => {
          const pts = [[0, 0], [0.27, 0], [0.3, 0.03], [0.296, 0.09], [0.274, 0.2], [0.25, 0.32], [0.24, 0.42], [0.229, 0.5], [0.202, 0.585], [0.148, 0.65], [0.078, 0.69], [0, 0.705]];
          const g = st.geo.lathe(pts, 64);
          // 裾を波打たせる
          const pos = g.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            if (y < 0.1 && Math.hypot(x, z) > 0.15) {
              const a = Math.atan2(z, x);
              pos.setY(i, y + 0.045 * (1 - y / 0.1) * (0.5 + 0.5 * Math.cos(a * 7)));
            }
          }
          pos.needsUpdate = true;
          return g;
        });
      }

      const bodyMat = (owner) => st.kit.cached(`gst-body:${owner}`, () => new THREE.MeshPhysicalMaterial({
        color: st.kit.color(BODY[owner]),
        roughness: owner === 1 ? 0.42 : 0.38,
        metalness: 0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
        envMapIntensity: 0.8
      }));
      const eyeMat = () => st.kit.lacquer('#15111a', { roughness: 0.18 });
      const markMat = (color) => st.kit.cached(`gst-mark:${color}`, () => new THREE.MeshPhysicalMaterial({
        color: st.kit.color(COLORS[color]),
        roughness: 0.25,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        emissive: st.kit.color(COLORS[color]),
        emissiveIntensity: 0.12,
        envMapIntensity: 1
      }));

      function makeGhost(g) {
        const obj = new THREE.Group();
        const float = new THREE.Group();
        const orient = new THREE.Group();
        obj.add(float);
        float.add(orient);

        const body = new THREE.Mesh(ghostGeometry(), bodyMat(g.owner));
        body.castShadow = true;
        body.receiveShadow = true;
        orient.add(body);

        // 腕
        [-1, 1].forEach((s) => {
          const arm = new THREE.Mesh(st.geo.cached('gst-arm', () => new THREE.SphereGeometry(1, 20, 14)), bodyMat(g.owner));
          arm.scale.set(0.075, 0.058, 0.07);
          arm.position.set(s * 0.245, 0.36, 0.04);
          arm.rotation.z = s * 0.5;
          arm.castShadow = true;
          orient.add(arm);
        });
        // 目 (正面 = +z)
        [-1, 1].forEach((s) => {
          const eye = new THREE.Mesh(st.geo.cached('gst-eye', () => new THREE.SphereGeometry(1, 16, 12)), eyeMat());
          eye.scale.set(0.034, 0.05, 0.02);
          eye.position.set(s * 0.075, 0.5, 0.214);
          orient.add(eye);
        });
        // 背中の印 (正面の反対側)
        const mark = new THREE.Mesh(st.geo.cached('gst-mark', () => new THREE.SphereGeometry(1, 28, 18)), markMat(g.color));
        mark.scale.set(0.096, 0.096, 0.04);
        mark.position.set(0, 0.42, -0.224);
        mark.rotation.x = 0.18;
        mark.visible = false;
        orient.add(mark);

        // 選択の輪
        const ring = new THREE.Mesh(st.geo.cached('gst-sel-ring', () => new THREE.RingGeometry(0.36, 0.43, 48).rotateX(-Math.PI / 2)), view.glow);
        ring.position.y = 0.006;
        ring.renderOrder = 3;
        ring.visible = false;
        obj.add(ring);
        const shadow = st.markers.contact(0.9, 0.9, 0.5);
        shadow.position.y = 0.003;
        obj.add(shadow);

        obj.userData = { id: g.id, float, orient, mark, ring, shadow, color: g.color, lift: 0, phase: Math.random() * Math.PI * 2 };
        view.pieces.add(obj);

        st.pick(obj, {
          enabled: () => {
            const gg = getGhostById(g.id);
            return !!gg && !gg.captured && !gg.escaped && !modalOverlayEl.classList.contains('visible');
          },
          clickable: () => {
            const gg = getGhostById(g.id);
            return !!gg && cellClickable(gg.r, gg.c);
          },
          onHover: () => {
            const gg = getGhostById(g.id);
            if (gg) showHover(gg.r, gg.c);
          },
          onLeave: () => { view.hoverMark.visible = false; },
          onClick: () => {
            const gg = getGhostById(g.id);
            if (gg) handleCell(gg.r, gg.c);
          }
        });
        return obj;
      }

      // ---- 操作 ----
      function cellClickable(r, c) {
        const g = getGhostAt(r, c);
        if (phase === 'SETUP') return !!g && g.owner === myPlayer;
        if (!isMyTurnToMove()) return false;
        if (g && g.owner === myPlayer) return true;
        const sel = getGhostById(selectedGhostId);
        return !!sel && getValidMovesForGhost(sel).some((m) => !m.isEscape && m.r === r && m.c === c);
      }

      function handleCell(r, c) {
        if (!cellClickable(r, c)) return;
        const g = getGhostAt(r, c);
        if (phase === 'SETUP') {
          if (setupSwapFirstId === null) {
            setupSwapFirstId = g.id;
          } else if (setupSwapFirstId === g.id) {
            setupSwapFirstId = null;
          } else {
            // 2体の位置を入れ替える
            const first = getGhostById(setupSwapFirstId);
            if (first) {
              const fr = first.r;
              const fc = first.c;
              first.r = g.r;
              first.c = g.c;
              g.r = fr;
              g.c = fc;
            }
            setupSwapFirstId = null;
          }
          GeisterSfx.move();
          renderAll();
          return;
        }
        if (g && g.owner === myPlayer) {
          selectedGhostId = selectedGhostId === g.id ? null : g.id;
          GeisterSfx.move();
          renderAll();
          return;
        }
        const sel = getGhostById(selectedGhostId);
        const m = sel && getValidMovesForGhost(sel).find((x) => !x.isEscape && x.r === r && x.c === c);
        if (m) executeMove(sel.id, m);
      }

      function showHover(r, c) {
        if (!cellClickable(r, c)) {
          view.hoverMark.visible = false;
          return;
        }
        const p = cellPos(r, c);
        view.hoverMark.position.set(p.x, 0.004, p.z);
        view.hoverMark.visible = true;
      }

      // ---- 同期 ----
      function trayPos(g) {
        // 取った側の脇に、色ごとの列で並べる
        const capturer = g.owner === 1 ? 2 : 1;
        const side = capturer === myPlayer ? 1 : -1;
        const sameKind = ghosts.filter((x) => x.captured && x.owner === g.owner && x.color === g.color);
        const k = Math.max(0, sameKind.indexOf(g));
        const col = g.color === 'blue' ? -0.33 : 0.33;
        return { x: side * TRAY_X + col * side, y: TABLE_Y + 0.03, z: -1.5 + k * 0.82 };
      }

      function escapePos(g) {
        const c = g.c === 0 ? -1 : 1;
        const r = g.r <= 0 ? -1 : 1;
        return { x: c * 3.08, y: 0, z: r * 3.08 };
      }

      function resetPieces() {
        view.gameKey = gameSerial;
        st.clearGroup(view.pieces);
        view.objs.clear();
        ghosts.forEach((g, i) => {
          const obj = makeGhost(g);
          const p = cellPos(g.r, g.c);
          obj.position.set(p.x, 1.6, p.z);
          obj.userData.home = { x: p.x, y: 0, z: p.z };
          st.animate(obj, { position: { x: p.x, y: 0, z: p.z } }, { duration: 520, delay: 120 + i * 45, ease: 'outBounce' });
          view.objs.set(g.id, obj);
        });
      }

      function syncPieces() {
        ghosts.forEach((g) => {
          const obj = view.objs.get(g.id);
          if (!obj) return;
          const u = obj.userData;
          const revealed = g.owner === myPlayer || g.captured || g.escaped || phase === 'GAME_OVER';

          // 印の色 (並びの型を変えたとき)
          if (u.color !== g.color) {
            u.color = g.color;
            u.mark.material = markMat(g.color);
            st.animate(u.orient, { rotation: { y: u.orient.rotation.y + Math.PI * 2 } }, { duration: 520, ease: 'inOutCubic' });
          }
          u.mark.visible = revealed;

          // 向き: 盤上では相手の方を向く。取られた駒と決着後の相手の駒は、こちらに背中の印を見せる
          const facesAway = g.owner === 1 ? myPlayer === 1 : myPlayer === 2;
          let yaw = facesAway ? Math.PI : 0;
          if (g.captured || (phase === 'GAME_OVER' && g.owner !== myPlayer)) yaw = Math.PI;
          if (myPlayer === 2) yaw += Math.PI;
          const curYaw = u.orient.userData.yaw ?? null;
          if (curYaw === null) {
            u.orient.rotation.y = yaw;
          } else if (Math.abs(curYaw - yaw) > 0.001) {
            st.animate(u.orient, { rotation: { y: u.orient.rotation.y + (yaw - curYaw) } }, { duration: 620, delay: g.captured ? 380 : 0, ease: 'inOutCubic' });
          }
          u.orient.userData.yaw = yaw;

          // 位置
          let to;
          let arc = 0.28;
          let scale = 1;
          if (g.captured) {
            to = trayPos(g);
            arc = 1.4;
            scale = 0.82;
          } else if (g.escaped) {
            to = escapePos(g);
            arc = 0.9;
          } else {
            const p = cellPos(g.r, g.c);
            to = { x: p.x, y: 0, z: p.z };
            if (phase === 'SETUP') arc = 0.6;
          }
          const h = u.home;
          if (!h || Math.abs(h.x - to.x) > 1e-4 || Math.abs(h.z - to.z) > 1e-4 || Math.abs(h.y - to.y) > 1e-4) {
            u.home = to;
            st.animate(obj, { position: to, scale }, { duration: g.captured ? 760 : 460, delay: g.captured ? 180 : 0, arc, ease: 'inOutCubic' });
          }
          u.shadow.visible = !g.captured;

          // 選択
          const sel = (phase === 'SETUP' && setupSwapFirstId === g.id) || (phase === 'PLAY' && selectedGhostId === g.id);
          u.ring.visible = sel;
          u.lift = sel ? 0.16 : 0;
        });
      }

      function syncMarks() {
        st.clearGroup(view.moveMarks);
        st.clearGroup(view.lastMarks);
        view.escapeMark.visible = false;

        if (lastMoveInfo && phase !== 'SETUP') {
          [[lastMoveInfo.fromR, lastMoveInfo.fromC, 0.07], [lastMoveInfo.toR, lastMoveInfo.toC, 0.14]].forEach(([r, c, o]) => {
            if (r < 0 || r >= BOARD_SIZE) return;
            const m = st.markers.square(0.96, '#e2b867', o);
            const p = cellPos(r, c);
            m.position.set(p.x, 0.003, p.z);
            view.lastMarks.add(m);
          });
        }

        const sel = isMyTurnToMove() ? getGhostById(selectedGhostId) : null;
        if (!sel) return;
        getValidMovesForGhost(sel).forEach((m) => {
          if (m.isEscape) {
            const pos = escapePos(sel);
            const ang = Math.atan2(pos.z, pos.x);
            view.escapeMark.position.set(pos.x, 0.012, pos.z);
            view.escapeMark.rotation.y = -ang;
            view.escapeMark.visible = true;
            return;
          }
          const p = cellPos(m.r, m.c);
          const mk = m.targetGhost ? st.markers.ring(0.38, 0.45, '#d9705f', 0.85) : st.markers.dot(0.12, '#f4ede1', 0.55);
          mk.position.set(p.x, 0.008, p.z);
          view.moveMarks.add(mk);
        });
      }

      function syncTable() {
        if (!st) return;
        if (view.gameKey !== gameSerial) resetPieces();
        syncPieces();
        syncMarks();
        st.refreshHover();
      }

      function initStage(threeLib) {
        THREE = threeLib;
        st = B3D.createStage(THREE, stageWrapEl, {
          embed: true,
          radius: 11.8,
          phi: 0.7,
          theta: myPlayer === 2 ? Math.PI : 0,
          extent: 6,
          tableY: TABLE_Y,
          tableWood: 'darkWalnut',
          minRadius: 6.5,
          maxRadius: 20,
          maxPhi: 1.2,
          keyIntensity: 1.7,
          onFrame(now) {
            if (view.glow) view.glow.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(now / 260));
            // おばけはゆっくり漂う
            view.objs.forEach((obj) => {
              const u = obj.userData;
              const gg = getGhostById(u.id);
              const still = gg && gg.captured;
              const bob = still ? 0 : Math.sin(now / 700 + u.phase) * 0.025 + 0.02;
              u.float.position.y += (u.lift + bob - u.float.position.y) * 0.18;
            });
          }
        });
        view.glow = st.kit.cached('gst-glow', () => new THREE.MeshBasicMaterial({
          color: st.kit.color('#e2b867'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false
        }));
        buildBoard();
        B3D.current = st;
        syncTable();
      }

      // ====================================================
      // 4. 操作パネル
      // ====================================================
      function track(label, color, n) {
        return `<span class="gst-track" style="--t:${color}"><span>${label}</span>${[0, 1, 2, 3].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
      }

      function renderAll() {
        const opp = myPlayer === 1 ? 2 : 1;
        const lost = (owner, color) => ghosts.filter((g) => g.owner === owner && g.color === color && g.captured).length;

        playersRowEl.innerHTML = [myPlayer, opp].map((p) => {
          const other = p === 1 ? 2 : 1;
          const isTurn = turnPlayer === p && phase === 'PLAY';
          return `
            <div class="gst-player ${isTurn ? 'is-turn' : ''}">
              <span class="gst-swatch" style="--c:${BODY[p]}"></span>
              <div>
                <div class="gst-player-name">${nameOf(p)}</div>
                <div class="gst-player-sub">
                  <span title="相手の青を4体取ると勝ち">${track('取った青', COLORS.blue, lost(other, 'blue'))}</span>
                  <span title="自分の赤を4体取らせると勝ち">${track('取らせた赤', COLORS.red, lost(p, 'red'))}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');

        phaseEl.textContent = phase === 'SETUP' ? '配置' : phase === 'PLAY' ? `${nameOf(turnPlayer)}の手番` : '決着';
        announceEl.textContent = bannerText;

        if (phase === 'SETUP') {
          dockEl.innerHTML = `
            <div class="gst-dock-info">
              <span class="gst-dock-label">並びの型</span>
              <div class="gst-controls">
                <button class="gst-btn" data-form="random">ランダム</button>
                <button class="gst-btn" data-form="front_red">赤を前に</button>
                <button class="gst-btn" data-form="front_blue">青を前に</button>
              </div>
            </div>
            <div class="gst-actions">
              <button class="gst-btn is-primary" id="gst-start-match">この配置で始める</button>
            </div>
          `;
          dockEl.querySelectorAll('[data-form]').forEach((b) => {
            b.onclick = () => initGame(b.getAttribute('data-form'), true);
          });
          dockEl.querySelector('#gst-start-match').onclick = () => {
            phase = 'PLAY';
            setupSwapFirstId = null;
            GeisterSfx.move();
            bannerText = turnPlayer === myPlayer ? 'あなたの手番です。動かすおばけを選んでください。' : `${nameOf(turnPlayer)}の手番です。`;
            renderAll();
            if (vsCpu && turnPlayer !== myPlayer) cpuTimer = setTimeout(runCpuTurn, 900);
          };
        } else if (phase === 'PLAY') {
          const selG = selectedGhostId ? getGhostById(selectedGhostId) : null;
          const escapeMove = selG ? getValidMovesForGhost(selG).find((m) => m.isEscape) : null;
          const mine = isMyTurnToMove();
          dockEl.innerHTML = `
            <div class="gst-dock-info">
              <span class="gst-dock-label">勝ち方</span>
              <div class="gst-rules">
                <span><b>脱出</b> 青を敵陣の角から外へ出す</span>
                <span><b>青を取る</b> 相手の青を4体取る</span>
                <span><b>赤を取らせる</b> 自分の赤を4体取らせる</span>
              </div>
            </div>
            <div class="gst-actions">
              ${escapeMove && mine ? '<button class="gst-btn is-primary" id="gst-escape-btn">出口から抜け出す</button>' : ''}
              ${mine
                ? `<span class="gst-prompt">${selG ? '動かす先を選んでください' : '動かすおばけを選んでください'}</span>`
                : `<span class="gst-wait">${nameOf(turnPlayer)}が考えています</span>`}
            </div>
          `;
          const escBtn = dockEl.querySelector('#gst-escape-btn');
          if (escBtn) escBtn.onclick = () => executeMove(selG.id, escapeMove);
        } else {
          dockEl.innerHTML = `
            <div class="gst-dock-info">
              <span class="gst-dock-label">${winnerPlayer === myPlayer ? 'あなたの勝ち' : 'あなたの負け'}</span>
              <span class="gst-announce" style="margin:0">${winReasonText}</span>
            </div>
            <div class="gst-actions">
              <button class="gst-btn is-primary" id="gst-dock-rematch">もう一度遊ぶ</button>
            </div>
          `;
          dockEl.querySelector('#gst-dock-rematch').onclick = () => initGame('random');
        }

        syncTable();
      }

      aiSelEl.onchange = () => { aiDifficulty = aiSelEl.value; };
      newBtnEl.onclick = () => initGame('random');

      initGame('random');
      B3D.ensureThree().then((threeLib) => {
        if (isDestroyed || !threeLib) return;
        initStage(threeLib);
      });

      return () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
        if (st) {
          if (B3D.current === st) B3D.current = null;
          st.destroy();
          st = null;
        }
      };
    }
  });
})();
