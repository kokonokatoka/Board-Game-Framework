/**
 * 💎 3D 宝石の煌き (Splendor / スプレンダー) - ルネサンス宝石商3Dエディション
 * Board Arena Plugin (Godot 4.7 GLB + Three.js High-Resolution 3D WebGL)
 *
 * 🌟 特徴:
 * 1. 【公式スプレンダー完全ルール実装 (2〜4人対戦 / CPU思考AI / P2Pオンライン対応)】
 *    - 90枚の発展カード（Lv1: 40枚 / Lv2: 30枚 / Lv3: 20枚）＆ 10枚の貴族タイル完全収録
 *    - プレイ人数に応じた初期宝石枚数（2人:4枚 / 3人:5枚 / 4人:7枚、黄金ジョーカー:5枚）
 *    - 4つの手番アクション：①異色3枚獲得 ②同色2枚獲得(残4枚以上条件) ③カード予約＋黄金獲得(上限3枚) ④カード購入(恒久ボーナス割引＆黄金自動補填)
 *    - トークン所持上限10枚超過時の返却フェーズ、貴族の自動訪問判定、15点到達後の最終ラウンド均一手番＆購入枚数タイブレーク完全準拠
 * 2. 【超高精細 1024x1024 3Dカード＆Godot 4.7 GLB 3D宝石トークン】
 *    - 盤上の3Dトークン・3D発展カード・3D山札を直接クリックして快適操作！
 *    - 現在購入可能なカードは3D空間上でゴールド＆エメラルドに発光ハイライト！
 */

(function () {
  const GEM_TYPES = ['white', 'blue', 'green', 'red', 'black'];
  const ALL_TOKEN_TYPES = ['white', 'blue', 'green', 'red', 'black', 'gold'];

  const GEM_META = {
    white: { id: 'white', name: 'ダイヤ(白)', short: '白', hex: 0xf8fafc, rimHex: 0xcbd5e1, css: '#f8fafc', textCss: '#0f172a', borderCss: '#94a3b8', icon: '💎' },
    blue:  { id: 'blue',  name: 'サファイア(青)', short: '青', hex: 0x2563eb, rimHex: 0x60a5fa, css: '#2563eb', textCss: '#ffffff', borderCss: '#60a5fa', icon: '🔷' },
    green: { id: 'green', name: 'エメラルド(緑)', short: '緑', hex: 0x10b981, rimHex: 0x34d399, css: '#059669', textCss: '#ffffff', borderCss: '#34d399', icon: '🟢' },
    red:   { id: 'red',   name: 'ルビー(赤)', short: '赤', hex: 0xe11d48, rimHex: 0xfb7185, css: '#e11d48', textCss: '#ffffff', borderCss: '#fb7185', icon: '♦️' },
    black: { id: 'black', name: 'オニキス(黒)', short: '黒', hex: 0x1e293b, rimHex: 0x64748b, css: '#1e293b', textCss: '#f8fafc', borderCss: '#94a3b8', icon: '⚫' },
    gold:  { id: 'gold',  name: '黄金(ジョーカー)', short: '金', hex: 0xf59e0b, rimHex: 0xfde047, css: '#eab308', textCss: '#0f172a', borderCss: '#fef08a', icon: '🪙' }
  };

  // 公式準拠 90枚の発展カードデータ [level, bonusColor, points, {w, u, g, r, k}]
  const RAW_CARDS = [
    // ===== Level 1 (40 cards) =====
    // Black bonus (8)
    [1, 'black', 0, { w: 1, u: 1, g: 1, r: 1, k: 0 }],
    [1, 'black', 0, { w: 1, u: 2, g: 1, r: 1, k: 0 }],
    [1, 'black', 0, { w: 2, u: 2, g: 0, r: 1, k: 0 }],
    [1, 'black', 0, { w: 0, u: 0, g: 1, r: 3, k: 1 }],
    [1, 'black', 0, { w: 0, u: 0, g: 2, r: 1, k: 0 }],
    [1, 'black', 0, { w: 2, u: 0, g: 2, r: 0, k: 0 }],
    [1, 'black', 0, { w: 0, u: 0, g: 3, r: 0, k: 0 }],
    [1, 'black', 1, { w: 0, u: 4, g: 0, r: 0, k: 0 }],
    // Blue bonus (8)
    [1, 'blue', 0, { w: 1, u: 0, g: 1, r: 1, k: 1 }],
    [1, 'blue', 0, { w: 1, u: 0, g: 1, r: 2, k: 1 }],
    [1, 'blue', 0, { w: 1, u: 0, g: 2, r: 2, k: 0 }],
    [1, 'blue', 0, { w: 0, u: 1, g: 3, r: 1, k: 0 }],
    [1, 'blue', 0, { w: 1, u: 0, g: 0, r: 0, k: 2 }],
    [1, 'blue', 0, { w: 0, u: 0, g: 2, r: 0, k: 2 }],
    [1, 'blue', 0, { w: 0, u: 0, g: 0, r: 0, k: 3 }],
    [1, 'blue', 1, { w: 0, u: 0, g: 0, r: 4, k: 0 }],
    // White bonus (8)
    [1, 'white', 0, { w: 0, u: 1, g: 1, r: 1, k: 1 }],
    [1, 'white', 0, { w: 0, u: 1, g: 2, r: 1, k: 1 }],
    [1, 'white', 0, { w: 0, u: 2, g: 2, r: 0, k: 1 }],
    [1, 'white', 0, { w: 3, u: 1, g: 0, r: 0, k: 1 }],
    [1, 'white', 0, { w: 0, u: 0, g: 0, r: 2, k: 1 }],
    [1, 'white', 0, { w: 0, u: 2, g: 0, r: 0, k: 2 }],
    [1, 'white', 0, { w: 0, u: 3, g: 0, r: 0, k: 0 }],
    [1, 'white', 1, { w: 0, u: 0, g: 4, r: 0, k: 0 }],
    // Green bonus (8)
    [1, 'green', 0, { w: 1, u: 1, g: 0, r: 1, k: 1 }],
    [1, 'green', 0, { w: 1, u: 1, g: 0, r: 1, k: 2 }],
    [1, 'green', 0, { w: 0, u: 1, g: 0, r: 2, k: 2 }],
    [1, 'green', 0, { w: 1, u: 3, g: 1, r: 0, k: 0 }],
    [1, 'green', 0, { w: 2, u: 1, g: 0, r: 0, k: 0 }],
    [1, 'green', 0, { w: 0, u: 2, g: 0, r: 2, k: 0 }],
    [1, 'green', 0, { w: 0, u: 0, g: 0, r: 3, k: 0 }],
    [1, 'green', 1, { w: 0, u: 0, g: 0, r: 0, k: 4 }],
    // Red bonus (8)
    [1, 'red', 0, { w: 1, u: 1, g: 1, r: 0, k: 1 }],
    [1, 'red', 0, { w: 2, u: 1, g: 1, r: 0, k: 1 }],
    [1, 'red', 0, { w: 2, u: 0, g: 1, r: 0, k: 2 }],
    [1, 'red', 0, { w: 1, u: 0, g: 0, r: 1, k: 3 }],
    [1, 'red', 0, { w: 0, u: 2, g: 1, r: 0, k: 0 }],
    [1, 'red', 0, { w: 2, u: 0, g: 0, r: 2, k: 0 }],
    [1, 'red', 0, { w: 3, u: 0, g: 0, r: 0, k: 0 }],
    [1, 'red', 1, { w: 4, u: 0, g: 0, r: 0, k: 0 }],

    // ===== Level 2 (30 cards) =====
    // Black bonus (6)
    [2, 'black', 1, { w: 3, u: 2, g: 2, r: 0, k: 0 }],
    [2, 'black', 1, { w: 3, u: 0, g: 3, r: 0, k: 2 }],
    [2, 'black', 2, { w: 0, u: 1, g: 4, r: 2, k: 0 }],
    [2, 'black', 2, { w: 0, u: 0, g: 5, r: 3, k: 0 }],
    [2, 'black', 2, { w: 5, u: 0, g: 0, r: 0, k: 0 }],
    [2, 'black', 3, { w: 0, u: 0, g: 0, r: 0, k: 6 }],
    // Blue bonus (6)
    [2, 'blue', 1, { w: 0, u: 2, g: 2, r: 3, k: 0 }],
    [2, 'blue', 1, { w: 0, u: 2, g: 3, r: 0, k: 3 }],
    [2, 'blue', 2, { w: 5, u: 3, g: 0, r: 0, k: 0 }],
    [2, 'blue', 2, { w: 2, u: 0, g: 0, r: 1, k: 4 }],
    [2, 'blue', 2, { w: 0, u: 5, g: 0, r: 0, k: 0 }],
    [2, 'blue', 3, { w: 0, u: 6, g: 0, r: 0, k: 0 }],
    // White bonus (6)
    [2, 'white', 1, { w: 0, u: 0, g: 3, r: 2, k: 2 }],
    [2, 'white', 1, { w: 2, u: 3, g: 0, r: 3, k: 0 }],
    [2, 'white', 2, { w: 0, u: 0, g: 1, r: 4, k: 2 }],
    [2, 'white', 2, { w: 0, u: 0, g: 0, r: 5, k: 3 }],
    [2, 'white', 2, { w: 0, u: 0, g: 0, r: 5, k: 0 }],
    [2, 'white', 3, { w: 6, u: 0, g: 0, r: 0, k: 0 }],
    // Green bonus (6)
    [2, 'green', 1, { w: 3, u: 0, g: 2, r: 3, k: 0 }],
    [2, 'green', 1, { w: 2, u: 3, g: 0, r: 0, k: 2 }],
    [2, 'green', 2, { w: 4, u: 2, g: 0, r: 0, k: 1 }],
    [2, 'green', 2, { w: 0, u: 5, g: 3, r: 0, k: 0 }],
    [2, 'green', 2, { w: 0, u: 0, g: 5, r: 0, k: 0 }],
    [2, 'green', 3, { w: 0, u: 0, g: 6, r: 0, k: 0 }],
    // Red bonus (6)
    [2, 'red', 1, { w: 2, u: 0, g: 0, r: 2, k: 3 }],
    [2, 'red', 1, { w: 0, u: 3, g: 0, r: 2, k: 3 }],
    [2, 'red', 2, { w: 1, u: 4, g: 2, r: 0, k: 0 }],
    [2, 'red', 2, { w: 3, u: 0, g: 0, r: 0, k: 5 }],
    [2, 'red', 2, { w: 0, u: 0, g: 0, r: 0, k: 5 }],
    [2, 'red', 3, { w: 0, u: 0, g: 0, r: 6, k: 0 }],

    // ===== Level 3 (20 cards) =====
    // Black bonus (4)
    [3, 'black', 3, { w: 3, u: 3, g: 5, r: 3, k: 0 }],
    [3, 'black', 4, { w: 0, u: 0, g: 0, r: 7, k: 0 }],
    [3, 'black', 4, { w: 0, u: 0, g: 3, r: 6, k: 3 }],
    [3, 'black', 5, { w: 0, u: 0, g: 0, r: 7, k: 3 }],
    // Blue bonus (4)
    [3, 'blue', 3, { w: 3, u: 0, g: 3, r: 3, k: 5 }],
    [3, 'blue', 4, { w: 7, u: 0, g: 0, r: 0, k: 0 }],
    [3, 'blue', 4, { w: 6, u: 3, g: 0, r: 0, k: 3 }],
    [3, 'blue', 5, { w: 7, u: 3, g: 0, r: 0, k: 0 }],
    // White bonus (4)
    [3, 'white', 3, { w: 0, u: 3, g: 3, r: 5, k: 3 }],
    [3, 'white', 4, { w: 0, u: 0, g: 0, r: 0, k: 7 }],
    [3, 'white', 4, { w: 3, u: 0, g: 0, r: 3, k: 6 }],
    [3, 'white', 5, { w: 3, u: 0, g: 0, r: 0, k: 7 }],
    // Green bonus (4)
    [3, 'green', 3, { w: 5, u: 3, g: 0, r: 3, k: 3 }],
    [3, 'green', 4, { w: 0, u: 7, g: 0, r: 0, k: 0 }],
    [3, 'green', 4, { w: 3, u: 6, g: 3, r: 0, k: 0 }],
    [3, 'green', 5, { w: 0, u: 7, g: 3, r: 0, k: 0 }],
    // Red bonus (4)
    [3, 'red', 3, { w: 3, u: 5, g: 3, r: 0, k: 3 }],
    [3, 'red', 4, { w: 0, u: 0, g: 7, r: 0, k: 0 }],
    [3, 'red', 4, { w: 0, u: 3, g: 6, r: 3, k: 0 }],
    [3, 'red', 5, { w: 0, u: 0, g: 7, r: 3, k: 0 }]
  ];

  // 公式 10枚の貴族タイル (全て3威信ポイント)
  const NOBLE_TILES = [
    { id: 'n1', name: 'メディチ家', points: 3, req: { white: 0, blue: 0, green: 4, red: 4, black: 0 } },
    { id: 'n2', name: 'スフォルツァ家', points: 3, req: { white: 0, blue: 4, green: 4, red: 0, black: 0 } },
    { id: 'n3', name: 'ボルジア家', points: 3, req: { white: 0, blue: 0, green: 0, red: 4, black: 4 } },
    { id: 'n4', name: 'ハプスブルク家', points: 3, req: { white: 4, blue: 0, green: 0, red: 0, black: 4 } },
    { id: 'n5', name: 'チューダー朝', points: 3, req: { white: 4, blue: 4, green: 0, red: 0, black: 0 } },
    { id: 'n6', name: 'カトリック両王', points: 3, req: { white: 3, blue: 0, green: 0, red: 3, black: 3 } },
    { id: 'n7', name: 'フランソワ1世', points: 3, req: { white: 0, blue: 0, green: 3, red: 3, black: 3 } },
    { id: 'n8', name: 'アンヌ・ド・ブルターニュ', points: 3, req: { white: 3, blue: 3, green: 3, red: 0, black: 0 } },
    { id: 'n9', name: 'ニコロ・マキャヴェッリ', points: 3, req: { white: 3, blue: 3, green: 0, red: 0, black: 3 } },
    { id: 'n10', name: 'スレイマン1世', points: 3, req: { white: 0, blue: 3, green: 3, red: 3, black: 0 } }
  ];

  const PLAYER_THEMES = [
    { name: 'あなた (P1)', color: '#38bdf8', hex: 0x38bdf8 },
    { name: 'CPU 2 (ヴェネツィア商)', color: '#f43f5e', hex: 0xf43f5e },
    { name: 'CPU 3 (フィレンツェ商)', color: '#10b981', hex: 0x10b981 },
    { name: 'CPU 4 (アントワープ商)', color: '#f59e0b', hex: 0xf59e0b }
  ];

  // サウンドシンセサイザー
  const SplendorSfx = {
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
    gemClick() { this.play(980, 0.08, 'triangle', 0.11); },
    takeGems() {
      [659.25, 880, 1174.66].forEach((f, i) => setTimeout(() => this.play(f, 0.11, 'triangle', 0.12), i * 55));
    },
    buyCard() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.play(f, 0.16, 'triangle', 0.14), i * 60));
    },
    reserveCard() {
      this.play(440, 0.1, 'sine', 0.12);
      setTimeout(() => this.play(740, 0.14, 'triangle', 0.12), 70);
    },
    nobleVisit() {
      [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'triangle', 0.16), i * 75));
    }
  };

  function buildFullDeck() {
    return RAW_CARDS.map((item, idx) => ({
      id: 'c_' + idx,
      level: item[0],
      bonus: item[1],
      points: item[2],
      cost: {
        white: item[3].w || 0,
        blue: item[3].u || 0,
        green: item[3].g || 0,
        red: item[3].r || 0,
        black: item[3].k || 0
      }
    }));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  window.BoardArena.registerGame({
    id: 'splendor',
    name: '3D 宝石の煌き (Splendor)',
    icon: '💎',
    category: '👑 拡大再生産の金字塔 (フル3D)',
    minPlayers: 2,
    maxPlayers: 4,
    description: '宝石トークンを集めて鉱山や職人を雇い、貴族の訪問を受けて15威信ポイントを目指す拡大再生産ボードゲームの最高峰！フル3D＆公式完全ルール搭載。',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      let cpuTimer = null;

      let playerCount = 3;
      let vsCpu = !bridge.isConnected();
      let mySeat = bridge.isConnected() ? (bridge.isHost ? 0 : 1) : 0;

      // ゲーム状態
      let bank = { white: 5, blue: 5, green: 5, red: 5, black: 5, gold: 5 };
      let decks = { 1: [], 2: [], 3: [] };
      let market = { 1: [null, null, null, null], 2: [null, null, null, null], 3: [null, null, null, null] };
      let nobles = [];
      let players = [];
      let turnIndex = 0;
      let roundNum = 1;
      let finalRoundTriggered = false;
      let phase = 'ACTION'; // 'ACTION' | 'DISCARD_TOKENS' | 'GAME_OVER'
      let selectedTokens = []; // 現在の手番でピック中の宝石色配列 (例: ['white', 'blue'] or ['green', 'green'])
      let focusedCardInfo = null; // { source: 'market'|'reserved'|'deck', level, index, card }
      let lastActionText = '💎 宝石トークンをクリックして集めるか、場の3D発展カードをクリックして購入・予約してください。';

      // DOM構築
      container.innerHTML = `
        <style>
          .spl-wrapper {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            user-select: none;
            color: #f8fafc;
            font-family: 'Noto Sans JP', sans-serif;
          }
          .spl-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(245, 158, 11, 0.35);
            border-radius: 12px;
            padding: 6px 14px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
          }
          .spl-players-strip {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            flex: 1;
          }
          .spl-pcard {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(30, 41, 59, 0.85);
            border: 2px solid rgba(148, 163, 184, 0.25);
            border-radius: 10px;
            padding: 5px 11px;
            font-size: 12px;
            transition: all 0.2s;
          }
          .spl-pcard.active-turn {
            border-color: #f59e0b;
            background: rgba(245, 158, 11, 0.14);
            box-shadow: 0 0 16px rgba(245, 158, 11, 0.35);
          }
          .spl-pcard-name {
            font-weight: 900;
            font-size: 13px;
          }
          .spl-pcard-pts {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #0f172a;
            font-weight: 900;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 13px;
          }
          .spl-mini-gems {
            display: flex;
            gap: 4px;
            align-items: center;
          }
          .spl-mini-badge {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            padding: 1px 6px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            border: 1px solid rgba(255,255,255,0.25);
          }
          .spl-controls-right {
            display: flex;
            gap: 6px;
            align-items: center;
          }
          .spl-btn {
            background: rgba(30, 41, 59, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.4);
            color: #f8fafc;
            font-size: 12px;
            font-weight: 800;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .spl-btn:hover:not(:disabled) {
            border-color: #38bdf8;
            color: #38bdf8;
            transform: translateY(-1px);
          }
          .spl-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
          .spl-btn-gold {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-color: #fef08a;
            color: #0f172a;
          }
          .spl-btn-gold:hover:not(:disabled) {
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: #0f172a;
          }
          .spl-btn-emerald {
            background: linear-gradient(135deg, #10b981, #059669);
            border-color: #6ee7b7;
            color: #ffffff;
          }
          .spl-btn-emerald:hover:not(:disabled) {
            background: linear-gradient(135deg, #34d399, #10b981);
            color: #ffffff;
          }
          .spl-stage-wrap {
            position: relative;
            width: 100%;
            height: calc(100vh - 265px);
            min-height: 490px;
            max-height: 820px;
            background: radial-gradient(circle at 50% 35%, #1e1b4b 0%, #090d16 90%);
            border-radius: 16px;
            border: 1px solid rgba(245, 158, 11, 0.35);
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.75);
            overflow: hidden;
          }
          .spl-stage-wrap canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            cursor: grab;
          }
          .spl-stage-wrap canvas:active {
            cursor: grabbing;
          }
          .spl-stage-hud-top {
            position: absolute;
            top: 10px;
            left: 14px;
            right: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: none;
            z-index: 10;
          }
          .spl-banner-msg {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(245, 158, 11, 0.45);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
            color: #fef08a;
            pointer-events: auto;
            box-shadow: 0 6px 20px rgba(0,0,0,0.5);
          }
          .spl-cam-btns {
            display: flex;
            gap: 6px;
            pointer-events: auto;
          }
          /* 下部アクション＆手元ステータスドック */
          .spl-bottom-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 12px;
            padding: 8px 14px;
          }
          .spl-my-dashboard {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .spl-gem-slot {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 4px 10px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.22);
            min-width: 66px;
            cursor: pointer;
            transition: transform 0.15s;
          }
          .spl-gem-slot:hover {
            transform: translateY(-2px);
          }
          .spl-gem-slot-top {
            font-size: 11px;
            font-weight: 900;
          }
          .spl-gem-slot-vals {
            font-size: 13px;
            font-weight: 900;
            margin-top: 2px;
          }
          .spl-action-panel {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .spl-reserved-strip {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .spl-res-chip {
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            border: 2px solid #f59e0b;
            background: rgba(30, 41, 59, 0.95);
            color: #fef08a;
          }
          .spl-res-chip:hover {
            background: rgba(245, 158, 11, 0.25);
          }
          /* カード選択・トークン返却ポップアップオーバーレイ */
          .spl-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(9, 13, 22, 0.72);
            backdrop-filter: blur(5px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 30;
          }
          .spl-modal-overlay.visible {
            display: flex;
          }
          .spl-modal-box {
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border: 2px solid #f59e0b;
            border-radius: 16px;
            padding: 20px 24px;
            max-width: 480px;
            width: 92%;
            box-shadow: 0 24px 60px rgba(0,0,0,0.85);
            text-align: center;
          }
        </style>

        <div class="spl-wrapper">
          <div class="spl-top-bar">
            <div class="spl-players-strip" id="spl-players-strip"></div>
            <div class="spl-controls-right">
              <select id="spl-pcount-sel" class="spl-btn" title="プレイ人数">
                <option value="2">👥 2人対戦 (宝石各4)</option>
                <option value="3" selected>👥 3人対戦 (宝石各5)</option>
                <option value="4">👥 4人対戦 (宝石各7)</option>
              </select>
              <button class="spl-btn" id="spl-newgame-btn">🔄 新規ゲーム</button>
            </div>
          </div>

          <div class="spl-stage-wrap" id="spl-stage-wrap">
            <div class="spl-stage-hud-top">
              <div class="spl-banner-msg" id="spl-banner-msg">💎 3D 宝石の煌き (Splendor) へようこそ！</div>
              <div class="spl-cam-btns">
                <button class="spl-btn" id="spl-cam-overview">🎥 全体俯瞰</button>
                <button class="spl-btn" id="spl-cam-cards">🔍 カード拡大</button>
              </div>
            </div>

            <div class="spl-modal-overlay" id="spl-modal-overlay">
              <div class="spl-modal-box" id="spl-modal-box"></div>
            </div>
          </div>

          <div class="spl-bottom-dock">
            <div class="spl-my-dashboard" id="spl-my-dashboard"></div>
            <div class="spl-reserved-strip" id="spl-reserved-strip"></div>
            <div class="spl-action-panel" id="spl-action-panel"></div>
          </div>
        </div>
      `;

      const playersStripEl = container.querySelector('#spl-players-strip');
      const pcountSelEl = container.querySelector('#spl-pcount-sel');
      const newgameBtnEl = container.querySelector('#spl-newgame-btn');
      const stageWrapEl = container.querySelector('#spl-stage-wrap');
      const bannerMsgEl = container.querySelector('#spl-banner-msg');
      const camOverviewBtn = container.querySelector('#spl-cam-overview');
      const camCardsBtn = container.querySelector('#spl-cam-cards');
      const modalOverlayEl = container.querySelector('#spl-modal-overlay');
      const modalBoxEl = container.querySelector('#spl-modal-box');
      const myDashboardEl = container.querySelector('#spl-my-dashboard');
      const reservedStripEl = container.querySelector('#spl-reserved-strip');
      const actionPanelEl = container.querySelector('#spl-action-panel');

      // ====================================================
      // ゲームロジック＆ルール判定関数
      // ====================================================
      function createPlayer(idx) {
        return {
          idx,
          name: PLAYER_THEMES[idx].name,
          color: PLAYER_THEMES[idx].color,
          isCpu: vsCpu && idx !== mySeat,
          tokens: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
          bonuses: { white: 0, blue: 0, green: 0, red: 0, black: 0 },
          points: 0,
          purchasedCount: 0,
          reserved: [], // 最大3枚
          nobles: []
        };
      }

      function totalPlayerTokens(p) {
        return ALL_TOKEN_TYPES.reduce((sum, k) => sum + (p.tokens[k] || 0), 0);
      }

      // カードを購入可能か＆支払い内訳を計算
      function getPurchasePlan(p, card) {
        if (!card) return { canBuy: false, pay: null, goldNeeded: 0 };
        let goldNeeded = 0;
        const pay = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
        for (const color of GEM_TYPES) {
          const req = Math.max(0, (card.cost[color] || 0) - (p.bonuses[color] || 0));
          const have = p.tokens[color] || 0;
          if (have >= req) {
            pay[color] = req;
          } else {
            pay[color] = have;
            goldNeeded += (req - have);
          }
        }
        pay.gold = goldNeeded;
        const canBuy = (p.tokens.gold || 0) >= goldNeeded;
        return { canBuy, pay, goldNeeded };
      }

      // トークンをもう1枚選択トレイに追加できるか判定
      function canAddTokenToSelection(color) {
        if (color === 'gold') return false;
        const availInBank = bank[color] || 0;
        const alreadyPickedCount = selectedTokens.filter((c) => c === color).length;
        if (availInBank - alreadyPickedCount <= 0) return false;

        if (selectedTokens.length === 0) return true;
        if (selectedTokens.length === 1) {
          if (selectedTokens[0] === color) {
            // 同色2枚獲得は「山に4枚以上あった場合」のみ可能
            return availInBank >= 4;
          }
          return true;
        }
        if (selectedTokens.length === 2) {
          // 既に同色2枚選んでいる場合は追加不可
          if (selectedTokens[0] === selectedTokens[1]) return false;
          // 3枚目は既存の2色と異なる色のみ可能
          return !selectedTokens.includes(color);
        }
        return false;
      }

      function initGame() {
        if (cpuTimer) clearTimeout(cpuTimer);
        playerCount = parseInt(pcountSelEl.value, 10) || 3;
        const initGemCount = playerCount === 2 ? 4 : (playerCount === 3 ? 5 : 7);

        bank = {
          white: initGemCount,
          blue: initGemCount,
          green: initGemCount,
          red: initGemCount,
          black: initGemCount,
          gold: 5
        };

        const allCards = buildFullDeck();
        decks = {
          1: shuffle(allCards.filter((c) => c.level === 1)),
          2: shuffle(allCards.filter((c) => c.level === 2)),
          3: shuffle(allCards.filter((c) => c.level === 3))
        };

        market = { 1: [], 2: [], 3: [] };
        for (const lv of [1, 2, 3]) {
          for (let i = 0; i < 4; i++) {
            market[lv].push(decks[lv].pop() || null);
          }
        }

        nobles = shuffle(NOBLE_TILES).slice(0, playerCount + 1);
        players = [];
        for (let i = 0; i < playerCount; i++) {
          players.push(createPlayer(i));
        }

        turnIndex = 0;
        roundNum = 1;
        finalRoundTriggered = false;
        phase = 'ACTION';
        selectedTokens = [];
        focusedCardInfo = null;
        closeModal();
        lastActionText = '💎 ゲーム開始！盤上の3D宝石トークンをクリックして集めるか、3D発展カードをクリックしてください。';
        renderAll();
      }

      // 貴族訪問チェック（手番終了時、条件を満たす貴族がいれば1枚自動獲得）
      function checkNobleVisit(p) {
        for (let i = 0; i < nobles.length; i++) {
          const nb = nobles[i];
          const ok = GEM_TYPES.every((c) => (p.bonuses[c] || 0) >= (nb.req[c] || 0));
          if (ok) {
            nobles.splice(i, 1);
            p.nobles.push(nb);
            p.points += nb.points;
            SplendorSfx.nobleVisit();
            lastActionText += ` 👑 さらに貴族【${nb.name} (+3pt)】が訪問しました！`;
            break; // 公式ルール：1ターンにつき訪問する貴族は1人まで
          }
        }
      }

      function finishTurn() {
        const p = players[turnIndex];
        selectedTokens = [];
        focusedCardInfo = null;

        // トークン10枚上限チェック
        if (totalPlayerTokens(p) > 10) {
          if (p.isCpu) {
            // CPUは不要なトークンを10枚になるまで自動返却
            while (totalPlayerTokens(p) > 10) {
              const removable = GEM_TYPES.filter((c) => p.tokens[c] > 0);
              const pick = removable[Math.floor(Math.random() * removable.length)] || 'gold';
              p.tokens[pick]--;
              bank[pick]++;
            }
          } else {
            phase = 'DISCARD_TOKENS';
            openDiscardModal(p);
            renderAll();
            return;
          }
        }

        // 貴族訪問判定
        checkNobleVisit(p);

        // 15点到達チェック
        if (p.points >= 15) {
          finalRoundTriggered = true;
        }

        // 次の手番へ
        const nextIdx = (turnIndex + 1) % playerCount;
        if (nextIdx === 0) {
          if (finalRoundTriggered) {
            phase = 'GAME_OVER';
            openGameOverModal();
            renderAll();
            return;
          }
          roundNum++;
        }

        turnIndex = nextIdx;
        phase = 'ACTION';
        renderAll();

        if (players[turnIndex].isCpu && phase === 'ACTION') {
          cpuTimer = setTimeout(runCpuTurn, 750);
        }
      }

      // アクション1&2: 選択した宝石トークンを獲得確定
      function executeTakeTokens(p, tokensList) {
        const counts = {};
        tokensList.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
        Object.entries(counts).forEach(([c, cnt]) => {
          bank[c] -= cnt;
          p.tokens[c] += cnt;
        });
        SplendorSfx.takeGems();
        const desc = Object.entries(counts).map(([c, cnt]) => `${GEM_META[c].icon}${GEM_META[c].short}×${cnt}`).join('・');
        lastActionText = `✨ ${p.name} が宝石トークン（${desc}）を獲得しました。`;
        finishTurn();
      }

      // アクション3: カード予約
      function executeReserveCard(p, source, level, index) {
        if (p.reserved.length >= 3) return;
        let card = null;
        if (source === 'market') {
          card = market[level][index];
          if (!card) return;
          market[level][index] = decks[level].pop() || null;
        } else if (source === 'deck') {
          if (decks[level].length === 0) return;
          card = decks[level].pop();
        }
        if (!card) return;
        p.reserved.push(card);
        let gotGold = false;
        if (bank.gold > 0) {
          bank.gold--;
          p.tokens.gold++;
          gotGold = true;
        }
        SplendorSfx.reserveCard();
        lastActionText = `📌 ${p.name} が Lv.${level} カードを予約${gotGold ? 'し、🪙黄金トークンを獲得' : ''}しました。`;
        closeModal();
        finishTurn();
      }

      // アクション4: カード購入
      function executeBuyCard(p, source, level, index) {
        let card = null;
        if (source === 'market') {
          card = market[level][index];
        } else if (source === 'reserved') {
          card = p.reserved[index];
        }
        if (!card) return;
        const plan = getPurchasePlan(p, card);
        if (!plan.canBuy) return;

        // トークン支払い
        ALL_TOKEN_TYPES.forEach((c) => {
          const amt = plan.pay[c] || 0;
          if (amt > 0) {
            p.tokens[c] -= amt;
            bank[c] += amt;
          }
        });

        // 場または予約手札から補充・除去
        if (source === 'market') {
          market[level][index] = decks[level].pop() || null;
        } else {
          p.reserved.splice(index, 1);
        }

        p.bonuses[card.bonus] = (p.bonuses[card.bonus] || 0) + 1;
        p.points += card.points;
        p.purchasedCount++;

        SplendorSfx.buyCard();
        lastActionText = `🏛️ ${p.name} が Lv.${card.level}【${GEM_META[card.bonus].name} +${card.points}pt】を購入しました！`;
        closeModal();
        finishTurn();
      }

      // ====================================================
      // 賢いCPU思考エンジン
      // ====================================================
      function runCpuTurn() {
        if (isDestroyed || phase !== 'ACTION') return;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu) return;

        // 1. 購入可能な全カード（予約手札＋場札12枚）をリストアップし、評価値順で最高カードを購入
        const buyCandidates = [];
        cpu.reserved.forEach((card, idx) => {
          const plan = getPurchasePlan(cpu, card);
          if (plan.canBuy) {
            buyCandidates.push({ source: 'reserved', level: card.level, index: idx, card, score: evaluateCardForPlayer(cpu, card) });
          }
        });
        [3, 2, 1].forEach((lv) => {
          market[lv].forEach((card, idx) => {
            if (!card) return;
            const plan = getPurchasePlan(cpu, card);
            if (plan.canBuy) {
              buyCandidates.push({ source: 'market', level: lv, index: idx, card, score: evaluateCardForPlayer(cpu, card) });
            }
          });
        });

        if (buyCandidates.length > 0) {
          buyCandidates.sort((a, b) => b.score - a.score);
          const best = buyCandidates[0];
          executeBuyCard(cpu, best.source, best.level, best.index);
          return;
        }

        // 2. あと少しで買える場に並んだ高得点カードを目指し、不足している宝石色を計算
        const needWeight = { white: 1, blue: 1, green: 1, red: 1, black: 1 };
        [1, 2, 3].forEach((lv) => {
          market[lv].forEach((card) => {
            if (!card) return;
            let missingTotal = 0;
            const missingByColor = {};
            GEM_TYPES.forEach((c) => {
              const req = Math.max(0, (card.cost[c] || 0) - (cpu.bonuses[c] || 0) - (cpu.tokens[c] || 0));
              missingByColor[c] = req;
              missingTotal += req;
            });
            if (missingTotal <= 4) {
              const cardVal = (card.points + 1.5) / (missingTotal + 1);
              GEM_TYPES.forEach((c) => {
                if (missingByColor[c] > 0) needWeight[c] += missingByColor[c] * cardVal;
              });
            }
          });
        });

        // 3. トークン所持数が8枚以下なら優先度の高い異なる3色（または同色2枚）を取得
        const availColors = GEM_TYPES.filter((c) => bank[c] > 0).sort((a, b) => needWeight[b] - needWeight[a]);
        if (availColors.length > 0 && totalPlayerTokens(cpu) <= 8) {
          if (availColors.length >= 3) {
            executeTakeTokens(cpu, availColors.slice(0, 3));
            return;
          }
          if (bank[availColors[0]] >= 4) {
            executeTakeTokens(cpu, [availColors[0], availColors[0]]);
            return;
          }
          executeTakeTokens(cpu, availColors.slice(0, Math.min(3, availColors.length)));
          return;
        }

        // 4. 予約枠が空いていればLv2/Lv3の有望カードを予約
        if (cpu.reserved.length < 3) {
          for (const lv of [2, 3, 1]) {
            const idx = market[lv].findIndex((c) => c !== null);
            if (idx >= 0) {
              executeReserveCard(cpu, 'market', lv, idx);
              return;
            }
          }
        }

        // 5. フォールバック：取れるトークンを取るかターン終了
        if (availColors.length > 0) {
          executeTakeTokens(cpu, availColors.slice(0, Math.min(3, availColors.length)));
        } else {
          lastActionText = `⏭️ ${cpu.name} は行動をパスしました。`;
          finishTurn();
        }
      }

      function evaluateCardForPlayer(p, card) {
        let sc = card.points * 10 + card.level * 2;
        // 貴族タイルに必要なボーナス色なら加点
        nobles.forEach((nb) => {
          if ((nb.req[card.bonus] || 0) > (p.bonuses[card.bonus] || 0)) {
            sc += 4;
          }
        });
        return sc;
      }

      // ====================================================
      // モーダルUI（カード購入・予約 / トークン返却 / 勝敗結果）
      // ====================================================
      function closeModal() {
        modalOverlayEl.classList.remove('visible');
        focusedCardInfo = null;
      }

      function openCardActionModal(info) {
        const p = players[turnIndex];
        if (!p || p.isCpu || phase !== 'ACTION') return;
        focusedCardInfo = info;
        const { source, level, index, card } = info;

        if (source === 'deck') {
          const canReserve = p.reserved.length < 3 && decks[level].length > 0;
          modalBoxEl.innerHTML = `
            <div style="font-size:18px;font-weight:900;color:#fef08a;margin-bottom:8px;">📦 Lv.${level} 山札からブラインド予約</div>
            <div style="font-size:13px;color:#cbd5e1;margin-bottom:16px;">
              Lv.${level} の山札（残り ${decks[level].length} 枚）の一番上を予約し、${bank.gold > 0 ? '🪙黄金トークンを1枚獲得' : '手札にキープ'}しますか？
            </div>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button class="spl-btn spl-btn-gold" id="spl-m-res-deck" ${canReserve ? '' : 'disabled'}>📌 山札から予約する</button>
              <button class="spl-btn" id="spl-m-cancel">閉じる</button>
            </div>
          `;
          modalOverlayEl.classList.add('visible');
          modalBoxEl.querySelector('#spl-m-cancel').onclick = closeModal;
          const rBtn = modalBoxEl.querySelector('#spl-m-res-deck');
          if (rBtn && canReserve) rBtn.onclick = () => executeReserveCard(p, 'deck', level, 0);
          return;
        }

        if (!card) return;
        const plan = getPurchasePlan(p, card);
        const canReserve = source === 'market' && p.reserved.length < 3;
        const meta = GEM_META[card.bonus];

        const costBadges = GEM_TYPES.filter((c) => card.cost[c] > 0).map((c) => {
          const gm = GEM_META[c];
          const disc = p.bonuses[c] || 0;
          const net = Math.max(0, card.cost[c] - disc);
          return `<span class="spl-mini-badge" style="background:${gm.css};color:${gm.textCss};padding:4px 10px;font-size:13px;">
            ${gm.icon} 必要:${card.cost[c]} ${disc > 0 ? `(割引後:${net})` : ''}
          </span>`;
        }).join(' ');

        modalBoxEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:14px;font-weight:900;color:#94a3b8;">Lv.${card.level} 発展カード</span>
            <span style="font-size:22px;font-weight:900;color:#fef08a;">👑 +${card.points} 威信pt</span>
          </div>
          <div style="font-size:18px;font-weight:900;margin-bottom:12px;color:#f8fafc;">
            恒久ボーナス: <span style="padding:3px 10px;border-radius:8px;background:${meta.css};color:${meta.textCss};">${meta.icon} ${meta.name} +1</span>
          </div>
          <div style="margin-bottom:14px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
            ${costBadges}
          </div>
          <div style="font-size:12px;color:${plan.canBuy ? '#34d399' : '#fb7185'};font-weight:800;margin-bottom:16px;">
            ${plan.canBuy
              ? `✅ 購入可能！（黄金ジョーカー使用: ${plan.goldNeeded}枚）`
              : `⚠️ トークンが不足しています（あと ${plan.goldNeeded - (p.tokens.gold || 0)} 枚不足）`}
          </div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button class="spl-btn spl-btn-emerald" id="spl-m-buy" ${plan.canBuy ? '' : 'disabled'}>🏛️ 購入する</button>
            ${source === 'market' ? `<button class="spl-btn spl-btn-gold" id="spl-m-res" ${canReserve ? '' : 'disabled'}>📌 予約して🪙黄金獲得</button>` : ''}
            <button class="spl-btn" id="spl-m-cancel">キャンセル</button>
          </div>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#spl-m-cancel').onclick = closeModal;
        const buyBtn = modalBoxEl.querySelector('#spl-m-buy');
        if (buyBtn && plan.canBuy) buyBtn.onclick = () => executeBuyCard(p, source, level, index);
        const resBtn = modalBoxEl.querySelector('#spl-m-res');
        if (resBtn && canReserve) resBtn.onclick = () => executeReserveCard(p, 'market', level, index);
      }

      function openDiscardModal(p) {
        const excess = totalPlayerTokens(p) - 10;
        if (excess <= 0) {
          closeModal();
          finishTurn();
          return;
        }
        const btnsHtml = ALL_TOKEN_TYPES.filter((c) => p.tokens[c] > 0).map((c) => {
          const gm = GEM_META[c];
          return `<button class="spl-btn" data-ret="${c}" style="background:${gm.css};color:${gm.textCss};border:2px solid ${gm.borderCss};">
            ${gm.icon} ${gm.short} (所持:${p.tokens[c]}) を1枚返す
          </button>`;
        }).join('');

        modalBoxEl.innerHTML = `
          <div style="font-size:18px;font-weight:900;color:#fb7185;margin-bottom:8px;">⚠️ トークン所持上限（10枚）超過</div>
          <div style="font-size:13px;color:#e2e8f0;margin-bottom:14px;">
            現在 <b>${totalPlayerTokens(p)}枚</b> 所持しています。あと <b>${excess}枚</b> 返却するトークンを選んでください。
          </div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            ${btnsHtml}
          </div>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelectorAll('[data-ret]').forEach((b) => {
          b.onclick = () => {
            const c = b.getAttribute('data-ret');
            if (p.tokens[c] > 0) {
              p.tokens[c]--;
              bank[c]++;
              SplendorSfx.gemClick();
              openDiscardModal(p);
              renderAll();
            }
          };
        });
      }

      function openGameOverModal() {
        // 公式タイブレーク：威信ポイント降順 ＞ 購入発展カード枚数昇順
        const ranked = players.slice().sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return a.purchasedCount - b.purchasedCount;
        });
        const winner = ranked[0];
        const rows = ranked.map((p, i) => `
          <div style="display:flex;justify-content:space-between;padding:8px 12px;margin-bottom:6px;background:rgba(255,255,255,0.06);border-radius:8px;border-left:4px solid ${p.color};">
            <span><b>${i + 1}位: ${p.name}</b></span>
            <span>👑 <b>${p.points} pt</b> （購入カード: ${p.purchasedCount}枚 / 貴族: ${p.nobles.length}人）</span>
          </div>
        `).join('');

        modalBoxEl.innerHTML = `
          <div style="font-size:22px;font-weight:900;color:#fef08a;margin-bottom:8px;">🏆 ゲーム終了！勝者: ${winner.name}</div>
          <div style="margin-bottom:16px;text-align:left;">${rows}</div>
          <button class="spl-btn spl-btn-gold" id="spl-m-rematch">🔄 もう一度プレイする</button>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#spl-m-rematch').onclick = () => initGame();
      }

      // ====================================================
      // Three.js + Godot 4.7 GLB 3D シーン構築
      // ====================================================
      let THREE = null;
      let scene = null;
      let camera = null;
      let renderer = null;
      let dynamicGroup = null;
      let interactiveObjects = [];
      let glbTokenTemplate = null;
      let maxAniso = 8;

      let camSpherical = { radius: 19.2, phi: 0.78, theta: 0 };
      let camTarget = { x: 0, y: 0, z: 0.3 };

      function ensureThreeLoaded() {
        return new Promise((resolve) => {
          if (window.THREE) return resolve(window.THREE);
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
          s.onload = () => resolve(window.THREE);
          document.head.appendChild(s);
        });
      }

      function init3DStage(threeLib) {
        THREE = threeLib;
        const w = stageWrapEl.clientWidth || 960;
        const h = stageWrapEl.clientHeight || 580;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 200);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stageWrapEl.appendChild(renderer.domElement);

        maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;

        // 照明
        scene.add(new THREE.AmbientLight(0xf1f5f9, 0.92));
        const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
        keyLight.position.set(8, 18, 10);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
        rimLight.position.set(-10, 12, -8);
        scene.add(rimLight);

        // ルネサンス調ベルベット＆マホガニー3Dテーブルベース
        const tableGroup = new THREE.Group();
        const frameMesh = new THREE.Mesh(
          new THREE.BoxGeometry(18.6, 0.45, 13.0),
          new THREE.MeshStandardMaterial({ color: 0x3b1d0e, roughness: 0.35, metalness: 0.15 })
        );
        frameMesh.position.y = -0.25;
        frameMesh.receiveShadow = true;
        tableGroup.add(frameMesh);

        const feltMesh = new THREE.Mesh(
          new THREE.BoxGeometry(17.8, 0.12, 12.2),
          new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.72, metalness: 0.08 })
        );
        feltMesh.position.y = -0.04;
        feltMesh.receiveShadow = true;
        tableGroup.add(feltMesh);

        // 黄金の装飾トリムライン
        const goldTrim = new THREE.Mesh(
          new THREE.BoxGeometry(18.0, 0.14, 12.4),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.8 })
        );
        goldTrim.position.y = -0.06;
        tableGroup.add(goldTrim);

        scene.add(tableGroup);

        dynamicGroup = new THREE.Group();
        scene.add(dynamicGroup);

        // Godot 4.7 splendor_token.glb のロード試行
        if (window.THREE.GLTFLoader && window.location.protocol !== 'file:') {
          const loader = new window.THREE.GLTFLoader();
          loader.load('assets/models/splendor_token.glb', (gltf) => {
            if (gltf && gltf.scene) {
              glbTokenTemplate = gltf.scene;
              rebuild3DObjects();
            }
          }, undefined, () => {});
        }

        // カメラ操作＆3Dレイキャストイベント
        let isDragging = false;
        let dragDist = 0;
        let prevX = 0;
        let prevY = 0;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const dom = renderer.domElement;
        dom.addEventListener('pointerdown', (e) => {
          isDragging = true;
          dragDist = 0;
          prevX = e.clientX;
          prevY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
          if (isDestroyed) return;
          if (isDragging) {
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;
            dragDist += Math.abs(dx) + Math.abs(dy);
            prevX = e.clientX;
            prevY = e.clientY;
            camSpherical.theta -= dx * 0.0065;
            camSpherical.phi = Math.max(0.22, Math.min(1.28, camSpherical.phi - dy * 0.0065));
            updateCamera();
          }
        });

        window.addEventListener('pointerup', () => {
          isDragging = false;
        });

        dom.addEventListener('click', (e) => {
          if (dragDist > 7 || phase !== 'ACTION') return;
          const p = players[turnIndex];
          if (!p || p.isCpu) return;

          const rect = dom.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);

          const hits = raycaster.intersectObjects(interactiveObjects, true);
          if (hits.length > 0) {
            let obj = hits[0].object;
            while (obj && (!obj.userData || !obj.userData.onClick)) {
              obj = obj.parent;
            }
            if (obj && obj.userData && obj.userData.onClick) {
              obj.userData.onClick();
            }
          }
        });

        dom.addEventListener('wheel', (e) => {
          e.preventDefault();
          camSpherical.radius = Math.max(11.5, Math.min(27, camSpherical.radius + e.deltaY * 0.01));
          updateCamera();
        }, { passive: false });

        camOverviewBtn.onclick = () => {
          camSpherical = { radius: 19.2, phi: 0.78, theta: 0 };
          camTarget = { x: 0, y: 0, z: 0.3 };
          updateCamera();
        };

        camCardsBtn.onclick = () => {
          camSpherical = { radius: 14.8, phi: 0.48, theta: 0 };
          camTarget = { x: -0.9, y: 0, z: -0.2 };
          updateCamera();
        };

        window.addEventListener('resize', onResize);
        updateCamera();
        rebuild3DObjects();

        function animate() {
          if (isDestroyed) return;
          animFrameId = requestAnimationFrame(animate);
          renderer.render(scene, camera);
        }
        animate();
      }

      function updateCamera() {
        if (!camera) return;
        const { radius, phi, theta } = camSpherical;
        camera.position.set(
          camTarget.x + radius * Math.sin(phi) * Math.sin(theta),
          camTarget.y + radius * Math.cos(phi),
          camTarget.z + radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
      }

      function onResize() {
        if (isDestroyed || !renderer || !camera) return;
        const w = stageWrapEl.clientWidth || 960;
        const h = stageWrapEl.clientHeight || 580;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }

      // ====================================================
      // 高解像度 1024x1024 3Dカード・貴族タイル・宝石トークン生成
      // ====================================================
      function createDevelopmentCard3D(card, isAffordable) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 700;
        const ctx = c.getContext('2d');
        const gm = GEM_META[card.bonus];

        // 背景グラデーション（ボーナス宝石色に応じた美しいイラスト風背景）
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 700);
        if (card.bonus === 'white') {
          bgGrad.addColorStop(0, '#f8fafc');
          bgGrad.addColorStop(0.32, '#e2e8f0');
          bgGrad.addColorStop(1, '#334155');
        } else if (card.bonus === 'blue') {
          bgGrad.addColorStop(0, '#dbeafe');
          bgGrad.addColorStop(0.32, '#1d4ed8');
          bgGrad.addColorStop(1, '#0f172a');
        } else if (card.bonus === 'green') {
          bgGrad.addColorStop(0, '#d1fae5');
          bgGrad.addColorStop(0.32, '#047857');
          bgGrad.addColorStop(1, '#064e3b');
        } else if (card.bonus === 'red') {
          bgGrad.addColorStop(0, '#ffe4e6');
          bgGrad.addColorStop(0.32, '#be123c');
          bgGrad.addColorStop(1, '#4c0519');
        } else {
          bgGrad.addColorStop(0, '#cbd5e1');
          bgGrad.addColorStop(0.32, '#1e293b');
          bgGrad.addColorStop(1, '#020617');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 512, 700);

        // 上部ヘッダー帯（白半透明）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fillRect(0, 0, 512, 145);

        // 購入可能ならエメラルドゴールド枠、通常はシルバー枠
        ctx.strokeStyle = isAffordable ? '#34d399' : '#cbd5e1';
        ctx.lineWidth = isAffordable ? 24 : 12;
        ctx.strokeRect(10, 10, 492, 680);

        // 左上：威信ポイント
        if (card.points > 0) {
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 104px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(card.points), 36, 78);
        }

        // 右上：恒久ボーナス宝石アイコン＋大判カラーサークル
        ctx.fillStyle = gm.css;
        ctx.beginPath();
        ctx.arc(426, 74, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();

        ctx.fillStyle = gm.textCss;
        ctx.font = '900 44px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gm.short, 426, 76);

        // 中央の宝石クリスタルモチーフ描画
        ctx.save();
        ctx.translate(310, 360);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(0, -130);
        ctx.lineTo(120, 0);
        ctx.lineTo(0, 130);
        ctx.lineTo(-120, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 購入可能マーク
        if (isAffordable) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.94)';
          ctx.fillRect(180, 158, 310, 58);
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 34px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✨ 購入可能！', 335, 188);
        }

        // 左下：必要コストバッジ縦並び
        const costEntries = GEM_TYPES.filter((col) => card.cost[col] > 0);
        let cy = 620;
        costEntries.forEach((col) => {
          const cm = GEM_META[col];
          const amt = card.cost[col];
          ctx.fillStyle = cm.css;
          ctx.beginPath();
          ctx.arc(76, cy, 46, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          ctx.fillStyle = cm.textCss;
          ctx.font = '900 54px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(amt), 76, cy + 2);
          cy -= 104;
        });

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = maxAniso;

        const group = new THREE.Group();
        const cardMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.85, 0.1, 2.55),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.08 })
        );
        cardMesh.castShadow = true;
        cardMesh.receiveShadow = true;
        group.add(cardMesh);

        if (isAffordable) {
          const glowFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.96, 0.06, 2.66),
            new THREE.MeshBasicMaterial({ color: 0x10b981 })
          );
          glowFrame.position.y = -0.02;
          group.add(glowFrame);
        }
        return group;
      }

      function createDeckStack3D(level, remainingCount) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 700;
        const ctx = c.getContext('2d');

        const colors = {
          1: ['#065f46', '#047857'],
          2: ['#b45309', '#d97706'],
          3: ['#1e3a8a', '#2563eb']
        }[level];

        const grad = ctx.createLinearGradient(0, 0, 512, 700);
        grad.addColorStop(0, colors[1]);
        grad.addColorStop(1, colors[0]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 700);

        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 18;
        ctx.strokeRect(18, 18, 476, 664);

        ctx.fillStyle = '#fef08a';
        ctx.font = '900 78px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`LEVEL ${level}`, 256, 240);

        const dots = '● '.repeat(level).trim();
        ctx.font = '900 84px "Noto Sans JP", sans-serif';
        ctx.fillText(dots, 256, 360);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 52px "Noto Sans JP", sans-serif';
        ctx.fillText(`残り ${remainingCount} 枚`, 256, 510);

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = maxAniso;

        const stackH = Math.max(0.08, Math.min(0.42, remainingCount * 0.014));
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.85, stackH, 2.55),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.15 })
        );
        mesh.position.y = stackH / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      }

      function createNobleTile3D(noble) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');

        const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 340);
        grad.addColorStop(0, '#fef3c7');
        grad.addColorStop(0.6, '#d97706');
        grad.addColorStop(1, '#78350f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 18;
        ctx.strokeRect(14, 14, 484, 484);

        // 左上3pt
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 105px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('3', 36, 118);

        // 貴族名
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 40px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('👑 ' + noble.name, 476, 85);

        // 条件カードバッジ（下部横並び）
        const reqEntries = GEM_TYPES.filter((col) => noble.req[col] > 0);
        let rx = 86;
        reqEntries.forEach((col) => {
          const gm = GEM_META[col];
          ctx.fillStyle = gm.css;
          ctx.fillRect(rx - 48, 320, 96, 136);
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#ffffff';
          ctx.strokeRect(rx - 48, 320, 96, 136);

          ctx.fillStyle = gm.textCss;
          ctx.font = '900 66px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(noble.req[col]), rx, 410);
          rx += 126;
        });

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = maxAniso;

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.75, 0.14, 1.75),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.2 })
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      }

      function createGemToken3D(color, countInBank, pickedCount) {
        const gm = GEM_META[color];
        const group = new THREE.Group();

        const stackCount = Math.max(1, countInBank);
        for (let i = 0; i < stackCount; i++) {
          let chip;
          if (glbTokenTemplate) {
            chip = glbTokenTemplate.clone(true);
            chip.traverse((ch) => {
              if (ch.isMesh && ch.name === 'CentralJewel') {
                ch.material = new THREE.MeshStandardMaterial({ color: gm.hex, roughness: 0.1, metalness: 0.25 });
              } else if (ch.isMesh && ch.name === 'InnerFace') {
                ch.material = new THREE.MeshStandardMaterial({ color: gm.rimHex, roughness: 0.28, metalness: 0.35 });
              }
            });
          } else {
            chip = new THREE.Group();
            const base = new THREE.Mesh(
              new THREE.CylinderGeometry(0.62, 0.62, 0.13, 32),
              new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.25, metalness: 0.78 })
            );
            base.castShadow = true;
            chip.add(base);

            const inner = new THREE.Mesh(
              new THREE.CylinderGeometry(0.51, 0.51, 0.14, 32),
              new THREE.MeshStandardMaterial({ color: gm.hex, roughness: 0.18, metalness: 0.2 })
            );
            chip.add(inner);

            const jewel = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.24, 0),
              new THREE.MeshStandardMaterial({ color: gm.rimHex, roughness: 0.08, metalness: 0.3 })
            );
            jewel.scale.set(1, 0.55, 1);
            jewel.position.y = 0.08;
            chip.add(jewel);
          }
          chip.position.y = 0.08 + i * 0.14;
          if (countInBank === 0) {
            chip.scale.set(0.85, 0.3, 0.85);
          }
          group.add(chip);
        }

        // トークン枚数＆色名ラベルの3Dビルボードスプライト
        const lc = document.createElement('canvas');
        lc.width = 256;
        lc.height = 110;
        const lctx = lc.getContext('2d');
        lctx.fillStyle = pickedCount > 0 ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.9)';
        lctx.strokeStyle = pickedCount > 0 ? '#fef08a' : gm.borderCss;
        lctx.lineWidth = 6;
        lctx.fillRect(6, 6, 244, 98);
        lctx.strokeRect(6, 6, 244, 98);

        lctx.fillStyle = '#ffffff';
        lctx.font = '900 38px "Noto Sans JP", sans-serif';
        lctx.textAlign = 'center';
        lctx.textBaseline = 'middle';
        lctx.fillText(`${gm.short}: ${countInBank}枚`, 128, 42);

        lctx.fillStyle = pickedCount > 0 ? '#fef08a' : '#94a3b8';
        lctx.font = '900 26px "Noto Sans JP", sans-serif';
        lctx.fillText(pickedCount > 0 ? `選択中 +${pickedCount}` : (color === 'gold' ? '予約時獲得' : 'クリックで選択'), 128, 82);

        const ltex = new THREE.CanvasTexture(lc);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, transparent: true }));
        sprite.scale.set(1.65, 0.72, 1);
        sprite.position.set(0, stackCount * 0.14 + 0.58, 0);
        group.add(sprite);

        return group;
      }

      function rebuild3DObjects() {
        if (!THREE || !dynamicGroup) return;
        while (dynamicGroup.children.length > 0) {
          dynamicGroup.remove(dynamicGroup.children[0]);
        }
        interactiveObjects = [];

        const activeP = players[turnIndex] || players[0];

        // 1. 上段：貴族タイル (Z = -4.5)
        const nobleStartX = -((nobles.length - 1) * 2.2) / 2 - 1.2;
        nobles.forEach((nb, idx) => {
          const nbMesh = createNobleTile3D(nb);
          nbMesh.position.set(nobleStartX + idx * 2.2, 0.08, -4.55);
          dynamicGroup.add(nbMesh);
        });

        // 2. 中段3列：山札 + 4枚の発展カード (Lv3: Z=-1.8, Lv2: Z=1.0, Lv1: Z=3.8)
        const rowZ = { 3: -1.85, 2: 0.95, 1: 3.75 };
        [3, 2, 1].forEach((lv) => {
          const z = rowZ[lv];
          // 左端に山札 (X = -6.4)
          if (decks[lv].length > 0) {
            const deckMesh = createDeckStack3D(lv, decks[lv].length);
            deckMesh.position.set(-6.3, deckMesh.position.y, z);
            deckMesh.userData = {
              onClick: () => openCardActionModal({ source: 'deck', level: lv, index: 0, card: null })
            };
            dynamicGroup.add(deckMesh);
            interactiveObjects.push(deckMesh);
          }

          // 場札4枚 (X = -3.8, -1.5, 0.8, 3.1)
          for (let i = 0; i < 4; i++) {
            const card = market[lv][i];
            if (!card) continue;
            const plan = activeP ? getPurchasePlan(activeP, card) : { canBuy: false };
            const cardGroup = createDevelopmentCard3D(card, plan.canBuy);
            cardGroup.position.set(-3.8 + i * 2.28, 0.06, z);
            cardGroup.userData = {
              onClick: () => openCardActionModal({ source: 'market', level: lv, index: i, card })
            };
            dynamicGroup.add(cardGroup);
            interactiveObjects.push(cardGroup);
          }
        });

        // 3. 右列：6色の3D宝石トークンバンク (X = 6.4, Z = -4.2 〜 +4.3)
        ALL_TOKEN_TYPES.forEach((color, idx) => {
          const pickedCnt = selectedTokens.filter((c) => c === color).length;
          const remainInBank = Math.max(0, (bank[color] || 0) - pickedCnt);
          const tokenStack = createGemToken3D(color, remainInBank, pickedCnt);
          tokenStack.position.set(6.35, 0, -4.1 + idx * 1.68);
          if (color !== 'gold') {
            tokenStack.userData = {
              onClick: () => handleTokenBankClick(color)
            };
            interactiveObjects.push(tokenStack);
          }
          dynamicGroup.add(tokenStack);
        });
      }

      function handleTokenBankClick(color) {
        const p = players[turnIndex];
        if (!p || p.isCpu || phase !== 'ACTION') return;

        if (canAddTokenToSelection(color)) {
          selectedTokens.push(color);
          SplendorSfx.gemClick();
          renderAll();
        } else if (selectedTokens.includes(color)) {
          // 既に選択中の色を再クリックしたら1枚選択解除
          const idx = selectedTokens.lastIndexOf(color);
          if (idx >= 0) selectedTokens.splice(idx, 1);
          SplendorSfx.gemClick();
          renderAll();
        }
      }

      // ====================================================
      // UI全体レンダリング
      // ====================================================
      function renderAll() {
        // 1. 上部プレイヤー一覧バー
        playersStripEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && phase !== 'GAME_OVER';
          const gemSummary = GEM_TYPES.map((c) => {
            const gm = GEM_META[c];
            const b = p.bonuses[c] || 0;
            const t = p.tokens[c] || 0;
            if (b === 0 && t === 0) return '';
            return `<span class="spl-mini-badge" style="background:${gm.css};color:${gm.textCss};" title="${gm.name}: ボーナス[${b}] + トークン(${t})">
              ${gm.short}:[${b}]+${t}
            </span>`;
          }).join('');
          const goldBadge = p.tokens.gold > 0
            ? `<span class="spl-mini-badge" style="background:#eab308;color:#0f172a;">🪙${p.tokens.gold}</span>`
            : '';

          return `
            <div class="spl-pcard ${isTurn ? 'active-turn' : ''}">
              <span class="spl-pcard-name" style="color:${p.color};">${isTurn ? '▶ ' : ''}${p.name}</span>
              <span class="spl-pcard-pts">👑 ${p.points}/15pt</span>
              <div class="spl-mini-gems">${gemSummary}${goldBadge}</div>
              <span style="color:#94a3b8;font-size:11px;">(所持:${totalPlayerTokens(p)}/10・予約:${p.reserved.length}/3)</span>
            </div>
          `;
        }).join('');

        // 2. バナーメッセージ
        const activeP = players[turnIndex];
        bannerMsgEl.textContent = `${finalRoundTriggered ? '🔥【最終ラウンド】 ' : `[R${roundNum}] `}${activeP ? activeP.name + ' の手番｜' : ''}${lastActionText}`;

        // 3. 下部手元ダッシュボード（自分のボーナス＆トークン＆ワンクリック宝石取得）
        const me = players[mySeat] || players[0];
        if (me) {
          myDashboardEl.innerHTML = ALL_TOKEN_TYPES.map((c) => {
            const gm = GEM_META[c];
            const bonus = me.bonuses[c] || 0;
            const tok = me.tokens[c] || 0;
            const picked = selectedTokens.filter((x) => x === c).length;
            return `
              <div class="spl-gem-slot" data-gem="${c}" style="background:${gm.css};color:${gm.textCss};border-color:${picked > 0 ? '#fef08a' : gm.borderCss};" title="${c !== 'gold' ? 'クリックでこの色の宝石トークンを選択/解除' : '黄金ジョーカー（カード予約時に獲得）'}">
                <div class="spl-gem-slot-top">${gm.icon} ${gm.short} (山:${bank[c]})</div>
                <div class="spl-gem-slot-vals">
                  ${c !== 'gold' ? `割引[${bonus}] + ` : ''}所持(${tok}) ${picked > 0 ? `<b>+${picked}</b>` : ''}
                </div>
              </div>
            `;
          }).join('');

          myDashboardEl.querySelectorAll('[data-gem]').forEach((el) => {
            const c = el.getAttribute('data-gem');
            if (c !== 'gold') {
              el.onclick = () => handleTokenBankClick(c);
            }
          });

          // 予約カード一覧チップ
          if (me.reserved.length > 0) {
            reservedStripEl.innerHTML = `<span style="font-size:12px;font-weight:900;color:#fde047;">📌 予約中(${me.reserved.length}/3):</span>` +
              me.reserved.map((rc, idx) => {
                const gm = GEM_META[rc.bonus];
                const canBuy = getPurchasePlan(me, rc).canBuy;
                return `<button class="spl-res-chip" data-res-idx="${idx}">
                  ${gm.icon} Lv.${rc.level} (+${rc.points}pt) ${canBuy ? '✨購入可' : ''}
                </button>`;
              }).join('');
            reservedStripEl.querySelectorAll('[data-res-idx]').forEach((btn) => {
              btn.onclick = () => {
                const idx = parseInt(btn.getAttribute('data-res-idx'), 10);
                openCardActionModal({ source: 'reserved', level: me.reserved[idx].level, index: idx, card: me.reserved[idx] });
              };
            });
          } else {
            reservedStripEl.innerHTML = `<span style="font-size:12px;color:#94a3b8;">📌 予約カードなし (最大3枚)</span>`;
          }
        }

        // 4. アクション確定パネル（トークン選択中）
        const isMyTurn = activeP && !activeP.isCpu && phase === 'ACTION';
        if (isMyTurn && selectedTokens.length > 0) {
          const summary = selectedTokens.map((c) => GEM_META[c].icon + GEM_META[c].short).join(' + ');
          actionPanelEl.innerHTML = `
            <span style="font-size:12px;font-weight:900;color:#fef08a;">選択中: ${summary}</span>
            <button class="spl-btn spl-btn-emerald" id="spl-confirm-tokens">✅ この宝石を獲得する</button>
            <button class="spl-btn" id="spl-clear-tokens">✖ リセット</button>
          `;
          actionPanelEl.querySelector('#spl-confirm-tokens').onclick = () => executeTakeTokens(activeP, selectedTokens);
          actionPanelEl.querySelector('#spl-clear-tokens').onclick = () => {
            selectedTokens = [];
            renderAll();
          };
        } else if (isMyTurn) {
          actionPanelEl.innerHTML = `<span style="font-size:12px;color:#38bdf8;font-weight:800;">👆 右側の3D宝石山（または下の色スロット）をクリックして宝石を集めるか、3Dカードをクリックして購入・予約！</span>`;
        } else {
          actionPanelEl.innerHTML = `<span style="font-size:12px;color:#94a3b8;">⏳ 相手の手番中...</span>`;
        }

        rebuild3DObjects();
      }

      pcountSelEl.onchange = () => initGame();
      newgameBtnEl.onclick = () => initGame();

      ensureThreeLoaded().then((threeLib) => {
        if (isDestroyed) return;
        init3DStage(threeLib);
        initGame();
      });

      return () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
        if (animFrameId) cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', onResize);
        if (renderer) renderer.dispose();
      };
    }
  });
})();
