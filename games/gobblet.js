/**
 * 🧡 ゴブレットゴブラーズ (Gobblet Gobblers) Component - CPU対戦完備版
 * Board Arena Plugin
 */

(function () {
  const P1 = 1; // オレンジ (あなた)
  const P2 = 2; // ブルー (CPU / 相手)

  const SIZES = {
    1: { name: '小', label: 'S', px: 28 },
    2: { name: '中', label: 'M', px: 42 },
    3: { name: '大', label: 'L', px: 58 }
  };

  const WIN_LINES = [
    // 横
    [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
    // 縦
    [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
    // 斜め
    [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
  ];

  window.BoardArena.registerGame({
    id: 'gobblet',
    name: 'ゴブレットゴブラーズ',
    category: 'ボードゲーム',
    icon: '👾',
    players: '1〜2人',
    playTime: '3-5分',
    description: '3×3の進化系まるばつゲーム！小さいコマの上から「被せて」乗っ取れる白熱の心理戦！CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let board = [
        [[], [], []],
        [[], [], []],
        [[], [], []]
      ];

      let hands = {
        [P1]: { 1: 2, 2: 2, 3: 2 },
        [P2]: { 1: 2, 2: 2, 3: 2 }
      };

      let currentTurn = P1;
      let isGameOver = false;
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;
      let selectedPiece = null;

      container.innerHTML = `
        <div class="gobblet-wrapper">
          <div class="gobblet-status-bar">
            <div class="gob-turn-group">
              <span class="turn-badge" id="gob-turn-badge">オレンジの手番です</span>
              <button id="gob-mode-btn" class="btn btn-sm btn-subtle gob-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="gobblet-hint" id="gob-hint">コマを選んでマスに置いてください</div>
          </div>

          <!-- P1 (オレンジ) 手持ちエリア -->
          <div class="gob-hand-section" id="p1-hand-area">
            <span class="hand-label p1-label">あなた (オレンジ) 手持ち:</span>
            <div class="hand-pieces" id="p1-pieces"></div>
          </div>

          <!-- 3×3 盤面 -->
          <div class="gobblet-board-frame">
            <div id="gobblet-grid" class="gobblet-grid"></div>
          </div>

          <!-- P2 (ブルー) 手持ちエリア -->
          <div class="gob-hand-section" id="p2-hand-area">
            <span class="hand-label p2-label">${vsCpu ? 'CPU' : '相手'} (ブルー) 手持ち:</span>
            <div class="hand-pieces" id="p2-pieces"></div>
          </div>

          <!-- 結果バナー -->
          <div id="gobblet-result" class="gobblet-result-banner hidden">
            <span id="gob-res-text">勝敗結果</span>
            <button id="gob-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      const gridEl = container.querySelector('#gobblet-grid');
      const turnBadge = container.querySelector('#gob-turn-badge');
      const modeBtn = container.querySelector('#gob-mode-btn');
      const hintEl = container.querySelector('#gob-hint');
      const p1PiecesEl = container.querySelector('#p1-pieces');
      const p2PiecesEl = container.querySelector('#p2-pieces');
      const resBanner = container.querySelector('#gobblet-result');
      const resText = container.querySelector('#gob-res-text');
      const restartBtn = container.querySelector('#gob-restart-btn');

      if (!document.getElementById('gobblet-custom-css')) {
        const style = document.createElement('style');
        style.id = 'gobblet-custom-css';
        style.textContent = `
          .gobblet-wrapper { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 440px; margin: 0 auto; user-select: none; }
          .gobblet-status-bar { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
          .gob-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 13px; font-weight: 700; background: #1e293b; padding: 5px 12px; border-radius: 8px; border: 1px solid #334155; }
          .gob-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .gobblet-hint { font-size: 11px; color: #94a3b8; }
          .gob-hand-section { display: flex; align-items: center; justify-content: space-between; width: 100%; background: #161f2e; padding: 6px 12px; border-radius: 10px; margin: 3px 0; border: 1px solid #2b384a; }
          .hand-label { font-size: 12px; font-weight: 700; }
          .p1-label { color: #f97316; }
          .p2-label { color: #38bdf8; }
          .hand-pieces { display: flex; gap: 8px; align-items: center; }
          
          .hand-slot { display: flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; background: #0f172a; transition: all 0.15s; }
          .hand-slot:hover { border-color: #64748b; }
          .hand-slot.selected { border-color: #facc15; box-shadow: 0 0 10px rgba(250, 204, 21, 0.6); transform: scale(1.08); }
          .slot-count { font-size: 12px; font-weight: 800; color: #fff; }

          .gobblet-board-frame { width: 100%; aspect-ratio: 1/1; padding: 10px; background: #291e14; border-radius: 16px; box-shadow: 0 14px 34px rgba(0,0,0,0.6); margin: 6px 0; }
          .gobblet-grid { width: 100%; height: 100%; background: #453220; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 6px; border: 3px solid #1a120b; border-radius: 8px; }
          .gob-cell { background: #5c432d; display: flex; justify-content: center; align-items: center; cursor: pointer; position: relative; border-radius: 6px; transition: background 0.15s; }
          .gob-cell:hover { background: #6e5137; }
          .gob-cell.valid-target { background: #3b5034; box-shadow: inset 0 0 12px #4ade80; }
          .gob-cell.selected-source { border: 2px solid #facc15; }

          .gob-piece { border-radius: 50%; display: flex; justify-content: center; align-items: center; position: relative; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: transform 0.2s; }
          .gob-piece.p1 { background: radial-gradient(circle at 35% 35%, #fb923c, #ea580c 70%, #9a3412); border: 2px solid #fdba74; }
          .gob-piece.p2 { background: radial-gradient(circle at 35% 35%, #38bdf8, #0284c7 70%, #0369a1); border: 2px solid #7dd3fc; }
          .gob-piece::before { content: '👀'; font-size: calc(var(--size) * 0.45px); line-height: 1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }

          .gobblet-result-banner { margin-top: 10px; background: #1e293b; border: 1px solid #f59e0b; padding: 10px 20px; border-radius: 12px; display: flex; gap: 14px; align-items: center; font-weight: 700; color: #f59e0b; }
        `;
        document.head.appendChild(style);
      }

      function initGame() {
        board = [
          [[], [], []],
          [[], [], []],
          [[], [], []]
        ];
        hands[P1] = { 1: 2, 2: 2, 3: 2 };
        hands[P2] = { 1: 2, 2: 2, 3: 2 };
        currentTurn = P1;
        isGameOver = false;
        selectedPiece = null;
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

      function canPlaceOnCell(r, c, size) {
        const stack = board[r][c];
        if (stack.length === 0) return true;
        const top = stack[stack.length - 1];
        return size > top.size;
      }

      function checkWinner() {
        for (const line of WIN_LINES) {
          const [a, b, c] = line;
          const topA = board[a[0]][a[1]].at(-1);
          const topB = board[b[0]][b[1]].at(-1);
          const topC = board[c[0]][c[1]].at(-1);

          if (topA && topB && topC) {
            if (topA.player === topB.player && topB.player === topC.player) {
              return topA.player;
            }
          }
        }
        return null;
      }

      function executeMove(moveData, isLocal = false) {
        const { from, to, player } = moveData;
        let movingPiece = null;

        if (from.type === 'hand') {
          hands[player][from.size]--;
          movingPiece = { player: player, size: from.size };
        } else if (from.type === 'board') {
          movingPiece = board[from.r][from.c].pop();
        }

        board[to.r][to.c].push(movingPiece);

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'gobblet', type: 'move', move: moveData });
        }

        const winner = checkWinner();
        if (winner) {
          isGameOver = true;
          const winnerName = winner === P1 
            ? '🎉 オレンジ (あなた) の勝利！！' 
            : (vsCpu ? '💀 ブルー (CPU) の勝利！' : '🎉 ブルー の勝利！！');
          resText.textContent = winnerName;
          resBanner.classList.remove('hidden');
          bridge.showToast(winnerName);
          if (winner === P1) bridge.recordWin();
        } else {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        selectedPiece = null;
        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      // 🧠 賢い思考型ゴブレットCPU (AI)
      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;

        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;

          const legalMoves = getAllLegalMoves(P2);
          if (legalMoves.length === 0) return;

          // 1. CPUが勝利できる手
          for (const m of legalMoves) {
            applyTempMove(m);
            const w = checkWinner();
            revertTempMove(m);
            if (w === P2) {
              executeMove(m, false);
              return;
            }
          }

          // 2. 相手(P1)のリーチを阻止する手
          const oppWinningCells = findWinningThreats(P1);
          if (oppWinningCells.length > 0) {
            for (const threat of oppWinningCells) {
              // threatのマスの真上に被せられる自分の手を探す
              const blockMove = legalMoves.find(m => m.to.r === threat.r && m.to.c === threat.c);
              if (blockMove) {
                applyTempMove(blockMove);
                const w = checkWinner();
                revertTempMove(blockMove);
                // 自滅手でなければ阻止！
                if (w !== P1) {
                  executeMove(blockMove, false);
                  return;
                }
              }
            }
          }

          // 3. 中央 (1, 1) への配置優先
          const centerMove = legalMoves.find(m => m.to.r === 1 && m.to.c === 1 && m.from.type === 'hand');
          if (centerMove) {
            executeMove(centerMove, false);
            return;
          }

          // 4. 自滅手（相手が勝つ）を避けて、安全な最善手を選択
          const safeMoves = [];
          for (const m of legalMoves) {
            applyTempMove(m);
            const w = checkWinner();
            revertTempMove(m);
            if (w !== P1) {
              safeMoves.push(m);
            }
          }

          if (safeMoves.length > 0) {
            // サイズが大きいコマ、または中央・角を優先
            safeMoves.sort((a, b) => {
              const sizeA = a.from.size;
              const sizeB = b.from.size;
              return sizeB - sizeA;
            });
            executeMove(safeMoves[0], false);
          } else {
            executeMove(legalMoves[0], false);
          }
        }, 500);
      }

      function getAllLegalMoves(player) {
        const moves = [];
        const hand = hands[player];

        // 手持ちからの配置
        [3, 2, 1].forEach(size => {
          if (hand[size] > 0) {
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                if (canPlaceOnCell(r, c, size)) {
                  moves.push({
                    from: { type: 'hand', size: size },
                    to: { r: r, c: c },
                    player: player
                  });
                }
              }
            }
          }
        });

        // 盤面からの移動
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const top = board[r][c].at(-1);
            if (top && top.player === player) {
              for (let tr = 0; tr < 3; tr++) {
                for (let tc = 0; tc < 3; tc++) {
                  if (r === tr && c === tc) continue;
                  if (canPlaceOnCell(tr, tc, top.size)) {
                    moves.push({
                      from: { type: 'board', r: r, c: c, size: top.size },
                      to: { r: tr, c: tc },
                      player: player
                    });
                  }
                }
              }
            }
          }
        }
        return moves;
      }

      function applyTempMove(m) {
        if (m.from.type === 'hand') {
          board[m.to.r][m.to.c].push({ player: m.player, size: m.from.size });
        } else {
          const piece = board[m.from.r][m.from.c].pop();
          board[m.to.r][m.to.c].push(piece);
        }
      }

      function revertTempMove(m) {
        if (m.from.type === 'hand') {
          board[m.to.r][m.to.c].pop();
        } else {
          const piece = board[m.to.r][m.to.c].pop();
          board[m.from.r][m.from.c].push(piece);
        }
      }

      function findWinningThreats(player) {
        const threats = [];
        for (const line of WIN_LINES) {
          let count = 0;
          let emptyCell = null;
          for (const [r, c] of line) {
            const top = board[r][c].at(-1);
            if (top && top.player === player) {
              count++;
            } else if (!top || top.size < 3) {
              emptyCell = { r, c };
            }
          }
          if (count === 2 && emptyCell) {
            threats.push(emptyCell);
          }
        }
        return threats;
      }

      function render() {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
        const activePlayer = isConnected ? myPlayer : currentTurn;

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🟠 あなたの手番 (オレンジ)';
            turnBadge.style.color = '#f97316';
          } else {
            turnBadge.textContent = vsCpu ? '🔵 CPU の考え中… (ブルー)' : '🔵 相手の手番 (ブルー)';
            turnBadge.style.color = '#38bdf8';
          }

          if (isHumanTurn) {
            hintEl.textContent = selectedPiece ? '置くマスをクリックしてください' : '手持ちまたは盤面のコマを選んでください';
          } else {
            hintEl.textContent = '相手がコマを選んでいます…';
          }
        }

        renderHand(P1, p1PiecesEl, isHumanTurn && currentTurn === P1, activePlayer);
        renderHand(P2, p2PiecesEl, !vsCpu && isHumanTurn && currentTurn === P2, activePlayer);

        gridEl.innerHTML = '';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const cell = document.createElement('div');
            cell.className = 'gob-cell';
            const stack = board[r][c];
            const top = stack.at(-1);

            if (top) {
              const pieceEl = createPieceElement(top.player, top.size);
              cell.appendChild(pieceEl);

              if (isHumanTurn && (top.player === activePlayer)) {
                cell.addEventListener('click', (e) => {
                  e.stopPropagation();
                  if (selectedPiece && selectedPiece.type === 'board' && selectedPiece.r === r && selectedPiece.c === c) {
                    selectedPiece = null;
                  } else {
                    selectedPiece = { type: 'board', r: r, c: c, size: top.size, player: top.player };
                  }
                  render();
                });
              }
            }

            if (isHumanTurn && selectedPiece) {
              const isSource = selectedPiece.type === 'board' && selectedPiece.r === r && selectedPiece.c === c;
              if (isSource) {
                cell.classList.add('selected-source');
              } else if (canPlaceOnCell(r, c, selectedPiece.size)) {
                cell.classList.add('valid-target');
                cell.addEventListener('click', () => {
                  executeMove({
                    from: selectedPiece,
                    to: { r: r, c: c },
                    player: selectedPiece.player || activePlayer
                  }, isConnected);
                });
              }
            }

            gridEl.appendChild(cell);
          }
        }
      }

      function renderHand(player, containerEl, isSelectable, activePlayer = myPlayer) {
        containerEl.innerHTML = '';
        const hand = hands[player];

        [3, 2, 1].forEach((size) => {
          const count = hand[size];
          if (count > 0) {
            const slot = document.createElement('div');
            slot.className = 'hand-slot';
            if (selectedPiece && selectedPiece.type === 'hand' && selectedPiece.size === size && player === (selectedPiece.player || activePlayer)) {
              slot.classList.add('selected');
            }

            const pEl = createPieceElement(player, size);
            slot.appendChild(pEl);

            const countEl = document.createElement('span');
            countEl.className = 'slot-count';
            countEl.textContent = `×${count}`;
            slot.appendChild(countEl);

            if (isSelectable) {
              slot.addEventListener('click', () => {
                if (selectedPiece && selectedPiece.type === 'hand' && selectedPiece.size === size && selectedPiece.player === player) {
                  selectedPiece = null;
                } else {
                  selectedPiece = { type: 'hand', size: size, player: player };
                }
                render();
              });
            }
            containerEl.appendChild(slot);
          }
        });
      }

      function createPieceElement(player, size) {
        const el = document.createElement('div');
        el.className = `gob-piece ${player === P1 ? 'p1' : 'p2'}`;
        const px = SIZES[size].px;
        el.style.width = `${px}px`;
        el.style.height = `${px}px`;
        el.style.setProperty('--size', px);
        return el;
      }

      bridge.onPlayerJoined(() => {
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！ゴブレット開始！');
      });

      bridge.onReceive((data) => {
        if (data.game !== 'gobblet') return;
        if (data.type === 'move') {
          executeMove(data.move, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦が開始されました！');
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'gobblet', type: 'restart' });
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
