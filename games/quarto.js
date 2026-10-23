/**
 * 🏛️ クアルト (Quarto) Component
 * Board Arena Plugin
 * 
 * メンサ推薦・世界的受賞歴多数の超傑作！
 * 「自分が置くコマは、相手が選ぶ！」
 * 共通の属性（色・形・高さ・穴）を4つ先に一列揃えたプレイヤーの勝利！
 */

(function () {
  const SIZE = 4;
  const P1 = 1;
  const P2 = 2;

  // 16個のピース定義 (4属性: color, shape, height, hole)
  // color: 'light'(0) / 'dark'(1)
  // shape: 'round'(0) / 'square'(1)
  // height: 'short'(0) / 'tall'(1)
  // hole: 'solid'(0) / 'hollow'(1)
  const PIECES = [];
  for (let c = 0; c < 2; c++) {
    for (let s = 0; s < 2; s++) {
      for (let h = 0; h < 2; h++) {
        for (let o = 0; o < 2; o++) {
          PIECES.push({
            id: PIECES.length,
            color: c,   // 0: Light, 1: Dark
            shape: s,   // 0: Round, 1: Square
            height: h,  // 0: Short, 1: Tall
            hole: o     // 0: Solid, 1: Hollow
          });
        }
      }
    }
  }

  window.BoardArena.registerGame({
    id: 'quarto',
    name: 'クアルト (Quarto)',
    icon: '🏛️',
    category: '推理・パズル',
    minPlayers: 2,
    maxPlayers: 2,
    description: '「自分が置くコマは相手が決める！」色・形・高さ・穴の共通点を4つ揃えろ！世界最高峰の心理戦！',

    mount(container, bridge) {
      let board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
      let availablePieces = new Set(PIECES.map(p => p.id));
      let selectedPieceForOpponent = null; // 相手に渡すために選んだピース
      let activePieceToPlace = null;       // 今自分が盤面に置くべきピース
      let currentTurn = P1;
      let step = 'PLACE'; // 'PLACE' (コマ配置) | 'GIVE' (相手にコマを渡す)
      let isGameOver = false;
      let winningLine = [];
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTML UI
      container.innerHTML = `
        <div class="qrt-wrapper">
          <div class="qrt-status-bar">
            <div class="turn-badge" id="qrt-turn-badge">P1の手番です</div>
            <div class="active-piece-box" id="qrt-active-box">
              置くコマ: <span id="active-piece-display">なし</span>
            </div>
          </div>

          <!-- 4×4 盤面 -->
          <div class="qrt-board-frame">
            <div class="qrt-board" id="qrt-board"></div>
          </div>

          <!-- 手駒プール (未配置のコマ一覧) -->
          <div class="qrt-pool-card">
            <div class="pool-header" id="qrt-pool-header">相手に渡すコマを選んでください:</div>
            <div class="qrt-pool" id="qrt-pool"></div>
          </div>

          <!-- 結果バナー -->
          <div id="qrt-result-banner" class="qrt-result-banner hidden">
            <span id="qrt-result-text">勝敗結果</span>
            <button id="qrt-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('quarto-custom-css')) {
        const style = document.createElement('style');
        style.id = 'quarto-custom-css';
        style.textContent = `
          .qrt-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 540px;
            margin: 0 auto;
            user-select: none;
            color: #f1f5f9;
          }

          .qrt-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .active-piece-box {
            font-size: 13px;
            font-weight: 700;
            color: #f59e0b;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          /* 盤面フレーム (円形木製ボード) */
          .qrt-board-frame {
            background: linear-gradient(135deg, #78350f, #451a03);
            border: 6px solid #92400e;
            border-radius: 50%;
            padding: 24px;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6);
            aspect-ratio: 1;
            width: 340px;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .qrt-board {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 8px;
            width: 100%;
            height: 100%;
          }

          .qrt-cell {
            background: #271206;
            border-radius: 50%;
            box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: background 0.15s, transform 0.15s;
          }
          .qrt-cell:hover:not(.occupied) {
            background: #3b1d09;
            transform: scale(1.06);
          }
          .qrt-cell.win-highlight {
            box-shadow: 0 0 15px #f59e0b, inset 0 0 8px #f59e0b !important;
          }

          /* コマのビジュアル */
          .qrt-piece {
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4), inset 0 2px 3px rgba(255, 255, 255, 0.3);
            position: relative;
            cursor: pointer;
            transition: transform 0.15s ease;
          }
          .qrt-piece:hover {
            transform: scale(1.12);
          }

          /* 色 */
          .qrt-piece.light { background: #fde68a; border: 2px solid #f59e0b; color: #78350f; }
          .qrt-piece.dark { background: #334155; border: 2px solid #1e293b; color: #94a3b8; }

          /* 形状 */
          .qrt-piece.round { border-radius: 50%; }
          .qrt-piece.square { border-radius: 6px; }

          /* 高さ */
          .qrt-piece.tall { width: 50px; height: 50px; font-size: 14px; }
          .qrt-piece.short { width: 36px; height: 36px; font-size: 11px; }

          /* 穴 */
          .qrt-piece.hollow::after {
            content: '';
            width: 40%;
            height: 40%;
            background: #0f172a;
            border-radius: 50%;
            position: absolute;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.8);
          }

          /* コマプール (未配置エリア) */
          .qrt-pool-card {
            width: 100%;
            background: #18202c;
            border: 1px solid #2b384a;
            border-radius: 10px;
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .pool-header {
            font-size: 13px;
            font-weight: 700;
            color: #94a3b8;
          }
          .qrt-pool {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            min-height: 60px;
          }

          .qrt-pool .qrt-piece.selected {
            box-shadow: 0 0 14px #38bdf8 !important;
            transform: scale(1.18);
          }

          /* 結果バナー */
          .qrt-result-banner {
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
          .qrt-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const boardEl = container.querySelector('#qrt-board');
      const poolEl = container.querySelector('#qrt-pool');
      const turnBadge = container.querySelector('#qrt-turn-badge');
      const activeDisplay = container.querySelector('#active-piece-display');
      const poolHeader = container.querySelector('#qrt-pool-header');
      const resBanner = container.querySelector('#qrt-result-banner');
      const resText = container.querySelector('#qrt-result-text');
      const restartBtn = container.querySelector('#qrt-restart-btn');

      function initGame() {
        board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
        availablePieces = new Set(PIECES.map(p => p.id));
        currentTurn = P1;
        step = 'GIVE'; // 最初の手番は相手に渡すコマを選ぶ
        activePieceToPlace = null;
        selectedPieceForOpponent = null;
        isGameOver = false;
        winningLine = [];
        resBanner.classList.add('hidden');
        render();
      }

      function render() {
        const isConnected = bridge.isConnected();
        const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;

        // ステータス
        if (!isGameOver) {
          if (!isConnected) {
            turnBadge.textContent = `⏳ 待機中 (一人練習中: ${currentTurn === P1 ? 'P1' : 'P2'})`;
          } else if (currentTurn === P1) {
            turnBadge.textContent = myPlayer === P1 ? '🟢 あなたの手番 (P1)' : '相手の手番中… (P1)';
          } else {
            turnBadge.textContent = myPlayer === P2 ? '🟢 あなたの手番 (P2)' : '相手の手番中… (P2)';
          }

          if (step === 'PLACE') {
            poolHeader.textContent = '【配置】盤面の空きマスをクリックしてコマを置いてください';
          } else {
            poolHeader.textContent = isMyTurn ? '👉 相手に渡すコマを下のプールから1つ選んでください！' : '相手があなたに渡すコマを選んでいます…';
          }
        }

        // 置くべきアクティブピースの表示
        activeDisplay.innerHTML = '';
        if (activePieceToPlace !== null) {
          const piece = PIECES[activePieceToPlace];
          const el = createPieceEl(piece);
          activeDisplay.appendChild(el);
        } else {
          activeDisplay.textContent = 'なし (選択中)';
        }

        // 4×4 盤面描画
        boardEl.innerHTML = '';
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'qrt-cell';

            const pieceId = board[r][c];
            if (pieceId !== null) {
              cell.classList.add('occupied');
              const pEl = createPieceEl(PIECES[pieceId]);
              if (winningLine.some(w => w.r === r && w.c === c)) {
                cell.classList.add('win-highlight');
              }
              cell.appendChild(pEl);
            } else {
              // 空きマスへの配置
              cell.addEventListener('click', () => {
                if (isMyTurn && step === 'PLACE' && activePieceToPlace !== null && !isGameOver) {
                  placePiece(r, c, activePieceToPlace, isConnected);
                }
              });
            }

            boardEl.appendChild(cell);
          }
        }

        // コマプール描画
        poolEl.innerHTML = '';
        availablePieces.forEach(id => {
          const piece = PIECES[id];
          const pEl = createPieceEl(piece);
          if (selectedPieceForOpponent === id) {
            pEl.classList.add('selected');
          }

          pEl.addEventListener('click', () => {
            if (isMyTurn && step === 'GIVE' && !isGameOver) {
              givePieceToOpponent(id, isConnected);
            }
          });

          poolEl.appendChild(pEl);
        });
      }

      function createPieceEl(p) {
        const el = document.createElement('div');
        el.className = `qrt-piece ${p.color === 0 ? 'light' : 'dark'} ${p.shape === 0 ? 'round' : 'square'} ${p.height === 0 ? 'short' : 'tall'} ${p.hole === 1 ? 'hollow' : ''}`;
        return el;
      }

      // コマを盤面に置く
      function placePiece(r, c, pieceId, isLocal = false) {
        board[r][c] = pieceId;
        availablePieces.delete(pieceId);
        activePieceToPlace = null;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'quarto', type: 'place', r, c, pieceId });
        }

        // クアルト（勝利）チェック
        const win = checkQuarto();
        if (win) {
          isGameOver = true;
          winningLine = win.line;
          const winnerName = currentTurn === P1 ? 'P1' : 'P2';
          resText.textContent = `🎉 クアルト成立！！ ${winnerName} の勝利！！ (${win.traitName}が4連)`;
          resBanner.classList.remove('hidden');
          bridge.showToast(`クアルト成立！${winnerName}の勝利！`);
          render();
          return;
        }

        if (availablePieces.size === 0) {
          isGameOver = true;
          resText.textContent = '🤝 全16マスが埋まりました。引き分け！';
          resBanner.classList.remove('hidden');
          render();
          return;
        }

        // 次は相手に渡すコマを選ぶフェーズへ
        step = 'GIVE';
        bridge.showToast('コマを配置しました。相手に渡すコマを選んでください！');
        render();
      }

      // 相手にコマを渡す
      function givePieceToOpponent(pieceId, isLocal = false) {
        activePieceToPlace = pieceId;
        step = 'PLACE';
        currentTurn = currentTurn === P1 ? P2 : P1;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'quarto', type: 'give', pieceId });
        }

        bridge.showToast('相手にコマを渡しました！ターン交代！');
        render();
      }

      // クアルト判定 (4つの属性いずれかが一列揃ったか)
      function checkQuarto() {
        const lines = [];

        // 行
        for (let r = 0; r < SIZE; r++) lines.push([{r, c:0}, {r, c:1}, {r, c:2}, {r, c:3}]);
        // 列
        for (let c = 0; c < SIZE; c++) lines.push([{r:0, c}, {r:1, c}, {r:2, c}, {r:3, c}]);
        // 斜め
        lines.push([{r:0, c:0}, {r:1, c:1}, {r:2, c:2}, {r:3, c:3}]);
        lines.push([{r:0, c:3}, {r:1, c:2}, {r:2, c:1}, {r:3, c:0}]);

        const traitKeys = [
          { key: 'color', name: '色' },
          { key: 'shape', name: '形状' },
          { key: 'height', name: '高さ' },
          { key: 'hole', name: '穴' }
        ];

        for (const line of lines) {
          const pieces = line.map(pos => board[pos.r][pos.c]).filter(id => id !== null).map(id => PIECES[id]);
          if (pieces.length === 4) {
            for (const t of traitKeys) {
              const val = pieces[0][t.key];
              if (pieces.every(p => p[t.key] === val)) {
                return { line: line, traitName: t.name };
              }
            }
          }
        }
        return null;
      }

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'quarto', type: 'restart' });
        }
      });

      bridge.onReceive((data) => {
        if (data.game !== 'quarto') return;
        if (data.type === 'place') {
          placePiece(data.r, data.c, data.pieceId, false);
        } else if (data.type === 'give') {
          givePieceToOpponent(data.pieceId, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！クアルト開始！');
      });

      initGame();
    },

    unmount() {}
  });
})();
