/**
 * 海底探険 (Deep Sea Adventure) 2〜6人
 * 全員でひとつの空気を分け合いながら、海底の遺跡チップを拾って潜水艦へ持ち帰るゲーム。
 *
 * - 公式ルール: 全3ラウンド、空気は25。手番の初めに持っている財宝の数だけ空気が減る。
 *   潜るか引き返すかを決め、1〜3の目のダイス2個の合計から財宝の数を引いた分だけ進む (他のダイバーは飛び越える)。
 *   止まったマスで「拾う」「空きマスに1個置く」「何もしない」を選ぶ。空気が尽きたら、戻れなかった人は財宝を失い、
 *   その財宝は3枚ずつまとめてコースの最後に置かれる。空きマスはラウンドの終わりに取り除かれる。
 * - CPU は性格ごとに、持っている財宝と残りの空気から引き返す時を決める
 * - 卓は共通エンジン (arena-3d-engine.js) のステージに、潜水艦のボード・遺跡チップ・ダイバー・ダイスを置いて描く
 */

(function () {
  const MAX_AIR = 25;
  const TOTAL_ROUNDS = 3;
  const UI_FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic UI", sans-serif';

  // 遺跡チップ: レベルが上がるほど形の角が増え、色が深くなる
  const LEVEL_META = {
    1: { level: 1, name: '浅い遺跡', sides: 3, radius: 0.5, color: '#7fb0b2', pointsPool: [0, 0, 1, 1, 2, 2, 3, 3] },
    2: { level: 2, name: '中ほどの遺跡', sides: 4, radius: 0.44, color: '#4f8aa0', pointsPool: [4, 4, 5, 5, 6, 6, 7, 7] },
    3: { level: 3, name: '深い遺跡', sides: 5, radius: 0.42, color: '#336486', pointsPool: [8, 8, 9, 9, 10, 10, 11, 11] },
    4: { level: 4, name: '最も深い遺跡', sides: 6, radius: 0.41, color: '#203f66', pointsPool: [12, 12, 13, 13, 14, 14, 15, 15] }
  };

  const PLAYER_THEMES = [
    { name: 'あなた', color: '#c0473c', style: 'balanced' },
    { name: 'CPU 慎重', color: '#4f86b8', style: 'cautious' },
    { name: 'CPU 大胆', color: '#5d9160', style: 'greedy' },
    { name: 'CPU 深追い', color: '#8a63b0', style: 'hunter' },
    { name: 'CPU 均衡', color: '#c7803c', style: 'balanced' },
    { name: 'CPU 勝負師', color: '#c0607f', style: 'greedy' }
  ];

  // Web Audio サウンド
  const DeepSeaSfx = {
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
    bubble() {
      [420, 580, 760].forEach((f, i) => setTimeout(() => this.play(f, 0.08, 'sine', 0.1), i * 45));
    },
    dice() {
      [320, 480, 640].forEach((f, i) => setTimeout(() => this.play(f, 0.07, 'triangle', 0.11), i * 40));
    },
    pickup() {
      [523.25, 659.25, 987.77].forEach((f, i) => setTimeout(() => this.play(f, 0.12, 'triangle', 0.13), i * 50));
    },
    returnSafe() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.play(f, 0.18, 'triangle', 0.15), i * 65));
    },
    drown() {
      [260, 210, 160, 115].forEach((f, i) => setTimeout(() => this.play(f, 0.24, 'sawtooth', 0.15), i * 85));
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

  // ====================================================
  // 印刷面 (canvas)
  // ====================================================
  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
  }

  function polygonPoints(n, R, cx, cy) {
    const pts = [];
    const start = n === 4 ? Math.PI / 4 : Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const a = start + (k / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    return pts;
  }

  // チップの上面。canvas の全体がチップの外接円の正方形 (一辺 2R) に対応する
  function paintChipFace(ctx, w, h, level) {
    const lm = LEVEL_META[level];
    window.BoardArena3D.canvas.paintNoise(ctx, w, h, lm.color, 12, 900 + level, 500);
    const g = ctx.createRadialGradient(w * 0.4, h * 0.38, w * 0.05, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 縁取り (外形の内側)
    const inner = polygonPoints(lm.sides, w * 0.5 * 0.8, w / 2, h / 2).map(([x, y]) => [x, h - y]);
    ctx.strokeStyle = 'rgba(232, 212, 160, 0.55)';
    ctx.lineWidth = w * 0.014;
    ctx.beginPath();
    inner.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();

    // レベルを示す点
    const dot = w * 0.055;
    const layouts = {
      1: [[0, 0]],
      2: [[-1, 0], [1, 0]],
      3: [[-1, 0.6], [1, 0.6], [0, -1.1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    };
    const cy = h / 2 + (level === 1 ? h * 0.06 : 0);
    layouts[level].forEach(([dx, dy]) => {
      const x = w / 2 + dx * dot * 1.5;
      const y = cy + dy * dot * 1.5;
      const dg = ctx.createRadialGradient(x - dot * 0.3, y - dot * 0.3, dot * 0.1, x, y, dot);
      dg.addColorStop(0, '#f6e7bd');
      dg.addColorStop(1, '#c9a865');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(x, y, dot, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 28, 10, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  // 拾われた跡に置く空きマーカー
  function paintBlank(ctx, w, h) {
    window.BoardArena3D.canvas.paintNoise(ctx, w, h, '#2c3a44', 10, 950, 300);
    ctx.strokeStyle = 'rgba(200, 214, 220, 0.4)';
    ctx.lineWidth = w * 0.06;
    ctx.lineCap = 'round';
    const m = w * 0.32;
    ctx.beginPath();
    ctx.moveTo(m, m);
    ctx.lineTo(w - m, h - m);
    ctx.moveTo(w - m, m);
    ctx.lineTo(m, h - m);
    ctx.stroke();
    ctx.lineWidth = w * 0.02;
    ctx.strokeStyle = 'rgba(200, 214, 220, 0.25)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  }

  function paintDieFace(ctx, w, h, n) {
    window.BoardArena3D.canvas.paintNoise(ctx, w, h, '#ece6d8', 6, 960 + n, 0);
    const pos = { 1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]] }[n];
    pos.forEach(([u, v]) => {
      const x = u * w;
      const y = v * h;
      const r = w * 0.1;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#2c4a6e');
      g.addColorStop(1, '#13253c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 潜水艦のボード (6.4 × 2.2)。下の段が空気の目盛り
  const SUB_W = 6.4;
  const SUB_D = 2.2;
  const AIR_Z = 0.74;           // 目盛りの段 (ボード中心からの奥行き)
  const AIR_STEP = (SUB_W * 0.92) / 26;

  function paintSubBoard(ctx, w, h) {
    const B3D = window.BoardArena3D;
    B3D.canvas.paintNoise(ctx, w, h, '#17334a', 10, 77, 600);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(120, 180, 210, 0.16)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(190, 220, 235, 0.12)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const y = h * (0.08 + k * 0.035);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 20) {
        const yy = y + Math.sin(x / 38 + k) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // 潜水艦
    const hx0 = w * 0.06;
    const hx1 = w * 0.9;
    const hy = h * 0.4;
    const hh = h * 0.36;
    const hull = ctx.createLinearGradient(0, hy - hh / 2, 0, hy + hh / 2);
    hull.addColorStop(0, '#f2cf5a');
    hull.addColorStop(0.55, '#d9a930');
    hull.addColorStop(1, '#9c7314');
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(hx0 + hh * 0.5, hy - hh / 2);
    ctx.lineTo(hx1 - hh * 0.5, hy - hh / 2);
    ctx.quadraticCurveTo(hx1 + hh * 0.2, hy, hx1 - hh * 0.5, hy + hh / 2);
    ctx.lineTo(hx0 + hh * 0.5, hy + hh / 2);
    ctx.quadraticCurveTo(hx0 - hh * 0.25, hy, hx0 + hh * 0.5, hy - hh / 2);
    ctx.fill();
    ctx.restore();
    // 司令塔
    ctx.fillStyle = '#dcae35';
    ctx.beginPath();
    ctx.moveTo(w * 0.55, hy - hh / 2);
    ctx.lineTo(w * 0.58, hy - hh * 1.05);
    ctx.lineTo(w * 0.68, hy - hh * 1.05);
    ctx.lineTo(w * 0.71, hy - hh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5810';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.64, hy - hh * 1.05);
    ctx.lineTo(w * 0.64, hy - hh * 1.35);
    ctx.lineTo(w * 0.67, hy - hh * 1.35);
    ctx.stroke();
    // 舷窓
    for (let k = 0; k < 7; k++) {
      const x = w * (0.16 + k * 0.1);
      ctx.fillStyle = '#7a5810';
      ctx.beginPath();
      ctx.arc(x, hy + hh * 0.05, hh * 0.17, 0, Math.PI * 2);
      ctx.fill();
      const pg = ctx.createRadialGradient(x - 4, hy - 4, 2, x, hy + hh * 0.05, hh * 0.13);
      pg.addColorStop(0, '#bfe2ee');
      pg.addColorStop(1, '#2d5c72');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(x, hy + hh * 0.05, hh * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    // スクリュー
    ctx.fillStyle = '#b48a26';
    ctx.beginPath();
    ctx.ellipse(hx0 - hh * 0.05, hy - hh * 0.22, hh * 0.08, hh * 0.22, 0.3, 0, Math.PI * 2);
    ctx.ellipse(hx0 - hh * 0.05, hy + hh * 0.22, hh * 0.08, hh * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80, 56, 10, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx0 + hh * 0.4, hy + hh * 0.38);
    ctx.lineTo(hx1 - hh * 0.4, hy + hh * 0.38);
    ctx.stroke();

    // 空気の目盛り (25 → 0)
    const ty = h * (0.5 + AIR_Z / SUB_D);
    const unit = w / SUB_W;
    ctx.fillStyle = 'rgba(8, 18, 28, 0.45)';
    ctx.fillRect(w * 0.025, ty - unit * 0.17, w * 0.95, unit * 0.34);
    for (let k = 0; k <= 25; k++) {
      const x = w / 2 + (k - 12.5) * AIR_STEP * unit;
      const v = 25 - k;
      ctx.beginPath();
      ctx.arc(x, ty, unit * 0.095, 0, Math.PI * 2);
      ctx.fillStyle = v === 0 ? '#7a2b2b' : v <= 5 ? '#4a3b33' : '#223f55';
      ctx.fill();
      ctx.strokeStyle = 'rgba(214, 228, 236, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(232, 240, 244, 0.85)';
      ctx.font = `700 ${Math.round(unit * 0.1)}px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(v), x, ty + 1);
    }
    ctx.fillStyle = 'rgba(214, 228, 236, 0.6)';
    ctx.font = `500 ${Math.round(unit * 0.1)}px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('空気', w * 0.03, ty - unit * 0.27);

    ctx.strokeStyle = 'rgba(214, 190, 120, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }

  // 海の色のプレイマット (奥が浅く、手前ほど深い)
  function paintOcean(ctx, w, h) {
    window.BoardArena3D.canvas.paintNoise(ctx, w, h, '#1a3446', 12, 1001, 2600);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(90, 150, 170, 0.32)');
    g.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 10, 0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  function meepleShape(THREE) {
    const s = new THREE.Shape();
    s.moveTo(-0.21, 0);
    s.lineTo(-0.07, 0);
    s.quadraticCurveTo(0, 0.14, 0.07, 0);
    s.lineTo(0.21, 0);
    s.quadraticCurveTo(0.2, 0.13, 0.11, 0.26);
    s.lineTo(0.22, 0.3);
    s.quadraticCurveTo(0.27, 0.35, 0.21, 0.385);
    s.lineTo(0.1, 0.385);
    s.absarc(0, 0.475, 0.13, -0.75, Math.PI + 0.75, false);
    s.lineTo(-0.21, 0.385);
    s.quadraticCurveTo(-0.27, 0.35, -0.22, 0.3);
    s.lineTo(-0.11, 0.26);
    s.quadraticCurveTo(-0.2, 0.13, -0.21, 0);
    return s;
  }

  window.BoardArena.registerGame({
    id: 'deep_sea',
    name: '海底探険',
    icon: '',
    category: 'チキンレース',
    minPlayers: 2,
    maxPlayers: 6,
    description: '全員でひとつの空気を分け合いながら、海底の財宝を拾って潜水艦へ持ち帰る。欲張るほど空気も足取りも重くなる。',

    mount(container, bridge) {
      let isDestroyed = false;
      let cpuTimer = null;

      let playerCount = 4;
      let vsCpu = !bridge.isConnected();
      let mySeat = bridge.isConnected() ? (bridge.isHost ? 0 : 1) : 0;

      // ゲーム状態
      let roundNum = 1;
      let air = MAX_AIR;
      // path: { type: 'ruin' | 'blank' | 'stack', chips: [{ level, points }] }
      // ruin は1枚、溺れた人の財宝をまとめた stack は最大3枚 (重さは1)
      let path = [];
      let players = [];
      let turnIndex = 0;
      let lastStarterIdx = 0;
      // turnSubPhase: 'DIRECTION' | 'ACTION' | 'ROUND_END' | 'GAME_OVER'
      let turnSubPhase = 'DIRECTION';
      let lastDice = [2, 2];
      let rollSerial = 0;  // ダイスを振るたびに増える (3D のダイスを転がす目印)
      let gameSerial = 0;  // 新しいゲームごとに増える (3D の卓を組み直す目印)
      let uidSeq = 1;      // 遺跡チップの見た目を追いかける番号
      let bannerText = '';

      container.innerHTML = `
        <style>
          .dsa-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: var(--text);
            font-family: var(--font-ui);
          }
          .dsa-top-bar, .dsa-dock {
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
          .dsa-players-row { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 520px; min-width: 0; }
          .dsa-player {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px 7px 10px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 4px;
            transition: border-color 0.25s, background 0.25s, opacity 0.25s;
          }
          .dsa-player.is-turn { border-color: rgba(226, 184, 103, 0.6); background: rgba(226, 184, 103, 0.07); }
          .dsa-player.is-safe { opacity: 0.7; }
          .dsa-swatch { flex: none; width: 12px; height: 12px; border-radius: 2px; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35); }
          .dsa-player-name { display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-weight: 700; white-space: nowrap; }
          .dsa-player-pts { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
          .dsa-player-pts small { margin-left: 2px; font-size: 10px; font-weight: 500; color: var(--text-3); }
          .dsa-player-sub { margin-top: 2px; font-size: 11px; color: var(--text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
          .dsa-player-sub em { font-style: normal; color: #e2b867; }
          .dsa-controls, .dsa-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .dsa-actions { justify-content: flex-end; }
          .dsa-btn, .dsa-select {
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
          .dsa-select {
            padding-right: 28px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a8a6a0' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
          }
          .dsa-select option { background: #161618; color: #ecebe6; }
          .dsa-btn:hover:not(:disabled), .dsa-select:hover { color: var(--text); border-color: rgba(255, 255, 255, 0.34); }
          .dsa-btn:disabled { opacity: 0.35; cursor: not-allowed; }
          .dsa-btn.is-primary { background: var(--text); border-color: var(--text); color: var(--text-inverse); font-weight: 700; }
          .dsa-btn.is-primary:hover:not(:disabled) { background: #fff; color: var(--text-inverse); }

          .dsa-stage-wrap { position: relative; }
          .dsa-stage-wrap .ba3d-stage {
            height: clamp(460px, calc(100vh - 290px), 880px);
            background: radial-gradient(95% 85% at 50% 40%, #1b2229 0%, #0e1215 60%, #060809 100%);
          }
          .dsa-status {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 5;
            max-width: min(540px, calc(100% - 130px));
            padding: 9px 13px;
            background: rgba(14, 12, 11, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #ecebe6;
            pointer-events: none;
          }
          .dsa-phase { font-size: 10px; letter-spacing: 0.14em; color: rgba(236, 235, 230, 0.55); }
          .dsa-announce { margin-top: 3px; font-size: 13px; line-height: 1.55; }
          .dsa-meter {
            position: absolute;
            left: 12px;
            bottom: 12px;
            z-index: 5;
            display: flex;
            gap: 1px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            pointer-events: none;
          }
          .dsa-meter div {
            min-width: 64px;
            padding: 7px 12px 6px;
            background: rgba(14, 12, 11, 0.6);
            display: flex;
            flex-direction: column;
            gap: 1px;
          }
          .dsa-meter span { font-size: 10px; letter-spacing: 0.08em; color: rgba(236, 235, 230, 0.55); }
          .dsa-meter b { font-size: 20px; font-weight: 700; line-height: 1.1; color: #ecebe6; font-variant-numeric: tabular-nums; }
          .dsa-meter b small { margin-left: 2px; font-size: 11px; font-weight: 500; color: rgba(236, 235, 230, 0.5); }
          .dsa-meter .is-air b { color: #9fd0e0; }
          .dsa-meter .is-low b { color: #e08a7a; }

          .dsa-dock-info { display: flex; flex-direction: column; gap: 3px; flex: 1 1 320px; min-width: 0; }
          .dsa-dock-label { font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
          .dsa-dock-text { font-size: 13px; color: var(--text); }
          .dsa-wait { font-size: 12px; color: var(--text-3); }

          .ba3d-label.dsa-name { padding: 2px 8px; font-size: 11px; background: rgba(14, 12, 11, 0.66); box-shadow: 0 0 0 1px rgba(226, 184, 103, 0.6); }

          .dsa-modal-overlay {
            position: absolute;
            inset: 0;
            z-index: 20;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(8, 7, 6, 0.55);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
          }
          .dsa-modal-overlay.visible { display: flex; }
          .dsa-modal-box {
            width: min(500px, 100%);
            max-height: 100%;
            overflow: auto;
            padding: 22px 24px;
            background: var(--bg-raised);
            border: 1px solid var(--line-strong);
            border-radius: 6px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          }
          .dsa-modal-title { font-size: 17px; font-weight: 700; }
          .dsa-modal-sub { margin-top: 4px; font-size: 12px; color: var(--text-3); }
          .dsa-log { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.6; color: var(--text-2); }
          .dsa-log .is-lost { color: #d39486; }
          .dsa-rank { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--line); font-size: 13px; }
          .dsa-rank-pos { width: 18px; color: var(--text-3); font-variant-numeric: tabular-nums; }
          .dsa-rank-meta { font-size: 11px; color: var(--text-3); }
          .dsa-rank-pts { margin-left: auto; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
          .dsa-rank-pts small { margin-left: 2px; font-size: 10px; font-weight: 500; color: var(--text-3); }
          .dsa-modal-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 18px; }

          @media (max-width: 640px) {
            .dsa-stage-wrap .ba3d-stage { height: min(66vh, 500px); }
            .dsa-status { max-width: calc(100% - 110px); }
            .dsa-announce { font-size: 12px; }
            .dsa-meter div { min-width: 52px; padding: 5px 9px; }
            .dsa-meter b { font-size: 16px; }
          }
        </style>

        <div class="dsa-wrapper">
          <div class="dsa-top-bar">
            <div class="dsa-players-row" id="dsa-players-row"></div>
            <div class="dsa-controls">
              <select id="dsa-pcount-sel" class="dsa-select" aria-label="人数">
                <option value="2">2人</option>
                <option value="3">3人</option>
                <option value="4" selected>4人</option>
                <option value="5">5人</option>
                <option value="6">6人</option>
              </select>
              <button class="dsa-btn" id="dsa-new-btn">新しいゲーム</button>
            </div>
          </div>

          <div class="dsa-stage-wrap" id="dsa-stage-wrap">
            <div class="dsa-status">
              <div class="dsa-phase" id="dsa-phase"></div>
              <div class="dsa-announce" id="dsa-announce"></div>
            </div>
            <div class="dsa-meter">
              <div class="is-air" id="dsa-air-box"><span>空気</span><b id="dsa-air">25</b></div>
              <div><span>ラウンド</span><b id="dsa-round">1<small>/ 3</small></b></div>
              <div><span>出目</span><b id="dsa-dice">-</b></div>
            </div>
            <div class="dsa-modal-overlay" id="dsa-modal-overlay">
              <div class="dsa-modal-box" id="dsa-modal-box"></div>
            </div>
          </div>

          <div class="dsa-dock" id="dsa-dock"></div>
        </div>
      `;

      const playersRowEl = container.querySelector('#dsa-players-row');
      const pcountSelEl = container.querySelector('#dsa-pcount-sel');
      const newBtnEl = container.querySelector('#dsa-new-btn');
      const stageWrapEl = container.querySelector('#dsa-stage-wrap');
      const phaseEl = container.querySelector('#dsa-phase');
      const announceEl = container.querySelector('#dsa-announce');
      const airEl = container.querySelector('#dsa-air');
      const airBoxEl = container.querySelector('#dsa-air-box');
      const roundEl = container.querySelector('#dsa-round');
      const diceEl = container.querySelector('#dsa-dice');
      const modalOverlayEl = container.querySelector('#dsa-modal-overlay');
      const modalBoxEl = container.querySelector('#dsa-modal-box');
      const dockEl = container.querySelector('#dsa-dock');

      // ====================================================
      // 1. コースとプレイヤー
      // ====================================================
      // 見た目を追いかけるための番号を付ける (財宝の束は拾われても同じ番号で動く)
      function tagTile(tile) {
        if (!tile._uid) tile._uid = (tile.chips && tile.chips._uid) || uidSeq++;
        if (tile.chips && !tile.chips._uid) tile.chips._uid = tile._uid;
        return tile;
      }

      function buildInitialPath() {
        const p = [];
        [1, 2, 3, 4].forEach((lv) => {
          shuffle(LEVEL_META[lv].pointsPool).forEach((pt) => {
            p.push(tagTile({ type: 'ruin', chips: [{ level: lv, points: pt }] }));
          });
        });
        return p;
      }

      function createPlayer(idx) {
        return {
          idx,
          name: PLAYER_THEMES[idx].name,
          color: PLAYER_THEMES[idx].color,
          style: PLAYER_THEMES[idx].style,
          isCpu: vsCpu && idx !== mySeat,
          pos: -1,             // -1 = 潜水艦、0.. = コースのマス
          returning: false,    // 潜水艦へ引き返している
          returnedSafe: false, // このラウンドで潜水艦に戻った
          carried: [],         // 財宝の束 (1束 = 重さ1)
          savedChips: [],      // 持ち帰って確定したチップ
          score: 0
        };
      }

      function initGame() {
        if (cpuTimer) clearTimeout(cpuTimer);
        playerCount = parseInt(pcountSelEl.value, 10) || 4;
        roundNum = 1;
        path = buildInitialPath();
        players = [];
        for (let i = 0; i < playerCount; i++) players.push(createPlayer(i));
        lastStarterIdx = 0;
        rollSerial = 0;
        gameSerial++;
        startRound(1, 0);
      }

      function startRound(rNum, starterIdx) {
        roundNum = rNum;
        air = MAX_AIR;
        players.forEach((p) => {
          p.pos = -1;
          p.returning = false;
          p.returnedSafe = false;
          p.carried = [];
        });
        modalOverlayEl.classList.remove('visible');
        turnIndex = starterIdx;
        beginPlayerTurn();
      }

      // ====================================================
      // 2. 手番: 空気が減る → 方向を決めてダイス → 止まったマスで行動
      // ====================================================
      function beginPlayerTurn() {
        if (players.every((p) => p.returnedSafe)) {
          endRound();
          return;
        }

        let safety = 0;
        while (players[turnIndex].returnedSafe && safety < playerCount) {
          turnIndex = (turnIndex + 1) % playerCount;
          safety++;
        }

        const p = players[turnIndex];
        const weight = p.carried.length;
        if (weight > 0) {
          air = Math.max(0, air - weight);
          DeepSeaSfx.bubble();
        }

        if (p.pos >= path.length - 1) p.returning = true;

        turnSubPhase = 'DIRECTION';
        const airNote = weight ? `財宝${weight}個の重さで空気が${weight}減りました。` : '';
        bannerText = `${p.name}の手番です。${airNote}${p.returning ? '潜水艦へ戻ります。' : (p.pos < 0 ? '海へ潜ります。' : '潜り続けるか、引き返すかを決めます。')}`;
        renderAll();

        if (p.isCpu) cpuTimer = setTimeout(runCpuTurn, 900);
      }

      // 方向を決めてダイス (1〜3 の目 × 2) を振り、他のダイバーを飛び越えて進む
      function rollAndMove(p, turnBackNow) {
        if (turnBackNow && p.pos >= 0) p.returning = true;

        const d1 = Math.floor(Math.random() * 3) + 1;
        const d2 = Math.floor(Math.random() * 3) + 1;
        lastDice = [d1, d2];
        rollSerial++;
        DeepSeaSfx.dice();

        const rawRoll = d1 + d2;
        const weight = p.carried.length;
        let steps = Math.max(0, rawRoll - weight);
        const moveText = `出目は${d1}と${d2}${weight ? `、重さ${weight}を引いて${Math.max(0, rawRoll - weight)}マス` : `で${rawRoll}マス`}。`;

        const occupiedSet = new Set(
          players.filter((o) => o.idx !== p.idx && !o.returnedSafe && o.pos >= 0).map((o) => o.pos)
        );

        let curr = p.pos;
        if (!p.returning) {
          while (steps > 0 && curr < path.length - 1) {
            curr++;
            if (!occupiedSet.has(curr)) steps--;
          }
          // 最も深いマスまで埋まっていたら、手前の空いたマスに止まる
          while (occupiedSet.has(curr) && curr > p.pos) curr--;
          p.pos = curr;
          if (p.pos >= path.length - 1) p.returning = true;
        } else {
          while (steps > 0 && curr > -1) {
            curr--;
            if (curr === -1) {
              steps = 0;
              break;
            }
            if (!occupiedSet.has(curr)) steps--;
          }
          p.pos = curr;
          if (p.pos <= -1) {
            p.pos = -1;
            p.returnedSafe = true;
            DeepSeaSfx.returnSafe();
            bannerText = `${p.name}の${moveText}潜水艦に戻りました（財宝${p.carried.length}個）。`;
            finishPlayerTurn();
            return;
          }
        }

        turnSubPhase = 'ACTION';
        bannerText = `${p.name}の${moveText}止まったマスで行動を選びます。`;
        renderAll();
      }

      // 止まったマスで: 拾う / 空きマスに1個置く / 何もしない
      function executeSearchAction(p, actionType) {
        const tile = path[p.pos];
        if (actionType === 'PICKUP' && tile && (tile.type === 'ruin' || tile.type === 'stack')) {
          p.carried.push(tile.chips);
          path[p.pos] = tagTile({ type: 'blank', chips: [] });
          DeepSeaSfx.pickup();
          bannerText = `${p.name}が財宝を拾いました（${p.carried.length}個）。`;
        } else if (actionType === 'DROP' && tile && tile.type === 'blank' && p.carried.length > 0) {
          // いちばん浅い (価値の低い) 束を置く
          let k = 0;
          p.carried.forEach((b, i) => {
            const lv = b.reduce((s, ch) => s + ch.level, 0);
            const best = p.carried[k].reduce((s, ch) => s + ch.level, 0);
            if (lv < best) k = i;
          });
          const droppedChips = p.carried.splice(k, 1)[0];
          path[p.pos] = tagTile({ type: droppedChips.length > 1 ? 'stack' : 'ruin', chips: droppedChips });
          DeepSeaSfx.bubble();
          bannerText = `${p.name}が財宝を1個置いて身軽になりました（${p.carried.length}個）。`;
        } else {
          bannerText = `${p.name}は何もせずに手番を終えました。`;
        }
        finishPlayerTurn();
      }

      function finishPlayerTurn() {
        // 潜水艦に戻っていない最後の手番の人が、次のラウンドの最初になる
        if (!players[turnIndex].returnedSafe) lastStarterIdx = turnIndex;

        if (air <= 0 || players.every((p) => p.returnedSafe)) {
          endRound();
          return;
        }
        turnIndex = (turnIndex + 1) % playerCount;
        beginPlayerTurn();
      }

      // ====================================================
      // 3. ラウンドの終わり (持ち帰り・溺れた人の財宝・空きマスの除去)
      // ====================================================
      function endRound() {
        turnSubPhase = 'ROUND_END';
        const safeLogs = [];
        const drownLogs = [];

        players.forEach((p) => {
          if (p.returnedSafe && p.carried.length > 0) {
            let gainedPts = 0;
            let chipCnt = 0;
            p.carried.forEach((bundle) => {
              bundle.forEach((ch) => {
                p.savedChips.push(ch);
                p.score += ch.points;
                gainedPts += ch.points;
                chipCnt++;
              });
            });
            p.carried = [];
            safeLogs.push(`${p.name}は財宝${chipCnt}枚を持ち帰り、${gainedPts}点を得ました。`);
          }
        });

        // 戻れなかった人の財宝は、潜水艦に近い人から順にコースの最後へ3枚ずつ置かれる
        const drownedPlayers = players.filter((p) => !p.returnedSafe && p.pos >= 0).sort((a, b) => a.pos - b.pos);
        if (drownedPlayers.length > 0) DeepSeaSfx.drown();

        const droppedPool = [];
        drownedPlayers.forEach((p) => {
          let lostCnt = 0;
          p.carried.forEach((bundle) => {
            bundle.forEach((ch) => {
              droppedPool.push(ch);
              lostCnt++;
            });
          });
          p.carried = [];
          drownLogs.push(lostCnt
            ? `${p.name}は戻れず、財宝${lostCnt}枚を海の底へ落としました。`
            : `${p.name}は潜水艦に戻れませんでした。`);
        });

        for (let i = 0; i < droppedPool.length; i += 3) {
          const chunk = droppedPool.slice(i, i + 3);
          path.push(tagTile({ type: chunk.length > 1 ? 'stack' : 'ruin', chips: chunk }));
        }

        // 空きマスを取り除いてコースを詰める
        path = path.filter((tile) => tile.type !== 'blank');

        renderAll();
        openRoundSummaryModal(safeLogs, drownLogs);
      }

      function openRoundSummaryModal(safeLogs, drownLogs) {
        const isFinalRound = roundNum >= TOTAL_ROUNDS;
        const logs = [
          ...safeLogs.map((t) => `<div>${t}</div>`),
          ...drownLogs.map((t) => `<div class="is-lost">${t}</div>`)
        ].join('') || '<div>財宝を持ち帰った人はいませんでした。</div>';

        if (isFinalRound) {
          turnSubPhase = 'GAME_OVER';
          const ranked = players.slice().sort((a, b) => b.score - a.score);
          const winner = ranked[0];
          const rankHtml = ranked.map((p, idx) => `
            <div class="dsa-rank">
              <span class="dsa-rank-pos">${idx + 1}</span>
              <span class="dsa-swatch" style="--c:${p.color}"></span>
              <div>
                <div>${p.name}</div>
                <div class="dsa-rank-meta">持ち帰ったチップ ${p.savedChips.length}枚</div>
              </div>
              <span class="dsa-rank-pts">${p.score}<small>点</small></span>
            </div>
          `).join('');
          modalBoxEl.innerHTML = `
            <div class="dsa-modal-title">${winner.idx === mySeat ? 'あなたの勝ちです' : `${winner.name}の勝ちです`}</div>
            <div class="dsa-modal-sub">3ラウンドが終わりました。</div>
            <div class="dsa-log">${logs}</div>
            <div style="margin-top:10px;">${rankHtml}</div>
            <div class="dsa-modal-actions">
              <button class="dsa-btn" id="dsa-modal-close">海を見る</button>
              <button class="dsa-btn is-primary" id="dsa-rematch-btn">もう一度潜る</button>
            </div>
          `;
          modalOverlayEl.classList.add('visible');
          modalBoxEl.querySelector('#dsa-modal-close').onclick = () => modalOverlayEl.classList.remove('visible');
          modalBoxEl.querySelector('#dsa-rematch-btn').onclick = () => initGame();
          renderAll();
          return;
        }

        modalBoxEl.innerHTML = `
          <div class="dsa-modal-title">第${roundNum}ラウンドが終わりました</div>
          <div class="dsa-modal-sub">空きマスを取り除き、コースは${path.length}マスになりました。次のラウンドはより深い遺跡へすぐ届きます。</div>
          <div class="dsa-log">${logs}</div>
          <div class="dsa-modal-actions">
            <button class="dsa-btn is-primary" id="dsa-next-round-btn">第${roundNum + 1}ラウンドへ</button>
          </div>
        `;
        modalOverlayEl.classList.add('visible');
        modalBoxEl.querySelector('#dsa-next-round-btn').onclick = () => startRound(roundNum + 1, lastStarterIdx);
      }

      // ====================================================
      // 4. CPU (空気・深さ・重さで引き返す時を決める)
      // ====================================================
      function runCpuTurn() {
        if (isDestroyed || turnSubPhase !== 'DIRECTION') return;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu) return;

        let wantReturn = cpu.returning;
        if (!wantReturn && cpu.pos >= 0) {
          const carriedCnt = cpu.carried.length;
          const avgSpeed = Math.max(1, 4 - carriedCnt);
          const estTurnsBack = Math.ceil((cpu.pos + 1) / avgSpeed);
          const totalCarriedAll = players.reduce((s, pl) => s + (pl.returnedSafe ? 0 : pl.carried.length), 0) || 1;
          const airThreshold = estTurnsBack * totalCarriedAll;

          if (cpu.style === 'cautious') {
            if (carriedCnt >= 1 && (air <= airThreshold + 4 || cpu.pos >= 5)) wantReturn = true;
          } else if (cpu.style === 'greedy') {
            if (carriedCnt >= 3 || (carriedCnt >= 1 && air <= airThreshold - 1)) wantReturn = true;
          } else {
            if (carriedCnt >= 2 || (carriedCnt >= 1 && air <= airThreshold + 2)) wantReturn = true;
          }
        }

        rollAndMove(cpu, wantReturn);
        if (turnSubPhase !== 'ACTION' || players[turnIndex] !== cpu) return;

        // ダイバーが着くのを待ってから行動する
        cpuTimer = setTimeout(() => {
          if (isDestroyed || turnSubPhase !== 'ACTION') return;
          const tile = path[cpu.pos];
          if (!tile) {
            executeSearchAction(cpu, 'PASS');
            return;
          }
          if (tile.type === 'ruin' || tile.type === 'stack') {
            const maxCarry = cpu.style === 'cautious' ? 2 : (cpu.style === 'greedy' ? 4 : 3);
            if (cpu.returning && air <= 5 && cpu.carried.length >= 1) executeSearchAction(cpu, 'PASS');
            else if (cpu.carried.length < maxCarry) executeSearchAction(cpu, 'PICKUP');
            else executeSearchAction(cpu, 'PASS');
          } else if (tile.type === 'blank') {
            // 帰りに空気が少なく重すぎるときは1個置いていく
            if (cpu.returning && air <= 6 && cpu.carried.length >= 3) executeSearchAction(cpu, 'DROP');
            else executeSearchAction(cpu, 'PASS');
          } else {
            executeSearchAction(cpu, 'PASS');
          }
        }, 1250);
      }

      // ====================================================
      // 5. 3D の卓
      // ====================================================
      const B3D = window.BoardArena3D;
      const CHIP_T = 0.06;
      const BLANK_T = 0.03;
      const COLS = 9;
      const COL_STEP = 1.05;
      const ROW_STEP = 1.2;
      const PATH_X0 = -4.2;
      const PATH_Z0 = -1.75;
      const SUB_POS = { x: 0, z: -3.75 };
      const SEAT_X = (k) => -2.45 + k * 0.6;
      const SEAT_Z = -0.18;
      const PACK_SCALE = 0.42;
      const DICE_POS = [{ x: 3.95, z: -3.95 }, { x: 4.55, z: -3.45 }];
      const DIE = 0.34;

      let THREE = null;
      let st = null;
      const view = {
        gameKey: -1,
        chips: new Map(),   // uid -> obj (遺跡チップの束)
        blanks: new Map(),  // uid -> obj (空きマーカー)
        divers: [],
        dice: [],
        rollKey: 0,
        airMarker: null,
        airShown: MAX_AIR,
        ring: null,
        nameLabel: null,
        glow: null
      };

      function tilePos(index) {
        const row = Math.floor(index / COLS);
        const colInRow = index % COLS;
        const col = row % 2 === 0 ? colInRow : (COLS - 1 - colInRow);
        return { x: PATH_X0 + col * COL_STEP, z: PATH_Z0 + row * ROW_STEP };
      }

      function subSeat(k) {
        return { x: SUB_POS.x + SEAT_X(k), y: 0.09, z: SUB_POS.z + SEAT_Z };
      }

      function tileHeight(tile) {
        if (!tile) return 0;
        if (tile.type === 'blank') return BLANK_T;
        return tile.chips.length * CHIP_T;
      }

      // ---- 材質 ----
      const capMat = (lv) => st.kit.cached(`dsa-chip-cap:${lv}`, () => {
        const R = LEVEL_META[lv].radius;
        const t = st.kit.texture(B3D.canvas.cached(`dsa-chip:${lv}`, 256, 256, (ctx, w, h) => paintChipFace(ctx, w, h, lv)));
        t.repeat.set(1 / (2 * R), 1 / (2 * R));
        t.offset.set(0.5, 0.5);
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, metalness: 0, envMapIntensity: 0.45 });
      });
      const sideMat = (lv) => st.kit.matte(shadeHex(LEVEL_META[lv].color, -0.35), { roughness: 0.8 });

      function chipGeo(lv) {
        return st.geo.cached(`dsa-chip:${lv}`, () => {
          const lm = LEVEL_META[lv];
          const pts = polygonPoints(lm.sides, lm.radius - 0.012, 0, 0);
          const shape = new THREE.Shape();
          pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
          shape.closePath();
          return st.geo.slab(lm.radius * 2, lm.radius * 2, CHIP_T, { shape, bevel: 0.012, bevelSegments: 2 });
        });
      }

      // 束 (1〜3枚) をひとつの物として作る
      function makeBundle(chips) {
        const g = new THREE.Group();
        const rng = B3D.mulberry32((chips._uid || 1) * 131);
        chips.forEach((ch, k) => {
          const m = new THREE.Mesh(chipGeo(ch.level), [capMat(ch.level), sideMat(ch.level)]);
          m.position.y = CHIP_T / 2 + k * CHIP_T;
          m.rotation.y = (rng() - 0.5) * 0.5 + (chips.length > 1 ? k * 0.35 : 0);
          m.position.x = chips.length > 1 ? (rng() - 0.5) * 0.06 : 0;
          m.position.z = chips.length > 1 ? (rng() - 0.5) * 0.06 : 0;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
        });
        const shadow = st.markers.contact(1.05, 1.05, 0.45);
        shadow.position.y = 0.002;
        g.add(shadow);
        g.userData.shadow = shadow;
        return g;
      }

      function makeBlank() {
        const g = new THREE.Group();
        // 回転体の UV は印刷に向かないので、上面には別の円を貼る
        const m = new THREE.Mesh(st.geo.cached('dsa-blank', () => st.geo.disc(0.3, BLANK_T, 0.008, 40)), st.kit.matte('#26323b', { roughness: 0.8 }));
        m.position.y = BLANK_T / 2;
        m.castShadow = true;
        m.receiveShadow = true;
        const top = new THREE.Mesh(
          st.geo.cached('dsa-blank-top', () => new THREE.CircleGeometry(0.29, 40).rotateX(-Math.PI / 2)),
          st.kit.cached('dsa-blank-mat', () => new THREE.MeshStandardMaterial({
            map: st.kit.texture(B3D.canvas.cached('dsa-blank', 256, 256, paintBlank)), roughness: 0.75, envMapIntensity: 0.35
          }))
        );
        top.position.y = BLANK_T + 0.0008;
        g.add(m, top);
        return g;
      }

      function makeDiver(p) {
        const g = new THREE.Group();
        const body = new THREE.Group();
        const geo = st.geo.cached('dsa-meeple', () => {
          const eg = new THREE.ExtrudeGeometry(meepleShape(THREE), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.022, bevelSegments: 3, curveSegments: 18 });
          eg.translate(0, 0, -0.06);
          return eg;
        });
        const mesh = new THREE.Mesh(geo, st.kit.lacquer(p.color, { roughness: 0.38, clearcoat: 0.5 }));
        mesh.position.y = 0.022;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        body.add(mesh);
        // 潜水ヘルメットの窓 (正面 = +z)
        const rim = new THREE.Mesh(st.geo.cached('dsa-visor-rim', () => new THREE.TorusGeometry(0.07, 0.016, 10, 28)), st.kit.metal('#b8954a', { roughness: 0.35 }));
        rim.position.set(0, 0.5, 0.088);
        const glass = new THREE.Mesh(st.geo.cached('dsa-visor', () => new THREE.CircleGeometry(0.068, 28)), st.kit.lacquer('#14212c', { roughness: 0.1, clearcoat: 1 }));
        glass.position.set(0, 0.5, 0.086);
        body.add(rim, glass);
        const pack = new THREE.Group();
        pack.position.set(0, 0.14, -0.2);
        g.add(body, pack);
        const shadow = st.markers.contact(0.6, 0.6, 0.5);
        shadow.position.y = 0.003;
        g.add(shadow);
        g.userData = { body, pack, shadow, pos: -2, yaw: 0, hopping: null };
        st.root.add(g);
        return g;
      }

      // ---- ダイス ----
      function makeDie() {
        const mats = [1, 1, 2, 2, 3, 3].map((n) => st.kit.cached(`dsa-die:${n}`, () => new THREE.MeshStandardMaterial({
          map: st.kit.texture(B3D.canvas.cached(`dsa-die:${n}`, 128, 128, (ctx, w, h) => paintDieFace(ctx, w, h, n))),
          roughness: 0.35,
          envMapIntensity: 0.6
        })));
        const g = new THREE.Group();
        const inner = new THREE.Mesh(st.geo.cached('dsa-die', () => st.geo.roundedBox(DIE, DIE, DIE, 0.05, 3)), mats);
        inner.castShadow = true;
        inner.receiveShadow = true;
        g.add(inner);
        const shadow = st.markers.contact(DIE * 1.8, DIE * 1.8, 0.5);
        shadow.position.y = -DIE / 2 + 0.003;
        g.add(shadow);
        g.userData.inner = inner;
        g.userData.shadow = shadow;
        st.root.add(g);
        return g;
      }

      // 上を向く面: +X/-X = 1、+Y/-Y = 2、+Z/-Z = 3
      function faceRotation(v) {
        const flip = Math.random() < 0.5 ? Math.PI : 0;
        if (v === 1) return { x: flip, y: 0, z: Math.PI / 2 };
        if (v === 3) return { x: -Math.PI / 2 + flip, y: 0, z: 0 };
        return { x: flip, y: 0, z: 0 };
      }

      function rollDice() {
        DICE_POS.forEach((pos, i) => {
          const d = view.dice[i];
          const rot = faceRotation(lastDice[i]);
          const spin = (n) => n + Math.PI * 2 * (2 + Math.floor(Math.random() * 2));
          d.position.set(pos.x - 1.4, 1.4, pos.z + 0.6);
          d.rotation.y = Math.random() * Math.PI * 2;
          st.animate(d.userData.inner, { rotation: { x: spin(rot.x), y: rot.y, z: spin(rot.z) } }, { duration: 620, ease: 'outCubic' });
          st.animate(d, { position: { x: pos.x, y: DIE / 2, z: pos.z }, rotation: { y: (Math.random() - 0.5) * 0.8 } }, { duration: 620, ease: 'outBounce', delay: i * 60 });
        });
      }

      // ---- 盤 ----
      function buildTable() {
        // 海の色のプレイマット (縁は布の厚み、上面に印刷を貼る)
        const ocean = new THREE.Mesh(st.geo.slab(11.4, 9.4, 0.02, { bevel: 0.008, radius: 0.3 }), st.kit.matte('#11222d', { roughness: 0.95 }));
        ocean.position.set(0, -0.012, -0.85);
        ocean.receiveShadow = true;
        st.root.add(ocean);
        const oceanTop = new THREE.Mesh(
          new THREE.PlaneGeometry(11.36, 9.36).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({ map: st.kit.texture(B3D.canvas.cached('dsa-ocean', 1024, 846, paintOcean)), roughness: 0.95, envMapIntensity: 0.3 })
        );
        oceanTop.position.set(0, -0.0015, -0.85);
        oceanTop.receiveShadow = true;
        st.root.add(oceanTop);

        const sub = new THREE.Group();
        sub.position.set(SUB_POS.x, 0, SUB_POS.z);
        const body = new THREE.Mesh(st.geo.slab(SUB_W, SUB_D, 0.08, { bevel: 0.02, radius: 0.08 }), st.kit.matte('#0f2232', { roughness: 0.7 }));
        body.position.y = 0.04;
        body.castShadow = true;
        body.receiveShadow = true;
        const top = new THREE.Mesh(
          new THREE.PlaneGeometry(SUB_W - 0.04, SUB_D - 0.04).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({ map: st.kit.texture(B3D.canvas.cached('dsa-sub', 1280, 440, paintSubBoard)), roughness: 0.55, envMapIntensity: 0.5 })
        );
        top.position.y = 0.0812;
        top.receiveShadow = true;
        sub.add(body, top);
        st.root.add(sub);

        // 空気のマーカー
        const marker = new THREE.Mesh(st.geo.cached('dsa-air-marker', () => st.geo.disc(0.1, 0.06, 0.015, 32)), st.kit.lacquer('#c33a32', { roughness: 0.3 }));
        marker.castShadow = true;
        view.airMarker = marker;
        view.airShown = MAX_AIR;
        marker.position.copy(airPos(MAX_AIR));
        st.root.add(marker);

        view.dice = [makeDie(), makeDie()];
        DICE_POS.forEach((pos, i) => {
          view.dice[i].position.set(pos.x, DIE / 2, pos.z);
          view.dice[i].userData.inner.rotation.set(0, 0, i ? Math.PI / 2 : 0);
        });

        view.ring = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.39, 48).rotateX(-Math.PI / 2), view.glow);
        view.ring.renderOrder = 3;
        view.ring.visible = false;
        st.root.add(view.ring);
        view.nameLabel = st.label('', { className: 'dsa-name' });
        view.nameLabel.show(false);
      }

      function airPos(v) {
        const k = MAX_AIR - Math.max(0, Math.min(MAX_AIR, v));
        return new THREE.Vector3(SUB_POS.x + (k - 12.5) * AIR_STEP, 0.08 + 0.03, SUB_POS.z + AIR_Z);
      }

      // ---- 同期 ----
      function resetTable() {
        view.gameKey = gameSerial;
        view.chips.forEach((o) => st.removeObject(o));
        view.blanks.forEach((o) => st.removeObject(o));
        view.chips.clear();
        view.blanks.clear();
        view.divers.forEach((d) => st.removeObject(d));
        view.divers = players.map((p) => makeDiver(p));
        view.airShown = air;
        view.airMarker.position.copy(airPos(air));
        view.rollKey = rollSerial;
      }

      function syncPath() {
        const seenChips = new Set();
        const seenBlanks = new Set();
        path.forEach((tile, i) => {
          const pos = tilePos(i);
          if (tile.type === 'blank') {
            seenBlanks.add(tile._uid);
            let o = view.blanks.get(tile._uid);
            if (!o) {
              o = makeBlank();
              o.position.set(pos.x, 0, pos.z);
              o.scale.setScalar(0.01);
              st.root.add(o);
              st.animate(o, { scale: 1 }, { duration: 360, delay: 200, ease: 'outBack' });
              view.blanks.set(tile._uid, o);
            } else {
              moveIfNeeded(o, { x: pos.x, y: 0, z: pos.z }, { arc: 0.2 });
            }
            return;
          }
          seenChips.add(tile._uid);
          let o = view.chips.get(tile._uid);
          if (!o) {
            o = makeBundle(tile.chips);
            o.position.set(pos.x, 1.6, pos.z);
            st.root.add(o);
            o.userData.home = { x: pos.x, y: 0, z: pos.z };
            st.animate(o, { position: { x: pos.x, y: 0, z: pos.z } }, { duration: 520, delay: 60 + i * 22, ease: 'outBounce' });
            view.chips.set(tile._uid, o);
          } else {
            if (o.parent !== st.root) st.root.attach(o);
            o.userData.shadow.visible = true;
            moveIfNeeded(o, { x: pos.x, y: 0, z: pos.z }, { arc: 0.5, scale: 1, rot: 0 });
          }
        });

        // 持っている束はダイバーの背中へ
        players.forEach((p) => {
          const diver = view.divers[p.idx];
          let packY = 0;
          p.carried.forEach((bundle) => {
            const uid = bundle._uid;
            seenChips.add(uid);
            let o = view.chips.get(uid);
            if (!o) {
              o = makeBundle(bundle);
              diver.userData.pack.add(o);
              view.chips.set(uid, o);
            }
            if (o.parent !== diver.userData.pack) {
              diver.userData.pack.attach(o);
              o.userData.home = null;
            }
            o.userData.shadow.visible = false;
            const slot = { x: 0, y: packY, z: 0 };
            packY += CHIP_T * PACK_SCALE * bundle.length + 0.012;
            moveIfNeeded(o, slot, { arc: 0.4, scale: PACK_SCALE, rot: 0, duration: 520 });
          });
        });

        // なくなった束: 持ち帰ったものは潜水艦へ、落としたものは海の底へ沈む
        view.chips.forEach((o, uid) => {
          if (seenChips.has(uid)) return;
          view.chips.delete(uid);
          st.root.attach(o);
          const subTarget = { x: SUB_POS.x + 2.6, y: 0.4, z: SUB_POS.z - 0.3 };
          const sinking = turnSubPhase === 'ROUND_END' || turnSubPhase === 'GAME_OVER';
          const to = sinking && o.position.z > SUB_POS.z + 1 ? { x: o.position.x, y: -0.6, z: o.position.z + 0.8 } : subTarget;
          st.animate(o, { position: to, scale: 0.2 }, { duration: 700, arc: 0.6, ease: 'inOutCubic', complete: () => st.removeObject(o) });
        });
        view.blanks.forEach((o, uid) => {
          if (seenBlanks.has(uid)) return;
          view.blanks.delete(uid);
          st.animate(o, { scale: 0.01 }, { duration: 300, ease: 'outCubic', complete: () => st.removeObject(o) });
        });
      }

      function moveIfNeeded(o, to, opt = {}) {
        const h = o.userData.home;
        const scale = opt.scale ?? o.scale.x;
        if (h && Math.abs(h.x - to.x) < 1e-4 && Math.abs(h.y - to.y) < 1e-4 && Math.abs(h.z - to.z) < 1e-4 && Math.abs((h.s ?? 1) - scale) < 1e-4) return;
        o.userData.home = { ...to, s: scale };
        const target = { position: to, scale };
        if (opt.rot !== undefined) target.rotation = { x: 0, y: 0, z: 0 };
        st.animate(o, target, { duration: opt.duration || 460, arc: opt.arc || 0, ease: 'inOutCubic' });
      }

      function diverTarget(p) {
        if (p.pos < 0) {
          const inSub = players.filter((q) => q.pos < 0);
          return { ...subSeat(Math.max(0, inSub.indexOf(p))), index: -1 };
        }
        const tp = tilePos(p.pos);
        return { x: tp.x, y: tileHeight(path[p.pos]), z: tp.z, index: p.pos };
      }

      function yawToward(from, to) {
        return Math.atan2(to.x - from.x, to.z - from.z);
      }

      function syncDivers(rolled) {
        players.forEach((p) => {
          const d = view.divers[p.idx];
          if (!d) return;
          const u = d.userData;
          const to = diverTarget(p);
          const key = `${to.index}:${to.x.toFixed(3)}:${to.z.toFixed(3)}:${to.y.toFixed(3)}`;
          if (u.key === key) return;
          const prevIndex = u.pos;
          u.key = key;
          u.pos = to.index;

          // 進んだマスを1つずつ跳ねて渡る
          const hops = [];
          if (prevIndex >= -1 && prevIndex !== to.index && Math.abs(prevIndex - to.index) <= 12 && view.gameKey === gameSerial && u.placed) {
            const dir = to.index > prevIndex ? 1 : -1;
            for (let i = prevIndex + dir; dir > 0 ? i < to.index : i > to.index; i += dir) {
              if (i < 0) continue;
              const tp = tilePos(i);
              hops.push({ x: tp.x, y: tileHeight(path[i]), z: tp.z });
            }
          }
          hops.push({ x: to.x, y: to.y, z: to.z });
          if (u.hopping) u.hopping.forEach((t) => t.cancel());
          u.hopping = [];
          let delay = rolled ? 520 : 0;
          let from = { x: d.position.x, z: d.position.z };
          const dur = hops.length > 1 ? 210 : 460;
          hops.forEach((h) => {
            const yaw = Math.hypot(h.x - from.x, h.z - from.z) > 0.01 ? yawToward(from, h) : d.rotation.y;
            const startDelay = delay;
            const tw = st.tween({
              delay: startDelay,
              duration: dur,
              ease: 'inOutCubic',
              update: (() => {
                let sx;
                let sy;
                let sz;
                let sr;
                return (k, raw) => {
                  if (sx === undefined) {
                    sx = d.position.x;
                    sy = d.position.y;
                    sz = d.position.z;
                    sr = d.rotation.y;
                  }
                  d.position.set(sx + (h.x - sx) * k, sy + (h.y - sy) * k + Math.sin(raw * Math.PI) * 0.28, sz + (h.z - sz) * k);
                  let dy = yaw - sr;
                  while (dy > Math.PI) dy -= Math.PI * 2;
                  while (dy < -Math.PI) dy += Math.PI * 2;
                  d.rotation.y = sr + dy * Math.min(1, k * 2);
                };
              })()
            });
            u.hopping.push(tw);
            delay += dur * 0.92;
            from = h;
          });
          if (!u.placed) {
            d.position.set(to.x, to.y + 1.2, to.z);
            u.placed = true;
          }
        });
      }

      function syncAir() {
        if (view.airShown === air) return;
        const from = view.airShown;
        view.airShown = air;
        const steps = Math.abs(from - air);
        const dir = air < from ? -1 : 1;
        for (let s = 1; s <= steps; s++) {
          const v = from + dir * s;
          const p = airPos(v);
          st.tween({
            delay: (s - 1) * 120,
            duration: 160,
            ease: 'inOutCubic',
            update: (() => {
              let a = null;
              return (k, raw) => {
                if (!a) a = view.airMarker.position.clone();
                view.airMarker.position.set(a.x + (p.x - a.x) * k, p.y + Math.sin(raw * Math.PI) * 0.12, a.z + (p.z - a.z) * k);
              };
            })()
          });
        }
      }

      function syncActive() {
        const p = players[turnIndex];
        const active = p && (turnSubPhase === 'DIRECTION' || turnSubPhase === 'ACTION');
        view.ring.visible = !!active;
        view.nameLabel.show(!!active);
        if (!active) return;
        view.nameLabel.set(p.name);
      }

      function syncTable() {
        if (!st) return;
        if (view.gameKey !== gameSerial) resetTable();
        const rolled = view.rollKey !== rollSerial;
        if (rolled) {
          view.rollKey = rollSerial;
          rollDice();
        }
        syncPath();
        syncDivers(rolled);
        syncAir();
        syncActive();
      }

      function initStage(threeLib) {
        THREE = threeLib;
        st = B3D.createStage(THREE, stageWrapEl, {
          embed: true,
          radius: 13.4,
          phi: 0.66,
          extent: 7,
          tableY: -0.03,
          tableWood: 'darkWalnut',
          minRadius: 7,
          maxRadius: 24,
          maxPhi: 1.2,
          onFrame(now) {
            if (view.glow) view.glow.opacity = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(now / 260));
            // 手番のダイバーの足元の輪と名前は、ダイバーについていく
            const p = players[turnIndex];
            const d = p && view.divers[p.idx];
            if (d && view.ring.visible) {
              view.ring.position.set(d.position.x, d.position.y + 0.006, d.position.z);
              view.nameLabel.at(d.position.x, d.position.y + 0.95, d.position.z);
            }
          }
        });
        view.glow = st.kit.cached('dsa-glow', () => new THREE.MeshBasicMaterial({
          color: st.kit.color('#e2b867'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false
        }));
        st.root.position.set(-0.1, 0, 0.95);
        buildTable();
        B3D.current = st;
        syncTable();
      }

      // ====================================================
      // 6. 操作パネル
      // ====================================================
      function statusOf(p) {
        if (p.returnedSafe) return '潜水艦に帰還';
        if (p.pos === -1) return '潜水艦';
        return `${p.returning ? '引き返し中' : '潜行中'} · 深さ${p.pos + 1}`;
      }

      function renderAll() {
        const activeP = players[turnIndex];
        const inPlay = turnSubPhase === 'DIRECTION' || turnSubPhase === 'ACTION';

        playersRowEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && inPlay;
          return `
            <div class="dsa-player ${isTurn ? 'is-turn' : ''} ${p.returnedSafe ? 'is-safe' : ''}">
              <span class="dsa-swatch" style="--c:${p.color}"></span>
              <div>
                <div class="dsa-player-name"><span>${p.name}</span><span class="dsa-player-pts">${p.score}<small>点</small></span></div>
                <div class="dsa-player-sub">${statusOf(p)}${p.carried.length ? ` · <em>財宝${p.carried.length}</em>` : ''}</div>
              </div>
            </div>
          `;
        }).join('');

        phaseEl.textContent = turnSubPhase === 'GAME_OVER'
          ? '決着'
          : `ラウンド ${roundNum} / ${TOTAL_ROUNDS}${inPlay && activeP ? ` · ${activeP.name}の手番` : ''}`;
        announceEl.textContent = bannerText;
        airEl.textContent = String(air);
        airBoxEl.classList.toggle('is-low', air <= 8);
        roundEl.innerHTML = `${roundNum}<small>/ ${TOTAL_ROUNDS}</small>`;
        diceEl.textContent = rollSerial ? `${lastDice[0]} + ${lastDice[1]}` : '-';

        const isMyTurn = activeP && !activeP.isCpu && inPlay;
        if (turnSubPhase === 'GAME_OVER') {
          dockEl.innerHTML = `
            <div class="dsa-dock-info"><span class="dsa-dock-label">決着</span><span class="dsa-dock-text">3ラウンドが終わりました。</span></div>
            <div class="dsa-actions"><button class="dsa-btn is-primary" id="dsa-dock-rematch">もう一度潜る</button></div>
          `;
          dockEl.querySelector('#dsa-dock-rematch').onclick = () => initGame();
        } else if (!isMyTurn) {
          dockEl.innerHTML = `<span class="dsa-wait">${inPlay && activeP ? `${activeP.name}が潜っています` : 'ラウンドの結果を確認しています'}</span>`;
        } else if (turnSubPhase === 'DIRECTION') {
          const w = activeP.carried.length;
          if (activeP.returning) {
            dockEl.innerHTML = `
              <div class="dsa-dock-info">
                <span class="dsa-dock-label">潜水艦へ戻る</span>
                <span class="dsa-dock-text">財宝${w}個。出目から${w}を引いた分だけ戻ります。</span>
              </div>
              <div class="dsa-actions"><button class="dsa-btn is-primary" id="dsa-roll-return">ダイスを振る</button></div>
            `;
            dockEl.querySelector('#dsa-roll-return').onclick = () => rollAndMove(activeP, false);
          } else {
            const canTurnBack = activeP.pos >= 0;
            dockEl.innerHTML = `
              <div class="dsa-dock-info">
                <span class="dsa-dock-label">進む向き</span>
                <span class="dsa-dock-text">${w ? `財宝${w}個。出目から${w}を引いた分だけ進みます。` : '出目の合計だけ進みます。'}引き返すと、もう潜ることはできません。</span>
              </div>
              <div class="dsa-actions">
                <button class="dsa-btn" id="dsa-turn-back" ${canTurnBack ? '' : 'disabled'}>引き返してダイスを振る</button>
                <button class="dsa-btn is-primary" id="dsa-keep-diving">潜ってダイスを振る</button>
              </div>
            `;
            dockEl.querySelector('#dsa-keep-diving').onclick = () => rollAndMove(activeP, false);
            const tbBtn = dockEl.querySelector('#dsa-turn-back');
            if (canTurnBack) tbBtn.onclick = () => rollAndMove(activeP, true);
          }
        } else if (turnSubPhase === 'ACTION') {
          const tile = path[activeP.pos];
          const canPickup = tile && (tile.type === 'ruin' || tile.type === 'stack');
          const canDrop = tile && tile.type === 'blank' && activeP.carried.length > 0;
          const tileDesc = canPickup
            ? (tile.type === 'stack' ? `沈んだ財宝${tile.chips.length}枚の束` : LEVEL_META[tile.chips[0].level].name)
            : '空きマス';
          dockEl.innerHTML = `
            <div class="dsa-dock-info">
              <span class="dsa-dock-label">足元</span>
              <span class="dsa-dock-text">${tileDesc}${canPickup ? '。拾うと重さが1増えます。' : '。'}</span>
            </div>
            <div class="dsa-actions">
              ${canDrop ? '<button class="dsa-btn" id="dsa-act-drop">財宝を1個置く</button>' : ''}
              <button class="dsa-btn ${canPickup ? '' : 'is-primary'}" id="dsa-act-pass">何もしない</button>
              ${canPickup ? '<button class="dsa-btn is-primary" id="dsa-act-pickup">拾う</button>' : ''}
            </div>
          `;
          const pBtn = dockEl.querySelector('#dsa-act-pickup');
          if (pBtn) pBtn.onclick = () => executeSearchAction(activeP, 'PICKUP');
          const dBtn = dockEl.querySelector('#dsa-act-drop');
          if (dBtn) dBtn.onclick = () => executeSearchAction(activeP, 'DROP');
          dockEl.querySelector('#dsa-act-pass').onclick = () => executeSearchAction(activeP, 'PASS');
        }

        syncTable();
      }

      pcountSelEl.onchange = () => initGame();
      newBtnEl.onclick = () => initGame();

      initGame();
      B3D.ensureThree().then((threeLib) => {
        if (isDestroyed || !threeLib) return;
        initStage(threeLib);
      });

      return () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
        if (st) {
          if (B3D.current === st) B3D.current = null;
          st.destroy();
          st = null;
        }
      };
    }
  });
})();
