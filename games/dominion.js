/**
 * 👑 3D ドミニオン (Dominion) - AAA 立体デッキ構築＆公式完全ルール版
 * Board Arena Plugin (Godot 4.7 GLB + Three.js High-Resolution 3D WebGL)
 *
 * 🌟 AAA 特徴:
 * 1. 【公式ドミニオン完全ルール＆A-B-Cフェーズ制御 (2〜4人対戦・コンボ＆ビッグマネーAI搭載)】
 *    - 基本サプライ7種（銅貨・銀貨・金貨・屋敷・公領・属州・呪い）＋ 名作王国カード16種から10種を選択可能！
 *    - プリセット切替対応：①最初のゲーム(公式推奨10種) ②ビッグマネー＆魔女 ③コンボ＆庭園帝国 ④ランダム10種
 *    - 地下貯蔵庫・礼拝堂(廃棄圧縮)・堀(アタック無効化リアクション)・村・木こり・工房・鍛冶屋・民兵(ハンデス)・
 *      改築・金貸し・庭園(枚数参照VP)・市場・研究所・祝祭・鉱山(財宝アップグレード)・魔女(呪い撒き) の全効果を完全実装！
 *    - 終了条件（属州枯れ or サプライ3山枯れ）＆ 全デッキ総計VP計算・ターン数タイブレーク完全準拠。
 * 2. 【Godot 4.7 GLBモデル ＋ 高解像度3Dカードテーブル】
 *    - 17種類の3Dサプライ山札（残枚数に応じた立体厚み変化）と、手前の3D手札・山札・捨て札・プレイエリアをフル3D描画！
 *    - 購入可能・獲得可能な3Dサプライ山札がエメラルド＆ゴールドに発光し、3Dカード直接クリックでプレイ＆購入可能！
 */

(function () {
  // 全カード定義マスター
  const CARD_DB = {
    // ===== 基本財宝カード =====
    copper: {
      id: 'copper', name: '銅貨', cost: 0, type: 'treasure', coins: 1, vp: 0,
      icon: '🪙', colorCss: '#b45309', headerCss: '#fbbf24', textColor: '#0f172a',
      desc: '+1 コイン'
    },
    silver: {
      id: 'silver', name: '銀貨', cost: 3, type: 'treasure', coins: 2, vp: 0,
      icon: '🥈', colorCss: '#475569', headerCss: '#e2e8f0', textColor: '#0f172a',
      desc: '+2 コイン'
    },
    gold: {
      id: 'gold', name: '金貨', cost: 6, type: 'treasure', coins: 3, vp: 0,
      icon: '🥇', colorCss: '#ca8a04', headerCss: '#fef08a', textColor: '#0f172a',
      desc: '+3 コイン'
    },

    // ===== 基本勝利点・呪いカード =====
    estate: {
      id: 'estate', name: '屋敷', cost: 2, type: 'victory', coins: 0, vp: 1,
      icon: '🏡', colorCss: '#15803d', headerCss: '#86efac', textColor: '#0f172a',
      desc: '1 勝利点(VP)'
    },
    duchy: {
      id: 'duchy', name: '公領', cost: 5, type: 'victory', coins: 0, vp: 3,
      icon: '🏰', colorCss: '#047857', headerCss: '#6ee7b7', textColor: '#0f172a',
      desc: '3 勝利点(VP)'
    },
    province: {
      id: 'province', name: '属州', cost: 8, type: 'victory', coins: 0, vp: 6,
      icon: '👑', colorCss: '#065f46', headerCss: '#34d399', textColor: '#0f172a',
      desc: '6 勝利点(VP)'
    },
    curse: {
      id: 'curse', name: '呪い', cost: 0, type: 'curse', coins: 0, vp: -1,
      icon: '💀', colorCss: '#581c87', headerCss: '#d8b4fe', textColor: '#0f172a',
      desc: '-1 勝利点(VP)'
    },

    // ===== 王国カード (全16種) =====
    cellar: {
      id: 'cellar', name: '地下貯蔵庫', cost: 2, type: 'action',
      plusCards: 0, plusActions: 1, plusBuys: 0, plusCoins: 0,
      icon: '🍷', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '+1アクション / 手札を任意枚数捨て、同数引く'
    },
    chapel: {
      id: 'chapel', name: '礼拝堂', cost: 2, type: 'action',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '⛪', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '手札から最大4枚までを廃棄(デッキ圧縮)する'
    },
    moat: {
      id: 'moat', name: '堀', cost: 2, type: 'action-reaction',
      plusCards: 2, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '🛡️', colorCss: '#0284c7', headerCss: '#bae6fd', textColor: '#0f172a',
      desc: '+2カード / 手札にあれば他人のアタックを無効化'
    },
    village: {
      id: 'village', name: '村', cost: 3, type: 'action',
      plusCards: 1, plusActions: 2, plusBuys: 0, plusCoins: 0,
      icon: '🏘️', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '+1カード / +2アクション'
    },
    woodcutter: {
      id: 'woodcutter', name: '木こり', cost: 3, type: 'action',
      plusCards: 0, plusActions: 0, plusBuys: 1, plusCoins: 2,
      icon: '🪓', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '+1購入 / +2コイン'
    },
    workshop: {
      id: 'workshop', name: '工房', cost: 3, type: 'action',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '🛠️', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: 'コスト4以下の好きなカードを1枚獲得する'
    },
    smithy: {
      id: 'smithy', name: '鍛冶屋', cost: 4, type: 'action',
      plusCards: 3, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '🔨', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '+3カード'
    },
    militia: {
      id: 'militia', name: '民兵', cost: 4, type: 'action-attack',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 2,
      icon: '⚔️', colorCss: '#991b1b', headerCss: '#fecaca', textColor: '#0f172a',
      desc: '+2コイン / 他全員は手札が3枚になるまで捨てる'
    },
    remodel: {
      id: 'remodel', name: '改築', cost: 4, type: 'action',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '♻️', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '手札1枚を廃棄し、コスト+2以下のカードを1枚獲得'
    },
    moneylender: {
      id: 'moneylender', name: '金貸し', cost: 4, type: 'action',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '💰', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '手札の銅貨1枚を廃棄し、+3コインを得る'
    },
    gardens: {
      id: 'gardens', name: '庭園', cost: 4, type: 'victory', coins: 0, vp: 0,
      icon: '🌿', colorCss: '#15803d', headerCss: '#86efac', textColor: '#0f172a',
      desc: '総デッキ10枚(端数切捨)につき 1勝利点(VP)'
    },
    market: {
      id: 'market', name: '市場', cost: 5, type: 'action',
      plusCards: 1, plusActions: 1, plusBuys: 1, plusCoins: 1,
      icon: '🏪', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '+1カード / +1アクション / +1購入 / +1コイン'
    },
    laboratory: {
      id: 'laboratory', name: '研究所', cost: 5, type: 'action',
      plusCards: 2, plusActions: 1, plusBuys: 0, plusCoins: 0,
      icon: '🧪', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '+2カード / +1アクション'
    },
    festival: {
      id: 'festival', name: '祝祭', cost: 5, type: 'action',
      plusCards: 0, plusActions: 2, plusBuys: 1, plusCoins: 2,
      icon: '🎉', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '+2アクション / +1購入 / +2コイン'
    },
    mine: {
      id: 'mine', name: '鉱山', cost: 5, type: 'action',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '⛏️', colorCss: '#334155', headerCss: '#f1f5f9', textColor: '#0f172a',
      desc: '財宝1枚を廃棄し、コスト+3以下の財宝を手札に獲得'
    },
    witch: {
      id: 'witch', name: '魔女', cost: 5, type: 'action-attack',
      plusCards: 2, plusActions: 0, plusBuys: 0, plusCoins: 0,
      icon: '🧙‍♀️', colorCss: '#991b1b', headerCss: '#fecaca', textColor: '#0f172a',
      desc: '+2カード / 他全員に呪い(-1VP)を1枚ずつ配る'
    }
  };

  const KINGDOM_PRESETS = {
    first_game: {
      name: '🏰 最初のゲーム (公式推奨10種)',
      cards: ['cellar', 'moat', 'village', 'woodcutter', 'workshop', 'smithy', 'militia', 'remodel', 'market', 'mine']
    },
    witch_money: {
      name: '🧙‍♀️ 魔女と黄金帝国',
      cards: ['chapel', 'moat', 'village', 'moneylender', 'smithy', 'militia', 'market', 'laboratory', 'mine', 'witch']
    },
    engine_gardens: {
      name: '🌿 祝祭コンボ＆庭園帝国',
      cards: ['cellar', 'village', 'woodcutter', 'workshop', 'gardens', 'smithy', 'remodel', 'festival', 'laboratory', 'market']
    }
  };

  const BASE_KEYS = ['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse'];
  const ALL_KINGDOM_KEYS = [
    'cellar', 'chapel', 'moat', 'village', 'woodcutter', 'workshop',
    'smithy', 'militia', 'remodel', 'moneylender', 'gardens',
    'market', 'laboratory', 'festival', 'mine', 'witch'
  ];

  const PLAYER_THEMES = [
    { name: 'あなた (P1)', css: '#38bdf8' },
    { name: 'CPU 2 (宰相)', css: '#f43f5e' },
    { name: 'CPU 3 (将軍)', css: '#10b981' },
    { name: 'CPU 4 (大司教)', css: '#f59e0b' }
  ];

  // Web Audio サウンド
  const DomSfx = {
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
    cardPlay() { this.play(520, 0.08, 'triangle', 0.12); },
    coin() {
      [784, 1046.5].forEach((f, i) => setTimeout(() => this.play(f, 0.09, 'sine', 0.11), i * 45));
    },
    buy() {
      [523.25, 659.25, 880].forEach((f, i) => setTimeout(() => this.play(f, 0.13, 'triangle', 0.13), i * 55));
    },
    attack() {
      [220, 175, 130].forEach((f, i) => setTimeout(() => this.play(f, 0.2, 'sawtooth', 0.15), i * 75));
    },
    victory() {
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

  window.BoardArena.registerGame({
    id: 'dominion',
    name: '3D ドミニオン (Dominion)',
    icon: '👑',
    category: '🃏 デッキ構築の金字塔 (AAA 3D)',
    minPlayers: 2,
    maxPlayers: 4,
    description: '銅貨7枚と屋敷3枚の小さな領地から始まり、王国カードの連鎖コンボと金貨で「属州」を買い占めるデッキ構築型ゲームの金字塔！フル3Dサプライ＆公式ルール完全搭載。',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      let cpuTimer = null;

      let playerCount = 2;
      let vsCpu = !bridge.isConnected();
      let mySeat = bridge.isConnected() ? (bridge.isHost ? 0 : 1) : 0;

      // ゲーム状態
      let kingdomKeys = KINGDOM_PRESETS.first_game.cards.slice();
      let supply = {};     // { cardId: count }
      let trashPile = [];
      let players = [];
      let turnIndex = 0;
      let turnPhase = 'ACTION'; // 'ACTION' | 'BUY' | 'GAME_OVER'
      let actionsLeft = 1;
      let buysLeft = 1;
      let coinsPool = 0;

      // 特殊カード効果待ち状態: null | { mode: 'GAIN_UP_TO', maxCost, dest: 'discard'|'hand', filterType: null|'treasure' }
      let pendingGain = null;
      let logBannerText = '👑 3D ドミニオンへようこそ！手札のアクションカードまたは財宝カードをプレイしましょう。';

      container.innerHTML = `
        <style>
          .dom-wrapper {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            user-select: none;
            color: #f8fafc;
            font-family: 'Noto Sans JP', sans-serif;
          }
          .dom-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(251, 191, 36, 0.38);
            border-radius: 12px;
            padding: 6px 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          }
          .dom-players-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            flex: 1;
          }
          .dom-pcard {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(30, 41, 59, 0.88);
            border: 2px solid rgba(148, 163, 184, 0.25);
            border-radius: 10px;
            padding: 5px 10px;
            font-size: 12px;
          }
          .dom-pcard.active-turn {
            border-color: #fbbf24;
            background: rgba(251, 191, 36, 0.15);
            box-shadow: 0 0 16px rgba(251, 191, 36, 0.35);
          }
          .dom-vp-badge {
            background: linear-gradient(135deg, #10b981, #059669);
            color: #ffffff;
            font-weight: 900;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 12px;
          }
          .dom-btn {
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
          .dom-btn:hover:not(:disabled) {
            border-color: #38bdf8;
            color: #38bdf8;
            transform: translateY(-1px);
          }
          .dom-btn:disabled {
            opacity: 0.38;
            cursor: not-allowed;
          }
          .dom-btn-gold {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-color: #fef08a;
            color: #0f172a;
          }
          .dom-btn-emerald {
            background: linear-gradient(135deg, #10b981, #059669);
            border-color: #6ee7b7;
            color: #ffffff;
          }
          .dom-stage-wrap {
            position: relative;
            width: 100%;
            height: calc(100vh - 285px);
            min-height: 495px;
            max-height: 820px;
            background: radial-gradient(circle at 50% 35%, #1e1b4b 0%, #0f172a 65%, #020617 100%);
            border-radius: 16px;
            border: 1px solid rgba(251, 191, 36, 0.38);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.78);
            overflow: hidden;
          }
          .dom-stage-wrap canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            cursor: grab;
          }
          .dom-stage-wrap canvas:active {
            cursor: grabbing;
          }
          .dom-hud-top {
            position: absolute;
            top: 10px;
            left: 14px;
            right: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: none;
            z-index: 10;
            gap: 10px;
          }
          .dom-banner {
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(251, 191, 36, 0.5);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
            color: #fef08a;
            pointer-events: auto;
            box-shadow: 0 6px 20px rgba(0,0,0,0.55);
          }
          .dom-abc-counters {
            display: flex;
            gap: 8px;
            pointer-events: auto;
          }
          .dom-abc-pill {
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(56, 189, 248, 0.45);
            padding: 5px 12px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 900;
          }
          .dom-bottom-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            background: rgba(15, 23, 42, 0.96);
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 12px;
            padding: 8px 14px;
          }
          .dom-hand-strip {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            flex: 1;
          }
          .dom-hand-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 11px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.35);
            transition: transform 0.15s;
          }
          .dom-hand-chip:hover {
            transform: translateY(-3px);
            border-color: #fef08a;
          }
          .dom-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(9, 13, 22, 0.76);
            backdrop-filter: blur(5px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 30;
          }
          .dom-modal-overlay.visible {
            display: flex;
          }
          .dom-modal-box {
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border: 2px solid #f59e0b;
            border-radius: 16px;
            padding: 20px 24px;
            max-width: 540px;
            width: 92%;
            box-shadow: 0 24px 60px rgba(0,0,0,0.88);
            text-align: center;
          }
        </style>

        <div class="dom-wrapper">
          <div class="dom-top-bar">
            <div class="dom-players-row" id="dom-players-row"></div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <select id="dom-preset-sel" class="dom-btn" title="王国カード10種セット">
                <option value="first_game">🏰 最初のゲーム (推奨10種)</option>
                <option value="witch_money">🧙‍♀️ 魔女と黄金帝国</option>
                <option value="engine_gardens">🌿 祝祭コンボ＆庭園</option>
                <option value="random">🎲 ランダム10種</option>
              </select>
              <select id="dom-pcount-sel" class="dom-btn">
                <option value="2" selected>👥 2人対戦</option>
                <option value="3">👥 3人対戦</option>
                <option value="4">👥 4人対戦</option>
              </select>
              <button class="dom-btn" id="dom-new-btn">🔄 新規ゲーム</button>
            </div>
          </div>

          <div class="dom-stage-wrap" id="dom-stage-wrap">
            <div class="dom-hud-top">
              <div class="dom-banner" id="dom-banner">👑 3D ドミニオン (Dominion)</div>
              <div class="dom-abc-counters">
                <div class="dom-abc-pill" id="dom-stat-act" style="color:#38bdf8;">⚡ アクション: 1</div>
                <div class="dom-abc-pill" id="dom-stat-buy" style="color:#34d399;">🛒 購入: 1</div>
                <div class="dom-abc-pill" id="dom-stat-coin" style="color:#fef08a;">🪙 コイン: 0</div>
                <button class="dom-btn" id="dom-cam-reset">🎥 視点リセット</button>
              </div>
            </div>

            <div class="dom-modal-overlay" id="dom-modal-overlay">
              <div class="dom-modal-box" id="dom-modal-box"></div>
            </div>
          </div>

          <div class="dom-bottom-dock">
            <div class="dom-hand-strip" id="dom-hand-strip"></div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;" id="dom-action-btns"></div>
          </div>
        </div>
      `;

      const playersRowEl = container.querySelector('#dom-players-row');
      const presetSelEl = container.querySelector('#dom-preset-sel');
      const pcountSelEl = container.querySelector('#dom-pcount-sel');
      const newBtnEl = container.querySelector('#dom-new-btn');
      const stageWrapEl = container.querySelector('#dom-stage-wrap');
      const bannerEl = container.querySelector('#dom-banner');
      const statActEl = container.querySelector('#dom-stat-act');
      const statBuyEl = container.querySelector('#dom-stat-buy');
      const statCoinEl = container.querySelector('#dom-stat-coin');
      const camResetBtn = container.querySelector('#dom-cam-reset');
      const modalOverlayEl = container.querySelector('#dom-modal-overlay');
      const modalBoxEl = container.querySelector('#dom-modal-box');
      const handStripEl = container.querySelector('#dom-hand-strip');
      const actionBtnsEl = container.querySelector('#dom-action-btns');

      // ====================================================
      // 1. プレイヤー＆デッキ・ドロー・VP計算関数
      // ====================================================
      function createPlayer(idx) {
        const initDeck = shuffle([
          ...Array(7).fill('copper'),
          ...Array(3).fill('estate')
        ]);
        const p = {
          idx,
          name: PLAYER_THEMES[idx].name,
          css: PLAYER_THEMES[idx].css,
          isCpu: vsCpu && idx !== mySeat,
          deck: initDeck,
          hand: [],
          discard: [],
          playArea: [],
          turnsTaken: 0
        };
        drawCards(p, 5);
        return p;
      }

      function drawCards(p, count) {
        for (let i = 0; i < count; i++) {
          if (p.deck.length === 0) {
            if (p.discard.length === 0) break;
            p.deck = shuffle(p.discard);
            p.discard = [];
          }
          p.hand.push(p.deck.pop());
        }
      }

      function getAllPlayerCards(p) {
        return [...p.deck, ...p.hand, ...p.discard, ...p.playArea];
      }

      function calcPlayerVP(p) {
        const all = getAllPlayerCards(p);
        const gardensBonus = Math.floor(all.length / 10);
        let vp = 0;
        all.forEach((cid) => {
          if (cid === 'gardens') {
            vp += gardensBonus;
          } else if (CARD_DB[cid]) {
            vp += CARD_DB[cid].vp || 0;
          }
        });
        return vp;
      }

      function isGameOverConditionMet() {
        if ((supply.province || 0) <= 0) return true;
        let emptyPiles = 0;
        Object.values(supply).forEach((cnt) => {
          if (cnt <= 0) emptyPiles++;
        });
        return emptyPiles >= 3;
      }

      // ====================================================
      // 2. ゲーム初期化＆ターン進行
      // ====================================================
      function initGame() {
        if (cpuTimer) clearTimeout(cpuTimer);
        playerCount = parseInt(pcountSelEl.value, 10) || 2;
        const presetVal = presetSelEl.value;
        if (presetVal === 'random') {
          kingdomKeys = shuffle(ALL_KINGDOM_KEYS).slice(0, 10);
        } else {
          kingdomKeys = (KINGDOM_PRESETS[presetVal] || KINGDOM_PRESETS.first_game).cards.slice();
        }
        // コスト昇順にソート
        kingdomKeys.sort((a, b) => CARD_DB[a].cost - CARD_DB[b].cost);

        const victoryCount = playerCount === 2 ? 8 : 12;
        const curseCount = (playerCount - 1) * 10;

        supply = {
          copper: 60 - playerCount * 7,
          silver: 40,
          gold: 30,
          estate: victoryCount,
          duchy: victoryCount,
          province: victoryCount,
          curse: curseCount
        };

        kingdomKeys.forEach((k) => {
          supply[k] = CARD_DB[k].type === 'victory' ? victoryCount : 10;
        });

        trashPile = [];
        players = [];
        for (let i = 0; i < playerCount; i++) {
          players.push(createPlayer(i));
        }

        turnIndex = 0;
        startPlayerTurn(0);
      }

      function startPlayerTurn(pIdx) {
        turnIndex = pIdx;
        const p = players[pIdx];
        p.turnsTaken++;
        actionsLeft = 1;
        buysLeft = 1;
        coinsPool = 0;
        pendingGain = null;
        closeModal();

        const hasActionCard = p.hand.some((cid) => CARD_DB[cid].type.startsWith('action'));
        turnPhase = hasActionCard ? 'ACTION' : 'BUY';

        logBannerText = `👑 ${p.name} の手番！${hasActionCard ? 'アクションカードをプレイするか、財宝をプレイして購入しましょう。' : '財宝カードをプレイしてサプライからカードを購入しましょう。'}`;
        renderAll();

        if (p.isCpu) {
          cpuTimer = setTimeout(runCpuTurn, 700);
        }
      }

      // 手札のカードをクリックしてプレイ
      function playHandCardAt(p, handIdx) {
        const cid = p.hand[handIdx];
        const card = CARD_DB[cid];
        if (!card) return;

        // 財宝カードプレイ（ACTIONフェーズ中にクリックした場合は自動的にBUYフェーズへ移行してプレイ）
        if (card.type === 'treasure') {
          turnPhase = 'BUY';
          p.hand.splice(handIdx, 1);
          p.playArea.push(cid);
          coinsPool += card.coins || 0;
          DomSfx.coin();
          logBannerText = `🪙 ${p.name} が【${card.name}】をプレイ（現在 ${coinsPool} コイン）`;
          renderAll();
          return;
        }

        // アクションカードプレイ
        if (card.type.startsWith('action')) {
          if (turnPhase !== 'ACTION' || actionsLeft <= 0) return;
          actionsLeft--;
          p.hand.splice(handIdx, 1);
          p.playArea.push(cid);
          DomSfx.cardPlay();

          if (card.plusCards) drawCards(p, card.plusCards);
          if (card.plusActions) actionsLeft += card.plusActions;
          if (card.plusBuys) buysLeft += card.plusBuys;
          if (card.plusCoins) coinsPool += card.plusCoins;

          logBannerText = `⚡ ${p.name} が【${card.name}】を発動！（${card.desc}）`;

          // 個別特殊効果の解決
          resolveSpecialAction(p, cid);
        }
      }

      function playAllTreasures(p) {
        turnPhase = 'BUY';
        let added = 0;
        for (let i = p.hand.length - 1; i >= 0; i--) {
          const cid = p.hand[i];
          if (CARD_DB[cid] && CARD_DB[cid].type === 'treasure') {
            p.hand.splice(i, 1);
            p.playArea.push(cid);
            added += CARD_DB[cid].coins || 0;
          }
        }
        if (added > 0) {
          coinsPool += added;
          DomSfx.coin();
          logBannerText = `🪙 手札の財宝を一括プレイしました！（合計 ${coinsPool} コイン / 残り購入 ${buysLeft}回）`;
        }
        renderAll();
      }

      function resolveSpecialAction(p, cid) {
        if (cid === 'cellar') {
          if (p.isCpu) {
            // CPUは手札の屋敷・呪いをすべて捨てて引き直す
            let discarded = 0;
            for (let i = p.hand.length - 1; i >= 0; i--) {
              if (p.hand[i] === 'estate' || p.hand[i] === 'curse') {
                p.discard.push(p.hand.splice(i, 1)[0]);
                discarded++;
              }
            }
            if (discarded > 0) drawCards(p, discarded);
            renderAll();
          } else if (p.hand.length > 0) {
            openCellarModal(p);
          } else {
            renderAll();
          }
          return;
        }

        if (cid === 'chapel') {
          if (p.isCpu) {
            let trashed = 0;
            for (let i = p.hand.length - 1; i >= 0 && trashed < 4; i--) {
              if (p.hand[i] === 'curse' || p.hand[i] === 'estate') {
                trashPile.push(p.hand.splice(i, 1)[0]);
                trashed++;
              }
            }
            renderAll();
          } else if (p.hand.length > 0) {
            openChapelModal(p);
          } else {
            renderAll();
          }
          return;
        }

        if (cid === 'workshop') {
          if (p.isCpu) {
            cpuGainCardUpTo(p, 4, 'discard', null);
            renderAll();
          } else {
            pendingGain = { mode: 'GAIN_UP_TO', maxCost: 4, dest: 'discard', filterType: null, title: '🛠️ 工房：サプライのコスト4以下の光っているカードをクリックして獲得' };
            logBannerText = pendingGain.title;
            renderAll();
          }
          return;
        }

        if (cid === 'moneylender') {
          const copIdx = p.hand.indexOf('copper');
          if (copIdx >= 0) {
            trashPile.push(p.hand.splice(copIdx, 1)[0]);
            coinsPool += 3;
            DomSfx.coin();
            logBannerText = `💰 ${p.name} が【金貸し】で銅貨1枚を廃棄し、+3コインを得ました！`;
          }
          renderAll();
          return;
        }

        if (cid === 'remodel') {
          if (p.hand.length === 0) {
            renderAll();
            return;
          }
          if (p.isCpu) {
            const targetIdx = p.hand.findIndex((c) => c === 'estate' || c === 'copper');
            const idx = targetIdx >= 0 ? targetIdx : 0;
            const trashedCid = p.hand.splice(idx, 1)[0];
            trashPile.push(trashedCid);
            cpuGainCardUpTo(p, CARD_DB[trashedCid].cost + 2, 'discard', null);
            renderAll();
          } else {
            openRemodelModal(p);
          }
          return;
        }

        if (cid === 'mine') {
          const hasTreasure = p.hand.some((c) => CARD_DB[c].type === 'treasure');
          if (!hasTreasure) {
            renderAll();
            return;
          }
          if (p.isCpu) {
            const copIdx = p.hand.indexOf('copper');
            const silIdx = p.hand.indexOf('silver');
            if (silIdx >= 0 && supply.gold > 0) {
              trashPile.push(p.hand.splice(silIdx, 1)[0]);
              supply.gold--;
              p.hand.push('gold');
            } else if (copIdx >= 0 && supply.silver > 0) {
              trashPile.push(p.hand.splice(copIdx, 1)[0]);
              supply.silver--;
              p.hand.push('silver');
            }
            renderAll();
          } else {
            openMineModal(p);
          }
          return;
        }

        if (cid === 'militia') {
          DomSfx.attack();
          const affected = [];
          players.forEach((other) => {
            if (other.idx === p.idx) return;
            if (other.hand.includes('moat')) {
              affected.push(`${other.name}:🛡️堀で防御`);
              return;
            }
            while (other.hand.length > 3) {
              // 勝利点・呪い・低コストから優先的に捨てる
              other.hand.sort((a, b) => {
                const va = CARD_DB[a].type === 'victory' || a === 'curse' ? -10 : CARD_DB[a].cost;
                const vb = CARD_DB[b].type === 'victory' || b === 'curse' ? -10 : CARD_DB[b].cost;
                return va - vb;
              });
              other.discard.push(other.hand.shift());
            }
            affected.push(`${other.name}:手札3枚へ`);
          });
          logBannerText = `⚔️ ${p.name} の【民兵】アタック！（${affected.join(' / ')}）`;
          renderAll();
          return;
        }

        if (cid === 'witch') {
          DomSfx.attack();
          const cursedLog = [];
          players.forEach((other) => {
            if (other.idx === p.idx) return;
            if (other.hand.includes('moat')) {
              cursedLog.push(`${other.name}:🛡️堀で防御`);
              return;
            }
            if (supply.curse > 0) {
              supply.curse--;
              other.discard.push('curse');
              cursedLog.push(`${other.name}:💀呪い獲得`);
            }
          });
          logBannerText = `🧙‍♀️ ${p.name} の【魔女】アタック！（${cursedLog.join(' / ')}）`;
          renderAll();
          return;
        }

        renderAll();
      }

      // サプライ山札クリック時の処理（通常購入 または 工房・改築・鉱山での無料獲得）
      function handleSupplyPileClick(cardId) {
        const p = players[turnIndex];
        if (!p || p.isCpu || turnPhase === 'GAME_OVER') return;
        if ((supply[cardId] || 0) <= 0) return;

        const card = CARD_DB[cardId];

        // 1. 特殊獲得モード中（工房・改築・鉱山）
        if (pendingGain) {
          if (card.cost > pendingGain.maxCost) return;
          if (pendingGain.filterType && card.type !== pendingGain.filterType) return;

          supply[cardId]--;
          if (pendingGain.dest === 'hand') {
            p.hand.push(cardId);
          } else {
            p.discard.push(cardId);
          }
          pendingGain = null;
          DomSfx.buy();
          logBannerText = `✨ ${p.name} が効果で【${card.name}】を獲得しました！`;
          renderAll();
          return;
        }

        // 2. 通常購入（ACTIONフェーズ中でも手札の財宝を自動計算して購入可能なら即財宝プレイ＋購入可能！）
        if (buysLeft <= 0) return;

        // もしACTIONフェーズ中でコインが足りない場合、手札の財宝を自動合算して足りるなら自動プレイ
        if (coinsPool < card.cost) {
          const handTreasureCoins = p.hand.reduce((s, cid) => s + (CARD_DB[cid].type === 'treasure' ? CARD_DB[cid].coins : 0), 0);
          if (coinsPool + handTreasureCoins >= card.cost) {
            playAllTreasures(p);
          }
        }

        if (coinsPool < card.cost) return;
        turnPhase = 'BUY';
        buysLeft--;
        coinsPool -= card.cost;
        supply[cardId]--;
        p.discard.push(cardId);
        DomSfx.buy();
        logBannerText = `🛒 ${p.name} が【${card.name}】を購入しました！（残り ${coinsPool}コイン / 残り購入 ${buysLeft}回）`;

        if (isGameOverConditionMet()) {
          finishGame();
          return;
        }

        if (buysLeft <= 0) {
          setTimeout(() => endCleanUpTurn(), 400);
        } else {
          renderAll();
        }
      }

      // クリーンアップ＆次の手番へ
      function endCleanUpTurn() {
        if (turnPhase === 'GAME_OVER') return;
        const p = players[turnIndex];
        pendingGain = null;
        closeModal();

        // 場と手札をすべて捨て札へ送り、5枚引く
        p.discard.push(...p.playArea, ...p.hand);
        p.playArea = [];
        p.hand = [];
        drawCards(p, 5);

        if (isGameOverConditionMet()) {
          finishGame();
          return;
        }

        const nextIdx = (turnIndex + 1) % playerCount;
        startPlayerTurn(nextIdx);
      }

      function finishGame() {
        turnPhase = 'GAME_OVER';
        DomSfx.victory();
        openGameOverModal();
        renderAll();
      }

      // ====================================================
      // 3. 地下貯蔵庫・礼拝堂・改築・鉱山モーダル ＆ 勝敗モーダル
      // ====================================================
      function closeModal() {
        modalOverlayEl.classList.remove('visible');
      }

      function openCellarModal(p) {
        const selectedIdxSet = new Set();
        function renderCellar() {
          const chips = p.hand.map((cid, idx) => {
            const c = CARD_DB[cid];
            const sel = selectedIdxSet.has(idx);
            return `<button class="dom-btn" data-idx="${idx}" style="background:${sel ? '#10b981' : c.colorCss};border:2px solid ${sel ? '#fef08a' : '#94a3b8'};">
              ${c.icon} ${c.name} ${sel ? '✔捨てる' : ''}
            </button>`;
          }).join('');

          modalBoxEl.innerHTML = `
            <div style="font-size:18px;font-weight:900;color:#fef08a;margin-bottom:8px;">🍷 地下貯蔵庫：捨てて引き直すカードを選択</div>
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:14px;">選択した枚数（現在 ${selectedIdxSet.size} 枚）を捨て札にし、同じ枚数を山札から引きます。</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;">${chips}</div>
            <button class="dom-btn dom-btn-emerald" id="dom-cellar-ok">✅ ${selectedIdxSet.size}枚を捨てて引き直す</button>
          `;
          modalBoxEl.querySelectorAll('[data-idx]').forEach((b) => {
            b.onclick = () => {
              const i = parseInt(b.getAttribute('data-idx'), 10);
              if (selectedIdxSet.has(i)) selectedIdxSet.delete(i);
              else selectedIdxSet.add(i);
              renderCellar();
            };
          });
          modalBoxEl.querySelector('#dom-cellar-ok').onclick = () => {
            const indices = Array.from(selectedIdxSet).sort((a, b) => b - a);
            indices.forEach((i) => {
              p.discard.push(p.hand.splice(i, 1)[0]);
            });
            if (indices.length > 0) drawCards(p, indices.length);
            closeModal();
            renderAll();
          };
        }
        renderCellar();
        modalOverlayEl.classList.add('visible');
      }

      function openChapelModal(p) {
        const selectedIdxSet = new Set();
        function renderChapel() {
          const chips = p.hand.map((cid, idx) => {
            const c = CARD_DB[cid];
            const sel = selectedIdxSet.has(idx);
            return `<button class="dom-btn" data-idx="${idx}" style="background:${sel ? '#e11d48' : c.colorCss};border:2px solid ${sel ? '#fef08a' : '#94a3b8'};">
              ${c.icon} ${c.name} ${sel ? '🔥廃棄' : ''}
            </button>`;
          }).join('');

          modalBoxEl.innerHTML = `
            <div style="font-size:18px;font-weight:900;color:#fef08a;margin-bottom:8px;">⛪ 礼拝堂：廃棄（デッキ圧縮）するカードを最大4枚選択</div>
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:14px;">現在 ${selectedIdxSet.size} / 4 枚選択中（屋敷や銅貨・呪いを廃棄するとデッキが高回転になります）</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;">${chips}</div>
            <button class="dom-btn dom-btn-gold" id="dom-chapel-ok">🔥 選択した ${selectedIdxSet.size} 枚を廃棄する</button>
          `;
          modalBoxEl.querySelectorAll('[data-idx]').forEach((b) => {
            b.onclick = () => {
              const i = parseInt(b.getAttribute('data-idx'), 10);
              if (selectedIdxSet.has(i)) selectedIdxSet.delete(i);
              else if (selectedIdxSet.size < 4) selectedIdxSet.add(i);
              renderChapel();
            };
          });
          modalBoxEl.querySelector('#dom-chapel-ok').onclick = () => {
            const indices = Array.from(selectedIdxSet).sort((a, b) => b - a);
            indices.forEach((i) => {
              trashPile.push(p.hand.splice(i, 1)[0]);
            });
            closeModal();
            renderAll();
          };
        }
        renderChapel();
        modalOverlayEl.classList.add('visible');
      }

      function openRemodelModal(p) {
        const chips = p.hand.map((cid, idx) => {
          const c = CARD_DB[cid];
          return `<button class="dom-btn" data-ridx="${idx}" style="background:${c.colorCss};">
            ${c.icon} ${c.name} (コスト${c.cost} ➔ コスト${c.cost + 2}以下を獲得)
          </button>`;
        }).join('');
        modalBoxEl.innerHTML = `
          <div style="font-size:18px;font-weight:900;color:#fef08a;margin-bottom:10px;">♻️ 改築：廃棄する手札を1枚選択してください</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">${chips}</div>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelectorAll('[data-ridx]').forEach((b) => {
          b.onclick = () => {
            const idx = parseInt(b.getAttribute('data-ridx'), 10);
            const trashedCid = p.hand.splice(idx, 1)[0];
            trashPile.push(trashedCid);
            const maxCost = CARD_DB[trashedCid].cost + 2;
            closeModal();
            pendingGain = {
              mode: 'GAIN_UP_TO',
              maxCost,
              dest: 'discard',
              filterType: null,
              title: `♻️ 改築：サプライのコスト ${maxCost} 以下の光っているカードをクリックして獲得`
            };
            logBannerText = pendingGain.title;
            renderAll();
          };
        });
      }

      function openMineModal(p) {
        const treasures = p.hand.map((cid, idx) => ({ cid, idx })).filter((x) => CARD_DB[x.cid].type === 'treasure');
        const chips = treasures.map((x) => {
          const c = CARD_DB[x.cid];
          return `<button class="dom-btn" data-midx="${x.idx}" style="background:${c.colorCss};">
            ${c.icon} ${c.name} を廃棄 ➔ コスト${c.cost + 3}以下の財宝を手札へ獲得
          </button>`;
        }).join('');
        modalBoxEl.innerHTML = `
          <div style="font-size:18px;font-weight:900;color:#fef08a;margin-bottom:10px;">⛏️ 鉱山：アップグレードする財宝を選択</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">${chips}</div>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelectorAll('[data-midx]').forEach((b) => {
          b.onclick = () => {
            const idx = parseInt(b.getAttribute('data-midx'), 10);
            const trashedCid = p.hand.splice(idx, 1)[0];
            trashPile.push(trashedCid);
            const maxCost = CARD_DB[trashedCid].cost + 3;
            closeModal();
            pendingGain = {
              mode: 'GAIN_UP_TO',
              maxCost,
              dest: 'hand',
              filterType: 'treasure',
              title: `⛏️ 鉱山：コスト ${maxCost} 以下の財宝カード（銀貨・金貨）をクリックして手札に獲得`
            };
            logBannerText = pendingGain.title;
            renderAll();
          };
        });
      }

      function openGameOverModal() {
        const ranked = players.slice().sort((a, b) => {
          const vpa = calcPlayerVP(a);
          const vpb = calcPlayerVP(b);
          if (vpb !== vpa) return vpb - vpa;
          return a.turnsTaken - b.turnsTaken;
        });
        const winner = ranked[0];
        const rows = ranked.map((p, i) => `
          <div style="display:flex;justify-content:space-between;padding:8px 12px;margin-bottom:6px;background:rgba(255,255,255,0.07);border-radius:8px;border-left:4px solid ${p.css};">
            <span><b>${i + 1}位: ${p.name}</b></span>
            <span>👑 <b>${calcPlayerVP(p)} VP</b> （総デッキ:${getAllPlayerCards(p).length}枚 / 手番:${p.turnsTaken}回）</span>
          </div>
        `).join('');

        modalBoxEl.innerHTML = `
          <div style="font-size:22px;font-weight:900;color:#fef08a;margin-bottom:10px;">🏆 ゲーム終了！勝者: ${winner.name}</div>
          <div style="margin-bottom:16px;text-align:left;">${rows}</div>
          <button class="dom-btn dom-btn-gold" id="dom-rematch-btn">🔄 もう一度プレイする</button>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#dom-rematch-btn').onclick = () => initGame();
      }

      // ====================================================
      // 4. 賢いCPU思考エンジン（アクション連鎖 ＋ ビッグマネー＆属州戦略）
      // ====================================================
      function cpuGainCardUpTo(cpu, maxCost, dest, filterType) {
        const avail = Object.keys(supply).filter((cid) => {
          if (supply[cid] <= 0 || cid === 'curse') return false;
          const c = CARD_DB[cid];
          if (c.cost > maxCost) return false;
          if (filterType && c.type !== filterType) return false;
          return true;
        });
        if (avail.length === 0) return;
        avail.sort((a, b) => CARD_DB[b].cost - CARD_DB[a].cost);
        const pick = avail[0];
        supply[pick]--;
        if (dest === 'hand') cpu.hand.push(pick);
        else cpu.discard.push(pick);
      }

      function runCpuTurn() {
        if (isDestroyed || turnPhase === 'GAME_OVER') return;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu) return;

        // 1. アクションカード（+アクション系を最優先）を順次プレイ
        while (actionsLeft > 0) {
          const actIndices = cpu.hand
            .map((cid, idx) => ({ cid, idx, card: CARD_DB[cid] }))
            .filter((x) => x.card.type.startsWith('action'));
          if (actIndices.length === 0) break;
          actIndices.sort((a, b) => (b.card.plusActions || 0) - (a.card.plusActions || 0));
          playHandCardAt(cpu, actIndices[0].idx);
        }

        // 2. 財宝全プレイ
        playAllTreasures(cpu);

        // 3. 最適カードの購入
        while (buysLeft > 0) {
          let buyTarget = null;
          if (coinsPool >= 8 && supply.province > 0) {
            buyTarget = 'province';
          } else if (coinsPool >= 6 && supply.gold > 0) {
            buyTarget = 'gold';
          } else if (coinsPool >= 5) {
            const lv5 = ['witch', 'market', 'laboratory', 'festival', 'mine'].filter((k) => supply[k] > 0);
            if (supply.province <= 4 && supply.duchy > 0) buyTarget = 'duchy';
            else if (lv5.length > 0) buyTarget = lv5[Math.floor(Math.random() * lv5.length)];
            else if (supply.duchy > 0) buyTarget = 'duchy';
          } else if (coinsPool >= 4) {
            const lv4 = ['smithy', 'militia', 'moneylender', 'gardens'].filter((k) => supply[k] > 0);
            if (lv4.length > 0 && Math.random() < 0.65) buyTarget = lv4[Math.floor(Math.random() * lv4.length)];
            else if (supply.silver > 0) buyTarget = 'silver';
          } else if (coinsPool >= 3) {
            const lv3 = ['village', 'workshop', 'woodcutter'].filter((k) => supply[k] > 0);
            if (supply.silver > 0 && Math.random() < 0.7) buyTarget = 'silver';
            else if (lv3.length > 0) buyTarget = lv3[Math.floor(Math.random() * lv3.length)];
          } else if (coinsPool >= 2 && supply.province <= 3 && supply.estate > 0) {
            buyTarget = 'estate';
          }

          if (!buyTarget) break;
          buysLeft--;
          coinsPool -= CARD_DB[buyTarget].cost;
          supply[buyTarget]--;
          cpu.discard.push(buyTarget);
          DomSfx.buy();
          logBannerText = `🛒 ${cpu.name} が【${CARD_DB[buyTarget].name}】を購入しました！`;
          if (isGameOverConditionMet()) {
            finishGame();
            return;
          }
        }

        setTimeout(() => {
          if (!isDestroyed && turnPhase !== 'GAME_OVER') {
            endCleanUpTurn();
          }
        }, 650);
      }

      // ====================================================
      // 5. Three.js + Godot 4.7 GLB フル3Dカードテーブル描画
      // ====================================================
      let THREE = null;
      let scene = null;
      let camera = null;
      let renderer = null;
      let tableGroup = null;
      let interactiveObjects = [];
      let maxAniso = 8;
      let glbCrown = null;

      let camSpherical = { radius: 19.6, phi: 0.72, theta: 0 };

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
        const h = stageWrapEl.clientHeight || 560;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 200);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stageWrapEl.appendChild(renderer.domElement);

        maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;

        scene.add(new THREE.AmbientLight(0xf1f5f9, 0.92));
        const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
        keyLight.position.set(8, 18, 10);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        scene.add(keyLight);

        // 王室ベルベットテーブルベース
        const baseBoard = new THREE.Mesh(
          new THREE.BoxGeometry(19.2, 0.4, 13.6),
          new THREE.MeshStandardMaterial({ color: 0x3b1d0e, roughness: 0.35, metalness: 0.15 })
        );
        baseBoard.position.y = -0.22;
        baseBoard.receiveShadow = true;
        scene.add(baseBoard);

        const feltBoard = new THREE.Mesh(
          new THREE.BoxGeometry(18.4, 0.12, 12.8),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.08 })
        );
        feltBoard.position.y = -0.04;
        feltBoard.receiveShadow = true;
        scene.add(feltBoard);

        tableGroup = new THREE.Group();
        scene.add(tableGroup);

        if (window.THREE.GLTFLoader && window.location.protocol !== 'file:') {
          const loader = new window.THREE.GLTFLoader();
          loader.load('assets/models/dominion_crown.glb', (gltf) => {
            if (gltf && gltf.scene) {
              glbCrown = gltf.scene;
              rebuild3DScene();
            }
          }, undefined, () => {});
        }

        // カメラ＆3Dクリック
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
            camSpherical.phi = Math.max(0.24, Math.min(1.26, camSpherical.phi - dy * 0.0065));
            updateCamera();
          }
        });

        window.addEventListener('pointerup', () => {
          isDragging = false;
        });

        dom.addEventListener('click', (e) => {
          if (dragDist > 7) return;
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
          camSpherical.radius = Math.max(11.5, Math.min(27.0, camSpherical.radius + e.deltaY * 0.01));
          updateCamera();
        }, { passive: false });

        camResetBtn.onclick = () => {
          camSpherical = { radius: 19.6, phi: 0.72, theta: 0 };
          updateCamera();
        };

        window.addEventListener('resize', onResize);
        updateCamera();
        rebuild3DScene();

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
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          0.5 + radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(0, 0, 0.4);
      }

      function onResize() {
        if (isDestroyed || !renderer || !camera) return;
        const w = stageWrapEl.clientWidth || 960;
        const h = stageWrapEl.clientHeight || 560;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }

      // 3Dサプライ・手札カードメッシュ生成 (高解像度 512x700 CanvasTexture)
      function createDominionCard3D(cardId, remainCount, isHighlighted, isHandCard) {
        const card = CARD_DB[cardId];
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 700;
        const ctx = c.getContext('2d');

        // 背景
        ctx.fillStyle = remainCount === 0 ? '#1e293b' : card.colorCss;
        ctx.fillRect(0, 0, 512, 700);

        // ヘッダー帯
        ctx.fillStyle = remainCount === 0 ? '#475569' : card.headerCss;
        ctx.fillRect(16, 16, 480, 108);

        // 外枠
        ctx.strokeStyle = isHighlighted ? '#10b981' : '#e2e8f0';
        ctx.lineWidth = isHighlighted ? 22 : 12;
        ctx.strokeRect(10, 10, 492, 680);

        // カード名
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 58px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.name, 256, 72);

        // 中央巨大アイコン
        ctx.font = '150px "Noto Sans JP", sans-serif';
        ctx.fillText(remainCount === 0 ? '❌' : card.icon, 256, 265);

        // 効果説明ボックス
        ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
        ctx.fillRect(28, 375, 456, 175);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 4;
        ctx.strokeRect(28, 375, 456, 175);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '900 34px "Noto Sans JP", sans-serif';
        const parts = card.desc.split(' / ');
        parts.forEach((line, idx) => {
          ctx.fillText(line, 256, 435 + idx * 54);
        });

        // 左下：金貨コストサークル
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(82, 622, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#fef08a';
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 64px "Noto Sans JP", sans-serif';
        ctx.fillText(String(card.cost), 82, 625);

        // 右下：残り枚数バッジ（サプライの場合）または種別ラベル（手札の場合）
        if (!isHandCard) {
          ctx.fillStyle = remainCount === 0 ? '#ef4444' : '#0f172a';
          ctx.fillRect(275, 578, 210, 86);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 4;
          ctx.strokeRect(275, 578, 210, 86);

          ctx.fillStyle = remainCount === 0 ? '#ffffff' : '#fef08a';
          ctx.font = '900 44px "Noto Sans JP", sans-serif';
          ctx.fillText(`残 ${remainCount}`, 380, 624);
        }

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = maxAniso;

        const group = new THREE.Group();
        const stackH = isHandCard ? 0.08 : Math.max(0.06, Math.min(0.42, remainCount * 0.018));
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.78, stackH, 2.42),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.26, metalness: 0.08 })
        );
        mesh.position.y = stackH / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        if (isHighlighted && remainCount > 0) {
          const glow = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 0.05, 2.54),
            new THREE.MeshBasicMaterial({ color: 0x10b981 })
          );
          glow.position.y = 0.02;
          group.add(glow);
        }

        return group;
      }

      function rebuild3DScene() {
        if (!THREE || !tableGroup) return;
        while (tableGroup.children.length > 0) {
          tableGroup.remove(tableGroup.children[0]);
        }
        interactiveObjects = [];

        const activeP = players[turnIndex];
        const isMyTurn = activeP && !activeP.isCpu && turnPhase !== 'GAME_OVER';
        const potentialCoins = activeP
          ? coinsPool + (turnPhase === 'ACTION' ? activeP.hand.reduce((s, cid) => s + (CARD_DB[cid].type === 'treasure' ? CARD_DB[cid].coins : 0), 0) : 0)
          : 0;

        function canSelectSupplyCard(cid) {
          if (!isMyTurn || (supply[cid] || 0) <= 0) return false;
          const c = CARD_DB[cid];
          if (pendingGain) {
            if (c.cost > pendingGain.maxCost) return false;
            if (pendingGain.filterType && c.type !== pendingGain.filterType) return false;
            return true;
          }
          if (cid === 'curse') return false;
          return buysLeft > 0 && potentialCoins >= c.cost;
        }

        // 1. 最上段：基本サプライ7山 (Z = -4.55)
        BASE_KEYS.forEach((cid, idx) => {
          const cnt = supply[cid] || 0;
          const hi = canSelectSupplyCard(cid);
          const pile = createDominionCard3D(cid, cnt, hi, false);
          pile.position.set(-6.9 + idx * 2.3, 0, -4.55);
          pile.userData = { onClick: () => handleSupplyPileClick(cid) };
          tableGroup.add(pile);
          interactiveObjects.push(pile);
        });

        // 2. 中段2列：王国サプライ10山 (上列5山: Z = -1.75 / 下列5山: Z = 1.05)
        kingdomKeys.forEach((cid, idx) => {
          const row = Math.floor(idx / 5);
          const col = idx % 5;
          const cnt = supply[cid] || 0;
          const hi = canSelectSupplyCard(cid);
          const pile = createDominionCard3D(cid, cnt, hi, false);
          pile.position.set(-4.8 + col * 2.4, 0, -1.75 + row * 2.8);
          pile.userData = { onClick: () => handleSupplyPileClick(cid) };
          tableGroup.add(pile);
          interactiveObjects.push(pile);
        });

        // 3. 左端に王冠モデル（Godot 4.7 GLB）
        if (glbCrown) {
          const cr = glbCrown.clone(true);
          cr.position.set(-7.6, 0.05, 0.2);
          cr.scale.set(1.3, 1.3, 1.3);
          tableGroup.add(cr);
        }

        // 4. 手前列：自分の3D手札カード一覧 (Z = 4.25)
        const me = players[mySeat] || players[0];
        if (me && me.hand.length > 0) {
          const spacing = Math.min(2.05, 13.5 / Math.max(1, me.hand.length));
          const startX = -((me.hand.length - 1) * spacing) / 2;
          me.hand.forEach((cid, hIdx) => {
            const c = CARD_DB[cid];
            const playable = isMyTurn && !pendingGain && (
              c.type === 'treasure' ||
              (c.type.startsWith('action') && turnPhase === 'ACTION' && actionsLeft > 0)
            );
            const cardObj = createDominionCard3D(cid, 1, playable, true);
            cardObj.position.set(startX + hIdx * spacing, 0.14, 4.25);
            cardObj.rotation.x = -0.18;
            if (playable) {
              cardObj.userData = { onClick: () => playHandCardAt(me, hIdx) };
              interactiveObjects.push(cardObj);
            }
            tableGroup.add(cardObj);
          });
        }
      }

      // ====================================================
      // 6. UIレンダリング
      // ====================================================
      function renderAll() {
        // 1. プレイヤー一覧
        playersRowEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && turnPhase !== 'GAME_OVER';
          const vp = calcPlayerVP(p);
          return `
            <div class="dom-pcard ${isTurn ? 'active-turn' : ''}">
              <span style="font-weight:900;color:${p.css};">${isTurn ? '▶ ' : ''}${p.name}</span>
              <span class="dom-vp-badge">👑 ${vp} VP</span>
              <span style="color:#cbd5e1;">山札:${p.deck.length} / 手札:${p.hand.length} / 捨札:${p.discard.length}</span>
            </div>
          `;
        }).join('');

        // 2. A-B-C カウンター＆バナー
        bannerEl.textContent = logBannerText;
        statActEl.textContent = `⚡ アクション: ${actionsLeft}`;
        statBuyEl.textContent = `🛒 購入: ${buysLeft}`;
        statCoinEl.textContent = `🪙 コイン: ${coinsPool}`;

        // 3. 下部手札チップ＆アクションボタン
        const me = players[mySeat] || players[0];
        const activeP = players[turnIndex];
        const isMyTurn = activeP && !activeP.isCpu && turnPhase !== 'GAME_OVER';

        if (me) {
          handStripEl.innerHTML = `<span style="font-size:12px;font-weight:900;color:#94a3b8;">✋ 手札(${me.hand.length}枚):</span>` +
            me.hand.map((cid, idx) => {
              const c = CARD_DB[cid];
              return `<div class="dom-hand-chip" data-hidx="${idx}" style="background:${c.colorCss};" title="${c.desc}">
                ${c.icon} ${c.name}
              </div>`;
            }).join('');

          if (isMyTurn && !pendingGain) {
            handStripEl.querySelectorAll('[data-hidx]').forEach((el) => {
              el.onclick = () => {
                const idx = parseInt(el.getAttribute('data-hidx'), 10);
                playHandCardAt(me, idx);
              };
            });
          }
        }

        if (!isMyTurn) {
          actionBtnsEl.innerHTML = `<span style="font-size:12px;color:#94a3b8;">⏳ 相手の手番中...</span>`;
        } else if (pendingGain) {
          actionBtnsEl.innerHTML = `<span style="font-size:12px;font-weight:900;color:#34d399;">👆 盤上の緑枠で光っているサプライカードをクリックして獲得してください！</span>`;
        } else {
          const hasTreasuresInHand = activeP.hand.some((cid) => CARD_DB[cid].type === 'treasure');
          actionBtnsEl.innerHTML = `
            <button class="dom-btn dom-btn-gold" id="dom-play-all-tr" ${hasTreasuresInHand ? '' : 'disabled'}>
              🪙 財宝を一括プレイ
            </button>
            <button class="dom-btn dom-btn-emerald" id="dom-end-turn-btn">
              ⏭️ ターン終了 (クリーンアップ)
            </button>
          `;
          const trBtn = actionBtnsEl.querySelector('#dom-play-all-tr');
          if (trBtn && hasTreasuresInHand) {
            trBtn.onclick = () => playAllTreasures(activeP);
          }
          actionBtnsEl.querySelector('#dom-end-turn-btn').onclick = () => endCleanUpTurn();
        }

        rebuild3DScene();
      }

      presetSelEl.onchange = () => initGame();
      pcountSelEl.onchange = () => initGame();
      newBtnEl.onclick = () => initGame();

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
