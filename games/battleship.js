/**
 * 🚢 バトルシップ (Battleship / 海戦ゲーム) Component - CPU対戦完備版
 * Board Arena Plugin
 */

(function () {
  const SIZE = 10;
  const SHIPS = [
    { id: 'carrier', name: '航空母艦', size: 5, icon: '🚢' },
    { id: 'battleship', name: '戦艦', size: 4, icon: '🛳️' },
    { id: 'cruiser', name: '巡洋艦', size: 3, icon: '🚤' },
    { id: 'submarine', name: '潜水艦', size: 3, icon: '🦈' },
    { id: 'destroyer', name: '駆逐艦', size: 2, icon: '⛵' }
  ];
  const TOTAL_SHIP_CELLS = 5 + 4 + 3 + 3 + 2; // 17マス

  const P1 = 1; // あなた
  const P2 = 2; // CPU / 相手

  window.BoardArena.registerGame({
    id: 'battleship',
    name: 'バトルシップ (Battleship)',
    icon: '🚢',
    category: '海戦・推理',
    minPlayers: 1,
    maxPlayers: 2,
    description: '10×10の海域に潜む敵艦隊をレーダー索敵！「命中！」「波高し！」「撃沈！」の名作海戦バトル！本格CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let myGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
      let oppGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
      let cpuRealGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)); // CPUの実際の船配置

      let myHits = 0;   // 相手に命中させた数 (17で勝利)
      let oppHits = 0;  // 相手から命中された数 (17で敗北)

      let phase = 'PLACEMENT'; // 'PLACEMENT' | 'READY_WAIT' | 'BATTLE' | 'GAME_OVER'
      let currentTurn = P1;
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;

      // CPU索敵AIのメモリ
      let cpuHitStack = [];

      // HTML UI
      container.innerHTML = `
        <div class="bs-wrapper">
          <div class="bs-status-bar">
            <div class="bs-turn-group">
              <span class="turn-badge" id="bs-turn-badge">艦隊を配置してください</span>
              <button id="bs-mode-btn" class="btn btn-sm btn-subtle bs-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="bs-ship-counter" id="bs-ship-counter">撃沈スコア: 0 / 17</div>
          </div>

          <!-- バトルフィールド -->
          <div class="bs-boards-container">
            <div class="bs-board-card">
              <div class="board-header">🛡️ あなたの海域 (自艦隊)</div>
              <div class="bs-grid" id="my-grid"></div>
            </div>

            <div class="bs-board-card radar-card">
              <div class="board-header">🎯 ${vsCpu ? 'CPU' : '敵'}の海域 (攻撃レーダー)</div>
              <div class="bs-grid" id="opp-grid"></div>
            </div>
          </div>

          <!-- 配置バー -->
          <div class="bs-placement-bar" id="bs-placement-bar">
            <span class="placement-hint">🚢 船を配置して「出撃準備完了」を押してください</span>
            <button id="btn-random-place" class="btn btn-sm btn-secondary">🎲 ランダム再配置</button>
            <button id="btn-ready" class="btn btn-sm btn-primary">✅ 出撃準備完了！</button>
          </div>

          <!-- 結果バナー -->
          <div id="bs-result-banner" class="bs-result-banner hidden">
            <span id="bs-result-text">勝敗結果</span>
            <button id="bs-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      if (!document.getElementById('battleship-custom-css')) {
        const style = document.createElement('style');
        style.id = 'battleship-custom-css';
        style.textContent = `
          .bs-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; max-width: 840px; margin: 0 auto; user-select: none; color: #f1f5f9; }
          .bs-status-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; background: #111827; padding: 8px 14px; border-radius: 8px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .bs-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 13px; font-weight: 700; background: #1e293b; padding: 5px 12px; border-radius: 8px; border: 1px solid #334155; }
          .bs-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .bs-ship-counter { font-size: 13px; font-weight: 700; color: #38bdf8; }
          .bs-boards-container { display: flex; justify-content: center; gap: 16px; width: 100%; flex-wrap: wrap; }
          .bs-board-card { background: #0f172a; border: 2px solid #334155; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
          .bs-board-card.radar-card { border-color: #0284c7; box-shadow: 0 0 15px rgba(2, 132, 199, 0.25); }
          .board-header { font-size: 13px; font-weight: 800; color: #cbd5e1; }
          .radar-card .board-header { color: #38bdf8; }
          .bs-grid { display: grid; grid-template-columns: repeat(10, 26px); grid-template-rows: repeat(10, 26px); gap: 2px; background: #1e293b; padding: 4px; border-radius: 6px; }
          .bs-cell { background: #0284c715; border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 3px; display: flex; justify-content: center; align-items: center; font-size: 13px; cursor: pointer; transition: all 0.1s; }
          .bs-cell.ship { background: #0369a1; border-color: #38bdf8; }
          .bs-cell.hit { background: #dc2626 !important; border-color: #f87171 !important; color: #fff; animation: hitPulse 0.35s ease; }
          @keyframes hitPulse { 0% { transform: scale(1.3); } 100% { transform: scale(1); } }
          .bs-cell.miss { background: #334155 !important; border-color: #64748b !important; color: #94a3b8; }
          .radar-card .bs-cell:hover:not(.hit):not(.miss) { background: rgba(56, 189, 248, 0.45); transform: scale(1.1); }
          .bs-placement-bar { display: flex; align-items: center; justify-content: space-between; width: 100%; background: #18202c; padding: 8px 14px; border-radius: 8px; border: 1px solid #2b384a; gap: 10px; flex-wrap: wrap; }
          .bs-placement-bar.hidden { display: none; }
          .placement-hint { font-size: 12px; color: #94a3b8; }
          .bs-result-banner { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; width: 100%; background: #1e293b; border: 2px solid #10b981; padding: 10px 16px; border-radius: 8px; font-weight: 700; }
          .bs-result-banner.hidden { display: none; }
          @media (max-width: 640px) {
            .bs-grid { grid-template-columns: repeat(10, 22px); grid-template-rows: repeat(10, 22px); }
          }
        `;
        document.head.appendChild(style);
      }

      const myGridEl = container.querySelector('#my-grid');
      const oppGridEl = container.querySelector('#opp-grid');
      const turnBadge = container.querySelector('#bs-turn-badge');
      const modeBtn = container.querySelector('#bs-mode-btn');
      const counterEl = container.querySelector('#bs-ship-counter');
      const placementBar = container.querySelector('#bs-placement-bar');
      const btnRandomPlace = container.querySelector('#btn-random-place');
      const btnReady = container.querySelector('#btn-ready');
      const resBanner = container.querySelector('#bs-result-banner');
      const resText = container.querySelector('#bs-result-text');
      const restartBtn = container.querySelector('#bs-restart-btn');

      function initGame() {
        myGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
        oppGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
        cpuRealGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
        myHits = 0;
        oppHits = 0;
        phase = 'PLACEMENT';
        currentTurn = P1;
        cpuHitStack = [];

        resBanner.classList.add('hidden');
        placementBar.classList.remove('hidden');

        randomPlaceShips(myGrid);
        if (vsCpu) randomPlaceShips(cpuRealGrid);

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
        initGame();
      });

      function randomPlaceShips(grid) {
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) grid[r][c] = 0;

        SHIPS.forEach(ship => {
          let placed = false;
          let attempts = 0;
          while (!placed && attempts < 200) {
            attempts++;
            const isHorizontal = Math.random() < 0.5;
            const r = Math.floor(Math.random() * (isHorizontal ? SIZE : SIZE - ship.size + 1));
            const c = Math.floor(Math.random() * (isHorizontal ? SIZE - ship.size + 1 : SIZE));

            let canPlace = true;
            for (let i = 0; i < ship.size; i++) {
              const cr = isHorizontal ? r : r + i;
              const cc = isHorizontal ? c + i : c;
              if (grid[cr][cc] !== 0) {
                canPlace = false;
                break;
              }
            }

            if (canPlace) {
              for (let i = 0; i < ship.size; i++) {
                const cr = isHorizontal ? r : r + i;
                const cc = isHorizontal ? c + i : c;
                grid[cr][cc] = ship.id;
              }
              placed = true;
            }
          }
        });
      }

      function render() {
        const isConnected = bridge.isConnected();

        if (phase === 'PLACEMENT') {
          turnBadge.textContent = '🚢 自艦隊を配置してください（出撃準備）';
          turnBadge.style.color = '#38bdf8';
        } else if (phase === 'READY_WAIT') {
          turnBadge.textContent = '⏳ 相手の配置完了を待っています…';
          turnBadge.style.color = '#f59e0b';
        } else if (phase === 'BATTLE') {
          const myTurnNow = (!isConnected || currentTurn === myPlayer);
          turnBadge.textContent = myTurnNow ? '🔴 あなたの攻撃手番！敵海域をクリックして砲撃！' : (vsCpu ? '🤖 CPU の索敵中…' : '相手の砲撃を待っています…');
          turnBadge.style.color = myTurnNow ? '#f87171' : '#94a3b8';
        }

        counterEl.textContent = `命中スコア: ${myHits} / ${TOTAL_SHIP_CELLS}`;

        // 1. 自海域
        myGridEl.innerHTML = '';
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'bs-cell';
            const val = myGrid[r][c];

            if (val === 'hit') {
              cell.classList.add('hit');
              cell.textContent = '💥';
            } else if (val === 'miss') {
              cell.classList.add('miss');
              cell.textContent = '💦';
            } else if (val !== 0) {
              cell.classList.add('ship');
              cell.textContent = '⚓';
            }
            myGridEl.appendChild(cell);
          }
        }

        // 2. 敵海域 (レーダー)
        oppGridEl.innerHTML = '';
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'bs-cell';
            const val = oppGrid[r][c];

            if (val === 'hit') {
              cell.classList.add('hit');
              cell.textContent = '💥';
            } else if (val === 'miss') {
              cell.classList.add('miss');
              cell.textContent = '💦';
            }

            cell.addEventListener('click', () => {
              const myTurnNow = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
              if (phase === 'BATTLE' && myTurnNow && oppGrid[r][c] === 0) {
                fireAt(r, c);
              }
            });

            oppGridEl.appendChild(cell);
          }
        }
      }

      function fireAt(r, c) {
        if (oppGrid[r][c] !== 0) return;

        if (bridge.isConnected()) {
          bridge.send({ game: 'battleship', type: 'fire', r, c });
          turnBadge.textContent = '💥 砲撃中...';
        } else if (vsCpu) {
          // 本格CPU海域に対する着弾判定！
          const hitShip = cpuRealGrid[r][c];
          if (hitShip !== 0 && hitShip !== 'hit' && hitShip !== 'miss') {
            oppGrid[r][c] = 'hit';
            cpuRealGrid[r][c] = 'hit';
            myHits++;
            bridge.showToast('🎯 命中！！見事な砲撃！');
          } else {
            oppGrid[r][c] = 'miss';
            bridge.showToast('💦 波高し…外れました。');
          }

          checkGameOver();

          if (phase === 'BATTLE') {
            currentTurn = P2;
            render();
            triggerCpuFire();
          }
        } else {
          // 2人ローカルモード
          const isHit = Math.random() < 0.45;
          oppGrid[r][c] = isHit ? 'hit' : 'miss';
          if (isHit) myHits++;
          checkGameOver();
          render();
        }
      }

      // 🧠 賢い思考型バトルシップCPU (索敵・追撃AI)
      function triggerCpuFire() {
        if (phase !== 'BATTLE' || isDestroyed) return;

        setTimeout(() => {
          if (phase !== 'BATTLE' || currentTurn !== P2 || isDestroyed) return;

          let targetR = -1, targetC = -1;

          // 1. 命中履歴スタックがある場合、その周囲を集中砲撃！
          while (cpuHitStack.length > 0) {
            const lastHit = cpuHitStack[cpuHitStack.length - 1];
            const neighbors = [
              { r: lastHit.r - 1, c: lastHit.c },
              { r: lastHit.r + 1, c: lastHit.c },
              { r: lastHit.r, c: lastHit.c - 1 },
              { r: lastHit.r, c: lastHit.c + 1 }
            ].filter(p => p.r >= 0 && p.r < SIZE && p.c >= 0 && p.c < SIZE && myGrid[p.r][p.c] !== 'hit' && myGrid[p.r][p.c] !== 'miss');

            if (neighbors.length > 0) {
              const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
              targetR = chosen.r;
              targetC = chosen.c;
              break;
            } else {
              cpuHitStack.pop(); // 周囲が打ち尽くされたらポップ
            }
          }

          // 2. スタックがない場合、市松模様優先ランダム探索
          if (targetR === -1) {
            const huntTargets = [];
            for (let r = 0; r < SIZE; r++) {
              for (let c = 0; c < SIZE; c++) {
                if (myGrid[r][c] !== 'hit' && myGrid[r][c] !== 'miss') {
                  if ((r + c) % 2 === 0) huntTargets.push({ r, c });
                }
              }
            }

            const pool = huntTargets.length > 0 ? huntTargets : getAllRemainingCells();
            if (pool.length > 0) {
              const chosen = pool[Math.floor(Math.random() * pool.length)];
              targetR = chosen.r;
              targetC = chosen.c;
            }
          }

          if (targetR !== -1) {
            const val = myGrid[targetR][targetC];
            const isHit = val !== 0 && val !== 'hit' && val !== 'miss';

            if (isHit) {
              myGrid[targetR][targetC] = 'hit';
              oppHits++;
              cpuHitStack.push({ r: targetR, c: targetC });
              bridge.showToast('💥 敵CPUの砲撃が自艦に命中しました！');
            } else {
              myGrid[targetR][targetC] = 'miss';
              bridge.showToast('💦 敵CPUの砲撃は外れました！');
            }

            checkGameOver();
            if (phase === 'BATTLE') {
              currentTurn = P1;
            }
            render();
          }
        }, 600);
      }

      function getAllRemainingCells() {
        const res = [];
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (myGrid[r][c] !== 'hit' && myGrid[r][c] !== 'miss') res.push({ r, c });
          }
        }
        return res;
      }

      function handleIncomingFire(r, c) {
        const val = myGrid[r][c];
        const isHit = val !== 0 && val !== 'hit' && val !== 'miss';

        if (isHit) {
          myGrid[r][c] = 'hit';
          oppHits++;
          bridge.send({ game: 'battleship', type: 'fire_result', r, c, result: 'hit' });
          bridge.showToast('💥 敵の砲撃が自艦に命中しました！');
        } else {
          if (val === 0) myGrid[r][c] = 'miss';
          bridge.send({ game: 'battleship', type: 'fire_result', r, c, result: 'miss' });
          bridge.showToast('💦 敵の砲撃は外れました (波高し)！');
        }

        currentTurn = currentTurn === P1 ? P2 : P1;
        checkGameOver();
        render();
      }

      function checkGameOver() {
        if (myHits >= TOTAL_SHIP_CELLS) {
          phase = 'GAME_OVER';
          resText.textContent = '🎉 敵艦隊を全滅させました！あなたの完全勝利！！';
          resBanner.classList.remove('hidden');
          bridge.showToast('勝利！敵艦隊全滅！');
          bridge.recordWin();
        } else if (oppHits >= TOTAL_SHIP_CELLS) {
          phase = 'GAME_OVER';
          resText.textContent = vsCpu ? '💀 自艦隊が全滅しました…CPUの勝利…' : '💀 自艦隊が全滅しました…あなたの敗北…';
          resBanner.classList.remove('hidden');
          bridge.showToast('敗北…自艦隊全滅');
        }
      }

      btnRandomPlace.addEventListener('click', () => {
        randomPlaceShips(myGrid);
        bridge.showToast('艦隊をランダム配置しました');
        render();
      });

      btnReady.addEventListener('click', () => {
        phase = 'READY_WAIT';
        placementBar.classList.add('hidden');
        render();

        if (bridge.isConnected()) {
          bridge.send({ game: 'battleship', type: 'ready' });
        } else if (vsCpu) {
          phase = 'BATTLE';
          bridge.showToast('砲撃戦開始！敵海域をクリックして攻撃してください！');
          render();
        } else {
          phase = 'BATTLE';
          bridge.showToast('砲撃戦開始！敵海域をクリックして攻撃してください！');
          render();
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'battleship', type: 'restart' });
        }
      });

      bridge.onReceive((data) => {
        if (data.game !== 'battleship') return;

        if (data.type === 'ready') {
          if (phase === 'READY_WAIT') {
            phase = 'BATTLE';
            bridge.showToast('双方準備完了！海戦バトル開始！');
            render();
          } else {
            bridge.showToast('相手は準備完了しました！');
          }
        } else if (data.type === 'fire') {
          handleIncomingFire(data.r, data.c);
        } else if (data.type === 'fire_result') {
          oppGrid[data.r][data.c] = data.result;
          if (data.result === 'hit') {
            myHits++;
            bridge.showToast('🎯 命中！！見事な砲撃！');
          } else {
            bridge.showToast('💦 波高し…外れました。');
          }
          currentTurn = currentTurn === P1 ? P2 : P1;
          checkGameOver();
          render();
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
        bridge.showToast('対戦相手が合流しました！配置を完了させてください！');
      });

      initGame();

      return () => {
        isDestroyed = true;
      };
    }
  });
})();
