/**
 * ゴブレット ゴブラーズ (Gobblet Gobblers) 2人
 * 大・中・小のコマで遊ぶ三目並べ。大きいコマは小さいコマにかぶせて乗っ取れる。
 *
 * - 公式ルール: 手番には手持ちのコマを置くか、盤上の自分のコマ (いちばん上) を動かす。
 *   動かしたことで下にいた相手のコマの列が現れたら、相手の勝ち。
 * - CPU (つよい) は自分の手のあとに相手がすぐ勝てる手を避ける。ふつうは少しぶれる
 * - オンライン対戦では手を相手に送る
 * - 卓は共通エンジン (arena-3d-engine.js) のステージに、木の格子と樹脂のゴブラーを置いて描く
 */

(function () {
  const P1 = 1; // オレンジ (あなた / ホスト)
  const P2 = 2; // ブルー (CPU / 相手 / ゲスト)

  const SIZES = {
    1: { name: '小', radius: 0.42, height: 0.72, lift: 1.7 },
    2: { name: '中', radius: 0.62, height: 1.02, lift: 1.95 },
    3: { name: '大', radius: 0.82, height: 1.34, lift: 2.2 }
  };

  const COLORS = { [P1]: '#e07a2e', [P2]: '#2f78c4' };
  const COLOR_NAMES = { [P1]: 'オレンジ', [P2]: 'ブルー' };

  const WIN_LINES = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]]
  ];

  // Web Audio 効果音
  function createGobbletSfx() {
    let ctx = null;
    function ensure() {
      if (!ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(freq, dur, type = 'sine', gain = 0.08, delay = 0, endFreq = null) {
      if (localStorage.getItem('ba_sfx_enabled') === 'false') return;
      const c = ensure();
      if (!c) return;
      try {
        const t0 = c.currentTime + delay;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur);
      } catch (e) {}
    }
    return {
      select() {
        tone(520, 0.09, 'sine', 0.08, 0, 780);
      },
      place() {
        tone(260, 0.08, 'triangle', 0.11, 0, 140);
        tone(420, 0.05, 'sine', 0.06, 0.03);
      },
      gobble() {
        tone(620, 0.14, 'sawtooth', 0.08, 0, 180);
        tone(160, 0.12, 'triangle', 0.14, 0.09, 95);
      },
      win() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.08));
      },
      lose() {
        [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, 0.24, 'sawtooth', 0.07, i * 0.09));
      }
    };
  }

  window.BoardArena.registerGame({
    id: 'gobblet',
    name: 'ゴブレット ゴブラーズ',
    category: '三目並べ',
    icon: '',
    players: '1〜2人',
    playTime: '3-5分',
    description: '大・中・小のコマで遊ぶ三目並べ。大きいコマは小さいコマにかぶせて乗っ取れる。隠れたコマを覚えておく読み合い。',

    mount(container, bridge) {
      let isDestroyed = false;
      let cpuTimer = null;
      const sfx = createGobbletSfx();

      // board[r][c] は { id, player, size } の積み重ね (末尾がいちばん上)
      let board = [
        [[], [], []],
        [[], [], []],
        [[], [], []]
      ];
      // 手持ち: benchPieces[player] = 6個 (大2・中2・小2)
      let benchPieces = { [P1]: [], [P2]: [] };

      let currentTurn = P1;
      let isGameOver = false;
      let winningLineCoords = null;
      let winnerPlayer = null;
      let resultSub = '';
      let vsCpu = !bridge.isConnected();
      let cpuHard = true;
      let myPlayer = bridge.isHost ? P1 : P2;
      let gameSerial = 0;

      // 選んでいるコマ: { type: 'hand', player, size, pieceId } / { type: 'board', r, c, player, size, pieceId }
      let selectedPiece = null;

      container.innerHTML = `
        <style>
          .gob-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: var(--text);
            font-family: var(--font-ui);
          }
          .gob-top-bar, .gob-dock {
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
          .gob-players-row { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 380px; min-width: 0; }
          .gob-player {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px 7px 10px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 4px;
            transition: border-color 0.25s, background 0.25s;
          }
          .gob-player.is-turn { border-color: rgba(226, 184, 103, 0.6); background: rgba(226, 184, 103, 0.07); }
          .gob-swatch { flex: none; width: 12px; height: 12px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35); }
          .gob-player-name { font-size: 13px; font-weight: 700; white-space: nowrap; }
          .gob-player-sub { display: flex; gap: 10px; margin-top: 2px; font-size: 11px; color: var(--text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
          .gob-controls, .gob-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .gob-actions { justify-content: flex-end; }
          .gob-btn, .gob-select {
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
          .gob-select {
            padding-right: 28px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a8a6a0' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
          }
          .gob-select option { background: #161618; color: #ecebe6; }
          .gob-select:disabled { opacity: 0.5; cursor: default; }
          .gob-btn:hover:not(:disabled), .gob-select:hover:not(:disabled) { color: var(--text); border-color: rgba(255, 255, 255, 0.34); }
          .gob-btn:disabled { opacity: 0.35; cursor: not-allowed; }
          .gob-btn.is-primary { background: var(--text); border-color: var(--text); color: var(--text-inverse); font-weight: 700; }
          .gob-btn.is-primary:hover:not(:disabled) { background: #fff; color: var(--text-inverse); }
          .gob-size {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 6px 11px;
            background: transparent;
            border: 1px solid var(--line-strong);
            border-radius: 4px;
            color: var(--text);
            font: 500 12px/1.3 var(--font-ui);
            font-variant-numeric: tabular-nums;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
          }
          .gob-size i { flex: none; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3); }
          .gob-size small { color: var(--text-3); }
          .gob-size:hover:not(:disabled) { border-color: rgba(226, 184, 103, 0.7); }
          .gob-size.is-selected { border-color: rgba(226, 184, 103, 0.85); background: rgba(226, 184, 103, 0.1); }
          .gob-size:disabled { opacity: 0.35; cursor: default; }

          .gob-stage-wrap { position: relative; }
          .gob-stage-wrap .ba3d-stage { height: clamp(440px, calc(100vh - 290px), 860px); }
          .gob-status {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 5;
            max-width: min(480px, calc(100% - 130px));
            padding: 9px 13px;
            background: rgba(14, 12, 11, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #ecebe6;
            pointer-events: none;
          }
          .gob-phase { font-size: 10px; letter-spacing: 0.14em; color: rgba(236, 235, 230, 0.55); }
          .gob-announce { margin-top: 3px; font-size: 13px; line-height: 1.55; }
          .gob-dock-info { display: flex; flex-direction: column; gap: 3px; flex: 1 1 280px; min-width: 0; }
          .gob-dock-label { font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
          .gob-dock-text { font-size: 13px; color: var(--text); }
          .gob-wait { font-size: 12px; color: var(--text-3); }

          .gob-modal-overlay {
            position: absolute;
            inset: 0;
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(8, 7, 6, 0.5);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
          }
          .gob-modal-overlay.hidden { display: none; }
          .gob-modal-box {
            width: min(400px, 100%);
            padding: 24px;
            text-align: center;
            background: var(--bg-raised);
            border: 1px solid var(--line-strong);
            border-radius: 6px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          }
          .gob-modal-title { font-size: 19px; font-weight: 700; }
          .gob-modal-desc { margin-top: 8px; font-size: 13px; line-height: 1.7; color: var(--text-2); }
          .gob-modal-actions { display: flex; gap: 6px; justify-content: center; margin-top: 18px; }

          @media (max-width: 640px) {
            .gob-stage-wrap .ba3d-stage { height: min(64vh, 480px); }
            .gob-status { max-width: calc(100% - 110px); }
            .gob-announce { font-size: 12px; }
          }
        </style>

        <div class="gob-wrapper">
          <div class="gob-top-bar">
            <div class="gob-players-row" id="gob-players-row"></div>
            <div class="gob-controls">
              <select id="gob-mode-sel" class="gob-select" aria-label="対戦モード">
                <option value="cpu_hard">CPU: つよい</option>
                <option value="cpu_normal">CPU: ふつう</option>
                <option value="local">2人で遊ぶ</option>
              </select>
              <button class="gob-btn" id="gob-new-btn">新しいゲーム</button>
            </div>
          </div>

          <div class="gob-stage-wrap" id="gob-stage-wrap">
            <div class="gob-status">
              <div class="gob-phase" id="gob-phase"></div>
              <div class="gob-announce" id="gob-announce"></div>
            </div>
            <div class="gob-modal-overlay hidden" id="gob-result">
              <div class="gob-modal-box">
                <div class="gob-modal-title" id="gob-res-title"></div>
                <p class="gob-modal-desc" id="gob-res-sub"></p>
                <div class="gob-modal-actions">
                  <button class="gob-btn" id="gob-res-close">盤面を見る</button>
                  <button class="gob-btn is-primary" id="gob-res-again">もう一度遊ぶ</button>
                </div>
              </div>
            </div>
          </div>

          <div class="gob-dock" id="gob-dock"></div>
        </div>
      `;

      const playersRowEl = container.querySelector('#gob-players-row');
      const modeSelEl = container.querySelector('#gob-mode-sel');
      const newBtnEl = container.querySelector('#gob-new-btn');
      const stageWrapEl = container.querySelector('#gob-stage-wrap');
      const phaseEl = container.querySelector('#gob-phase');
      const announceEl = container.querySelector('#gob-announce');
      const resultEl = container.querySelector('#gob-result');
      const resTitleEl = container.querySelector('#gob-res-title');
      const resSubEl = container.querySelector('#gob-res-sub');
      const dockEl = container.querySelector('#gob-dock');

      function nameOf(player) {
        if (bridge.isConnected()) return player === myPlayer ? 'あなた' : '相手';
        if (vsCpu) return player === P1 ? 'あなた' : 'CPU';
        return COLOR_NAMES[player];
      }

      function isHumanTurn() {
        if (isGameOver) return false;
        const isConnected = bridge.isConnected();
        return (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
      }

      function activePlayer() {
        return bridge.isConnected() ? myPlayer : currentTurn;
      }

      // ====================================================
      // 1. ゲームの進行
      // ====================================================
      function initGame() {
        if (cpuTimer) clearTimeout(cpuTimer);
        board = [
          [[], [], []],
          [[], [], []],
          [[], [], []]
        ];
        selectedPiece = null;
        currentTurn = P1;
        isGameOver = false;
        winningLineCoords = null;
        winnerPlayer = null;
        resultEl.classList.add('hidden');
        benchPieces = { [P1]: [], [P2]: [] };
        [P1, P2].forEach((player) => {
          [3, 3, 2, 2, 1, 1].forEach((size, slotIdx) => {
            benchPieces[player].push({ id: `p${player}_s${size}_${slotIdx}`, player, size, benchSlot: slotIdx, inBench: true });
          });
        });
        gameSerial++;
        renderAll();
      }

      function canPlaceOnCell(r, c, size) {
        const stack = board[r][c];
        if (stack.length === 0) return true;
        return size > stack[stack.length - 1].size;
      }

      // 相手の列も同時に揃ったら相手の勝ち (動かして下のコマが現れた場合)
      function checkWinState(moverPlayer) {
        const opponent = moverPlayer === P1 ? P2 : P1;
        let moverWinLine = null;
        let oppWinLine = null;
        for (const line of WIN_LINES) {
          const [a, b, c] = line;
          const topA = board[a[0]][a[1]].at(-1);
          const topB = board[b[0]][b[1]].at(-1);
          const topC = board[c[0]][c[1]].at(-1);
          if (topA && topB && topC && topA.player === topB.player && topB.player === topC.player) {
            if (topA.player === opponent) oppWinLine = line;
            if (topA.player === moverPlayer) moverWinLine = line;
          }
        }
        if (oppWinLine) return { winner: opponent, line: oppWinLine };
        if (moverWinLine) return { winner: moverPlayer, line: moverWinLine };
        return null;
      }

      function executeMove(moveData, isLocal = false) {
        if (isGameOver) return;
        const { from, to, player } = moveData;
        let movingPiece = null;
        const targetWasOccupied = board[to.r][to.c].length > 0;

        if (from.type === 'hand') {
          if (from.pieceId) movingPiece = benchPieces[player].find((p) => p.id === from.pieceId && p.inBench);
          if (!movingPiece) movingPiece = benchPieces[player].find((p) => p.size === from.size && p.inBench);
          if (!movingPiece) return;
          movingPiece.inBench = false;
        } else if (from.type === 'board') {
          const stack = board[from.r][from.c];
          if (stack.length === 0) return;
          movingPiece = stack.pop();
        }
        if (!movingPiece) return;
        board[to.r][to.c].push(movingPiece);

        if (targetWasOccupied) sfx.gobble();
        else sfx.place();

        if (isLocal && bridge.isConnected()) {
          bridge.send({
            game: 'gobblet',
            type: 'move',
            move: {
              from: { type: from.type, size: movingPiece.size, r: from.r, c: from.c, pieceId: movingPiece.id },
              to: { r: to.r, c: to.c },
              player
            }
          });
        }

        selectedPiece = null;
        view.lastMoved = { id: movingPiece.id, gobble: targetWasOccupied };

        const winInfo = checkWinState(player);
        if (winInfo) {
          isGameOver = true;
          winnerPlayer = winInfo.winner;
          winningLineCoords = winInfo.line;
          const localWinner = bridge.isConnected() ? myPlayer : (vsCpu ? P1 : null);
          if (localWinner === null || winnerPlayer === localWinner) sfx.win();
          else sfx.lose();

          resultSub = winnerPlayer !== player
            ? `${nameOf(player)}がコマを動かしたことで、下にいた${nameOf(winnerPlayer)}のコマの列が現れました。`
            : (targetWasOccupied ? 'かぶせて3つを一列に揃えました。' : '3つのコマが一列に揃いました。');
          resTitleEl.textContent = nameOf(winnerPlayer) === 'あなた' ? 'あなたの勝ちです' : `${nameOf(winnerPlayer)}の勝ちです`;
          resSubEl.textContent = resultSub;
          cpuTimer = setTimeout(() => {
            if (!isDestroyed && isGameOver) resultEl.classList.remove('hidden');
          }, 900);
          if (localWinner !== null && winnerPlayer === localWinner) bridge.recordWin();
        } else {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        renderAll();
        if (vsCpu && currentTurn === P2 && !isGameOver) triggerCpuMove();
      }

      function getHandCounts(player) {
        const counts = { 1: 0, 2: 0, 3: 0 };
        benchPieces[player].forEach((p) => {
          if (p.inBench) counts[p.size]++;
        });
        return counts;
      }

      // ====================================================
      // 2. CPU (1手先まで読んで、相手にすぐ勝たれる手を避ける)
      // ====================================================
      function getAllLegalMoves(player) {
        const moves = [];
        const handCounts = getHandCounts(player);
        [3, 2, 1].forEach((size) => {
          if (handCounts[size] > 0) {
            const benchPiece = benchPieces[player].find((p) => p.inBench && p.size === size);
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                if (canPlaceOnCell(r, c, size)) {
                  moves.push({ from: { type: 'hand', size, pieceId: benchPiece ? benchPiece.id : null }, to: { r, c }, player });
                }
              }
            }
          }
        });
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const top = board[r][c].at(-1);
            if (top && top.player === player) {
              for (let tr = 0; tr < 3; tr++) {
                for (let tc = 0; tc < 3; tc++) {
                  if (r === tr && c === tc) continue;
                  if (canPlaceOnCell(tr, tc, top.size)) {
                    moves.push({ from: { type: 'board', r, c, size: top.size, pieceId: top.id }, to: { r: tr, c: tc }, player });
                  }
                }
              }
            }
          }
        }
        return moves;
      }

      function applyTempMove(m) {
        if (m.from.type === 'hand') {
          board[m.to.r][m.to.c].push({ id: 'temp', player: m.player, size: m.from.size });
        } else {
          board[m.to.r][m.to.c].push(board[m.from.r][m.from.c].pop());
        }
      }

      function revertTempMove(m) {
        if (m.from.type === 'hand') {
          board[m.to.r][m.to.c].pop();
        } else {
          board[m.from.r][m.from.c].push(board[m.to.r][m.to.c].pop());
        }
      }

      function evaluateBoardForCpu() {
        let score = 0;
        for (const line of WIN_LINES) {
          let p2Count = 0;
          let p1Count = 0;
          let p2SizeSum = 0;
          let p1SizeSum = 0;
          for (const [r, c] of line) {
            const top = board[r][c].at(-1);
            if (!top) continue;
            if (top.player === P2) {
              p2Count++;
              p2SizeSum += top.size;
            } else {
              p1Count++;
              p1SizeSum += top.size;
            }
          }
          if (p2Count === 3) return 10000;
          if (p1Count === 3) return -10000;
          if (p2Count === 2 && p1Count === 0) score += 45 + p2SizeSum * 4;
          if (p1Count === 2 && p2Count === 0) score -= 55 + p1SizeSum * 4;
          if (p2Count === 1 && p1Count === 0) score += 8 + p2SizeSum;
          if (p1Count === 1 && p2Count === 0) score -= 8 + p1SizeSum;
        }
        const centerTop = board[1][1].at(-1);
        if (centerTop) score += (centerTop.player === P2 ? 18 : -18) * centerTop.size;
        return score;
      }

      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;
        cpuTimer = setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;
          const legalMoves = getAllLegalMoves(P2);
          if (legalMoves.length === 0) return;

          // 1. すぐ勝てる手
          for (const m of legalMoves) {
            applyTempMove(m);
            const w = checkWinState(P2);
            revertTempMove(m);
            if (w && w.winner === P2) {
              executeMove(m, false);
              return;
            }
          }

          // 2. 自滅する手を除いて評価の高い手
          let bestMove = legalMoves[0];
          let bestScore = -Infinity;
          for (const m of legalMoves) {
            applyTempMove(m);
            const immediateCheck = checkWinState(P2);
            if (immediateCheck && immediateCheck.winner === P1) {
              revertTempMove(m);
              continue;
            }
            let moveScore = evaluateBoardForCpu();
            const stack = board[m.to.r][m.to.c];
            if (stack.length >= 2 && stack[stack.length - 2].player === P1) {
              moveScore += 22 + stack[stack.length - 2].size * 8;
            }
            if (cpuHard) {
              const oppMoves = getAllLegalMoves(P1);
              for (const om of oppMoves) {
                applyTempMove(om);
                const ow = checkWinState(P1);
                revertTempMove(om);
                if (ow && ow.winner === P1) {
                  moveScore -= 5000;
                  break;
                }
              }
            } else {
              moveScore += (Math.random() - 0.5) * 35;
            }
            revertTempMove(m);
            if (moveScore > bestScore) {
              bestScore = moveScore;
              bestMove = m;
            }
          }
          executeMove(bestMove, false);
        }, 700);
      }

      // ====================================================
      // 3. 操作
      // ====================================================
      function findPiece(pieceId) {
        for (const p of [P1, P2]) {
          const b = benchPieces[p].find((x) => x.id === pieceId);
          if (b && b.inBench) return { where: 'bench', piece: b };
        }
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const stack = board[r][c];
            const i = stack.findIndex((x) => x.id === pieceId);
            if (i >= 0) return { where: 'board', piece: stack[i], r, c, isTop: i === stack.length - 1 };
          }
        }
        return null;
      }

      const isSource = (r, c) => selectedPiece && selectedPiece.type === 'board' && selectedPiece.r === r && selectedPiece.c === c;

      function canDropOn(r, c) {
        return !!selectedPiece && !isSource(r, c) && canPlaceOnCell(r, c, selectedPiece.size);
      }

      function cellClickable(r, c) {
        if (!isHumanTurn()) return false;
        const top = board[r][c].at(-1);
        return canDropOn(r, c) || (!!top && top.player === activePlayer());
      }

      function pieceClickable(pieceId) {
        if (!isHumanTurn()) return false;
        const f = findPiece(pieceId);
        if (!f) return false;
        if (f.where === 'bench') return f.piece.player === activePlayer();
        return cellClickable(f.r, f.c);
      }

      function selectHand(player, size, pieceId) {
        if (selectedPiece && selectedPiece.type === 'hand' && selectedPiece.pieceId === pieceId) {
          selectedPiece = null;
        } else {
          selectedPiece = { type: 'hand', player, size, pieceId };
          sfx.select();
        }
        renderAll();
      }

      function handleCell(r, c) {
        if (!isHumanTurn()) return;
        if (canDropOn(r, c)) {
          executeMove({ from: selectedPiece, to: { r, c }, player: activePlayer() }, bridge.isConnected());
          return;
        }
        const top = board[r][c].at(-1);
        if (top && top.player === activePlayer()) {
          if (selectedPiece && selectedPiece.pieceId === top.id) {
            selectedPiece = null;
          } else {
            selectedPiece = { type: 'board', r, c, player: top.player, size: top.size, pieceId: top.id };
            sfx.select();
          }
          renderAll();
        }
      }

      function handlePiece(pieceId) {
        if (!isHumanTurn()) return;
        const f = findPiece(pieceId);
        if (!f) return;
        if (f.where === 'bench') {
          if (f.piece.player === activePlayer()) selectHand(f.piece.player, f.piece.size, f.piece.id);
          return;
        }
        handleCell(f.r, f.c);
      }

      // ====================================================
      // 4. 3D の卓
      // ====================================================
      const B3D = window.BoardArena3D;
      const STEP = 2.0;
      const BENCH_Z = 4.2;

      let THREE = null;
      let st = null;
      let picker = null;
      const view = {
        gameKey: -1,
        objs: new Map(), // piece id -> obj
        marks: null,
        winMarks: null,
        hoverMark: null,
        ghost: null,
        lastMoved: null,
        glow: null
      };

      const cellPos = (r, c) => ({ x: (c - 1) * STEP, z: (r - 1) * STEP });

      // 手持ちの並び (大・大・中・中・小・小)
      const benchX = (() => {
        const radii = [3, 3, 2, 2, 1, 1].map((s) => SIZES[s].radius);
        const xs = [0];
        for (let i = 1; i < radii.length; i++) xs.push(xs[i - 1] + radii[i - 1] + radii[i] + 0.14);
        const mid = (xs[0] - radii[0] + xs[xs.length - 1] + radii[radii.length - 1]) / 2;
        return xs.map((x) => x - mid);
      })();

      function benchPos(player, slot) {
        const near = player === myPlayerSide();
        return { x: near ? benchX[slot] : -benchX[slot], z: near ? BENCH_Z : -BENCH_Z };
      }

      // 手前に来る側 (オンラインのゲストは青が手前)
      function myPlayerSide() {
        return bridge.isConnected() ? myPlayer : P1;
      }

      function bodyGeo(size) {
        return st.geo.cached(`gob-body:${size}`, () => {
          const { radius: R, height: H } = SIZES[size];
          const prof = [[0, 0], [0.95, 0], [1, 0.025], [1, 0.09], [0.94, 0.15], [0.9, 0.3], [0.88, 0.6], [0.84, 0.75], [0.72, 0.87], [0.5, 0.955], [0.26, 0.993], [0, 1]];
          return st.geo.lathe(prof.map(([r, y]) => [r * R, y * H]), 56);
        });
      }

      const bodyMat = (player) => st.kit.cached(`gob-body:${player}`, () => new THREE.MeshPhysicalMaterial({
        color: st.kit.color(COLORS[player]),
        roughness: 0.46,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.75
      }));

      function makePiece(piece) {
        const { radius: R, height: H } = SIZES[piece.size];
        const obj = new THREE.Group();
        const bob = new THREE.Group();
        obj.add(bob);

        const body = new THREE.Mesh(bodyGeo(piece.size), bodyMat(piece.player));
        body.castShadow = true;
        body.receiveShadow = true;
        bob.add(body);

        // 帽子のつまみ
        const knob = new THREE.Mesh(st.geo.cached('gob-sphere', () => new THREE.SphereGeometry(1, 24, 16)), bodyMat(piece.player));
        knob.scale.setScalar(R * 0.15);
        knob.position.y = H * 0.99 + R * 0.08;
        knob.castShadow = true;
        bob.add(knob);

        // 大きな目 (正面 = +z)
        [-1, 1].forEach((s) => {
          const eye = new THREE.Mesh(st.geo.cached('gob-sphere', () => new THREE.SphereGeometry(1, 24, 16)), st.kit.lacquer('#f3efe6', { roughness: 0.25 }));
          eye.scale.setScalar(R * 0.21);
          eye.position.set(s * R * 0.31, H * 0.7, R * 0.72);
          const pupil = new THREE.Mesh(st.geo.cached('gob-sphere', () => new THREE.SphereGeometry(1, 24, 16)), st.kit.lacquer('#151312', { roughness: 0.15 }));
          pupil.scale.setScalar(R * 0.1);
          pupil.position.set(s * R * 0.3, H * 0.7, R * 0.88);
          bob.add(eye, pupil);
        });

        const shadow = st.markers.contact(R * 2.5, R * 2.5, 0.5);
        shadow.position.y = 0.003;
        obj.add(shadow);

        // 向きは少しずつばらつかせる (どれもこちら側を向く)
        const rng = B3D.mulberry32(piece.id.length * 97 + piece.size * 13 + piece.benchSlot * 7 + piece.player);
        obj.userData = { id: piece.id, bob, shadow };
        obj.rotation.y = (rng() - 0.5) * 0.5;
        st.root.add(obj);

        st.pick(obj, {
          enabled: () => !!findPiece(piece.id) && resultEl.classList.contains('hidden'),
          clickable: () => pieceClickable(piece.id),
          onHover: () => {
            const f = findPiece(piece.id);
            if (f && f.where === 'board') showHover(f.r, f.c);
          },
          onLeave: hideHover,
          onClick: () => handlePiece(piece.id)
        });
        return obj;
      }

      function buildTable() {
        // 木の格子 (#)
        const barMat = st.kit.wood('cherry', { repeat: 0.3, clearcoat: 0.45, vertical: false });
        const len = STEP * 3 + 0.3;
        [-1, 1].forEach((s) => {
          const a = new THREE.Mesh(st.geo.cached('gob-bar', () => st.geo.roundedBox(len, 0.18, 0.3, 0.08, 3)), barMat);
          a.position.set(0, 0.09, s * STEP / 2);
          const b = new THREE.Mesh(st.geo.cached('gob-bar', () => st.geo.roundedBox(len, 0.18, 0.3, 0.08, 3)), barMat);
          b.rotation.y = Math.PI / 2;
          b.position.set(s * STEP / 2, 0.095, 0);
          [a, b].forEach((m) => {
            m.castShadow = true;
            m.receiveShadow = true;
            st.root.add(m);
          });
        });

        view.marks = new THREE.Group();
        view.winMarks = new THREE.Group();
        st.root.add(view.winMarks, view.marks);

        view.hoverMark = st.markers.square(STEP * 0.9, '#f4ede1', 0.1);
        view.hoverMark.position.y = 0.004;
        view.hoverMark.visible = false;
        st.root.add(view.hoverMark);

        picker = st.gridPicker({
          rows: 3,
          cols: 3,
          step: STEP,
          y: 0.01,
          enabled: () => resultEl.classList.contains('hidden'),
          clickable: cellClickable,
          onHover: showHover,
          onLeave: hideHover,
          onClick: handleCell
        });
      }

      function showHover(r, c) {
        if (!cellClickable(r, c)) {
          hideHover();
          return;
        }
        const p = cellPos(r, c);
        view.hoverMark.position.set(p.x, 0.004, p.z);
        view.hoverMark.visible = true;
        // 置けるマスには半透明の姿を見せる
        if (canDropOn(r, c)) {
          if (!view.ghost || view.ghost.userData.key !== `${selectedPiece.player}:${selectedPiece.size}`) {
            if (view.ghost) st.removeObject(view.ghost);
            view.ghost = new THREE.Mesh(bodyGeo(selectedPiece.size), st.kit.ghostSolid(COLORS[selectedPiece.player], 0.32));
            view.ghost.userData.key = `${selectedPiece.player}:${selectedPiece.size}`;
            view.ghost.renderOrder = 4;
            st.root.add(view.ghost);
          }
          view.ghost.position.set(p.x, 0.001, p.z);
          view.ghost.visible = true;
        } else if (view.ghost) {
          view.ghost.visible = false;
        }
      }

      function hideHover() {
        view.hoverMark.visible = false;
        if (view.ghost) view.ghost.visible = false;
      }

      // ---- 同期 ----
      function resetPieces() {
        view.gameKey = gameSerial;
        view.objs.forEach((o) => st.removeObject(o));
        view.objs.clear();
        let i = 0;
        [P1, P2].forEach((player) => {
          benchPieces[player].forEach((piece) => {
            const obj = makePiece(piece);
            const p = benchPos(player, piece.benchSlot);
            obj.position.set(p.x, 1.4, p.z);
            obj.userData.home = { x: p.x, y: 0, z: p.z };
            st.animate(obj, { position: { x: p.x, y: 0, z: p.z } }, { duration: 480, delay: 100 + i * 40, ease: 'outBounce' });
            view.objs.set(piece.id, obj);
            i++;
          });
        });
      }

      function syncPieces() {
        const targets = new Map();
        [P1, P2].forEach((player) => {
          benchPieces[player].forEach((piece) => {
            if (!piece.inBench) return;
            const p = benchPos(player, piece.benchSlot);
            targets.set(piece.id, { x: p.x, z: p.z, size: piece.size });
          });
        });
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            board[r][c].forEach((piece) => {
              const p = cellPos(r, c);
              targets.set(piece.id, { x: p.x, z: p.z, size: piece.size });
            });
          }
        }

        targets.forEach((t, id) => {
          const obj = view.objs.get(id);
          if (!obj) return;
          const sel = selectedPiece && selectedPiece.pieceId === id;
          const to = { x: t.x, y: sel ? SIZES[t.size].lift : 0, z: t.z };
          const h = obj.userData.home;
          if (h && Math.abs(h.x - to.x) < 1e-4 && Math.abs(h.y - to.y) < 1e-4 && Math.abs(h.z - to.z) < 1e-4) return;
          const moved = view.lastMoved && view.lastMoved.id === id && (Math.abs(h.x - to.x) > 1e-4 || Math.abs(h.z - to.z) > 1e-4);
          obj.userData.home = to;
          if (moved) {
            // 持ち上げた位置から弧を描いて、上からかぶせる
            st.animate(obj, { position: to }, { duration: 520, arc: view.lastMoved.gobble ? 1.3 : 0.9, ease: 'inOutCubic' });
          } else {
            st.animate(obj, { position: to }, { duration: sel ? 300 : 260, ease: sel ? 'outBack' : 'outCubic' });
          }
        });
      }

      function syncMarks() {
        st.clearGroup(view.marks);
        st.clearGroup(view.winMarks);
        if (isGameOver && winningLineCoords) {
          winningLineCoords.forEach(([r, c]) => {
            const m = st.markers.square(STEP * 0.92, '#e2b867', 0.2);
            const p = cellPos(r, c);
            m.position.set(p.x, 0.003, p.z);
            view.winMarks.add(m);
          });
          return;
        }
        if (!isHumanTurn() || !selectedPiece) return;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const p = cellPos(r, c);
            if (isSource(r, c)) {
              const m = new THREE.Mesh(st.geo.cached('gob-sel-ring', () => new THREE.RingGeometry(STEP * 0.42, STEP * 0.46, 56).rotateX(-Math.PI / 2)), view.glow);
              m.position.set(p.x, 0.006, p.z);
              m.renderOrder = 3;
              view.marks.add(m);
            } else if (canDropOn(r, c)) {
              const covered = board[r][c].length > 0;
              const m = covered ? st.markers.ring(STEP * 0.42, STEP * 0.46, '#e2b867', 0.7) : st.markers.dot(0.16, '#f4ede1', 0.5);
              m.position.set(p.x, 0.006, p.z);
              view.marks.add(m);
            }
          }
        }
      }

      function syncTable() {
        if (!st) return;
        if (view.gameKey !== gameSerial) resetPieces();
        syncPieces();
        syncMarks();
        hideHover();
        st.refreshHover();
      }

      function initStage(threeLib) {
        THREE = threeLib;
        st = B3D.createStage(THREE, stageWrapEl, {
          embed: true,
          radius: 15.5,
          phi: 0.66,
          lookY: 0.3,
          extent: 6,
          tableY: 0,
          tableWood: 'oak',
          minRadius: 7,
          maxRadius: 24,
          maxPhi: 1.2,
          onFrame(now) {
            if (view.glow) view.glow.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(now / 260));
            const winners = isGameOver && winningLineCoords ? winningLineCoords.map(([r, c]) => board[r][c].at(-1)).filter(Boolean).map((p) => p.id) : [];
            view.objs.forEach((obj, id) => {
              const u = obj.userData;
              let y = 0;
              if (selectedPiece && selectedPiece.pieceId === id) y = Math.sin(now / 170) * 0.08;
              const wi = winners.indexOf(id);
              if (wi >= 0) y = Math.abs(Math.sin(now / 170 + wi * 0.6)) * 0.42;
              u.bob.position.y += (y - u.bob.position.y) * 0.3;
            });
          }
        });
        view.glow = st.kit.cached('gob-glow', () => new THREE.MeshBasicMaterial({
          color: st.kit.color('#e2b867'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false
        }));
        buildTable();
        B3D.current = st;
        syncTable();
      }

      // ====================================================
      // 5. 操作パネル
      // ====================================================
      function sizeButtons(player, canSelect) {
        const counts = getHandCounts(player);
        return [3, 2, 1].map((size) => {
          const sel = selectedPiece && selectedPiece.type === 'hand' && selectedPiece.player === player && selectedPiece.size === size;
          const d = 8 + size * 3;
          return `<button class="gob-size ${sel ? 'is-selected' : ''}" data-size="${size}" ${canSelect && counts[size] > 0 ? '' : 'disabled'}>
            <i style="--c:${COLORS[player]};width:${d}px;height:${d}px"></i>${SIZES[size].name}<small>${counts[size]}</small>
          </button>`;
        }).join('');
      }

      function renderAll() {
        const isConnected = bridge.isConnected();
        modeSelEl.disabled = isConnected;
        modeSelEl.value = vsCpu ? (cpuHard ? 'cpu_hard' : 'cpu_normal') : 'local';

        const order = myPlayerSide() === P1 ? [P1, P2] : [P2, P1];
        playersRowEl.innerHTML = order.map((p) => {
          const counts = getHandCounts(p);
          const isTurn = currentTurn === p && !isGameOver;
          return `
            <div class="gob-player ${isTurn ? 'is-turn' : ''}">
              <span class="gob-swatch" style="--c:${COLORS[p]}"></span>
              <div>
                <div class="gob-player-name">${nameOf(p)}</div>
                <div class="gob-player-sub"><span>手持ち 大${counts[3]} · 中${counts[2]} · 小${counts[1]}</span></div>
              </div>
            </div>
          `;
        }).join('');

        const human = isHumanTurn();
        if (isGameOver) {
          phaseEl.textContent = '決着';
          announceEl.textContent = `${nameOf(winnerPlayer) === 'あなた' ? 'あなたの勝ちです' : `${nameOf(winnerPlayer)}の勝ちです`}。${resultSub}`;
        } else {
          phaseEl.textContent = `${nameOf(currentTurn)}の手番 · ${COLOR_NAMES[currentTurn]}`;
          if (human && selectedPiece) {
            const src = selectedPiece.type === 'hand' ? `手持ちの${SIZES[selectedPiece.size].name}` : `盤上の${SIZES[selectedPiece.size].name}`;
            announceEl.textContent = `${src}を選んでいます。置けるマスに印が付いています。`;
          } else if (human) {
            announceEl.textContent = '手持ちか盤上の自分のコマを選んでください。大きいコマは小さいコマにかぶせられます。';
          } else {
            announceEl.textContent = vsCpu ? 'CPUが考えています。' : '相手の手を待っています。';
          }
        }

        if (isGameOver) {
          dockEl.innerHTML = `
            <div class="gob-dock-info"><span class="gob-dock-label">決着</span><span class="gob-dock-text">${resultSub}</span></div>
            <div class="gob-actions"><button class="gob-btn is-primary" id="gob-dock-again">もう一度遊ぶ</button></div>
          `;
          dockEl.querySelector('#gob-dock-again').onclick = triggerRestart;
        } else if (human) {
          const player = activePlayer();
          dockEl.innerHTML = `
            <div class="gob-dock-info">
              <span class="gob-dock-label">${nameOf(player)}の手持ち</span>
              <div class="gob-controls">${sizeButtons(player, true)}</div>
            </div>
            <div class="gob-actions">
              ${selectedPiece ? '<button class="gob-btn" id="gob-cancel">選び直す</button>' : ''}
            </div>
          `;
          dockEl.querySelectorAll('[data-size]').forEach((btn) => {
            btn.onclick = () => {
              const size = +btn.getAttribute('data-size');
              const cand = benchPieces[player].find((p) => p.inBench && p.size === size);
              if (cand) selectHand(player, size, cand.id);
            };
          });
          const cancel = dockEl.querySelector('#gob-cancel');
          if (cancel) {
            cancel.onclick = () => {
              selectedPiece = null;
              renderAll();
            };
          }
        } else {
          dockEl.innerHTML = `<span class="gob-wait">${vsCpu ? 'CPUが考えています' : '相手の手を待っています'}</span>`;
        }

        syncTable();
      }

      function triggerRestart() {
        initGame();
        if (bridge.isConnected()) bridge.send({ game: 'gobblet', type: 'restart' });
      }

      modeSelEl.addEventListener('change', () => {
        if (bridge.isConnected()) return;
        const v = modeSelEl.value;
        vsCpu = v !== 'local';
        cpuHard = v === 'cpu_hard';
        renderAll();
        if (vsCpu && currentTurn === P2 && !isGameOver) triggerCpuMove();
      });
      newBtnEl.addEventListener('click', triggerRestart);
      container.querySelector('#gob-res-again').addEventListener('click', triggerRestart);
      container.querySelector('#gob-res-close').addEventListener('click', () => resultEl.classList.add('hidden'));

      // P2P
      bridge.onPlayerJoined(() => {
        myPlayer = bridge.isHost ? P1 : P2;
        vsCpu = false;
        initGame();
        bridge.showToast('対戦相手が着席しました');
      });

      bridge.onReceive((data) => {
        if (!data || data.game !== 'gobblet') return;
        if (data.type === 'move') {
          executeMove(data.move, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('相手が新しいゲームを始めました');
        }
      });

      initGame();
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
