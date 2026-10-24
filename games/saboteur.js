/**
 * ⛏️ お邪魔者 (Saboteur) - 完全2D高精細エディション (公式ルール完全準拠・全3ラウンド制)
 * Board Arena Plugin (Pure Crisp 2D SVG Tunnel Grid & Hidden-Role Deduction AI)
 *
 * 🌟 特徴:
 * 1. 【公式『お邪魔者 (Saboteur)』完全ルール実装 (3〜7人対戦・正体隠匿AI・全3ラウンド金塊争奪)】
 *    - 秘密の役割カード：「⛏️金鉱掘り(Miner)」vs「😈お邪魔者(Saboteur)」（終了時まで正体非公開！）
 *    - スタート(ハシゴ)から7マス先の3枚のゴールカード（上・中・下）のうち1枚だけが「🪙金塊」、残り2枚は「🪨石ころ(L字道)」
 *    - 通路カード44枚（十字・T字・直線・カーブ・さらに道を塞ぐ「🚧行き止まりカード」完全収録、🔄180°回転対応）
 *    - BFS(幅優先探索)によるリアルタイム開通判定！スタートから繋がっている道がゴールデンライトで発光！
 *    - アクションカード27枚完全実装：
 *      ・💥道具破壊（⛏️ツルハシ / 🔦ランプ / 🛒トロッコ を壊して掘削不能にする）
 *      ・🔧道具修理（単体修理＆2種兼用修理カード）
 *      ・🗺️地図（裏向きゴール3枚のうち1枚をこっそり覗き見る）
 *      ・💣落石（盤上の邪魔な行き止まりカード等を爆破除去する！）
 * 2. 【最大化された見やすい2D坑道ボード ＆ ワンクリック直感操作】
 *    - 手札のカードをクリックすると、配置可能な盤面マスや対象プレイヤーがハイライトされ、迷わず快適プレイ！
 */

(function () {
  const COLS = 11; // col 0..10 (Start at col=1, Goals at col=9)
  const ROWS = 7;  // row 0..6  (Start at row=3, Goals at row=1, 3, 5)
  const START_POS = { c: 1, r: 3 };
  const GOAL_POSITIONS = [
    { id: 0, label: '上段ゴール', c: 9, r: 1 },
    { id: 1, label: '中段ゴール', c: 9, r: 3 },
    { id: 2, label: '下段ゴール', c: 9, r: 5 }
  ];

  const TOOLS = {
    pickaxe: { id: 'pickaxe', name: 'ツルハシ', icon: '⛏️' },
    lamp:    { id: 'lamp',    name: 'ランプ',   icon: '🔦' },
    cart:    { id: 'cart',    name: 'トロッコ', icon: '🛒' }
  };

  const PLAYER_NAMES = [
    'あなた (P1)',
    'ドワーフ 2 (赤髭)',
    'ドワーフ 3 (鉄槌)',
    'ドワーフ 4 (銀坑)',
    'ドワーフ 5 (黒岩)',
    'ドワーフ 6 (黄金)',
    'ドワーフ 7 (翠玉)'
  ];

  // Web Audio 効果音
  const SabSfx = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    play(freq, dur, type = 'sine', gainVal = 0.1) {
      if (localStorage.getItem('ba_sfx_enabled') === 'false') return;
      try {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },
    dig() {
      this.play(320, 0.08, 'triangle', 0.14);
      setTimeout(() => this.play(480, 0.09, 'triangle', 0.12), 55);
    },
    breakTool() {
      [220, 160, 120].forEach((f, i) => setTimeout(() => this.play(f, 0.18, 'sawtooth', 0.15), i * 65));
    },
    repairTool() {
      [523.25, 659.25, 880].forEach((f, i) => setTimeout(() => this.play(f, 0.12, 'triangle', 0.13), i * 55));
    },
    rockfall() {
      [150, 110, 85].forEach((f, i) => setTimeout(() => this.play(f, 0.25, 'sawtooth', 0.18), i * 80));
    },
    goldWin() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'triangle', 0.16), i * 80));
    }
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 公式カードデッキ構築（通路44枚 ＋ アクション27枚 ＝ 71枚）
  function buildSaboteurDeck() {
    const deck = [];
    let cid = 1;

    function addPath(count, dirs, centerConnected, label) {
      for (let i = 0; i < count; i++) {
        deck.push({
          id: 'card_' + (cid++),
          kind: 'path',
          dirs: { N: !!dirs.N, E: !!dirs.E, S: !!dirs.S, W: !!dirs.W },
          center: centerConnected, // true=貫通通路, false=行き止まり(お邪魔者用トラップ)
          rotated: false,
          label
        });
      }
    }

    // 1. 貫通通路カード (35枚)
    addPath(5, { N: 1, E: 1, S: 1, W: 1 }, true, '十字路');
    addPath(5, { N: 1, E: 1, S: 1, W: 0 }, true, 'T字路(縦)');
    addPath(5, { N: 0, E: 1, S: 1, W: 1 }, true, 'T字路(横)');
    addPath(4, { N: 0, E: 1, S: 0, W: 1 }, true, '横直線');
    addPath(4, { N: 1, E: 0, S: 1, W: 0 }, true, '縦直線');
    addPath(5, { N: 0, E: 1, S: 1, W: 0 }, true, 'カーブ(右下)');
    addPath(4, { N: 0, E: 0, S: 1, W: 1 }, true, 'カーブ(左下)');
    addPath(3, { N: 1, E: 1, S: 0, W: 0 }, true, 'カーブ(右上)');

    // 2. 行き止まり通路カード (9枚 - 置くと道が塞がるお邪魔者の武器！)
    addPath(1, { N: 1, E: 1, S: 1, W: 1 }, false, '🚧十字行き止まり');
    addPath(1, { N: 1, E: 1, S: 1, W: 0 }, false, '🚧T字行き止まり');
    addPath(1, { N: 0, E: 1, S: 1, W: 1 }, false, '🚧T字行き止まり');
    addPath(2, { N: 0, E: 1, S: 0, W: 1 }, false, '🚧横行き止まり');
    addPath(1, { N: 1, E: 0, S: 1, W: 0 }, false, '🚧縦行き止まり');
    addPath(1, { N: 0, E: 0, S: 0, W: 1 }, false, '🚧袋小路(左)');
    addPath(1, { N: 0, E: 1, S: 0, W: 0 }, false, '🚧袋小路(右)');
    addPath(1, { N: 1, E: 0, S: 0, W: 0 }, false, '🚧袋小路(上)');

    // 3. アクションカード (27枚)
    function addAction(count, actionType, tools, label, desc) {
      for (let i = 0; i < count; i++) {
        deck.push({
          id: 'card_' + (cid++),
          kind: 'action',
          actionType, // 'break' | 'repair' | 'map' | 'rockfall'
          tools,      // ['pickaxe'] etc.
          label,
          desc
        });
      }
    }

    addAction(3, 'break', ['pickaxe'], '💥ツルハシ破壊', '誰か1人の⛏️ツルハシを壊して掘削不能にする');
    addAction(3, 'break', ['lamp'],    '💥ランプ破壊',   '誰か1人の🔦ランプを壊して掘削不能にする');
    addAction(3, 'break', ['cart'],    '💥トロッコ破壊', '誰か1人の🛒トロッコを壊して掘削不能にする');

    addAction(2, 'repair', ['pickaxe'],         '🔧ツルハシ修理',     '壊れた⛏️ツルハシを修理する');
    addAction(2, 'repair', ['lamp'],            '🔧ランプ修理',       '壊れた🔦ランプを修理する');
    addAction(2, 'repair', ['cart'],            '🔧トロッコ修理',     '壊れた🛒トロッコを修理する');
    addAction(1, 'repair', ['pickaxe', 'lamp'], '🔧ツルハシ/ランプ修理', '壊れた⛏️または🔦のどちらか1つを修理');
    addAction(1, 'repair', ['pickaxe', 'cart'], '🔧ツルハシ/トロッコ修理', '壊れた⛏️または🛒のどちらか1つを修理');
    addAction(1, 'repair', ['lamp', 'cart'],    '🔧ランプ/トロッコ修理', '壊れた🔦または🛒のどちらか1つを修理');

    addAction(6, 'map',      [], '🗺️秘密の地図', '裏向きのゴールカード3枚のうち1枚をこっそり覗き見る');
    addAction(3, 'rockfall', [], '💣落石(爆破)', '盤上に置かれた通路カード1枚を爆破して取り除く');

    return shuffle(deck);
  }

  // カードの回転を考慮した実効4方向を取得
  function getEffectiveDirs(card) {
    if (!card || !card.dirs) return { N: false, E: false, S: false, W: false };
    if (!card.rotated) {
      return { N: !!card.dirs.N, E: !!card.dirs.E, S: !!card.dirs.S, W: !!card.dirs.W };
    }
    return {
      N: !!card.dirs.S,
      E: !!card.dirs.W,
      S: !!card.dirs.N,
      W: !!card.dirs.E
    };
  }

  // 2DカスタムSVGで通路タイル（またはスタート・ゴール）を美しく描画
  function renderTileSvg(tile, isPowered = false) {
    if (!tile) return '';
    const dirs = getEffectiveDirs(tile);
    const roadColor = isPowered ? '#fbbf24' : '#a8a29e';
    const railColor = isPowered ? '#78350f' : '#44403c';
    const bgRock = tile.isGoal && !tile.revealed
      ? '#1e1b4b'
      : (tile.isStart ? '#064e3b' : (tile.isGoal && tile.hasGold ? '#78350f' : '#292524'));

    // 裏向きゴールカード
    if (tile.isGoal && !tile.revealed) {
      return `
        <svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block;border-radius:6px;background:${bgRock};">
          <rect x="6" y="6" width="88" height="88" rx="8" fill="none" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6,4"/>
          <text x="50" y="46" text-anchor="middle" fill="#fef08a" font-size="28" font-weight="900">❓</text>
          <text x="50" y="76" text-anchor="middle" fill="#fde047" font-size="14" font-weight="900">GOAL</text>
        </svg>
      `;
    }

    const segments = [];
    if (tile.center) {
      if (dirs.N) segments.push(`<rect x="34" y="0" width="32" height="54" fill="${roadColor}"/><line x1="42" y1="0" x2="42" y2="50" stroke="${railColor}" stroke-width="3"/><line x1="58" y1="0" x2="58" y2="50" stroke="${railColor}" stroke-width="3"/>`);
      if (dirs.S) segments.push(`<rect x="34" y="46" width="32" height="54" fill="${roadColor}"/><line x1="42" y1="50" x2="42" y2="100" stroke="${railColor}" stroke-width="3"/><line x1="58" y1="50" x2="58" y2="100" stroke="${railColor}" stroke-width="3"/>`);
      if (dirs.W) segments.push(`<rect x="0" y="34" width="54" height="32" fill="${roadColor}"/><line x1="0" y1="42" x2="50" y2="42" stroke="${railColor}" stroke-width="3"/><line x1="0" y1="58" x2="50" y2="58" stroke="${railColor}" stroke-width="3"/>`);
      if (dirs.E) segments.push(`<rect x="46" y="34" width="54" height="32" fill="${roadColor}"/><line x1="50" y1="42" x2="100" y2="42" stroke="${railColor}" stroke-width="3"/><line x1="50" y1="58" x2="100" y2="58" stroke="${railColor}" stroke-width="3"/>`);
      segments.push(`<circle cx="50" cy="50" r="18" fill="${roadColor}"/>`);
    } else {
      // 行き止まり（中央に赤い岩壁バリケードがあり、各端から短い袋小路のみ伸びる）
      if (dirs.N) segments.push(`<rect x="34" y="0" width="32" height="26" rx="6" fill="#94a3b8"/>`);
      if (dirs.S) segments.push(`<rect x="34" y="74" width="32" height="26" rx="6" fill="#94a3b8"/>`);
      if (dirs.W) segments.push(`<rect x="0" y="34" width="26" height="32" rx="6" fill="#94a3b8"/>`);
      if (dirs.E) segments.push(`<rect x="74" y="34" width="26" height="32" rx="6" fill="#94a3b8"/>`);
      segments.push(`<circle cx="50" cy="50" r="16" fill="#7f1d1d" stroke="#f87171" stroke-width="3"/>`);
      segments.push(`<text x="50" y="56" text-anchor="middle" fill="#fecaca" font-size="16" font-weight="900">🚧</text>`);
    }

    let badge = '';
    if (tile.isStart) {
      badge = `<circle cx="50" cy="50" r="20" fill="#059669" stroke="#fef08a" stroke-width="3"/><text x="50" y="57" text-anchor="middle" font-size="20">🪜</text>`;
    } else if (tile.isGoal && tile.revealed) {
      badge = tile.hasGold
        ? `<circle cx="50" cy="50" r="22" fill="#eab308" stroke="#fef08a" stroke-width="3"/><text x="50" y="58" text-anchor="middle" font-size="22">🪙</text>`
        : `<circle cx="50" cy="50" r="16" fill="#57534e"/><text x="50" y="56" text-anchor="middle" font-size="16">🪨</text>`;
    }

    return `
      <svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block;border-radius:6px;background:${bgRock};">
        ${segments.join('')}
        ${badge}
      </svg>
    `;
  }

  window.BoardArena.registerGame({
    id: 'saboteur',
    name: 'お邪魔者 (Saboteur 2D)',
    icon: '⛏️',
    category: '🕵️ 正体隠匿トンネル開拓 (2D完全版)',
    minPlayers: 3,
    maxPlayers: 7,
    description: '金鉱掘りと裏切り者の「お邪魔者」に分かれて坑道を掘り進める正体隠匿ボードゲームの決定版！通路接続・道具破壊＆修理・秘密の地図・落石まで完全2D実装！',

    mount(container, bridge) {
      let isDestroyed = false;
      let cpuTimer = null;

      let playerCount = 5;
      let mySeat = 0;

      // ゲーム状態
      let roundNum = 1;
      let grid = []; // grid[r][c] = null | tileObject
      let connectedCells = new Set(); // スタートから道が貫通している 'r_c' のセット
      let deck = [];
      let players = [];
      let turnIndex = 0;
      let selectedHandIdx = null;
      let roundOver = false;
      let matchOver = false;
      let bannerText = '⛏️ お邪魔者へようこそ！手札のカードをクリックして坑道をゴールへ繋げましょう！';

      container.innerHTML = `
        <style>
          .sab-wrapper {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            user-select: none;
            color: #f8fafc;
            font-family: 'Noto Sans JP', sans-serif;
          }
          .sab-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(245, 158, 11, 0.4);
            border-radius: 12px;
            padding: 6px 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          }
          .sab-players-strip {
            display: flex;
            gap: 7px;
            flex-wrap: wrap;
            flex: 1;
          }
          .sab-pcard {
            display: flex;
            align-items: center;
            gap: 7px;
            background: rgba(30, 41, 59, 0.92);
            border: 2px solid rgba(148, 163, 184, 0.28);
            border-radius: 10px;
            padding: 5px 10px;
            font-size: 12px;
            transition: all 0.15s;
          }
          .sab-pcard.active-turn {
            border-color: #fbbf24;
            background: rgba(251, 191, 36, 0.16);
            box-shadow: 0 0 14px rgba(251, 191, 36, 0.35);
          }
          .sab-pcard.targetable {
            border-color: #10b981;
            cursor: pointer;
            animation: sabPulse 1.1s infinite alternate;
          }
          @keyframes sabPulse {
            from { box-shadow: 0 0 6px rgba(16, 185, 129, 0.4); }
            to   { box-shadow: 0 0 18px rgba(16, 185, 129, 0.9); }
          }
          .sab-tool-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            font-size: 13px;
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid #34d399;
          }
          .sab-tool-badge.broken {
            background: rgba(225, 29, 72, 0.35);
            border-color: #fb7185;
            position: relative;
          }
          .sab-tool-badge.broken::after {
            content: '✖';
            position: absolute;
            color: #fecdd3;
            font-size: 14px;
            font-weight: 900;
          }
          .sab-btn {
            background: rgba(30, 41, 59, 0.94);
            border: 1px solid rgba(148, 163, 184, 0.42);
            color: #f8fafc;
            font-size: 12px;
            font-weight: 800;
            padding: 6px 11px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .sab-btn:hover:not(:disabled) {
            border-color: #fbbf24;
            color: #fef08a;
            transform: translateY(-1px);
          }
          .sab-btn:disabled {
            opacity: 0.38;
            cursor: not-allowed;
          }
          .sab-btn-gold {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-color: #fef08a;
            color: #0f172a;
          }
          .sab-btn-danger {
            background: linear-gradient(135deg, #e11d48, #9f1239);
            border-color: #fda4af;
            color: #ffffff;
          }
          /* メイン2D坑道ステージ */
          .sab-board-stage {
            position: relative;
            width: 100%;
            min-height: 450px;
            background: radial-gradient(circle at 50% 50%, #292524 0%, #1c1917 65%, #0c0a09 100%);
            border: 2px solid rgba(217, 119, 6, 0.45);
            border-radius: 16px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.85), 0 16px 40px rgba(0, 0, 0, 0.65);
          }
          .sab-banner-row {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            padding: 0 6px;
          }
          .sab-role-pill {
            padding: 5px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 900;
            border: 2px solid #fef08a;
          }
          .sab-grid {
            display: grid;
            grid-template-columns: repeat(${COLS}, minmax(54px, 74px));
            grid-template-rows: repeat(${ROWS}, minmax(54px, 74px));
            gap: 5px;
            justify-content: center;
            align-items: center;
          }
          .sab-cell {
            width: 100%;
            height: 100%;
            aspect-ratio: 1 / 1;
            background: rgba(255, 255, 255, 0.03);
            border: 1px dashed rgba(168, 162, 158, 0.22);
            border-radius: 8px;
            position: relative;
            overflow: hidden;
            transition: all 0.15s;
          }
          .sab-cell.valid-drop {
            border: 2px solid #10b981;
            background: rgba(16, 185, 129, 0.18);
            cursor: pointer;
            box-shadow: 0 0 14px rgba(16, 185, 129, 0.45);
          }
          .sab-cell.valid-drop:hover {
            transform: scale(1.06);
            background: rgba(16, 185, 129, 0.32);
          }
          .sab-cell.valid-rockfall {
            border: 2px solid #ef4444;
            cursor: pointer;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.65);
          }
          .sab-cell.valid-map {
            border: 2px solid #38bdf8;
            cursor: pointer;
            box-shadow: 0 0 16px rgba(56, 189, 248, 0.75);
          }
          /* 下部手札＆操作ドック */
          .sab-bottom-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            background: rgba(15, 23, 42, 0.96);
            border: 1px solid rgba(245, 158, 11, 0.38);
            border-radius: 12px;
            padding: 10px 14px;
          }
          .sab-hand-cards {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
          }
          .sab-hcard {
            width: 84px;
            background: #1e293b;
            border: 2px solid rgba(148, 163, 184, 0.4);
            border-radius: 10px;
            padding: 5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .sab-hcard:hover {
            transform: translateY(-4px);
            border-color: #fbbf24;
          }
          .sab-hcard.selected {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.18);
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.55);
            transform: translateY(-5px);
          }
          .sab-hcard-preview {
            width: 58px;
            height: 58px;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0f172a;
          }
          .sab-hcard-title {
            font-size: 10px;
            font-weight: 900;
            text-align: center;
            color: #f1f5f9;
            line-height: 1.2;
          }
          .sab-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(9, 13, 22, 0.8);
            backdrop-filter: blur(5px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 30;
          }
          .sab-modal-overlay.visible {
            display: flex;
          }
          .sab-modal-box {
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border: 2px solid #f59e0b;
            border-radius: 16px;
            padding: 22px 26px;
            max-width: 520px;
            width: 92%;
            box-shadow: 0 24px 60px rgba(0,0,0,0.9);
            text-align: center;
          }
        </style>

        <div class="sab-wrapper">
          <div class="sab-top-bar">
            <div class="sab-players-strip" id="sab-players-strip"></div>
            <div style="display:flex;gap:6px;align-items:center;">
              <select id="sab-pcount-sel" class="sab-btn">
                <option value="3">👥 3人 (金鉱3/邪魔1)</option>
                <option value="4">👥 4人 (金鉱4/邪魔1)</option>
                <option value="5" selected>👥 5人 (金鉱4/邪魔2)</option>
                <option value="6">👥 6人 (金鉱5/邪魔2)</option>
                <option value="7">👥 7人 (金鉱5/邪魔3)</option>
              </select>
              <button class="sab-btn" id="sab-new-btn">🔄 新規ゲーム</button>
            </div>
          </div>

          <div class="sab-board-stage">
            <div class="sab-banner-row">
              <div id="sab-role-display"></div>
              <div style="font-size:13px;font-weight:900;color:#fef08a;" id="sab-banner-txt"></div>
              <div style="font-size:12px;font-weight:900;color:#94a3b8;" id="sab-deck-txt"></div>
            </div>

            <div class="sab-grid" id="sab-grid"></div>

            <div class="sab-modal-overlay" id="sab-modal-overlay">
              <div class="sab-modal-box" id="sab-modal-box"></div>
            </div>
          </div>

          <div class="sab-bottom-dock">
            <div class="sab-hand-cards" id="sab-hand-cards"></div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;" id="sab-dock-controls"></div>
          </div>
        </div>
      `;

      const playersStripEl = container.querySelector('#sab-players-strip');
      const pcountSelEl = container.querySelector('#sab-pcount-sel');
      const newBtnEl = container.querySelector('#sab-new-btn');
      const roleDisplayEl = container.querySelector('#sab-role-display');
      const bannerTxtEl = container.querySelector('#sab-banner-txt');
      const deckTxtEl = container.querySelector('#sab-deck-txt');
      const gridEl = container.querySelector('#sab-grid');
      const modalOverlayEl = container.querySelector('#sab-modal-overlay');
      const modalBoxEl = container.querySelector('#sab-modal-box');
      const handCardsEl = container.querySelector('#sab-hand-cards');
      const dockControlsEl = container.querySelector('#sab-dock-controls');

      // ====================================================
      // 1. 役割配布・盤面初期化・BFS開通チェック
      // ====================================================
      function buildRolesPool(cnt) {
        const table = {
          3: { miners: 3, saboteurs: 1 },
          4: { miners: 4, saboteurs: 1 },
          5: { miners: 4, saboteurs: 2 },
          6: { miners: 5, saboteurs: 2 },
          7: { miners: 5, saboteurs: 3 }
        }[cnt] || { miners: 4, saboteurs: 2 };

        return shuffle([
          ...Array(table.miners).fill('miner'),
          ...Array(table.saboteurs).fill('saboteur')
        ]);
      }

      function initMatch() {
        if (cpuTimer) clearTimeout(cpuTimer);
        playerCount = parseInt(pcountSelEl.value, 10) || 5;
        roundNum = 1;
        matchOver = false;

        players = [];
        for (let i = 0; i < playerCount; i++) {
          players.push({
            idx: i,
            name: PLAYER_NAMES[i],
            isCpu: i !== mySeat,
            role: 'miner',
            gold: 0,
            hand: [],
            broken: { pickaxe: false, lamp: false, cart: false },
            knownGoldGoalId: null // 地図で判明した本物の金塊ゴールID (0,1,2)
          });
        }

        startRound(1);
      }

      function startRound(rNum) {
        roundNum = rNum;
        roundOver = false;
        selectedHandIdx = null;
        modalOverlayEl.classList.remove('visible');

        const roles = buildRolesPool(playerCount);
        const handSize = playerCount <= 5 ? 6 : 5;
        deck = buildSaboteurDeck();

        players.forEach((p, idx) => {
          p.role = roles[idx];
          p.broken = { pickaxe: false, lamp: false, cart: false };
          p.knownGoldGoalId = null;
          p.hand = deck.splice(0, handSize);
        });

        // 盤面グリッド初期化
        grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

        // スタートカード配置
        grid[START_POS.r][START_POS.c] = {
          isStart: true,
          dirs: { N: true, E: true, S: true, W: true },
          center: true,
          rotated: false
        };

        // 3枚のゴールカード（1枚が金塊、2枚が石ころL字道）をシャッフル配置
        const goalOutcomes = shuffle([
          { hasGold: true,  dirs: { N: true, E: true, S: true, W: true } },
          { hasGold: false, dirs: { N: true, E: false, S: false, W: true } },
          { hasGold: false, dirs: { N: false, E: false, S: true, W: true } }
        ]);

        GOAL_POSITIONS.forEach((gp, idx) => {
          grid[gp.r][gp.c] = {
            isGoal: true,
            goalId: gp.id,
            revealed: false,
            hasGold: goalOutcomes[idx].hasGold,
            dirs: goalOutcomes[idx].dirs,
            center: true,
            rotated: false
          };
        });

        turnIndex = 0;
        recomputeConnectivityAndCheckGoals(null);
        bannerText = `⛏️ 第${roundNum}/3ラウンド開始！手札のカードをクリックして盤面に配置するか、道具カードを使いましょう！`;
        renderAll();
      }

      function isPlayerToolBroken(p) {
        return p.broken.pickaxe || p.broken.lamp || p.broken.cart;
      }

      // BFSでスタート地点から道が貫通しているマスを計算し、ゴールカードに到達したらオープン！
      function recomputeConnectivityAndCheckGoals(activePlayer) {
        connectedCells = new Set();
        const queue = [{ r: START_POS.r, c: START_POS.c }];
        connectedCells.add(`${START_POS.r}_${START_POS.c}`);

        const dirOffsets = [
          { key: 'N', opp: 'S', dr: -1, dc: 0 },
          { key: 'S', opp: 'N', dr: 1,  dc: 0 },
          { key: 'W', opp: 'E', dr: 0,  dc: -1 },
          { key: 'E', opp: 'W', dr: 0,  dc: 1 }
        ];

        while (queue.length > 0) {
          const curr = queue.shift();
          const tile = grid[curr.r][curr.c];
          if (!tile || !tile.center) continue; // 行き止まりカードからは先へ進めない！

          const dirs = getEffectiveDirs(tile);

          for (const d of dirOffsets) {
            if (!dirs[d.key]) continue;
            const nr = curr.r + d.dr;
            const nc = curr.c + d.dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;

            const neighbor = grid[nr][nc];
            if (!neighbor) continue;

            // もし未公開のゴールカードに隣接到達したら即座にオープン！
            if (neighbor.isGoal && !neighbor.revealed) {
              neighbor.revealed = true;
              // 石ころゴールの場合、侵入方向の道が繋がるように向きを自動調整
              const nDirs = getEffectiveDirs(neighbor);
              if (!nDirs[d.opp]) {
                neighbor.rotated = !neighbor.rotated;
              }
              if (neighbor.hasGold) {
                connectedCells.add(`${nr}_${nc}`);
                finishRound('miners', activePlayer || players[turnIndex]);
                return true;
              } else {
                SabSfx.dig();
                bannerText = `🪨 ゴールカードが開かれましたが「石ころ（ハズレ）」でした！他のゴールを目指しましょう！`;
              }
            }

            const nDirsAfter = getEffectiveDirs(neighbor);
            if (nDirsAfter[d.opp]) {
              const key = `${nr}_${nc}`;
              if (!connectedCells.has(key)) {
                connectedCells.add(key);
                queue.push({ r: nr, c: nc });
              }
            }
          }
        }
        return false;
      }

      // 指定マス (r, c) に通路カード card を配置可能か判定
      function canPlacePathCardAt(card, r, c) {
        if (!card || card.kind !== 'path') return false;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
        if (grid[r][c] !== null) return false;

        const dirs = getEffectiveDirs(card);
        const neighbors = [
          { key: 'N', opp: 'S', nr: r - 1, nc: c },
          { key: 'S', opp: 'N', nr: r + 1, nc: c },
          { key: 'W', opp: 'E', nr: r,     nc: c - 1 },
          { key: 'E', opp: 'W', nr: r,     nc: c + 1 }
        ];

        let connectsToPoweredPath = false;

        for (const nb of neighbors) {
          if (nb.nr < 0 || nb.nr >= ROWS || nb.nc < 0 || nb.nc >= COLS) continue;
          const adj = grid[nb.nr][nb.nc];
          if (!adj) continue;

          // 未公開のゴールカードは隣接整合性チェックから除外（どの方向からでも突き当たればめくれる公式ルール）
          if (adj.isGoal && !adj.revealed) continue;

          const adjDirs = getEffectiveDirs(adj);
          const myEdgeHasRoad = dirs[nb.key];
          const adjEdgeHasRoad = adjDirs[nb.opp];

          // 隣接する既存タイルと道の有無が一致しなければ配置不可
          if (myEdgeHasRoad !== adjEdgeHasRoad) {
            return false;
          }

          // スタートから開通している貫通タイルと道で繋がっているか
          if (myEdgeHasRoad && adjEdgeHasRoad && adj.center && connectedCells.has(`${nb.nr}_${nb.nc}`)) {
            connectsToPoweredPath = true;
          }
        }

        return connectsToPoweredPath;
      }

      // ====================================================
      // 2. カード使用・配置・ターン終了・ラウンド終了処理
      // ====================================================
      function consumeHandCardAndDraw(p, handIdx) {
        p.hand.splice(handIdx, 1);
        if (deck.length > 0) {
          p.hand.push(deck.pop());
        }
        selectedHandIdx = null;
      }

      function advanceTurn() {
        if (roundOver || matchOver) return;

        // 全員の手札と山札がすべて尽きたら「お邪魔者チームの勝利」でラウンド終了！
        if (deck.length === 0 && players.every((pl) => pl.hand.length === 0)) {
          finishRound('saboteurs', null);
          return;
        }

        // 手札が残っている次のプレイヤーへ
        let safety = 0;
        do {
          turnIndex = (turnIndex + 1) % playerCount;
          safety++;
        } while (players[turnIndex].hand.length === 0 && safety <= playerCount);

        renderAll();

        if (players[turnIndex].isCpu && !roundOver) {
          cpuTimer = setTimeout(runCpuTurn, 650);
        }
      }

      function handleCellClick(r, c) {
        const p = players[turnIndex];
        if (!p || p.isCpu || roundOver || selectedHandIdx === null) return;
        const card = p.hand[selectedHandIdx];
        if (!card) return;

        // 1. 通路カードの配置
        if (card.kind === 'path') {
          if (isPlayerToolBroken(p)) return;
          if (!canPlacePathCardAt(card, r, c)) return;

          grid[r][c] = { ...card };
          SabSfx.dig();
          consumeHandCardAndDraw(p, selectedHandIdx);
          bannerText = `⛏️ ${p.name} が (${c},${r}) に【${card.label}】を配置しました。`;
          if (!recomputeConnectivityAndCheckGoals(p)) {
            advanceTurn();
          }
          return;
        }

        // 2. 落石カードで通路爆破
        if (card.kind === 'action' && card.actionType === 'rockfall') {
          const targetTile = grid[r][c];
          if (!targetTile || targetTile.isStart || targetTile.isGoal) return;
          grid[r][c] = null;
          SabSfx.rockfall();
          consumeHandCardAndDraw(p, selectedHandIdx);
          bannerText = `💣 ${p.name} が【落石】で (${c},${r}) の通路を爆破除去しました！`;
          recomputeConnectivityAndCheckGoals(p);
          advanceTurn();
          return;
        }

        // 3. 秘密の地図カードでゴール確認
        if (card.kind === 'action' && card.actionType === 'map') {
          const targetTile = grid[r][c];
          if (!targetTile || !targetTile.isGoal) return;
          SabSfx.repairTool();
          if (targetTile.hasGold) {
            p.knownGoldGoalId = targetTile.goalId;
          }
          consumeHandCardAndDraw(p, selectedHandIdx);
          openMapPeekModal(targetTile, () => {
            advanceTurn();
          });
        }
      }

      function canApplyActionToPlayer(card, targetPlayer) {
        if (!card || card.kind !== 'action') return false;
        if (card.actionType === 'break') {
          const t = card.tools[0];
          return !targetPlayer.broken[t];
        }
        if (card.actionType === 'repair') {
          return card.tools.some((t) => targetPlayer.broken[t]);
        }
        return false;
      }

      function handlePlayerTargetClick(targetIdx) {
        const p = players[turnIndex];
        if (!p || p.isCpu || roundOver || selectedHandIdx === null) return;
        const card = p.hand[selectedHandIdx];
        const targetP = players[targetIdx];
        if (!canApplyActionToPlayer(card, targetP)) return;

        if (card.actionType === 'break') {
          const t = card.tools[0];
          targetP.broken[t] = true;
          SabSfx.breakTool();
          bannerText = `💥 ${p.name} が ${targetP.name} の【${TOOLS[t].icon}${TOOLS[t].name}】を破壊しました！`;
        } else if (card.actionType === 'repair') {
          const brokenTool = card.tools.find((t) => targetP.broken[t]);
          if (brokenTool) {
            targetP.broken[brokenTool] = false;
            SabSfx.repairTool();
            bannerText = `🔧 ${p.name} が ${targetP.name} の【${TOOLS[brokenTool].icon}${TOOLS[brokenTool].name}】を修理しました！`;
          }
        }

        consumeHandCardAndDraw(p, selectedHandIdx);
        advanceTurn();
      }

      function openMapPeekModal(goalTile, onConfirm) {
        const gp = GOAL_POSITIONS.find((g) => g.id === goalTile.goalId);
        modalBoxEl.innerHTML = `
          <div style="font-size:20px;font-weight:900;color:#38bdf8;margin-bottom:8px;">🗺️ 秘密の地図（あなただけに公開）</div>
          <div style="font-size:15px;color:#f8fafc;margin-bottom:14px;">
            調査した <b>【${gp ? gp.label : 'ゴール'}】</b> の中身は…
          </div>
          <div style="font-size:26px;font-weight:900;padding:14px;border-radius:12px;background:rgba(0,0,0,0.4);color:${goalTile.hasGold ? '#fef08a' : '#cbd5e1'};margin-bottom:16px;">
            ${goalTile.hasGold ? '🪙 本物の金塊（当たり）です！！' : '🪨 石ころ（ハズレ）でした…'}
          </div>
          <button class="sab-btn sab-btn-gold" id="sab-map-ok">🤫 秘密にして閉じる</button>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#sab-map-ok').onclick = () => {
          modalOverlayEl.classList.remove('visible');
          onConfirm();
        };
      }

      function finishRound(winningTeam, connectorPlayer) {
        roundOver = true;
        SabSfx.goldWin();

        const goldLogs = [];
        if (winningTeam === 'miners') {
          // 金鉱掘り全員に金塊分配（繋げた人には3金塊、他金鉱掘りには2金塊）
          players.forEach((p) => {
            if (p.role === 'miner') {
              const bonus = (connectorPlayer && connectorPlayer.idx === p.idx) ? 3 : 2;
              p.gold += bonus;
              goldLogs.push(`⛏️ <b>${p.name}</b> (金鉱掘り)：🪙 <b>+${bonus} 金塊</b> 獲得！`);
            } else {
              goldLogs.push(`😈 <b>${p.name}</b> (お邪魔者)：0 金塊`);
            }
          });
        } else {
          // お邪魔者チームの勝利（人数に応じて3〜4金塊獲得）
          const sabCount = players.filter((p) => p.role === 'saboteur').length;
          const sabReward = sabCount === 1 ? 4 : 3;
          players.forEach((p) => {
            if (p.role === 'saboteur') {
              p.gold += sabReward;
              goldLogs.push(`😈 <b>${p.name}</b> (お邪魔者)：妨害成功！🪙 <b>+${sabReward} 金塊</b> 獲得！`);
            } else {
              goldLogs.push(`⛏️ <b>${p.name}</b> (金鉱掘り)：0 金塊`);
            }
          });
        }

        renderAll();

        const isFinal = roundNum >= 3;
        if (isFinal) {
          matchOver = true;
          const ranked = players.slice().sort((a, b) => b.gold - a.gold);
          const winner = ranked[0];
          const rankHtml = ranked.map((p, i) => `
            <div style="display:flex;justify-content:space-between;padding:7px 12px;margin-bottom:5px;background:rgba(255,255,255,0.07);border-radius:8px;">
              <span><b>${i + 1}位: ${p.name}</b></span>
              <span>🪙 <b>合計 ${p.gold} 金塊</b></span>
            </div>
          `).join('');

          modalBoxEl.innerHTML = `
            <div style="font-size:22px;font-weight:900;color:#fef08a;margin-bottom:8px;">🏆 全3ラウンド終了！総合優勝: ${winner.name}</div>
            <div style="text-align:left;font-size:12px;color:#cbd5e1;margin-bottom:12px;">${goldLogs.join('<br>')}</div>
            <div style="text-align:left;margin-bottom:16px;">${rankHtml}</div>
            <button class="sab-btn sab-btn-gold" id="sab-rematch-btn">🔄 新規ゲームを始める</button>
          `;
          modalOverlayEl.classList.add('visible');
          modalBoxEl.querySelector('#sab-rematch-btn').onclick = () => initMatch();
        } else {
          modalBoxEl.innerHTML = `
            <div style="font-size:20px;font-weight:900;color:#fef08a;margin-bottom:8px;">
              ${winningTeam === 'miners' ? '🎉 金塊到達！【⛏️金鉱掘りチーム】の勝利！' : '😈 時間切れ！【お邪魔者チーム】の勝利！'}
            </div>
            <div style="text-align:left;font-size:13px;line-height:1.7;color:#f1f5f9;background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:10px;margin-bottom:16px;">
              ${goldLogs.join('<br>')}
            </div>
            <button class="sab-btn sab-btn-gold" id="sab-next-round-btn" style="font-size:14px;padding:8px 20px;">
              ⛏️ 第 ${roundNum + 1} ラウンド（役割再シャッフル）へ進む！
            </button>
          `;
          modalOverlayEl.classList.add('visible');
          modalBoxEl.querySelector('#sab-next-round-btn').onclick = () => startRound(roundNum + 1);
        }
      }

      // ====================================================
      // 3. 正体隠匿AI思考エンジン（金鉱掘りAI vs お邪魔者AI）
      // ====================================================
      function runCpuTurn() {
        if (isDestroyed || roundOver || matchOver) return;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu || cpu.hand.length === 0) {
          advanceTurn();
          return;
        }

        // 1. まず自分が壊れている場合、手札に自分を修理できるカードがあれば最優先で自己修理
        if (isPlayerToolBroken(cpu)) {
          const repIdx = cpu.hand.findIndex((c) => c.kind === 'action' && c.actionType === 'repair' && canApplyActionToPlayer(c, cpu));
          if (repIdx >= 0) {
            const card = cpu.hand[repIdx];
            const brokenTool = card.tools.find((t) => cpu.broken[t]);
            cpu.broken[brokenTool] = false;
            SabSfx.repairTool();
            bannerText = `🔧 ${cpu.name} が自分の【${TOOLS[brokenTool].icon}${TOOLS[brokenTool].name}】を修理しました。`;
            consumeHandCardAndDraw(cpu, repIdx);
            advanceTurn();
            return;
          }
        }

        // 2. 地図カードがあれば未確認のゴールを調査
        const mapIdx = cpu.hand.findIndex((c) => c.kind === 'action' && c.actionType === 'map');
        if (mapIdx >= 0 && cpu.knownGoldGoalId === null) {
          const unrevealedGoals = GOAL_POSITIONS.filter((gp) => !grid[gp.r][gp.c].revealed);
          if (unrevealedGoals.length > 0) {
            const pickGp = unrevealedGoals[Math.floor(Math.random() * unrevealedGoals.length)];
            if (grid[pickGp.r][pickGp.c].hasGold) {
              cpu.knownGoldGoalId = pickGp.id;
            }
            SabSfx.repairTool();
            bannerText = `🗺️ ${cpu.name} が【秘密の地図】を使って${pickGp.label}を調査しました！`;
            consumeHandCardAndDraw(cpu, mapIdx);
            advanceTurn();
            return;
          }
        }

        // 3. 役割別のメイン行動
        if (cpu.role === 'miner') {
          // 【金鉱掘りAI】：もし盤上に行き止まりカードがあり、手札に落石があれば爆破除去！
          const rfIdx = cpu.hand.findIndex((c) => c.kind === 'action' && c.actionType === 'rockfall');
          if (rfIdx >= 0) {
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                if (grid[r][c] && !grid[r][c].isStart && !grid[r][c].isGoal && !grid[r][c].center) {
                  grid[r][c] = null;
                  SabSfx.rockfall();
                  bannerText = `💣 ${cpu.name} が【落石】で (${c},${r}) の行き止まりを爆破撤去しました！`;
                  consumeHandCardAndDraw(cpu, rfIdx);
                  recomputeConnectivityAndCheckGoals(cpu);
                  advanceTurn();
                  return;
                }
              }
            }
          }

          // 自分の道具が壊れていなければ、ゴール（右方向 col=9）に最も近づく貫通通路カードを配置！
          if (!isPlayerToolBroken(cpu)) {
            let bestPlacement = null;
            cpu.hand.forEach((card, hIdx) => {
              if (card.kind !== 'path' || !card.center) return; // 金鉱掘りは行き止まりを出さない
              for (const rot of [false, true]) {
                const testCard = { ...card, rotated: rot };
                for (let r = 0; r < ROWS; r++) {
                  for (let c = 0; c < COLS; c++) {
                    if (canPlacePathCardAt(testCard, r, c)) {
                      // ゴール列(c=9)に近いほど高評価
                      const score = c * 10 - Math.abs(3 - r) + (testCard.dirs.E || (rot && testCard.dirs.W) ? 4 : 0);
                      if (!bestPlacement || score > bestPlacement.score) {
                        bestPlacement = { hIdx, card: testCard, r, c, score };
                      }
                    }
                  }
                }
              }
            });

            if (bestPlacement) {
              grid[bestPlacement.r][bestPlacement.c] = bestPlacement.card;
              SabSfx.dig();
              bannerText = `⛏️ ${cpu.name} が (${bestPlacement.c},${bestPlacement.r}) に【${bestPlacement.card.label}】を掘り進めました！`;
              consumeHandCardAndDraw(cpu, bestPlacement.hIdx);
              if (!recomputeConnectivityAndCheckGoals(cpu)) {
                advanceTurn();
              }
              return;
            }
          }
        } else {
          // 【😈お邪魔者AI】：
          // ① 手札に破壊カードがあれば他プレイヤー（特に人間プレイヤー等）の道具を破壊！
          const brkIdx = cpu.hand.findIndex((c) => c.kind === 'action' && c.actionType === 'break');
          if (brkIdx >= 0) {
            const card = cpu.hand[brkIdx];
            const target = players.find((pl) => pl.idx !== cpu.idx && pl.role === 'miner' && canApplyActionToPlayer(card, pl))
              || players.find((pl) => pl.idx !== cpu.idx && canApplyActionToPlayer(card, pl));
            if (target) {
              const t = card.tools[0];
              target.broken[t] = true;
              SabSfx.breakTool();
              bannerText = `💥 ${cpu.name} が ${target.name} の【${TOOLS[t].icon}${TOOLS[t].name}】を破壊しました！`;
              consumeHandCardAndDraw(cpu, brkIdx);
              advanceTurn();
              return;
            }
          }

          // ② 自分の道具が壊れていなければ、ゴールに近い最前線に「🚧行き止まりカード」を置いて道を塞ぐ！
          if (!isPlayerToolBroken(cpu)) {
            for (let hIdx = 0; hIdx < cpu.hand.length; hIdx++) {
              const card = cpu.hand[hIdx];
              if (card.kind === 'path' && !card.center) {
                for (let c = COLS - 2; c >= 1; c--) {
                  for (let r = 0; r < ROWS; r++) {
                    if (canPlacePathCardAt(card, r, c)) {
                      grid[r][c] = { ...card };
                      SabSfx.breakTool();
                      bannerText = `😈 ${cpu.name} が (${c},${r}) に【${card.label}】を置いて坑道を塞ぎました！`;
                      consumeHandCardAndDraw(cpu, hIdx);
                      recomputeConnectivityAndCheckGoals(cpu);
                      advanceTurn();
                      return;
                    }
                  }
                }
              }
            }
          }

          // ③ 落石カードがあれば、ゴールに近い貫通通路を爆破して分断！
          const rfIdx = cpu.hand.findIndex((c) => c.kind === 'action' && c.actionType === 'rockfall');
          if (rfIdx >= 0) {
            for (let c = COLS - 2; c >= 2; c--) {
              for (let r = 0; r < ROWS; r++) {
                if (grid[r][c] && !grid[r][c].isStart && !grid[r][c].isGoal && grid[r][c].center) {
                  grid[r][c] = null;
                  SabSfx.rockfall();
                  bannerText = `💣 ${cpu.name} が【落石】で (${c},${r}) の通路を爆破分断しました！`;
                  consumeHandCardAndDraw(cpu, rfIdx);
                  recomputeConnectivityAndCheckGoals(cpu);
                  advanceTurn();
                  return;
                }
              }
            }
          }
        }

        // 4. 出せるカードがない場合は1枚捨ててパス
        consumeHandCardAndDraw(cpu, 0);
        bannerText = `⏭️ ${cpu.name} は手札を1枚捨ててパスしました。`;
        advanceTurn();
      }

      // ====================================================
      // 4. UI全体レンダリング
      // ====================================================
      function renderAll() {
        const activeP = players[turnIndex];
        const me = players[mySeat];
        const isMyTurn = activeP && !activeP.isCpu && !roundOver && !matchOver;
        const selectedCard = (isMyTurn && selectedHandIdx !== null) ? me.hand[selectedHandIdx] : null;

        // 1. 上部プレイヤー一覧（破壊・修理カード選択中は対象プレイヤーがハイライト）
        playersStripEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && !roundOver;
          const canTarget = isMyTurn && selectedCard && selectedCard.kind === 'action' &&
            (selectedCard.actionType === 'break' || selectedCard.actionType === 'repair') &&
            canApplyActionToPlayer(selectedCard, p);

          const toolBadges = Object.keys(TOOLS).map((tk) => {
            const tm = TOOLS[tk];
            const brk = p.broken[tk];
            return `<span class="sab-tool-badge ${brk ? 'broken' : ''}" title="${tm.name}: ${brk ? '故障中' : '正常'}">${tm.icon}</span>`;
          }).join('');

          const roleReveal = (roundOver || p.idx === mySeat)
            ? `<span style="font-size:11px;padding:1px 6px;border-radius:6px;background:${p.role === 'miner' ? '#065f46' : '#881337'};color:#fef08a;">
                ${p.role === 'miner' ? '⛏️金鉱掘' : '😈お邪魔'}
              </span>`
            : `<span style="font-size:11px;color:#94a3b8;">❓正体不明</span>`;

          return `
            <div class="sab-pcard ${isTurn ? 'active-turn' : ''} ${canTarget ? 'targetable' : ''}" data-pidx="${p.idx}">
              <span style="font-weight:900;color:${p.idx === mySeat ? '#38bdf8' : '#f8fafc'};">${isTurn ? '▶ ' : ''}${p.name}</span>
              ${roleReveal}
              <div style="display:flex;gap:3px;">${toolBadges}</div>
              <span style="color:#fef08a;font-weight:900;">🪙${p.gold}</span>
            </div>
          `;
        }).join('');

        playersStripEl.querySelectorAll('[data-pidx]').forEach((el) => {
          el.onclick = () => {
            const pidx = parseInt(el.getAttribute('data-pidx'), 10);
            handlePlayerTargetClick(pidx);
          };
        });

        // 2. 自分の役割バッジ＆バナー＆山札残数
        if (me) {
          roleDisplayEl.innerHTML = `
            <span class="sab-role-pill" style="background:${me.role === 'miner' ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#e11d48,#9f1239)'};">
              あなたの正体: ${me.role === 'miner' ? '⛏️ 金鉱掘り (ゴールへ道を繋げ！)' : '😈 お邪魔者 (ゴール到達を妨害せよ！)'}
            </span>
          `;
        }
        bannerTxtEl.textContent = bannerText;
        deckTxtEl.textContent = `R${roundNum}/3 ｜ 📦 山札残り: ${deck.length}枚`;

        // 3. 11x7 2D坑道グリッド描画
        let cellsHtml = '';
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const tile = grid[r][c];
            const isPowered = connectedCells.has(`${r}_${c}`);
            let extraClass = '';

            if (isMyTurn && selectedCard) {
              if (selectedCard.kind === 'path' && !isPlayerToolBroken(me) && canPlacePathCardAt(selectedCard, r, c)) {
                extraClass = 'valid-drop';
              } else if (selectedCard.kind === 'action' && selectedCard.actionType === 'rockfall' && tile && !tile.isStart && !tile.isGoal) {
                extraClass = 'valid-rockfall';
              } else if (selectedCard.kind === 'action' && selectedCard.actionType === 'map' && tile && tile.isGoal) {
                extraClass = 'valid-map';
              }
            }

            cellsHtml += `
              <div class="sab-cell ${extraClass}" data-r="${r}" data-c="${c}">
                ${tile ? renderTileSvg(tile, isPowered) : ''}
              </div>
            `;
          }
        }
        gridEl.innerHTML = cellsHtml;

        gridEl.querySelectorAll('.sab-cell').forEach((cellEl) => {
          cellEl.onclick = () => {
            const r = parseInt(cellEl.getAttribute('data-r'), 10);
            const c = parseInt(cellEl.getAttribute('data-c'), 10);
            handleCellClick(r, c);
          };
        });

        // 4. 下部自分の手札カード＆操作ボタン
        if (me) {
          handCardsEl.innerHTML = me.hand.map((card, idx) => {
            const isSel = selectedHandIdx === idx;
            let previewHtml = '';
            if (card.kind === 'path') {
              previewHtml = renderTileSvg(card, true);
            } else {
              const iconMap = { break: '💥', repair: '🔧', map: '🗺️', rockfall: '💣' };
              const toolIcons = (card.tools || []).map((t) => TOOLS[t].icon).join('/');
              previewHtml = `<div style="font-size:24px;">${iconMap[card.actionType] || '🃏'}${toolIcons}</div>`;
            }

            return `
              <div class="sab-hcard ${isSel ? 'selected' : ''}" data-hidx="${idx}" title="${card.desc || card.label}">
                <div class="sab-hcard-preview">${previewHtml}</div>
                <div class="sab-hcard-title">${card.label}</div>
              </div>
            `;
          }).join('');

          handCardsEl.querySelectorAll('[data-hidx]').forEach((el) => {
            el.onclick = () => {
              if (!isMyTurn) return;
              const idx = parseInt(el.getAttribute('data-hidx'), 10);
              selectedHandIdx = selectedHandIdx === idx ? null : idx;
              SabSfx.dig();
              renderAll();
            };
          });
        }

        if (!isMyTurn) {
          dockControlsEl.innerHTML = `<span style="font-size:13px;color:#94a3b8;">⏳ ${activeP ? activeP.name : ''} が思考中...</span>`;
        } else if (selectedCard) {
          const canRotate = selectedCard.kind === 'path';
          let guide = '';
          if (selectedCard.kind === 'path') {
            guide = isPlayerToolBroken(me)
              ? '⚠️ あなたの道具が壊れているため通路を配置できません（修理するか不要カードを捨ててください）'
              : '👆 盤上の緑色に光っているマスをクリックして通路を配置！';
          } else if (selectedCard.actionType === 'break' || selectedCard.actionType === 'repair') {
            guide = '👆 上部プレイヤー一覧の緑枠で光っているプレイヤーをクリックして使用！';
          } else if (selectedCard.actionType === 'map') {
            guide = '👆 右端の3枚のゴールカード（水色枠）のいずれかをクリックして中身を調査！';
          } else if (selectedCard.actionType === 'rockfall') {
            guide = '👆 盤上の爆破したい通路カード（赤枠）をクリックして除去！';
          }

          dockControlsEl.innerHTML = `
            <span style="font-size:12px;font-weight:900;color:#34d399;">${guide}</span>
            ${canRotate ? `<button class="sab-btn sab-btn-gold" id="sab-rot-btn">🔄 180°向きを回転</button>` : ''}
            <button class="sab-btn sab-btn-danger" id="sab-discard-btn">🗑️ このカードを捨ててパス</button>
          `;
          const rotBtn = dockControlsEl.querySelector('#sab-rot-btn');
          if (rotBtn) {
            rotBtn.onclick = () => {
              selectedCard.rotated = !selectedCard.rotated;
              SabSfx.dig();
              renderAll();
            };
          }
          dockControlsEl.querySelector('#sab-discard-btn').onclick = () => {
            bannerText = `🗑️ ${me.name} は手札を1枚捨ててパスしました。`;
            consumeHandCardAndDraw(me, selectedHandIdx);
            advanceTurn();
          };
        } else {
          dockControlsEl.innerHTML = `<span style="font-size:13px;font-weight:900;color:#fef08a;">👆 左の手札から使用するカードをクリックして選択してください！</span>`;
        }
      }

      pcountSelEl.onchange = () => initMatch();
      newBtnEl.onclick = () => initMatch();

      initMatch();

      return () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
      };
    }
  });
})();
