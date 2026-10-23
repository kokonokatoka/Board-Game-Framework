/**
 * 🎲 ヨット (Yacht / ヤッツィー風ダイス) Component - CPU対戦完備版
 * Board Arena Plugin
 */

(function () {
  const NUM_DICE = 5;
  const MAX_ROLLS = 3;
  const P1 = 1; // あなた
  const P2 = 2; // CPU / 相手

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
    minPlayers: 1,
    maxPlayers: 2,
    description: '5個のサイコロを振り直し役を作れ！上段ボーナス＋35点と「ヨット(50点)」を狙う至高のダイスバトル！CPU対戦付き！',

    mount(container, bridge) {
      let isDestroyed = false;
      let dice = [1, 2, 3, 4, 5];
      let kept = [false, false, false, false, false];
      let rollsLeft = MAX_ROLLS;
      let scores = { [P1]: {}, [P2]: {} };

      let currentTurn = P1;
      let isGameOver = false;
      let vsCpu = !bridge.isConnected();
      let myPlayer = P1;

      // HTML UI
      container.innerHTML = `
        <div class="yct-wrapper">
          <div class="yct-status-bar">
            <div class="yct-turn-group">
              <span class="turn-badge" id="yct-turn-badge">サイコロを振ってください</span>
              <button id="yct-mode-btn" class="btn btn-sm btn-subtle yct-mode-btn">${vsCpu ? '🤖 CPU対戦中' : '👥 2人対戦'}</button>
            </div>
            <div class="yct-rolls-left">残りロール: <strong id="rolls-left-display">3</strong> 回</div>
          </div>

          <!-- ダイスエリア -->
          <div class="yct-dice-tray">
            <div class="dice-container" id="dice-container"></div>
            <button id="btn-roll-dice" class="btn btn-primary btn-lg">🎲 サイコロを振る！</button>
            <span class="keep-guide">キープしたいサイコロをクリックしてください</span>
          </div>

          <!-- スコア表 -->
          <div class="yct-score-sheet-card">
            <table class="yct-score-table">
              <thead>
                <tr>
                  <th>役名 (カテゴリ)</th>
                  <th class="p1-header">あなた (P1)</th>
                  <th class="p2-header">${vsCpu ? 'CPU' : '相手'} (P2)</th>
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

      if (!document.getElementById('yacht-custom-css')) {
        const style = document.createElement('style');
        style.id = 'yacht-custom-css';
        style.textContent = `
          .yct-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; max-width: 520px; margin: 0 auto; user-select: none; color: #f1f5f9; }
          .yct-status-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; background: #111827; padding: 8px 14px; border-radius: 8px; border: 1px solid #283548; flex-wrap: wrap; gap: 8px; }
          .yct-turn-group { display: flex; align-items: center; gap: 8px; }
          .turn-badge { font-size: 13px; font-weight: 700; background: #1e293b; padding: 5px 12px; border-radius: 8px; border: 1px solid #334155; }
          .yct-mode-btn { font-size: 11px; font-weight: 700; background: #1e293b; border: 1px solid #3b82f6; color: #38bdf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
          .yct-rolls-left { font-size: 13px; font-weight: 700; color: #facc15; }
          .yct-dice-tray { width: 100%; background: #14532d; border: 4px solid #166534; border-radius: 16px; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.6), 0 10px 25px rgba(0, 0, 0, 0.5); }
          .dice-container { display: flex; gap: 10px; justify-content: center; min-height: 65px; align-items: center; }
          .yct-die { width: 54px; height: 54px; background: #f8fafc; color: #0f172a; border-radius: 12px; box-shadow: 0 5px 10px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.9); display: flex; justify-content: center; align-items: center; font-size: 32px; font-weight: 900; cursor: pointer; transition: all 0.15s ease; position: relative; }
          .yct-die:hover { transform: translateY(-4px); }
          .yct-die.kept { border: 3px solid #f59e0b; box-shadow: 0 0 14px rgba(245, 158, 11, 0.8); transform: translateY(-8px); }
          .yct-die.kept::after { content: 'KEEP'; position: absolute; bottom: -18px; font-size: 10px; font-weight: 800; color: #f59e0b; }
          .keep-guide { font-size: 11px; color: #86efac; }
          .yct-score-sheet-card { width: 100%; background: #18202c; border: 1px solid #2b384a; border-radius: 12px; overflow: hidden; }
          .yct-score-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .yct-score-table th, .yct-score-table td { padding: 5px 10px; text-align: center; border-bottom: 1px solid #283548; }
          .yct-score-table th:first-child, .yct-score-table td:first-child { text-align: left; font-weight: 700; }
          .p1-header { color: #38bdf8; }
          .p2-header { color: #f87171; }
          .score-cell.selectable { cursor: pointer; background: rgba(56, 189, 248, 0.15); color: #facc15; font-weight: 800; border-radius: 4px; transition: background 0.15s; }
          .score-cell.selectable:hover { background: rgba(250, 204, 21, 0.35); }
          .total-row { background: #0f172a; font-size: 14px; font-weight: 900; }
          .total-row td { border-bottom: none; }
          .yct-result-banner { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; width: 100%; background: #1e293b; border: 2px solid #10b981; padding: 10px 16px; border-radius: 8px; font-weight: 700; }
          .yct-result-banner.hidden { display: none; }
        `;
        document.head.appendChild(style);
      }

      const diceContainer = container.querySelector('#dice-container');
      const btnRollDice = container.querySelector('#btn-roll-dice');
      const rollsLeftDisplay = container.querySelector('#rolls-left-display');
      const turnBadge = container.querySelector('#yct-turn-badge');
      const modeBtn = container.querySelector('#yct-mode-btn');
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
        isGameOver = false;
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
          triggerCpuTurn();
        }
      });

      function rollDice(isLocal = false) {
        if (rollsLeft <= 0 || isGameOver) return;

        for (let i = 0; i < NUM_DICE; i++) {
          if (!kept[i]) {
            dice[i] = Math.floor(Math.random() * 6) + 1;
          }
        }
        rollsLeft--;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'yacht', type: 'roll', dice: dice, kept: kept, rollsLeft: rollsLeft });
        }

        render();
      }

      btnRollDice.addEventListener('click', () => {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
        if (isHumanTurn) {
          rollDice(isConnected);
        }
      });

      function selectCategory(catId, player, isLocal = false) {
        if (scores[player][catId] !== undefined) return;

        const score = calculateCategoryScore(catId, dice);
        scores[player][catId] = score;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'yacht', type: 'score', catId: catId, score: score });
        }

        // 次のターンへリセット
        rollsLeft = MAX_ROLLS;
        kept = [false, false, false, false, false];

        // 全枠終了判定 (全12カテゴリ)
        const p1Finished = CATEGORIES.every(c => scores[P1][c.id] !== undefined);
        const p2Finished = CATEGORIES.every(c => scores[P2][c.id] !== undefined);

        if (p1Finished && p2Finished) {
          isGameOver = true;
          const p1Tot = calculateTotal(P1).total;
          const p2Tot = calculateTotal(P2).total;
          let msg = '';
          if (p1Tot > p2Tot) {
            msg = `🎉 あなたの勝利！ (${p1Tot}点 vs ${p2Tot}点)`;
            bridge.recordWin();
          } else if (p2Tot > p1Tot) {
            msg = vsCpu ? `💀 CPU の勝利！ (${p2Tot}点 vs ${p1Tot}点)` : `🎉 P2 の勝利！ (${p2Tot}点 vs ${p1Tot}点)`;
          } else {
            msg = `🤝 引き分け！ (${p1Tot}点)`;
          }
          resText.textContent = msg;
          resBanner.classList.remove('hidden');
          bridge.showToast(msg);
        } else {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        render();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuTurn();
        }
      }

      // 🧠 賢い思考型ヨットCPU (AI)
      function triggerCpuTurn() {
        if (isGameOver || isDestroyed) return;

        // 1回目のロール
        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;
          rollDice(false);

          // 2回目のキープ選択 & ロール
          setTimeout(() => {
            if (isGameOver || currentTurn !== P2 || isDestroyed) return;
            cpuDecideKeeps();
            rollDice(false);

            // 3回目のキープ選択 & ロール (必要なら)
            setTimeout(() => {
              if (isGameOver || currentTurn !== P2 || isDestroyed) return;
              cpuDecideKeeps();
              rollDice(false);

              // 最終カテゴリ選択
              setTimeout(() => {
                if (isGameOver || currentTurn !== P2 || isDestroyed) return;
                cpuSelectBestCategory();
              }, 500);
            }, 600);
          }, 600);
        }, 500);
      }

      function cpuDecideKeeps() {
        // 出目の頻度をカウント
        const counts = {};
        dice.forEach(d => counts[d] = (counts[d] || 0) + 1);

        let maxCount = 0;
        let mostFrequentVal = 1;
        for (const [val, c] of Object.entries(counts)) {
          if (c > maxCount) {
            maxCount = c;
            mostFrequentVal = parseInt(val, 10);
          }
        }

        // ヨット・フォーダイス・フルハウス狙いで最頻出目をキープ
        dice.forEach((d, idx) => {
          if (d === mostFrequentVal) {
            kept[idx] = true;
          }
        });
        render();
      }

      function cpuSelectBestCategory() {
        let bestCat = null;
        let maxScore = -1;

        // 空いているカテゴリの中で最高得点の手を探索
        CATEGORIES.forEach(cat => {
          if (scores[P2][cat.id] === undefined) {
            const sc = calculateCategoryScore(cat.id, dice);
            if (sc > maxScore) {
              maxScore = sc;
              bestCat = cat.id;
            }
          }
        });

        // 0点しか取れない場合は、影響の小さいカテゴリ（エース等）を犠牲にする
        if (maxScore === 0) {
          const sacrificeOrder = ['aces', 'deuces', 'yacht', 'four_kind', 's_straight', 'b_straight'];
          for (const sId of sacrificeOrder) {
            if (scores[P2][sId] === undefined) {
              bestCat = sId;
              break;
            }
          }
          if (!bestCat) {
            const remaining = CATEGORIES.find(c => scores[P2][c.id] === undefined);
            if (remaining) bestCat = remaining.id;
          }
        }

        if (bestCat) {
          selectCategory(bestCat, P2, false);
        }
      }

      function calculateCategoryScore(catId, currentDice) {
        const counts = {};
        let sum = 0;
        currentDice.forEach(d => {
          counts[d] = (counts[d] || 0) + 1;
          sum += d;
        });

        switch (catId) {
          case 'aces': return (counts[1] || 0) * 1;
          case 'deuces': return (counts[2] || 0) * 2;
          case 'treys': return (counts[3] || 0) * 3;
          case 'fours': return (counts[4] || 0) * 4;
          case 'fives': return (counts[5] || 0) * 5;
          case 'sixes': return (counts[6] || 0) * 6;
          case 'choice': return sum;
          case 'four_kind':
            return Object.values(counts).some(c => c >= 4) ? sum : 0;
          case 'full_house': {
            const vals = Object.values(counts);
            return (vals.includes(3) && vals.includes(2)) || vals.includes(5) ? 25 : 0;
          }
          case 's_straight': {
            const u = [...new Set(currentDice)].sort().join('');
            return (u.includes('1234') || u.includes('2345') || u.includes('3456')) ? 30 : 0;
          }
          case 'b_straight': {
            const u = [...new Set(currentDice)].sort().join('');
            return (u === '12345' || u === '23456') ? 40 : 0;
          }
          case 'yacht':
            return Object.values(counts).some(c => c === 5) ? 50 : 0;
          default:
            return 0;
        }
      }

      function calculateTotal(player) {
        let upperSum = 0;
        ['aces', 'deuces', 'treys', 'fours', 'fives', 'sixes'].forEach(id => {
          upperSum += scores[player][id] || 0;
        });
        const bonus = upperSum >= 63 ? 35 : 0;

        let lowerSum = 0;
        ['choice', 'four_kind', 'full_house', 's_straight', 'b_straight', 'yacht'].forEach(id => {
          lowerSum += scores[player][id] || 0;
        });

        return { upper: upperSum, bonus, lower: lowerSum, total: upperSum + bonus + lowerSum };
      }

      function render() {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadge.textContent = '🟢 あなたの手番 (P1)';
            turnBadge.style.color = '#38bdf8';
          } else {
            turnBadge.textContent = vsCpu ? '🤖 CPU の考え中… (P2)' : '🔴 相手の手番 (P2)';
            turnBadge.style.color = '#f87171';
          }
        }

        rollsLeftDisplay.textContent = rollsLeft;
        btnRollDice.disabled = !isHumanTurn || rollsLeft === 0;

        diceContainer.innerHTML = '';
        dice.forEach((val, i) => {
          const die = document.createElement('div');
          die.className = `yct-die ${kept[i] ? 'kept' : ''}`;
          die.textContent = DIE_FACES[val];

          die.addEventListener('click', () => {
            if (isHumanTurn && rollsLeft < MAX_ROLLS && !isGameOver) {
              kept[i] = !kept[i];
              render();
            }
          });

          diceContainer.appendChild(die);
        });

        renderScoreSheet(isHumanTurn, isConnected);
      }

      function renderScoreSheet(isHumanTurn, isConnected) {
        scoreTbody.innerHTML = '';

        CATEGORIES.forEach(cat => {
          const tr = document.createElement('tr');
          const tdName = document.createElement('td');
          tdName.textContent = cat.name;
          tr.appendChild(tdName);

          const tdP1 = document.createElement('td');
          renderScoreCell(tdP1, P1, cat, isHumanTurn && currentTurn === P1, isConnected);
          tr.appendChild(tdP1);

          const tdP2 = document.createElement('td');
          renderScoreCell(tdP2, P2, cat, !vsCpu && isHumanTurn && currentTurn === P2, isConnected);
          tr.appendChild(tdP2);

          scoreTbody.appendChild(tr);
        });

        const p1Tot = calculateTotal(P1);
        const p2Tot = calculateTotal(P2);
        p1GrandTotal.textContent = `${p1Tot.total} ${p1Tot.bonus > 0 ? '(+35)' : ''}`;
        p2GrandTotal.textContent = `${p2Tot.total} ${p2Tot.bonus > 0 ? '(+35)' : ''}`;
      }

      function renderScoreCell(cellEl, player, cat, isSelectable, isConnected) {
        cellEl.className = 'score-cell';
        const recorded = scores[player][cat.id];

        if (recorded !== undefined) {
          cellEl.textContent = recorded;
        } else if (isSelectable && rollsLeft < MAX_ROLLS && !isGameOver) {
          const previewScore = calculateCategoryScore(cat.id, dice);
          cellEl.classList.add('selectable');
          cellEl.textContent = `(${previewScore})`;
          cellEl.onclick = () => selectCategory(cat.id, player, isConnected);
        } else {
          cellEl.textContent = '-';
        }
      }

      bridge.onPlayerJoined(() => {
        myPlayer = bridge.isHost ? P1 : P2;
        vsCpu = false;
        modeBtn.textContent = '👥 2人対戦';
        initGame();
        bridge.showToast('対戦相手が合流しました！ヨット対戦開始！');
      });

      bridge.onReceive((data) => {
        if (data.game !== 'yacht') return;
        if (data.type === 'roll') {
          dice = data.dice;
          kept = data.kept;
          rollsLeft = data.rollsLeft;
          render();
        } else if (data.type === 'score') {
          selectCategory(data.catId, P2, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('再戦を開始しました！');
        }
      });

      restartBtn.addEventListener('click', () => {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'yacht', type: 'restart' });
        }
      });

      initGame();

      return () => {
        isDestroyed = true;
      };
    }
  });
})();
