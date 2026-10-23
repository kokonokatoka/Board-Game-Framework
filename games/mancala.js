/**
 * 🪨 マンカラ (Mancala / Kalah) Component - CPU対戦完備版
 * Board Arena Plugin
 */

(function () {
  const P1 = 1; // 下側プレイヤー (あなた・ストア 6)
  const P2 = 2; // 上側プレイヤー (CPU/相手・ストア 13)

  const P1_POCKETS = [0, 1, 2, 3, 4, 5];
  const P2_POCKETS = [7, 8, 9, 10, 11, 12];
  const P1_STORE = 6;
  const P2_STORE = 13;

  window.BoardArena.registerGame({
    id: 'mancala',
    name: 'マンカラ (Mancala)',
    icon: '🪨',
    category: '伝統・計算',
    minPlayers: 1,
    maxPlayers: 2,
    description: '世界最古の頭脳戦！石を撒いてゴールに集めろ！ピッタリゴールで連続ターン＆横取りが熱い！CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let board = Array(14).fill(4);
      board[P1_STORE] = 0;
      board[P2_STORE] = 0;

      let currentTurn = P1;
      let isGameOver = false;
      let lastSownPit = -1;
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="mancala-wrapper">
          <div class="mancala-status-bar">
            <div class="mancala-turn-group">
              <span class="turn-badge" id="mancala-turn-badge">P1の手番です</span>
              <button id="mancala-mode-btn" class="btn btn-sm btn-subtle mancala-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="mancala-hint" id="mancala-hint">ポケットを選んで石を撒いてください</div>
          </div>

          <!-- 木目調マンカラボード -->
          <div class="mancala-board-frame">
            <!-- P2 (左) ストア -->
            <div class="mancala-store p2-store" id="pit-13">
              <span class="store-label">${vsCpu ? 'CPU' : '相手'} ゴール</span>
              <span class="pit-count" id="count-13">0</span>
              <div class="stones-container" id="stones-13"></div>
            </div>

            <!-- 中央 2段 12ポケット -->
            <div class="mancala-center-pits">
              <!-- P2 側ポケット (12〜7) -->
              <div class="pits-row p2-row">
                ${[12, 11, 10, 9, 8, 7].map(idx => `
                  <div class="mancala-pit p2-pit" id="pit-${idx}" data-index="${idx}">
                    <span class="pit-count" id="count-${idx}">4</span>
                    <div class="stones-container" id="stones-${idx}"></div>
                  </div>
                `).join('')}
              </div>

              <!-- P1 側ポケット (0〜5) -->
              <div class="pits-row p1-row">
                ${[0, 1, 2, 3, 4, 5].map(idx => `
                  <div class="mancala-pit p1-pit" id="pit-${idx}" data-index="${idx}">
                    <span class="pit-count" id="count-${idx}">4</span>
                    <div class="stones-container" id="stones-${idx}"></div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- P1 (右) ストア -->
            <div class="mancala-store p1-store" id="pit-6">
              <span class="store-label">あなた ゴール</span>
              <span class="pit-count" id="count-6">0</span>
              <div class="stones-container" id="stones-6"></div>
            </div>
          </div>

          <!-- 結果バナー -->
          <div id="mancala-result-banner" class="mancala-result-banner hidden">
            <span id="mancala-result-text">勝敗結果</span>
            <button id="mancala-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      if (!document.getElementById('mancala-custom-css')) {
        const style = document.createElement('style');
        style.id = 'mancala-custom-css';
        style.textContent = `
          .mancala-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; max-width: 620px; margin: 0 auto; user-select: none; color: #f1f5f9; }
          .mancala-status-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; background: #111827; padding: 8px 14px; border-radius: 8px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .mancala-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 13px; font-weight: 700; background: #1e293b; padding: 5px 12px; border-radius: 8px; border: 1px solid #334155; }
          .mancala-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .mancala-hint { font-size: 12px; color: #94a3b8; }
          .mancala-board-frame { display: flex; align-items: center; justify-content: space-between; width: 100%; background: #451a03; border: 6px solid #78350f; border-radius: 20px; padding: 14px 10px; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6); gap: 10px; }
          .mancala-store { width: 62px; height: 170px; background: #271206; border-radius: 30px; box-shadow: inset 0 6px 12px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 10px 4px; }
          .p1-store { border: 2px solid #f59e0b; }
          .p2-store { border: 2px solid #38bdf8; }
          .store-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-align: center; }
          .pit-count { font-size: 15px; font-weight: 800; color: #fbbf24; }
          .mancala-center-pits { display: flex; flex-direction: column; gap: 10px; flex: 1; }
          .pits-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
          .mancala-pit { aspect-ratio: 1; background: #271206; border-radius: 50%; box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 5px; cursor: default; transition: transform 0.15s, box-shadow 0.15s; }
          .mancala-pit.selectable { cursor: pointer; border: 2px solid #f59e0b; }
          .mancala-pit.selectable:hover { transform: scale(1.08); box-shadow: inset 0 5px 10px rgba(0, 0, 0, 0.8), 0 0 12px #f59e0b; }
          .stones-container { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 2px; width: 80%; height: 55%; overflow: hidden; }
          .stone { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.8); }
          .stone.c1 { background: radial-gradient(circle at 30% 30%, #67e8f9, #0284c7); }
          .stone.c2 { background: radial-gradient(circle at 30% 30%, #fca5a5, #dc2626); }
          .stone.c3 { background: radial-gradient(circle at 30% 30%, #fde047, #ca8a04); }
          .stone.c4 { background: radial-gradient(circle at 30% 30%, #86efac, #16a34a); }
          .stone.c5 { background: radial-gradient(circle at 30% 30%, #d8b4fe, #9333ea); }
          .mancala-result-banner { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; width: 100%; background: #1e293b; border: 2px solid #10b981; padding: 10px 18px; border-radius: 8px; font-weight: 700; }
          .mancala-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      const turnBadge = container.querySelector('#mancala-turn-badge');
      const modeBtn = container.querySelector('#mancala-mode-btn');
      const hintEl = container.querySelector('#mancala-hint');
      const resBanner = container.querySelector('#mancala-result-banner');
      const resText = container.querySelector('#mancala-result-text');
      const restartBtn = container.querySelector('#mancala-restart-btn');

      function initGame() {
        board = Array(14).fill(4);
        board[P1_STORE] = 0;
        board[P2_STORE] = 0;
        currentTurn = P1;
        isGameOver = false;
        lastSownPit = -1;
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

      function render() {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🟡 あなたの手番 (下段)';
            turnBadge.style.color = '#f59e0b';
          } else {
            turnBadge.textContent = vsCpu ? '🔵 CPU の考え中… (上段)' : '🔵 相手の手番 (上段)';
            turnBadge.style.color = '#38bdf8';
          }

          hintEl.textContent = isHumanTurn ? '石のある自分のポケットを選んでください' : '相手の手を待っています…';
        }

        for (let i = 0; i < 14; i++) {
          const countEl = container.querySelector(`#count-${i}`);
          const stonesEl = container.querySelector(`#stones-${i}`);
          const pitEl = container.querySelector(`#pit-${i}`);

          if (countEl) countEl.textContent = board[i];

          if (stonesEl) {
            stonesEl.innerHTML = '';
            const count = board[i];
            const maxVisible = Math.min(count, 18);
            for (let s = 0; s < maxVisible; s++) {
              const stone = document.createElement('div');
              stone.className = `stone c${(s % 5) + 1}`;
              stonesEl.appendChild(stone);
            }
          }

          if (pitEl && !pitEl.classList.contains('mancala-store')) {
            const isP1Pit = P1_POCKETS.includes(i);
            const isP2Pit = P2_POCKETS.includes(i);
            const isCurrentPlayerPit = (currentTurn === P1 && isP1Pit) || (currentTurn === P2 && isP2Pit);
            const canSelect = isHumanTurn && isCurrentPlayerPit && board[i] > 0;

            pitEl.classList.toggle('selectable', canSelect);
          }
        }
      }

      [...P1_POCKETS, ...P2_POCKETS].forEach(idx => {
        const el = container.querySelector(`#pit-${idx}`);
        el.addEventListener('click', () => {
          const isConnected = bridge.isConnected();
          const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
          const isP1Pit = P1_POCKETS.includes(idx);
          const isP2Pit = P2_POCKETS.includes(idx);
          const isCurrentPlayerPit = (currentTurn === P1 && isP1Pit) || (currentTurn === P2 && isP2Pit);

          if (isHumanTurn && isCurrentPlayerPit && board[idx] > 0 && !isGameOver) {
            sowStones(idx, isConnected);
          }
        });
      });

      function sowStones(startPit, isLocal = false) {
        let stones = board[startPit];
        board[startPit] = 0;

        let currentPit = startPit;
        const player = currentTurn;

        while (stones > 0) {
          currentPit = (currentPit + 1) % 14;
          if (player === P1 && currentPit === P2_STORE) continue;
          if (player === P2 && currentPit === P1_STORE) continue;

          board[currentPit]++;
          stones--;
        }

        lastSownPit = currentPit;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'mancala', type: 'move', pit: startPit });
        }

        const myStore = player === P1 ? P1_STORE : P2_STORE;
        let getsFreeTurn = false;

        if (lastSownPit === myStore) {
          getsFreeTurn = true;
          bridge.showToast('🎯 ピッタリゴール！もう1手番！');
        } else {
          const myPockets = player === P1 ? P1_POCKETS : P2_POCKETS;
          if (myPockets.includes(lastSownPit) && board[lastSownPit] === 1) {
            const oppositePit = 12 - lastSownPit;
            if (board[oppositePit] > 0) {
              const captured = board[oppositePit] + board[lastSownPit];
              board[lastSownPit] = 0;
              board[oppositePit] = 0;
              board[myStore] += captured;
              bridge.showToast(`✨ ${captured}個の石を横取りしました！`);
            }
          }
        }

        checkGameOver();

        if (!isGameOver) {
          if (!getsFreeTurn) {
            currentTurn = currentTurn === P1 ? P2 : P1;
          }
        }

        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      // 🧠 賢い思考型マンカラCPU (AI)
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;

          const valids = P2_POCKETS.filter(p => board[p] > 0);
          if (valids.length === 0) return;

          // 1. ピッタリゴール (連続手番) になる手を探す
          for (const pit of valids) {
            const count = board[pit];
            // pit から反時計回りに count 個撒いて、最後が 13 になるか
            let cur = pit;
            let remaining = count;
            while (remaining > 0) {
              cur = (cur + 1) % 14;
              if (cur === P1_STORE) continue;
              remaining--;
            }
            if (cur === P2_STORE) {
              sowStones(pit, false);
              return;
            }
          }

          // 2. 横取りができる手を探す
          let bestCapturePit = null;
          let maxCaptured = 0;
          for (const pit of valids) {
            const count = board[pit];
            let cur = pit;
            let remaining = count;
            while (remaining > 0) {
              cur = (cur + 1) % 14;
              if (cur === P1_STORE) continue;
              remaining--;
            }
            if (P2_POCKETS.includes(cur)) {
              // 撒いた後で 1個になるか (元が0個)
              if (board[cur] === 0 || (cur === pit && count >= 13)) {
                const opp = 12 - cur;
                if (board[opp] > maxCaptured) {
                  maxCaptured = board[opp];
                  bestCapturePit = pit;
                }
              }
            }
          }

          if (bestCapturePit !== null && maxCaptured > 1) {
            sowStones(bestCapturePit, false);
            return;
          }

          // 3. 石が多いポケット、またはゴールに近いポケットを選択
          valids.sort((a, b) => board[b] - board[a]);
          sowStones(valids[0], false);
        }, 550);
      }

      function checkGameOver() {
        const p1Empty = P1_POCKETS.every(i => board[i] === 0);
        const p2Empty = P2_POCKETS.every(i => board[i] === 0);

        if (p1Empty || p2Empty) {
          isGameOver = true;
          P1_POCKETS.forEach(i => { board[P1_STORE] += board[i]; board[i] = 0; });
          P2_POCKETS.forEach(i => { board[P2_STORE] += board[i]; board[i] = 0; });

          const p1Score = board[P1_STORE];
          const p2Score = board[P2_STORE];

          let resMsg = '';
          if (p1Score > p2Score) {
            resMsg = `🎉 あなたの勝利！ (${p1Score} vs ${p2Score})`;
            bridge.recordWin();
          } else if (p2Score > p1Score) {
            resMsg = vsCpu ? `💀 CPU の勝利！ (${p2Score} vs ${p1Score})` : `🎉 P2 の勝利！ (${p2Score} vs ${p1Score})`;
          } else {
            resMsg = `🤝 引き分け！ (${p1Score} vs ${p2Score})`;
          }

          resText.textContent = resMsg;
          resBanner.classList.remove('hidden');
          bridge.showToast(resMsg);
        }
      }

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'mancala', type: 'restart' });
        }
      });

      bridge.onReceive((data) => {
        if (data.game !== 'mancala') return;
        if (data.type === 'move') {
          sowStones(data.pit, false);
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
        bridge.showToast('対戦相手が合流しました！マンカラ開始！');
      });

      initGame();

      return () => {
        isDestroyed = true;
      };
    }
  });
})();
