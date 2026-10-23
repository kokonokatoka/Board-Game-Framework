/**
 * 🟢 Othello Component (Board Arena Plugin) - CPU対戦完備版
 */

(function () {
  const BOARD_SIZE = 8;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  // オセロ盤面評価表 (角重視・危険マス回避)
  const POSITION_WEIGHTS = [
    [ 120, -20,  20,   5,   5,  20, -20,  120],
    [ -20, -40,  -5,  -5,  -5,  -5, -40,  -20],
    [  20,  -5,  15,   3,   3,  15,  -5,   20],
    [   5,  -5,   3,   3,   3,   3,  -5,    5],
    [   5,  -5,   3,   3,   3,   3,  -5,    5],
    [  20,  -5,  15,   3,   3,  15,  -5,   20],
    [ -20, -40,  -5,  -5,  -5,  -5, -40,  -20],
    [ 120, -20,  20,   5,   5,  20, -20,  120]
  ];

  window.BoardArena.registerGame({
    id: 'othello',
    name: 'オセロ (リバーシ)',
    category: 'ボードゲーム',
    icon: '🟢',
    players: '1〜2人',
    playTime: '5-10分',
    description: '白と黒の石を挟んでひっくり返す名作頭脳戦。置けるマスのガイド表示＆思考型CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let board = [];
      let currentTurn = BLACK;
      let isGameOver = false;
      let vsCpu = !bridge.isConnected(); // 未接続時はデフォルトでCPU対戦！
      const myColor = bridge.isHost ? BLACK : WHITE;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="othello-wrapper">
          <div class="othello-status-bar">
            <div class="othello-turn-group">
              <span class="turn-badge" id="othello-turn-badge">黒の手番です</span>
              <button id="oth-mode-btn" class="btn btn-sm btn-subtle oth-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="othello-score">
              <span class="sc-item black">⚫ あなた: <span id="oth-b-count">2</span></span>
              <span class="sc-vs">vs</span>
              <span class="sc-item white">⚪ ${vsCpu ? 'CPU' : '相手'}: <span id="oth-w-count">2</span></span>
            </div>
          </div>
          <div class="othello-board-frame">
            <div id="othello-grid" class="othello-grid"></div>
          </div>
          <div id="othello-result" class="othello-result-banner hidden">
            <span id="oth-res-text">結果</span>
            <button id="oth-restart-btn" class="btn btn-sm btn-primary">再戦する</button>
          </div>
        </div>
      `;

      const gridEl = container.querySelector('#othello-grid');
      const turnBadge = container.querySelector('#othello-turn-badge');
      const modeBtn = container.querySelector('#oth-mode-btn');
      const bCountEl = container.querySelector('#oth-b-count');
      const wCountEl = container.querySelector('#oth-w-count');
      const resBanner = container.querySelector('#othello-result');
      const resText = container.querySelector('#oth-res-text');
      const restartBtn = container.querySelector('#oth-restart-btn');

      if (!document.getElementById('othello-custom-css')) {
        const style = document.createElement('style');
        style.id = 'othello-custom-css';
        style.textContent = `
          .othello-wrapper { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 480px; margin: 0 auto; }
          .othello-status-bar { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
          .othello-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 13px; font-weight: 700; background: #1e293b; padding: 5px 12px; border-radius: 10px; border: 1px solid #334155; }
          .oth-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .othello-score { display: flex; gap: 8px; font-weight: 800; font-size: 14px; align-items: center; }
          .sc-item { padding: 4px 8px; border-radius: 8px; }
          .sc-item.black { background: #000; color: #fff; border: 1px solid #333; }
          .sc-item.white { background: #fff; color: #000; }
          .sc-vs { color: #64748b; font-size: 12px; }
          .othello-board-frame { width: 100%; aspect-ratio: 1/1; padding: 10px; background: #3e2723; border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.6); }
          .othello-grid { width: 100%; height: 100%; background: #1b5e20; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); gap: 2px; border: 2px solid #000; }
          .oth-cell { background: #2e7d32; display: flex; justify-content: center; align-items: center; cursor: pointer; position: relative; }
          .oth-cell:hover { background: #388e3c; }
          .oth-cell.valid::after { content: ''; width: 22%; height: 22%; background: rgba(255,255,255,0.45); border-radius: 50%; box-shadow: 0 0 8px #fff; }
          .oth-piece { width: 84%; height: 84%; border-radius: 50%; transition: transform 0.25s; }
          .oth-piece.b { background: radial-gradient(circle at 35% 35%, #444, #000); box-shadow: 0 3px 6px rgba(0,0,0,0.6); }
          .oth-piece.w { background: radial-gradient(circle at 35% 35%, #fff, #cbd5e1); box-shadow: 0 3px 6px rgba(0,0,0,0.4); }
          .othello-result-banner { margin-top: 14px; background: #1e293b; border: 1px solid #10b981; padding: 10px 20px; border-radius: 12px; display: flex; gap: 14px; align-items: center; font-weight: 700; color: #10b981; }
        `;
        document.head.appendChild(style);
      }

      function initGame() {
        board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
        board[3][3] = WHITE;
        board[3][4] = BLACK;
        board[4][3] = BLACK;
        board[4][4] = WHITE;

        currentTurn = BLACK;
        isGameOver = false;
        resBanner.classList.add('hidden');
        render();
      }

      // モード切替
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

      function getFlips(r, c, color) {
        if (board[r][c] !== EMPTY) return [];
        const opponent = color === BLACK ? WHITE : BLACK;
        let flippable = [];

        for (const [dr, dc] of DIRECTIONS) {
          let nr = r + dr;
          let nc = c + dc;
          let line = [];

          while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === opponent) {
            line.push([nr, nc]);
            nr += dr;
            nc += dc;
          }

          if (line.length > 0 && nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === color) {
            flippable = flippable.concat(line);
          }
        }
        return flippable;
      }

      function getValidMoves(color) {
        const moves = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const flips = getFlips(r, c, color);
            if (flips.length > 0) moves.push({ r, c, count: flips.length });
          }
        }
        return moves;
      }

      function makeMove(r, c, color, isLocal = false) {
        const flips = getFlips(r, c, color);
        if (flips.length === 0) return;

        board[r][c] = color;
        for (const [fr, fc] of flips) board[fr][fc] = color;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'othello', type: 'move', r, c });
        }

        currentTurn = color === BLACK ? WHITE : BLACK;
        render();
        checkNext();
      }

      function checkNext() {
        if (isGameOver) return;
        const valids = getValidMoves(currentTurn);

        if (valids.length === 0) {
          const opponent = currentTurn === BLACK ? WHITE : BLACK;
          const oppValids = getValidMoves(opponent);
          if (oppValids.length === 0) {
            endMatch();
            return;
          } else {
            bridge.showToast(`${currentTurn === BLACK ? '黒' : '白'}は置ける場所がないためパス！`);
            currentTurn = opponent;
            render();
          }
        }

        // CPU手番チェック
        if (vsCpu && currentTurn === WHITE && !isGameOver) {
          triggerCpuMove();
        }
      }

      // 🧠 賢い思考型オセロCPU (AI)
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== WHITE || isDestroyed) return;
          const valids = getValidMoves(WHITE);
          if (valids.length === 0) return;

          // 評価スコア計算: 盤面位置重み + ひっくり返し数
          let bestMove = valids[0];
          let bestScore = -9999;

          valids.forEach(m => {
            let score = POSITION_WEIGHTS[m.r][m.c] + m.count * 2;
            // 四隅の周りでも、すでに四隅が埋まっていれば安全
            if (POSITION_WEIGHTS[m.r][m.c] < 0) {
              const cornerR = m.r <= 1 ? 0 : 7;
              const cornerC = m.c <= 1 ? 0 : 7;
              if (board[cornerR][cornerC] === WHITE) {
                score += 40; // 隅を取っていれば安全
              }
            }
            if (score > bestScore) {
              bestScore = score;
              bestMove = m;
            }
          });

          makeMove(bestMove.r, bestMove.c, WHITE, false);
        }, 500);
      }

      function endMatch() {
        isGameOver = true;
        let b = 0, w = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) b++;
            if (board[r][c] === WHITE) w++;
          }
        }
        let winner = b > w ? '黒 (あなた) の勝利！' : b < w ? (vsCpu ? '白 (CPU) の勝利！' : '白 の勝利！') : '引き分け！';
        resText.textContent = `${winner} (${b} vs ${w})`;
        resBanner.classList.remove('hidden');
        if (b > w) bridge.recordWin();
      }

      function render() {
        gridEl.innerHTML = '';
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === BLACK) || (isConnected && currentTurn === myColor);
        const validColor = isConnected ? myColor : currentTurn;
        const validMoves = (isHumanTurn && !isGameOver) ? getValidMoves(validColor) : [];
        const validSet = new Set(validMoves.map(m => `${m.r},${m.c}`));

        let b = 0, w = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'oth-cell';
            const val = board[r][c];

            if (val === BLACK) {
              cell.innerHTML = '<div class="oth-piece b"></div>';
              b++;
            } else if (val === WHITE) {
              cell.innerHTML = '<div class="oth-piece w"></div>';
              w++;
            } else if (validSet.has(`${r},${c}`)) {
              cell.classList.add('valid');
              cell.addEventListener('click', () => {
                if (isHumanTurn && !isGameOver) {
                  makeMove(r, c, validColor, isConnected);
                }
              });
            }
            gridEl.appendChild(cell);
          }
        }

        bCountEl.textContent = b;
        wCountEl.textContent = w;

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
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！オセロ対戦開始！');
      });

      bridge.onReceive((data) => {
        if (data.game !== 'othello') return;
        if (data.type === 'move') {
          const oppColor = myColor === BLACK ? WHITE : BLACK;
          makeMove(data.r, data.c, oppColor, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦が開始されました！');
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'othello', type: 'restart' });
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
