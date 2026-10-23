/**
 * 🟡🔴 コネクトフォー (Connect Four) Component - CPU対戦完備版
 */

(function () {
  const COLS = 7;
  const ROWS = 6;
  const EMPTY = 0;
  const P1 = 1; // 赤 (あなた)
  const P2 = 2; // 黄 (CPU / 相手)

  window.BoardArena.registerGame({
    id: 'connect4',
    name: 'コネクトフォー (Connect 4)',
    icon: '🟡',
    category: 'パズル・対戦',
    minPlayers: 1,
    maxPlayers: 2,
    description: 'コインを落として縦・横・斜めに4つ並べろ！重力と先読みが勝負を決める世界的名作！CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let board = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
      let currentTurn = P1;
      let isGameOver = false;
      let winningCells = [];
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="c4-wrapper">
          <div class="c4-status-bar">
            <div class="c4-turn-group">
              <span class="turn-badge" id="c4-turn-badge">赤の手番です</span>
              <button id="c4-mode-btn" class="btn btn-sm btn-subtle c4-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="c4-hint" id="c4-hint">列を選んでコインを落としてください</div>
          </div>

          <!-- コイン投下スロット -->
          <div class="c4-drop-guide" id="c4-drop-guide">
            ${Array(COLS).fill(0).map((_, c) => `
              <div class="c4-drop-col" data-col="${c}">
                <div class="c4-drop-preview"></div>
              </div>
            `).join('')}
          </div>

          <!-- 7×6 ボードフレーム -->
          <div class="c4-board-frame">
            <div class="c4-board" id="c4-board"></div>
          </div>

          <!-- 結果バナー -->
          <div id="c4-result-banner" class="c4-result-banner hidden">
            <span id="c4-result-text">勝敗結果</span>
            <button id="c4-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      if (!document.getElementById('c4-custom-css')) {
        const style = document.createElement('style');
        style.id = 'c4-custom-css';
        style.textContent = `
          .c4-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; max-width: 520px; margin: 0 auto; user-select: none; }
          .c4-status-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; background: #111827; padding: 8px 14px; border-radius: 8px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .c4-turn-group { display: flex; align-items: center; gap: 8px; }
          .c4-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .c4-hint { font-size: 12px; color: #94a3b8; }
          .c4-drop-guide { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; width: 100%; height: 38px; }
          .c4-drop-col { display: flex; justify-content: center; align-items: center; cursor: pointer; border-radius: 8px; transition: background 0.15s; }
          .c4-drop-col:hover { background: rgba(255, 255, 255, 0.1); }
          .c4-drop-col:hover .c4-drop-preview { opacity: 0.8; }
          .c4-drop-preview { width: 30px; height: 30px; border-radius: 50%; opacity: 0; transition: opacity 0.15s; }
          .c4-drop-preview.p1 { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); }
          .c4-drop-preview.p2 { background: radial-gradient(circle at 35% 35%, #fef08a, #eab308); }
          .c4-board-frame { width: 100%; background: #1e3a8a; border: 6px solid #1e40af; border-radius: 16px; padding: 12px; box-shadow: 0 16px 35px rgba(0, 0, 0, 0.6); }
          .c4-board { display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(6, 1fr); gap: 8px; width: 100%; aspect-ratio: 7 / 6; }
          .c4-cell { aspect-ratio: 1; background: #0f172a; border-radius: 50%; box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative; cursor: pointer; }
          .c4-coin { width: 100%; height: 100%; border-radius: 50%; animation: coinDrop 0.25s cubic-bezier(0.25, 1, 0.5, 1); box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.6), 0 2px 5px rgba(0, 0, 0, 0.5); }
          .c4-coin.p1 { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626 70%, #991b1b); border: 2px solid #ef4444; }
          .c4-coin.p2 { background: radial-gradient(circle at 35% 35%, #fef08a, #eab308 70%, #ca8a04); border: 2px solid #facc15; }
          .c4-coin.win { animation: coinGlow 0.8s infinite alternate; }
          @keyframes coinDrop { from { transform: translateY(-300%); } to { transform: translateY(0); } }
          @keyframes coinGlow { 0% { box-shadow: 0 0 8px #fff; } 100% { box-shadow: 0 0 20px #fff, 0 0 30px #f59e0b; } }
          .c4-result-banner { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; width: 100%; background: #1e293b; border: 2px solid #10b981; padding: 10px 16px; border-radius: 8px; font-weight: 700; }
          .c4-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      const boardEl = container.querySelector('#c4-board');
      const dropGuideEl = container.querySelector('#c4-drop-guide');
      const turnBadge = container.querySelector('#c4-turn-badge');
      const modeBtn = container.querySelector('#c4-mode-btn');
      const resBanner = container.querySelector('#c4-result-banner');
      const resText = container.querySelector('#c4-result-text');
      const restartBtn = container.querySelector('#c4-restart-btn');

      function initGame() {
        board = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
        currentTurn = P1;
        isGameOver = false;
        winningCells = [];
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

      function dropCoin(col, isLocal = false) {
        if (isGameOver || col < 0 || col >= COLS) return;

        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[r][col] === EMPTY) {
            targetRow = r;
            break;
          }
        }

        if (targetRow === -1) {
          bridge.showToast('その列はいっぱいです！');
          return;
        }

        board[targetRow][col] = currentTurn;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'connect4', type: 'drop', col: col });
        }

        const winResult = checkWin(targetRow, col, currentTurn);
        if (winResult) {
          isGameOver = true;
          winningCells = winResult;
          let winnerText = currentTurn === P1 ? '🎉 赤 (あなた) の勝利！！' : (vsCpu ? '💀 黄 (CPU) の勝利！' : '🎉 黄 の勝利！！');
          resText.textContent = winnerText;
          resBanner.classList.remove('hidden');
          bridge.showToast(winnerText);
          if (currentTurn === P1) bridge.recordWin();
          render();
          return;
        }

        // 引き分けチェック
        if (board[0].every(c => c !== EMPTY)) {
          isGameOver = true;
          resText.textContent = '🤝 引き分け！グリッドが満杯です！';
          resBanner.classList.remove('hidden');
          render();
          return;
        }

        currentTurn = currentTurn === P1 ? P2 : P1;
        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      function checkWin(r, c, player) {
        const directions = [
          [[0, 1], [0, -1]],   // 横
          [[1, 0], [-1, 0]],   // 縦
          [[1, 1], [-1, -1]],  // 右下-左上
          [[1, -1], [-1, 1]]   // 左下-右上
        ];

        for (const dirPair of directions) {
          let line = [{ r, c }];
          for (const [dr, dc] of dirPair) {
            let nr = r + dr, nc = c + dc;
            while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === player) {
              line.push({ r: nr, c: nc });
              nr += dr; nc += dc;
            }
          }
          if (line.length >= 4) return line;
        }
        return null;
      }

      // 🧠 賢い思考型コネクト4 CPU (AI)
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;

          // 1. CPU自身の4連即勝ち手
          for (let c = 0; c < COLS; c++) {
            const r = getDropRow(c);
            if (r !== -1) {
              board[r][c] = P2;
              if (checkWin(r, c, P2)) {
                board[r][c] = EMPTY;
                dropCoin(c, false);
                return;
              }
              board[r][c] = EMPTY;
            }
          }

          // 2. 相手(P1)の4連阻止
          for (let c = 0; c < COLS; c++) {
            const r = getDropRow(c);
            if (r !== -1) {
              board[r][c] = P1;
              if (checkWin(r, c, P1)) {
                board[r][c] = EMPTY;
                dropCoin(c, false);
                return;
              }
              board[r][c] = EMPTY;
            }
          }

          // 3. 列評価 (中央列優先 + 相手に勝ちを与えない手)
          const columnScores = [3, 4, 6, 8, 6, 4, 3];
          let bestCol = -1;
          let bestScore = -9999;

          // ランダムシャッフル順で探索
          const colOrder = [3, 2, 4, 1, 5, 0, 6];
          for (const c of colOrder) {
            const r = getDropRow(c);
            if (r === -1) continue;

            let score = columnScores[c];

            // そのマスに置くと相手が真上に置いて勝ってしまう手（悪手）を回避
            if (r > 0) {
              board[r - 1][c] = P1;
              if (checkWin(r - 1, c, P1)) {
                score -= 500;
              }
              board[r - 1][c] = EMPTY;
            }

            if (score > bestScore) {
              bestScore = score;
              bestCol = c;
            }
          }

          if (bestCol !== -1) {
            dropCoin(bestCol, false);
          } else {
            // ランダム空き列
            const valids = [];
            for (let c = 0; c < COLS; c++) if (getDropRow(c) !== -1) valids.push(c);
            if (valids.length > 0) dropCoin(valids[Math.floor(Math.random() * valids.length)], false);
          }
        }, 500);
      }

      function getDropRow(c) {
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[r][c] === EMPTY) return r;
        }
        return -1;
      }

      function render() {
        boardEl.innerHTML = '';
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'c4-cell';
            const val = board[r][c];

            if (val !== EMPTY) {
              const coin = document.createElement('div');
              coin.className = `c4-coin ${val === P1 ? 'p1' : 'p2'}`;
              if (winningCells.some(w => w.r === r && w.c === c)) {
                coin.classList.add('win');
              }
              cell.appendChild(coin);
            }

            cell.addEventListener('click', () => {
              if (isHumanTurn && !isGameOver) {
                dropCoin(c, isConnected);
              }
            });

            boardEl.appendChild(cell);
          }
        }

        // ドロッププレビューの更新
        dropGuideEl.querySelectorAll('.c4-drop-col').forEach(colEl => {
          const c = parseInt(colEl.dataset.col, 10);
          const preview = colEl.querySelector('.c4-drop-preview');
          preview.className = `c4-drop-preview ${currentTurn === P1 ? 'p1' : 'p2'}`;

          colEl.onclick = () => {
            if (isHumanTurn && !isGameOver) {
              dropCoin(c, isConnected);
            }
          };
        });

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🔴 あなたの手番 (赤)';
            turnBadge.style.color = '#f87171';
          } else {
            turnBadge.textContent = vsCpu ? '🟡 CPU の考え中… (黄)' : '🟡 相手の手番 (黄)';
            turnBadge.style.color = '#fbbf24';
          }
        }
      }

      bridge.onPlayerJoined(() => {
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！コネクト4開始！');
      });

      bridge.onReceive((data) => {
        if (data.game !== 'connect4') return;
        if (data.type === 'drop') {
          dropCoin(data.col, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦が開始されました！');
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'connect4', type: 'restart' });
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
