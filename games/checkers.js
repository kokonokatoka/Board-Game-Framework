/**
 * 🔴⚪ チェッカー (Checkers / ドラフト) Component - CPU対戦完備版
 * Board Arena Plugin
 */

(function () {
  const SIZE = 8;
  const EMPTY = 0;
  const P1 = 1; // 赤 (あなた) - 下から上へ進む
  const P2 = 2; // 白 (CPU / 相手) - 上から下へ進む
  const P1_KING = 3;
  const P2_KING = 4;

  window.BoardArena.registerGame({
    id: 'checkers',
    name: 'チェッカー (Checkers)',
    icon: '🔴',
    category: '伝統・対戦',
    minPlayers: 1,
    maxPlayers: 2,
    description: '斜めに進んで相手を飛び越えて奪え！最奥到達で「キング」昇格！世界中で愛される超名作！CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(EMPTY));
      let currentTurn = P1;
      let selectedPiece = null;
      let validMoves = [];
      let isGameOver = false;
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;

      // HTML UI
      container.innerHTML = `
        <div class="chk-wrapper">
          <div class="chk-status-bar">
            <div class="chk-turn-group">
              <span class="turn-badge" id="chk-turn-badge">赤の手番です</span>
              <button id="chk-mode-btn" class="btn btn-sm btn-subtle chk-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="chk-piece-counter" id="chk-counter">赤: 12 vs 白: 12</div>
          </div>

          <!-- 8×8 チェッカー盤面 -->
          <div class="chk-board-frame">
            <div class="chk-board" id="chk-board"></div>
          </div>

          <!-- 結果バナー -->
          <div id="chk-result-banner" class="chk-result-banner hidden">
            <span id="chk-result-text">勝敗結果</span>
            <button id="chk-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      if (!document.getElementById('checkers-custom-css')) {
        const style = document.createElement('style');
        style.id = 'checkers-custom-css';
        style.textContent = `
          .chk-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; max-width: 500px; margin: 0 auto; user-select: none; color: #f1f5f9; }
          .chk-status-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; background: #111827; padding: 8px 14px; border-radius: 8px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .chk-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 13px; font-weight: 700; background: #1e293b; padding: 5px 12px; border-radius: 8px; border: 1px solid #334155; }
          .chk-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .chk-piece-counter { font-size: 13px; font-weight: 700; color: #f59e0b; }
          .chk-board-frame { background: #451a03; border: 6px solid #78350f; border-radius: 12px; padding: 10px; box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6); width: 100%; }
          .chk-board { display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); aspect-ratio: 1; border: 2px solid #271206; border-radius: 6px; overflow: hidden; }
          .chk-cell { display: flex; justify-content: center; align-items: center; cursor: pointer; position: relative; }
          .chk-cell.light { background: #fde047; }
          .chk-cell.dark { background: #713f12; }
          .chk-cell.selected { background: #b45309 !important; box-shadow: inset 0 0 10px #facc15; }
          .chk-cell.valid-move::after { content: ''; width: 26%; height: 26%; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px #4ade80; animation: pulseValid 0.8s infinite alternate; }
          @keyframes pulseValid { 0% { transform: scale(0.85); } 100% { transform: scale(1.2); } }
          .chk-piece { width: 80%; height: 80%; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 18px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.5); cursor: pointer; transition: transform 0.15s; }
          .chk-piece:hover { transform: scale(1.06); }
          .chk-piece.p1 { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626 70%, #991b1b); border: 2px solid #ef4444; }
          .chk-piece.p2 { background: radial-gradient(circle at 35% 35%, #f8fafc, #cbd5e1 70%, #94a3b8); border: 2px solid #e2e8f0; color: #000; }
          .chk-result-banner { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; width: 100%; background: #1e293b; border: 2px solid #10b981; padding: 10px 16px; border-radius: 8px; font-weight: 700; }
          .chk-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      const boardEl = container.querySelector('#chk-board');
      const turnBadge = container.querySelector('#chk-turn-badge');
      const modeBtn = container.querySelector('#chk-mode-btn');
      const counterEl = container.querySelector('#chk-counter');
      const resBanner = container.querySelector('#chk-result-banner');
      const resText = container.querySelector('#chk-result-text');
      const restartBtn = container.querySelector('#chk-restart-btn');

      function initGame() {
        board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(EMPTY));
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if ((r + c) % 2 === 1) {
              if (r < 3) board[r][c] = P2;      // 白 (CPU / 相手)
              else if (r > 4) board[r][c] = P1; // 赤 (あなた)
            }
          }
        }
        currentTurn = P1;
        selectedPiece = null;
        validMoves = [];
        isGameOver = false;
        resBanner.classList.add('hidden');
        render();
      }

      modeBtn.addEventListener('click', () => {
        if (bridge.isConnected()) {
          bridge.showToast('オンライン対戦中はCPUモードに切り替えられません');
          return;
        }
        vsCpu = !vsCpu;
        modeBtn.textContent = vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦';
        bridge.showToast(vsCpu ? '🤖 CPU対戦モードに切り替えました！' : '👥 2人対戦モードに切り替えました！');
        render();
        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      });

      function isPieceOfPlayer(val, player) {
        if (player === P1) return val === P1 || val === P1_KING;
        if (player === P2) return val === P2 || val === P2_KING;
        return false;
      }

      function getValidMovesForPiece(r, c, player) {
        const moves = [];
        const piece = board[r][c];
        const isKing = (piece === P1_KING || piece === P2_KING);

        const directions = [];
        if (player === P1 || isKing) directions.push([-1, -1], [-1, 1]);
        if (player === P2 || isKing) directions.push([1, -1], [1, 1]);

        // 1. 通常移動
        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === EMPTY) {
            moves.push({ toR: nr, toC: nc, isJump: false });
          }
        }

        // 2. ジャンプ捕獲
        for (const [dr, dc] of directions) {
          const midR = r + dr;
          const midC = c + dc;
          const landR = r + dr * 2;
          const landC = c + dc * 2;

          if (landR >= 0 && landR < SIZE && landC >= 0 && landC < SIZE && board[landR][landC] === EMPTY) {
            const midPiece = board[midR][midC];
            if (midPiece !== EMPTY && !isPieceOfPlayer(midPiece, player)) {
              moves.push({ toR: landR, toC: landC, isJump: true, captured: { r: midR, c: midC } });
            }
          }
        }

        return moves;
      }

      function selectPiece(r, c, player) {
        if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
          selectedPiece = null;
          validMoves = [];
        } else {
          selectedPiece = { r, c };
          validMoves = getValidMovesForPiece(r, c, player);
        }
        render();
      }

      function executeMove(from, move, isLocal = false) {
        const piece = board[from.r][from.c];
        board[from.r][from.c] = EMPTY;
        board[move.toR][move.toC] = piece;

        if (move.isJump && move.captured) {
          board[move.captured.r][move.captured.c] = EMPTY;
          bridge.showToast('💥 相手のコマをジャンプして捕獲！');
        }

        if (piece === P1 && move.toR === 0) {
          board[move.toR][move.toC] = P1_KING;
          bridge.showToast('👑 キングに昇格しました！！');
        } else if (piece === P2 && move.toR === SIZE - 1) {
          board[move.toR][move.toC] = P2_KING;
          bridge.showToast('👑 キングに昇格しました！！');
        }

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'checkers', type: 'move', from, move });
        }

        selectedPiece = null;
        validMoves = [];

        checkGameOver();

        if (!isGameOver) {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      // 🧠 賢い思考型チェッカーCPU (AI)
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;

          // 全ての自ゴマの合法手を集める
          const allOptions = [];
          for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
              if (isPieceOfPlayer(board[r][c], P2)) {
                const moves = getValidMovesForPiece(r, c, P2);
                moves.forEach(m => allOptions.push({ from: { r, c }, move: m }));
              }
            }
          }

          if (allOptions.length === 0) {
            isGameOver = true;
            resText.textContent = '🎉 あなたの勝利！CPUに合法手がありません！';
            resBanner.classList.remove('hidden');
            bridge.recordWin();
            return;
          }

          // 1. ジャンプ捕獲を最優先！
          const jumpMoves = allOptions.filter(opt => opt.move.isJump);
          if (jumpMoves.length > 0) {
            const bestJump = jumpMoves[Math.floor(Math.random() * jumpMoves.length)];
            executeMove(bestJump.from, bestJump.move, false);
            return;
          }

          // 2. キング昇格できる手を優先
          const kingMoves = allOptions.filter(opt => opt.move.toR === SIZE - 1 && board[opt.from.r][opt.from.c] === P2);
          if (kingMoves.length > 0) {
            executeMove(kingMoves[0].from, kingMoves[0].move, false);
            return;
          }

          // 3. 通常移動 (ランダムまたは前進)
          const chosen = allOptions[Math.floor(Math.random() * allOptions.length)];
          executeMove(chosen.from, chosen.move, false);
        }, 500);
      }

      function checkGameOver() {
        let p1Count = 0, p2Count = 0;
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (isPieceOfPlayer(board[r][c], P1)) p1Count++;
            if (isPieceOfPlayer(board[r][c], P2)) p2Count++;
          }
        }

        if (p1Count === 0) {
          isGameOver = true;
          resText.textContent = vsCpu ? '💀 白 (CPU) の勝利！赤が全滅しました！' : '🎉 白 の勝利！';
          resBanner.classList.remove('hidden');
          bridge.showToast('白の勝利！');
        } else if (p2Count === 0) {
          isGameOver = true;
          resText.textContent = '🎉 赤 (あなた) の勝利！白が全滅しました！';
          resBanner.classList.remove('hidden');
          bridge.showToast('赤の勝利！');
          bridge.recordWin();
        }
      }

      function render() {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
        const activeColor = isConnected ? myPlayer : currentTurn;

        let p1Count = 0, p2Count = 0;
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (isPieceOfPlayer(board[r][c], P1)) p1Count++;
            if (isPieceOfPlayer(board[r][c], P2)) p2Count++;
          }
        }
        counterEl.textContent = `赤 (あなた): ${p1Count} vs 白 (${vsCpu ? 'CPU' : '相手'}): ${p2Count}`;

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🔴 あなたの手番 (赤)';
            turnBadge.style.color = '#f87171';
          } else {
            turnBadge.textContent = vsCpu ? '⚪ CPU の考え中… (白)' : '⚪ 相手の手番 (白)';
            turnBadge.style.color = '#ffffff';
          }
        }

        boardEl.innerHTML = '';
        const validMap = new Map();
        validMoves.forEach(m => validMap.set(`${m.toR},${m.toC}`, m));

        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            const isDark = (r + c) % 2 === 1;
            cell.className = `chk-cell ${isDark ? 'dark' : 'light'}`;

            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
              cell.classList.add('selected');
            }

            const val = board[r][c];
            if (val !== EMPTY) {
              const pieceEl = document.createElement('div');
              const isP1 = (val === P1 || val === P1_KING);
              const isKing = (val === P1_KING || val === P2_KING);
              pieceEl.className = `chk-piece ${isP1 ? 'p1' : 'p2'}`;
              if (isKing) pieceEl.textContent = '👑';
              cell.appendChild(pieceEl);

              if (isHumanTurn && isPieceOfPlayer(val, activeColor)) {
                cell.addEventListener('click', (e) => {
                  e.stopPropagation();
                  selectPiece(r, c, activeColor);
                });
              }
            }

            if (validMap.has(`${r},${c}`)) {
              cell.classList.add('valid-move');
              const moveData = validMap.get(`${r},${c}`);
              cell.addEventListener('click', () => {
                executeMove(selectedPiece, moveData, isConnected);
              });
            }

            boardEl.appendChild(cell);
          }
        }
      }

      bridge.onPlayerJoined(() => {
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！チェッカー開始！');
      });

      bridge.onReceive((data) => {
        if (data.game !== 'checkers') return;
        if (data.type === 'move') {
          executeMove(data.from, data.move, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'checkers', type: 'restart' });
        }
        bridge.showToast('再戦を開始しました！');
      });

      initGame();

      return () => {
        isDestroyed = true;
      };
    }
  });
})();
