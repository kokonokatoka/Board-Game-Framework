/**
 * 🏝️ 3D カタンの開拓者たち (Die Siedler von Catan) - AAA フル3Dジオラマ＆公式完全ルール版
 * Board Arena Plugin (Godot 4.7 GLB + Three.js High-Resolution 3D WebGL)
 *
 * 🌟 AAA 特徴:
 * 1. 【公式カタン完全ルール実装 (3人/4人対戦・賢い交渉＆開拓AI・P2P対応)】
 *    - 19枚の地形ヘックス（森4・丘3・牧場4・畑4・山3・砂漠1）＋ 18枚の数字チップ（確率ドット＆6/8赤字表示）
 *    - 54箇所の交差点（頂点）と72本の辺（街道）、9箇所の貿易港（3:1一般港×4、2:1専門港×5）を完全グラフ化
 *    - スネークドラフト初期配置（1巡目順方向 → 2巡目逆順＆初期資源獲得）＋「⚡ワンクリック即開幕配置」も対応
 *    - ダイス2個による資源産出、出目「7」のバースト（8枚以上半減）＆盗賊移動＋資源強奪
 *    - 建設（街道・開拓地[距離ルール厳守]・都市化）＆ 発展カード全25枚（騎士14・VP5・街道建設2・発見2・独占2）
 *    - 港レート自動反映の海上貿易（4:1 / 3:1 / 2:1）＆ AIが損得計算して応じるプレイヤー間資源交渉！
 *    - DFS探索による「🛣️最長交易路 (5本以上・2VP)」＆「⚔️最大騎士力 (3枚以上・2VP)」自動判定、10VP先取完全勝利！
 * 2. 【Godot 4.7 GLBモデル ＋ 立体3D島ジオラマ】
 *    - 森林の針葉樹、山地の岩峰、丘陵のレンガ山、牧草地、黄金の麦畑、砂漠のピラミッドとオアシスを3D立体造形！
 *    - 建設可能な頂点・街道・盗賊移動先が3D盤面上で発光ハイライトされ、直接クリックで直感的に建設可能！
 */

(function () {
  const RES_TYPES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

  const RES_META = {
    wood:  { id: 'wood',  name: '木材', short: '木', icon: '🌲', css: '#15803d', lightCss: '#dcfce7', hex: 0x15803d, terrainName: '森林' },
    brick: { id: 'brick', name: 'レンガ', short: '土', icon: '🧱', css: '#b91c1c', lightCss: '#fee2e2', hex: 0xb91c1c, terrainName: '丘陵' },
    sheep: { id: 'sheep', name: '羊毛', short: '羊', icon: '🐑', css: '#65a30d', lightCss: '#ecfccb', hex: 0x84cc16, terrainName: '牧草地' },
    wheat: { id: 'wheat', name: '小麦', short: '麦', icon: '🌾', css: '#d97706', lightCss: '#fef3c7', hex: 0xeab308, terrainName: '畑' },
    ore:   { id: 'ore',   name: '鉱石', short: '鉄', icon: '⛰️', css: '#475569', lightCss: '#f1f5f9', hex: 0x64748b, terrainName: '山地' },
    desert:{ id: 'desert',name: '砂漠', short: '砂', icon: '🏜️', css: '#ca8a04', lightCss: '#fef9c3', hex: 0xd4a359, terrainName: '砂漠' }
  };

  const PLAYER_THEMES = [
    { name: 'あなた (赤)', css: '#ef4444', hex: 0xef4444, darkHex: 0x991b1b },
    { name: 'CPU 2 (青)', css: '#3b82f6', hex: 0x3b82f6, darkHex: 0x1d4ed8 },
    { name: 'CPU 3 (白)', css: '#f8fafc', hex: 0xf8fafc, darkHex: 0x94a3b8 },
    { name: 'CPU 4 (橙)', css: '#f97316', hex: 0xf97316, darkHex: 0xc2410c }
  ];

  // 公式タイル構成 (19枚) & 数字チップ構成 (18枚)
  const TERRAIN_POOL = [
    'wood', 'wood', 'wood', 'wood',
    'sheep', 'sheep', 'sheep', 'sheep',
    'wheat', 'wheat', 'wheat', 'wheat',
    'brick', 'brick', 'brick',
    'ore', 'ore', 'ore',
    'desert'
  ];

  const NUMBER_POOL = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

  // 公式発展カード構成 (25枚)
  const DEV_DECK_TEMPLATE = [
    ...Array(14).fill('knight'),
    ...Array(5).fill('vp'),
    ...Array(2).fill('road_building'),
    ...Array(2).fill('year_of_plenty'),
    ...Array(2).fill('monopoly')
  ];

  const DEV_CARD_META = {
    knight:         { name: '⚔️ 騎士 (Knight)', desc: '盗賊を別のタイルへ移動し、隣接プレイヤーから資源を1枚奪う（3枚で最大騎士力2VP）' },
    vp:             { name: '🏛️ 発展ポイント (+1VP)', desc: '大聖堂・図書館・市場などの建設により即座に勝利ポイント+1VP！' },
    road_building:  { name: '🛣️ 街道建設', desc: 'コストなしで自分の街道を2本まで即座に建設できる！' },
    year_of_plenty: { name: '🎁 発見 (Year of Plenty)', desc: '銀行から好きな資源カードを合計2枚すぐさま獲得できる！' },
    monopoly:       { name: '👑 独占 (Monopoly)', desc: '資源を1種類宣言し、他全員が持つその資源をすべて回収する！' }
  };

  // Web Audio サウンドエフェクト
  const CatanSfx = {
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
    dice() {
      [340, 480, 620, 780].forEach((f, i) => setTimeout(() => this.play(f, 0.07, 'triangle', 0.11), i * 45));
    },
    build() {
      [440, 554.37, 659.25, 880].forEach((f, i) => setTimeout(() => this.play(f, 0.14, 'triangle', 0.14), i * 55));
    },
    robber() {
      [210, 165, 125].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'sawtooth', 0.15), i * 80));
    },
    trade() {
      [587.33, 880].forEach((f, i) => setTimeout(() => this.play(f, 0.12, 'sine', 0.12), i * 65));
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => this.play(f, 0.24, 'triangle', 0.18), i * 85));
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
    id: 'catan',
    name: '3D カタンの開拓者たち (Catan)',
    icon: '🏝️',
    category: '👑 開拓・交渉・拡大再生産 (AAA 3D)',
    minPlayers: 3,
    maxPlayers: 4,
    description: 'サイコロで資源を産出し、街道・開拓地・都市を築き、港貿易や交渉を駆使して10勝利ポイントを目指す世界最高峰のボードゲーム！完全3Dジオラマ＆公式フルルール搭載。',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      let cpuTimer = null;

      let playerCount = 4;
      let vsCpu = !bridge.isConnected();
      let mySeat = bridge.isConnected() ? (bridge.isHost ? 0 : 1) : 0;

      // 盤面グラフデータ
      const HEX_RADIUS = 1.95;
      let hexes = [];      // 19 hexes: { id, q, r, x, z, terrain, number, hasRobber, vertexIds, edgeIds }
      let vertices = [];   // 54 vertices: { id, x, z, hexIds, neighborVertexIds, edgeIds, building: null | { owner, type: 'settlement'|'city' }, harbor: null | { ratio, res } }
      let edges = [];      // 72 edges: { id, v1, v2, x, z, angleY, roadOwner: null | playerIdx }
      let harbors = [];    // 9 harbors

      // ゲーム進行ステート
      let players = [];
      let devDeck = [];
      let turnIndex = 0;
      let setupStep = 0;       // スネークドラフト進行インデックス (0 .. playerCount*2 - 1)
      let setupSubPhase = 'SETTLEMENT'; // 'SETTLEMENT' | 'ROAD'
      let lastSetupVertexId = null;

      // phase: 'SETUP' | 'ROLL' | 'ROBBER_MOVE' | 'MAIN' | 'FREE_ROADS' | 'GAME_OVER'
      let phase = 'SETUP';
      let buildMode = null;    // null | 'road' | 'settlement' | 'city'
      let freeRoadsRemaining = 0;
      let devPlayedThisTurn = false;
      let lastDice = [3, 4];
      let longestRoadHolder = null;
      let largestArmyHolder = null;
      let statusBannerText = '🏝️ カタン島へようこそ！初期開拓地を配置するか「⚡高速初期配置」で即スタートできます。';

      // DOM構築
      container.innerHTML = `
        <style>
          .cat-wrapper {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            user-select: none;
            color: #f8fafc;
            font-family: 'Noto Sans JP', sans-serif;
          }
          .cat-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 12px;
            padding: 6px 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          }
          .cat-players-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            flex: 1;
          }
          .cat-pcard {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(30, 41, 59, 0.88);
            border: 2px solid rgba(148, 163, 184, 0.28);
            border-radius: 10px;
            padding: 5px 10px;
            font-size: 12px;
            transition: all 0.2s;
          }
          .cat-pcard.active-turn {
            border-color: #fbbf24;
            background: rgba(251, 191, 36, 0.14);
            box-shadow: 0 0 16px rgba(251, 191, 36, 0.35);
          }
          .cat-vp-pill {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #0f172a;
            font-weight: 900;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 12px;
          }
          .cat-award-badge {
            background: rgba(234, 179, 8, 0.22);
            border: 1px solid #fde047;
            color: #fef08a;
            font-size: 11px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 6px;
          }
          .cat-btn {
            background: rgba(30, 41, 59, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.42);
            color: #f8fafc;
            font-size: 12px;
            font-weight: 800;
            padding: 6px 11px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .cat-btn:hover:not(:disabled) {
            border-color: #38bdf8;
            color: #38bdf8;
            transform: translateY(-1px);
          }
          .cat-btn:disabled {
            opacity: 0.38;
            cursor: not-allowed;
          }
          .cat-btn.active-mode {
            background: linear-gradient(135deg, #0284c7, #0369a1);
            border-color: #7dd3fc;
            color: #ffffff;
            box-shadow: 0 0 14px rgba(56, 189, 248, 0.55);
          }
          .cat-btn-gold {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-color: #fef08a;
            color: #0f172a;
          }
          .cat-btn-emerald {
            background: linear-gradient(135deg, #10b981, #059669);
            border-color: #6ee7b7;
            color: #ffffff;
          }
          .cat-stage-wrap {
            position: relative;
            width: 100%;
            height: calc(100vh - 270px);
            min-height: 500px;
            max-height: 820px;
            background: radial-gradient(circle at 50% 40%, #0c4a6e 0%, #082f49 55%, #020617 100%);
            border-radius: 16px;
            border: 1px solid rgba(56, 189, 248, 0.35);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
            overflow: hidden;
          }
          .cat-stage-wrap canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            cursor: grab;
          }
          .cat-stage-wrap canvas:active {
            cursor: grabbing;
          }
          .cat-hud-overlay-top {
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
          .cat-banner {
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(251, 191, 36, 0.5);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
            color: #fef08a;
            pointer-events: auto;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
          }
          .cat-dice-box {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(56, 189, 248, 0.45);
            padding: 5px 12px;
            border-radius: 12px;
            pointer-events: auto;
            font-weight: 900;
          }
          .cat-die-face {
            width: 30px;
            height: 30px;
            border-radius: 6px;
            background: #f8fafc;
            color: #0f172a;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 900;
            box-shadow: inset 0 -2px 0 #cbd5e1;
          }
          .cat-bottom-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 12px;
            padding: 8px 14px;
          }
          .cat-res-hand {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
          }
          .cat-res-card {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 5px 11px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 900;
            border: 1px solid rgba(255,255,255,0.28);
          }
          .cat-actions-bar {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
          }
          .cat-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(9, 13, 22, 0.76);
            backdrop-filter: blur(5px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 30;
          }
          .cat-modal-overlay.visible {
            display: flex;
          }
          .cat-modal-card {
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border: 2px solid #f59e0b;
            border-radius: 16px;
            padding: 20px 24px;
            max-width: 540px;
            width: 92%;
            box-shadow: 0 24px 60px rgba(0,0,0,0.85);
            text-align: center;
          }
        </style>

        <div class="cat-wrapper">
          <div class="cat-top-bar">
            <div class="cat-players-row" id="cat-players-row"></div>
            <div style="display:flex;gap:6px;align-items:center;">
              <select id="cat-pcount-sel" class="cat-btn">
                <option value="3">👥 3人カタン</option>
                <option value="4" selected>👥 4人カタン (標準)</option>
              </select>
              <button class="cat-btn" id="cat-fast-setup-btn" title="初期配置を自動完了してダイスフェーズから即スタート">⚡ 高速初期配置</button>
              <button class="cat-btn" id="cat-new-btn">🔄 新規島生成</button>
            </div>
          </div>

          <div class="cat-stage-wrap" id="cat-stage-wrap">
            <div class="cat-hud-overlay-top">
              <div class="cat-banner" id="cat-banner">🏝️ 3D カタンの開拓者たち</div>
              <div style="display:flex;gap:8px;align-items:center;">
                <div class="cat-dice-box" id="cat-dice-box">
                  <span>🎲 出目:</span>
                  <span class="cat-die-face" id="cat-die-1">-</span>
                  <span class="cat-die-face" id="cat-die-2">-</span>
                  <span id="cat-dice-sum" style="color:#fef08a;font-size:15px;">(-)</span>
                </div>
                <button class="cat-btn" id="cat-cam-reset" style="pointer-events:auto;">🎥 視点リセット</button>
              </div>
            </div>

            <div class="cat-modal-overlay" id="cat-modal-overlay">
              <div class="cat-modal-card" id="cat-modal-card"></div>
            </div>
          </div>

          <div class="cat-bottom-dock">
            <div class="cat-res-hand" id="cat-res-hand"></div>
            <div class="cat-actions-bar" id="cat-actions-bar"></div>
          </div>
        </div>
      `;

      const playersRowEl = container.querySelector('#cat-players-row');
      const pcountSelEl = container.querySelector('#cat-pcount-sel');
      const fastSetupBtnEl = container.querySelector('#cat-fast-setup-btn');
      const newBtnEl = container.querySelector('#cat-new-btn');
      const stageWrapEl = container.querySelector('#cat-stage-wrap');
      const bannerEl = container.querySelector('#cat-banner');
      const die1El = container.querySelector('#cat-die-1');
      const die2El = container.querySelector('#cat-die-2');
      const diceSumEl = container.querySelector('#cat-dice-sum');
      const camResetBtn = container.querySelector('#cat-cam-reset');
      const modalOverlayEl = container.querySelector('#cat-modal-overlay');
      const modalCardEl = container.querySelector('#cat-modal-card');
      const resHandEl = container.querySelector('#cat-res-hand');
      const actionsBarEl = container.querySelector('#cat-actions-bar');

      // ====================================================
      // 1. カタン島19ヘックス・54頂点・72辺・9港のグラフ生成
      // ====================================================
      function buildIslandGraph() {
        hexes = [];
        vertices = [];
        edges = [];
        harbors = [];

        const terrains = shuffle(TERRAIN_POOL);
        const numbers = NUMBER_POOL.slice();
        let numIdx = 0;

        // Axial coordinates (q, r) for radius 2 hexagon
        const coords = [];
        for (let r = -2; r <= 2; r++) {
          for (let q = -2; q <= 2; q++) {
            if (Math.abs(q + r) <= 2) {
              coords.push({ q, r });
            }
          }
        }

        const vertMap = new Map();
        function getOrCreateVertex(vx, vz) {
          const key = `${Math.round(vx * 100)}_${Math.round(vz * 100)}`;
          if (vertMap.has(key)) return vertMap.get(key);
          const v = {
            id: vertices.length,
            x: vx,
            z: vz,
            hexIds: [],
            neighborVertexIds: [],
            edgeIds: [],
            building: null,
            harbor: null
          };
          vertices.push(v);
          vertMap.set(key, v);
          return v;
        }

        const edgeMap = new Map();
        function getOrCreateEdge(v1, v2) {
          const a = Math.min(v1.id, v2.id);
          const b = Math.max(v1.id, v2.id);
          const key = `${a}_${b}`;
          if (edgeMap.has(key)) return edgeMap.get(key);
          const mx = (v1.x + v2.x) / 2;
          const mz = (v1.z + v2.z) / 2;
          const angleY = Math.atan2(v2.x - v1.x, v2.z - v1.z);
          const e = {
            id: edges.length,
            v1: a,
            v2: b,
            x: mx,
            z: mz,
            angleY,
            roadOwner: null
          };
          edges.push(e);
          edgeMap.set(key, e);
          if (!v1.neighborVertexIds.includes(v2.id)) v1.neighborVertexIds.push(v2.id);
          if (!v2.neighborVertexIds.includes(v1.id)) v2.neighborVertexIds.push(v1.id);
          if (!v1.edgeIds.includes(e.id)) v1.edgeIds.push(e.id);
          if (!v2.edgeIds.includes(e.id)) v2.edgeIds.push(e.id);
          return e;
        }

        coords.forEach((c, idx) => {
          // Pointy-top hex center formula
          const cx = HEX_RADIUS * Math.sqrt(3) * (c.q + c.r / 2);
          const cz = HEX_RADIUS * 1.5 * c.r;
          const terrain = terrains[idx];
          const number = terrain === 'desert' ? null : numbers[numIdx++];

          const hVerts = [];
          for (let i = 0; i < 6; i++) {
            const ang = (Math.PI / 180) * (60 * i - 30);
            const vx = cx + HEX_RADIUS * Math.cos(ang);
            const vz = cz + HEX_RADIUS * Math.sin(ang);
            const v = getOrCreateVertex(vx, vz);
            if (!v.hexIds.includes(idx)) v.hexIds.push(idx);
            hVerts.push(v);
          }

          const hEdges = [];
          for (let i = 0; i < 6; i++) {
            const e = getOrCreateEdge(hVerts[i], hVerts[(i + 1) % 6]);
            hEdges.push(e.id);
          }

          hexes.push({
            id: idx,
            q: c.q,
            r: c.r,
            x: cx,
            z: cz,
            terrain,
            number,
            hasRobber: terrain === 'desert',
            vertexIds: hVerts.map((v) => v.id),
            edgeIds: hEdges
          });
        });

        // 外周の辺（1つのヘックスにしか属さない沿岸辺＝30本）を角度順に並べて9つの港を均等配置
        const coastalEdges = edges.filter((e) => {
          const sharedHexes = hexes.filter((h) => h.edgeIds.includes(e.id));
          return sharedHexes.length === 1;
        });
        coastalEdges.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));

        const harborTypes = shuffle([
          { ratio: 3, res: null, label: '⛵3:1港' },
          { ratio: 3, res: null, label: '⛵3:1港' },
          { ratio: 3, res: null, label: '⛵3:1港' },
          { ratio: 3, res: null, label: '⛵3:1港' },
          { ratio: 2, res: 'wood', label: '🌲2:1港' },
          { ratio: 2, res: 'brick', label: '🧱2:1港' },
          { ratio: 2, res: 'sheep', label: '🐑2:1港' },
          { ratio: 2, res: 'wheat', label: '🌾2:1港' },
          { ratio: 2, res: 'ore', label: '⛰️2:1港' }
        ]);

        for (let i = 0; i < 9; i++) {
          const ce = coastalEdges[Math.floor((i * coastalEdges.length) / 9)];
          if (!ce) continue;
          const hInfo = harborTypes[i];
          vertices[ce.v1].harbor = hInfo;
          vertices[ce.v2].harbor = hInfo;
          harbors.push({
            edgeId: ce.id,
            v1: ce.v1,
            v2: ce.v2,
            x: ce.x * 1.18,
            z: ce.z * 1.18,
            ...hInfo
          });
        }
      }

      // ====================================================
      // 2. プレイヤー＆建設・ルール検証関数
      // ====================================================
      function createPlayer(idx) {
        return {
          idx,
          name: PLAYER_THEMES[idx].name,
          css: PLAYER_THEMES[idx].css,
          hex: PLAYER_THEMES[idx].hex,
          isCpu: vsCpu && idx !== mySeat,
          res: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
          devCards: [], // { type, boughtTurn }
          knightsPlayed: 0,
          vpCardsCount: 0,
          settlementsLeft: 5,
          citiesLeft: 4,
          roadsLeft: 15
        };
      }

      function totalRes(p) {
        return RES_TYPES.reduce((s, k) => s + (p.res[k] || 0), 0);
      }

      function calcPlayerVP(p) {
        let vp = p.vpCardsCount || 0;
        vertices.forEach((v) => {
          if (v.building && v.building.owner === p.idx) {
            vp += v.building.type === 'city' ? 2 : 1;
          }
        });
        if (longestRoadHolder === p.idx) vp += 2;
        if (largestArmyHolder === p.idx) vp += 2;
        return vp;
      }

      // プレイヤーの港による各資源の銀行貿易レート (2, 3, or 4)
      function getTradeRates(p) {
        const rates = { wood: 4, brick: 4, sheep: 4, wheat: 4, ore: 4 };
        vertices.forEach((v) => {
          if (v.building && v.building.owner === p.idx && v.harbor) {
            if (v.harbor.ratio === 3) {
              RES_TYPES.forEach((k) => { rates[k] = Math.min(rates[k], 3); });
            } else if (v.harbor.ratio === 2 && v.harbor.res) {
              rates[v.harbor.res] = 2;
            }
          }
        });
        return rates;
      }

      // 距離ルール確認：その頂点および隣接頂点に建物がないか
      function passesDistanceRule(vId) {
        const v = vertices[vId];
        if (!v || v.building) return false;
        return v.neighborVertexIds.every((nid) => !vertices[nid].building);
      }

      // 開拓地を建設可能な頂点IDリスト
      function getValidSettlementVertices(pIdx, isSetupPhase) {
        return vertices
          .filter((v) => {
            if (!passesDistanceRule(v.id)) return false;
            if (isSetupPhase) return true;
            // 通常フェーズは自分の街道が接続している必要がある
            return v.edgeIds.some((eid) => edges[eid].roadOwner === pIdx);
          })
          .map((v) => v.id);
      }

      // 都市へアップグレード可能な頂点IDリスト
      function getValidCityVertices(pIdx) {
        return vertices
          .filter((v) => v.building && v.building.owner === pIdx && v.building.type === 'settlement')
          .map((v) => v.id);
      }

      // 街道を建設可能な辺IDリスト
      function getValidRoadEdges(pIdx, mustTouchVertexId = null) {
        return edges
          .filter((e) => {
            if (e.roadOwner !== null) return false;
            if (mustTouchVertexId !== null) {
              return e.v1 === mustTouchVertexId || e.v2 === mustTouchVertexId;
            }
            // v1 または v2 に自分の建物がある、または他人の建物に阻まれていない自分の道が接続している
            return [e.v1, e.v2].some((vid) => {
              const v = vertices[vid];
              if (v.building) return v.building.owner === pIdx;
              return v.edgeIds.some((otherEid) => otherEid !== e.id && edges[otherEid].roadOwner === pIdx);
            });
          })
          .map((e) => e.id);
      }

      // DFS による最長交易路の長さ計算（他プレイヤーの建物で分断される公式ルール準拠）
      function computeLongestRoadForPlayer(pIdx) {
        const myEdges = edges.filter((e) => e.roadOwner === pIdx);
        if (myEdges.length === 0) return 0;
        let maxLen = 0;

        function dfs(currVertexId, visitedEdgeIds, length) {
          if (length > maxLen) maxLen = length;
          const v = vertices[currVertexId];
          // 他プレイヤーの建物がある頂点は通過できない（始点除く）
          if (visitedEdgeIds.size > 0 && v.building && v.building.owner !== pIdx) {
            return;
          }
          v.edgeIds.forEach((eid) => {
            const e = edges[eid];
            if (e.roadOwner === pIdx && !visitedEdgeIds.has(eid)) {
              visitedEdgeIds.add(eid);
              const nextVid = e.v1 === currVertexId ? e.v2 : e.v1;
              dfs(nextVid, visitedEdgeIds, length + 1);
              visitedEdgeIds.delete(eid);
            }
          });
        }

        vertices.forEach((v) => {
          if (v.edgeIds.some((eid) => edges[eid].roadOwner === pIdx)) {
            dfs(v.id, new Set(), 0);
          }
        });
        return maxLen;
      }

      function updateAwardsAndCheckVictory() {
        // 最長交易路 (5本以上)
        let bestRoadLen = 4;
        if (longestRoadHolder !== null) {
          bestRoadLen = computeLongestRoadForPlayer(longestRoadHolder);
          if (bestRoadLen < 5) {
            longestRoadHolder = null;
            bestRoadLen = 4;
          }
        }
        players.forEach((p) => {
          const len = computeLongestRoadForPlayer(p.idx);
          if (len >= 5 && len > bestRoadLen) {
            bestRoadLen = len;
            longestRoadHolder = p.idx;
          }
        });

        // 最大騎士力 (3枚以上)
        let bestKnights = 2;
        if (largestArmyHolder !== null) {
          bestKnights = players[largestArmyHolder].knightsPlayed;
        }
        players.forEach((p) => {
          if (p.knightsPlayed >= 3 && p.knightsPlayed > bestKnights) {
            bestKnights = p.knightsPlayed;
            largestArmyHolder = p.idx;
          }
        });

        // 10VP勝利判定
        for (const p of players) {
          if (calcPlayerVP(p) >= 10 && phase !== 'GAME_OVER') {
            phase = 'GAME_OVER';
            CatanSfx.victory();
            openVictoryModal(p);
            return true;
          }
        }
        return false;
      }

      // ====================================================
      // 3. ゲーム進行（初期配置・ダイス・盗賊・建設・貿易・CPU）
      // ====================================================
      function initGame(autoSetup = false) {
        if (cpuTimer) clearTimeout(cpuTimer);
        playerCount = parseInt(pcountSelEl.value, 10) || 4;
        buildIslandGraph();

        players = [];
        for (let i = 0; i < playerCount; i++) {
          players.push(createPlayer(i));
        }

        devDeck = shuffle(DEV_DECK_TEMPLATE);
        longestRoadHolder = null;
        largestArmyHolder = null;
        lastDice = [3, 4];
        buildMode = null;
        freeRoadsRemaining = 0;
        devPlayedThisTurn = false;
        closeModal();

        if (autoSetup) {
          performFastBalancedSetup();
        } else {
          turnIndex = 0;
          setupStep = 0;
          setupSubPhase = 'SETTLEMENT';
          lastSetupVertexId = null;
          phase = 'SETUP';
          statusBannerText = '🚩 初期配置フェーズ (1巡目)：光っている交差点をクリックして最初の開拓地を配置してください。';
          renderAll();
        }
      }

      // 頂点の資源産出期待値スコア（6,8=5点, 5,9=4点, 4,10=3点, 3,11=2点, 2,12=1点）
      function evaluateVertexYield(vId) {
        const v = vertices[vId];
        if (!v) return 0;
        let score = 0;
        const types = new Set();
        v.hexIds.forEach((hid) => {
          const h = hexes[hid];
          if (h.terrain !== 'desert' && h.number) {
            const pips = 6 - Math.abs(7 - h.number);
            score += pips;
            types.add(h.terrain);
          }
        });
        score += types.size * 1.5; // 資源多様性ボーナス
        if (v.harbor) score += 1.2;
        return score;
      }

      function placeSetupSettlementAndRoadFor(pIdx, isSecondRound, vId, eId) {
        const p = players[pIdx];
        vertices[vId].building = { owner: pIdx, type: 'settlement' };
        p.settlementsLeft--;
        edges[eId].roadOwner = pIdx;
        p.roadsLeft--;

        if (isSecondRound) {
          vertices[vId].hexIds.forEach((hid) => {
            const h = hexes[hid];
            if (h.terrain !== 'desert') {
              p.res[h.terrain] = (p.res[h.terrain] || 0) + 1;
            }
          });
        }
      }

      function performFastBalancedSetup() {
        // 1巡目 (0 .. playerCount-1) + 2巡目 (playerCount-1 .. 0)
        const order = [];
        for (let i = 0; i < playerCount; i++) order.push({ pIdx: i, second: false });
        for (let i = playerCount - 1; i >= 0; i--) order.push({ pIdx: i, second: true });

        order.forEach((step) => {
          const validVerts = getValidSettlementVertices(step.pIdx, true);
          validVerts.sort((a, b) => evaluateVertexYield(b) - evaluateVertexYield(a));
          const pickVid = validVerts[0];
          const validEdges = getValidRoadEdges(step.pIdx, pickVid);
          const pickEid = validEdges[Math.floor(Math.random() * validEdges.length)];
          placeSetupSettlementAndRoadFor(step.pIdx, step.second, pickVid, pickEid);
        });

        turnIndex = 0;
        phase = 'ROLL';
        devPlayedThisTurn = false;
        CatanSfx.build();
        statusBannerText = '⚡ 初期配置が完了しました！「🎲 ダイスを振る」をクリックして開拓を開始しましょう！';
        renderAll();
      }

      function advanceSetupTurn() {
        setupStep++;
        if (setupStep >= playerCount * 2) {
          turnIndex = 0;
          phase = 'ROLL';
          devPlayedThisTurn = false;
          statusBannerText = '🎉 全員の初期配置が完了しました！あなたの手番です。「🎲 ダイスを振る」をクリックしてください！';
          renderAll();
          return;
        }
        // スネークドラフト順
        if (setupStep < playerCount) {
          turnIndex = setupStep;
        } else {
          turnIndex = playerCount * 2 - 1 - setupStep;
        }
        setupSubPhase = 'SETTLEMENT';
        lastSetupVertexId = null;
        renderAll();

        if (players[turnIndex].isCpu) {
          cpuTimer = setTimeout(() => {
            if (isDestroyed || phase !== 'SETUP') return;
            const isSecond = setupStep >= playerCount;
            const validVerts = getValidSettlementVertices(turnIndex, true);
            validVerts.sort((a, b) => evaluateVertexYield(b) - evaluateVertexYield(a));
            const pickVid = validVerts[0];
            const validEdges = getValidRoadEdges(turnIndex, pickVid);
            const pickEid = validEdges[Math.floor(Math.random() * validEdges.length)];
            placeSetupSettlementAndRoadFor(turnIndex, isSecond, pickVid, pickEid);
            CatanSfx.build();
            advanceSetupTurn();
          }, 550);
        }
      }

      // ダイスロール処理
      function rollDiceAction() {
        if (phase !== 'ROLL') return;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;
        lastDice = [d1, d2];
        CatanSfx.dice();

        const activeP = players[turnIndex];

        if (sum === 7) {
          CatanSfx.robber();
          // 8枚以上の手札を持つプレイヤーは半分切り捨てバースト
          const burstLogs = [];
          players.forEach((p) => {
            const tot = totalRes(p);
            if (tot >= 8) {
              const dropCount = Math.floor(tot / 2);
              for (let i = 0; i < dropCount; i++) {
                const haveTypes = RES_TYPES.filter((k) => p.res[k] > 0);
                const pick = haveTypes[Math.floor(Math.random() * haveTypes.length)];
                p.res[pick]--;
              }
              burstLogs.push(`${p.name}が${dropCount}枚バースト`);
            }
          });
          const burstMsg = burstLogs.length > 0 ? `（💥 ${burstLogs.join('・')}）` : '';

          if (activeP.isCpu) {
            cpuMoveRobber(activeP);
            phase = 'MAIN';
            renderAll();
          } else {
            phase = 'ROBBER_MOVE';
            statusBannerText = `🦹 出目「7」！${burstMsg} 盤上のタイルをクリックして盗賊を移動させてください！`;
            renderAll();
          }
          return;
        }

        // 通常の資源産出
        const gainLogs = [];
        hexes.forEach((h) => {
          if (h.number === sum && !h.hasRobber && h.terrain !== 'desert') {
            h.vertexIds.forEach((vid) => {
              const b = vertices[vid].building;
              if (b) {
                const amt = b.type === 'city' ? 2 : 1;
                players[b.owner].res[h.terrain] += amt;
                gainLogs.push(`${players[b.owner].name}:${RES_META[h.terrain].icon}+${amt}`);
              }
            });
          }
        });

        phase = 'MAIN';
        statusBannerText = `🎲 出目【${sum}】！ ${gainLogs.length > 0 ? gainLogs.join(' / ') : '資源産出なし'}`;
        renderAll();
      }

      function moveRobberToHex(p, hexId) {
        hexes.forEach((h) => { h.hasRobber = (h.id === hexId); });
        const targetHex = hexes[hexId];

        // 隣接する他プレイヤーから資源1枚をランダム強奪
        const victims = [];
        targetHex.vertexIds.forEach((vid) => {
          const b = vertices[vid].building;
          if (b && b.owner !== p.idx && totalRes(players[b.owner]) > 0) {
            if (!victims.includes(b.owner)) victims.push(b.owner);
          }
        });

        let stealText = '';
        if (victims.length > 0) {
          const vIdx = victims[Math.floor(Math.random() * victims.length)];
          const victim = players[vIdx];
          const avail = RES_TYPES.filter((k) => victim.res[k] > 0);
          if (avail.length > 0) {
            const stolenRes = avail[Math.floor(Math.random() * avail.length)];
            victim.res[stolenRes]--;
            p.res[stolenRes]++;
            stealText = `（${victim.name}から資源を1枚強奪！）`;
          }
        }

        CatanSfx.robber();
        statusBannerText = `🦹 ${p.name} が盗賊を【${RES_META[targetHex.terrain].terrainName}】へ移動しました${stealText}`;
        phase = 'MAIN';
        renderAll();
      }

      function cpuMoveRobber(cpu) {
        // CPUが自分の建物がなく、他プレイヤーの建物がある高確率タイルへ盗賊を置く
        const candidates = hexes.filter((h) => !h.hasRobber && !h.vertexIds.some((vid) => vertices[vid].building && vertices[vid].building.owner === cpu.idx));
        const target = candidates[Math.floor(Math.random() * candidates.length)] || hexes[0];
        moveRobberToHex(cpu, target.id);
      }

      // 建設コスト判定＆実行
      function canAffordRoad(p) {
        return p.roadsLeft > 0 && p.res.wood >= 1 && p.res.brick >= 1 && getValidRoadEdges(p.idx).length > 0;
      }
      function canAffordSettlement(p) {
        return p.settlementsLeft > 0 && p.res.wood >= 1 && p.res.brick >= 1 && p.res.sheep >= 1 && p.res.wheat >= 1 && getValidSettlementVertices(p.idx, false).length > 0;
      }
      function canAffordCity(p) {
        return p.citiesLeft > 0 && p.res.wheat >= 2 && p.res.ore >= 3 && getValidCityVertices(p.idx).length > 0;
      }
      function canAffordDevCard(p) {
        return devDeck.length > 0 && p.res.sheep >= 1 && p.res.wheat >= 1 && p.res.ore >= 1;
      }

      function handleVertexClick(vId) {
        const p = players[turnIndex];
        if (!p || p.isCpu) return;

        if (phase === 'SETUP' && setupSubPhase === 'SETTLEMENT') {
          const valid = getValidSettlementVertices(p.idx, true);
          if (!valid.includes(vId)) return;
          vertices[vId].building = { owner: p.idx, type: 'settlement' };
          p.settlementsLeft--;
          if (setupStep >= playerCount) {
            vertices[vId].hexIds.forEach((hid) => {
              const h = hexes[hid];
              if (h.terrain !== 'desert') p.res[h.terrain]++;
            });
          }
          lastSetupVertexId = vId;
          setupSubPhase = 'ROAD';
          CatanSfx.build();
          statusBannerText = '🛣️ 今配置した開拓地に隣接する辺をクリックして街道を1本配置してください。';
          renderAll();
          return;
        }

        if (phase === 'MAIN' && buildMode === 'settlement') {
          const valid = getValidSettlementVertices(p.idx, false);
          if (!valid.includes(vId)) return;
          p.res.wood--; p.res.brick--; p.res.sheep--; p.res.wheat--;
          vertices[vId].building = { owner: p.idx, type: 'settlement' };
          p.settlementsLeft--;
          buildMode = null;
          CatanSfx.build();
          statusBannerText = `🏠 ${p.name} が新しい開拓地を建設しました！(+1VP)`;
          updateAwardsAndCheckVictory();
          renderAll();
          return;
        }

        if (phase === 'MAIN' && buildMode === 'city') {
          const valid = getValidCityVertices(p.idx);
          if (!valid.includes(vId)) return;
          p.res.wheat -= 2; p.res.ore -= 3;
          vertices[vId].building.type = 'city';
          p.settlementsLeft++;
          p.citiesLeft--;
          buildMode = null;
          CatanSfx.build();
          statusBannerText = `🏰 ${p.name} が開拓地を都市に発展させました！(+1VP・産出2倍)`;
          updateAwardsAndCheckVictory();
          renderAll();
        }
      }

      function handleEdgeClick(eId) {
        const p = players[turnIndex];
        if (!p || p.isCpu) return;

        if (phase === 'SETUP' && setupSubPhase === 'ROAD') {
          const valid = getValidRoadEdges(p.idx, lastSetupVertexId);
          if (!valid.includes(eId)) return;
          edges[eId].roadOwner = p.idx;
          p.roadsLeft--;
          CatanSfx.build();
          advanceSetupTurn();
          return;
        }

        if (phase === 'FREE_ROADS') {
          const valid = getValidRoadEdges(p.idx);
          if (!valid.includes(eId)) return;
          edges[eId].roadOwner = p.idx;
          p.roadsLeft--;
          freeRoadsRemaining--;
          CatanSfx.build();
          if (freeRoadsRemaining <= 0 || p.roadsLeft <= 0 || getValidRoadEdges(p.idx).length === 0) {
            phase = 'MAIN';
            statusBannerText = '🛣️ 街道建設カードによる2本の無料街道建設が完了しました！';
          } else {
            statusBannerText = '🛣️ もう1本、無料で建設する街道の場所をクリックしてください。';
          }
          updateAwardsAndCheckVictory();
          renderAll();
          return;
        }

        if (phase === 'MAIN' && buildMode === 'road') {
          const valid = getValidRoadEdges(p.idx);
          if (!valid.includes(eId)) return;
          p.res.wood--; p.res.brick--;
          edges[eId].roadOwner = p.idx;
          p.roadsLeft--;
          buildMode = null;
          CatanSfx.build();
          statusBannerText = `🛣️ ${p.name} が街道を建設しました！`;
          updateAwardsAndCheckVictory();
          renderAll();
        }
      }

      function buyDevelopmentCard(p) {
        if (!canAffordDevCard(p)) return;
        p.res.sheep--; p.res.wheat--; p.res.ore--;
        const cardType = devDeck.pop();
        if (cardType === 'vp') {
          p.vpCardsCount++;
        } else {
          p.devCards.push({ type: cardType, boughtTurn: true });
        }
        CatanSfx.build();
        statusBannerText = `🃏 ${p.name} が発展カードを引きました！（${DEV_CARD_META[cardType].name}）`;
        updateAwardsAndCheckVictory();
        renderAll();
      }

      // ターン終了＆CPU行動
      function endTurn() {
        buildMode = null;
        players[turnIndex].devCards.forEach((c) => { c.boughtTurn = false; });
        if (updateAwardsAndCheckVictory()) return;

        turnIndex = (turnIndex + 1) % playerCount;
        phase = 'ROLL';
        devPlayedThisTurn = false;
        renderAll();

        if (players[turnIndex].isCpu) {
          cpuTimer = setTimeout(runCpuFullTurn, 700);
        }
      }

      function runCpuFullTurn() {
        if (isDestroyed || phase === 'GAME_OVER') return;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu) return;

        // 1. ダイスロール
        rollDiceAction();
        if (phase === 'GAME_OVER') return;

        // 2. CPUの貿易・建設思考
        setTimeout(() => {
          if (isDestroyed || phase === 'GAME_OVER') return;

          // 騎士カードがあれば使う
          const knightIdx = cpu.devCards.findIndex((c) => c.type === 'knight' && !c.boughtTurn);
          if (knightIdx >= 0) {
            cpu.devCards.splice(knightIdx, 1);
            cpu.knightsPlayed++;
            cpuMoveRobber(cpu);
            updateAwardsAndCheckVictory();
          }

          // 余剰資源を港・銀行貿易で不足資源に交換
          const rates = getTradeRates(cpu);
          RES_TYPES.forEach((giveKey) => {
            const r = rates[giveKey];
            while (cpu.res[giveKey] >= r + 1) {
              const poorestKey = RES_TYPES.slice().sort((a, b) => cpu.res[a] - cpu.res[b])[0];
              if (poorestKey !== giveKey) {
                cpu.res[giveKey] -= r;
                cpu.res[poorestKey] += 1;
              } else {
                break;
              }
            }
          });

          // 優先度1: 都市化
          if (canAffordCity(cpu)) {
            const vId = getValidCityVertices(cpu.idx)[0];
            cpu.res.wheat -= 2; cpu.res.ore -= 3;
            vertices[vId].building.type = 'city';
            cpu.settlementsLeft++;
            cpu.citiesLeft--;
            CatanSfx.build();
            statusBannerText = `🏰 ${cpu.name} が開拓地を都市に発展させました！`;
          }
          // 優先度2: 開拓地建設
          if (canAffordSettlement(cpu)) {
            const validV = getValidSettlementVertices(cpu.idx, false);
            validV.sort((a, b) => evaluateVertexYield(b) - evaluateVertexYield(a));
            const vId = validV[0];
            cpu.res.wood--; cpu.res.brick--; cpu.res.sheep--; cpu.res.wheat--;
            vertices[vId].building = { owner: cpu.idx, type: 'settlement' };
            cpu.settlementsLeft--;
            CatanSfx.build();
            statusBannerText = `🏠 ${cpu.name} が開拓地を建設しました！`;
          }
          // 優先度3: 発展カード購入
          if (canAffordDevCard(cpu)) {
            buyDevelopmentCard(cpu);
          }
          // 優先度4: 街道建設
          if (canAffordRoad(cpu)) {
            const eId = getValidRoadEdges(cpu.idx)[0];
            cpu.res.wood--; cpu.res.brick--;
            edges[eId].roadOwner = cpu.idx;
            cpu.roadsLeft--;
            CatanSfx.build();
            statusBannerText = `🛣️ ${cpu.name} が街道を延ばしました。`;
          }

          if (!updateAwardsAndCheckVictory()) {
            endTurn();
          }
        }, 650);
      }

      // ====================================================
      // 4. 貿易モーダル（海上港貿易 ＆ プレイヤー間AI交渉）＆発展カードモーダル
      // ====================================================
      function closeModal() {
        modalOverlayEl.classList.remove('visible');
      }

      function openTradeModal(p) {
        const rates = getTradeRates(p);
        let giveRes = RES_TYPES.find((k) => p.res[k] >= rates[k]) || 'wood';
        let wantRes = 'wheat';

        function renderTradeContent() {
          const giveBtns = RES_TYPES.map((k) => {
            const rm = RES_META[k];
            const rate = rates[k];
            const ok = p.res[k] >= rate;
            return `<button class="cat-btn ${giveRes === k ? 'active-mode' : ''}" data-give="${k}" style="background:${rm.css};">
              ${rm.icon} ${rm.name} (所持:${p.res[k]} / レート${rate}:1) ${ok ? '✅' : ''}
            </button>`;
          }).join('');

          const wantBtns = RES_TYPES.map((k) => {
            const rm = RES_META[k];
            return `<button class="cat-btn ${wantRes === k ? 'active-mode' : ''}" data-want="${k}" style="background:${rm.css};">
              ${rm.icon} ${rm.name} を1枚貰う
            </button>`;
          }).join('');

          const canBankTrade = p.res[giveRes] >= rates[giveRes] && giveRes !== wantRes;
          const canPlayerOffer = p.res[giveRes] >= 1 && giveRes !== wantRes;

          modalCardEl.innerHTML = `
            <div style="font-size:19px;font-weight:900;color:#fef08a;margin-bottom:8px;">⛵ 海上・港貿易 ＆ 🤝 プレイヤー間1:1交渉</div>
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:10px;">【1. 差し出す資源を選択】</div>
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;">${giveBtns}</div>
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:10px;">【2. 欲しい資源を選択】</div>
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;">${wantBtns}</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
              <button class="cat-btn cat-btn-emerald" id="cat-do-bank-trade" ${canBankTrade ? '' : 'disabled'}>
                ⛵ 港・銀行貿易 (${RES_META[giveRes].short}×${rates[giveRes]} ➔ ${RES_META[wantRes].short}×1)
              </button>
              <button class="cat-btn cat-btn-gold" id="cat-do-p2p-trade" ${canPlayerOffer ? '' : 'disabled'}>
                🤝 他プレイヤーに1:1交換を提案 (${RES_META[giveRes].short}×1 ⇄ ${RES_META[wantRes].short}×1)
              </button>
              <button class="cat-btn" id="cat-close-trade">閉じる</button>
            </div>
            <div id="cat-trade-feedback" style="margin-top:10px;font-size:13px;font-weight:800;color:#38bdf8;"></div>
          `;

          modalCardEl.querySelectorAll('[data-give]').forEach((b) => {
            b.onclick = () => { giveRes = b.getAttribute('data-give'); renderTradeContent(); };
          });
          modalCardEl.querySelectorAll('[data-want]').forEach((b) => {
            b.onclick = () => { wantRes = b.getAttribute('data-want'); renderTradeContent(); };
          });
          modalCardEl.querySelector('#cat-close-trade').onclick = closeModal;

          const bankBtn = modalCardEl.querySelector('#cat-do-bank-trade');
          if (bankBtn && canBankTrade) {
            bankBtn.onclick = () => {
              p.res[giveRes] -= rates[giveRes];
              p.res[wantRes] += 1;
              CatanSfx.trade();
              statusBannerText = `⛵ ${p.name} が海上貿易で ${RES_META[giveRes].name}×${rates[giveRes]} を ${RES_META[wantRes].name}×1 に交換しました。`;
              renderTradeContent();
              renderAll();
            };
          }

          const p2pBtn = modalCardEl.querySelector('#cat-do-p2p-trade');
          if (p2pBtn && canPlayerOffer) {
            p2pBtn.onclick = () => {
              // 他プレイヤーの中で wantRes を2枚以上持ち、giveRes が0〜1枚のAIが交渉成立に応じる
              const partner = players.find((other) => other.idx !== p.idx && other.res[wantRes] >= 2 && other.res[giveRes] <= 1);
              const fb = modalCardEl.querySelector('#cat-trade-feedback');
              if (partner) {
                p.res[giveRes]--;
                p.res[wantRes]++;
                partner.res[wantRes]--;
                partner.res[giveRes]++;
                CatanSfx.trade();
                fb.style.color = '#34d399';
                fb.textContent = `🤝 交渉成立！ ${partner.name} が 1:1 交換に応じてくれました！`;
                statusBannerText = `🤝 ${p.name} と ${partner.name} の間で資源1:1トレードが成立しました！`;
                renderAll();
              } else {
                fb.style.color = '#fb7185';
                fb.textContent = `💬 他プレイヤー全員：「今はその条件では交換できません…」`;
              }
            };
          }
        }

        renderTradeContent();
        modalOverlayEl.classList.add('visible');
      }

      function openDevCardsModal(p) {
        const playable = p.devCards.map((c, idx) => ({ ...c, idx }));
        const rows = playable.length === 0
          ? `<div style="color:#94a3b8;margin:14px 0;">所持しているアクション発展カードはありません（VPカード所持: ${p.vpCardsCount}枚）</div>`
          : playable.map((c) => {
              const meta = DEV_CARD_META[c.type];
              const canUse = !c.boughtTurn && !devPlayedThisTurn;
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:8px;background:rgba(255,255,255,0.06);border-radius:10px;text-align:left;">
                  <div>
                    <div style="font-weight:900;color:#fef08a;">${meta.name}</div>
                    <div style="font-size:11px;color:#cbd5e1;">${meta.desc}</div>
                  </div>
                  <button class="cat-btn cat-btn-emerald" data-use-dev="${c.idx}" ${canUse ? '' : 'disabled'}>
                    ${c.boughtTurn ? '購入ターン不可' : '使用する'}
                  </button>
                </div>
              `;
            }).join('');

        modalCardEl.innerHTML = `
          <div style="font-size:19px;font-weight:900;color:#fef08a;margin-bottom:8px;">🃏 所持発展カード （山札残り: ${devDeck.length}枚）</div>
          <div>${rows}</div>
          <div style="margin-top:14px;display:flex;gap:8px;justify-content:center;">
            <button class="cat-btn cat-btn-gold" id="cat-buy-dev-btn" ${canAffordDevCard(p) && phase === 'MAIN' ? '' : 'disabled'}>
              🃏 新しく発展カードを引く (🐑1・🌾1・⛰️1)
            </button>
            <button class="cat-btn" id="cat-close-dev">閉じる</button>
          </div>
        `;
        modalOverlayEl.classList.add('visible');
        modalCardEl.querySelector('#cat-close-dev').onclick = closeModal;
        const buyBtn = modalCardEl.querySelector('#cat-buy-dev-btn');
        if (buyBtn && canAffordDevCard(p) && phase === 'MAIN') {
          buyBtn.onclick = () => {
            buyDevelopmentCard(p);
            openDevCardsModal(p);
          };
        }

        modalCardEl.querySelectorAll('[data-use-dev]').forEach((btn) => {
          btn.onclick = () => {
            const cIdx = parseInt(btn.getAttribute('data-use-dev'), 10);
            const card = p.devCards[cIdx];
            if (!card) return;
            p.devCards.splice(cIdx, 1);
            devPlayedThisTurn = true;
            closeModal();

            if (card.type === 'knight') {
              p.knightsPlayed++;
              phase = 'ROBBER_MOVE';
              statusBannerText = '⚔️ 騎士カード発動！盤上のタイルをクリックして盗賊を移動させてください！';
              updateAwardsAndCheckVictory();
              renderAll();
            } else if (card.type === 'road_building') {
              freeRoadsRemaining = 2;
              phase = 'FREE_ROADS';
              statusBannerText = '🛣️ 街道建設カード発動！コストなしで2本の街道を配置できます。';
              renderAll();
            } else if (card.type === 'year_of_plenty') {
              // 一番少ない資源を2枚獲得（または選択モーダル）
              openYearOfPlentyModal(p);
            } else if (card.type === 'monopoly') {
              openMonopolyModal(p);
            }
          };
        });
      }

      function openYearOfPlentyModal(p) {
        const btns = RES_TYPES.map((k) => {
          const rm = RES_META[k];
          return `<button class="cat-btn" data-yop="${k}" style="background:${rm.css};">${rm.icon} ${rm.name} ×2枚を獲得</button>`;
        }).join('');
        modalCardEl.innerHTML = `
          <div style="font-size:18px;font-weight:900;color:#fef08a;margin-bottom:10px;">🎁 発見 (Year of Plenty)：銀行から獲得する資源を選択</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">${btns}</div>
        `;
        modalOverlayEl.classList.add('visible');
        modalCardEl.querySelectorAll('[data-yop]').forEach((b) => {
          b.onclick = () => {
            const k = b.getAttribute('data-yop');
            p.res[k] += 2;
            CatanSfx.trade();
            statusBannerText = `🎁 ${p.name} が「発見」で ${RES_META[k].name} を2枚獲得しました！`;
            closeModal();
            renderAll();
          };
        });
      }

      function openMonopolyModal(p) {
        const btns = RES_TYPES.map((k) => {
          const rm = RES_META[k];
          return `<button class="cat-btn" data-mono="${k}" style="background:${rm.css};">${rm.icon} ${rm.name} を全員から独占回収！</button>`;
        }).join('');
        modalCardEl.innerHTML = `
          <div style="font-size:18px;font-weight:900;color:#fef08a;margin-bottom:10px;">👑 独占 (Monopoly)：全員から奪う資源を1種類宣言</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">${btns}</div>
        `;
        modalOverlayEl.classList.add('visible');
        modalCardEl.querySelectorAll('[data-mono]').forEach((b) => {
          b.onclick = () => {
            const k = b.getAttribute('data-mono');
            let totalTaken = 0;
            players.forEach((other) => {
              if (other.idx !== p.idx && other.res[k] > 0) {
                totalTaken += other.res[k];
                other.res[k] = 0;
              }
            });
            p.res[k] += totalTaken;
            CatanSfx.robber();
            statusBannerText = `👑 ${p.name} が「独占」で全員から ${RES_META[k].name} を合計 ${totalTaken} 枚回収しました！`;
            closeModal();
            renderAll();
          };
        });
      }

      function openVictoryModal(winner) {
        const ranked = players.slice().sort((a, b) => calcPlayerVP(b) - calcPlayerVP(a));
        const rows = ranked.map((p, i) => `
          <div style="display:flex;justify-content:space-between;padding:8px 12px;margin-bottom:6px;background:rgba(255,255,255,0.07);border-radius:8px;border-left:4px solid ${p.css};">
            <span><b>${i + 1}位: ${p.name}</b></span>
            <span>🏆 <b>${calcPlayerVP(p)} VP</b> （騎士:${p.knightsPlayed} / 最長路:${computeLongestRoadForPlayer(p.idx)}本）</span>
          </div>
        `).join('');
        modalCardEl.innerHTML = `
          <div style="font-size:22px;font-weight:900;color:#fef08a;margin-bottom:10px;">🏆 カタン島開拓制覇！勝者: ${winner.name}</div>
          <div style="margin-bottom:16px;text-align:left;">${rows}</div>
          <button class="cat-btn cat-btn-gold" id="cat-rematch-btn">🔄 新しい島でもう一度プレイ</button>
        `;
        modalOverlayEl.classList.add('visible');
        modalCardEl.querySelector('#cat-rematch-btn').onclick = () => initGame(false);
      }

      // ====================================================
      // 5. Three.js + Godot 4.7 GLB フル3D島ジオラマ描画
      // ====================================================
      let THREE = null;
      let scene = null;
      let camera = null;
      let renderer = null;
      let boardGroup = null;
      let interactiveObjects = [];
      let maxAniso = 8;
      const glbModels = { settlement: null, city: null, road: null, robber: null };

      let camSpherical = { radius: 19.5, phi: 0.72, theta: 0 };

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
        camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 200);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stageWrapEl.appendChild(renderer.domElement);

        maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;

        // 太陽光＆海洋リムライト
        scene.add(new THREE.AmbientLight(0xf1f5f9, 0.9));
        const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
        sunLight.position.set(10, 20, 12);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        scene.add(sunLight);

        const seaLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
        seaLight.position.set(-12, 10, -10);
        scene.add(seaLight);

        // 海洋3Dテーブルベース
        const seaTable = new THREE.Mesh(
          new THREE.CylinderGeometry(11.4, 11.8, 0.36, 12),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25, metalness: 0.2 })
        );
        seaTable.position.y = -0.22;
        seaTable.receiveShadow = true;
        scene.add(seaTable);

        const outerFrame = new THREE.Mesh(
          new THREE.CylinderGeometry(12.1, 12.3, 0.28, 12),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4, metalness: 0.15 })
        );
        outerFrame.position.y = -0.28;
        scene.add(outerFrame);

        boardGroup = new THREE.Group();
        scene.add(boardGroup);

        // Godot 4.7 GLBモデル群の非同期ロード
        if (window.THREE.GLTFLoader && window.location.protocol !== 'file:') {
          const loader = new window.THREE.GLTFLoader();
          const mapPaths = {
            settlement: 'assets/models/catan_settlement.glb',
            city: 'assets/models/catan_city.glb',
            road: 'assets/models/catan_road.glb',
            robber: 'assets/models/catan_robber.glb'
          };
          Object.entries(mapPaths).forEach(([key, url]) => {
            loader.load(url, (gltf) => {
              if (gltf && gltf.scene) {
                glbModels[key] = gltf.scene;
                rebuild3DIslansScene();
              }
            }, undefined, () => {});
          });
        }

        // カメラ回転＆3Dクリック操作
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
          camSpherical.radius = Math.max(11.0, Math.min(28.0, camSpherical.radius + e.deltaY * 0.01));
          updateCamera();
        }, { passive: false });

        camResetBtn.onclick = () => {
          camSpherical = { radius: 19.5, phi: 0.72, theta: 0 };
          updateCamera();
        };

        window.addEventListener('resize', onResize);
        updateCamera();
        rebuild3DIslansScene();

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
          radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(0, 0, 0);
      }

      function onResize() {
        if (isDestroyed || !renderer || !camera) return;
        const w = stageWrapEl.clientWidth || 960;
        const h = stageWrapEl.clientHeight || 580;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }

      // 3D地形ディテール生成（森の木々、山の岩峰、畑の麦、丘のレンガ、牧場の羊）
      function createTerrainPropGroup(terrain) {
        const g = new THREE.Group();
        if (terrain === 'wood') {
          const offsets = [[-0.55, -0.45], [0.55, -0.4], [-0.45, 0.55], [0.5, 0.5]];
          offsets.forEach(([ox, oz]) => {
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.06, 0.08, 0.22, 8),
              new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
            );
            trunk.position.set(ox, 0.11, oz);
            g.add(trunk);
            const foliage = new THREE.Mesh(
              new THREE.ConeGeometry(0.26, 0.55, 8),
              new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.45 })
            );
            foliage.position.set(ox, 0.42, oz);
            foliage.castShadow = true;
            g.add(foliage);
          });
        } else if (terrain === 'ore') {
          const peaks = [[-0.45, -0.35, 0.65], [0.48, -0.3, 0.52], [0.0, 0.52, 0.58]];
          peaks.forEach(([ox, oz, h]) => {
            const rock = new THREE.Mesh(
              new THREE.ConeGeometry(0.36, h, 6),
              new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.25 })
            );
            rock.position.set(ox, h / 2, oz);
            rock.castShadow = true;
            g.add(rock);
          });
        } else if (terrain === 'brick') {
          const mounds = [[-0.45, -0.35], [0.48, 0.38], [-0.35, 0.45]];
          mounds.forEach(([ox, oz]) => {
            const hill = new THREE.Mesh(
              new THREE.CylinderGeometry(0.22, 0.34, 0.25, 10),
              new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55 })
            );
            hill.position.set(ox, 0.125, oz);
            hill.castShadow = true;
            g.add(hill);
          });
        } else if (terrain === 'sheep') {
          const sheepPos = [[-0.45, -0.35], [0.45, -0.35], [0.4, 0.45]];
          sheepPos.forEach(([ox, oz]) => {
            const wool = new THREE.Mesh(
              new THREE.SphereGeometry(0.16, 12, 10),
              new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
            );
            wool.scale.set(1.25, 0.85, 1.0);
            wool.position.set(ox, 0.14, oz);
            wool.castShadow = true;
            g.add(wool);
          });
        } else if (terrain === 'wheat') {
          const sheaves = [[-0.45, -0.38], [0.45, -0.38], [-0.42, 0.42], [0.42, 0.42]];
          sheaves.forEach(([ox, oz]) => {
            const bundle = new THREE.Mesh(
              new THREE.CylinderGeometry(0.14, 0.18, 0.26, 10),
              new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 })
            );
            bundle.position.set(ox, 0.13, oz);
            bundle.castShadow = true;
            g.add(bundle);
          });
        }
        return g;
      }

      // 数字チップ3Dディスク (256x256 CanvasTexture)
      function createNumberToken3D(num) {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(128, 128, 118, 0, Math.PI * 2);
        ctx.fill();

        const isHot = num === 6 || num === 8;
        ctx.strokeStyle = isHot ? '#dc2626' : '#b45309';
        ctx.lineWidth = 12;
        ctx.stroke();

        ctx.fillStyle = isHot ? '#dc2626' : '#0f172a';
        ctx.font = '900 108px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(num), 128, 112);

        const pips = 6 - Math.abs(7 - num);
        const dots = '●'.repeat(pips);
        ctx.font = '900 32px "Noto Sans JP", sans-serif';
        ctx.fillText(dots, 128, 192);

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = maxAniso;

        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.54, 0.54, 0.12, 28),
          [
            new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35 }),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 }),
            new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35 })
          ]
        );
        mesh.castShadow = true;
        return mesh;
      }

      function createPlayerPiece3D(type, colorHex) {
        const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.22, metalness: 0.18 });
        if (glbModels[type]) {
          const clone = glbModels[type].clone(true);
          clone.traverse((c) => {
            if (c.isMesh) {
              c.material = mat;
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
          return clone;
        }
        const g = new THREE.Group();
        if (type === 'settlement') {
          const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.36), mat);
          base.position.y = 0.13;
          base.castShadow = true;
          g.add(base);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 4), mat);
          roof.rotation.y = Math.PI / 4;
          roof.position.y = 0.38;
          roof.castShadow = true;
          g.add(roof);
        } else if (type === 'city') {
          const hall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.38), mat);
          hall.position.y = 0.14;
          hall.castShadow = true;
          g.add(hall);
          const tower = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.52, 0.38), mat);
          tower.position.set(-0.12, 0.26, 0);
          tower.castShadow = true;
          g.add(tower);
        } else if (type === 'road') {
          const road = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.78), mat);
          road.position.y = 0.06;
          road.castShadow = true;
          g.add(road);
        }
        return g;
      }

      function rebuild3DIslansScene() {
        if (!THREE || !boardGroup) return;
        while (boardGroup.children.length > 0) {
          boardGroup.remove(boardGroup.children[0]);
        }
        interactiveObjects = [];

        // 1. 19枚の3D地形ヘックス＋数字チップ＋盗賊
        hexes.forEach((h) => {
          const rm = RES_META[h.terrain];
          const hexGroup = new THREE.Group();
          hexGroup.position.set(h.x, 0, h.z);

          // 砂浜エッジ＋メイン地形ヘックス
          const borderHex = new THREE.Mesh(
            new THREE.CylinderGeometry(HEX_RADIUS * 0.99, HEX_RADIUS * 1.0, 0.16, 6),
            new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55 })
          );
          borderHex.position.y = 0.08;
          borderHex.receiveShadow = true;
          hexGroup.add(borderHex);

          const innerHex = new THREE.Mesh(
            new THREE.CylinderGeometry(HEX_RADIUS * 0.91, HEX_RADIUS * 0.93, 0.22, 6),
            new THREE.MeshStandardMaterial({ color: rm.hex, roughness: 0.48 })
          );
          innerHex.position.y = 0.11;
          innerHex.receiveShadow = true;
          hexGroup.add(innerHex);

          // 地形3Dオブジェクト
          const props = createTerrainPropGroup(h.terrain);
          props.position.y = 0.22;
          hexGroup.add(props);

          // 数字チップ
          if (h.number) {
            const numMesh = createNumberToken3D(h.number);
            numMesh.position.set(0, 0.26, 0);
            hexGroup.add(numMesh);
          }

          // 盗賊3Dモデル
          if (h.hasRobber) {
            let robberObj;
            if (glbModels.robber) {
              robberObj = glbModels.robber.clone(true);
            } else {
              robberObj = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.28, 0.72, 16),
                new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.25, metalness: 0.5 })
              );
              robberObj.position.y = 0.36;
            }
            robberObj.position.set(0.32, 0.25, 0.15);
            hexGroup.add(robberObj);
          }

          // 盗賊移動フェーズ中のクリックターゲット
          if (phase === 'ROBBER_MOVE' && !h.hasRobber) {
            const ring = new THREE.Mesh(
              new THREE.CylinderGeometry(0.72, 0.72, 0.08, 24),
              new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.72 })
            );
            ring.position.y = 0.36;
            ring.userData = {
              onClick: () => moveRobberToHex(players[turnIndex], h.id)
            };
            hexGroup.add(ring);
            interactiveObjects.push(ring);
          }

          boardGroup.add(hexGroup);
        });

        // 2. 9箇所の港ビルボードラベル
        harbors.forEach((hb) => {
          const c = document.createElement('canvas');
          c.width = 220;
          c.height = 84;
          const ctx = c.getContext('2d');
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 6;
          ctx.fillRect(4, 4, 212, 76);
          ctx.strokeRect(4, 4, 212, 76);
          ctx.fillStyle = '#fef08a';
          ctx.font = '900 34px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hb.label, 110, 42);

          const tex = new THREE.CanvasTexture(c);
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
          sp.scale.set(1.45, 0.56, 1);
          sp.position.set(hb.x, 0.55, hb.z);
          boardGroup.add(sp);
        });

        // 3. 建設済み街道 ＆ 建設可能街道の3D発光マーカー
        const activeP = players[turnIndex];
        const showRoadTargets = activeP && !activeP.isCpu && (
          (phase === 'SETUP' && setupSubPhase === 'ROAD') ||
          (phase === 'FREE_ROADS') ||
          (phase === 'MAIN' && buildMode === 'road')
        );
        const validRoadIds = showRoadTargets
          ? new Set(getValidRoadEdges(activeP.idx, phase === 'SETUP' ? lastSetupVertexId : null))
          : new Set();

        edges.forEach((e) => {
          if (e.roadOwner !== null) {
            const roadObj = createPlayerPiece3D('road', PLAYER_THEMES[e.roadOwner].hex);
            roadObj.position.set(e.x, 0.2, e.z);
            roadObj.rotation.y = e.angleY;
            boardGroup.add(roadObj);
          } else if (validRoadIds.has(e.id)) {
            const marker = new THREE.Mesh(
              new THREE.BoxGeometry(0.24, 0.16, 0.78),
              new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.82 })
            );
            marker.position.set(e.x, 0.25, e.z);
            marker.rotation.y = e.angleY;
            marker.userData = {
              onClick: () => handleEdgeClick(e.id)
            };
            boardGroup.add(marker);
            interactiveObjects.push(marker);
          }
        });

        // 4. 建設済み開拓地・都市 ＆ 建設可能頂点の3D発光スフィア
        const showSettleTargets = activeP && !activeP.isCpu && (
          (phase === 'SETUP' && setupSubPhase === 'SETTLEMENT') ||
          (phase === 'MAIN' && buildMode === 'settlement')
        );
        const validSettleIds = showSettleTargets
          ? new Set(getValidSettlementVertices(activeP.idx, phase === 'SETUP'))
          : new Set();

        const showCityTargets = activeP && !activeP.isCpu && phase === 'MAIN' && buildMode === 'city';
        const validCityIds = showCityTargets ? new Set(getValidCityVertices(activeP.idx)) : new Set();

        vertices.forEach((v) => {
          if (v.building) {
            const pHex = PLAYER_THEMES[v.building.owner].hex;
            const bObj = createPlayerPiece3D(v.building.type, pHex);
            bObj.position.set(v.x, 0.2, v.z);
            if (validCityIds.has(v.id)) {
              const ring = new THREE.Mesh(
                new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20),
                new THREE.MeshBasicMaterial({ color: 0xfde047 })
              );
              ring.position.y = 0.04;
              bObj.add(ring);
              bObj.userData = { onClick: () => handleVertexClick(v.id) };
              interactiveObjects.push(bObj);
            }
            boardGroup.add(bObj);
          } else if (validSettleIds.has(v.id)) {
            const sphere = new THREE.Mesh(
              new THREE.SphereGeometry(0.26, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.88 })
            );
            sphere.position.set(v.x, 0.34, v.z);
            sphere.userData = {
              onClick: () => handleVertexClick(v.id)
            };
            boardGroup.add(sphere);
            interactiveObjects.push(sphere);
          }
        });
      }

      // ====================================================
      // 6. UIレンダリング
      // ====================================================
      function renderAll() {
        // 1. 上部プレイヤーカード
        playersRowEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && phase !== 'GAME_OVER';
          const vp = calcPlayerVP(p);
          const roadLen = computeLongestRoadForPlayer(p.idx);
          const awards = [];
          if (longestRoadHolder === p.idx) awards.push(`<span class="cat-award-badge">🛣️最長路(2VP)</span>`);
          if (largestArmyHolder === p.idx) awards.push(`<span class="cat-award-badge">⚔️最大騎士(2VP)</span>`);

          return `
            <div class="cat-pcard ${isTurn ? 'active-turn' : ''}">
              <span style="font-weight:900;color:${p.css};">${isTurn ? '▶ ' : ''}${p.name}</span>
              <span class="cat-vp-pill">🏆 ${vp}/10 VP</span>
              <span style="color:#cbd5e1;">🃏資源:${totalRes(p)}枚 / 発展:${p.devCards.length}枚 / ⚔️:${p.knightsPlayed} / 🛣️:${roadLen}</span>
              ${awards.join(' ')}
            </div>
          `;
        }).join('');

        // 2. ダイス＆バナー
        die1El.textContent = lastDice[0];
        die2El.textContent = lastDice[1];
        diceSumEl.textContent = `(${lastDice[0] + lastDice[1]})`;
        bannerEl.textContent = statusBannerText;

        // 3. 自分の資源カード一覧
        const me = players[mySeat] || players[0];
        if (me) {
          const rates = getTradeRates(me);
          resHandEl.innerHTML = RES_TYPES.map((k) => {
            const rm = RES_META[k];
            return `
              <div class="cat-res-card" style="background:${rm.css};">
                <span>${rm.icon} ${rm.name}: <b>${me.res[k]}</b></span>
                <span style="font-size:10px;opacity:0.85;">(${rates[k]}:1)</span>
              </div>
            `;
          }).join('');
        }

        // 4. アクションボタンバー
        const activeP = players[turnIndex];
        const isMyTurn = activeP && !activeP.isCpu && phase !== 'GAME_OVER';

        if (!isMyTurn) {
          actionsBarEl.innerHTML = `<span style="color:#94a3b8;font-size:12px;">⏳ ${activeP ? activeP.name : ''} の行動中...</span>`;
        } else if (phase === 'SETUP') {
          actionsBarEl.innerHTML = `
            <span style="font-size:12px;font-weight:900;color:#34d399;">
              🚩 初期配置：盤上の光っている${setupSubPhase === 'SETTLEMENT' ? '緑色の交差点（開拓地）' : '水色の辺（街道）'}をクリック！
            </span>
          `;
        } else if (phase === 'ROLL') {
          actionsBarEl.innerHTML = `
            <button class="cat-btn cat-btn-gold" id="cat-roll-btn" style="font-size:14px;padding:7px 18px;">🎲 ダイスを振る！</button>
            <button class="cat-btn" id="cat-dev-btn">🃏 発展カード (${activeP.devCards.length})</button>
          `;
          actionsBarEl.querySelector('#cat-roll-btn').onclick = rollDiceAction;
          actionsBarEl.querySelector('#cat-dev-btn').onclick = () => openDevCardsModal(activeP);
        } else if (phase === 'ROBBER_MOVE') {
          actionsBarEl.innerHTML = `<span style="color:#fb7185;font-weight:900;font-size:13px;">🦹 盤上の赤いリングが表示されているタイルをクリックして盗賊を移動してください！</span>`;
        } else if (phase === 'FREE_ROADS') {
          actionsBarEl.innerHTML = `<span style="color:#38bdf8;font-weight:900;font-size:13px;">🛣️ 無料で建設する街道（残り${freeRoadsRemaining}本）の水色マーカーをクリック！</span>`;
        } else if (phase === 'MAIN') {
          const okRoad = canAffordRoad(activeP);
          const okSettle = canAffordSettlement(activeP);
          const okCity = canAffordCity(activeP);
          const okDev = canAffordDevCard(activeP);

          actionsBarEl.innerHTML = `
            <button class="cat-btn ${buildMode === 'road' ? 'active-mode' : ''}" id="cat-b-road" ${okRoad ? '' : 'disabled'} title="コスト: 木1・土1">
              🛣️ 街道 (🌲1🧱1)
            </button>
            <button class="cat-btn ${buildMode === 'settlement' ? 'active-mode' : ''}" id="cat-b-settle" ${okSettle ? '' : 'disabled'} title="コスト: 木1・土1・羊1・麦1">
              🏠 開拓地 (🌲1🧱1🐑1🌾1)
            </button>
            <button class="cat-btn ${buildMode === 'city' ? 'active-mode' : ''}" id="cat-b-city" ${okCity ? '' : 'disabled'} title="コスト: 麦2・鉄3">
              🏰 都市化 (🌾2⛰️3)
            </button>
            <button class="cat-btn" id="cat-b-dev" title="発展カード購入(羊1・麦1・鉄1) / 使用">
              🃏 発展カード (${activeP.devCards.length}) ${okDev ? '✨引ける' : ''}
            </button>
            <button class="cat-btn" id="cat-b-trade">
              ⛵ 港貿易・🤝交渉
            </button>
            <button class="cat-btn cat-btn-emerald" id="cat-end-turn">
              ⏭️ ターン終了
            </button>
          `;

          const roadBtn = actionsBarEl.querySelector('#cat-b-road');
          if (roadBtn && okRoad) {
            roadBtn.onclick = () => {
              buildMode = buildMode === 'road' ? null : 'road';
              statusBannerText = buildMode === 'road' ? '🛣️ 盤上の水色に光る辺をクリックして街道を建設してください。' : '建設モードを解除しました。';
              renderAll();
            };
          }
          const settleBtn = actionsBarEl.querySelector('#cat-b-settle');
          if (settleBtn && okSettle) {
            settleBtn.onclick = () => {
              buildMode = buildMode === 'settlement' ? null : 'settlement';
              statusBannerText = buildMode === 'settlement' ? '🏠 盤上の緑色に光る交差点をクリックして開拓地を建設してください。' : '建設モードを解除しました。';
              renderAll();
            };
          }
          const cityBtn = actionsBarEl.querySelector('#cat-b-city');
          if (cityBtn && okCity) {
            cityBtn.onclick = () => {
              buildMode = buildMode === 'city' ? null : 'city';
              statusBannerText = buildMode === 'city' ? '🏰 都市にアップグレードする自分の開拓地（黄色リング）をクリックしてください。' : '建設モードを解除しました。';
              renderAll();
            };
          }
          actionsBarEl.querySelector('#cat-b-dev').onclick = () => openDevCardsModal(activeP);
          actionsBarEl.querySelector('#cat-b-trade').onclick = () => openTradeModal(activeP);
          actionsBarEl.querySelector('#cat-end-turn').onclick = endTurn;
        }

        rebuild3DIslansScene();
      }

      pcountSelEl.onchange = () => initGame(false);
      fastSetupBtnEl.onclick = () => initGame(true);
      newBtnEl.onclick = () => initGame(false);

      ensureThreeLoaded().then((threeLib) => {
        if (isDestroyed) return;
        init3DStage(threeLib);
        initGame(false);
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
