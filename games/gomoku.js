/**
 * ⚪ 五目並べ (Connect 5) Component - CPU対戦完備版
 */

(function () {
  const BOARD_SIZE = 11;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const DIRECTIONS = [
    [1, 0],  // 横
    [0, 1],  // 縦
    [1, 1],  // 斜め右下
    [1, -1]  // 斜め左下
  ];

  window.BoardArena.registerGame({
    id: 'gomoku',
    name: '五目並べ (Connect 5)',
    category: 'ボードゲーム',
    icon: '⚪',
    players: '1〜2人',
    playTime: '3-8分',
    description: '縦・横・斜めに先に石を5つ並べた方の勝利！シンプルで奥深い対戦ゲーム。CPU対戦も完備！',

    mount(container, bridge) {
      let isDestroyed = false;
      let board = [];
      let currentTurn = BLACK;
      let myColor = bridge.isHost ? BLACK : WHITE;
      let isGameOver = false;
      let vsCpu = !bridge.isConnected();

      container.innerHTML = `
        <div class="gomoku-wrapper">
          <div class="gomoku-status-bar">
            <div class="gomoku-turn-info">
              <span class="turn-badge" id="gomoku-turn-badge">黒の手番です</span>
              <button id="gom-mode-btn" class="btn btn-sm btn-subtle gom-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="gomoku-rule">先に5つ並べたら勝ち！</div>
          </div>
          <div class="gomoku-board-frame">
            <div id="gomoku-grid" class="gomoku-grid"></div>
          </div>
          <div id="gomoku-result" class="gomoku-result-banner hidden">
            <span id="gom-res-text">勝敗</span>
            <button id="gom-restart-btn" class="btn btn-sm btn-primary">再戦する</button>
          </div>
        </div>
      `;

      const gridEl = container.querySelector('#gomoku-grid');
      const turnBadge = container.querySelector('#gomoku-turn-badge');
      const modeBtn = container.querySelector('#gom-mode-btn');
      const resBanner = container.querySelector('#gomoku-result');
      const resText = container.querySelector('#gom-res-text');
      const restartBtn = container.querySelector('#gom-restart-btn');

      if (!document.getElementById('gomoku-custom-css')) {
        const style = document.createElement('style');
        style.id = 'gomoku-custom-css';
        style.textContent = `
          .gomoku-wrapper { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 1000px; margin: 0 auto; gap: 8px; }
          .gomoku-status-bar { width: min(100%, 74vh, 720px); display: flex; justify-content: space-between; align-items: center; background: #111827; padding: 6px 14px; border-radius: 10px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .gomoku-turn-info { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 14px; font-weight: 700; background: #1e293b; padding: 5px 14px; border-radius: 10px; border: 1px solid #334155; }
          .gom-mode-btn { font-size: 12px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 10px; border-radius: 6px; cursor: pointer; }
          .gomoku-rule { font-size: 13px; color: #94a3b8; font-weight: 600; }
          .gomoku-board-frame { width: min(100%, 74vh, 720px); aspect-ratio: 1/1; padding: 12px; background: #d7ba89; border-radius: 14px; box-shadow: 0 14px 34px rgba(0,0,0,0.65); }
          .gomoku-grid { width: 100%; height: 100%; background: #e0c598; display: grid; grid-template-columns: repeat(11, 1fr); grid-template-rows: repeat(11, 1fr); gap: 1px; border: 2px solid #5c401b; }
          .gom-cell { background: #eed5ab; display: flex; justify-content: center; align-items: center; cursor: pointer; position: relative; }
          .gom-cell:hover { background: #fdf0d5; }
          .gom-piece { width: 84%; height: 84%; border-radius: 50%; box-shadow: 0 3px 6px rgba(0,0,0,0.4); animation: dropIn 0.2s ease; }
          .gom-piece.b { background: radial-gradient(circle at 35% 35%, #444, #000); }
          .gom-piece.w { background: radial-gradient(circle at 35% 35%, #fff, #cbd5e1); }
          .gomoku-result-banner { width: min(100%, 74vh, 720px); margin-top: 6px; background: #1e293b; border: 1px solid #38bdf8; padding: 10px 20px; border-radius: 12px; display: flex; justify-content: space-between; gap: 14px; align-items: center; font-weight: 700; color: #38bdf8; }
          .gomoku-result-banner.hidden { display: none; }
          @keyframes dropIn { from { transform: scale(0.5); } to { transform: scale(1); } }
        `;
        document.head.appendChild(style);
      }

      function initGame() {
        board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
        currentTurn = BLACK;
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
        if (vsCpu && currentTurn === WHITE && !isGameOver) {
          triggerCpuMove();
        }
      });

      function checkWin(r, c, color) {
        for (const [dr, dc] of DIRECTIONS) {
          let count = 1;
          let nr = r + dr, nc = c + dc;
          while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
            count++; nr += dr; nc += dc;
          }
          nr = r - dr; nc = c - dc;
          while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
            count++; nr -= dr; nc -= dc;
          }
          if (count >= 5) return true;
        }
        return false;
      }

      function placeStone(r, c, isLocal = false) {
        if (board[r][c] !== EMPTY || isGameOver) return;

        board[r][c] = currentTurn;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'gomoku', type: 'move', r, c });
        }

        if (checkWin(r, c, currentTurn)) {
          isGameOver = true;
          let winnerText = currentTurn === BLACK 
            ? '🎉 黒 (あなた) の勝利！！' 
            : (vsCpu ? '💀 白 (CPU) の勝利！' : '🎉 白 の勝利！！');
          resText.textContent = winnerText;
          resBanner.classList.remove('hidden');
          bridge.showToast(winnerText);
          if (currentTurn === BLACK) bridge.recordWin();
          render();
          return;
        }

        currentTurn = currentTurn === BLACK ? WHITE : BLACK;
        render();

        if (vsCpu && currentTurn === WHITE && !isGameOver) {
          triggerCpuMove();
        }
      }

      // 🧠 賢い思考型五目並べCPU (AI)
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== WHITE || isDestroyed) return;

          // 最適マス探索 (評価値スコアリング)
          let bestMove = null;
          let maxScore = -1;

          // 空きマス候補の収集
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              if (board[r][c] !== EMPTY) continue;

              // 近隣に石がないマスはスキップ (枝刈り)
              let hasNeighbor = false;
              for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                  const nr = r + dr, nc = c + dc;
                  if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] !== EMPTY) {
                    hasNeighbor = true;
                    break;
                  }
                }
                if (hasNeighbor) break;
              }
              if (!hasNeighbor && (r !== 5 || c !== 5)) continue;

              let score = evaluateGomokuMove(r, c);
              if (score > maxScore) {
                maxScore = score;
                bestMove = { r, c };
              }
            }
          }

          if (bestMove) {
            placeStone(bestMove.r, bestMove.c, false);
          } else {
            // 中央付近に配置
            placeStone(5, 5, false);
          }
        }, 450);
      }

      function evaluateGomokuMove(r, c) {
        let attackScore = 0;
        let defendScore = 0;

        // 1. 自分が置いた場合 (攻め)
        board[r][c] = WHITE;
        if (checkWin(r, c, WHITE)) attackScore += 100000;
        else attackScore += countPatterns(r, c, WHITE);

        // 2. 相手が置いた場合 (防ぎ)
        board[r][c] = BLACK;
        if (checkWin(r, c, BLACK)) defendScore += 80000;
        else defendScore += countPatterns(r, c, BLACK);

        board[r][c] = EMPTY; // 戻す

        // 中央に近いほど微小ボーナス
        const centerDist = Math.abs(r - 5) + Math.abs(c - 5);
        return attackScore * 1.1 + defendScore + (10 - centerDist);
      }

      function countPatterns(r, c, color) {
        let score = 0;
        for (const [dr, dc] of DIRECTIONS) {
          let count = 1;
          let nr = r + dr, nc = c + dc;
          while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
            count++; nr += dr; nc += dc;
          }
          nr = r - dr; nc = c - dc;
          while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
            count++; nr -= dr; nc -= dc;
          }
          if (count === 4) score += 5000;
          else if (count === 3) score += 800;
          else if (count === 2) score += 100;
        }
        return score;
      }

      function render() {
        gridEl.innerHTML = '';
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === BLACK) || (isConnected && currentTurn === myColor);

        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'gom-cell';
            const val = board[r][c];

            if (val === BLACK) {
              cell.innerHTML = '<div class="gom-piece b"></div>';
            } else if (val === WHITE) {
              cell.innerHTML = '<div class="gom-piece w"></div>';
            } else {
              cell.addEventListener('click', () => {
                if (isHumanTurn && !isGameOver) {
                  placeStone(r, c, isConnected);
                }
              });
            }
            gridEl.appendChild(cell);
          }
        }

        if (!isGameOver) {
          if (currentTurn === BLACK) {
            turnBadge.textContent = '⚫ あなたの手番 (黒)';
            turnBadge.style.color = '#38bdf8';
          } else {
            turnBadge.textContent = vsCpu ? '⚪ CPU の考え中… (白)' : '⚪ 相手の手番 (白)';
            turnBadge.style.color = '#f87171';
          }
        }
      }

      bridge.onPlayerJoined(() => {
        myColor = bridge.isHost ? BLACK : WHITE;
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！五目並べ対戦開始！');
      });

      bridge.onReceive((data) => {
        if (data.game !== 'gomoku') return;
        if (data.type === 'move') {
          placeStone(data.r, data.c, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦が開始されました！');
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'gomoku', type: 'restart' });
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
