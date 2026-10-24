/**
 * カタンの開拓者たち (3〜4人)
 * サイコロで資源を産出し、街道・開拓地・都市を築いて先に10点を取ったプレイヤーの勝ち。
 *
 * - 公式ルール: 19枚の地形タイルと18枚の数字チップ、9つの港、初期配置のスネークドラフト、
 *   7の目の盗賊とバースト、発展カード25枚、最長交易路・最大騎士力
 * - 盤面は共通エンジン (arena-3d-engine.js) の卓上ステージに、厚みのあるタイルと木の駒で組み立てる
 */

(function () {
  const RES_TYPES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

  const RES_META = {
    wood:   { name: '木材',   terrain: '森林',   color: '#4f7a45' },
    brick:  { name: 'レンガ', terrain: '丘陵',   color: '#b0603f' },
    sheep:  { name: '羊毛',   terrain: '牧草地', color: '#9dbb63' },
    wheat:  { name: '小麦',   terrain: '畑',     color: '#d8ae4f' },
    ore:    { name: '鉱石',   terrain: '山地',   color: '#8a9098' },
    desert: { name: '砂漠',   terrain: '砂漠',   color: '#cdb27c' }
  };

  // 駒の色は実物と同じ赤・青・白・橙
  const PLAYER_THEMES = [
    { colorName: '赤', color: '#b5392c' },
    { colorName: '青', color: '#2f5f9e' },
    { colorName: '白', color: '#e4ddcd' },
    { colorName: '橙', color: '#d5772b' }
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
    knight:         { name: '騎士',     desc: '盗賊を別のタイルへ動かし、隣のプレイヤーから資源を1枚奪う。3枚以上で最大騎士力の候補になる。' },
    vp:             { name: '勝利点',   desc: '引いた時点で1点。' },
    road_building:  { name: '街道建設', desc: '費用なしで街道を2本置く。' },
    year_of_plenty: { name: '発見',     desc: '好きな資源を2枚もらう。' },
    monopoly:       { name: '独占',     desc: '資源を1種類指定し、他の全員が持つその資源をすべてもらう。' }
  };

  const BUILD_COST = {
    road: ['wood', 'brick'],
    settlement: ['wood', 'brick', 'sheep', 'wheat'],
    city: ['wheat', 'wheat', 'ore', 'ore', 'ore'],
    dev: ['sheep', 'wheat', 'ore']
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

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  const costDots = (key) => `<span class="cat-cost">${BUILD_COST[key].map((r) => `<i style="--c:${RES_META[r].color}"></i>`).join('')}</span>`;
  const costText = (key) => {
    const counts = {};
    BUILD_COST[key].forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
    return Object.entries(counts).map(([r, n]) => `${RES_META[r].name}${n}`).join('・');
  };

  // ====================================================
  // 地形・海・チップの手描きテクスチャ
  // ====================================================
  const TERRAIN_PAINT = {
    wood: {
      base: '#3a5a32', dark: '#24391f', light: '#56763f', side: '#2c4427', seed: 11,
      detail(ctx, w, h, rng) {
        // 下草と落ち葉
        for (let i = 0; i < 1400; i++) {
          ctx.fillStyle = rng() < 0.6 ? 'rgba(25, 40, 22, 0.35)' : 'rgba(110, 140, 70, 0.25)';
          ctx.beginPath();
          ctx.arc(rng() * w, rng() * h, 1 + rng() * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    brick: {
      base: '#9b5737', dark: '#6e3822', light: '#c27a52', side: '#6b3a24', seed: 23,
      detail(ctx, w, h, rng) {
        // 掘り跡のくぼみと土くれ
        for (let i = 0; i < 14; i++) {
          const x = rng() * w;
          const y = rng() * h;
          const rx = 14 + rng() * 26;
          const ry = rx * (0.5 + rng() * 0.3);
          const g = ctx.createRadialGradient(x, y - ry * 0.3, 0, x, y, rx);
          g.addColorStop(0, 'rgba(70, 30, 16, 0.45)');
          g.addColorStop(0.7, 'rgba(90, 40, 20, 0.25)');
          g.addColorStop(1, 'rgba(210, 150, 110, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 1100; i++) {
          ctx.fillStyle = rng() < 0.55 ? 'rgba(85, 40, 22, 0.35)' : 'rgba(220, 160, 120, 0.3)';
          ctx.beginPath();
          ctx.ellipse(rng() * w, rng() * h, 1 + rng() * 3, 0.8 + rng() * 2, rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    sheep: {
      base: '#7e9f4f', dark: '#5b7a36', light: '#a6c46b', side: '#566f33', seed: 37,
      detail(ctx, w, h, rng) {
        // 草の葉先
        ctx.lineCap = 'round';
        for (let i = 0; i < 3200; i++) {
          const x = rng() * w;
          const y = rng() * h;
          const l = 3 + rng() * 6;
          ctx.strokeStyle = rng() < 0.5 ? 'rgba(60, 90, 35, 0.32)' : 'rgba(190, 215, 130, 0.26)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rng() - 0.5) * 3, y - l);
          ctx.stroke();
        }
      }
    },
    wheat: {
      base: '#bf8f34', dark: '#966b24', light: '#dcb35a', side: '#8a6624', seed: 41,
      detail(ctx, w, h, rng) {
        // 畝の列
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-0.42);
        for (let y = -h; y < h; y += 15) {
          ctx.fillStyle = 'rgba(150, 110, 40, 0.22)';
          ctx.fillRect(-w, y, w * 2, 5);
          ctx.fillStyle = 'rgba(245, 220, 140, 0.14)';
          ctx.fillRect(-w, y + 7, w * 2, 3);
        }
        ctx.restore();
        for (let i = 0; i < 1600; i++) {
          ctx.fillStyle = rng() < 0.5 ? 'rgba(140, 100, 35, 0.25)' : 'rgba(250, 230, 160, 0.22)';
          ctx.fillRect(rng() * w, rng() * h, 1.2, 2 + rng() * 3);
        }
      }
    },
    ore: {
      base: '#6c7075', dark: '#45484c', light: '#93979b', side: '#4a4d51', seed: 53,
      detail(ctx, w, h, rng) {
        // 岩肌のひび
        ctx.lineCap = 'round';
        for (let i = 0; i < 60; i++) {
          let x = rng() * w;
          let y = rng() * h;
          ctx.strokeStyle = 'rgba(30, 32, 36, 0.38)';
          ctx.lineWidth = 0.8 + rng() * 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += (rng() - 0.5) * 44;
            y += (rng() - 0.5) * 44;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let i = 0; i < 500; i++) {
          ctx.fillStyle = rng() < 0.5 ? 'rgba(200, 204, 208, 0.25)' : 'rgba(35, 38, 42, 0.3)';
          ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3);
        }
      }
    },
    desert: {
      base: '#cdae72', dark: '#a98a55', light: '#e2c690', side: '#9c7f4e', seed: 67,
      detail(ctx, w, h, rng) {
        // 風紋
        for (let i = 0; i < 34; i++) {
          const y0 = (i / 34) * h + (rng() - 0.5) * 10;
          ctx.strokeStyle = i % 2 ? 'rgba(160, 128, 80, 0.3)' : 'rgba(250, 236, 200, 0.32)';
          ctx.lineWidth = 1.5 + rng() * 2;
          ctx.beginPath();
          for (let x = -10; x <= w + 10; x += 8) {
            const y = y0 + Math.sin(x * 0.018 + i) * 9 + Math.sin(x * 0.051 + i * 2.1) * 3;
            if (x === -10) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    }
  };

  function terrainCanvas(B3D, terrain) {
    const P = TERRAIN_PAINT[terrain];
    return B3D.canvas.cached(`cat-terrain:${terrain}`, 512, 512, (ctx, w, h) => {
      const rng = B3D.mulberry32(P.seed);
      B3D.canvas.paintNoise(ctx, w, h, P.base, 18, P.seed, 0);
      for (let i = 0; i < 80; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const r = 12 + rng() * 46;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const c = rng() < 0.5 ? P.dark : P.light;
        g.addColorStop(0, rgba(c, 0.32));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      P.detail(ctx, w, h, rng);
      // 縁に向かって少し沈ませる
      const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5);
      v.addColorStop(0, 'rgba(0, 0, 0, 0)');
      v.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    });
  }

  function seaCanvas(B3D) {
    return B3D.canvas.cached('cat-sea', 1024, 1024, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5);
      g.addColorStop(0, '#2a5f70');
      g.addColorStop(0.72, '#214f60');
      g.addColorStop(1, '#163a48');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const rng = B3D.mulberry32(97);
      const img = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (rng() - 0.5) * 9;
        img.data[i] += n;
        img.data[i + 1] += n;
        img.data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      // 細かい波
      ctx.lineCap = 'round';
      for (let i = 0; i < 900; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const l = 8 + rng() * 22;
        ctx.strokeStyle = rng() < 0.7 ? 'rgba(170, 215, 228, 0.16)' : 'rgba(10, 35, 48, 0.28)';
        ctx.lineWidth = 1 + rng() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + l / 2, y - 3 - rng() * 3, x + l, y);
        ctx.stroke();
      }
    });
  }

  function tokenCanvas(B3D, num) {
    return B3D.canvas.cached(`cat-token:${num}`, 256, 256, (ctx, w, h) => {
      B3D.canvas.paintNoise(ctx, w, h, '#ebdfc1', 9, 300 + num, 160);
      ctx.strokeStyle = 'rgba(110, 86, 56, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.43, 0, Math.PI * 2);
      ctx.stroke();
      const hot = num === 6 || num === 8;
      ctx.fillStyle = hot ? '#a3342a' : '#2b2119';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `400 ${hot ? 118 : 108}px "Marcellus", Georgia, "Times New Roman", serif`;
      ctx.fillText(String(num), w / 2, h * 0.45);
      const pips = 6 - Math.abs(7 - num);
      const gap = 17;
      for (let i = 0; i < pips; i++) {
        ctx.beginPath();
        ctx.arc(w / 2 + (i - (pips - 1) / 2) * gap, h * 0.76, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function harborCanvas(B3D, ratio, res) {
    return B3D.canvas.cached(`cat-harbor:${ratio}:${res || 'any'}`, 256, 256, (ctx, w, h) => {
      B3D.canvas.paintNoise(ctx, w, h, '#e8dbbd', 9, 500 + ratio, 160);
      ctx.strokeStyle = res ? RES_META[res].color : '#6d5b45';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2b2119';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '400 84px "Marcellus", Georgia, "Times New Roman", serif';
      ctx.fillText(`${ratio}:1`, w / 2, h / 2 + 4);
    });
  }

  window.BoardArena.registerGame({
    id: 'catan',
    name: 'カタンの開拓者たち',
    icon: '',
    category: '開拓・交渉',
    minPlayers: 3,
    maxPlayers: 4,
    description: 'サイコロで資源を産出し、街道・開拓地・都市を築きながら、港や交渉も使って10点を目指す。',

    mount(container, bridge) {
      let isDestroyed = false;
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
      let afterRobberPhase = 'MAIN'; // サイコロ前に騎士を使ったときは盗賊のあとにサイコロへ戻る
      let lastDice = [3, 4];
      let hasRolled = false;
      let diceJustRolled = false;
      let longestRoadHolder = null;
      let largestArmyHolder = null;
      let statusBannerText = 'カタン島へようこそ。最初の開拓地を置くか、「おまかせ配置」ですぐに始められます。';

      // DOM構築
      container.innerHTML = `
        <style>
          .cat-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: var(--text);
            font-family: var(--font-ui);
          }
          .cat-top-bar, .cat-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px 16px;
            padding: 10px 12px;
            background: var(--bg-raised);
            border: 1px solid var(--line);
            border-radius: 6px;
          }
          .cat-players-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            flex: 1 1 520px;
            min-width: 0;
          }
          .cat-player {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px 7px 10px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 4px;
            min-width: 0;
            transition: border-color 0.25s, background 0.25s;
          }
          .cat-player.is-turn {
            border-color: rgba(226, 184, 103, 0.6);
            background: rgba(226, 184, 103, 0.07);
          }
          .cat-swatch {
            flex: none;
            width: 12px;
            height: 12px;
            border-radius: 2px;
            background: var(--c);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
          }
          .cat-player-name {
            display: flex;
            align-items: baseline;
            gap: 8px;
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
          }
          .cat-player-vp {
            font-size: 15px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
          }
          .cat-player-vp small {
            margin-left: 2px;
            font-family: var(--font-ui);
            font-size: 10px;
            color: var(--text-3);
          }
          .cat-player-sub {
            font-size: 11px;
            color: var(--text-3);
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }
          .cat-award {
            margin-left: 6px;
            padding: 0 5px;
            border: 1px solid rgba(226, 184, 103, 0.45);
            border-radius: 2px;
            color: #e2b867;
            font-size: 10px;
            font-weight: 500;
          }
          .cat-controls, .cat-actions {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
          }
          .cat-actions { justify-content: flex-end; }
          .cat-btn, .cat-select {
            appearance: none;
            -webkit-appearance: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid var(--line-strong);
            border-radius: 4px;
            color: var(--text-2);
            font: 500 12px/1.4 var(--font-ui);
            letter-spacing: 0.04em;
            white-space: nowrap;
            cursor: pointer;
            transition: color 0.2s, border-color 0.2s, background 0.2s;
          }
          .cat-select {
            padding-right: 28px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a8a6a0' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
          }
          .cat-select option { background: #161618; color: #ecebe6; }
          .cat-btn:hover:not(:disabled), .cat-select:hover {
            color: var(--text);
            border-color: rgba(255, 255, 255, 0.34);
          }
          .cat-btn:disabled { opacity: 0.35; cursor: not-allowed; }
          .cat-btn.is-primary {
            background: var(--text);
            border-color: var(--text);
            color: var(--text-inverse);
            font-weight: 700;
          }
          .cat-btn.is-primary:hover:not(:disabled) { background: #fff; color: var(--text-inverse); }
          .cat-btn.is-active {
            background: rgba(226, 184, 103, 0.1);
            border-color: rgba(226, 184, 103, 0.7);
            color: #e2b867;
          }
          .cat-cost { display: inline-flex; gap: 2px; }
          .cat-cost i {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--c);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
          }

          .cat-stage-wrap { position: relative; }
          .cat-stage-wrap .ba3d-stage { height: clamp(420px, calc(100vh - 300px), 860px); }
          .cat-status {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 5;
            max-width: min(560px, calc(100% - 130px));
            padding: 8px 12px;
            background: rgba(14, 12, 11, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #ecebe6;
            font-size: 13px;
            line-height: 1.55;
            pointer-events: none;
          }
          .cat-dice {
            position: absolute;
            left: 12px;
            bottom: 12px;
            z-index: 5;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px 8px 10px;
            background: rgba(14, 12, 11, 0.55);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            pointer-events: none;
            transition: opacity 0.3s;
          }
          .cat-dice.is-idle { opacity: 0.4; }
          .cat-die {
            width: 28px;
            height: 28px;
            padding: 4px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            place-items: center;
            border-radius: 6px;
            background: #efe8da;
            box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.45);
          }
          .cat-die i { width: 5px; height: 5px; border-radius: 50%; }
          .cat-die i.on { background: #2a2119; }
          .cat-die.is-red { background: #a5342a; }
          .cat-die.is-red i.on { background: #f3ead8; }
          .cat-dice-sum {
            min-width: 26px;
            text-align: center;
            font-size: 20px;
            font-weight: 700;
            line-height: 1;
            font-variant-numeric: tabular-nums;
            color: #ecebe6;
          }
          .cat-dice.is-rolling .cat-die { animation: catRoll 0.55s cubic-bezier(0.2, 0.7, 0.2, 1); }
          .cat-dice.is-rolling .cat-die.is-red { animation-delay: 0.06s; }
          @keyframes catRoll {
            0% { transform: translateY(-12px) rotate(-220deg) scale(0.8); opacity: 0.2; }
            65% { transform: translateY(2px) rotate(10deg); opacity: 1; }
            100% { transform: none; }
          }

          .cat-hand { display: flex; gap: 6px; flex-wrap: wrap; }
          .cat-res {
            position: relative;
            min-width: 66px;
            padding: 9px 10px 6px;
            display: flex;
            flex-direction: column;
            gap: 1px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 3px;
            overflow: hidden;
          }
          .cat-res::before {
            content: '';
            position: absolute;
            inset: 0 0 auto 0;
            height: 3px;
            background: var(--c);
          }
          .cat-res-name { font-size: 11px; color: var(--text-2); }
          .cat-res b {
            font-size: 19px;
            font-weight: 500;
            line-height: 1.2;
            font-variant-numeric: tabular-nums;
          }
          .cat-res small { font-size: 10px; color: var(--text-3); }
          .cat-res.is-empty b { color: var(--text-3); }
          .cat-wait { font-size: 12px; color: var(--text-3); }
          .cat-prompt { font-size: 12px; color: #e2b867; }

          .cat-modal-overlay {
            position: absolute;
            inset: 0;
            z-index: 20;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(8, 7, 6, 0.6);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
          }
          .cat-modal-overlay.visible { display: flex; }
          .cat-modal-card {
            width: min(560px, 100%);
            max-height: 100%;
            overflow: auto;
            padding: 22px 24px;
            background: var(--bg-raised);
            border: 1px solid var(--line-strong);
            border-radius: 6px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          }
          .cat-modal-title { font-size: 17px; font-weight: 700; }
          .cat-modal-sub { margin-top: 4px; font-size: 12px; color: var(--text-3); }
          .cat-modal-label {
            margin: 16px 0 8px;
            font-size: 11px;
            letter-spacing: 0.08em;
            color: var(--text-3);
          }
          .cat-opts {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
            gap: 6px;
          }
          .cat-opt {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            padding: 8px 10px 8px 13px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 3px;
            color: var(--text);
            font: 500 12px/1.4 var(--font-ui);
            text-align: left;
            cursor: pointer;
            overflow: hidden;
            transition: border-color 0.2s, background 0.2s;
          }
          .cat-opt::before {
            content: '';
            position: absolute;
            inset: 0 auto 0 0;
            width: 3px;
            background: var(--c);
          }
          .cat-opt small { font-size: 10px; color: var(--text-3); }
          .cat-opt:hover:not(:disabled) { border-color: var(--line-strong); }
          .cat-opt.is-selected { border-color: rgba(226, 184, 103, 0.75); background: rgba(226, 184, 103, 0.08); }
          .cat-opt:disabled { opacity: 0.4; cursor: not-allowed; }
          .cat-modal-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            justify-content: flex-end;
            margin-top: 18px;
          }
          .cat-feedback { min-height: 18px; margin-top: 12px; font-size: 12px; color: var(--text-2); }
          .cat-feedback.is-ok { color: #8fc79a; }
          .cat-feedback.is-ng { color: #d39486; }
          .cat-dev-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 6px;
            padding: 10px 12px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 3px;
          }
          .cat-dev-row b { font-size: 13px; }
          .cat-dev-row p { margin-top: 2px; font-size: 11px; color: var(--text-3); }
          .cat-empty { padding: 12px 0; font-size: 12px; color: var(--text-3); }
          .cat-rank {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 4px;
            border-bottom: 1px solid var(--line);
            font-size: 13px;
          }
          .cat-rank-pos { width: 18px; color: var(--text-3); font-variant-numeric: tabular-nums; }
          .cat-rank-meta { font-size: 11px; color: var(--text-3); }
          .cat-rank-vp { margin-left: auto; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
          .cat-rank-vp small { margin-left: 2px; font-family: var(--font-ui); font-size: 10px; color: var(--text-3); }

          .ba3d-label.cat-gain { padding: 0; background: none; }
          .cat-gain span {
            display: inline-block;
            padding: 2px 7px;
            border-left: 2px solid var(--c);
            border-radius: 2px;
            background: rgba(14, 12, 11, 0.74);
            color: #ecebe6;
            font-size: 11px;
            animation: catGain 1.7s ease-out both;
          }
          @keyframes catGain {
            0% { opacity: 0; transform: translateY(8px); }
            14% { opacity: 1; transform: none; }
            72% { opacity: 1; transform: translateY(-8px); }
            100% { opacity: 0; transform: translateY(-16px); }
          }
          .ba3d-label.cat-harbor {
            padding: 1px 6px;
            background: rgba(14, 12, 11, 0.5);
            color: rgba(236, 235, 230, 0.86);
            font-size: 10px;
          }

          @media (max-width: 640px) {
            .cat-stage-wrap .ba3d-stage { height: min(62vh, 470px); }
            .cat-status { max-width: calc(100% - 110px); font-size: 12px; }
            .cat-player-sub { display: none; }
            .cat-res { min-width: 56px; }
          }
        </style>

        <div class="cat-wrapper">
          <div class="cat-top-bar">
            <div class="cat-players-row" id="cat-players-row"></div>
            <div class="cat-controls">
              <select id="cat-pcount-sel" class="cat-select" aria-label="人数">
                <option value="3">3人</option>
                <option value="4" selected>4人</option>
              </select>
              <button class="cat-btn" id="cat-fast-setup-btn" title="初期配置を自動で済ませて、サイコロから始めます">おまかせ配置</button>
              <button class="cat-btn" id="cat-new-btn">新しい島</button>
            </div>
          </div>

          <div class="cat-stage-wrap" id="cat-stage-wrap">
            <div class="cat-status" id="cat-banner"></div>
            <div class="cat-dice is-idle" id="cat-dice-box" aria-label="サイコロの目">
              <div class="cat-die" id="cat-die-1"></div>
              <div class="cat-die is-red" id="cat-die-2"></div>
              <span class="cat-dice-sum" id="cat-dice-sum">–</span>
            </div>
            <div class="cat-modal-overlay" id="cat-modal-overlay">
              <div class="cat-modal-card" id="cat-modal-card"></div>
            </div>
          </div>

          <div class="cat-dock">
            <div class="cat-hand" id="cat-res-hand"></div>
            <div class="cat-actions" id="cat-actions-bar"></div>
          </div>
        </div>
      `;

      const playersRowEl = container.querySelector('#cat-players-row');
      const pcountSelEl = container.querySelector('#cat-pcount-sel');
      const fastSetupBtnEl = container.querySelector('#cat-fast-setup-btn');
      const newBtnEl = container.querySelector('#cat-new-btn');
      const stageWrapEl = container.querySelector('#cat-stage-wrap');
      const bannerEl = container.querySelector('#cat-banner');
      const diceBoxEl = container.querySelector('#cat-dice-box');
      const die1El = container.querySelector('#cat-die-1');
      const die2El = container.querySelector('#cat-die-2');
      const diceSumEl = container.querySelector('#cat-dice-sum');
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

        // 隣り合うタイルが共有する角は浮動小数の誤差で座標がわずかにずれるので、近いものを同じ頂点とみなす
        function getOrCreateVertex(vx, vz) {
          const found = vertices.find((v) => Math.abs(v.x - vx) < 0.01 && Math.abs(v.z - vz) < 0.01);
          if (found) return found;
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
          { ratio: 3, res: null },
          { ratio: 3, res: null },
          { ratio: 3, res: null },
          { ratio: 3, res: null },
          { ratio: 2, res: 'wood' },
          { ratio: 2, res: 'brick' },
          { ratio: 2, res: 'sheep' },
          { ratio: 2, res: 'wheat' },
          { ratio: 2, res: 'ore' }
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
            ...hInfo
          });
        }
      }

      // ====================================================
      // 2. プレイヤー＆建設・ルール検証関数
      // ====================================================
      function playerName(idx, isCpu) {
        if (idx === mySeat) return 'あなた';
        return isCpu ? `CPU ${PLAYER_THEMES[idx].colorName}` : `${PLAYER_THEMES[idx].colorName}のプレイヤー`;
      }

      function createPlayer(idx) {
        const isCpu = vsCpu && idx !== mySeat;
        return {
          idx,
          name: playerName(idx, isCpu),
          color: PLAYER_THEMES[idx].color,
          isCpu,
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

        // 10点で勝利
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
        hasRolled = false;
        buildMode = null;
        freeRoadsRemaining = 0;
        devPlayedThisTurn = false;
        afterRobberPhase = 'MAIN';
        closeModal();

        if (autoSetup) {
          performFastBalancedSetup();
        } else {
          turnIndex = 0;
          setupStep = 0;
          setupSubPhase = 'SETTLEMENT';
          lastSetupVertexId = null;
          phase = 'SETUP';
          statusBannerText = '初期配置（1巡目）: 光っている交差点を選んで、最初の開拓地を置いてください。';
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
        statusBannerText = '初期配置が終わりました。サイコロを振って始めましょう。';
        renderAll();
      }

      function advanceSetupTurn() {
        setupStep++;
        if (setupStep >= playerCount * 2) {
          turnIndex = 0;
          phase = 'ROLL';
          devPlayedThisTurn = false;
          statusBannerText = `全員の初期配置が終わりました。${players[0].name}の手番です。サイコロを振ってください。`;
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
        if (!players[turnIndex].isCpu) {
          statusBannerText = `初期配置（${setupStep < playerCount ? '1' : '2'}巡目）: 光っている交差点を選んで、開拓地を置いてください。`;
        }
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
            statusBannerText = `${players[turnIndex].name}が開拓地と街道を置きました。`;
            advanceSetupTurn();
          }, 650);
        }
      }

      // ダイスロール処理
      function rollDiceAction() {
        if (phase !== 'ROLL') return;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;
        lastDice = [d1, d2];
        hasRolled = true;
        diceJustRolled = true;
        CatanSfx.dice();

        const activeP = players[turnIndex];

        if (sum === 7) {
          CatanSfx.robber();
          // 8枚以上の手札を持つプレイヤーは半分切り捨てバースト
          const burstNames = [];
          players.forEach((p) => {
            const tot = totalRes(p);
            if (tot >= 8) {
              const dropCount = Math.floor(tot / 2);
              for (let i = 0; i < dropCount; i++) {
                const haveTypes = RES_TYPES.filter((k) => p.res[k] > 0);
                const pick = haveTypes[Math.floor(Math.random() * haveTypes.length)];
                p.res[pick]--;
              }
              burstNames.push(`${p.name}（${dropCount}枚）`);
            }
          });
          const burstMsg = burstNames.length > 0 ? `${burstNames.join('、')}が手札を半分捨てました。` : '';

          if (activeP.isCpu) {
            cpuMoveRobber(activeP);
            if (burstMsg) statusBannerText = `出目は 7。${burstMsg}${statusBannerText}`;
            phase = 'MAIN';
            renderAll();
          } else {
            phase = 'ROBBER_MOVE';
            statusBannerText = `出目は 7。${burstMsg}盗賊を動かすタイルを選んでください。`;
            renderAll();
          }
          return;
        }

        // 通常の資源産出
        const gains = new Map();
        hexes.forEach((h) => {
          if (h.number === sum && !h.hasRobber && h.terrain !== 'desert') {
            h.vertexIds.forEach((vid) => {
              const b = vertices[vid].building;
              if (b) {
                const amt = b.type === 'city' ? 2 : 1;
                players[b.owner].res[h.terrain] += amt;
                const key = `${b.owner}:${h.terrain}`;
                gains.set(key, (gains.get(key) || 0) + amt);
                view.pendingGains.push({ vid, terrain: h.terrain, amt });
              }
            });
          }
        });
        view.flashNumber = sum;

        const gainText = Array.from(gains.entries()).map(([key, amt]) => {
          const [owner, terrain] = key.split(':');
          return `${players[owner].name} ${RES_META[terrain].name}+${amt}`;
        });

        phase = 'MAIN';
        statusBannerText = `出目は ${sum}。${gainText.length > 0 ? gainText.join('、') : '資源の産出はありません。'}`;
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
            stealText = `${victim.name}から資源を1枚奪いました。`;
          }
        }

        CatanSfx.robber();
        statusBannerText = `${p.name}が盗賊を${RES_META[targetHex.terrain].terrain}へ動かしました。${stealText}`;
        phase = afterRobberPhase;
        afterRobberPhase = 'MAIN';
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
          statusBannerText = '置いた開拓地に接する道を選んで、街道を1本置いてください。';
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
          statusBannerText = `${p.name}が開拓地を建てました（+1点）。`;
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
          statusBannerText = `${p.name}が開拓地を都市にしました（+1点、産出が2倍）。`;
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
            statusBannerText = '街道建設カードの街道を置き終えました。';
          } else {
            statusBannerText = 'もう1本、街道を置く場所を選んでください。';
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
          statusBannerText = `${p.name}が街道を建てました。`;
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
        // CPU が引いたカードの種類は伏せる
        statusBannerText = p.isCpu
          ? `${p.name}が発展カードを1枚引きました。`
          : `${p.name}が発展カード「${DEV_CARD_META[cardType].name}」を引きました。`;
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
        if (!players[turnIndex].isCpu) {
          statusBannerText = `${players[turnIndex].name}の手番です。サイコロを振ってください。`;
        }
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
        cpuTimer = setTimeout(() => {
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
            statusBannerText = `${cpu.name}が開拓地を都市にしました。`;
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
            statusBannerText = `${cpu.name}が開拓地を建てました。`;
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
            statusBannerText = `${cpu.name}が街道を延ばしました。`;
          }

          if (!updateAwardsAndCheckVictory()) {
            endTurn();
          }
        }, 650);
      }

      // ====================================================
      // 4. 交易・発展カード・勝敗のダイアログ
      // ====================================================
      function closeModal() {
        modalOverlayEl.classList.remove('visible');
      }

      function openModal(html) {
        modalCardEl.innerHTML = html;
        modalOverlayEl.classList.add('visible');
      }

      function openTradeModal(p) {
        const rates = getTradeRates(p);
        let giveRes = RES_TYPES.find((k) => p.res[k] >= rates[k]) || RES_TYPES.reduce((a, b) => (p.res[b] > p.res[a] ? b : a));
        let wantRes = RES_TYPES.find((k) => k !== giveRes) || 'wheat';
        let feedback = { text: '', tone: '' };

        function renderTradeContent() {
          const giveBtns = RES_TYPES.map((k) => {
            const rm = RES_META[k];
            return `<button class="cat-opt ${giveRes === k ? 'is-selected' : ''}" data-give="${k}" style="--c:${rm.color}">
              ${rm.name}<small>${p.res[k]}枚 · ${rates[k]}:1</small>
            </button>`;
          }).join('');

          const wantBtns = RES_TYPES.map((k) => {
            const rm = RES_META[k];
            return `<button class="cat-opt ${wantRes === k ? 'is-selected' : ''}" data-want="${k}" style="--c:${rm.color}" ${k === giveRes ? 'disabled' : ''}>
              ${rm.name}<small>1枚もらう</small>
            </button>`;
          }).join('');

          const canBankTrade = p.res[giveRes] >= rates[giveRes] && giveRes !== wantRes;
          const canPlayerOffer = p.res[giveRes] >= 1 && giveRes !== wantRes;

          modalCardEl.innerHTML = `
            <div class="cat-modal-title">交易</div>
            <div class="cat-modal-sub">銀行とは港のレートで、他のプレイヤーとは1対1で交換できます。</div>
            <div class="cat-modal-label">出す資源</div>
            <div class="cat-opts">${giveBtns}</div>
            <div class="cat-modal-label">もらう資源</div>
            <div class="cat-opts">${wantBtns}</div>
            <div class="cat-feedback ${feedback.tone}">${feedback.text}</div>
            <div class="cat-modal-actions">
              <button class="cat-btn" id="cat-close-trade">閉じる</button>
              <button class="cat-btn" id="cat-do-p2p-trade" ${canPlayerOffer ? '' : 'disabled'}>
                1対1で提案（${RES_META[giveRes].name}1 → ${RES_META[wantRes].name}1）
              </button>
              <button class="cat-btn is-primary" id="cat-do-bank-trade" ${canBankTrade ? '' : 'disabled'}>
                銀行と交換（${RES_META[giveRes].name}${rates[giveRes]} → ${RES_META[wantRes].name}1）
              </button>
            </div>
          `;

          modalCardEl.querySelectorAll('[data-give]').forEach((b) => {
            b.onclick = () => {
              giveRes = b.getAttribute('data-give');
              if (wantRes === giveRes) wantRes = RES_TYPES.find((k) => k !== giveRes);
              feedback = { text: '', tone: '' };
              renderTradeContent();
            };
          });
          modalCardEl.querySelectorAll('[data-want]').forEach((b) => {
            b.onclick = () => { wantRes = b.getAttribute('data-want'); feedback = { text: '', tone: '' }; renderTradeContent(); };
          });
          modalCardEl.querySelector('#cat-close-trade').onclick = closeModal;

          const bankBtn = modalCardEl.querySelector('#cat-do-bank-trade');
          if (bankBtn && canBankTrade) {
            bankBtn.onclick = () => {
              p.res[giveRes] -= rates[giveRes];
              p.res[wantRes] += 1;
              CatanSfx.trade();
              statusBannerText = `${p.name}が${RES_META[giveRes].name}${rates[giveRes]}枚を${RES_META[wantRes].name}1枚と交換しました。`;
              feedback = { text: `${RES_META[wantRes].name}を1枚もらいました。`, tone: 'is-ok' };
              renderTradeContent();
              renderAll();
            };
          }

          const p2pBtn = modalCardEl.querySelector('#cat-do-p2p-trade');
          if (p2pBtn && canPlayerOffer) {
            p2pBtn.onclick = () => {
              // 欲しい資源を2枚以上持ち、出す資源が0〜1枚のプレイヤーが応じる
              const partner = players.find((other) => other.idx !== p.idx && other.res[wantRes] >= 2 && other.res[giveRes] <= 1);
              if (partner) {
                p.res[giveRes]--;
                p.res[wantRes]++;
                partner.res[wantRes]--;
                partner.res[giveRes]++;
                CatanSfx.trade();
                feedback = { text: `${partner.name}が交換に応じました。`, tone: 'is-ok' };
                statusBannerText = `${p.name}と${partner.name}が1対1で交換しました。`;
                renderTradeContent();
                renderAll();
              } else {
                feedback = { text: 'この条件で応じるプレイヤーはいませんでした。', tone: 'is-ng' };
                renderTradeContent();
              }
            };
          }
        }

        renderTradeContent();
        modalOverlayEl.classList.add('visible');
      }

      function openDevCardsModal(p) {
        const rows = p.devCards.length === 0
          ? `<div class="cat-empty">使える発展カードはありません。</div>`
          : p.devCards.map((c, idx) => {
              const meta = DEV_CARD_META[c.type];
              const canUse = !c.boughtTurn && !devPlayedThisTurn && (phase === 'MAIN' || phase === 'ROLL');
              const reason = c.boughtTurn ? '引いた手番は使えません' : devPlayedThisTurn ? 'この手番は使用済み' : '';
              return `
                <div class="cat-dev-row">
                  <div><b>${meta.name}</b><p>${meta.desc}</p></div>
                  <button class="cat-btn ${canUse ? 'is-primary' : ''}" data-use-dev="${idx}" ${canUse ? '' : 'disabled'} title="${reason}">${canUse ? '使う' : reason || '使えません'}</button>
                </div>
              `;
            }).join('');
        const canBuy = canAffordDevCard(p) && phase === 'MAIN';

        openModal(`
          <div class="cat-modal-title">発展カード</div>
          <div class="cat-modal-sub">山札 ${devDeck.length}枚 · 勝利点カード ${p.vpCardsCount}枚</div>
          <div class="cat-modal-label">手元のカード</div>
          <div>${rows}</div>
          <div class="cat-modal-actions">
            <button class="cat-btn" id="cat-close-dev">閉じる</button>
            <button class="cat-btn is-primary" id="cat-buy-dev-btn" ${canBuy ? '' : 'disabled'} title="費用: ${costText('dev')}">
              カードを引く ${costDots('dev')}
            </button>
          </div>
        `);
        modalCardEl.querySelector('#cat-close-dev').onclick = closeModal;
        const buyBtn = modalCardEl.querySelector('#cat-buy-dev-btn');
        if (buyBtn && canBuy) {
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
              afterRobberPhase = phase === 'ROLL' ? 'ROLL' : 'MAIN';
              phase = 'ROBBER_MOVE';
              statusBannerText = '騎士を使いました。盗賊を動かすタイルを選んでください。';
              updateAwardsAndCheckVictory();
              renderAll();
            } else if (card.type === 'road_building') {
              freeRoadsRemaining = 2;
              phase = 'FREE_ROADS';
              statusBannerText = '街道建設: 費用なしで街道を2本置けます。';
              renderAll();
            } else if (card.type === 'year_of_plenty') {
              openYearOfPlentyModal(p);
            } else if (card.type === 'monopoly') {
              openMonopolyModal(p);
            }
          };
        });
      }

      function resourcePicker(attr, hint) {
        return RES_TYPES.map((k) => {
          const rm = RES_META[k];
          return `<button class="cat-opt" ${attr}="${k}" style="--c:${rm.color}">${rm.name}<small>${hint(k)}</small></button>`;
        }).join('');
      }

      function openYearOfPlentyModal(p) {
        openModal(`
          <div class="cat-modal-title">発見</div>
          <div class="cat-modal-sub">銀行からもらう資源を選んでください（2枚）。</div>
          <div class="cat-modal-label">資源</div>
          <div class="cat-opts">${resourcePicker('data-yop', (k) => `手元 ${p.res[k]}枚`)}</div>
        `);
        modalCardEl.querySelectorAll('[data-yop]').forEach((b) => {
          b.onclick = () => {
            const k = b.getAttribute('data-yop');
            p.res[k] += 2;
            CatanSfx.trade();
            statusBannerText = `${p.name}が「発見」で${RES_META[k].name}を2枚もらいました。`;
            closeModal();
            renderAll();
          };
        });
      }

      function openMonopolyModal(p) {
        openModal(`
          <div class="cat-modal-title">独占</div>
          <div class="cat-modal-sub">指定した資源を、他の全員からすべてもらいます。</div>
          <div class="cat-modal-label">資源</div>
          <div class="cat-opts">${resourcePicker('data-mono', () => '全員から')}</div>
        `);
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
            statusBannerText = `${p.name}が「独占」で${RES_META[k].name}を合計${totalTaken}枚集めました。`;
            closeModal();
            renderAll();
          };
        });
      }

      function openVictoryModal(winner) {
        const ranked = players.slice().sort((a, b) => calcPlayerVP(b) - calcPlayerVP(a));
        const rows = ranked.map((p, i) => `
          <div class="cat-rank">
            <span class="cat-rank-pos">${i + 1}</span>
            <span class="cat-swatch" style="--c:${p.color}"></span>
            <div>
              <div>${p.name}</div>
              <div class="cat-rank-meta">騎士 ${p.knightsPlayed} · 交易路 ${computeLongestRoadForPlayer(p.idx)}</div>
            </div>
            <span class="cat-rank-vp">${calcPlayerVP(p)}<small>点</small></span>
          </div>
        `).join('');
        if (winner.idx === mySeat) bridge.recordWin();
        openModal(`
          <div class="cat-modal-title">${winner.name === 'あなた' ? 'あなたの勝利' : `${winner.name}の勝利`}</div>
          <div class="cat-modal-sub">10点に到達しました。</div>
          <div style="margin-top:12px;">${rows}</div>
          <div class="cat-modal-actions">
            <button class="cat-btn is-primary" id="cat-rematch-btn">新しい島でもう一度</button>
          </div>
        `);
        modalCardEl.querySelector('#cat-rematch-btn').onclick = () => initGame(false);
      }

      // ====================================================
      // 5. 3D の島 (共通エンジンの卓上ステージに組み立てる)
      // ====================================================
      const B3D = window.BoardArena3D;
      const TILE_TOP = 0.2;      // タイル天面の高さ (海面 = 0)
      const TOKEN_H = 0.07;
      const ROAD_LEN = HEX_RADIUS * 0.62;
      const ROBBER_ANGLE = 0.62; // 盗賊はタイル中心から右手前に立たせる
      const ROBBER_R = 1.0;
      const SEA_R = 11.0;        // 海の外接半径 (外枠の内側)

      let THREE = null;
      let st = null;
      const view = {
        builtFor: null,
        island: null,
        pieces: null,
        targets: null,
        tiles: new Map(),
        buildings: new Map(),
        roads: new Map(),
        robber: null,
        robberHex: -1,
        labels: [],
        ghost: null,
        hiddenBuilding: null,
        raisedTile: null,
        pulse: null,
        pendingGains: [],
        flashNumber: 0
      };

      const geoC = (key, make) => st.geo.cached(key, make);

      // 頂点の角度 rotDeg から始まる正六角形 (Shape 座標。ワールドでは z = -y)
      function hexShape(r, rotDeg) {
        const s = new THREE.Shape();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 180) * (60 * i + rotDeg);
          const x = r * Math.cos(a);
          const y = -r * Math.sin(a);
          if (i === 0) s.moveTo(x, y);
          else s.lineTo(x, y);
        }
        s.closePath();
        return s;
      }

      function hexPath(r, rotDeg) {
        const p = new THREE.Path();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 180) * (60 * i + rotDeg);
          const x = r * Math.cos(a);
          const y = -r * Math.sin(a);
          if (i === 0) p.moveTo(x, y);
          else p.lineTo(x, y);
        }
        p.closePath();
        return p;
      }

      // 天面を真上から投影した UV (size 四方を 0..1 に。奥 = テクスチャの上)
      function planarUV(g, size) {
        const pos = g.attributes.position;
        const uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          uv.setXY(i, pos.getX(i) / size + 0.5, 0.5 - pos.getZ(i) / size);
        }
        uv.needsUpdate = true;
        return g;
      }

      // ---- 材質 ----
      const facet = (hex, rough = 0.85) => st.kit.cached(`cat-facet:${hex}:${rough}`, () => new THREE.MeshStandardMaterial({
        color: st.kit.color(hex), roughness: rough, metalness: 0, flatShading: true, envMapIntensity: 0.45
      }));

      function terrainMats(terrain) {
        return [
          st.kit.cached(`cat-tile-top:${terrain}`, () => new THREE.MeshStandardMaterial({
            map: st.kit.texture(terrainCanvas(B3D, terrain)), roughness: 0.88, metalness: 0, envMapIntensity: 0.35
          })),
          st.kit.cached(`cat-tile-side:${terrain}`, () => new THREE.MeshStandardMaterial({
            color: st.kit.color(TERRAIN_PAINT[terrain].side), roughness: 0.8, metalness: 0, envMapIntensity: 0.35
          }))
        ];
      }

      function pieceMat(owner) {
        const hex = PLAYER_THEMES[owner].color;
        return st.kit.cached(`cat-piece:${hex}`, () => new THREE.MeshPhysicalMaterial({
          color: st.kit.color(hex),
          roughness: 0.5,
          metalness: 0,
          clearcoat: 0.3,
          clearcoatRoughness: 0.4,
          envMapIntensity: 0.75,
          bumpMap: st.kit.texture(B3D.canvas.wood('maple', 23), { repeat: 2.5, srgb: false }),
          bumpScale: 0.0025
        }));
      }

      const targetMat = () => st.kit.cached('cat-target', () => new THREE.MeshBasicMaterial({
        color: st.kit.color('#f4ead2'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false
      }));

      // ---- 駒の形 ----
      function houseGeo() {
        return geoC('cat-house', () => {
          const s = new THREE.Shape();
          s.moveTo(-0.17, 0);
          s.lineTo(0.17, 0);
          s.lineTo(0.17, 0.19);
          s.lineTo(0, 0.35);
          s.lineTo(-0.17, 0.19);
          s.closePath();
          const g = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2, curveSegments: 4 });
          g.translate(0, 0.014, -0.12);
          return g;
        });
      }

      function cityGeo() {
        return geoC('cat-city', () => {
          const s = new THREE.Shape();
          s.moveTo(-0.28, 0);
          s.lineTo(0.28, 0);
          s.lineTo(0.28, 0.2);
          s.lineTo(0.02, 0.2);
          s.lineTo(0.02, 0.37);
          s.lineTo(-0.13, 0.52);
          s.lineTo(-0.28, 0.37);
          s.closePath();
          const g = new THREE.ExtrudeGeometry(s, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2, curveSegments: 4 });
          g.translate(0, 0.014, -0.13);
          return g;
        });
      }

      const roadGeo = () => geoC('cat-road', () => st.geo.roundedBox(0.12, 0.09, ROAD_LEN, 0.025, 2).translate(0, 0.045, 0));

      const robberGeo = () => geoC('cat-robber', () => st.geo.lathe([
        [0, 0], [0.2, 0], [0.215, 0.025], [0.2, 0.06], [0.155, 0.11], [0.165, 0.2], [0.18, 0.32],
        [0.165, 0.42], [0.125, 0.5], [0.09, 0.55], [0.12, 0.6], [0.135, 0.67], [0.12, 0.74], [0.075, 0.79], [0, 0.805]
      ], 40));

      // ---- 地形の小物 ----
      // taken に渡した点 (先に置いた小物) とも重ならないように散らす
      function scatter(rng, count, minGap, rMin = 0.8, rMax = 1.38, taken = []) {
        const pts = [];
        let tries = 0;
        while (pts.length < count && tries++ < 500) {
          const a = rng() * Math.PI * 2;
          // 盗賊の立ち位置の周りは空けておく
          const d = Math.atan2(Math.sin(a - ROBBER_ANGLE), Math.cos(a - ROBBER_ANGLE));
          if (Math.abs(d) < 0.5) continue;
          const r = rMin + Math.sqrt(rng()) * (rMax - rMin);
          const x = Math.cos(a) * r;
          const z = Math.sin(a) * r;
          if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < minGap)) continue;
          if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < (p.gap || minGap))) continue;
          pts.push({ x, z, gap: minGap });
        }
        return pts;
      }

      function rockGeo(variant) {
        return geoC(`cat-rock:${variant}`, () => {
          const g = new THREE.DodecahedronGeometry(0.26, 0);
          const rng = B3D.mulberry32(variant * 71 + 3);
          const pos = g.attributes.position;
          const offsets = new Map();
          for (let i = 0; i < pos.count; i++) {
            const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
            if (!offsets.has(key)) offsets.set(key, [(rng() - 0.5) * 0.1, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.1]);
            const d = offsets.get(key);
            pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
          }
          g.computeVertexNormals();
          g.translate(0, 0.12, 0);
          return g;
        });
      }

      const moundGeo = () => geoC('cat-mound', () => new THREE.SphereGeometry(0.34, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2));

      function addProps(group, terrain, rng) {
        const add = (mesh, x, z, rotY = rng() * Math.PI * 2) => {
          mesh.position.set(x, TILE_TOP, z);
          mesh.rotation.y = rotY;
          mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          group.add(mesh);
          return mesh;
        };

        if (terrain === 'wood') {
          scatter(rng, 11, 0.3).forEach((p) => {
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(geoC('cat-trunk', () => new THREE.CylinderGeometry(0.022, 0.03, 0.1, 6).translate(0, 0.05, 0)), facet('#4a3424', 0.9));
            const crown = new THREE.Mesh(geoC('cat-crown', () => st.geo.lathe([
              [0, 0.06], [0.16, 0.08], [0.06, 0.2], [0.13, 0.19], [0.045, 0.31], [0.095, 0.3], [0, 0.46]
            ], 8)), facet(rng() < 0.5 ? '#2c4a29' : '#39592f'));
            tree.add(trunk, crown);
            const s = 0.75 + rng() * 0.5;
            tree.scale.set(s, s * (0.9 + rng() * 0.3), s);
            add(tree, p.x, p.z);
          });
        } else if (terrain === 'ore') {
          const peaks = scatter(rng, 3, 0.62, 0.8, 1.25);
          peaks.forEach((p, i) => {
            const peak = new THREE.Mesh(rockGeo(i % 3), facet(i === 0 ? '#7a7f85' : '#666b71', 0.92));
            const s = 1.05 + rng() * 0.3;
            peak.scale.set(s, s * (1.6 + rng() * 0.6), s);
            add(peak, p.x, p.z);
          });
          scatter(rng, 4, 0.35, 0.8, 1.4, peaks).forEach((p, i) => {
            const rock = new THREE.Mesh(rockGeo(3 + (i % 2)), facet('#80858b', 0.92));
            const s = 0.35 + rng() * 0.25;
            rock.scale.set(s, s, s);
            add(rock, p.x, p.z);
          });
        } else if (terrain === 'brick') {
          const pts = scatter(rng, 4, 0.55, 0.8, 1.3);
          pts.slice(0, 3).forEach((p) => {
            const mound = new THREE.Mesh(moundGeo(), facet('#9a5536', 0.95));
            const s = 0.75 + rng() * 0.35;
            mound.scale.set(s, s * 0.55, s * 0.85);
            add(mound, p.x, p.z);
          });
          // レンガの山
          const stackPos = pts[3] || { x: -0.9, z: -0.6 };
          const stack = new THREE.Group();
          const brickGeo = geoC('cat-brick', () => st.geo.roundedBox(0.13, 0.055, 0.065, 0.012, 1).translate(0, 0.0275, 0));
          const brickMat = st.kit.matte('#a5482f', { roughness: 0.9 });
          [[-0.14, 0], [0, 0], [0.14, 0], [-0.07, 1], [0.07, 1], [0, 2]].forEach(([x, layer]) => {
            const b = new THREE.Mesh(brickGeo, brickMat);
            b.position.set(x, layer * 0.056, 0);
            stack.add(b);
          });
          add(stack, stackPos.x, stackPos.z);
        } else if (terrain === 'sheep') {
          scatter(rng, 4, 0.42).forEach((p) => {
            const sheep = new THREE.Group();
            const body = new THREE.Mesh(geoC('cat-wool', () => new THREE.SphereGeometry(0.1, 14, 10)), st.kit.matte('#ece6d6', { roughness: 1 }));
            body.scale.set(1.35, 0.95, 1);
            body.position.y = 0.12;
            const head = new THREE.Mesh(geoC('cat-head', () => new THREE.SphereGeometry(0.048, 12, 8)), st.kit.matte('#2b2522', { roughness: 0.8 }));
            head.position.set(0.14, 0.15, 0);
            head.scale.set(1.2, 1, 0.9);
            const legGeo = geoC('cat-leg', () => new THREE.CylinderGeometry(0.014, 0.014, 0.08, 5).translate(0, 0.04, 0));
            const legMat = st.kit.matte('#2b2522', { roughness: 0.8 });
            [[0.07, 0.04], [0.07, -0.04], [-0.07, 0.04], [-0.07, -0.04]].forEach(([x, z]) => {
              const leg = new THREE.Mesh(legGeo, legMat);
              leg.position.set(x, 0, z);
              sheep.add(leg);
            });
            sheep.add(body, head);
            add(sheep, p.x, p.z);
          });
        } else if (terrain === 'wheat') {
          scatter(rng, 6, 0.36).forEach((p) => {
            const sheaf = new THREE.Mesh(geoC('cat-sheaf', () => st.geo.lathe([
              [0, 0], [0.065, 0], [0.045, 0.1], [0.04, 0.13], [0.08, 0.21], [0.06, 0.27], [0, 0.29]
            ], 9)), facet('#d3a94f', 0.9));
            const s = 0.85 + rng() * 0.35;
            sheaf.scale.set(s, s, s);
            add(sheaf, p.x, p.z);
          });
        } else if (terrain === 'desert') {
          const dunes = scatter(rng, 3, 0.7, 0.8, 1.2);
          dunes.forEach((p) => {
            const dune = new THREE.Mesh(moundGeo(), st.kit.matte('#d9bf88', { roughness: 0.95 }));
            const s = 0.85 + rng() * 0.3;
            dune.scale.set(s * 1.5, s * 0.2, s * 0.8);
            add(dune, p.x, p.z);
          });
          scatter(rng, 2, 0.4, 0.9, 1.35, dunes).forEach((p) => {
            const rock = new THREE.Mesh(rockGeo(5), facet('#9c8566', 0.92));
            rock.scale.set(0.3, 0.25, 0.3);
            add(rock, p.x, p.z);
          });
        }
      }

      // ---- タイル・チップ・港 ----
      function tileGeo() {
        return geoC('cat-tile', () => {
          const bevel = 0.035;
          const g = st.geo.slab(1, 1, TILE_TOP, { shape: hexShape(HEX_RADIUS * 0.965 - bevel, -30), bevel, bevelSegments: 3 });
          return planarUV(g, HEX_RADIUS * 2);
        });
      }

      function makeNumberToken(n) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(geoC('cat-token', () => st.geo.disc(0.54, TOKEN_H, 0.022)), st.kit.matte('#e3d5b2', { roughness: 0.7 }));
        body.castShadow = true;
        body.receiveShadow = true;
        const cap = new THREE.Mesh(
          geoC('cat-token-cap', () => new THREE.CircleGeometry(0.518, 48).rotateX(-Math.PI / 2)),
          st.kit.cached(`cat-token:${n}`, () => new THREE.MeshStandardMaterial({ map: st.kit.texture(tokenCanvas(B3D, n)), roughness: 0.62, envMapIntensity: 0.4 }))
        );
        cap.position.y = TOKEN_H / 2 + 0.0008;
        g.add(body, cap);
        g.position.y = TILE_TOP + TOKEN_H / 2;
        return g;
      }

      function makeTile(h, rng) {
        const g = new THREE.Group();
        const tile = new THREE.Mesh(tileGeo(), terrainMats(h.terrain));
        tile.position.y = TILE_TOP / 2;
        tile.castShadow = true;
        tile.receiveShadow = true;
        g.add(tile);
        addProps(g, h.terrain, rng);
        if (h.number) g.add(makeNumberToken(h.number));
        return g;
      }

      function makeHarbor(hb, i) {
        const v1 = vertices[hb.v1];
        const v2 = vertices[hb.v2];
        const mx = (v1.x + v2.x) / 2;
        const mz = (v1.z + v2.z) / 2;
        const len = Math.hypot(mx, mz) || 1;
        const hx = mx + (mx / len) * 0.95;
        const hz = mz + (mz / len) * 0.95;

        const g = new THREE.Group();
        g.position.set(hx, 0, hz);
        // 船着き場の板 (港を使える2つの交差点へ向けて)
        const plankGeo = geoC('cat-plank', () => st.geo.roundedBox(0.15, 0.045, 1, 0.012, 1));
        const plankMat = st.kit.wood('oak', { repeat: 0.6, seed: 31, clearcoat: 0.05, roughness: 0.7 });
        [v1, v2].forEach((v) => {
          const sx = v.x + (hx - v.x) * 0.16;
          const sz = v.z + (hz - v.z) * 0.16;
          const ex = v.x + (hx - v.x) * 0.66;
          const ez = v.z + (hz - v.z) * 0.66;
          const plank = new THREE.Mesh(plankGeo, plankMat);
          plank.position.set((sx + ex) / 2 - hx, 0.03, (sz + ez) / 2 - hz);
          plank.rotation.y = Math.atan2(ex - sx, ez - sz);
          plank.scale.z = Math.hypot(ex - sx, ez - sz);
          plank.castShadow = true;
          plank.receiveShadow = true;
          g.add(plank);
        });
        const token = new THREE.Group();
        const body = new THREE.Mesh(geoC('cat-harbor-token', () => st.geo.disc(0.4, 0.06, 0.018)), st.kit.matte('#e3d5b2', { roughness: 0.7 }));
        body.castShadow = true;
        const cap = new THREE.Mesh(
          geoC('cat-harbor-cap', () => new THREE.CircleGeometry(0.382, 48).rotateX(-Math.PI / 2)),
          st.kit.cached(`cat-harbor:${hb.ratio}:${hb.res}`, () => new THREE.MeshStandardMaterial({ map: st.kit.texture(harborCanvas(B3D, hb.ratio, hb.res)), roughness: 0.62, envMapIntensity: 0.4 }))
        );
        cap.position.y = 0.0308;
        token.add(body, cap);
        token.position.y = 0.03;
        g.add(token);
        view.island.add(g);

        g.scale.set(0.01, 0.01, 0.01);
        st.animate(g, { scale: 1 }, { duration: 420, delay: 950 + i * 45, ease: 'outBack' });

        if (hb.res) {
          const lb = st.label(RES_META[hb.res].name, { className: 'cat-harbor', offsetY: 24 });
          lb.at(hx, 0.05, hz);
          view.labels.push(lb);
        }
      }

      function buildSea() {
        // 海 (天面に手描きの波) と、それを囲む木の外枠
        const seaGeo = st.geo.slab(1, 1, 0.2, { shape: hexShape(SEA_R + 0.06, 0), bevel: 0.01, bevelSegments: 1 });
        planarUV(seaGeo, (SEA_R + 0.1) * 2);
        const sea = new THREE.Mesh(seaGeo, [
          new THREE.MeshPhysicalMaterial({
            map: st.kit.texture(seaCanvas(B3D)), roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.6
          }),
          st.kit.matte('#1b3a48')
        ]);
        sea.position.y = -0.1;
        sea.receiveShadow = true;
        st.root.add(sea);

        const bevel = 0.06;
        const frameShape = hexShape(SEA_R + 1.05 - bevel, 0);
        frameShape.holes.push(hexPath(SEA_R + bevel, 0));
        const frame = new THREE.Mesh(
          st.geo.slab(1, 1, 0.46, { shape: frameShape, bevel, bevelSegments: 4 }),
          st.kit.wood('walnut', { repeat: 0.14, seed: 19, clearcoat: 0.4 })
        );
        frame.position.y = 0.1 - 0.23;
        frame.castShadow = true;
        frame.receiveShadow = true;
        st.root.add(frame);
      }

      function initStage(threeLib) {
        THREE = threeLib;
        st = B3D.createStage(THREE, stageWrapEl, {
          embed: true,
          radius: 28,
          phi: 0.58,
          extent: 11,
          tableY: -0.36,
          tableWood: 'darkWalnut',
          minRadius: 12,
          maxRadius: 40,
          maxPhi: 1.2,
          onFrame(now) {
            if (view.pulse) view.pulse.opacity = 0.42 + 0.34 * (0.5 + 0.5 * Math.sin(now / 240));
          }
        });
        view.island = new THREE.Group();
        view.pieces = new THREE.Group();
        view.targets = new THREE.Group();
        st.root.add(view.island, view.pieces, view.targets);
        view.pulse = targetMat();
        buildSea();
        B3D.current = st;
      }

      // ---- 盤面の同期 ----
      function buildIsland() {
        view.builtFor = hexes;
        clearGhost();
        st.clearGroup(view.island);
        st.clearGroup(view.pieces);
        st.clearGroup(view.targets);
        view.tiles.clear();
        view.buildings.clear();
        view.roads.clear();
        view.labels.forEach((lb) => lb.remove());
        view.labels = [];
        view.robber = null;
        view.robberHex = -1;
        view.pendingGains = [];
        view.flashNumber = 0;

        const seed = Math.floor(Math.random() * 1e9);
        hexes.forEach((h) => {
          const ring = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r));
          const group = makeTile(h, B3D.mulberry32(seed + h.id * 7919));
          group.position.set(h.x, 2.4 + ring * 0.5, h.z);
          view.island.add(group);
          view.tiles.set(h.id, group);
          st.animate(group, { position: { y: 0 } }, { duration: 560, delay: 100 + ring * 140 + (h.id % 4) * 30, ease: 'outCubic' });
        });
        harbors.forEach((hb, i) => makeHarbor(hb, i));
      }

      const robberSpot = (h) => ({ x: h.x + Math.cos(ROBBER_ANGLE) * ROBBER_R, z: h.z + Math.sin(ROBBER_ANGLE) * ROBBER_R });

      function syncRobber() {
        const h = hexes.find((x) => x.hasRobber);
        if (!h) return;
        const spot = robberSpot(h);
        if (!view.robber) {
          view.robber = new THREE.Mesh(robberGeo(), st.kit.matte('#34302c', { roughness: 0.55 }));
          view.robber.castShadow = true;
          view.robber.receiveShadow = true;
          view.robber.position.set(spot.x, TILE_TOP + 2.4, spot.z);
          view.island.add(view.robber);
          st.animate(view.robber, { position: { y: TILE_TOP } }, { duration: 560, delay: 1150, ease: 'outBounce' });
          view.robberHex = h.id;
        } else if (view.robberHex !== h.id) {
          view.robberHex = h.id;
          st.animate(view.robber, { position: { x: spot.x, y: TILE_TOP, z: spot.z } }, { duration: 680, arc: 1.5, ease: 'inOutCubic' });
        }
      }

      const buildingYaw = (v) => Math.atan2(v.x, v.z);

      function makeBuilding(type, owner) {
        const g = new THREE.Group();
        const mesh = new THREE.Mesh(type === 'city' ? cityGeo() : houseGeo(), pieceMat(owner));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const shadow = st.markers.contact(type === 'city' ? 0.8 : 0.52, type === 'city' ? 0.56 : 0.48, 0.5);
        shadow.position.y = 0.004;
        g.add(shadow, mesh);
        return g;
      }

      function dropIn(obj, order, ease = 'outBounce') {
        const y = obj.position.y;
        obj.position.y = y + 1.2;
        st.animate(obj, { position: { y } }, { duration: 460, delay: Math.min(order * 70, 1100), ease });
      }

      function syncPieces() {
        let order = 0;
        const seenV = new Set();
        vertices.forEach((v) => {
          if (!v.building) return;
          seenV.add(v.id);
          const cur = view.buildings.get(v.id);
          if (cur && cur.type === v.building.type && cur.owner === v.building.owner) return;
          if (cur) st.removeObject(cur.obj);
          const obj = makeBuilding(v.building.type, v.building.owner);
          obj.position.set(v.x, TILE_TOP, v.z);
          obj.rotation.y = buildingYaw(v);
          view.pieces.add(obj);
          view.buildings.set(v.id, { obj, type: v.building.type, owner: v.building.owner });
          if (cur) {
            // 開拓地 → 都市はその場で入れ替わるように
            obj.scale.set(0.5, 0.5, 0.5);
            st.animate(obj, { scale: 1 }, { duration: 420, ease: 'outBack' });
          } else {
            dropIn(obj, order++);
          }
        });
        view.buildings.forEach((b, id) => {
          if (!seenV.has(id)) {
            st.removeObject(b.obj);
            view.buildings.delete(id);
          }
        });

        const seenE = new Set();
        edges.forEach((e) => {
          if (e.roadOwner === null) return;
          seenE.add(e.id);
          const cur = view.roads.get(e.id);
          if (cur && cur.owner === e.roadOwner) return;
          if (cur) st.removeObject(cur.obj);
          const obj = new THREE.Mesh(roadGeo(), pieceMat(e.roadOwner));
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.position.set(e.x, TILE_TOP, e.z);
          obj.rotation.y = e.angleY;
          view.pieces.add(obj);
          view.roads.set(e.id, { obj, owner: e.roadOwner });
          dropIn(obj, order++);
        });
        view.roads.forEach((r, id) => {
          if (!seenE.has(id)) {
            st.removeObject(r.obj);
            view.roads.delete(id);
          }
        });
      }

      // ---- 置ける場所の印とホバーの見本 ----
      function clearGhost() {
        if (view.ghost) {
          st.removeObject(view.ghost);
          view.ghost = null;
        }
        if (view.hiddenBuilding) {
          view.hiddenBuilding.visible = true;
          view.hiddenBuilding = null;
        }
        if (view.raisedTile) {
          st.animate(view.raisedTile, { position: { y: 0 } }, { duration: 220 });
          view.raisedTile = null;
        }
      }

      function showGhost(kind, owner, x, z, yaw) {
        clearGhost();
        const geom = kind === 'road' ? roadGeo() : kind === 'city' ? cityGeo() : kind === 'robber' ? robberGeo() : houseGeo();
        const mat = kind === 'robber' ? st.kit.ghostSolid('#2b2724', 0.5) : st.kit.ghostSolid(PLAYER_THEMES[owner].color, 0.6);
        const m = new THREE.Mesh(geom, mat);
        m.position.set(x, TILE_TOP, z);
        m.rotation.y = yaw || 0;
        m.renderOrder = 4;
        view.targets.add(m);
        view.ghost = m;
      }

      function addVertexTarget(v, p, kind) {
        const big = kind === 'city';
        const ring = new THREE.Mesh(
          geoC(big ? 'cat-tgt-ring-l' : 'cat-tgt-ring', () => new THREE.RingGeometry(big ? 0.3 : 0.13, big ? 0.35 : 0.19, 40).rotateX(-Math.PI / 2)),
          view.pulse
        );
        ring.position.set(v.x, TILE_TOP + 0.015, v.z);
        ring.renderOrder = 3;
        view.targets.add(ring);
        if (!big) {
          const dot = new THREE.Mesh(geoC('cat-tgt-dot', () => new THREE.CircleGeometry(0.055, 24).rotateX(-Math.PI / 2)), view.pulse);
          dot.position.set(v.x, TILE_TOP + 0.016, v.z);
          dot.renderOrder = 3;
          view.targets.add(dot);
        }
        const hit = new THREE.Mesh(geoC('cat-hit-v', () => new THREE.CylinderGeometry(0.34, 0.34, 0.7, 12)), st.kit.invisible());
        hit.position.set(v.x, TILE_TOP + 0.3, v.z);
        view.targets.add(hit);
        st.pick(hit, {
          onHover: () => {
            showGhost(kind, p.idx, v.x, v.z, buildingYaw(v));
            if (big && view.buildings.has(v.id)) {
              view.hiddenBuilding = view.buildings.get(v.id).obj;
              view.hiddenBuilding.visible = false;
            }
          },
          onLeave: clearGhost,
          onClick: () => handleVertexClick(v.id)
        });
      }

      function addEdgeTarget(e, p) {
        const bar = new THREE.Mesh(geoC('cat-tgt-bar', () => new THREE.PlaneGeometry(0.075, ROAD_LEN * 0.86).rotateX(-Math.PI / 2)), view.pulse);
        bar.position.set(e.x, TILE_TOP + 0.015, e.z);
        bar.rotation.y = e.angleY;
        bar.renderOrder = 3;
        const hit = new THREE.Mesh(geoC('cat-hit-e', () => new THREE.BoxGeometry(0.4, 0.4, ROAD_LEN)), st.kit.invisible());
        hit.position.set(e.x, TILE_TOP + 0.15, e.z);
        hit.rotation.y = e.angleY;
        view.targets.add(bar, hit);
        st.pick(hit, {
          onHover: () => showGhost('road', p.idx, e.x, e.z, e.angleY),
          onLeave: clearGhost,
          onClick: () => handleEdgeClick(e.id)
        });
      }

      function addRobberTarget(h, p) {
        const ring = new THREE.Mesh(geoC('cat-tgt-hex', () => new THREE.RingGeometry(0.64, 0.71, 48).rotateX(-Math.PI / 2)), view.pulse);
        ring.position.set(h.x, TILE_TOP + (h.number ? TOKEN_H : 0) + 0.012, h.z);
        ring.renderOrder = 3;
        const hit = new THREE.Mesh(
          geoC('cat-hit-hex', () => new THREE.CircleGeometry(HEX_RADIUS * 0.92, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6)),
          st.kit.invisible()
        );
        hit.position.set(h.x, TILE_TOP + 0.02, h.z);
        view.targets.add(ring, hit);
        st.pick(hit, {
          onHover: () => {
            const spot = robberSpot(h);
            showGhost('robber', p.idx, spot.x, spot.z, 0);
            const tile = view.tiles.get(h.id);
            if (tile) {
              view.raisedTile = tile;
              st.animate(tile, { position: { y: 0.08 } }, { duration: 200 });
            }
          },
          onLeave: clearGhost,
          onClick: () => moveRobberToHex(players[turnIndex], h.id)
        });
      }

      function syncTargets() {
        clearGhost();
        st.clearGroup(view.targets);
        const p = players[turnIndex];
        if (!p || p.isCpu || phase === 'GAME_OVER') {
          st.refreshHover();
          return;
        }

        if (phase === 'ROBBER_MOVE') {
          hexes.forEach((h) => { if (!h.hasRobber) addRobberTarget(h, p); });
        }

        let settleIds = [];
        if (phase === 'SETUP' && setupSubPhase === 'SETTLEMENT') settleIds = getValidSettlementVertices(p.idx, true);
        else if (phase === 'MAIN' && buildMode === 'settlement') settleIds = getValidSettlementVertices(p.idx, false);
        settleIds.forEach((id) => addVertexTarget(vertices[id], p, 'settlement'));

        if (phase === 'MAIN' && buildMode === 'city') {
          getValidCityVertices(p.idx).forEach((id) => addVertexTarget(vertices[id], p, 'city'));
        }

        let roadIds = [];
        if (phase === 'SETUP' && setupSubPhase === 'ROAD') roadIds = getValidRoadEdges(p.idx, lastSetupVertexId);
        else if (phase === 'FREE_ROADS' || (phase === 'MAIN' && buildMode === 'road')) roadIds = getValidRoadEdges(p.idx);
        roadIds.forEach((id) => addEdgeTarget(edges[id], p));

        st.refreshHover();
      }

      // ---- 出目の演出 (産出したタイルが跳ね、建物の上に獲得量が浮かぶ) ----
      function floatLabel(x, y, z, text, color, delay) {
        const lb = st.label('', { className: 'cat-gain' });
        lb.el.innerHTML = `<span style="--c:${color};animation-delay:${delay}ms">${text}</span>`;
        lb.at(x, y, z);
        setTimeout(() => lb.remove(), 1800 + delay);
      }

      function flushEffects() {
        if (view.flashNumber) {
          const n = view.flashNumber;
          view.flashNumber = 0;
          hexes.forEach((h) => {
            if (h.number !== n || h.hasRobber) return;
            const tile = view.tiles.get(h.id);
            if (!tile) return;
            st.animate(tile, { position: { y: 0.18 } }, {
              duration: 180,
              ease: 'outCubic',
              complete: () => st.animate(tile, { position: { y: 0 } }, { duration: 460, ease: 'outBounce' })
            });
          });
        }
        const stackAt = new Map();
        view.pendingGains.forEach((g, i) => {
          const v = vertices[g.vid];
          if (!v) return;
          const k = stackAt.get(g.vid) || 0;
          stackAt.set(g.vid, k + 1);
          floatLabel(v.x, TILE_TOP + 0.75 + k * 0.32, v.z, `${RES_META[g.terrain].name} +${g.amt}`, RES_META[g.terrain].color, 260 + i * 70);
        });
        view.pendingGains = [];
      }

      function syncScene() {
        if (!st) return;
        if (view.builtFor !== hexes) buildIsland();
        syncRobber();
        syncPieces();
        syncTargets();
        flushEffects();
      }

      // ====================================================
      // 6. 操作パネル
      // ====================================================
      const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
      const dieFace = (n) => Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i) ? ' class="on"' : ''}></i>`).join('');

      function renderAll() {
        // 1. プレイヤー
        playersRowEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && phase !== 'GAME_OVER';
          const awards = [];
          if (longestRoadHolder === p.idx) awards.push('最長交易路');
          if (largestArmyHolder === p.idx) awards.push('最大騎士力');
          return `
            <div class="cat-player ${isTurn ? 'is-turn' : ''}">
              <span class="cat-swatch" style="--c:${p.color}"></span>
              <div>
                <div class="cat-player-name">
                  <span>${p.name}</span>
                  <span class="cat-player-vp">${calcPlayerVP(p)}<small>点</small></span>
                  ${awards.map((a) => `<span class="cat-award">${a}</span>`).join('')}
                </div>
                <div class="cat-player-sub">資源 ${totalRes(p)} · 発展 ${p.devCards.length} · 騎士 ${p.knightsPlayed} · 交易路 ${computeLongestRoadForPlayer(p.idx)}</div>
              </div>
            </div>
          `;
        }).join('');

        // 2. サイコロと状況
        die1El.innerHTML = dieFace(lastDice[0]);
        die2El.innerHTML = dieFace(lastDice[1]);
        diceSumEl.textContent = hasRolled ? String(lastDice[0] + lastDice[1]) : '–';
        diceBoxEl.classList.toggle('is-idle', !hasRolled);
        if (diceJustRolled) {
          diceJustRolled = false;
          diceBoxEl.classList.remove('is-rolling');
          void diceBoxEl.offsetWidth;
          diceBoxEl.classList.add('is-rolling');
        }
        bannerEl.textContent = statusBannerText;

        // 3. 自分の資源
        const me = players[mySeat] || players[0];
        if (me) {
          const rates = getTradeRates(me);
          resHandEl.innerHTML = RES_TYPES.map((k) => `
            <div class="cat-res ${me.res[k] ? '' : 'is-empty'}" style="--c:${RES_META[k].color}">
              <span class="cat-res-name">${RES_META[k].name}</span>
              <b>${me.res[k]}</b>
              <small>${rates[k]}:1</small>
            </div>
          `).join('');
        }

        // 4. 操作
        const activeP = players[turnIndex];
        const isMyTurn = activeP && !activeP.isCpu && phase !== 'GAME_OVER';

        if (phase === 'GAME_OVER') {
          actionsBarEl.innerHTML = `<button class="cat-btn" id="cat-again-btn">新しい島で始める</button>`;
          actionsBarEl.querySelector('#cat-again-btn').onclick = () => initGame(false);
        } else if (!isMyTurn) {
          actionsBarEl.innerHTML = `<span class="cat-wait">${activeP ? activeP.name : ''}の手番です</span>`;
        } else if (phase === 'SETUP') {
          actionsBarEl.innerHTML = `<span class="cat-prompt">${setupSubPhase === 'SETTLEMENT' ? '開拓地を置く交差点を選んでください' : '街道を置く道を選んでください'}</span>`;
        } else if (phase === 'ROLL') {
          actionsBarEl.innerHTML = `
            <button class="cat-btn" id="cat-dev-btn">発展カード ${activeP.devCards.length ? `(${activeP.devCards.length})` : ''}</button>
            <button class="cat-btn is-primary" id="cat-roll-btn">サイコロを振る</button>
          `;
          actionsBarEl.querySelector('#cat-roll-btn').onclick = rollDiceAction;
          actionsBarEl.querySelector('#cat-dev-btn').onclick = () => openDevCardsModal(activeP);
        } else if (phase === 'ROBBER_MOVE') {
          actionsBarEl.innerHTML = `<span class="cat-prompt">盗賊を動かすタイルを選んでください</span>`;
        } else if (phase === 'FREE_ROADS') {
          actionsBarEl.innerHTML = `<span class="cat-prompt">街道を置く道を選んでください（残り${freeRoadsRemaining}本）</span>`;
        } else if (phase === 'MAIN') {
          const okRoad = canAffordRoad(activeP);
          const okSettle = canAffordSettlement(activeP);
          const okCity = canAffordCity(activeP);

          actionsBarEl.innerHTML = `
            <button class="cat-btn ${buildMode === 'road' ? 'is-active' : ''}" id="cat-b-road" ${okRoad ? '' : 'disabled'} title="費用: ${costText('road')}">街道 ${costDots('road')}</button>
            <button class="cat-btn ${buildMode === 'settlement' ? 'is-active' : ''}" id="cat-b-settle" ${okSettle ? '' : 'disabled'} title="費用: ${costText('settlement')}">開拓地 ${costDots('settlement')}</button>
            <button class="cat-btn ${buildMode === 'city' ? 'is-active' : ''}" id="cat-b-city" ${okCity ? '' : 'disabled'} title="費用: ${costText('city')}">都市 ${costDots('city')}</button>
            <button class="cat-btn" id="cat-b-dev">発展カード ${activeP.devCards.length ? `(${activeP.devCards.length})` : ''}</button>
            <button class="cat-btn" id="cat-b-trade">交易</button>
            <button class="cat-btn is-primary" id="cat-end-turn">手番を終える</button>
          `;

          const toggleMode = (mode, prompt) => {
            buildMode = buildMode === mode ? null : mode;
            statusBannerText = buildMode === mode ? prompt : '建設をやめました。';
            renderAll();
          };
          if (okRoad) actionsBarEl.querySelector('#cat-b-road').onclick = () => toggleMode('road', '街道を置く道を選んでください。');
          if (okSettle) actionsBarEl.querySelector('#cat-b-settle').onclick = () => toggleMode('settlement', '開拓地を建てる交差点を選んでください。');
          if (okCity) actionsBarEl.querySelector('#cat-b-city').onclick = () => toggleMode('city', '都市にする開拓地を選んでください。');
          actionsBarEl.querySelector('#cat-b-dev').onclick = () => openDevCardsModal(activeP);
          actionsBarEl.querySelector('#cat-b-trade').onclick = () => openTradeModal(activeP);
          actionsBarEl.querySelector('#cat-end-turn').onclick = endTurn;
        }

        syncScene();
      }

      pcountSelEl.onchange = () => initGame(false);
      fastSetupBtnEl.onclick = () => initGame(true);
      newBtnEl.onclick = () => initGame(false);

      B3D.ensureThree().then((threeLib) => {
        if (isDestroyed || !threeLib) return;
        initStage(threeLib);
        initGame(false);
      });

      return () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
        if (st) {
          if (B3D.current === st) B3D.current = null;
          st.destroy();
        }
      };
    }
  });
})();
