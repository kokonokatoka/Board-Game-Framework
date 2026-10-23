/**
 * 🧱 コリドール (Quoridor) Component - 完全リニューアル版
 * Board Arena Plugin
 * 
 * 🌟 改良点:
 * 1. 【完璧な17×17グリッド座標系】マス目と壁の隙間が完全に一致し、位置ズレやクリック不能を完全解消！
 * 2. 【広々としたクリック判定】壁の設置プレビューとクリックが吸い付くように快適。
 * 3. 【賢い思考型 CPU (AI) 対戦機能】一人でも白熱の迷路バトルが即座に楽しめる！
 * 4. 【正式ルール完全準拠】直進ジャンプ・斜めジャンプ・完全封鎖防止BFS判定。
 * 5. 【WebRTC P2P 対戦】友達とのオンライン対戦も完全サポート。
 */

(function () {
  const SIZE = 9;
  const P1 = 1; // 下スタート (青・あなた)、ゴールは r = 0
  const P2 = 2; // 上スタート (赤・CPU/相手)、ゴールは r = 8
  const MAX_WALLS = 10;

  window.BoardArena.registerGame({
    id: 'quoridor',
    name: 'コリドール (Quoridor)',
    icon: '🧱',
    category: '戦略・迷路',
    minPlayers: 1,
    maxPlayers: 2,
    description: 'コマを進めるか壁でブロックするか！相手の進路を阻みつつ最短ルートで突き進む頭脳迷路バトル！CPU対戦も完備！',

    mount(container, bridge) {
      let isDestroyed = false;
      let p1Pos = { r: 8, c: 4 };
      let p2Pos = { r: 0, c: 4 };
      let p1Walls = MAX_WALLS;
      let p2Walls = MAX_WALLS;

      // 水平壁: hWalls[r][c] = true (行 r と r+1 の間、列 c〜c+1 にまたがる) (0<=r<8, 0<=c<8)
      let hWalls = Array(8).fill(null).map(() => Array(8).fill(false));
      // 垂直壁: vWalls[r][c] = true (列 c と c+1 の間、行 r〜r+1 にまたがる) (0<=r<8, 0<=c<8)
      let vWalls = Array(8).fill(null).map(() => Array(8).fill(false));

      let currentTurn = P1;
      let isGameOver = false;
      let actionType = 'move'; // 'move' | 'wall_h' | 'wall_v'
      let vsCpu = !bridge.isConnected(); // 未接続時はデフォルトでCPU対戦モード！
      let myPlayer = P1;

      // HTMLマークアップ
      container.innerHTML = `
        <div class="qd-wrapper">
          <!-- 上部ステータスバー -->
          <div class="qd-status-bar">
            <div class="qd-turn-info">
              <span class="turn-badge" id="qd-turn-badge">P1の手番です</span>
              <button id="qd-mode-toggle" class="btn btn-sm btn-subtle mode-toggle-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="qd-wall-counts">
              <span class="wall-badge p1-badge">青 (あなた) 壁: <strong id="qd-p1-walls">10</strong></span>
              <span class="wall-badge p2-badge">赤 (${vsCpu ? 'CPU' : '相手'}) 壁: <strong id="qd-p2-walls">10</strong></span>
            </div>
          </div>

          <!-- アクションツールバー -->
          <div class="qd-action-bar">
            <div class="action-buttons-group">
              <button id="act-move" class="btn btn-sm btn-action active">🚶 コマ移動</button>
              <button id="act-wall-h" class="btn btn-sm btn-action">➖ 横壁を置く</button>
              <button id="act-wall-v" class="btn btn-sm btn-action">丨 縦壁を置く</button>
            </div>
            <span class="qd-hint" id="qd-hint">移動先の光るマスをクリック</span>
          </div>

          <!-- 9×9 盤面と壁グリッド (完全一体化 17×17 レンダラー) -->
          <div class="qd-board-container">
            <div class="qd-unified-board" id="qd-board"></div>
          </div>

          <!-- 結果バナー -->
          <div id="qd-result-banner" class="qd-result-banner hidden">
            <span id="qd-result-text">勝敗結果</span>
            <button id="qd-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('quoridor-perfect-css')) {
        const style = document.createElement('style');
        style.id = 'quoridor-perfect-css';
        style.textContent = `
          .qd-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 540px;
            margin: 0 auto;
            user-select: none;
            color: #f1f5f9;
          }

          .qd-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #111827;
            padding: 8px 14px;
            border-radius: 10px;
            border: 1px solid #283548;
            flex-wrap: wrap;
            gap: 8px;
          }

          .qd-turn-info {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .turn-badge {
            font-size: 13px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 6px;
          }

          .mode-toggle-btn {
            font-size: 11px;
            font-weight: 700;
            background: #1e293b;
            border: 1px solid #3b82f6;
            color: #38bdf8;
            padding: 3px 8px;
            border-radius: 6px;
            cursor: pointer;
          }

          .qd-wall-counts {
            display: flex;
            gap: 10px;
          }

          .wall-badge {
            font-size: 12px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            background: #0f172a;
          }
          .wall-badge.p1-badge { color: #38bdf8; border: 1px solid #0284c7; }
          .wall-badge.p2-badge { color: #f87171; border: 1px solid #dc2626; }

          .qd-action-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid #334155;
            flex-wrap: wrap;
            gap: 8px;
          }

          .action-buttons-group {
            display: flex;
            gap: 6px;
          }

          .btn-action {
            background: #1e293b;
            color: #cbd5e1;
            border: 1px solid #475569;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .btn-action.active {
            background: #2563eb;
            color: #fff;
            border-color: #60a5fa;
            box-shadow: 0 0 10px rgba(37, 99, 235, 0.5);
          }

          .qd-hint {
            font-size: 11px;
            color: #94a3b8;
          }

          /* 盤面コンテナ */
          .qd-board-container {
            background: #3a1a06;
            border: 6px solid #5a2608;
            border-radius: 14px;
            padding: 12px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          /* 17×17 一体化グリッド盤面 */
          .qd-unified-board {
            display: grid;
            /* 奇数行/列はマス目(1fr)、偶数行/列は壁スペース(12px) */
            grid-template-columns: repeat(8, 1fr 14px) 1fr;
            grid-template-rows: repeat(8, 1fr 14px) 1fr;
            width: 100%;
            aspect-ratio: 1;
            max-width: 480px;
            background: #210d02;
            padding: 6px;
            border-radius: 10px;
            box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.8);
          }

          /* マス目 (Cell: 9×9) */
          .qd-cell {
            background: #6c2e0b;
            border-radius: 6px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
            transition: background 0.15s;
            position: relative;
          }
          .qd-cell.valid-move {
            background: #92400e;
            box-shadow: 0 0 10px #f59e0b, inset 0 0 6px #fbbf24;
            animation: pulse-move 1.2s infinite alternate;
          }
          @keyframes pulse-move {
            0% { transform: scale(0.97); }
            100% { transform: scale(1.03); }
          }
          .qd-cell.valid-move:hover {
            background: #b45309;
          }

          /* コマ (Pawn) */
          .qd-pawn {
            width: 78%;
            height: 78%;
            border-radius: 50%;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6), inset 0 3px 5px rgba(255, 255, 255, 0.6);
            z-index: 5;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .qd-pawn.p1 {
            background: radial-gradient(circle at 35% 35%, #38bdf8, #0284c7 70%, #0369a1);
            border: 2px solid #7dd3fc;
          }
          .qd-pawn.p2 {
            background: radial-gradient(circle at 35% 35%, #f87171, #dc2626 70%, #991b1b);
            border: 2px solid #fca5a5;
          }

          /* 壁スロット (Wall Slots) */
          .qd-wall-slot {
            background: transparent;
            cursor: pointer;
            transition: all 0.15s;
            border-radius: 3px;
          }

          /* 水平壁 (Horizontal Wall) */
          .qd-wall-h-slot {
            cursor: pointer;
          }
          .qd-wall-h-slot.placed {
            background: #f59e0b !important;
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.9);
          }
          .qd-wall-h-slot.preview {
            background: rgba(245, 158, 11, 0.6) !important;
          }

          /* 垂直壁 (Vertical Wall) */
          .qd-wall-v-slot {
            cursor: pointer;
          }
          .qd-wall-v-slot.placed {
            background: #f59e0b !important;
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.9);
          }
          .qd-wall-v-slot.preview {
            background: rgba(245, 158, 11, 0.6) !important;
          }

          /* 交差点 (Intersection Gap) */
          .qd-wall-cross-slot {
            background: transparent;
          }
          .qd-wall-cross-slot.placed {
            background: #f59e0b !important;
          }

          /* 結果バナー */
          .qd-result-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: #1e293b;
            border: 2px solid #10b981;
            padding: 10px 18px;
            border-radius: 10px;
            font-weight: 700;
          }
          .qd-result-banner.hidden { display: none; }

          @media (max-width: 500px) {
            .qd-unified-board { grid-template-columns: repeat(8, 1fr 10px) 1fr; grid-template-rows: repeat(8, 1fr 10px) 1fr; }
          }
        `;
        document.head.appendChild(style);
      }

      // DOM要素
      const boardEl = container.querySelector('#qd-board');
      const turnBadge = container.querySelector('#qd-turn-badge');
      const modeToggleBtn = container.querySelector('#qd-mode-toggle');
      const p1WallsEl = container.querySelector('#qd-p1-walls');
      const p2WallsEl = container.querySelector('#qd-p2-walls');
      const hintEl = container.querySelector('#qd-hint');
      const actMoveBtn = container.querySelector('#act-move');
      const actWallHBtn = container.querySelector('#act-wall-h');
      const actWallVBtn = container.querySelector('#act-wall-v');
      const resBanner = container.querySelector('#qd-result-banner');
      const resText = container.querySelector('#qd-result-text');
      const restartBtn = container.querySelector('#qd-restart-btn');

      // 初期化
      function initGame() {
        p1Pos = { r: 8, c: 4 };
        p2Pos = { r: 0, c: 4 };
        p1Walls = MAX_WALLS;
        p2Walls = MAX_WALLS;
        hWalls = Array(8).fill(null).map(() => Array(8).fill(false));
        vWalls = Array(8).fill(null).map(() => Array(8).fill(false));
        currentTurn = P1;
        isGameOver = false;
        actionType = 'move';
        resBanner.classList.add('hidden');
        render();
      }

      // モード切替
      modeToggleBtn.addEventListener('click', () => {
        if (bridge.isConnected()) {
          bridge.showToast('オンライン対戦中はCPUモードに切り替えられません');
          return;
        }
        vsCpu = !vsCpu;
        modeToggleBtn.textContent = vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦';
        bridge.showToast(vsCpu ? '🤖 CPU対戦モードに切り替えました！' : '👥 2人対戦モードに切り替えました！');
        render();
        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      });

      // アクション選択
      function setAction(type) {
        actionType = type;
        actMoveBtn.classList.toggle('active', type === 'move');
        actWallHBtn.classList.toggle('active', type === 'wall_h');
        actWallVBtn.classList.toggle('active', type === 'wall_v');

        if (type === 'move') {
          hintEl.textContent = '移動先の光るマスをクリック';
        } else if (type === 'wall_h') {
          hintEl.textContent = '置きたい横壁の隙間をクリック';
        } else {
          hintEl.textContent = '置きたい縦壁の隙間をクリック';
        }
        render();
      }

      actMoveBtn.addEventListener('click', () => setAction('move'));
      actWallHBtn.addEventListener('click', () => setAction('wall_h'));
      actWallVBtn.addEventListener('click', () => setAction('wall_v'));

      // 描画処理 (17×17 完全グリッド構築)
      function render() {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
        const myPawnPos = currentTurn === P1 ? p1Pos : p2Pos;
        const otherPawnPos = currentTurn === P1 ? p2Pos : p1Pos;
        const remainingWalls = currentTurn === P1 ? p1Walls : p2Walls;

        p1WallsEl.textContent = p1Walls;
        p2WallsEl.textContent = p2Walls;

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🟢 青 (あなた) の手番';
            turnBadge.style.color = '#38bdf8';
          } else {
            turnBadge.textContent = vsCpu ? '🤖 赤 (CPU) の考え中…' : '🔴 赤の手番';
            turnBadge.style.color = '#f87171';
          }
        }

        // コマの移動可能マス
        const validMoves = (isHumanTurn && !isGameOver && actionType === 'move') 
          ? getValidPawnMoves(myPawnPos, otherPawnPos) 
          : [];
        const validSet = new Set(validMoves.map(m => `${m.r},${m.c}`));

        boardEl.innerHTML = '';

        // 17×17 グリッドの構築
        for (let gr = 0; gr < 17; gr++) {
          for (let gc = 0; gc < 17; gc++) {
            const isCellRow = gr % 2 === 0;
            const isCellCol = gc % 2 === 0;

            if (isCellRow && isCellCol) {
              // マス目 (Cell: 0..8)
              const r = gr / 2;
              const c = gc / 2;
              const cell = document.createElement('div');
              cell.className = 'qd-cell';
              cell.style.gridRow = gr + 1;
              cell.style.gridColumn = gc + 1;

              // コマの配置
              if (p1Pos.r === r && p1Pos.c === c) {
                const p = document.createElement('div');
                p.className = 'qd-pawn p1';
                cell.appendChild(p);
              } else if (p2Pos.r === r && p2Pos.c === c) {
                const p = document.createElement('div');
                p.className = 'qd-pawn p2';
                cell.appendChild(p);
              }

              // 移動可能
              if (validSet.has(`${r},${c}`)) {
                cell.classList.add('valid-move');
                cell.addEventListener('click', () => {
                  executeMove(r, c);
                });
              }

              boardEl.appendChild(cell);
            } else if (!isCellRow && isCellCol) {
              // 水平壁のマス間スロット (行 r と r+1 の間、列 c)
              const r = (gr - 1) / 2;
              const c = gc / 2;

              // このスロットがどの壁に関係しているか:
              // 左側からの壁 hWalls[r][c-1] または 右側への壁 hWalls[r][c]
              const isPlaced = (c < 8 && hWalls[r][c]) || (c > 0 && hWalls[r][c - 1]);

              const slot = document.createElement('div');
              slot.className = `qd-wall-slot qd-wall-h-slot ${isPlaced ? 'placed' : ''}`;
              slot.style.gridRow = gr + 1;
              slot.style.gridColumn = gc + 1;

              // クリックで壁配置 (c < 8 のとき hWalls[r][c] の起点として判定)
              if (!isPlaced && isHumanTurn && !isGameOver && actionType === 'wall_h' && remainingWalls > 0) {
                const targetC = c < 8 ? c : c - 1;
                if (canPlaceWall('h', r, targetC)) {
                  slot.addEventListener('mouseenter', () => highlightWallPreview('h', r, targetC, true));
                  slot.addEventListener('mouseleave', () => highlightWallPreview('h', r, targetC, false));
                  slot.addEventListener('click', () => executeWall('h', r, targetC));
                }
              }

              boardEl.appendChild(slot);
            } else if (isCellRow && !isCellCol) {
              // 垂直壁のマス間スロット (列 c と c+1 の間、行 r)
              const r = gr / 2;
              const c = (gc - 1) / 2;

              const isPlaced = (r < 8 && vWalls[r][c]) || (r > 0 && vWalls[r - 1][c]);

              const slot = document.createElement('div');
              slot.className = `qd-wall-slot qd-wall-v-slot ${isPlaced ? 'placed' : ''}`;
              slot.style.gridRow = gr + 1;
              slot.style.gridColumn = gc + 1;

              if (!isPlaced && isHumanTurn && !isGameOver && actionType === 'wall_v' && remainingWalls > 0) {
                const targetR = r < 8 ? r : r - 1;
                if (canPlaceWall('v', targetR, c)) {
                  slot.addEventListener('mouseenter', () => highlightWallPreview('v', targetR, c, true));
                  slot.addEventListener('mouseleave', () => highlightWallPreview('v', targetR, c, false));
                  slot.addEventListener('click', () => executeWall('v', targetR, c));
                }
              }

              boardEl.appendChild(slot);
            } else {
              // 交差点 (Intersection: gr奇数, gc奇数)
              const r = (gr - 1) / 2;
              const c = (gc - 1) / 2;
              const isCrossPlaced = (r < 8 && c < 8) && (hWalls[r][c] || vWalls[r][c]);

              const cross = document.createElement('div');
              cross.className = `qd-wall-cross-slot ${isCrossPlaced ? 'placed' : ''}`;
              cross.style.gridRow = gr + 1;
              cross.style.gridColumn = gc + 1;
              boardEl.appendChild(cross);
            }
          }
        }
      }

      // 壁プレビューのハイライト
      function highlightWallPreview(type, r, c, active) {
        if (type === 'h') {
          // (2r+2, 2c+1), (2r+2, 2c+2), (2r+2, 2c+3)
          const cells = [
            `div[style*="grid-row: ${2 * r + 2}"][style*="grid-column: ${2 * c + 1}"]`,
            `div[style*="grid-row: ${2 * r + 2}"][style*="grid-column: ${2 * c + 2}"]`,
            `div[style*="grid-row: ${2 * r + 2}"][style*="grid-column: ${2 * c + 3}"]`
          ];
          cells.forEach(sel => {
            const el = boardEl.querySelector(sel);
            if (el) el.classList.toggle('preview', active);
          });
        } else {
          // (2r+1, 2c+2), (2r+2, 2c+2), (2r+3, 2c+2)
          const cells = [
            `div[style*="grid-row: ${2 * r + 1}"][style*="grid-column: ${2 * c + 2}"]`,
            `div[style*="grid-row: ${2 * r + 2}"][style*="grid-column: ${2 * c + 2}"]`,
            `div[style*="grid-row: ${2 * r + 3}"][style*="grid-column: ${2 * c + 2}"]`
          ];
          cells.forEach(sel => {
            const el = boardEl.querySelector(sel);
            if (el) el.classList.toggle('preview', active);
          });
        }
      }

      // 壁を置けるかチェック
      function canPlaceWall(type, r, c) {
        if (r < 0 || r >= 8 || c < 0 || c >= 8) return false;

        if (type === 'h') {
          if (hWalls[r][c]) return false;
          if (c > 0 && hWalls[r][c - 1]) return false;
          if (c < 7 && hWalls[r][c + 1]) return false;
          if (vWalls[r][c]) return false; // 十字交差禁止
        } else {
          if (vWalls[r][c]) return false;
          if (r > 0 && vWalls[r - 1][c]) return false;
          if (r < 7 && vWalls[r + 1][c]) return false;
          if (hWalls[r][c]) return false; // 十字交差禁止
        }

        // 経路完全遮断チェック (仮置きして検証)
        if (type === 'h') hWalls[r][c] = true;
        else vWalls[r][c] = true;

        const p1Ok = hasPathToGoal(p1Pos, 0);
        const p2Ok = hasPathToGoal(p2Pos, 8);

        // 元に戻す
        if (type === 'h') hWalls[r][c] = false;
        else vWalls[r][c] = false;

        return p1Ok && p2Ok;
      }

      // コマ移動実行
      function executeMove(r, c, isRemote = false) {
        if (currentTurn === P1) {
          p1Pos = { r, c };
        } else {
          p2Pos = { r, c };
        }

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'quoridor', type: 'move_pawn', r, c });
        }

        // 勝利判定
        if (currentTurn === P1 && r === 0) {
          isGameOver = true;
          resText.textContent = '🎉 青 (あなた) の勝利！ゴール到達！';
          resBanner.classList.remove('hidden');
          bridge.showToast('青の勝利！');
          if (currentTurn === myPlayer) bridge.recordWin();
        } else if (currentTurn === P2 && r === 8) {
          isGameOver = true;
          resText.textContent = vsCpu ? '💀 CPU (赤) の勝利！' : '🎉 赤の勝利！ゴール到達！';
          resBanner.classList.remove('hidden');
          bridge.showToast('赤の勝利！');
        } else {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        render();

        // CPU手番のトリガー
        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      // 壁配置実行
      function executeWall(type, r, c, isRemote = false) {
        if (!canPlaceWall(type, r, c)) {
          bridge.showToast('⚠️ そこには壁を置けません（重複または通路完全封鎖）');
          return;
        }

        if (type === 'h') hWalls[r][c] = true;
        else vWalls[r][c] = true;

        if (currentTurn === P1) p1Walls--;
        else p2Walls--;

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'quoridor', type: 'place_wall', wallType: type, r, c });
        }

        currentTurn = currentTurn === P1 ? P2 : P1;
        actionType = 'move';
        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      // ==========================================
      // 🧠 賢い思考型 CPU (AI) アルゴリズム
      // ==========================================
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;

          // 1. 相手(P1)のゴールまでの最短距離と、自分(P2)のゴールまでの最短距離をBFS計算
          const myDist = getShortestPathDistance(p2Pos, 8);
          const oppDist = getShortestPathDistance(p1Pos, 0);

          let decidedAction = false;

          // 2. 相手が迫っている (距離 <= 3) かつ 自分に壁がある場合、妨害壁を検討！
          if (oppDist <= 3 && p2Walls > 0 && Math.random() < 0.75) {
            const bestWall = findBestBlockingWall(p1Pos, 0, p2Pos, 8);
            if (bestWall) {
              executeWall(bestWall.type, bestWall.r, bestWall.c);
              decidedAction = true;
            }
          }

          // 3. 壁を置かない場合は、自分の最短経路に沿って前進！
          if (!decidedAction) {
            const nextStep = getNextStepTowardsGoal(p2Pos, 8, p1Pos);
            if (nextStep) {
              executeMove(nextStep.r, nextStep.c);
            } else {
              // 最短手が見つからない場合は任意の合法手
              const valids = getValidPawnMoves(p2Pos, p1Pos);
              if (valids.length > 0) {
                const rnd = valids[Math.floor(Math.random() * valids.length)];
                executeMove(rnd.r, rnd.c);
              }
            }
          }
        }, 550);
      }

      // 相手の進行を最も遅らせる妨害壁を探索
      function findBestBlockingWall(targetPos, targetGoal, myPos, myGoal) {
        let bestWall = null;
        let maxDelay = 0;
        const currentTargetDist = getShortestPathDistance(targetPos, targetGoal);

        // 相手の周りの壁スロットを優先評価
        const candidateRows = [targetPos.r, targetPos.r - 1, targetPos.r + 1].filter(r => r >= 0 && r < 8);
        const candidateCols = [targetPos.c, targetPos.c - 1, targetPos.c + 1].filter(c => c >= 0 && c < 8);

        for (const type of ['h', 'v']) {
          for (const r of candidateRows) {
            for (const c of candidateCols) {
              if (canPlaceWall(type, r, c)) {
                // 仮置き
                if (type === 'h') hWalls[r][c] = true;
                else vWalls[r][c] = true;

                const newTargetDist = getShortestPathDistance(targetPos, targetGoal);
                const newMyDist = getShortestPathDistance(myPos, myGoal);

                // 戻す
                if (type === 'h') hWalls[r][c] = false;
                else vWalls[r][c] = false;

                // 相手を遅らせつつ、自分を大きく妨害しない壁
                const delay = newTargetDist - currentTargetDist;
                if (delay > maxDelay && newMyDist < 25) {
                  maxDelay = delay;
                  bestWall = { type, r, c };
                }
              }
            }
          }
        }
        return bestWall;
      }

      // 最短経路で次の1マスを求める (BFS)
      function getNextStepTowardsGoal(startPos, goalRow, oppPos) {
        const queue = [{ r: startPos.r, c: startPos.c, path: [] }];
        const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
        visited[startPos.r][startPos.c] = true;

        while (queue.length > 0) {
          const curr = queue.shift();
          if (curr.r === goalRow) {
            return curr.path[0] || null;
          }

          const moves = getValidPawnMoves({ r: curr.r, c: curr.c }, oppPos);
          for (const m of moves) {
            if (!visited[m.r][m.c]) {
              visited[m.r][m.c] = true;
              queue.push({
                r: m.r,
                c: m.c,
                path: curr.path.length === 0 ? [{ r: m.r, c: m.c }] : curr.path
              });
            }
          }
        }
        return null;
      }

      // BFS最短距離
      function getShortestPathDistance(startPos, goalRow) {
        const queue = [{ r: startPos.r, c: startPos.c, dist: 0 }];
        const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
        visited[startPos.r][startPos.c] = true;

        while (queue.length > 0) {
          const { r, c, dist } = queue.shift();
          if (r === goalRow) return dist;

          const neighbors = getPassableNeighbors(r, c);
          for (const n of neighbors) {
            if (!visited[n.r][n.c]) {
              visited[n.r][n.c] = true;
              queue.push({ r: n.r, c: n.c, dist: dist + 1 });
            }
          }
        }
        return 999;
      }

      // ゴールへの経路があるか判定
      function hasPathToGoal(startPos, goalRow) {
        return getShortestPathDistance(startPos, goalRow) < 999;
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
          if (topRow < 8 && vWalls[topRow][leftCol]) return true;
          if (topRow > 0 && vWalls[topRow - 1][leftCol]) return true;
        } else {
          // 上下移動 (r1 vs r2)
          const topRow = Math.min(r1, r2);
          const leftCol = c1;
          if (leftCol < 8 && hWalls[topRow][leftCol]) return true;
          if (leftCol > 0 && hWalls[topRow][leftCol - 1]) return true;
        }
        return false;
      }

      // コマの移動可能マス計算 (ジャンプも正確に計算)
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
              // 直線ジャンプが壁で遮られている場合、斜めジャンプ
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

      // 再戦
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
          executeMove(data.r, data.c, true);
        } else if (data.type === 'place_wall') {
          executeWall(data.wallType, data.r, data.c, true);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      // 相手合流イベント
      bridge.onPlayerJoined(() => {
        myPlayer = bridge.isHost ? P1 : P2;
        vsCpu = false;
        modeToggleBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！オンライン対戦開始！');
      });

      // 初期化実行
      initGame();

      // アンマウント処理
      return () => {
        isDestroyed = true;
      };
    }
  });
})();
