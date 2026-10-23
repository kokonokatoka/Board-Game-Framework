/**
 * 🟡🔴 コネクトフォー (Connect Four / 重力付き四目並べ)
 * Board Arena Plugin
 * 
 * 7列×6行のグリッドにコインを落とし、
 * 縦・横・斜めのいずれかに4つ先に並べたプレイヤーの勝利！
 */

(function () {
  const COLS = 7;
  const ROWS = 6;
  const EMPTY = 0;
  const P1 = 1; // 赤 (Red)
  const P2 = 2; // 黄 (Yellow)

  window.BoardArena.registerGame({
    id: 'connect4',
    name: 'コネクトフォー (Connect 4)',
    icon: '🟡',
    category: 'パズル・対戦',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'コインを落として縦・横・斜めに4つ並べろ！重力と先読みが勝負を決める世界的名作！',

    mount(container, bridge) {
      // 状態管理
      let board = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
      let currentTurn = P1;
      let isGameOver = false;
      let winningCells = []; // 勝利した4つの座標 [{r, c}, ...]
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="c4-wrapper">
          <div class="c4-status-bar">
            <div class="turn-badge" id="c4-turn-badge">赤の手番です</div>
            <div class="c4-hint" id="c4-hint">列を選んでコインを落としてください</div>
          </div>

          <!-- コイン投下スロット (上部ガイド) -->
          <div class="c4-drop-guide" id="c4-drop-guide">
            ${Array(COLS).fill(0).map((_, c) => `
              <div class="c4-drop-col" data-col="${c}">
                <div class="c4-drop-preview"></div>
              </div>
            `).join('')}
          </div>

          <!-- 7×6 青いボードフレーム -->
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

      // スタイル定義
      if (!document.getElementById('c4-custom-css')) {
        const style = document.createElement('style');
        style.id = 'c4-custom-css';
        style.textContent = `
          .c4-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 540px;
            margin: 0 auto;
            user-select: none;
          }

          .c4-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .c4-hint {
            font-size: 13px;
            color: #94a3b8;
          }

          /* 上部ドロップガイド */
          .c4-drop-guide {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
            width: 100%;
            height: 48px;
            padding: 0 10px;
          }

          .c4-drop-col {
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            border-radius: 8px 8px 0 0;
            transition: background 0.15s;
          }
          .c4-drop-col:hover {
            background: rgba(255, 255, 255, 0.05);
          }

          .c4-drop-preview {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            opacity: 0;
            transition: opacity 0.15s, transform 0.15s;
          }
          .c4-drop-col:hover .c4-drop-preview {
            opacity: 0.85;
            transform: translateY(2px);
          }

          /* メインボードフレーム (青いプラスチック調) */
          .c4-board-frame {
            background: linear-gradient(180deg, #1d4ed8, #1e3a8a);
            border: 4px solid #3b82f6;
            border-radius: 16px;
            padding: 12px;
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.3);
            width: 100%;
          }

          .c4-board {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
            background: #172554;
            padding: 8px;
            border-radius: 10px;
          }

          /* マス目＆コイン */
          .c4-cell {
            aspect-ratio: 1;
            background: #0b1329;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: inset 0 4px 6px rgba(0, 0, 0, 0.7);
            cursor: pointer;
            position: relative;
            overflow: hidden;
          }

          .c4-coin {
            width: 90%;
            height: 90%;
            border-radius: 50%;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.5);
            animation: dropIn 0.35s cubic-bezier(0.25, 1, 0.5, 1);
          }

          @keyframes dropIn {
            0% { transform: translateY(-200px); opacity: 0; }
            70% { transform: translateY(4px); }
            100% { transform: translateY(0); opacity: 1; }
          }

          .c4-coin.p1 {
            background: radial-gradient(circle at 35% 35%, #f87171, #dc2626 70%, #991b1b);
          }
          .c4-coin.p2 {
            background: radial-gradient(circle at 35% 35%, #fef08a, #eab308 70%, #a16207);
          }

          /* 勝利コインのハイライト点滅 */
          .c4-coin.win-highlight {
            animation: winPulse 0.8s infinite alternate !important;
            box-shadow: 0 0 15px #fff, inset 0 0 8px #fff !important;
          }

          @keyframes winPulse {
            0% { transform: scale(1); filter: brightness(1.1); }
            100% { transform: scale(1.12); filter: brightness(1.5); }
          }

          /* 結果バナー */
          .c4-result-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: #1e293b;
            border: 2px solid #10b981;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 700;
          }
          .c4-result-banner.hidden { display: none; }

          @media (max-width: 480px) {
            .c4-board-frame { padding: 6px; }
            .c4-board { gap: 4px; padding: 4px; }
            .c4-drop-guide { height: 36px; }
          }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const boardEl = container.querySelector('#c4-board');
      const turnBadge = container.querySelector('#c4-turn-badge');
      const hintEl = container.querySelector('#c4-hint');
      const dropGuideEl = container.querySelector('#c4-drop-guide');
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

      // 描画
      function render() {
        const isConnected = bridge.isConnected();
        const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;
        const activeColor = isConnected ? myPlayer : currentTurn;

        // 手番バッジ
        if (!isGameOver) {
          if (!isConnected) {
            turnBadge.textContent = `⏳ 待機中 (一人練習中: ${currentTurn === P1 ? '赤' : '黄'})`;
            turnBadge.style.color = currentTurn === P1 ? '#ef4444' : '#eab308';
          } else if (currentTurn === P1) {
            turnBadge.textContent = myPlayer === P1 ? '🟢 あなたの手番 (赤)' : '相手の考え中… (赤)';
            turnBadge.style.color = '#ef4444';
          } else {
            turnBadge.textContent = myPlayer === P2 ? '🟢 あなたの手番 (黄)' : '相手の考え中… (黄)';
            turnBadge.style.color = '#eab308';
          }

          hintEl.textContent = isMyTurn ? '落としたい列をクリックしてください' : '相手の手を待っています…';
        }

        // 上部ドロップガイドの色設定
        const dropCols = dropGuideEl.querySelectorAll('.c4-drop-col');
        dropCols.forEach((colEl) => {
          const preview = colEl.querySelector('.c4-drop-preview');
          preview.className = `c4-drop-preview ${currentTurn === P1 ? 'p1' : 'p2'}`;
          preview.style.background = currentTurn === P1 ? '#ef4444' : '#eab308';
        });

        // 7×6 盤面生成
        boardEl.innerHTML = '';
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'c4-cell';
            cell.dataset.col = c;
            cell.dataset.row = r;

            const piece = board[r][c];
            if (piece !== EMPTY) {
              const coin = document.createElement('div');
              coin.className = `c4-coin ${piece === P1 ? 'p1' : 'p2'}`;
              // 勝利セルならハイライト
              if (winningCells.some(w => w.r === r && w.c === c)) {
                coin.classList.add('win-highlight');
              }
              cell.appendChild(coin);
            }

            // クリックでコイン投下
            cell.addEventListener('click', () => {
              if (isMyTurn && !isGameOver) {
                dropCoin(c, isConnected);
              }
            });

            boardEl.appendChild(cell);
          }
        }
      }

      // 上部ガイドのクリックイベント
      dropGuideEl.querySelectorAll('.c4-drop-col').forEach(colEl => {
        colEl.addEventListener('click', () => {
          const isConnected = bridge.isConnected();
          const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;
          const col = parseInt(colEl.dataset.col, 10);
          if (isMyTurn && !isGameOver) {
            dropCoin(col, isConnected);
          }
        });
      });

      // コイン投下処理
      function dropCoin(col, isLocal = false) {
        // 一番下の空き行を探す
        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[r][col] === EMPTY) {
            targetRow = r;
            break;
          }
        }

        if (targetRow === -1) {
          if (isLocal) bridge.showToast('この列はいっぱいです');
          return; // 列が満杯
        }

        // コイン配置
        board[targetRow][col] = currentTurn;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'connect4', type: 'move', col: col });
        }

        // 勝利判定
        const winResult = checkWin(targetRow, col, currentTurn);
        if (winResult) {
          isGameOver = true;
          winningCells = winResult;
          const winnerName = currentTurn === P1 ? '赤 (Red)' : '黄 (Yellow)';
          resText.textContent = `🎉 ${winnerName} の4連達成！勝利！！`;
          resBanner.classList.remove('hidden');
          bridge.showToast(`${winnerName} の勝利！`);
        } else if (isBoardFull()) {
          isGameOver = true;
          resText.textContent = '🤝 引き分けです！';
          resBanner.classList.remove('hidden');
          bridge.showToast('盤面がすべて埋まりました。引き分け！');
        } else {
          // ターン交代
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        render();
      }

      // 4連チェック (縦、横、斜め2方向)
      function checkWin(r, c, player) {
        const directions = [
          [[0, 1], [0, -1]],   // 横
          [[1, 0], [-1, 0]],   // 縦
          [[1, 1], [-1, -1]],  // 斜め (＼)
          [[1, -1], [-1, 1]]   // 斜め (／)
        ];

        for (const dir of directions) {
          const cells = [{ r, c }];

          for (const [dr, dc] of dir) {
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === player) {
              cells.push({ r: nr, c: nc });
              nr += dr;
              nc += dc;
            }
          }

          if (cells.length >= 4) {
            return cells;
          }
        }
        return null;
      }

      function isBoardFull() {
        return board[0].every(cell => cell !== EMPTY);
      }

      // リスタート
      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'connect4', type: 'restart' });
        }
      });

      // P2P 受信イベント
      bridge.onReceive((data) => {
        if (data.game !== 'connect4') return;
        if (data.type === 'move') {
          dropCoin(data.col, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      // 相手合流イベント
      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！コネクトフォー開始！');
      });

      // 初期化
      initGame();
    },

    unmount() {
      // クリーンアップ
    }
  });
})();
