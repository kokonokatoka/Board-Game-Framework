/**
 * 🕵️‍♂️ コードネーム (Codenames) Component
 * Board Arena Plugin
 * 
 * Vlaada Chvátil 氏考案の名作ワード推理ゲーム
 * 5×5 (計25枚) のコードネームから、スパイマスターのヒントを頼りに
 * 自チームのエージェントを相手より早くすべて特定せよ！
 * 暗殺者 (Assassin) を引いたら即座に一発敗北！
 */

(function () {
  // 厳選された200語以上の単語プール
  const WORD_POOL = [
    // 自然・天体・地理
    "太陽", "月", "地球", "宇宙", "星", "銀河", "空", "海", "山", "川",
    "島", "森", "砂漠", "火山", "洞窟", "雲", "雨", "雪", "雷", "虹",
    "風", "炎", "氷", "波", "花", "桜", "木", "種", "草", "石",
    "砂", "泉", "谷", "崖", "彗星", "星座", "大地", "深海", "オーロラ",
    // 動物・生物・モンスター
    "犬", "猫", "ライオン", "虎", "象", "熊", "狼", "キツネ", "猿", "馬",
    "牛", "羊", "鳥", "鷲", "ペンギン", "鯨", "鮫", "イルカ", "タコ", "魚",
    "カエル", "蝶", "蜂", "蜘蛛", "恐竜", "ドラゴン", "不死鳥", "蛇", "カメ", "コウモリ",
    // 人物・職業・ファンタジー
    "医者", "警察", "先生", "探偵", "忍者", "侍", "海賊", "王様", "女王", "騎士",
    "スパイ", "泥棒", "料理人", "歌手", "画家", "パイロット", "宇宙人", "幽霊", "魔法使い", "ロボット",
    "人形", "赤ちゃん", "巨人", "天使", "悪魔", "ヒーロー", "科学者", "兵士", "裁判官", "マジシャン",
    // 建物・乗り物・場所
    "城", "家", "学校", "病院", "図書館", "映画館", "ホテル", "駅", "空港", "公園",
    "教会", "ピラミッド", "タワー", "橋", "道", "車", "電車", "飛行機", "船", "潜水艦",
    "ロケット", "自転車", "バス", "救急車", "要塞", "遊園地", "劇場", "工場", "港", "市場",
    // 道具・武具・日用品
    "本", "手紙", "電話", "パソコン", "時計", "鏡", "鍵", "傘", "カメラ", "ハサミ",
    "包丁", "メガネ", "帽子", "靴", "鞄", "財布", "指輪", "ネックレス", "剣", "弓",
    "銃", "爆弾", "盾", "椅子", "机", "ベッド", "扉", "窓", "ロープ", "望遠鏡",
    "トランプ", "コイン", "ダイス", "万年筆", "ベル", "ランプ", "ギター", "ピアノ", "太鼓", "切手",
    // 食べ物・飲み物
    "リンゴ", "バナナ", "イチゴ", "ブドウ", "レモン", "スイカ", "トマト", "肉", "魚料理", "パン",
    "米", "ラーメン", "カレー", "寿司", "ピザ", "ケーキ", "チョコレート", "アイス", "水", "お茶",
    "コーヒー", "牛乳", "酒", "薬", "毒", "チーズ", "卵", "ハチミツ", "スープ", "塩",
    // 概念・抽象・その他
    "時間", "愛", "夢", "影", "光", "闇", "音", "秘密", "宝物", "お金",
    "金", "銀", "ダイヤモンド", "宝石", "平和", "戦争", "力", "心", "頭", "手",
    "足", "目", "声", "音楽", "ダンス", "数字", "言葉", "名前", "運命", "科学",
    "記憶", "未来", "過去", "自由", "魔法", "嘘", "約束", "勝負", "夜", "朝"
  ];

  const TYPE_RED = 'red';
  const TYPE_BLUE = 'blue';
  const TYPE_NEUTRAL = 'neutral';
  const TYPE_ASSASSIN = 'assassin';

  window.BoardArena.registerGame({
    id: 'codenames',
    name: 'コードネーム (Codenames)',
    icon: '🕵️‍♂️',
    category: 'ワード・推理',
    minPlayers: 2,
    maxPlayers: 8,
    description: 'スパイマスターの単語ヒントから自チームのエージェントを推理！暗殺者を踏むと即死の一発勝負！',

    mount(container, bridge) {
      // ゲーム状態
      let cards = []; // 25枚 { id, word, type, revealed }
      let startingTeam = TYPE_RED; // 先攻 (9枚)
      let currentTeam = TYPE_RED;  // 手番 (red / blue)
      let currentPhase = 'clue';   // 'clue' (ヒント入力) | 'guess' (推理回答)
      let currentClue = null;      // { word: string, count: number }
      let remainingGuesses = 0;    // 残り回答回数
      let redRemaining = 9;
      let blueRemaining = 8;
      let isGameOver = false;
      let winner = null;
      let gameOverReason = '';     // 'cleared' | 'assassin'
      let vsCpu = !bridge.isConnected(); // 未接続時はCPU対戦をデフォルト有効化

      // ローカルUI設定
      let isSpymasterView = false; // スパイマスター視点 (正解キー透視)

      // HTMLマークアップ
      container.innerHTML = `
        <div class="cn-wrapper">
          <!-- 上部コントロール＆ステータス -->
          <div class="cn-header-panel">
            <!-- チームスコア -->
            <div class="cn-team-scores">
              <div class="cn-score-card red-card ${currentTeam === TYPE_RED ? 'active-turn' : ''}">
                <span class="team-badge-icon">🔴</span>
                <span class="team-name">赤チーム</span>
                <span class="score-count" id="cn-red-remaining">9</span>
              </div>
              <div class="cn-turn-indicator" id="cn-turn-badge">
                赤チームのヒント待ち
              </div>
              <div class="cn-score-card blue-card ${currentTeam === TYPE_BLUE ? 'active-turn' : ''}">
                <span class="team-badge-icon">🔵</span>
                <span class="team-name">青チーム (CPU)</span>
                <span class="score-count" id="cn-blue-remaining">8</span>
              </div>
            </div>

            <!-- ツールバー (スパイマスター視点切替、パス、新ゲーム) -->
            <div class="cn-toolbar">
              <button id="cn-toggle-spymaster-btn" class="btn btn-sm btn-spymaster" title="スパイマスター専用：カードの正解色を透視表示します">
                <span class="eye-icon">👁️</span> スパイマスター視点: <strong id="cn-spy-status">OFF</strong>
              </button>
              <button id="cn-cpu-btn" class="btn btn-sm btn-subtle" title="CPU対戦の切替">
                🤖 CPU対戦: ON
              </button>
              <button id="cn-ai-clue-btn" class="btn btn-sm btn-secondary" title="赤チーム用のヒントをAIに自動生成してもらいます">
                💡 AIヒント提案
              </button>
              <button id="cn-pass-turn-btn" class="btn btn-sm btn-secondary" disabled>
                ⏭️ ターン終了 (パス)
              </button>
              <button id="cn-restart-btn" class="btn btn-sm btn-subtle">
                🔄 新しい単語で開始
              </button>
            </div>
          </div>

          <!-- ヒント提示・案内バナー -->
          <div class="cn-clue-banner" id="cn-clue-banner">
            <div class="clue-display-area" id="cn-clue-text">
              🕵️‍♂️ スパイマスターはヒント（単語＋数字）を出してください
            </div>

            <!-- ヒント入力フォーム (スパイマスター用) -->
            <div class="clue-input-form" id="cn-clue-form">
              <input type="text" id="cn-clue-word" class="clue-input" placeholder="ヒントの単語 (例: 海)" maxlength="12">
              <select id="cn-clue-count" class="clue-select">
                <option value="1">1 枚</option>
                <option value="2" selected>2 枚</option>
                <option value="3">3 枚</option>
                <option value="4">4 枚</option>
                <option value="5">5 枚</option>
                <option value="0">0 (無関係)</option>
                <option value="99">∞ (無制限)</option>
              </select>
              <button id="cn-send-clue-btn" class="btn btn-primary btn-sm">ヒント送信</button>
              <button id="cn-skip-clue-btn" class="btn btn-subtle btn-sm" title="通話中などの場合、フォームを使わずに即回答フェーズへ進みます">即回答へ</button>
            </div>
          </div>

          <!-- 5×5 カードグリッド -->
          <div class="cn-grid-container">
            <div id="cn-grid" class="cn-grid"></div>
          </div>

          <!-- ゲームログ / 履歴 -->
          <div class="cn-log-panel">
            <div class="log-header">📜 ゲーム履歴</div>
            <div class="log-entries" id="cn-log-entries"></div>
          </div>

          <!-- 勝敗結果モーダル / バナー -->
          <div id="cn-result-modal" class="cn-result-banner hidden">
            <div class="result-content">
              <h2 id="cn-result-title">🎉 勝利！</h2>
              <p id="cn-result-desc">すべてのエージェントを特定しました</p>
              <button id="cn-result-restart-btn" class="btn btn-primary">もう一度遊ぶ</button>
            </div>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('codenames-custom-css')) {
        const style = document.createElement('style');
        style.id = 'codenames-custom-css';
        style.textContent = `
          .cn-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            max-width: 1480px;
            margin: 0 auto;
            color: #f1f5f9;
          }

          /* ヘッダーパネル */
          .cn-header-panel {
            background: #18202c;
            border: 1px solid #2b384a;
            border-radius: 10px;
            padding: 8px 14px;
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }

          .cn-team-scores {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            flex: 1;
          }

          .cn-score-card {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 8px;
            background: #111827;
            border: 2px solid transparent;
            transition: all 0.25s ease;
          }

          .cn-score-card.red-card {
            border-color: rgba(239, 68, 68, 0.3);
          }
          .cn-score-card.red-card.active-turn {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.15);
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
          }

          .cn-score-card.blue-card {
            border-color: rgba(59, 130, 246, 0.3);
            justify-content: flex-end;
          }
          .cn-score-card.blue-card.active-turn {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.15);
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
          }

          .team-name {
            font-weight: 700;
            font-size: 14px;
          }
          .score-count {
            font-size: 20px;
            font-weight: 900;
            font-family: monospace;
          }
          .red-card .score-count { color: #f87171; }
          .blue-card .score-count { color: #60a5fa; }

          .cn-turn-indicator {
            font-size: 13px;
            font-weight: 700;
            text-align: center;
            padding: 5px 12px;
            border-radius: 20px;
            background: #232d3d;
            border: 1px solid #374151;
            white-space: nowrap;
          }

          /* ツールバー */
          .cn-toolbar {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn-spymaster {
            background: #334155;
            color: #cbd5e1;
            border: 1px solid #475569;
          }
          .btn-spymaster.active {
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            color: #fff;
            border-color: #a855f7;
            box-shadow: 0 0 10px rgba(124, 58, 237, 0.4);
          }

          /* ヒントバナー */
          .cn-clue-banner {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 8px 14px;
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
          }

          .clue-display-area {
            font-size: 15px;
            font-weight: 700;
            text-align: center;
            color: #38bdf8;
          }

          .clue-input-form {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .clue-input {
            background: #0f172a;
            border: 1px solid #475569;
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 14px;
            width: 140px;
            outline: none;
          }
          .clue-input:focus {
            border-color: #38bdf8;
          }

          .clue-select {
            background: #0f172a;
            border: 1px solid #475569;
            color: #fff;
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
          }

          /* 5×5 カードグリッド */
          .cn-grid-container {
            width: 100%;
            display: flex;
            justify-content: center;
          }

          .cn-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            width: 100%;
          }

          /* カード単体 */
          .cn-card {
            min-height: clamp(68px, 10.5vh, 118px);
            background: #e2e8f0;
            color: #0f172a;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 8px 6px;
            font-size: clamp(16px, 1.8vw, 22px);
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8);
            transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.3s ease;
            position: relative;
            text-align: center;
            user-select: none;
            overflow: hidden;
          }

          .cn-card:hover:not(.revealed) {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 8px 12px rgba(0, 0, 0, 0.4);
            background: #f8fafc;
          }

          .cn-card:active:not(.revealed) {
            transform: translateY(0) scale(0.98);
          }

          /* スパイマスター透視モード時のカード枠・インジケーター */
          .cn-card.spy-red:not(.revealed) {
            box-shadow: 0 0 0 3px #ef4444, 0 4px 6px rgba(0, 0, 0, 0.3);
            background: #fee2e2;
          }
          .cn-card.spy-blue:not(.revealed) {
            box-shadow: 0 0 0 3px #3b82f6, 0 4px 6px rgba(0, 0, 0, 0.3);
            background: #dbeafe;
          }
          .cn-card.spy-neutral:not(.revealed) {
            box-shadow: 0 0 0 3px #94a3b8, 0 4px 6px rgba(0, 0, 0, 0.3);
            background: #f1f5f9;
          }
          .cn-card.spy-assassin:not(.revealed) {
            box-shadow: 0 0 0 3px #0f172a, 0 4px 6px rgba(0, 0, 0, 0.3);
            background: #cbd5e1;
          }
          .cn-card .spy-dot {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }
          .cn-card.spy-red .spy-dot { background: #ef4444; }
          .cn-card.spy-blue .spy-dot { background: #3b82f6; }
          .cn-card.spy-neutral .spy-dot { background: #94a3b8; }
          .cn-card.spy-assassin .spy-dot { background: #000; box-shadow: 0 0 4px #000; }

          /* めくられたカード (Revealed) */
          .cn-card.revealed {
            cursor: default;
            transform: none !important;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
            animation: cardFlip 0.35s ease;
          }

          @keyframes cardFlip {
            0% { transform: scale(1) rotateY(0deg); }
            50% { transform: scale(1.08) rotateY(90deg); }
            100% { transform: scale(1) rotateY(0deg); }
          }

          /* めくられた後の色デザイン */
          .cn-card.revealed.type-red {
            background: linear-gradient(135deg, #b91c1c, #ef4444);
            color: #ffffff;
            border: 1px solid #f87171;
          }
          .cn-card.revealed.type-blue {
            background: linear-gradient(135deg, #1d4ed8, #3b82f6);
            color: #ffffff;
            border: 1px solid #60a5fa;
          }
          .cn-card.revealed.type-neutral {
            background: linear-gradient(135deg, #475569, #64748b);
            color: #cbd5e1;
            border: 1px solid #94a3b8;
          }
          .cn-card.revealed.type-assassin {
            background: linear-gradient(135deg, #090d16, #1e293b);
            color: #f87171;
            border: 2px solid #ef4444;
          }

          .card-word {
            letter-spacing: 1px;
            font-size: clamp(15px, 1.6vw, 22px);
            line-height: 1.2;
          }
          .card-subtext {
            font-size: 11px;
            opacity: 0.85;
            margin-top: 3px;
          }

          /* ログパネル */
          .cn-log-panel {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 8px;
            padding: 6px 12px;
            max-height: 76px;
            overflow-y: auto;
          }
          .log-header {
            font-size: 12px;
            font-weight: 700;
            color: #94a3b8;
            margin-bottom: 6px;
          }
          .log-entry {
            font-size: 12px;
            line-height: 1.5;
            color: #cbd5e1;
            border-bottom: 1px solid #1f2937;
            padding: 2px 0;
          }
          .log-entry:last-child {
            border-bottom: none;
          }
          .log-red { color: #f87171; font-weight: bold; }
          .log-blue { color: #60a5fa; font-weight: bold; }

          /* 勝敗モーダル */
          .cn-result-banner {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          .cn-result-banner.hidden { display: none; }
          .result-content {
            background: #1e293b;
            border: 2px solid #38bdf8;
            padding: 28px 36px;
            border-radius: 16px;
            text-align: center;
            max-width: 420px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .result-content h2 {
            font-size: 26px;
            font-weight: 800;
          }
          .result-content p {
            color: #94a3b8;
            font-size: 14px;
          }

          /* レスポンシブ対応 */
          @media (max-width: 640px) {
            .cn-grid {
              gap: 6px;
            }
            .cn-card {
              font-size: 12px;
              padding: 4px 2px;
            }
            .card-word {
              font-size: 11px;
            }
            .card-subtext {
              display: none;
            }
          }
        `;
        document.head.appendChild(style);
      }

      // 要素の取得
      const gridEl = container.querySelector('#cn-grid');
      const redRemainingEl = container.querySelector('#cn-red-remaining');
      const blueRemainingEl = container.querySelector('#cn-blue-remaining');
      const redCardEl = container.querySelector('.red-card');
      const blueCardEl = container.querySelector('.blue-card');
      const turnBadgeEl = container.querySelector('#cn-turn-badge');
      const clueTextEl = container.querySelector('#cn-clue-text');
      const clueFormEl = container.querySelector('#cn-clue-form');
      const clueWordInput = container.querySelector('#cn-clue-word');
      const clueCountSelect = container.querySelector('#cn-clue-count');
      const sendClueBtn = container.querySelector('#cn-send-clue-btn');
      const skipClueBtn = container.querySelector('#cn-skip-clue-btn');
      const toggleSpyBtn = container.querySelector('#cn-toggle-spymaster-btn');
      const spyStatusText = container.querySelector('#cn-spy-status');
      const cpuBtn = container.querySelector('#cn-cpu-btn');
      const aiClueBtn = container.querySelector('#cn-ai-clue-btn');
      const passTurnBtn = container.querySelector('#cn-pass-turn-btn');
      const restartBtn = container.querySelector('#cn-restart-btn');
      const logEntriesEl = container.querySelector('#cn-log-entries');
      const resultModal = container.querySelector('#cn-result-modal');
      const resultTitle = container.querySelector('#cn-result-title');
      const resultDesc = container.querySelector('#cn-result-desc');
      const resultRestartBtn = container.querySelector('#cn-result-restart-btn');

      // ログ追加
      function addLog(html) {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerHTML = html;
        logEntriesEl.prepend(div);
      }

      // ゲームの初期化・シャッフル生成 (ホストが実行してゲストに同期)
      function initGame(seedData = null) {
        if (seedData) {
          // ゲスト側：ホストから受信した盤面を適用
          cards = seedData.cards;
          startingTeam = seedData.startingTeam;
          currentTeam = seedData.startingTeam;
          currentPhase = 'clue';
          currentClue = null;
          remainingGuesses = 0;
          redRemaining = startingTeam === TYPE_RED ? 9 : 8;
          blueRemaining = startingTeam === TYPE_BLUE ? 9 : 8;
          isGameOver = false;
          winner = null;
          gameOverReason = '';
        } else {
          // ホスト側：新規盤面を生成
          startingTeam = Math.random() < 0.5 ? TYPE_RED : TYPE_BLUE;
          currentTeam = startingTeam;
          currentPhase = 'clue';
          currentClue = null;
          remainingGuesses = 0;
          redRemaining = startingTeam === TYPE_RED ? 9 : 8;
          blueRemaining = startingTeam === TYPE_BLUE ? 9 : 8;
          isGameOver = false;
          winner = null;
          gameOverReason = '';

          // 25語をランダム抽出
          const shuffledWords = [...WORD_POOL].sort(() => Math.random() - 0.5).slice(0, 25);

          // 属性の割り当て: 先攻9, 後攻8, 一般人7, 暗殺者1
          const types = [
            ...Array(startingTeam === TYPE_RED ? 9 : 8).fill(TYPE_RED),
            ...Array(startingTeam === TYPE_BLUE ? 9 : 8).fill(TYPE_BLUE),
            ...Array(7).fill(TYPE_NEUTRAL),
            TYPE_ASSASSIN
          ].sort(() => Math.random() - 0.5);

          cards = shuffledWords.map((word, idx) => ({
            id: idx,
            word: word,
            type: types[idx],
            revealed: false
          }));

          // 相手に盤面データを送信
          if (bridge.isConnected()) {
            bridge.send({
              game: 'codenames',
              type: 'init',
              cards: cards,
              startingTeam: startingTeam
            });
          }
        }

        logEntriesEl.innerHTML = '';
        addLog(`🎲 新しいゲームを開始しました。先攻は <strong>${startingTeam === TYPE_RED ? '<span class="log-red">赤チーム (9枚)</span>' : '<span class="log-blue">青チーム (9枚)</span>'}</strong> です。`);
        resultModal.classList.add('hidden');
        render();

        if (vsCpu && currentTeam === TYPE_BLUE && !isGameOver) {
          triggerCpuTurn();
        }
      }

      // 描画処理
      function render() {
        // 残数表示
        redRemainingEl.textContent = redRemaining;
        blueRemainingEl.textContent = blueRemaining;

        // 手番表示
        redCardEl.classList.toggle('active-turn', currentTeam === TYPE_RED && !isGameOver);
        blueCardEl.classList.toggle('active-turn', currentTeam === TYPE_BLUE && !isGameOver);

        const teamName = currentTeam === TYPE_RED ? '🔴 赤チーム' : '🔵 青チーム';

        if (isGameOver) {
          turnBadgeEl.textContent = '🏁 ゲーム終了';
        } else if (currentPhase === 'clue') {
          turnBadgeEl.textContent = `${teamName} のヒント待ち`;
        } else {
          turnBadgeEl.textContent = `${teamName} の推理中 (残り ${remainingGuesses === 99 ? '∞' : remainingGuesses} 回)`;
        }

        // ヒントバナー
        if (!isGameOver) {
          if (currentPhase === 'clue') {
            clueTextEl.innerHTML = `🕵️‍♂️ ${teamName} のスパイマスターはヒントを出してください`;
            clueFormEl.style.display = 'flex';
            passTurnBtn.disabled = true;
          } else {
            const countText = currentClue.count === 99 ? '無制限' : `${currentClue.count} 枚`;
            clueTextEl.innerHTML = `💡 ${teamName} のヒント: <span style="font-size: 18px; color: #f59e0b;">『${escapeHtml(currentClue.word)}』</span> (${countText})`;
            clueFormEl.style.display = 'none';
            passTurnBtn.disabled = false;
          }
        }

        // スパイマスター視点ボタン状態
        toggleSpyBtn.classList.toggle('active', isSpymasterView);
        spyStatusText.textContent = isSpymasterView ? 'ON' : 'OFF';

        if (cpuBtn) {
          cpuBtn.textContent = vsCpu ? '🤖 CPU対戦: ON' : '👥 2人対戦';
          cpuBtn.style.color = vsCpu ? '#38bdf8' : '#94a3b8';
        }

        // 25枚のカード描画
        gridEl.innerHTML = '';
        cards.forEach((card, idx) => {
          const cardEl = document.createElement('div');
          cardEl.className = 'cn-card';

          if (card.revealed) {
            cardEl.classList.add('revealed', `type-${card.type}`);
            let sub = '';
            if (card.type === TYPE_RED) sub = '🔴 エージェント';
            else if (card.type === TYPE_BLUE) sub = '🔵 エージェント';
            else if (card.type === TYPE_NEUTRAL) sub = '⚪ 一般人';
            else if (card.type === TYPE_ASSASSIN) sub = '💀 暗殺者';

            cardEl.innerHTML = `
              <span class="card-word">${escapeHtml(card.word)}</span>
              <span class="card-subtext">${sub}</span>
            `;
          } else {
            // 未公開カード
            if (isSpymasterView) {
              cardEl.classList.add(`spy-${card.type}`);
              cardEl.innerHTML = `
                <div class="spy-dot"></div>
                <span class="card-word">${escapeHtml(card.word)}</span>
              `;
            } else {
              cardEl.innerHTML = `
                <span class="card-word">${escapeHtml(card.word)}</span>
              `;
            }

            // カードクリックで推理（めくる）
            cardEl.addEventListener('click', () => {
              if (isGameOver) return;
              handleCardClick(idx);
            });
          }

          gridEl.appendChild(cardEl);
        });
      }

      // ヒント送信処理
      function submitClue(word, count) {
        if (!word) {
          bridge.showToast('ヒントの単語を入力してください');
          return;
        }

        currentClue = { word: word.trim(), count: parseInt(count, 10) };
        currentPhase = 'guess';
        remainingGuesses = currentClue.count === 99 ? 99 : (currentClue.count === 0 ? 99 : currentClue.count + 1);

        const teamTag = currentTeam === TYPE_RED ? '<span class="log-red">赤</span>' : '<span class="log-blue">青</span>';
        const countStr = currentClue.count === 99 ? '無制限' : `${currentClue.count}枚`;
        addLog(`🕵️‍♂️ [${teamTag}スパイマスター]: ヒント『<strong>${escapeHtml(currentClue.word)}</strong>』(${countStr})`);

        if (bridge.isConnected()) {
          bridge.send({
            game: 'codenames',
            type: 'clue',
            clue: currentClue,
            team: currentTeam
          });
        }

        clueWordInput.value = '';
        render();
      }

      // カードめくり処理
      function handleCardClick(idx, isLocal = true) {
        const card = cards[idx];
        if (card.revealed) return;

        // 公開
        card.revealed = true;
        const actingTeam = currentTeam;
        const actingTeamName = actingTeam === TYPE_RED ? '赤チーム' : '青チーム';
        const teamTag = actingTeam === TYPE_RED ? '<span class="log-red">赤</span>' : '<span class="log-blue">青</span>';

        if (isLocal && bridge.isConnected()) {
          bridge.send({
            game: 'codenames',
            type: 'reveal',
            index: idx,
            actingTeam: actingTeam
          });
        }

        // 判定
        if (card.type === TYPE_ASSASSIN) {
          // 💀 暗殺者：めくったチームの即敗北！
          isGameOver = true;
          winner = actingTeam === TYPE_RED ? TYPE_BLUE : TYPE_RED;
          gameOverReason = 'assassin';
          const winnerName = winner === TYPE_RED ? '赤チーム' : '青チーム';

          addLog(`💀 [${teamTag}]: 『<strong>${card.word}</strong>』は【暗殺者】でした！${actingTeamName}の一発敗北…！`);
          showResultModal(`💀 暗殺者に遭遇！`, `${actingTeamName}が暗殺者を引いてしまいました。<br><strong>${winnerName} の勝利です！</strong>`);
          render();
          return;
        }

        if (card.type === TYPE_RED) {
          redRemaining--;
          addLog(`👉 [${teamTag}]: 『<strong>${card.word}</strong>』を選択 → <span class="log-red">赤のエージェント！</span>`);
        } else if (card.type === TYPE_BLUE) {
          blueRemaining--;
          addLog(`👉 [${teamTag}]: 『<strong>${card.word}</strong>』を選択 → <span class="log-blue">青のエージェント！</span>`);
        } else {
          addLog(`👉 [${teamTag}]: 『<strong>${card.word}</strong>』を選択 → ⚪ 一般人でした。`);
        }

        // 勝利チェック
        if (redRemaining === 0) {
          isGameOver = true;
          winner = TYPE_RED;
          gameOverReason = 'cleared';
          addLog(`🎉 赤チームが全エージェントを特定しました！赤チームの勝利！`);
          showResultModal(`🎉 赤チームの勝利！`, `すべての赤エージェントを特定しました！`);
          render();
          return;
        }
        if (blueRemaining === 0) {
          isGameOver = true;
          winner = TYPE_BLUE;
          gameOverReason = 'cleared';
          addLog(`🎉 青チームが全エージェントを特定しました！青チームの勝利！`);
          showResultModal(`🎉 青チームの勝利！`, `すべての青エージェントを特定しました！`);
          render();
          return;
        }

        // 自チーム正解だった場合
        if (card.type === actingTeam) {
          if (remainingGuesses !== 99) {
            remainingGuesses--;
          }
          bridge.showToast('ナイス推理！正解です！');

          // 回答回数が尽きたら手番終了
          if (remainingGuesses <= 0) {
            bridge.showToast('指定回数の回答が終了しました。ターン交代します。');
            endTurn();
          } else {
            render();
          }
        } else {
          // 不正解 (相手チーム または 一般人) → 手番強制終了
          bridge.showToast(card.type === TYPE_NEUTRAL ? '一般人でした。ターン交代です。' : '相手のエージェントでした！ターン交代です。');
          endTurn();
        }
      }

      // ターン終了 (パス)
      function endTurn() {
        currentTeam = currentTeam === TYPE_RED ? TYPE_BLUE : TYPE_RED;
        currentPhase = 'clue';
        currentClue = null;
        remainingGuesses = 0;
        render();

        if (vsCpu && currentTeam === TYPE_BLUE && !isGameOver) {
          triggerCpuTurn();
        }
      }

      // CPU (青チーム) & AI スパイマスター思考ルーチン
      function triggerCpuTurn() {
        if (!vsCpu || isGameOver || currentTeam !== TYPE_BLUE) return;

        if (currentPhase === 'clue') {
          turnBadgeEl.textContent = '🤖 青チーム (CPU) がヒント考案中…';
          setTimeout(() => {
            if (isGameOver || currentTeam !== TYPE_BLUE || currentPhase !== 'clue') return;

            const unrevealedBlue = cards.filter(c => !c.revealed && c.type === TYPE_BLUE);
            if (unrevealedBlue.length === 0) return;

            const pickCount = Math.min(unrevealedBlue.length, Math.random() < 0.6 ? 2 : 1);
            const hintThemes = ["極秘コード", "通信", "捜索", "エージェント", "シグナル", "ネットワーク", "ターゲット", "暗号", "任務", "指令", "作戦"];
            const hintWord = hintThemes[Math.floor(Math.random() * hintThemes.length)];

            submitClue(hintWord, pickCount);
            triggerCpuGuess();
          }, 700);
        } else if (currentPhase === 'guess') {
          triggerCpuGuess();
        }
      }

      function triggerCpuGuess() {
        if (isGameOver || currentTeam !== TYPE_BLUE || currentPhase !== 'guess') return;

        setTimeout(() => {
          if (isGameOver || currentTeam !== TYPE_BLUE || currentPhase !== 'guess') return;

          const unrevealed = cards.filter(c => !c.revealed);
          if (unrevealed.length === 0) return;

          const unrevealedBlue = unrevealed.filter(c => c.type === TYPE_BLUE);
          const unrevealedNeutral = unrevealed.filter(c => c.type === TYPE_NEUTRAL);
          const unrevealedOthers = unrevealed.filter(c => c.type !== TYPE_BLUE && c.type !== TYPE_NEUTRAL);

          // 80% で正解の青カード、15% で中立（一般人）、5% でその他
          const rand = Math.random();
          let target = null;
          if (rand < 0.80 && unrevealedBlue.length > 0) {
            target = unrevealedBlue[Math.floor(Math.random() * unrevealedBlue.length)];
          } else if (rand < 0.95 && unrevealedNeutral.length > 0) {
            target = unrevealedNeutral[Math.floor(Math.random() * unrevealedNeutral.length)];
          } else if (unrevealedOthers.length > 0) {
            target = unrevealedOthers[Math.floor(Math.random() * unrevealedOthers.length)];
          } else {
            target = unrevealed[Math.floor(Math.random() * unrevealed.length)];
          }

          if (target) {
            handleCardClick(target.id, true);

            // 正解かつ回答回数が残っている場合、継続するかパスするか
            if (!isGameOver && currentTeam === TYPE_BLUE && currentPhase === 'guess' && remainingGuesses > 0) {
              if (Math.random() < 0.65) {
                triggerCpuGuess();
              } else {
                setTimeout(() => {
                  if (!isGameOver && currentTeam === TYPE_BLUE && currentPhase === 'guess') {
                    addLog(`⏭️ <span class="log-blue">青チーム (CPU)</span> が安全のためターンを終了しました。`);
                    endTurn();
                  }
                }, 600);
              }
            }
          }
        }, 850);
      }

      // AI スパイマスター (赤チーム用ヒント自動提案)
      function generateAiClueForRed() {
        const unrevealedRed = cards.filter(c => !c.revealed && c.type === TYPE_RED);
        if (unrevealedRed.length === 0) return;

        // 単語例をいくつか見てテーマ連想
        const themes = ["探索", "ミッション", "重要情報", "チーム", "暗号キー", "コード", "ターゲット", "エリア", "秘密"];
        const word = themes[Math.floor(Math.random() * themes.length)];
        const count = Math.min(unrevealedRed.length, Math.random() < 0.5 ? 2 : 1);

        clueWordInput.value = word;
        clueCountSelect.value = count.toString();
        bridge.showToast(`💡 AIヒント『${word} (${count}枚)』を提案しました！「ヒント送信」を押して決定してください`);
      }

      // 結果モーダル表示
      function showResultModal(title, desc) {
        resultTitle.textContent = title;
        resultDesc.innerHTML = desc;
        resultModal.classList.remove('hidden');
      }

      function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (m) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
      }

      // イベントリスナー設定
      // 1. ヒント送信
      sendClueBtn.addEventListener('click', () => {
        const word = clueWordInput.value;
        const count = clueCountSelect.value;
        submitClue(word, count);
      });
      clueWordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          sendClueBtn.click();
        }
      });

      // 2. 即回答へ（音声通話等でヒントフォームを省略したい場合）
      skipClueBtn.addEventListener('click', () => {
        submitClue('通話/口頭ヒント', 99);
      });

      // 3. スパイマスター視点トグル
      toggleSpyBtn.addEventListener('click', () => {
        isSpymasterView = !isSpymasterView;
        render();
      });

      // 3.5 CPU対戦トグル
      if (cpuBtn) {
        cpuBtn.addEventListener('click', () => {
          vsCpu = !vsCpu;
          bridge.showToast(vsCpu ? '🤖 CPU対戦（青チームAI）を有効にしました' : '👥 2人対戦モードに切り替えました');
          render();
          if (vsCpu && currentTeam === TYPE_BLUE && !isGameOver) {
            triggerCpuTurn();
          }
        });
      }

      // 3.6 AIヒント提案
      if (aiClueBtn) {
        aiClueBtn.addEventListener('click', () => {
          if (isGameOver) return;
          generateAiClueForRed();
        });
      }

      // 4. パスボタン
      passTurnBtn.addEventListener('click', () => {
        if (currentPhase !== 'guess' || isGameOver) return;
        addLog(`⏭️ ${currentTeam === TYPE_RED ? '<span class="log-red">赤チーム</span>' : '<span class="log-blue">青チーム</span>'} がターンを終了しました。`);
        endTurn();
        if (bridge.isConnected()) {
          bridge.send({ game: 'codenames', type: 'pass' });
        }
      });

      restartBtn.addEventListener('click', () => {
        if (confirm('新しい単語とキーマップで仕切り直しますか？')) {
          if (bridge.isHost) {
            initGame();
          } else {
            bridge.send({ game: 'codenames', type: 'request_restart' });
            bridge.showToast('ホストにゲームのリセットをリクエストしました');
          }
        }
      });
      resultRestartBtn.addEventListener('click', () => {
        if (bridge.isHost) {
          initGame();
        } else {
          bridge.send({ game: 'codenames', type: 'request_restart' });
          bridge.showToast('ホストにゲームのリセットをリクエストしました');
        }
      });

      // 相手が合流した時のイベント（一人待機からの本番開始）
      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！コードネーム開始！');
      });

      // P2P パケット受信処理
      bridge.onReceive((data) => {
        if (data.game !== 'codenames') return;

        if (data.type === 'init') {
          initGame(data);
          bridge.showToast('ホストから盤面が同期されました！');
        } else if (data.type === 'clue') {
          currentClue = data.clue;
          currentTeam = data.team;
          currentPhase = 'guess';
          remainingGuesses = currentClue.count === 99 ? 99 : (currentClue.count === 0 ? 99 : currentClue.count + 1);

          const teamTag = currentTeam === TYPE_RED ? '<span class="log-red">赤</span>' : '<span class="log-blue">青</span>';
          const countStr = currentClue.count === 99 ? '無制限' : `${currentClue.count}枚`;
          addLog(`🕵️‍♂️ [${teamTag}スパイマスター]: ヒント『<strong>${escapeHtml(currentClue.word)}</strong>』(${countStr})`);
          bridge.showToast(`ヒントが届きました: 『${currentClue.word}』(${countStr})`);
          render();
        } else if (data.type === 'reveal') {
          // 相手がカードをめくった
          handleCardClick(data.index, false);
        } else if (data.type === 'pass') {
          addLog(`⏭️ 相手チームがターンを終了しました。`);
          endTurn();
        } else if (data.type === 'request_restart') {
          if (bridge.isHost) {
            initGame();
            bridge.showToast('対戦相手のリクエストにより新ゲームを開始しました');
          }
        }
      });

      // 初期起動
      initGame();
    },

    unmount() {
      // クリーンアップ
    }
  });
})();
