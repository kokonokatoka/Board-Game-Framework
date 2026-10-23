/**
 * 🪨 マンカラ (Mancala / Kalah) Component
 * Board Arena Plugin
 * 
 * 世界最古の伝統頭脳ゲーム！
 * ポケットの石を時計回りに1個ずつ撒いていき、
 * 自分のストア（ゴール）に最も多くの石を集めたプレイヤーの勝利！
 */

(function () {
  const P1 = 1; // 下側プレイヤー (ストア: インデックス 6)
  const P2 = 2; // 上側プレイヤー (ストア: インデックス 13)

  // ピットのインデックス構成:
  // P2側:  [12] [11] [10] [ 9] [ 8] [ 7]  (上段: 右から左へ進行)
  // ストア: [13] (P2ゴール)                      [ 6] (P1ゴール)
  // P1側:  [ 0] [ 1] [ 2] [ 3] [ 4] [ 5]  (下段: 左から右へ進行)

  const P1_POCKETS = [0, 1, 2, 3, 4, 5];
  const P2_POCKETS = [7, 8, 9, 10, 11, 12];
  const P1_STORE = 6;
  const P2_STORE = 13;

  window.BoardArena.registerGame({
    id: 'mancala',
    name: 'マンカラ (Mancala)',
    icon: '🪨',
    category: '伝統・計算',
    minPlayers: 2,
    maxPlayers: 2,
    description: '世界最古の頭脳戦！石を撒いてゴールに集めろ！ピッタリゴールで連続ターン＆横取りが熱い！',

    mount(container, bridge) {
      // 14ピットの石の数
      let board = Array(14).fill(4);
      board[P1_STORE] = 0;
      board[P2_STORE] = 0;

      let currentTurn = P1;
      let isGameOver = false;
      let lastSownPit = -1;
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="mancala-wrapper">
          <div class="mancala-status-bar">
            <div class="turn-badge" id="mancala-turn-badge">P1の手番です</div>
            <div class="mancala-hint" id="mancala-hint">ポケットを選んで石を撒いてください</div>
          </div>

          <!-- 木目調マンカラボード -->
          <div class="mancala-board-frame">
            <!-- P2 (左) ストア -->
            <div class="mancala-store p2-store" id="pit-13">
              <span class="store-label">P2 ゴール</span>
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
              <span class="store-label">P1 ゴール</span>
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

      // スタイル定義
      if (!document.getElementById('mancala-custom-css')) {
        const style = document.createElement('style');
        style.id = 'mancala-custom-css';
        style.textContent = `
          .mancala-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 720px;
            margin: 0 auto;
            user-select: none;
          }

          .mancala-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .mancala-hint {
            font-size: 13px;
            color: #94a3b8;
          }

          /* マンカラ木製ボードデザイン */
          .mancala-board-frame {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            background: linear-gradient(135deg, #78350f, #451a03);
            border: 6px solid #92400e;
            border-radius: 30px;
            padding: 20px 16px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.6), inset 0 2px 5px rgba(255, 255, 255, 0.2);
            width: 100%;
          }

          /* ストア (両端の大きな溝) */
          .mancala-store {
            width: 80px;
            height: 180px;
            background: #271206;
            border-radius: 40px;
            box-shadow: inset 0 6px 12px rgba(0, 0, 0, 0.8), 0 1px 1px rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 4px;
            position: relative;
          }

          .store-label {
            font-size: 11px;
            font-weight: 700;
            color: #d97706;
          }
          .p2-store .store-label { color: #38bdf8; }

          .pit-count {
            font-size: 18px;
            font-weight: 800;
            color: #fef3c7;
            margin: 4px 0;
            font-family: monospace;
          }

          /* 中央 2段 ポケット */
          .mancala-center-pits {
            display: flex;
            flex-direction: column;
            gap: 16px;
            flex: 1;
          }

          .pits-row {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
          }

          .mancala-pit {
            aspect-ratio: 1;
            background: #271206;
            border-radius: 50%;
            box-shadow: inset 0 5px 10px rgba(0, 0, 0, 0.8), 0 1px 1px rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            position: relative;
            transition: transform 0.15s, box-shadow 0.15s;
          }

          .mancala-pit.selectable:hover {
            transform: scale(1.08);
            box-shadow: inset 0 5px 10px rgba(0, 0, 0, 0.8), 0 0 12px #f59e0b;
          }

          /* 石の描画コンテナ */
          .stones-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-content: center;
            gap: 2px;
            width: 80%;
            height: 55%;
            overflow: hidden;
          }

          /* 石 (ガラス玉・おはじき) */
          .stone {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.8);
          }
          .stone.c1 { background: radial-gradient(circle at 30% 30%, #67e8f9, #0284c7); }
          .stone.c2 { background: radial-gradient(circle at 30% 30%, #fca5a5, #dc2626); }
          .stone.c3 { background: radial-gradient(circle at 30% 30%, #fde047, #ca8a04); }
          .stone.c4 { background: radial-gradient(circle at 30% 30%, #86efac, #16a34a); }
          .stone.c5 { background: radial-gradient(circle at 30% 30%, #d8b4fe, #9333ea); }

          /* 結果バナー */
          .mancala-result-banner {
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
          .mancala-result-banner.hidden { display: none; }

          @media (max-width: 560px) {
            .mancala-board-frame { padding: 12px 8px; gap: 6px; }
            .mancala-store { width: 48px; height: 140px; }
            .pits-row { gap: 4px; }
            .pit-count { font-size: 14px; }
            .stone { width: 6px; height: 6px; }
          }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const turnBadge = container.querySelector('#mancala-turn-badge');
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

      // 描画
      function render() {
        const isConnected = bridge.isConnected();
        const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;
        const activePlayer = isConnected ? myPlayer : currentTurn;

        // ステータスバッジ
        if (!isGameOver) {
          if (!isConnected) {
            turnBadge.textContent = `⏳ 待機中 (一人練習中: ${currentTurn === P1 ? 'P1' : 'P2'})`;
            turnBadge.style.color = currentTurn === P1 ? '#f59e0b' : '#38bdf8';
          } else if (currentTurn === P1) {
            turnBadge.textContent = myPlayer === P1 ? '🟢 あなたの手番 (P1)' : '相手の考え中… (P1)';
            turnBadge.style.color = '#f59e0b';
          } else {
            turnBadge.textContent = myPlayer === P2 ? '🟢 あなたの手番 (P2)' : '相手の考え中… (P2)';
            turnBadge.style.color = '#38bdf8';
          }

          hintEl.textContent = isMyTurn ? '石のある自分のポケットを選んでください' : '相手の手を待っています…';
        }

        // 各ピットの石数とビジュアル描画
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

          // ポケットの選択可否
          if (pitEl && !pitEl.classList.contains('mancala-store')) {
            const isP1Pit = P1_POCKETS.includes(i);
            const isP2Pit = P2_POCKETS.includes(i);
            const isCurrentPlayerPit = (currentTurn === P1 && isP1Pit) || (currentTurn === P2 && isP2Pit);
            const canSelect = isMyTurn && isCurrentPlayerPit && board[i] > 0;

            pitEl.classList.toggle('selectable', canSelect);
          }
        }
      }

      // ポケットクリックイベント登録
      [...P1_POCKETS, ...P2_POCKETS].forEach(idx => {
        const el = container.querySelector(`#pit-${idx}`);
        el.addEventListener('click', () => {
          const isConnected = bridge.isConnected();
          const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;
          const isP1Pit = P1_POCKETS.includes(idx);
          const isP2Pit = P2_POCKETS.includes(idx);
          const isCurrentPlayerPit = (currentTurn === P1 && isP1Pit) || (currentTurn === P2 && isP2Pit);

          if (isMyTurn && isCurrentPlayerPit && board[idx] > 0 && !isGameOver) {
            sowStones(idx, isConnected);
          }
        });
      });

      // 石を撒く処理 (Sow Stones)
      function sowStones(startPit, isLocal = false) {
        let stones = board[startPit];
        board[startPit] = 0;

        let currentPit = startPit;
        const player = currentTurn;

        // 1個ずつ反時計回りに撒く
        while (stones > 0) {
          currentPit = (currentPit + 1) % 14;

          // 相手のストアはスキップ
          if (player === P1 && currentPit === P2_STORE) continue;
          if (player === P2 && currentPit === P1_STORE) continue;

          board[currentPit]++;
          stones--;
        }

        lastSownPit = currentPit;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'mancala', type: 'move', pit: startPit });
        }

        // ルール判定:
        // 1. ピッタリゴール (Free Turn)
        const myStore = player === P1 ? P1_STORE : P2_STORE;
        let getsFreeTurn = false;

        if (lastSownPit === myStore) {
          getsFreeTurn = true;
          bridge.showToast('🎯 ピッタリゴール！もう1手番！');
        } else {
          // 2. 横取り (Capture)
          // 最後に落としたのが「自分の空ポケット」で、かつ落とした後で1個（元は0個）
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

        // ゲーム終了判定
        checkGameOver();

        if (!isGameOver) {
          if (!getsFreeTurn) {
            currentTurn = currentTurn === P1 ? P2 : P1;
          }
        }

        render();
      }

      function checkGameOver() {
        const p1Empty = P1_POCKETS.every(i => board[i] === 0);
        const p2Empty = P2_POCKETS.every(i => board[i] === 0);

        if (p1Empty || p2Empty) {
          isGameOver = true;
          // 残った石をそれぞれのストアに回収
          P1_POCKETS.forEach(i => { board[P1_STORE] += board[i]; board[i] = 0; });
          P2_POCKETS.forEach(i => { board[P2_STORE] += board[i]; board[i] = 0; });

          const p1Score = board[P1_STORE];
          const p2Score = board[P2_STORE];

          let resMsg = '';
          if (p1Score > p2Score) {
            resMsg = `🎉 P1 の勝利！ (${p1Score} vs ${p2Score})`;
          } else if (p2Score > p1Score) {
            resMsg = `🎉 P2 の勝利！ (${p2Score} vs ${p1Score})`;
          } else {
            resMsg = `🤝 引き分け！ (${p1Score} vs ${p2Score})`;
          }

          resText.textContent = resMsg;
          resBanner.classList.remove('hidden');
          bridge.showToast(resMsg);
        }
      }

      // リスタート
      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'mancala', type: 'restart' });
        }
      });

      // P2P 受信イベント
      bridge.onReceive((data) => {
        if (data.game !== 'mancala') return;
        if (data.type === 'move') {
          sowStones(data.pit, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      // 相手合流イベント
      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！マンカラ開始！');
      });

      // 初期化
      initGame();
    },

    unmount() {
      // クリーンアップ
    }
  });
})();
