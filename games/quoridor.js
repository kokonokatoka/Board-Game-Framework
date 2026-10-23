/**
 * 🧱 コリドール (Quoridor) Component
 * Board Arena Plugin
 * 
 * メンサ推薦の世界的人気ボードゲーム！
 * コマを進めて反対側のゴールを目指すか、
 * 壁を置いて相手の行く手を阻むか！？
 */

(function () {
  const SIZE = 9;
  const P1 = 1; // 下スタート (青)、ゴールは r = 0
  const P2 = 2; // 上スタート (赤)、ゴールは r = 8
  const MAX_WALLS = 10;

  window.BoardArena.registerGame({
    id: 'quoridor',
    name: 'コリドール (Quoridor)',
    icon: '🧱',
    category: '戦略・迷路',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'コマを進めるか壁でブロックするか！相手のゴールを阻みつつ最短ルートで突き進め！',

    mount(container, bridge) {
      // 状態管理
      let p1Pos = { r: 8, c: 4 };
      let p2Pos = { r: 0, c: 4 };
      let p1Walls = MAX_WALLS;
      let p2Walls = MAX_WALLS;

      // 水平壁: hWalls[r][c] = true (行 r と r+1 の間、列 c〜c+1) (r: 0〜7, c: 0〜7)
      let hWalls = Array(SIZE - 1).fill(null).map(() => Array(SIZE - 1).fill(false));
      // 垂直壁: vWalls[r][c] = true (列 c と c+1 の間、行 r〜r+1) (r: 0〜7, c: 0〜7)
      let vWalls = Array(SIZE - 1).fill(null).map(() => Array(SIZE - 1).fill(false));

      let currentTurn = P1;
      let isGameOver = false;
      let actionType = 'move'; // 'move' | 'wall_h' | 'wall_v'
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="qd-wrapper">
          <div class="qd-status-bar">
            <div class="turn-badge" id="qd-turn-badge">P1の手番です</div>
            <div class="qd-wall-counts">
              <span class="wall-badge p1-badge">P1 壁: <strong id="qd-p1-walls">10</strong></span>
              <span class="wall-badge p2-badge">P2 壁: <strong id="qd-p2-walls">10</strong></span>
            </div>
          </div>

          <!-- アクション選択ツールバー -->
          <div class="qd-action-bar">
            <button id="act-move" class="btn btn-sm btn-action active">🚶 コマ移動</button>
            <button id="act-wall-h" class="btn btn-sm btn-action">➖ 横壁を置く</button>
            <button id="act-wall-v" class="btn btn-sm btn-action">丨 縦壁を置く</button>
            <span class="qd-hint" id="qd-hint">移動先をクリックしてください</span>
          </div>

          <!-- 9×9 盤面と壁スロット -->
          <div class="qd-board-container">
            <div class="qd-board" id="qd-board"></div>
          </div>

          <!-- 結果バナー -->
          <div id="qd-result-banner" class="qd-result-banner hidden">
            <span id="qd-result-text">勝敗結果</span>
            <button id="qd-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('quoridor-custom-css')) {
        const style = document.createElement('style');
        style.id = 'quoridor-custom-css';
        style.textContent = `
          .qd-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 520px;
            margin: 0 auto;
            user-select: none;
          }

          .qd-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .qd-wall-counts {
            display: flex;
            gap: 12px;
          }
          .wall-badge {
            font-size: 13px;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 6px;
            background: #0f172a;
          }
          .wall-badge.p1-badge { color: #38bdf8; border: 1px solid #0284c7; }
          .wall-badge.p2-badge { color: #f87171; border: 1px solid #dc2626; }

          /* アクションツールバー */
          .qd-action-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            flex-wrap: wrap;
            background: #1e293b;
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid #334155;
          }

          .btn-action {
            background: #334155;
            color: #cbd5e1;
            border: 1px solid #475569;
          }
          .btn-action.active {
            background: #2563eb;
            color: #fff;
            border-color: #60a5fa;
            box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
          }

          .qd-hint {
            font-size: 12px;
            color: #94a3b8;
            margin-left: auto;
          }

          /* 盤面 */
          .qd-board-container {
            background: #451a03;
            border: 6px solid #78350f;
            border-radius: 12px;
            padding: 10px;
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
            width: 100%;
          }

          .qd-board {
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            gap: 6px;
            position: relative;
            background: #271206;
            padding: 6px;
            border-radius: 8px;
          }

          .qd-cell {
            aspect-ratio: 1;
            background: #78350f;
            border-radius: 6px;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            cursor: pointer;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
            transition: background 0.15s;
          }

          .qd-cell.valid-move {
            background: #92400e;
            box-shadow: 0 0 8px #f59e0b;
          }
          .qd-cell.valid-move:hover {
            background: #b45309;
          }

          .qd-pawn {
            width: 75%;
            height: 75%;
            border-radius: 50%;
            box-shadow: 0 4px 8px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.6);
            z-index: 5;
          }
          .qd-pawn.p1 {
            background: radial-gradient(circle at 35% 35%, #38bdf8, #0284c7 70%, #0369a1);
          }
          .qd-pawn.p2 {
            background: radial-gradient(circle at 35% 35%, #f87171, #dc2626 70%, #991b1b);
          }

          /* 隙間（壁スロット）オーバーレイ */
          .qd-wall-slot {
            position: absolute;
            z-index: 10;
            cursor: pointer;
            transition: background 0.15s;
          }

          /* 水平壁スロット (8×8) */
          .qd-wall-h {
            height: 8px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
          }
          .qd-wall-h.placed {
            background: #f59e0b !important;
            box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
          }
          .qd-wall-h.preview {
            background: rgba(245, 158, 11, 0.5) !important;
          }

          /* 垂直壁スロット (8×8) */
          .qd-wall-v {
            width: 8px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
          }
          .qd-wall-v.placed {
            background: #f59e0b !important;
            box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
          }
          .qd-wall-v.preview {
            background: rgba(245, 158, 11, 0.5) !important;
          }

          /* 結果バナー */
          .qd-result-banner {
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
          .qd-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const boardEl = container.querySelector('#qd-board');
      const turnBadge = container.querySelector('#qd-turn-badge');
      const p1WallsEl = container.querySelector('#qd-p1-walls');
      const p2WallsEl = container.querySelector('#qd-p2-walls');
      const hintEl = container.querySelector('#qd-hint');
      const actMoveBtn = container.querySelector('#act-move');
      const actWallHBtn = container.querySelector('#act-wall-h');
      const actWallVBtn = container.querySelector('#act-wall-v');
      const resBanner = container.querySelector('#qd-result-banner');
      const resText = container.querySelector('#qd-result-text');
      const restartBtn = container.querySelector('#qd-restart-btn');

      function initGame() {
        p1Pos = { r: 8, c: 4 };
        p2Pos = { r: 0, c: 4 };
        p1Walls = MAX_WALLS;
        p2Walls = MAX_WALLS;
        hWalls = Array(SIZE - 1).fill(null).map(() => Array(SIZE - 1).fill(false));
        vWalls = Array(SIZE - 1).fill(null).map(() => Array(SIZE - 1).fill(false));
        currentTurn = P1;
        isGameOver = false;
        actionType = 'move';
        resBanner.classList.add('hidden');
        render();
      }

      // アクション切り替え
      function setAction(type) {
        actionType = type;
        actMoveBtn.classList.toggle('active', type === 'move');
        actWallHBtn.classList.toggle('active', type === 'wall_h');
        actWallVBtn.classList.toggle('active', type === 'wall_v');

        if (type === 'move') {
          hintEl.textContent = '移動先の光るマスをクリックしてください';
        } else if (type === 'wall_h') {
          hintEl.textContent = '置きたい横壁の隙間をクリックしてください';
        } else {
          hintEl.textContent = '置きたい縦壁の隙間をクリックしてください';
        }
        render();
      }

      actMoveBtn.addEventListener('click', () => setAction('move'));
      actWallHBtn.addEventListener('click', () => setAction('wall_h'));
      actWallVBtn.addEventListener('click', () => setAction('wall_v'));

      // 描画処理
      function render() {
        const isConnected = bridge.isConnected();
        const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;
        const myPawnPos = currentTurn === P1 ? p1Pos : p2Pos;
        const remainingWalls = currentTurn === P1 ? p1Walls : p2Walls;

        p1WallsEl.textContent = p1Walls;
        p2WallsEl.textContent = p2Walls;

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

        // コマの合法手
        const validMoves = (isMyTurn && actionType === 'move') ? getValidPawnMoves(myPawnPos, currentTurn === P1 ? p2Pos : p1Pos) : [];
        const validSet = new Set(validMoves.map(m => `${m.r},${m.c}`));

        // 盤面グリッド描画
        boardEl.innerHTML = '';
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'qd-cell';
            cell.dataset.r = r;
            cell.dataset.c = c;

            // コマ描画
            if (p1Pos.r === r && p1Pos.c === c) {
              const pawn = document.createElement('div');
              pawn.className = 'qd-pawn p1';
              cell.appendChild(pawn);
            } else if (p2Pos.r === r && p2Pos.c === c) {
              const pawn = document.createElement('div');
              pawn.className = 'qd-pawn p2';
              cell.appendChild(pawn);
            }

            // 移動可能ハイライト
            if (validSet.has(`${r},${c}`)) {
              cell.classList.add('valid-move');
              cell.addEventListener('click', () => {
                movePawn(r, c, isConnected);
              });
            }

            boardEl.appendChild(cell);
          }
        }

        // 壁のオーバーレイ描画
        renderWallSlots(isMyTurn, remainingWalls, isConnected);
      }

      function renderWallSlots(isMyTurn, remainingWalls, isConnected) {
        const boardRect = boardEl.getBoundingClientRect();
        if (boardRect.width === 0) return;

        const cellWidth = (boardRect.width - 12 - 48) / 9; // マス幅の概算
        const step = (boardRect.width - 12) / 9;

        // 水平壁・垂直壁スロット
        for (let r = 0; r < SIZE - 1; r++) {
          for (let c = 0; c < SIZE - 1; c++) {
            // 1. 水平壁 (r, c)
            const hSlot = document.createElement('div');
            hSlot.className = `qd-wall-slot qd-wall-h ${hWalls[r][c] ? 'placed' : ''}`;
            hSlot.style.left = `${(c * 100) / 9 + 1}%`;
            hSlot.style.top = `${((r + 1) * 100) / 9 - 1.5}%`;
            hSlot.style.width = `${(2 * 100) / 9 - 2}%`;

            if (!hWalls[r][c] && isMyTurn && actionType === 'wall_h' && remainingWalls > 0) {
              hSlot.addEventListener('mouseenter', () => hSlot.classList.add('preview'));
              hSlot.addEventListener('mouseleave', () => hSlot.classList.remove('preview'));
              hSlot.addEventListener('click', () => {
                tryPlaceWall('h', r, c, isConnected);
              });
            }
            boardEl.appendChild(hSlot);

            // 2. 垂直壁 (r, c)
            const vSlot = document.createElement('div');
            vSlot.className = `qd-wall-slot qd-wall-v ${vWalls[r][c] ? 'placed' : ''}`;
            vSlot.style.left = `${((c + 1) * 100) / 9 - 1.5}%`;
            vSlot.style.top = `${(r * 100) / 9 + 1}%`;
            vSlot.style.height = `${(2 * 100) / 9 - 2}%`;

            if (!vWalls[r][c] && isMyTurn && actionType === 'wall_v' && remainingWalls > 0) {
              vSlot.addEventListener('mouseenter', () => vSlot.classList.add('preview'));
              vSlot.addEventListener('mouseleave', () => vSlot.classList.remove('preview'));
              vSlot.addEventListener('click', () => {
                tryPlaceWall('v', r, c, isConnected);
              });
            }
            boardEl.appendChild(vSlot);
          }
        }
      }

      // コマ移動処理
      function movePawn(r, c, isLocal = false) {
        if (currentTurn === P1) {
          p1Pos = { r, c };
        } else {
          p2Pos = { r, c };
        }

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'quoridor', type: 'move_pawn', r, c });
        }

        // 勝利判定
        if (currentTurn === P1 && r === 0) {
          isGameOver = true;
          resText.textContent = '🎉 P1 (青) のゴール！勝利！！';
          resBanner.classList.remove('hidden');
          bridge.showToast('P1 の勝利！');
        } else if (currentTurn === P2 && r === 8) {
          isGameOver = true;
          resText.textContent = '🎉 P2 (赤) のゴール！勝利！！';
          resBanner.classList.remove('hidden');
          bridge.showToast('P2 の勝利！');
        } else {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        render();
      }

      // 壁配置の試行＆バリデーション
      function tryPlaceWall(type, r, c, isLocal = false) {
        if (type === 'h') {
          // 重複チェック
          if (hWalls[r][c]) return;
          if (c > 0 && hWalls[r][c - 1]) return;
          if (c < SIZE - 2 && hWalls[r][c + 1]) return;
          if (vWalls[r][c]) return; // 交差チェック

          hWalls[r][c] = true;
        } else {
          if (vWalls[r][c]) return;
          if (r > 0 && vWalls[r - 1][c]) return;
          if (r < SIZE - 2 && vWalls[r + 1][c]) return;
          if (hWalls[r][c]) return; // 交差チェック

          vWalls[r][c] = true;
        }

        // ゴールへの経路チェック (BFS)
        const p1HasPath = hasPathToGoal(p1Pos, 0);
        const p2HasPath = hasPathToGoal(p2Pos, 8);

        if (!p1HasPath || !p2HasPath) {
          // 取り消し
          if (type === 'h') hWalls[r][c] = false;
          else vWalls[r][c] = false;
          bridge.showToast('⚠️ ゴールへの道を完全に塞ぐ壁は置けません！');
          return;
        }

        // 配置確定
        if (currentTurn === P1) p1Walls--;
        else p2Walls--;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'quoridor', type: 'place_wall', wallType: type, r, c });
        }

        currentTurn = currentTurn === P1 ? P2 : P1;
        actionType = 'move';
        render();
      }

      // BFSでゴール行への道があるか判定
      function hasPathToGoal(startPos, goalRow) {
        const queue = [{ r: startPos.r, c: startPos.c }];
        const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
        visited[startPos.r][startPos.c] = true;

        while (queue.length > 0) {
          const { r, c } = queue.shift();
          if (r === goalRow) return true;

          const neighbors = getPassableNeighbors(r, c);
          for (const n of neighbors) {
            if (!visited[n.r][n.c]) {
              visited[n.r][n.c] = true;
              queue.push(n);
            }
          }
        }
        return false;
      }

      // 壁に遮られていない隣接マス
      function getPassableNeighbors(r, c) {
        const res = [];
        // 上
        if (r > 0 && !hasWallBetween(r, c, r - 1, c)) res.push({ r: r - 1, c });
        // 下
        if (r < SIZE - 1 && !hasWallBetween(r, c, r + 1, c)) res.push({ r: r + 1, c });
        // 左
        if (c > 0 && !hasWallBetween(r, c, r, c - 1)) res.push({ r, c: c - 1 });
        // 右
        if (c < SIZE - 1 && !hasWallBetween(r, c, r, c + 1)) res.push({ r, c: c + 1 });
        return res;
      }

      function hasWallBetween(r1, c1, r2, c2) {
        if (r1 === r2) {
          // 左右移動 (c1 vs c2)
          const leftCol = Math.min(c1, c2);
          const topRow = r1;
          if (vWalls[topRow][leftCol]) return true;
          if (topRow > 0 && vWalls[topRow - 1][leftCol]) return true;
        } else {
          // 上下移動 (r1 vs r2)
          const topRow = Math.min(r1, r2);
          const leftCol = c1;
          if (hWalls[topRow][leftCol]) return true;
          if (leftCol > 0 && hWalls[topRow][leftCol - 1]) return true;
        }
        return false;
      }

      // コマの移動可能マス計算 (ジャンプも含む)
      function getValidPawnMoves(pos, otherPos) {
        const valid = [];
        const neighbors = getPassableNeighbors(pos.r, pos.c);

        for (const n of neighbors) {
          if (n.r === otherPos.r && n.c === otherPos.c) {
            // 相手コマと隣接！ジャンプ判定
            const dr = n.r - pos.r;
            const dc = n.c - pos.c;
            const jumpR = n.r + dr;
            const jumpC = n.c + dc;

            // 直線ジャンプ可能か
            if (jumpR >= 0 && jumpR < SIZE && jumpC >= 0 && jumpC < SIZE && !hasWallBetween(n.r, n.c, jumpR, jumpC)) {
              valid.push({ r: jumpR, c: jumpC });
            } else {
              // 直線ジャンプが壁で塞がれている場合、斜めジャンプ
              const diagonals = getPassableNeighbors(n.r, n.c);
              for (const d of diagonals) {
                if (!(d.r === pos.r && d.c === pos.c)) {
                  valid.push(d);
                }
              }
            }
          } else {
            valid.push(n);
          }
        }
        return valid;
      }

      // リスタート
      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'quoridor', type: 'restart' });
        }
      });

      // P2P 受信イベント
      bridge.onReceive((data) => {
        if (data.game !== 'quoridor') return;
        if (data.type === 'move_pawn') {
          movePawn(data.r, data.c, false);
        } else if (data.type === 'place_wall') {
          tryPlaceWall(data.wallType, data.r, data.c, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      // 相手合流イベント
      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！コリドール開始！');
      });

      // 初期化
      initGame();
    },

    unmount() {
      // クリーンアップ
    }
  });
})();
