/**
 * 🎲 ヨット (Yacht / ヤッツィー風ダイス) Component
 * Board Arena Plugin
 * 
 * アソビ大全でも大人気の世界的大ヒットダイスゲーム！
 * 5つのサイコロを振り直して役を作り、スコアシートを埋めろ！
 * 5つゾロ目の「ヨット(50点)」で大逆転！
 */

(function () {
  const NUM_DICE = 5;
  const MAX_ROLLS = 3;
  const P1 = 1;
  const P2 = 2;

  const CATEGORIES = [
    { id: 'aces', name: '⚀ エース (1)', section: 'upper' },
    { id: 'deuces', name: '⚁ デュース (2)', section: 'upper' },
    { id: 'treys', name: '⚂ トレイ (3)', section: 'upper' },
    { id: 'fours', name: '⚃ フォー (4)', section: 'upper' },
    { id: 'fives', name: '⚄ ファイブ (5)', section: 'upper' },
    { id: 'sixes', name: '⚅ シックス (6)', section: 'upper' },
    { id: 'choice', name: 'チョイス (合計)', section: 'lower' },
    { id: 'four_kind', name: 'フォーダイス', section: 'lower' },
    { id: 'full_house', name: 'フルハウス (25点)', section: 'lower' },
    { id: 's_straight', name: 'S.ストレート (30点)', section: 'lower' },
    { id: 'b_straight', name: 'B.ストレート (40点)', section: 'lower' },
    { id: 'yacht', name: '🌟 ヨット (50点)', section: 'lower' }
  ];

  window.BoardArena.registerGame({
    id: 'yacht',
    name: 'ヨット (Yacht Dice)',
    icon: '🎲',
    category: 'ダイス・心理戦',
    minPlayers: 2,
    maxPlayers: 2,
    description: '5個のサイコロを振り直し役を作れ！上段ボーナス＋35点と「ヨット(50点)」を狙う至高のダイスバトル！',

    mount(container, bridge) {
      let dice = [1, 2, 3, 4, 5];
      let kept = [false, false, false, false, false];
      let rollsLeft = MAX_ROLLS;
      let scores = {
        [P1]: {},
        [P2]: {}
      };

      let currentTurn = P1;
      let round = 1;
      let isGameOver = false;
      let myPlayer = bridge.isHost ? P1 : P2;

      // HTML UI
      container.innerHTML = `
        <div class="yct-wrapper">
          <div class="yct-status-bar">
            <div class="turn-badge" id="yct-turn-badge">サイコロを振ってください</div>
            <div class="yct-rolls-left">残りロール: <strong id="rolls-left-display">3</strong> 回</div>
          </div>

          <!-- ダイスエリア -->
          <div class="yct-dice-tray">
            <div class="dice-container" id="dice-container"></div>
            <button id="btn-roll-dice" class="btn btn-primary btn-lg">🎲 サイコロを振る！</button>
            <span class="keep-guide">キープしたいサイコロをクリックしてください</span>
          </div>

          <!-- スコア表 (P1 vs P2) -->
          <div class="yct-score-sheet-card">
            <table class="yct-score-table">
              <thead>
                <tr>
                  <th>役名 (カテゴリ)</th>
                  <th class="p1-header">P1 スコア</th>
                  <th class="p2-header">P2 スコア</th>
                </tr>
              </thead>
              <tbody id="score-table-body"></tbody>
              <tfoot>
                <tr class="total-row">
                  <td><strong>総合得点</strong></td>
                  <td id="p1-grand-total">0</td>
                  <td id="p2-grand-total">0</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- 結果バナー -->
          <div id="yct-result-banner" class="yct-result-banner hidden">
            <span id="yct-result-text">勝敗結果</span>
            <button id="yct-restart-btn" class="btn btn-sm btn-primary">もう一度遊ぶ</button>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('yacht-custom-css')) {
        const style = document.createElement('style');
        style.id = 'yacht-custom-css';
        style.textContent = `
          .yct-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 620px;
            margin: 0 auto;
            user-select: none;
            color: #f1f5f9;
          }

          .yct-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
          }

          .yct-rolls-left {
            font-size: 14px;
            font-weight: 700;
            color: #f59e0b;
          }

          /* ダイストレイ */
          .yct-dice-tray {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            background: #0f172a;
            border: 2px solid #334155;
            border-radius: 14px;
            padding: 16px 20px;
            width: 100%;
          }

          .dice-container {
            display: flex;
            gap: 12px;
            justify-content: center;
          }

          /* ダイス */
          .yct-die {
            width: 58px;
            height: 58px;
            background: #f8fafc;
            color: #0f172a;
            border-radius: 12px;
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 34px;
            font-weight: 900;
            cursor: pointer;
            transition: all 0.15s ease;
            position: relative;
          }
          .yct-die:hover {
            transform: translateY(-4px);
          }
          .yct-die.kept {
            border: 3px solid #f59e0b;
            box-shadow: 0 0 14px rgba(245, 158, 11, 0.8);
            transform: translateY(-8px);
          }
          .yct-die.kept::after {
            content: 'KEEP';
            position: absolute;
            bottom: -18px;
            font-size: 10px;
            font-weight: 800;
            color: #f59e0b;
          }

          .keep-guide {
            font-size: 12px;
            color: #94a3b8;
          }

          /* スコアシート */
          .yct-score-sheet-card {
            width: 100%;
            background: #18202c;
            border: 1px solid #2b384a;
            border-radius: 12px;
            overflow: hidden;
          }

          .yct-score-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .yct-score-table th, .yct-score-table td {
            padding: 6px 12px;
            text-align: center;
            border-bottom: 1px solid #283548;
          }
          .yct-score-table th:first-child, .yct-score-table td:first-child {
            text-align: left;
            font-weight: 700;
          }

          .p1-header { color: #38bdf8; }
          .p2-header { color: #f87171; }

          /* スコア枠選択可能 (プレビュー) */
          .score-cell.selectable {
            cursor: pointer;
            background: rgba(56, 189, 248, 0.15);
            color: #facc15;
            font-weight: 800;
            border-radius: 4px;
            transition: background 0.15s;
          }
          .score-cell.selectable:hover {
            background: rgba(250, 204, 21, 0.35);
          }

          .total-row {
            background: #0f172a;
            font-size: 15px;
            font-weight: 900;
          }
          .total-row td { border-bottom: none; }

          /* 結果バナー */
          .yct-result-banner {
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
          .yct-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const diceContainer = container.querySelector('#dice-container');
      const btnRollDice = container.querySelector('#btn-roll-dice');
      const rollsLeftDisplay = container.querySelector('#rolls-left-display');
      const turnBadge = container.querySelector('#yct-turn-badge');
      const scoreTbody = container.querySelector('#score-table-body');
      const p1GrandTotal = container.querySelector('#p1-grand-total');
      const p2GrandTotal = container.querySelector('#p2-grand-total');
      const resBanner = container.querySelector('#yct-result-banner');
      const resText = container.querySelector('#yct-result-text');
      const restartBtn = container.querySelector('#yct-restart-btn');

      const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

      function initGame() {
        dice = [1, 2, 3, 4, 5];
        kept = [false, false, false, false, false];
        rollsLeft = MAX_ROLLS;
        scores = { [P1]: {}, [P2]: {} };
        currentTurn = P1;
        round = 1;
        isGameOver = false;
        resBanner.classList.add('hidden');
        render();
      }

      function render() {
        const isConnected = bridge.isConnected();
        const isMyTurn = (!isConnected || currentTurn === myPlayer) && !isGameOver;

        // ステータス表示
        if (!isGameOver) {
          if (!isConnected) {
            turnBadge.textContent = `⏳ 待機中 (一人練習中: ${currentTurn === P1 ? 'P1' : 'P2'})`;
            turnBadge.style.color = currentTurn === P1 ? '#38bdf8' : '#f87171';
          } else if (currentTurn === P1) {
            turnBadge.textContent = myPlayer === P1 ? '🟢 あなたの手番 (P1)' : '相手がダイスを振っています… (P1)';
            turnBadge.style.color = '#38bdf8';
          } else {
            turnBadge.textContent = myPlayer === P2 ? '🟢 あなたの手番 (P2)' : '相手がダイスを振っています… (P2)';
            turnBadge.style.color = '#f87171';
          }
        }

        rollsLeftDisplay.textContent = rollsLeft;
        btnRollDice.disabled = !isMyTurn || rollsLeft === 0;

        // ダイス描画
        diceContainer.innerHTML = '';
        dice.forEach((val, i) => {
          const die = document.createElement('div');
          die.className = `yct-die ${kept[i] ? 'kept' : ''}`;
          die.textContent = DIE_FACES[val];

          die.addEventListener('click', () => {
            if (isMyTurn && rollsLeft < MAX_ROLLS && !isGameOver) {
              kept[i] = !kept[i];
              render();
            }
          });

          diceContainer.appendChild(die);
        });

        // スコアテーブル描画
        renderScoreSheet(isMyTurn, isConnected);
      }

      function renderScoreSheet(isMyTurn, isConnected) {
        scoreTbody.innerHTML = '';

        CATEGORIES.forEach(cat => {
          const tr = document.createElement('tr');
          const tdName = document.createElement('td');
          tdName.textContent = cat.name;
          tr.appendChild(tdName);

          // P1 スコア枠
          const tdP1 = document.createElement('td');
          renderScoreCell(tdP1, P1, cat, isMyTurn && currentTurn === P1, isConnected);
          tr.appendChild(tdP1);

          // P2 スコア枠
          const tdP2 = document.createElement('td');
          renderScoreCell(tdP2, P2, cat, isMyTurn && currentTurn === P2, isConnected);
          tr.appendChild(tdP2);

          scoreTbody.appendChild(tr);
        });

        // 合計計算
        const p1Tot = calculateTotal(P1);
        const p2Tot = calculateTotal(P2);
        p1GrandTotal.textContent = `${p1Tot.total} ${p1Tot.bonus > 0 ? '(ボーナス+35)' : ''}`;
        p2GrandTotal.textContent = `${p2Tot.total} ${p2Tot.bonus > 0 ? '(ボーナス+35)' : ''}`;
      }

      function renderScoreCell(td, player, cat, canSelect, isConnected) {
        const recorded = scores[player][cat.id];
        if (recorded !== undefined) {
          td.textContent = recorded;
          td.className = 'score-cell recorded';
        } else if (canSelect && rollsLeft < MAX_ROLLS) {
          // プレビュー表示＆選択可能
          const potScore = evaluateCategory(cat.id, dice);
          td.textContent = potScore;
          td.className = 'score-cell selectable';
          td.title = 'クリックしてこの役を確定';

          td.addEventListener('click', () => {
            recordScore(player, cat.id, potScore, isConnected);
          });
        } else {
          td.textContent = '-';
          td.className = 'score-cell empty';
        }
      }

      // ロール実行
      btnRollDice.addEventListener('click', () => {
        if (rollsLeft <= 0) return;

        for (let i = 0; i < NUM_DICE; i++) {
          if (!kept[i]) {
            dice[i] = Math.floor(Math.random() * 6) + 1;
          }
        }
        rollsLeft--;

        if (bridge.isConnected()) {
          bridge.send({ game: 'yacht', type: 'roll', dice, kept, rollsLeft });
        }

        render();
      });

      // スコア確定
      function recordScore(player, catId, scoreVal, isLocal = false) {
        scores[player][catId] = scoreVal;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'yacht', type: 'score', player, catId, scoreVal });
        }

        // ラウンド進行チェック
        const allDone = CATEGORIES.every(c => scores[P1][c.id] !== undefined && scores[P2][c.id] !== undefined);
        if (allDone) {
          isGameOver = true;
          const p1Tot = calculateTotal(P1).total;
          const p2Tot = calculateTotal(P2).total;

          let msg = '';
          if (p1Tot > p2Tot) msg = `🎉 P1 の勝利！！ (${p1Tot}点 vs ${p2Tot}点)`;
          else if (p2Tot > p1Tot) msg = `🎉 P2 の勝利！！ (${p2Tot}点 vs ${p1Tot}点)`;
          else msg = `🤝 引き分け！ (${p1Tot}点 vs ${p2Tot}点)`;

          resText.textContent = msg;
          resBanner.classList.remove('hidden');
          bridge.showToast(msg);
        } else {
          // ターン交代
          currentTurn = currentTurn === P1 ? P2 : P1;
          rollsLeft = MAX_ROLLS;
          kept = [false, false, false, false, false];
          bridge.showToast(`役を記録しました。ターン交代！`);
        }

        render();
      }

      // 各役のスコア計算ルール
      function evaluateCategory(id, currentDice) {
        const counts = [0, 0, 0, 0, 0, 0, 0];
        let sum = 0;
        currentDice.forEach(d => { counts[d]++; sum += d; });

        // 上段
        if (id === 'aces') return counts[1] * 1;
        if (id === 'deuces') return counts[2] * 2;
        if (id === 'treys') return counts[3] * 3;
        if (id === 'fours') return counts[4] * 4;
        if (id === 'fives') return counts[5] * 5;
        if (id === 'sixes') return counts[6] * 6;

        // 下段
        if (id === 'choice') return sum;
        if (id === 'four_kind') {
          return counts.some(c => c >= 4) ? sum : 0;
        }
        if (id === 'full_house') {
          const has3 = counts.some(c => c === 3);
          const has2 = counts.some(c => c === 2);
          const has5 = counts.some(c => c === 5);
          return (has3 && has2) || has5 ? 25 : 0;
        }
        if (id === 's_straight') {
          // 4連続 (1-2-3-4, 2-3-4-5, 3-4-5-6)
          const s = new Set(currentDice);
          const hasSeq = (a,b,c,d) => s.has(a) && s.has(b) && s.has(c) && s.has(d);
          return hasSeq(1,2,3,4) || hasSeq(2,3,4,5) || hasSeq(3,4,5,6) ? 30 : 0;
        }
        if (id === 'b_straight') {
          // 5連続 (1-2-3-4-5, 2-3-4-5-6)
          const s = new Set(currentDice);
          const hasSeq = (a,b,c,d,e) => s.has(a) && s.has(b) && s.has(c) && s.has(d) && s.has(e);
          return hasSeq(1,2,3,4,5) || hasSeq(2,3,4,5,6) ? 40 : 0;
        }
        if (id === 'yacht') {
          return counts.some(c => c === 5) ? 50 : 0;
        }
        return 0;
      }

      function calculateTotal(player) {
        let upper = 0;
        let lower = 0;
        CATEGORIES.forEach(c => {
          const val = scores[player][c.id] || 0;
          if (c.section === 'upper') upper += val;
          else lower += val;
        });
        const bonus = upper >= 63 ? 35 : 0;
        return { total: upper + bonus + lower, bonus: bonus };
      }

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'yacht', type: 'restart' });
        }
      });

      bridge.onReceive((data) => {
        if (data.game !== 'yacht') return;
        if (data.type === 'roll') {
          dice = data.dice;
          kept = data.kept;
          rollsLeft = data.rollsLeft;
          render();
        } else if (data.type === 'score') {
          recordScore(data.player, data.catId, data.scoreVal, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！ヨット開始！');
      });

      initGame();
    },

    unmount() {}
  });
})();
