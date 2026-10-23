/**
 * ✏️ ドット＆ボックス (Dots and Boxes / 点つなぎ陣取り)
 * Board Arena Plugin
 * 
 * 世界中で愛されるクラシックな陣取りゲーム！
 * ドット間に線を結び、四角形（ボックス）を囲んで自分の領土にせよ！
 * マスを囲んだらボーナスでもう1本引ける連続奪取が超快感！
 */

(function () {
  const ROWS = 4; // 4×4 マス
  const COLS = 4;
  const P1 = 1;   // 青 (Blue)
  const P2 = 2;   // 赤 (Red)

  window.BoardArena.registerGame({
    id: 'dotsandboxes',
    name: 'ドット＆ボックス (Dots & Boxes)',
    icon: '✏️',
    category: '陣取り・ペン＆ペーパー',
    minPlayers: 2,
    maxPlayers: 2,
    description: '点をつないで四角を囲め！完成させれば連続ターンで一網打尽の世界的陣取りゲーム！',

    mount(container, bridge) {
      // 状態管理
      // 水平ライン: hLines[r][c] (r: 0〜ROWS, c: 0〜COLS-1) (5行×4列)
      let hLines = Array(ROWS + 1).fill(null).map(() => Array(COLS).fill(0));
      // 垂直ライン: vLines[r][c] (r: 0〜ROWS-1, c: 0〜COLS) (4行×5列)
      let vLines = Array(ROWS).fill(null).map(() => Array(COLS + 1).fill(0));
      // ボックスオーナー: boxes[r][c] = 0 (none), 1 (P1), 2 (P2)
      let boxes = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

      let currentTurn = P1;
      let isGameOver = false;
      let p1Score = 0;
      let p2Score = 0;
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="dab-wrapper">
          <div class="dab-status-bar">
            <div class="turn-badge" id="dab-turn-badge">P1の手番です</div>
            <div class="dab-score-board">
              <span class="score-pill p1-pill">P1: <strong id="dab-p1-score">0</strong></span>
              <span class="score-pill p2-pill">P2: <strong id="dab-p2-score">0</strong></span>
            </div>
          </div>

          <!-- 4×4 ボックス (5×5 ドット) 盤面 -->
          <div class="dab-board-frame">
            <div class="dab-board" id="dab-board"></div>
          </div>

          <!-- 結果バナー -->
          <div id="dab-result-banner" class="dab-result-banner hidden">
            <span id="dab-result-text">勝敗結果</span>
            <button id="dab-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('dab-custom-css')) {
        const style = document.createElement('style');
        style.id = 'dab-custom-css';
        style.textContent = `
          .dab-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
            user-select: none;
          }

          .dab-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .dab-score-board {
            display: flex;
            gap: 10px;
          }
          .score-pill {
            font-size: 14px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            background: #0f172a;
          }
          .p1-pill { color: #38bdf8; border: 1px solid #0284c7; }
          .p2-pill { color: #f87171; border: 1px solid #dc2626; }

          /* 盤面フレーム (ネオンボード) */
          .dab-board-frame {
            background: #0f172a;
            border: 2px solid #334155;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            width: 100%;
          }

          .dab-board {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 0;
            position: relative;
            aspect-ratio: 1;
            width: 100%;
          }

          /* 各マス（ボックス） */
          .dab-cell {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .dab-box-fill {
            width: 80%;
            height: 80%;
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 18px;
            font-weight: 900;
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .dab-box-fill.claimed {
            opacity: 1;
            transform: scale(1);
          }
          .dab-box-fill.p1 {
            background: rgba(56, 189, 248, 0.25);
            border: 2px solid #38bdf8;
            color: #38bdf8;
          }
          .dab-box-fill.p2 {
            background: rgba(248, 113, 113, 0.25);
            border: 2px solid #f87171;
            color: #f87171;
          }

          /* 点（ドット） */
          .dab-dot {
            position: absolute;
            width: 12px;
            height: 12px;
            background: #94a3b8;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            z-index: 20;
            box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
          }

          /* ライン（線） */
          .dab-line {
            position: absolute;
            z-index: 10;
            cursor: pointer;
            transition: background 0.15s, box-shadow 0.15s;
          }

          .dab-line-h {
            height: 8px;
            background: rgba(255, 255, 255, 0.08);
            transform: translateY(-50%);
            border-radius: 4px;
          }
          .dab-line-h:hover:not(.drawn) {
            background: rgba(255, 255, 255, 0.35);
          }

          .dab-line-v {
            width: 8px;
            background: rgba(255, 255, 255, 0.08);
            transform: translateX(-50%);
            border-radius: 4px;
          }
          .dab-line-v:hover:not(.drawn) {
            background: rgba(255, 255, 255, 0.35);
          }

          /* 引かれたライン */
          .dab-line.drawn {
            cursor: default;
          }
          .dab-line.drawn.p1 {
            background: #38bdf8 !important;
            box-shadow: 0 0 8px #38bdf8;
          }
          .dab-line.drawn.p2 {
            background: #f87171 !important;
            box-shadow: 0 0 8px #f87171;
          }

          /* 結果バナー */
          .dab-result-banner {
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
          .dab-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const boardEl = container.querySelector('#dab-board');
      const turnBadge = container.querySelector('#dab-turn-badge');
      const p1ScoreEl = container.querySelector('#dab-p1-score');
      const p2ScoreEl = container.querySelector('#dab-p2-score');
      const resBanner = container.querySelector('#dab-result-banner');
      const resText = container.querySelector('#dab-result-text');
      const restartBtn = container.querySelector('#dab-restart-btn');

      function initGame() {
        hLines = Array(ROWS + 1).fill(null).map(() => Array(COLS).fill(0));
        vLines = Array(ROWS).fill(null).map(() => Array(COLS + 1).fill(0));
        boxes = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        currentTurn = P1;
        isGameOver = false;
        p1Score = 0;
        p2Score = 0;
        resBanner.classList.add('hidden');
        render();
      }

      // 描画処理
      function render() {
        const isConnected = bridge.isConnected();
        const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;

        p1ScoreEl.textContent = p1Score;
        p2ScoreEl.textContent = p2Score;

        if (!isGameOver) {
          if (!isConnected) {
            turnBadge.textContent = `⏳ 待機中 (一人練習中: ${currentTurn === P1 ? '青 (P1)' : '赤 (P2)'})`;
            turnBadge.style.color = currentTurn === P1 ? '#38bdf8' : '#f87171';
          } else if (currentTurn === P1) {
            turnBadge.textContent = myPlayer === P1 ? '🟢 あなたの手番 (青・P1)' : '相手の考え中… (青・P1)';
            turnBadge.style.color = '#38bdf8';
          } else {
            turnBadge.textContent = myPlayer === P2 ? '🟢 あなたの手番 (赤・P2)' : '相手の考え中… (赤・P2)';
            turnBadge.style.color = '#f87171';
          }
        }

        boardEl.innerHTML = '';

        // 1. 4×4 セル（中央のボックス領域）を描画
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'dab-cell';

            const fill = document.createElement('div');
            fill.className = `dab-box-fill ${boxes[r][c] > 0 ? 'claimed p' + boxes[r][c] : ''}`;
            if (boxes[r][c] > 0) {
              fill.textContent = boxes[r][c] === P1 ? 'P1' : 'P2';
            }
            cell.appendChild(fill);
            boardEl.appendChild(cell);
          }
        }

        // 2. 水平ライン (Horizontal) 5行×4列
        for (let r = 0; r <= ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const hLine = document.createElement('div');
            const owner = hLines[r][c];
            hLine.className = `dab-line dab-line-h ${owner > 0 ? 'drawn p' + owner : ''}`;
            hLine.style.top = `${(r * 100) / ROWS}%`;
            hLine.style.left = `${(c * 100) / COLS}%`;
            hLine.style.width = `${100 / COLS}%`;

            if (owner === 0 && isMyTurn) {
              hLine.addEventListener('click', () => {
                drawLine('h', r, c, isConnected);
              });
            }
            boardEl.appendChild(hLine);
          }
        }

        // 3. 垂直ライン (Vertical) 4行×5列
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c <= COLS; c++) {
            const vLine = document.createElement('div');
            const owner = vLines[r][c];
            vLine.className = `dab-line dab-line-v ${owner > 0 ? 'drawn p' + owner : ''}`;
            vLine.style.top = `${(r * 100) / ROWS}%`;
            vLine.style.left = `${(c * 100) / COLS}%`;
            vLine.style.height = `${100 / ROWS}%`;

            if (owner === 0 && isMyTurn) {
              vLine.addEventListener('click', () => {
                drawLine('v', r, c, isConnected);
              });
            }
            boardEl.appendChild(vLine);
          }
        }

        // 4. 5×5 ドット
        for (let r = 0; r <= ROWS; r++) {
          for (let c = 0; c <= COLS; c++) {
            const dot = document.createElement('div');
            dot.className = 'dab-dot';
            dot.style.top = `${(r * 100) / ROWS}%`;
            dot.style.left = `${(c * 100) / COLS}%`;
            boardEl.appendChild(dot);
          }
        }
      }

      // 線を引く処理
      function drawLine(type, r, c, isLocal = false) {
        if (type === 'h') {
          if (hLines[r][c] > 0) return;
          hLines[r][c] = currentTurn;
        } else {
          if (vLines[r][c] > 0) return;
          vLines[r][c] = currentTurn;
        }

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'dotsandboxes', type: 'draw_line', lineType: type, r, c });
        }

        // ボックスが完成したか判定
        let completedBoxes = 0;
        for (let br = 0; br < ROWS; br++) {
          for (let bc = 0; bc < COLS; bc++) {
            if (boxes[br][bc] === 0) {
              // 上・下・左・右の4辺がすべて引かれているか
              const top = hLines[br][bc] > 0;
              const bottom = hLines[br + 1][bc] > 0;
              const left = vLines[br][bc] > 0;
              const right = vLines[br][bc + 1] > 0;

              if (top && bottom && left && right) {
                boxes[br][bc] = currentTurn;
                completedBoxes++;
                if (currentTurn === P1) p1Score++;
                else p2Score++;
              }
            }
          }
        }

        // ゲーム終了判定 (全16マス埋まったか)
        if (p1Score + p2Score === ROWS * COLS) {
          isGameOver = true;
          let msg = '';
          if (p1Score > p2Score) msg = `🎉 P1 (青) の勝利！ (${p1Score} vs ${p2Score})`;
          else if (p2Score > p1Score) msg = `🎉 P2 (赤) の勝利！ (${p2Score} vs ${p1Score})`;
          else msg = `🤝 引き分け！ (${p1Score} vs ${p2Score})`;

          resText.textContent = msg;
          resBanner.classList.remove('hidden');
          bridge.showToast(msg);
        } else {
          // ボックスを完成させた場合は「ボーナスターン（手番交代しない）」！
          if (completedBoxes > 0) {
            bridge.showToast(`🎯 マス獲得！もう1本引けます！(+${completedBoxes})`);
          } else {
            currentTurn = currentTurn === P1 ? P2 : P1;
          }
        }

        render();
      }

      // リスタート
      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'dotsandboxes', type: 'restart' });
        }
      });

      // P2P 受信イベント
      bridge.onReceive((data) => {
        if (data.game !== 'dotsandboxes') return;
        if (data.type === 'draw_line') {
          drawLine(data.lineType, data.r, data.c, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      // 相手合流イベント
      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！ドット＆ボックス開始！');
      });

      // 初期化
      initGame();
    },

    unmount() {
      // クリーンアップ
    }
  });
})();
