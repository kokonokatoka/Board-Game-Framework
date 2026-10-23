/**
 * 🏛️ クアルト (Quarto) Component - CPU対戦完備版
 * Board Arena Plugin
 */

(function () {
  const SIZE = 4;
  const P1 = 1; // あなた
  const P2 = 2; // CPU / 相手

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
    minPlayers: 1,
    maxPlayers: 2,
    description: '「自分が置くコマは相手が決める！」色・形・高さ・穴の共通点を4つ揃えろ！世界最高峰の心理戦！CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
      let availablePieces = new Set(PIECES.map(p => p.id));
      let selectedPieceForOpponent = null;
      let activePieceToPlace = null;
      let currentTurn = P1;
      let step = 'GIVE'; // 最初は相手に渡すコマを選ぶ
      let isGameOver = false;
      let winningLine = [];
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;

      // HTML UI
      container.innerHTML = `
        <div class="qrt-wrapper">
          <div class="qrt-status-bar">
            <div class="qrt-turn-group">
              <span class="turn-badge" id="qrt-turn-badge">P1の手番です</span>
              <button id="qrt-mode-btn" class="btn btn-sm btn-subtle qrt-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="active-piece-box" id="qrt-active-box">
              置くコマ: <span id="active-piece-display">なし</span>
            </div>
          </div>

          <!-- 4×4 盤面 -->
          <div class="qrt-board-frame">
            <div class="qrt-board" id="qrt-board"></div>
          </div>

          <!-- 手駒プール -->
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

      if (!document.getElementById('quarto-custom-css')) {
        const style = document.createElement('style');
        style.id = 'quarto-custom-css';
        style.textContent = `
          .qrt-wrapper { display: grid; grid-template-columns: minmax(320px, min(72vh, 620px)) 1fr; gap: 10px 24px; align-items: start; width: 100%; max-width: 1260px; margin: 0 auto; user-select: none; color: #f1f5f9; }
          .qrt-status-bar { grid-column: 1 / -1; width: 100%; display: flex; justify-content: space-between; align-items: center; background: #111827; padding: 8px 16px; border-radius: 10px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .qrt-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 14px; font-weight: 700; background: #1e293b; padding: 5px 14px; border-radius: 8px; border: 1px solid #334155; }
          .qrt-mode-btn { font-size: 12px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 10px; border-radius: 6px; cursor: pointer; }
          .active-piece-box { font-size: 14px; font-weight: 700; color: #fbbf24; background: #1e293b; padding: 6px 14px; border-radius: 8px; border: 1px solid #334155; display: flex; align-items: center; gap: 8px; }
          .qrt-board-frame { width: 100%; aspect-ratio: 1; padding: 16px; background: #451a03; border: 6px solid #78350f; border-radius: 18px; box-shadow: 0 16px 38px rgba(0,0,0,0.65); }
          .qrt-board { width: 100%; height: 100%; background: #271206; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 10px; border: 2px solid #5a2608; border-radius: 10px; padding: 10px; }
          .qrt-cell { background: #5c2b09; border-radius: 10px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: all 0.15s; }
          .qrt-cell:hover:not(.occupied) { background: #78350f; transform: scale(1.03); }
          .qrt-cell.win-highlight { box-shadow: 0 0 18px #f59e0b, inset 0 0 10px #f59e0b !important; }
          .qrt-piece { display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.3); position: relative; cursor: pointer; transition: transform 0.15s; }
          .qrt-piece:hover { transform: scale(1.1); }
          .qrt-piece.light { background: #fde68a; border: 2px solid #f59e0b; color: #78350f; }
          .qrt-piece.dark { background: #334155; border: 2px solid #1e293b; color: #94a3b8; }
          .qrt-piece.round { border-radius: 50%; }
          .qrt-piece.square { border-radius: 8px; }
          .qrt-piece.tall { width: 64px; height: 64px; }
          .qrt-piece.short { width: 44px; height: 44px; }
          .qrt-piece.hollow::after { content: ''; width: 40%; height: 40%; background: #0f172a; border-radius: 50%; position: absolute; box-shadow: inset 0 2px 4px rgba(0,0,0,0.8); }
          .qrt-pool-card { width: 100%; background: #18202c; border: 1px solid #2b384a; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
          .pool-header { font-size: 14px; font-weight: 700; color: #94a3b8; }
          .qrt-pool { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; justify-items: center; align-items: center; min-height: 180px; }
          .qrt-pool .qrt-piece.selected { box-shadow: 0 0 16px #38bdf8 !important; transform: scale(1.15); }
          .qrt-result-banner { grid-column: 1 / -1; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; width: 100%; background: #1e293b; border: 2px solid #10b981; padding: 10px 16px; border-radius: 8px; font-weight: 700; }
          .qrt-result-banner.hidden { display: none; }
          @media (max-width: 860px) {
            .qrt-wrapper { display: flex; flex-direction: column; align-items: center; }
          }
        `;
        document.head.appendChild(style);
      }

      const boardEl = container.querySelector('#qrt-board');
      const poolEl = container.querySelector('#qrt-pool');
      const turnBadge = container.querySelector('#qrt-turn-badge');
      const modeBtn = container.querySelector('#qrt-mode-btn');
      const activeDisplay = container.querySelector('#active-piece-display');
      const poolHeader = container.querySelector('#qrt-pool-header');
      const resBanner = container.querySelector('#qrt-result-banner');
      const resText = container.querySelector('#qrt-result-text');
      const restartBtn = container.querySelector('#qrt-restart-btn');

      function initGame() {
        board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
        availablePieces = new Set(PIECES.map(p => p.id));
        currentTurn = P1;
        step = 'GIVE';
        activePieceToPlace = null;
        selectedPieceForOpponent = null;
        isGameOver = false;
        winningLine = [];
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
          triggerCpuAction();
        }
      });

      function render() {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🟢 あなたの手番 (P1)';
            turnBadge.style.color = '#38bdf8';
          } else {
            turnBadge.textContent = vsCpu ? '🤖 CPU の考え中… (P2)' : '🔴 相手の手番 (P2)';
            turnBadge.style.color = '#f87171';
          }

          if (step === 'PLACE') {
            poolHeader.textContent = isHumanTurn ? '【配置】盤面の空きマスをクリックしてコマを置いてください' : '相手がコマを盤面に配置しています…';
          } else {
            poolHeader.textContent = isHumanTurn ? '👉 相手に渡すコマを下のプールから1つ選んでください！' : '相手があなたに渡すコマを選んでいます…';
          }
        }

        activeDisplay.innerHTML = '';
        if (activePieceToPlace !== null) {
          const piece = PIECES[activePieceToPlace];
          activeDisplay.appendChild(createPieceEl(piece));
        } else {
          activeDisplay.textContent = 'なし (選択中)';
        }

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
              cell.addEventListener('click', () => {
                if (isHumanTurn && step === 'PLACE' && activePieceToPlace !== null && !isGameOver) {
                  placePiece(r, c, activePieceToPlace, isConnected);
                }
              });
            }
            boardEl.appendChild(cell);
          }
        }

        poolEl.innerHTML = '';
        availablePieces.forEach(id => {
          const piece = PIECES[id];
          const pEl = createPieceEl(piece);
          if (selectedPieceForOpponent === id) pEl.classList.add('selected');

          pEl.addEventListener('click', () => {
            if (isHumanTurn && step === 'GIVE' && !isGameOver) {
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

      function placePiece(r, c, pieceId, isLocal = false) {
        board[r][c] = pieceId;
        availablePieces.delete(pieceId);
        activePieceToPlace = null;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'quarto', type: 'place', r, c, pieceId });
        }

        const win = checkQuarto();
        if (win) {
          isGameOver = true;
          winningLine = win.line;
          const winnerName = currentTurn === P1 ? '🎉 あなた (P1) の勝利！' : (vsCpu ? '💀 CPU (P2) の勝利！' : '🎉 P2 の勝利！');
          resText.textContent = `クアルト成立！！ ${winnerName} (${win.traitName}が4連)`;
          resBanner.classList.remove('hidden');
          bridge.showToast(`クアルト成立！${winnerName}`);
          if (currentTurn === P1) bridge.recordWin();
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

        step = 'GIVE';
        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuAction();
        }
      }

      function givePieceToOpponent(pieceId, isLocal = false) {
        activePieceToPlace = pieceId;
        step = 'PLACE';
        currentTurn = currentTurn === P1 ? P2 : P1;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'quarto', type: 'give', pieceId });
        }

        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuAction();
        }
      }

      // 🧠 思考型クアルトCPU (AI)
      function triggerCpuAction() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;

          if (step === 'PLACE' && activePieceToPlace !== null) {
            // 1. PLACE フェーズ: 空きマスからクアルト成立マスを探索
            const emptyCells = [];
            for (let r = 0; r < SIZE; r++) {
              for (let c = 0; c < SIZE; c++) {
                if (board[r][c] === null) emptyCells.push({ r, c });
              }
            }

            // 即座にクアルトが完成するマスがあれば最優先でそこに置く！
            let bestCell = null;
            for (const cell of emptyCells) {
              board[cell.r][cell.c] = activePieceToPlace;
              if (checkQuarto()) {
                bestCell = cell;
                board[cell.r][cell.c] = null;
                break;
              }
              board[cell.r][cell.c] = null;
            }

            if (!bestCell) {
              bestCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            }

            placePiece(bestCell.r, bestCell.c, activePieceToPlace, false);

          } else if (step === 'GIVE') {
            // 2. GIVE フェーズ: 相手に渡してもクアルトを即成立させられない安全なコマを渡す！
            const poolArray = Array.from(availablePieces);
            if (poolArray.length === 0) return;

            let safePiece = null;
            for (const pId of poolArray) {
              let causesWin = false;
              for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                  if (board[r][c] === null) {
                    board[r][c] = pId;
                    if (checkQuarto()) causesWin = true;
                    board[r][c] = null;
                    if (causesWin) break;
                  }
                }
                if (causesWin) break;
              }

              if (!causesWin) {
                safePiece = pId;
                break;
              }
            }

            const chosen = safePiece !== null ? safePiece : poolArray[0];
            givePieceToOpponent(chosen, false);
          }
        }, 500);
      }

      function checkQuarto() {
        const lines = [];
        for (let r = 0; r < SIZE; r++) lines.push([{r, c:0}, {r, c:1}, {r, c:2}, {r, c:3}]);
        for (let c = 0; c < SIZE; c++) lines.push([{r:0, c}, {r:1, c}, {r:2, c}, {r:3, c}]);
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
        myPlayer = bridge.isHost ? P1 : P2;
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！クアルト開始！');
      });

      initGame();

      return () => {
        isDestroyed = true;
      };
    }
  });
})();
