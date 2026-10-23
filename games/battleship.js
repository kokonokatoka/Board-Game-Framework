/**
 * 🚢 バトルシップ (Battleship / 海戦ゲーム) Component
 * Board Arena Plugin
 * 
 * 10×10 の海域にお互い5隻の軍艦を隠して配置！
 * 交互に座標を指定して砲撃し、先に相手の全艦隊を撃沈したプレイヤーの勝利！
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

  const P1 = 1;
  const P2 = 2;

  window.BoardArena.registerGame({
    id: 'battleship',
    name: 'バトルシップ (Battleship)',
    icon: '🚢',
    category: '海戦・推理',
    minPlayers: 2,
    maxPlayers: 2,
    description: '10×10の海域に潜む敵艦隊をレーダー索敵！「命中！」「波高し！」「撃沈！」の名作海戦バトル！',

    mount(container, bridge) {
      // 状態管理
      // myGrid: 0=空, 'carrier'=船, 'hit'=被弾, 'miss'=外れ
      let myGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
      // oppGrid: 0=未攻撃, 'hit'=命中, 'miss'=外れ
      let oppGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));

      let myShips = []; // [{ shipId, cells: [{r, c}] }]
      let myHits = 0;   // 相手に命中させた数 (17で勝利)
      let oppHits = 0;  // 相手から命中された数 (17で敗北)

      let phase = 'PLACEMENT'; // 'PLACEMENT' | 'READY_WAIT' | 'BATTLE' | 'GAME_OVER'
      let currentTurn = P1;
      let isMyTurn = false;
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTML UI
      container.innerHTML = `
        <div class="bs-wrapper">
          <div class="bs-status-bar">
            <div class="turn-badge" id="bs-turn-badge">艦隊を配置してください</div>
            <div class="bs-ship-counter" id="bs-ship-counter">命中スコア: 0 / 17</div>
          </div>

          <!-- バトルフィールド (2つの10×10グリッド) -->
          <div class="bs-boards-container">
            <!-- 自分の海域 (自艦隊の配置＆敵からの被弾状況) -->
            <div class="bs-board-card">
              <div class="board-header">🛡️ あなたの海域 (防衛)</div>
              <div class="bs-grid" id="my-grid"></div>
            </div>

            <!-- 敵の海域 (攻撃レーダー) -->
            <div class="bs-board-card radar-card">
              <div class="board-header">🎯 敵の海域 (攻撃レーダー)</div>
              <div class="bs-grid" id="opp-grid"></div>
            </div>
          </div>

          <!-- 配置フェーズ専用ツールバー -->
          <div class="bs-placement-bar" id="bs-placement-bar">
            <span class="placement-hint">🚢 船を配置するか、「ランダム配置」を押してください</span>
            <button id="btn-random-place" class="btn btn-sm btn-secondary">🎲 ランダム自動配置</button>
            <button id="btn-ready" class="btn btn-sm btn-primary">✅ 出撃準備完了！</button>
          </div>

          <!-- 結果バナー -->
          <div id="bs-result-banner" class="bs-result-banner hidden">
            <span id="bs-result-text">勝敗結果</span>
            <button id="bs-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('battleship-custom-css')) {
        const style = document.createElement('style');
        style.id = 'battleship-custom-css';
        style.textContent = `
          .bs-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 840px;
            margin: 0 auto;
            user-select: none;
            color: #f1f5f9;
          }

          .bs-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .bs-ship-counter {
            font-size: 14px;
            font-weight: 700;
            color: #38bdf8;
          }

          /* 2枚のボード並列 */
          .bs-boards-container {
            display: flex;
            justify-content: center;
            gap: 20px;
            width: 100%;
            flex-wrap: wrap;
          }

          .bs-board-card {
            background: #0f172a;
            border: 2px solid #334155;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .bs-board-card.radar-card {
            border-color: #0284c7;
            box-shadow: 0 0 15px rgba(2, 132, 199, 0.2);
          }

          .board-header {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 1px;
            color: #cbd5e1;
          }
          .radar-card .board-header { color: #38bdf8; }

          /* 10×10 グリッド */
          .bs-grid {
            display: grid;
            grid-template-columns: repeat(10, 28px);
            grid-template-rows: repeat(10, 28px);
            gap: 2px;
            background: #1e293b;
            padding: 4px;
            border-radius: 6px;
          }

          .bs-cell {
            background: #0284c715;
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: 3px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.15s, transform 0.1s;
          }

          /* 自分の船があるマス */
          .bs-cell.ship {
            background: #0369a1;
            border-color: #38bdf8;
          }

          /* 命中 (Hit) */
          .bs-cell.hit {
            background: #dc2626 !important;
            border-color: #f87171 !important;
            color: #fff;
            animation: hitPulse 0.4s ease;
          }
          @keyframes hitPulse {
            0% { transform: scale(1.4); }
            100% { transform: scale(1); }
          }

          /* 外れ (Miss / 波高し) */
          .bs-cell.miss {
            background: #334155 !important;
            border-color: #64748b !important;
            color: #94a3b8;
          }

          /* レーダー側のホバー */
          .radar-card .bs-cell:hover:not(.hit):not(.miss) {
            background: rgba(56, 189, 248, 0.45);
            transform: scale(1.1);
          }

          /* 配置バー */
          .bs-placement-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: #18202c;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
            gap: 10px;
            flex-wrap: wrap;
          }
          .bs-placement-bar.hidden { display: none; }
          .placement-hint {
            font-size: 13px;
            color: #94a3b8;
          }

          /* 結果バナー */
          .bs-result-banner {
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
          .bs-result-banner.hidden { display: none; }

          @media (max-width: 640px) {
            .bs-grid {
              grid-template-columns: repeat(10, 24px);
              grid-template-rows: repeat(10, 24px);
            }
          }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const myGridEl = container.querySelector('#my-grid');
      const oppGridEl = container.querySelector('#opp-grid');
      const turnBadge = container.querySelector('#bs-turn-badge');
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
        myShips = [];
        myHits = 0;
        oppHits = 0;
        phase = 'PLACEMENT';
        currentTurn = P1;
        isMyTurn = myPlayer === P1;

        resBanner.classList.add('hidden');
        placementBar.classList.remove('hidden');

        // 最初からランダムに船を配置しておく
        randomPlaceShips();
        render();
      }

      // ランダム船配置アルゴリズム
      function randomPlaceShips() {
        myGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
        myShips = [];

        SHIPS.forEach(ship => {
          let placed = false;
          let attempts = 0;
          while (!placed && attempts < 100) {
            attempts++;
            const isHorizontal = Math.random() < 0.5;
            const r = Math.floor(Math.random() * (isHorizontal ? SIZE : SIZE - ship.size + 1));
            const c = Math.floor(Math.random() * (isHorizontal ? SIZE - ship.size + 1 : SIZE));

            // 重なりチェック
            let canPlace = true;
            for (let i = 0; i < ship.size; i++) {
              const cr = isHorizontal ? r : r + i;
              const cc = isHorizontal ? c + i : c;
              if (myGrid[cr][cc] !== 0) {
                canPlace = false;
                break;
              }
            }

            if (canPlace) {
              const shipCells = [];
              for (let i = 0; i < ship.size; i++) {
                const cr = isHorizontal ? r : r + i;
                const cc = isHorizontal ? c + i : c;
                myGrid[cr][cc] = ship.id;
                shipCells.push({ r: cr, c: cc });
              }
              myShips.push({ shipId: ship.id, cells: shipCells });
              placed = true;
            }
          }
        });
        render();
      }

      // 描画
      function render() {
        const isConnected = bridge.isConnected();

        // ステータス表示
        if (phase === 'PLACEMENT') {
          turnBadge.textContent = '🚢 自艦隊を配置してください（出撃準備）';
          turnBadge.style.color = '#38bdf8';
        } else if (phase === 'READY_WAIT') {
          turnBadge.textContent = '⏳ 相手の配置完了を待っています…';
          turnBadge.style.color = '#f59e0b';
        } else if (phase === 'BATTLE') {
          const myTurnNow = (!isConnected || currentTurn === myPlayer);
          turnBadge.textContent = myTurnNow ? '🔴 あなたの攻撃手番！敵海域をクリックして砲撃せよ！' : '相手の砲撃を待っています…';
          turnBadge.style.color = myTurnNow ? '#f87171' : '#94a3b8';
        }

        counterEl.textContent = `命中: ${myHits} / ${TOTAL_SHIP_CELLS}`;

        // 1. 自分のグリッド描画
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

        // 2. 相手海域（攻撃レーダー）グリッド描画
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

            // 攻撃クリック
            cell.addEventListener('click', () => {
              const myTurnNow = (!isConnected || currentTurn === myPlayer);
              if (phase === 'BATTLE' && myTurnNow && oppGrid[r][c] === 0) {
                fireAt(r, c, isConnected);
              }
            });

            oppGridEl.appendChild(cell);
          }
        }
      }

      // 砲撃実行
      function fireAt(r, c, isLocal = false) {
        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'battleship', type: 'fire', r, c });
          turnBadge.textContent = '💥 砲撃中...';
        } else {
          // ローカル一人テスト時のダミー判定
          const isHit = Math.random() < 0.45;
          oppGrid[r][c] = isHit ? 'hit' : 'miss';
          if (isHit) myHits++;
          checkGameOver();
          render();
        }
      }

      // 相手から撃たれた時の処理 (着弾判定を相手に返す)
      function handleIncomingFire(r, c) {
        const val = myGrid[r][c];
        const isHit = val !== 0 && val !== 'hit' && val !== 'miss';

        if (isHit) {
          myGrid[r][c] = 'hit';
          oppHits++;
          bridge.send({ game: 'battleship', type: 'fire_result', r, c, result: 'hit' });
          bridge.showToast('💥 敵の砲撃が命中しました！');
        } else {
          if (val === 0) myGrid[r][c] = 'miss';
          bridge.send({ game: 'battleship', type: 'fire_result', r, c, result: 'miss' });
          bridge.showToast('💦 敵の砲撃は外れました (波高し)！');
        }

        // ターン交代
        currentTurn = currentTurn === P1 ? P2 : P1;
        checkGameOver();
        render();
      }

      function checkGameOver() {
        if (myHits >= TOTAL_SHIP_CELLS) {
          phase = 'GAME_OVER';
          resText.textContent = '🎉 敵艦隊を全滅させました！あなたの勝利！！';
          resBanner.classList.remove('hidden');
          bridge.showToast('勝利！敵艦隊全滅！');
        } else if (oppHits >= TOTAL_SHIP_CELLS) {
          phase = 'GAME_OVER';
          resText.textContent = '💀 自艦隊が全滅しました…あなたの敗北…';
          resBanner.classList.remove('hidden');
          bridge.showToast('敗北…自艦隊全滅');
        }
      }

      // イベントリスナー
      btnRandomPlace.addEventListener('click', () => {
        randomPlaceShips();
        bridge.showToast('艦隊をランダム配置しました');
      });

      btnReady.addEventListener('click', () => {
        phase = 'READY_WAIT';
        placementBar.classList.add('hidden');
        render();

        if (bridge.isConnected()) {
          bridge.send({ game: 'battleship', type: 'ready' });
        } else {
          // 一人待機時は即バトル開始
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

      // P2P 受信イベント
      let oppReady = false;
      bridge.onReceive((data) => {
        if (data.game !== 'battleship') return;

        if (data.type === 'ready') {
          oppReady = true;
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
        initGame();
        bridge.showToast('対戦相手が合流しました！配置を完了させてください！');
      });

      initGame();
    },

    unmount() {}
  });
})();
