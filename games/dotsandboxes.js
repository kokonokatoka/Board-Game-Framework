/**
 * ✏️ ドット＆ボックス (Dots and Boxes) Component - CPU対戦完備版
 * Board Arena Plugin
 */

(function () {
  const ROWS = 4;
  const COLS = 4;
  const P1 = 1; // 青 (あなた)
  const P2 = 2; // 赤 (CPU / 相手)

  window.BoardArena.registerGame({
    id: 'dotsandboxes',
    name: 'ドット＆ボックス (Dots & Boxes)',
    icon: '✏️',
    category: '陣取り・ペン＆ペーパー',
    minPlayers: 1,
    maxPlayers: 2,
    description: '点をつないで四角を囲め！完成させれば連続ターンで一網打尽の世界的陣取りゲーム！CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let hLines = Array(ROWS + 1).fill(null).map(() => Array(COLS).fill(0));
      let vLines = Array(ROWS).fill(null).map(() => Array(COLS + 1).fill(0));
      let boxes = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

      let currentTurn = P1;
      let isGameOver = false;
      let p1Score = 0;
      let p2Score = 0;
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="dab-wrapper">
          <div class="dab-status-bar">
            <div class="dab-turn-group">
              <span class="turn-badge" id="dab-turn-badge">青の手番です</span>
              <button id="dab-mode-btn" class="btn btn-sm btn-subtle dab-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="dab-score-board">
              <span class="score-pill p1-pill">青 (あなた): <strong id="dab-p1-score">0</strong></span>
              <span class="score-pill p2-pill">赤 (${vsCpu ? 'CPU' : '相手'}): <strong id="dab-p2-score">0</strong></span>
            </div>
          </div>

          <!-- 4×4 ボックス盤面 -->
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

      if (!document.getElementById('dab-custom-css')) {
        const style = document.createElement('style');
        style.id = 'dab-custom-css';
        style.textContent = `
          .dab-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; max-width: 480px; margin: 0 auto; user-select: none; color: #f1f5f9; }
          .dab-status-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; background: #111827; padding: 8px 14px; border-radius: 8px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .dab-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 13px; font-weight: 700; background: #1e293b; padding: 5px 12px; border-radius: 8px; border: 1px solid #334155; }
          .dab-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .dab-score-board { display: flex; gap: 8px; }
          .score-pill { font-size: 13px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: #0f172a; }
          .score-pill.p1-pill { color: #38bdf8; border: 1px solid #0284c7; }
          .score-pill.p2-pill { color: #f87171; border: 1px solid #dc2626; }
          .dab-board-frame { width: 100%; aspect-ratio: 1; padding: 16px; background: #1e293b; border: 4px solid #334155; border-radius: 16px; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; }
          .dab-board { display: grid; grid-template-columns: repeat(4, 18px 1fr) 18px; grid-template-rows: repeat(4, 18px 1fr) 18px; width: 100%; height: 100%; max-width: 420px; max-height: 420px; }
          .dab-dot { background: #cbd5e1; border-radius: 50%; width: 14px; height: 14px; margin: auto; box-shadow: 0 0 6px rgba(255, 255, 255, 0.6); }
          .dab-edge-h { height: 12px; margin: auto 0; cursor: pointer; border-radius: 4px; transition: background 0.15s; background: rgba(255, 255, 255, 0.08); }
          .dab-edge-h:hover:not(.drawn) { background: rgba(56, 189, 248, 0.45); }
          .dab-edge-h.drawn.p1 { background: #38bdf8; box-shadow: 0 0 8px #0284c7; }
          .dab-edge-h.drawn.p2 { background: #f87171; box-shadow: 0 0 8px #dc2626; }
          .dab-edge-v { width: 12px; margin: 0 auto; cursor: pointer; border-radius: 4px; transition: background 0.15s; background: rgba(255, 255, 255, 0.08); }
          .dab-edge-v:hover:not(.drawn) { background: rgba(56, 189, 248, 0.45); }
          .dab-edge-v.drawn.p1 { background: #38bdf8; box-shadow: 0 0 8px #0284c7; }
          .dab-edge-v.drawn.p2 { background: #f87171; box-shadow: 0 0 8px #dc2626; }
          .dab-box { display: flex; justify-content: center; align-items: center; font-size: 20px; font-weight: 800; border-radius: 6px; transition: background 0.3s; }
          .dab-box.p1 { background: rgba(56, 189, 248, 0.35); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.6); }
          .dab-box.p2 { background: rgba(248, 113, 113, 0.35); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.6); }
          .dab-result-banner { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; width: 100%; background: #1e293b; border: 2px solid #10b981; padding: 10px 16px; border-radius: 8px; font-weight: 700; }
          .dab-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      const boardEl = container.querySelector('#dab-board');
      const turnBadge = container.querySelector('#dab-turn-badge');
      const modeBtn = container.querySelector('#dab-mode-btn');
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

      function drawLine(type, r, c, isLocal = false) {
        if (isGameOver) return;
        if (type === 'h' && hLines[r][c] !== 0) return;
        if (type === 'v' && vLines[r][c] !== 0) return;

        const player = currentTurn;
        if (type === 'h') hLines[r][c] = player;
        else vLines[r][c] = player;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'dotsandboxes', type: 'draw', lineType: type, r, c });
        }

        // 新たに完成したボックスのチェック
        const completedCount = checkNewlyCompletedBoxes(player);

        if (completedCount > 0) {
          if (player === P1) p1Score += completedCount;
          else p2Score += completedCount;
          bridge.showToast(`🎉 ${completedCount}個のボックスを獲得！連続ターン！`);
        } else {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        // ゲーム終了判定 (全16ボックス埋まり)
        if (p1Score + p2Score === ROWS * COLS) {
          isGameOver = true;
          let winnerMsg = '';
          if (p1Score > p2Score) {
            winnerMsg = `🎉 青 (あなた) の勝利！！ (${p1Score} vs ${p2Score})`;
            bridge.recordWin();
          } else if (p2Score > p1Score) {
            winnerMsg = vsCpu ? `💀 赤 (CPU) の勝利！ (${p2Score} vs ${p1Score})` : `🎉 赤 の勝利！！ (${p2Score} vs ${p1Score})`;
          } else {
            winnerMsg = `🤝 引き分け！ (${p1Score} vs ${p2Score})`;
          }
          resText.textContent = winnerMsg;
          resBanner.classList.remove('hidden');
          bridge.showToast(winnerMsg);
        }

        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      function checkNewlyCompletedBoxes(player) {
        let count = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (boxes[r][c] === 0) {
              const top = hLines[r][c] !== 0;
              const bottom = hLines[r + 1][c] !== 0;
              const left = vLines[r][c] !== 0;
              const right = vLines[r][c + 1] !== 0;

              if (top && bottom && left && right) {
                boxes[r][c] = player;
                count++;
              }
            }
          }
        }
        return count;
      }

      // 🧠 賢い思考型ドット＆ボックスCPU (AI)
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;

          // 全ての引ける線の候補を収集
          const candidates = [];
          for (let r = 0; r <= ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (hLines[r][c] === 0) candidates.push({ type: 'h', r, c });
            }
          }
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c <= COLS; c++) {
              if (vLines[r][c] === 0) candidates.push({ type: 'v', r, c });
            }
          }

          if (candidates.length === 0) return;

          // 1. ボックスを完成させられる手を最優先！
          for (const cand of candidates) {
            if (cand.type === 'h') hLines[cand.r][cand.c] = P2;
            else vLines[cand.r][cand.c] = P2;

            let completes = false;
            // 影響を受けるボックスの辺数をチェック
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                if (boxes[r][c] === 0) {
                  if (hLines[r][c] && hLines[r+1][c] && vLines[r][c] && vLines[r][c+1]) {
                    completes = true;
                    break;
                  }
                }
              }
              if (completes) break;
            }

            if (cand.type === 'h') hLines[cand.r][cand.c] = 0;
            else vLines[cand.r][cand.c] = 0;

            if (completes) {
              drawLine(cand.type, cand.r, cand.c, false);
              return;
            }
          }

          // 2. 相手にボックスを与えない「安全な手」を探索 (辺数が2にならない手)
          const safeCandidates = [];
          for (const cand of candidates) {
            if (cand.type === 'h') hLines[cand.r][cand.c] = P2;
            else vLines[cand.r][cand.c] = P2;

            let makesThree = false;
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                if (boxes[r][c] === 0) {
                  let edges = 0;
                  if (hLines[r][c]) edges++;
                  if (hLines[r+1][c]) edges++;
                  if (vLines[r][c]) edges++;
                  if (vLines[r][c+1]) edges++;
                  if (edges === 3) {
                    makesThree = true;
                    break;
                  }
                }
              }
              if (makesThree) break;
            }

            if (cand.type === 'h') hLines[cand.r][cand.c] = 0;
            else vLines[cand.r][cand.c] = 0;

            if (!makesThree) {
              safeCandidates.push(cand);
            }
          }

          if (safeCandidates.length > 0) {
            const chosen = safeCandidates[Math.floor(Math.random() * safeCandidates.length)];
            drawLine(chosen.type, chosen.r, chosen.c, false);
          } else {
            // 安全な手がない場合は最小限の損害になる手
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            drawLine(chosen.type, chosen.r, chosen.c, false);
          }
        }, 500);
      }

      function render() {
        boardEl.innerHTML = '';
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);

        p1ScoreEl.textContent = p1Score;
        p2ScoreEl.textContent = p2Score;

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🔵 あなたの手番 (青)';
            turnBadge.style.color = '#38bdf8';
          } else {
            turnBadge.textContent = vsCpu ? '🔴 CPU の考え中… (赤)' : '🔴 相手の手番 (赤)';
            turnBadge.style.color = '#f87171';
          }
        }

        // 9×9 グリッド構築
        for (let gr = 0; gr < 9; gr++) {
          for (let gc = 0; gc < 9; gc++) {
            const isRowDot = gr % 2 === 0;
            const isColDot = gc % 2 === 0;

            if (isRowDot && isColDot) {
              const dot = document.createElement('div');
              dot.className = 'dab-dot';
              boardEl.appendChild(dot);
            } else if (isRowDot && !isColDot) {
              const r = gr / 2;
              const c = (gc - 1) / 2;
              const edge = document.createElement('div');
              const val = hLines[r][c];
              edge.className = `dab-edge-h ${val === P1 ? 'drawn p1' : val === P2 ? 'drawn p2' : ''}`;

              if (val === 0 && isHumanTurn && !isGameOver) {
                edge.addEventListener('click', () => drawLine('h', r, c, isConnected));
              }
              boardEl.appendChild(edge);
            } else if (!isRowDot && isColDot) {
              const r = (gr - 1) / 2;
              const c = gc / 2;
              const edge = document.createElement('div');
              const val = vLines[r][c];
              edge.className = `dab-edge-v ${val === P1 ? 'drawn p1' : val === P2 ? 'drawn p2' : ''}`;

              if (val === 0 && isHumanTurn && !isGameOver) {
                edge.addEventListener('click', () => drawLine('v', r, c, isConnected));
              }
              boardEl.appendChild(edge);
            } else {
              const r = (gr - 1) / 2;
              const c = (gc - 1) / 2;
              const box = document.createElement('div');
              const owner = boxes[r][c];
              box.className = `dab-box ${owner === P1 ? 'p1' : owner === P2 ? 'p2' : ''}`;
              if (owner !== 0) box.textContent = owner === P1 ? '青' : '赤';
              boardEl.appendChild(box);
            }
          }
        }
      }

      bridge.onPlayerJoined(() => {
        myPlayer = bridge.isHost ? P1 : P2;
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！ドット＆ボックス開始！');
      });

      bridge.onReceive((data) => {
        if (data.game !== 'dotsandboxes') return;
        if (data.type === 'draw') {
          drawLine(data.lineType, data.r, data.c, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'dotsandboxes', type: 'restart' });
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
