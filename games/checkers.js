/**
 * 🔴⚪ チェッカー (Checkers / ドラフト) Component
 * Board Arena Plugin
 * 
 * 世界三大ボードゲームの一角！
 * 斜めに進んで相手のコマを飛び越えて捕獲！
 * 連続ジャンプ＆奥まで進んで「キング」になれ！
 */

(function () {
  const SIZE = 8;
  const EMPTY = 0;
  const P1 = 1; // 赤 (Red) - 下から上へ進む
  const P2 = 2; // 白 (White) - 上から下へ進む
  const P1_KING = 3;
  const P2_KING = 4;

  window.BoardArena.registerGame({
    id: 'checkers',
    name: 'チェッカー (Checkers)',
    icon: '🔴',
    category: '伝統・対戦',
    minPlayers: 2,
    maxPlayers: 2,
    description: '斜めに進んで相手を飛び越えて奪え！最奥到達で「キング」昇格！世界中で愛される超名作！',

    mount(container, bridge) {
      let board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(EMPTY));
      let currentTurn = P1;
      let selectedPiece = null; // { r, c }
      let validMoves = [];      // [{ toR, toC, isJump, captured: {r, c} }]
      let isGameOver = false;
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTML UI
      container.innerHTML = `
        <div class="chk-wrapper">
          <div class="chk-status-bar">
            <div class="turn-badge" id="chk-turn-badge">赤の手番です</div>
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

      // スタイル定義
      if (!document.getElementById('checkers-custom-css')) {
        const style = document.createElement('style');
        style.id = 'checkers-custom-css';
        style.textContent = `
          .chk-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 520px;
            margin: 0 auto;
            user-select: none;
            color: #f1f5f9;
          }

          .chk-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .chk-piece-counter {
            font-size: 14px;
            font-weight: 700;
            color: #f59e0b;
          }

          /* 盤面フレーム (木製調) */
          .chk-board-frame {
            background: #451a03;
            border: 6px solid #78350f;
            border-radius: 12px;
            padding: 10px;
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6);
            width: 100%;
          }

          .chk-board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            aspect-ratio: 1;
            width: 100%;
            background: #271206;
            border-radius: 6px;
            overflow: hidden;
          }

          .chk-cell {
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            cursor: pointer;
          }

          /* 白マス (使用しない) */
          .chk-cell.light {
            background: #fef3c7;
            cursor: default;
          }
          /* 黒マス (プレイ面) */
          .chk-cell.dark {
            background: #78350f;
          }
          .chk-cell.selected {
            background: #0284c7 !important;
          }
          .chk-cell.valid-move {
            background: #b45309 !important;
          }
          .chk-cell.valid-move::after {
            content: '';
            width: 16px;
            height: 16px;
            background: #f59e0b;
            border-radius: 50%;
            opacity: 0.85;
            box-shadow: 0 0 8px #f59e0b;
          }

          /* コマ */
          .chk-piece {
            width: 82%;
            height: 82%;
            border-radius: 50%;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5), inset 0 2px 3px rgba(255, 255, 255, 0.4);
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 20px;
            transition: transform 0.15s ease;
          }
          .chk-piece:hover {
            transform: scale(1.08);
          }

          .chk-piece.p1 {
            background: radial-gradient(circle at 35% 35%, #f87171, #dc2626 70%, #991b1b);
            border: 2px solid #ef4444;
          }
          .chk-piece.p2 {
            background: radial-gradient(circle at 35% 35%, #ffffff, #e2e8f0 70%, #94a3b8);
            border: 2px solid #cbd5e1;
            color: #0f172a;
          }

          /* 結果バナー */
          .chk-result-banner {
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
          .chk-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const boardEl = container.querySelector('#chk-board');
      const turnBadge = container.querySelector('#chk-turn-badge');
      const counterEl = container.querySelector('#chk-counter');
      const resBanner = container.querySelector('#chk-result-banner');
      const resText = container.querySelector('#chk-result-text');
      const restartBtn = container.querySelector('#chk-restart-btn');

      // 初期化
      function initGame() {
        board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(EMPTY));
        // コマ初期配置
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if ((r + c) % 2 === 1) { // 黒マス
              if (r < 3) board[r][c] = P2;      // 上段: 白
              else if (r > 4) board[r][c] = P1; // 下段: 赤
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

      function render() {
        const isConnected = bridge.isConnected();
        const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;
        const activeColor = isConnected ? myPlayer : currentTurn;

        // コマ数カウント
        let p1Count = 0, p2Count = 0;
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === P1 || board[r][c] === P1_KING) p1Count++;
            if (board[r][c] === P2 || board[r][c] === P2_KING) p2Count++;
          }
        }
        counterEl.textContent = `赤: ${p1Count} vs 白: ${p2Count}`;

        // 手番バッジ
        if (!isGameOver) {
          if (!isConnected) {
            turnBadge.textContent = `⏳ 待機中 (一人練習中: ${currentTurn === P1 ? '赤' : '白'}の手番)`;
            turnBadge.style.color = currentTurn === P1 ? '#f87171' : '#ffffff';
          } else if (currentTurn === P1) {
            turnBadge.textContent = myPlayer === P1 ? '🟢 あなたの手番 (赤)' : '相手の考え中… (赤)';
            turnBadge.style.color = '#f87171';
          } else {
            turnBadge.textContent = myPlayer === P2 ? '🟢 あなたの手番 (白)' : '相手の考え中… (白)';
            turnBadge.style.color = '#ffffff';
          }
        }

        // 盤面描画
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

              // 自分のコマをクリックして選択
              if (isMyTurn && isPieceOfPlayer(val, activeColor)) {
                cell.addEventListener('click', (e) => {
                  e.stopPropagation();
                  selectPiece(r, c, activeColor);
                });
              }
            }

            // 移動先マス
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

      function isPieceOfPlayer(val, player) {
        if (player === P1) return val === P1 || val === P1_KING;
        if (player === P2) return val === P2 || val === P2_KING;
        return false;
      }

      // コマを選択して合法手を計算
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

      // 指定コマの合法手計算
      function getValidMovesForPiece(r, c, player) {
        const moves = [];
        const piece = board[r][c];
        const isKing = (piece === P1_KING || piece === P2_KING);

        // 移動方向
        // P1(赤) は上方向 (dr = -1)、P2(白) は下方向 (dr = +1)、キングは両方
        const directions = [];
        if (player === P1 || isKing) {
          directions.push([-1, -1], [-1, 1]); // 上斜め
        }
        if (player === P2 || isKing) {
          directions.push([1, -1], [1, 1]);   // 下斜め
        }

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

      // 移動実行
      function executeMove(from, move, isLocal = false) {
        const piece = board[from.r][from.c];
        board[from.r][from.c] = EMPTY;
        board[move.toR][move.toC] = piece;

        // 捕獲処理
        if (move.isJump && move.captured) {
          board[move.captured.r][move.captured.c] = EMPTY;
          bridge.showToast('💥 相手のコマをジャンプして捕獲！');
        }

        // キング昇格チェック
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

        // 勝敗チェック
        checkGameOver();

        if (!isGameOver) {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        render();
      }

      function checkGameOver() {
        let p1HasPiece = false, p2HasPiece = false;
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === P1 || board[r][c] === P1_KING) p1HasPiece = true;
            if (board[r][c] === P2 || board[r][c] === P2_KING) p2HasPiece = true;
          }
        }

        if (!p1HasPiece) {
          isGameOver = true;
          resText.textContent = '🎉 白 (P2) の勝利！赤のコマが全滅しました！';
          resBanner.classList.remove('hidden');
          bridge.showToast('白の勝利！');
        } else if (!p2HasPiece) {
          isGameOver = true;
          resText.textContent = '🎉 赤 (P1) の勝利！白のコマが全滅しました！';
          resBanner.classList.remove('hidden');
          bridge.showToast('赤の勝利！');
        }
      }

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'checkers', type: 'restart' });
        }
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

      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！チェッカー開始！');
      });

      initGame();
    },

    unmount() {}
  });
})();
