/**
 * スカル (2〜8人)
 * 花3枚と髑髏1枚の円盤で競う読み合いのゲーム。
 *
 * - 公式ルール: 全員が1枚目を伏せたあと、手番ごとに「もう1枚重ねる」か「何枚めくれるか宣言」する。
 *   競りに勝った人は自分のコースターから先にめくり、宣言した枚数をすべて花でめくれたら1勝。2勝で勝利。
 *   髑髏をめくったら円盤を1枚失い、すべて失ったら脱落。
 * - CPU はブラフ (髑髏を伏せてから競りに加わる) や、髑髏を出した人を避けてめくる判断をする
 * - 卓は共通エンジン (arena-3d-engine.js) のステージに、円卓・コースター・厚紙の円盤を置いて描く
 */

(function () {
  const MAX_SEATS = 8;
  const DISC_FLOWER = 'flower';
  const DISC_SKULL = 'skull';

  const SEAT_THEMES = [
    { name: 'あなた',   color: '#4f86b8' },
    { name: 'CPU 紅',   color: '#b5473c' },
    { name: 'CPU 翠',   color: '#5d9160' },
    { name: 'CPU 琥珀', color: '#c79a3c' },
    { name: 'CPU 紫',   color: '#8a63b0' },
    { name: 'CPU 桃',   color: '#c0607f' },
    { name: 'CPU 金',   color: '#b8a04a' },
    { name: 'CPU 氷',   color: '#4fa3a8' }
  ];

  const PHASE_LABELS = {
    FIRST_CARD: '最初の1枚',
    PLAY_OR_BID: '重ねるか宣言',
    BIDDING: '競り',
    REVEALING: 'めくる',
    ROUND_END: 'ラウンド終了',
    GAME_OVER: '決着'
  };

  // Web Audio サウンドエフェクト
  const SkullSfx = {
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
    placeCard() { this.play(320, 0.09, 'triangle', 0.14); },
    bid() { this.play(587.33, 0.12, 'sine', 0.12); setTimeout(() => this.play(880, 0.15, 'sine', 0.12), 70); },
    pass() { this.play(240, 0.1, 'sine', 0.08); },
    flipFlower() {
      [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => this.play(f, 0.14, 'triangle', 0.12), i * 55));
    },
    flipSkull() {
      [190, 145, 110].forEach((f, i) => setTimeout(() => this.play(f, 0.25, 'sawtooth', 0.18), i * 90));
    },
    roundWin() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.play(f, 0.2, 'triangle', 0.15), i * 80));
    }
  };

  // ====================================================
  // 円盤・コースター・卓の絵柄 (canvas)
  // ====================================================
  const SERIF = '"Marcellus", Georgia, "Times New Roman", serif';

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
  }

  function shadeHex(hex, amt) {
    const m = shade(hex, amt).match(/\d+/g);
    return '#' + m.map((v) => (+v).toString(16).padStart(2, '0')).join('');
  }

  function drawRose(ctx, cx, cy, s) {
    // 葉
    ctx.fillStyle = '#4c6a3a';
    [[-0.5, 0.42, -0.7], [0.52, 0.4, 0.75]].forEach(([dx, dy, rot]) => {
      ctx.save();
      ctx.translate(cx + dx * s, cy + dy * s);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.3, s * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(25, 40, 20, 0.5)';
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.moveTo(-s * 0.26, 0);
      ctx.lineTo(s * 0.26, 0);
      ctx.stroke();
      ctx.restore();
    });
    // 外側の花びら
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * s * 0.24, cy + Math.sin(a) * s * 0.22 - s * 0.04);
      ctx.rotate(a + Math.PI / 2);
      const g = ctx.createRadialGradient(0, -s * 0.05, s * 0.02, 0, 0, s * 0.3);
      g.addColorStop(0, '#c43a45');
      g.addColorStop(1, '#7c1a26');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.27, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 内側
    const inner = ctx.createRadialGradient(cx, cy - s * 0.08, s * 0.02, cx, cy - s * 0.04, s * 0.26);
    inner.addColorStop(0, '#d04955');
    inner.addColorStop(1, '#8e1f2c');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.04, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    // 巻いた花芯
    ctx.strokeStyle = 'rgba(70, 8, 18, 0.65)';
    ctx.lineWidth = s * 0.028;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 4.2; t += 0.1) {
      const r = s * 0.02 + t * s * 0.016;
      const x = cx + Math.cos(t) * r;
      const y = cy - s * 0.05 + Math.sin(t) * r * 0.85;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawSkull(ctx, cx, cy, s, bone) {
    ctx.fillStyle = bone;
    // 頭蓋
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.12, s * 0.42, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 頬と顎
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.32, cy + s * 0.05);
    ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 0.28, cx - s * 0.18, cy + s * 0.33);
    ctx.lineTo(cx + s * 0.18, cy + s * 0.33);
    ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.28, cx + s * 0.32, cy + s * 0.05);
    ctx.closePath();
    ctx.fill();
    // 眼窩
    ctx.fillStyle = '#1a1614';
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(cx + side * s * 0.16, cy - s * 0.04, s * 0.12, s * 0.13, side * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });
    // 鼻
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.06);
    ctx.lineTo(cx - s * 0.05, cy + s * 0.15);
    ctx.lineTo(cx + s * 0.05, cy + s * 0.15);
    ctx.closePath();
    ctx.fill();
    // 歯
    ctx.strokeStyle = '#1a1614';
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.16, cy + s * 0.24);
    ctx.lineTo(cx + s * 0.16, cy + s * 0.24);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * s * 0.064, cy + s * 0.2);
      ctx.lineTo(cx + i * s * 0.064, cy + s * 0.32);
      ctx.stroke();
    }
  }

  function faceCanvas(B3D, type) {
    return B3D.canvas.cached(`sk-face:${type}`, 512, 512, (ctx, w, h) => {
      const rose = type === DISC_FLOWER;
      B3D.canvas.paintNoise(ctx, w, h, rose ? '#ebe1cb' : '#221d1a', rose ? 10 : 12, rose ? 41 : 43, 500);
      const cx = w / 2;
      const cy = h / 2;
      const vignette = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.5);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, rose ? 'rgba(90, 50, 30, 0.22)' : 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = rose ? '#6b2a2c' : '#8a2d2a';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rose ? 'rgba(107, 42, 44, 0.45)' : 'rgba(200, 80, 70, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.405, 0, Math.PI * 2);
      ctx.stroke();
      if (rose) drawRose(ctx, cx, cy + 10, 300);
      else drawSkull(ctx, cx, cy, 300, '#e6dcc6');
    });
  }

  function backCanvas(B3D, seat) {
    const color = SEAT_THEMES[seat].color;
    return B3D.canvas.cached(`sk-back:${seat}`, 512, 512, (ctx, w, h) => {
      B3D.canvas.paintNoise(ctx, w, h, shade(color, -0.55), 12, 70 + seat, 400);
      const cx = w / 2;
      const cy = h / 2;
      const light = shade(color, 0.15);
      ctx.strokeStyle = light;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
      ctx.stroke();
      // 部族の文様 (外周の三角と内側の輪)
      ctx.fillStyle = light;
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * w * 0.36, cy + Math.sin(a) * w * 0.36);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-18, 14);
        ctx.lineTo(18, 14);
        ctx.lineTo(0, -22);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = light;
      ctx.lineWidth = 4;
      [0.27, 0.2].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, w * r, 0, Math.PI * 2);
        ctx.stroke();
      });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * w * 0.135, cy + Math.sin(a) * w * 0.135, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.06, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function matCanvas(B3D, seat, won) {
    const color = SEAT_THEMES[seat].color;
    return B3D.canvas.cached(`sk-mat:${seat}:${won}`, 512, 512, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      if (won) {
        B3D.canvas.paintNoise(ctx, w, h, '#b48d3e', 14, 90 + seat, 300);
        const g = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.5);
        g.addColorStop(0, 'rgba(255, 236, 180, 0.35)');
        g.addColorStop(1, 'rgba(60, 35, 10, 0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      } else {
        B3D.canvas.paintNoise(ctx, w, h, '#2b2421', 12, 80 + seat, 300);
      }
      ctx.strokeStyle = won ? '#5b4114' : color;
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.455, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = won ? 'rgba(70, 45, 12, 0.55)' : 'rgba(236, 225, 200, 0.22)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.39, 0, Math.PI * 2);
      ctx.stroke();
      if (won) {
        // 1勝の印 (八芒星)
        ctx.fillStyle = 'rgba(70, 45, 12, 0.7)';
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const r = i % 2 ? w * 0.09 : w * 0.2;
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  function emblemCanvas(B3D) {
    return B3D.canvas.cached('sk-emblem', 1024, 1024, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      ctx.strokeStyle = 'rgba(214, 190, 150, 0.22)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      drawSkull(ctx, cx, cy - 20, 420, '#e6d6b8');
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(214, 190, 150, 0.22)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `400 64px ${SERIF}`;
      const word = 'SKULL';
      [...word].forEach((ch, i) => ctx.fillText(ch, cx + (i - 2) * 64, cy + w * 0.33));
    });
  }

  window.BoardArena.registerGame({
    id: 'skull',
    name: 'スカル',
    icon: '',
    category: 'ブラフ',
    minPlayers: 2,
    maxPlayers: 8,
    description: '花3枚と髑髏1枚の円盤で競う読み合いのゲーム。最大8人でCPUと遊べます。',

    mount(container, bridge) {
      let isDestroyed = false;
      let cpuTimer = null;

      let activePlayerCount = 4; // 4人が最も白熱する
      let vsCpu = !bridge.isConnected();
      let mySeatIndex = bridge.isConnected() ? (bridge.isHost ? 0 : 1) : 0;

      // ゲーム進行ステート
      // phase: 'FIRST_CARD' | 'PLAY_OR_BID' | 'BIDDING' | 'REVEALING' | 'ROUND_END' | 'GAME_OVER'
      let phase = 'FIRST_CARD';
      let roundNumber = 1;
      let currentTurn = 0;
      let highestBid = 0;
      let highestBidder = -1;
      let revealsRemaining = 0;
      let matchSerial = 0; // 新しい対戦ごとに増える (3D の席を組み直す目印)
      let statusBannerText = '';

      // プレイヤー配列 (0 〜 MAX_SEATS-1)
      let players = [];

      container.innerHTML = `
        <style>
          .sk-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: var(--text);
            font-family: var(--font-ui);
          }
          .sk-top-bar, .sk-dock {
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
          .sk-players-row { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 520px; min-width: 0; }
          .sk-player {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 6px 11px 6px 9px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 4px;
            transition: border-color 0.25s, background 0.25s, opacity 0.25s;
          }
          .sk-player.is-turn { border-color: rgba(226, 184, 103, 0.6); background: rgba(226, 184, 103, 0.07); }
          .sk-player.is-out { opacity: 0.45; }
          .sk-swatch { flex: none; width: 12px; height: 12px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35); }
          .sk-player-name { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; white-space: nowrap; }
          .sk-wins { display: inline-flex; gap: 3px; }
          .sk-wins i { width: 7px; height: 7px; border-radius: 50%; border: 1px solid rgba(226, 184, 103, 0.7); }
          .sk-wins i.on { background: #e2b867; }
          .sk-player-sub { font-size: 11px; color: var(--text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
          .sk-player-sub em { font-style: normal; color: #e2b867; }
          .sk-controls, .sk-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .sk-btn, .sk-select {
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
          .sk-select {
            padding-right: 28px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a8a6a0' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
          }
          .sk-select option { background: #161618; color: #ecebe6; }
          .sk-btn:hover:not(:disabled), .sk-select:hover { color: var(--text); border-color: rgba(255, 255, 255, 0.34); }
          .sk-btn:disabled { opacity: 0.35; cursor: not-allowed; }
          .sk-btn.is-primary { background: var(--text); border-color: var(--text); color: var(--text-inverse); font-weight: 700; }
          .sk-btn.is-primary:hover:not(:disabled) { background: #fff; color: var(--text-inverse); }
          .sk-btn.is-bid { min-width: 46px; justify-content: center; font-size: 13px; font-weight: 700; color: var(--text); }
          .sk-btn.is-bid:hover:not(:disabled) { border-color: rgba(226, 184, 103, 0.8); color: #e2b867; }

          .sk-stage-wrap { position: relative; }
          .sk-stage-wrap .ba3d-stage {
            height: clamp(440px, calc(100vh - 290px), 880px);
            background: radial-gradient(90% 80% at 50% 45%, #241a17 0%, #120d0b 60%, #070505 100%);
          }
          .sk-status {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 5;
            max-width: min(520px, calc(100% - 130px));
            padding: 9px 13px;
            background: rgba(14, 12, 11, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #ecebe6;
            pointer-events: none;
          }
          .sk-phase { font-size: 10px; letter-spacing: 0.14em; color: rgba(236, 235, 230, 0.55); }
          .sk-phase b { margin-left: 8px; font-weight: 500; color: rgba(236, 235, 230, 0.4); letter-spacing: 0.08em; }
          .sk-announce { margin-top: 3px; font-size: 13px; line-height: 1.55; }
          .sk-bid { margin-top: 6px; font-size: 12px; color: #e2b867; }
          .sk-bid.hidden { display: none; }

          .sk-hand { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
          .sk-hand-label { margin-right: 2px; font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
          .sk-disc {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 2px solid rgba(0, 0, 0, 0.35);
            font: 700 12px/1 var(--font-ui);
            cursor: pointer;
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45), inset 0 0 0 3px rgba(255, 255, 255, 0.08);
            transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          }
          .sk-disc.is-flower { background: radial-gradient(circle at 40% 35%, #f0e6d0, #d8c9a8); color: #8e1f2c; }
          .sk-disc.is-skull { background: radial-gradient(circle at 40% 35%, #3a322e, #1a1614); color: #e6dcc6; }
          .sk-disc:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(226, 184, 103, 0.7); }
          .sk-disc:disabled { cursor: default; opacity: 0.45; }
          .sk-empty { font-size: 12px; color: var(--text-3); }
          .sk-action-label { width: 100%; font-size: 11px; letter-spacing: 0.06em; color: var(--text-3); text-align: right; }
          .sk-actions { justify-content: flex-end; flex: 1 1 360px; }
          .sk-wait { font-size: 12px; color: var(--text-3); }
          .sk-prompt { font-size: 12px; color: #e2b867; }

          .ba3d-label.sk-seat { padding: 4px 9px; text-align: center; line-height: 1.35; background: rgba(14, 12, 11, 0.6); }
          .ba3d-label.sk-seat b { display: block; font-size: 12px; font-weight: 700; }
          .ba3d-label.sk-seat span { font-size: 10px; color: rgba(236, 235, 230, 0.6); }
          .ba3d-label.sk-seat.is-turn { box-shadow: 0 0 0 1px rgba(226, 184, 103, 0.7); }
          .ba3d-label.sk-seat.is-out { opacity: 0.45; }
          .ba3d-label.sk-center { padding: 0; background: none; text-align: center; }
          .sk-center-num { display: block; font: 400 40px/1 ${SERIF}; color: #e8d6b0; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8); }
          .sk-center-cap { display: block; margin-top: 2px; font-size: 10px; letter-spacing: 0.14em; color: rgba(232, 214, 176, 0.65); }

          .sk-modal-overlay {
            position: absolute;
            inset: 0;
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(8, 7, 6, 0.6);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
          }
          .sk-modal-overlay.hidden { display: none; }
          .sk-modal-card {
            width: min(440px, 100%);
            padding: 24px;
            text-align: center;
            background: var(--bg-raised);
            border: 1px solid var(--line-strong);
            border-radius: 6px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          }
          .sk-modal-art { width: 96px; height: 96px; margin: 0 auto 14px; border-radius: 50%; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.55); }
          .sk-modal-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
          .sk-modal-desc { font-size: 13px; line-height: 1.7; color: var(--text-2); margin-bottom: 18px; }

          @media (max-width: 640px) {
            .sk-stage-wrap .ba3d-stage { height: min(64vh, 480px); }
            .sk-status { max-width: calc(100% - 110px); }
            .sk-announce { font-size: 12px; }
            .sk-player-sub { display: none; }
          }
        </style>

        <div class="sk-wrapper">
          <div class="sk-top-bar">
            <div class="sk-players-row" id="skull-players-strip"></div>
            <div class="sk-controls">
              <select id="skull-count-select" class="sk-select" aria-label="人数">
                <option value="2">2人</option>
                <option value="3">3人</option>
                <option value="4" selected>4人</option>
                <option value="5">5人</option>
                <option value="6">6人</option>
                <option value="7">7人</option>
                <option value="8">8人</option>
              </select>
              <button id="skull-cpu-toggle" class="sk-btn">CPU 自動: オン</button>
              <button id="skull-new-game-btn" class="sk-btn">新しいゲーム</button>
            </div>
          </div>

          <div class="sk-stage-wrap" id="skull-3d-stage">
            <div class="sk-status">
              <div class="sk-phase"><span id="skull-phase-pill"></span><b id="skull-round-badge"></b></div>
              <div class="sk-announce" id="skull-announce-text"></div>
              <div class="sk-bid hidden" id="skull-bid-counter">最高宣言 <strong id="skull-bid-val">0</strong>枚 · <span id="skull-bidder-name">-</span></div>
            </div>
            <div class="sk-modal-overlay hidden" id="skull-round-modal">
              <div class="sk-modal-card">
                <canvas class="sk-modal-art" id="skull-modal-icon" width="192" height="192"></canvas>
                <h3 class="sk-modal-title" id="skull-modal-title"></h3>
                <p class="sk-modal-desc" id="skull-modal-desc"></p>
                <button id="skull-modal-next-btn" class="sk-btn is-primary">次のラウンドへ</button>
              </div>
            </div>
          </div>

          <div class="sk-dock">
            <div class="sk-hand">
              <span class="sk-hand-label">あなたの円盤</span>
              <div class="sk-hand" id="skull-hand-cards"></div>
            </div>
            <div class="sk-actions">
              <div class="sk-action-label" id="skull-action-lbl"></div>
              <div class="sk-actions" id="skull-action-controls"></div>
            </div>
          </div>
        </div>
      `;

      // DOM 参照
      const countSelect = container.querySelector('#skull-count-select');
      const cpuToggleBtn = container.querySelector('#skull-cpu-toggle');
      const roundBadge = container.querySelector('#skull-round-badge');
      const newGameBtn = container.querySelector('#skull-new-game-btn');
      const playersStrip = container.querySelector('#skull-players-strip');
      const phasePill = container.querySelector('#skull-phase-pill');
      const announceText = container.querySelector('#skull-announce-text');
      const bidCounter = container.querySelector('#skull-bid-counter');
      const bidValEl = container.querySelector('#skull-bid-val');
      const bidderNameEl = container.querySelector('#skull-bidder-name');
      const stageWrapEl = container.querySelector('#skull-3d-stage');
      const roundModal = container.querySelector('#skull-round-modal');
      const modalIcon = container.querySelector('#skull-modal-icon');
      const modalTitle = container.querySelector('#skull-modal-title');
      const modalDesc = container.querySelector('#skull-modal-desc');
      const modalNextBtn = container.querySelector('#skull-modal-next-btn');
      const handCardsEl = container.querySelector('#skull-hand-cards');
      const actionLbl = container.querySelector('#skull-action-lbl');
      const actionControlsEl = container.querySelector('#skull-action-controls');

      const B3D = window.BoardArena3D;

      function seatName(i) {
        if (i === mySeatIndex) return 'あなた';
        if (bridge.isConnected() && (i === 0 || i === 1)) return bridge.getRemoteName();
        return SEAT_THEMES[i].name;
      }

      // プレイヤー状態初期化
      function initMatch(resetWins = true) {
        if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
        roundModal.classList.add('hidden');

        if (resetWins) {
          roundNumber = 1;
          matchSerial++;
          players = [];
          for (let i = 0; i < MAX_SEATS; i++) {
            const isActive = i < activePlayerCount;
            players.push({
              index: i,
              name: seatName(i),
              theme: SEAT_THEMES[i],
              isActive: isActive,
              isEliminated: false,
              wins: 0,
              ownedCards: [DISC_FLOWER, DISC_FLOWER, DISC_FLOWER, DISC_SKULL], // 所持カード
              hand: [],       // 現在の手札配列 ['flower', ...]
              stack: [],      // マットに出した山 [{ type, revealed }]
              forfeitedCount: 0,
              passed: false
            });
          }
          currentTurn = 0;
        }

        startRound(currentTurn);
      }

      function startRound(starterIndex) {
        if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
        roundModal.classList.add('hidden');

        // 生存しているアクティブプレイヤー確認
        const alivePlayers = players.filter(p => p.isActive && !p.isEliminated);
        if (alivePlayers.length <= 1) {
          const champ = alivePlayers[0] || players[0];
          triggerGameVictory(champ, '他のプレイヤーが全員脱落しました。');
          return;
        }

        // スターターが脱落していたら次の生存者へ
        let turnIdx = starterIndex;
        while (!players[turnIdx] || !players[turnIdx].isActive || players[turnIdx].isEliminated) {
          turnIdx = (turnIdx + 1) % activePlayerCount;
        }
        currentTurn = turnIdx;

        // 各プレイヤーの手札をownedCardsから復元（シャッフル）
        players.forEach(p => {
          if (!p.isActive || p.isEliminated) {
            p.hand = [];
            p.stack = [];
            p.passed = true;
            return;
          }
          p.hand = [...p.ownedCards];
          // CPUは順番を読まれないよう手札をシャッフル
          if (p.index !== mySeatIndex) {
            p.hand.sort(() => Math.random() - 0.5);
          }
          p.stack = [];
          p.passed = false;
        });

        phase = 'FIRST_CARD';
        highestBid = 0;
        highestBidder = -1;
        revealsRemaining = 0;
        statusBannerText = `ラウンド ${roundNumber}。全員が最初の1枚を自分のコースターに伏せます。`;

        updateAllUI();
        scheduleCpuTurnIfNeeded();
      }

      // ====================================================
      // ゲームロジック進行関数群
      // ====================================================

      // 場の総ディスク枚数を取得
      function getTotalDiscsOnTable() {
        return players.reduce((sum, p) => sum + (p.isActive && !p.isEliminated ? p.stack.length : 0), 0);
      }

      // 次の手番プレイヤーへ移動
      function advanceTurn(onlyNonPassed = false) {
        for (let step = 1; step <= MAX_SEATS; step++) {
          const next = (currentTurn + step) % activePlayerCount;
          const p = players[next];
          if (p && p.isActive && !p.isEliminated) {
            if (!onlyNonPassed || !p.passed) {
              currentTurn = next;
              return;
            }
          }
        }
      }

      // 手札から1枚をマットに伏せて置く
      function playCardToMat(seatIdx, handIdx, isRemote = false) {
        const p = players[seatIdx];
        if (!p || handIdx < 0 || handIdx >= p.hand.length) return;

        const cardType = p.hand.splice(handIdx, 1)[0];
        p.stack.push({ type: cardType, revealed: false });
        SkullSfx.placeCard();

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'play_card', seatIdx, handIdx });
        }

        if (phase === 'FIRST_CARD') {
          checkFirstCardPhaseComplete();
        } else if (phase === 'PLAY_OR_BID') {
          statusBannerText = `${p.name}が1枚重ねました。`;
          advanceTurn(false);
          updateAllUI();
          scheduleCpuTurnIfNeeded();
        }
      }

      function checkFirstCardPhaseComplete() {
        const allPlaced = players
          .filter(p => p.isActive && !p.isEliminated)
          .every(p => p.stack.length >= 1);

        if (allPlaced) {
          phase = 'PLAY_OR_BID';
          const turnPlayer = players[currentTurn];
          statusBannerText = `全員が1枚目を置きました。${turnPlayer.name}の手番です（重ねるか、何枚めくれるか宣言）。`;
        }
        updateAllUI();
        scheduleCpuTurnIfNeeded();
      }

      // チャレンジ枚数の宣言 (Bid / Raise)
      function makeBid(seatIdx, bidAmount, isRemote = false) {
        const p = players[seatIdx];
        const totalOnTable = getTotalDiscsOnTable();
        if (bidAmount <= highestBid || bidAmount > totalOnTable) return;

        highestBid = bidAmount;
        highestBidder = seatIdx;
        phase = 'BIDDING';
        SkullSfx.bid();

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'make_bid', seatIdx, bidAmount });
        }

        statusBannerText = `${p.name}が「${bidAmount}枚めくれる」と宣言しました。`;

        // 場の全枚数（上限）に達した場合は即座にそのプレイヤーのチャレンジへ
        if (bidAmount >= totalOnTable) {
          startRevealPhase();
          return;
        }

        // 他にパスしていないプレイヤーがいるかチェック
        const remainingBidders = players.filter(pl => pl.isActive && !pl.isEliminated && !pl.passed);
        if (remainingBidders.length <= 1) {
          startRevealPhase();
          return;
        }

        advanceTurn(true);
        // もし一周して自分に戻ってきたらチャレンジ突入
        if (currentTurn === highestBidder) {
          startRevealPhase();
          return;
        }

        updateAllUI();
        scheduleCpuTurnIfNeeded();
      }

      // ビッドをパスする
      function passBid(seatIdx, isRemote = false) {
        const p = players[seatIdx];
        p.passed = true;
        SkullSfx.pass();

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'pass_bid', seatIdx });
        }

        statusBannerText = `${p.name}はパスしました。`;

        // パスしていない残りの人数を確認
        const remaining = players.filter(pl => pl.isActive && !pl.isEliminated && !pl.passed);
        if (remaining.length <= 1) {
          startRevealPhase();
          return;
        }

        advanceTurn(true);
        if (currentTurn === highestBidder) {
          startRevealPhase();
          return;
        }

        updateAllUI();
        scheduleCpuTurnIfNeeded();
      }

      // チャレンジ（ディスクめくり）開始
      function startRevealPhase() {
        phase = 'REVEALING';
        currentTurn = highestBidder;
        revealsRemaining = highestBid;
        const challenger = players[highestBidder];

        const hasOwnUnrevealed = challenger.stack.some(c => !c.revealed);
        if (hasOwnUnrevealed) {
          statusBannerText = `${challenger.name}の挑戦（${revealsRemaining}枚）。まず自分のコースターからめくります。`;
        } else {
          statusBannerText = `${challenger.name}の挑戦。めくる相手のコースターを選びます（残り${revealsRemaining}枚）。`;
        }

        updateAllUI();
        scheduleCpuTurnIfNeeded();
      }

      // 指定した座席のスタックの一番上の未公開ディスクをめくる
      function revealTopDiscOfSeat(targetSeatIdx, isRemote = false) {
        if (phase !== 'REVEALING') return;
        const challenger = players[highestBidder];
        const targetPlayer = players[targetSeatIdx];
        if (!targetPlayer) return;

        // チャレンジャー自身のマットに未公開ディスクがある間は、他人のマットをめくれない
        const ownUnrevealed = challenger.stack.some(c => !c.revealed);
        if (ownUnrevealed && targetSeatIdx !== highestBidder) {
          bridge.showToast('まず自分のコースターの円盤をすべてめくってください');
          return;
        }

        // 一番上の未公開ディスクを探す (後から置いた＝配列末尾からめくる)
        let topCard = null;
        for (let i = targetPlayer.stack.length - 1; i >= 0; i--) {
          if (!targetPlayer.stack[i].revealed) {
            topCard = targetPlayer.stack[i];
            break;
          }
        }
        if (!topCard) {
          bridge.showToast('そのコースターにはめくれる円盤がありません');
          return;
        }

        topCard.revealed = true;
        revealsRemaining--;

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'reveal_disc', targetSeatIdx });
        }

        // 髑髏をめくったら失敗
        if (topCard.type === DISC_SKULL) {
          SkullSfx.flipSkull();
          handleChallengeFailure(challenger, targetPlayer);
          return;
        }

        SkullSfx.flipFlower();

        if (revealsRemaining <= 0) {
          // 宣言枚数をすべて花でめくり切った
          handleChallengeSuccess(challenger);
        } else {
          const stillOwn = challenger.stack.some(c => !c.revealed);
          statusBannerText = `花でした。あと${revealsRemaining}枚${stillOwn ? '（まず自分のコースターから）' : ''}。`;
          updateAllUI();
          scheduleCpuTurnIfNeeded();
        }
      }

      function handleChallengeSuccess(challenger) {
        phase = 'ROUND_END';
        challenger.wins += 1;
        SkullSfx.roundWin();

        if (challenger.wins >= 2) {
          triggerGameVictory(challenger, `${highestBid}枚をすべて花でめくり、2勝目を挙げました。`);
          return;
        }

        currentTurn = challenger.index; // 次のラウンドは成功者からスタート
        roundNumber++;
        statusBannerText = `${challenger.name}の挑戦成功。`;

        updateAllUI();
        showRoundModal(
          DISC_FLOWER,
          `${challenger.name}の挑戦成功`,
          `宣言した${highestBid}枚をすべて花でめくりました。${challenger.name}は1勝目です（あと1勝で勝利）。`,
          '次のラウンドへ',
          () => startRound(challenger.index)
        );
      }

      function handleChallengeFailure(challenger, skullOwner) {
        phase = 'ROUND_END';

        // 罰: チャレンジャーの円盤からランダムに1枚失う
        let lostCardText = '';
        if (challenger.ownedCards.length > 0) {
          const rndIdx = Math.floor(Math.random() * challenger.ownedCards.length);
          challenger.ownedCards.splice(rndIdx, 1);
          challenger.forfeitedCount++;
          lostCardText = `${challenger.name}は円盤を1枚失いました（残り${challenger.ownedCards.length}枚）。`;
        }

        if (challenger.ownedCards.length === 0) {
          challenger.isEliminated = true;
          lostCardText += `円盤がなくなり、${challenger.name}は脱落しました。`;
        }

        const selfSkull = (challenger.index === skullOwner.index);
        const desc = selfSkull
          ? `${challenger.name}は自分の髑髏をめくってしまいました。${lostCardText}`
          : `${challenger.name}は${skullOwner.name}の髑髏をめくってしまいました。${lostCardText}`;

        // 次のラウンドはドクロを踏ませたプレイヤーからスタート
        const nextStarter = (!skullOwner.isEliminated) ? skullOwner.index : challenger.index;
        roundNumber++;
        statusBannerText = '髑髏が出ました。';

        updateAllUI();
        showRoundModal(
          DISC_SKULL,
          '髑髏が出ました',
          desc,
          '次のラウンドへ',
          () => startRound(nextStarter)
        );
      }

      function triggerGameVictory(winner, reasonText) {
        phase = 'GAME_OVER';
        SkullSfx.roundWin();
        if (winner.index === mySeatIndex) {
          bridge.recordWin();
        }
        statusBannerText = `${winner.name}の勝利です。`;
        updateAllUI();
        showRoundModal(
          DISC_FLOWER,
          winner.index === mySeatIndex ? 'あなたの勝利' : `${winner.name}の勝利`,
          reasonText,
          'もう一度遊ぶ',
          () => initMatch(true)
        );
      }

      function showRoundModal(discType, title, descText, btnLabel, onNext) {
        const ctx = modalIcon.getContext('2d');
        ctx.clearRect(0, 0, modalIcon.width, modalIcon.height);
        ctx.save();
        ctx.beginPath();
        ctx.arc(96, 96, 96, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(faceCanvas(B3D, discType), 0, 0, 192, 192);
        ctx.restore();
        modalTitle.textContent = title;
        modalDesc.textContent = descText;
        modalNextBtn.textContent = btnLabel;
        modalNextBtn.onclick = () => {
          SkullSfx.placeCard();
          onNext();
        };
        roundModal.classList.remove('hidden');
      }

      // ====================================================
      // CPU (ブラフと読み)
      // ====================================================
      function cpuPlayFirstCard(cpu) {
        if (cpu.hand.length === 0) return;
        // 75%の確率で花、25%の確率で初手からドクロを仕込む
        let idx = cpu.hand.findIndex(c => c === DISC_FLOWER);
        if (idx === -1 || Math.random() < 0.25) {
          idx = Math.floor(Math.random() * cpu.hand.length);
        }
        const card = cpu.hand.splice(idx, 1)[0];
        cpu.stack.push({ type: card, revealed: false });
      }

      function scheduleCpuTurnIfNeeded() {
        if (!vsCpu || isDestroyed) return;
        if (cpuTimer) clearTimeout(cpuTimer);

        // 最初の1枚: まだ置いていない CPU がいれば、少し待ってからまとめて伏せる
        // (先に人が置いても予約が消えないよう、ここで毎回予約し直す)
        if (phase === 'FIRST_CARD') {
          const waiting = players.some(p => p.isActive && !p.isEliminated && p.index !== mySeatIndex && p.stack.length === 0);
          if (waiting) {
            cpuTimer = setTimeout(() => {
              players.forEach(p => {
                if (p.isActive && !p.isEliminated && p.index !== mySeatIndex && p.stack.length === 0) {
                  cpuPlayFirstCard(p);
                }
              });
              checkFirstCardPhaseComplete();
            }, 650);
          }
          return;
        }

        if (phase === 'PLAY_OR_BID' || phase === 'BIDDING' || phase === 'REVEALING') {
          if (currentTurn !== mySeatIndex) {
            cpuTimer = setTimeout(() => executeCpuStep(), 900);
          }
        }
      }

      function executeCpuStep() {
        if (isDestroyed) return;
        const cpu = players[currentTurn];
        if (!cpu || !cpu.isActive || cpu.isEliminated || currentTurn === mySeatIndex) return;

        const totalDiscs = getTotalDiscsOnTable();
        const cpuHasSkullOnTable = cpu.stack.some(c => c.type === DISC_SKULL);

        if (phase === 'PLAY_OR_BID') {
          // 手札がまだあれば55%でもう1枚重ね、それ以外は1枚または2枚で宣言
          if (cpu.hand.length > 0 && Math.random() < 0.55) {
            const pickIdx = Math.floor(Math.random() * cpu.hand.length);
            playCardToMat(cpu.index, pickIdx);
          } else {
            const startBid = (!cpuHasSkullOnTable && totalDiscs >= 2 && Math.random() < 0.4) ? 2 : 1;
            makeBid(cpu.index, Math.min(totalDiscs, startBid));
          }
        } else if (phase === 'BIDDING') {
          // 自分が髑髏を置いているなら低いうちだけブラフで競り上げ、高くなったら降りて相手に踏ませる
          const safeEstimate = Math.max(1, Math.floor(totalDiscs * 0.65));
          if (cpuHasSkullOnTable) {
            if (highestBid < 2 && totalDiscs >= 3 && Math.random() < 0.35) {
              makeBid(cpu.index, highestBid + 1);
            } else {
              passBid(cpu.index);
            }
          } else if (highestBid < safeEstimate && Math.random() < 0.6) {
            makeBid(cpu.index, highestBid + 1);
          } else {
            passBid(cpu.index);
          }
        } else if (phase === 'REVEALING') {
          // 自分のコースターを先に、その後は未公開の円盤がある席から選ぶ
          const ownUnrevealed = cpu.stack.some(c => !c.revealed);
          if (ownUnrevealed) {
            revealTopDiscOfSeat(cpu.index);
          } else {
            const candidates = players.filter(p =>
              p.isActive && !p.isEliminated && p.index !== cpu.index && p.stack.some(c => !c.revealed)
            );
            if (candidates.length > 0) {
              const target = candidates[Math.floor(Math.random() * candidates.length)];
              revealTopDiscOfSeat(target.index);
            }
          }
        }
      }

      // ====================================================
      // 3D の円卓 (共通エンジンのステージ)
      // ====================================================
      const TABLE_R = 8.6;
      const MAT_DIST = 3.9;
      const HAND_DIST = 6.55;
      const DISC_H = 0.11;
      const MAT_H = 0.05;

      let THREE = null;
      let st = null;
      const view = {
        key: null,
        seats: new Map(), // seat -> { mat, top, label, ring, u, t, Rm, Rd }
        discs: new Map(), // seat -> [disc obj]
        prevHand: new Map(), // seat -> 前回の手元の並び
        center: null,
        glow: null
      };

      const geoC = (key, make) => st.geo.cached(key, make);

      function seatGeometry(n) {
        const Rm = Math.max(0.85, Math.min(1.25, ((Math.PI * MAT_DIST) / n) * 0.42));
        return { Rm, Rd: Rm * 0.8 };
      }

      function seatAxes(idx, n) {
        const a = Math.PI / 2 + idx * ((Math.PI * 2) / n);
        return { u: { x: Math.cos(a), z: Math.sin(a) }, t: { x: -Math.sin(a), z: Math.cos(a) }, a };
      }

      const capGeo = (r) => geoC(`sk-cap:${r.toFixed(3)}`, () => new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2));

      function faceMat(type) {
        return st.kit.cached(`sk-face:${type}`, () => new THREE.MeshStandardMaterial({
          map: st.kit.texture(faceCanvas(B3D, type)), roughness: 0.6, metalness: 0, envMapIntensity: 0.4
        }));
      }

      function backMat(seat) {
        return st.kit.cached(`sk-back:${seat}`, () => new THREE.MeshStandardMaterial({
          map: st.kit.texture(backCanvas(B3D, seat)), roughness: 0.6, metalness: 0, envMapIntensity: 0.4
        }));
      }

      function matTopMat(seat, won) {
        return st.kit.cached(`sk-mat:${seat}:${won}`, () => new THREE.MeshStandardMaterial({
          map: st.kit.texture(matCanvas(B3D, seat, won)), roughness: won ? 0.45 : 0.8, metalness: won ? 0.25 : 0, envMapIntensity: won ? 0.8 : 0.35
        }));
      }

      // ---- 円盤 ----
      function makeDisc(seat, type, Rd) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(
          geoC(`sk-disc:${Rd.toFixed(3)}`, () => st.geo.disc(Rd, DISC_H, 0.025)),
          st.kit.matte(shadeHex(SEAT_THEMES[seat].color, -0.35), { roughness: 0.75 })
        );
        body.castShadow = true;
        body.receiveShadow = true;
        const top = new THREE.Mesh(capGeo(Rd - 0.025), faceMat(type));
        top.position.y = DISC_H / 2 + 0.0008;
        const bottom = new THREE.Mesh(capGeo(Rd - 0.025), backMat(seat));
        bottom.rotation.x = Math.PI;
        bottom.position.y = -DISC_H / 2 - 0.0008;
        const ring = new THREE.Mesh(geoC(`sk-ring:${Rd.toFixed(3)}`, () => new THREE.RingGeometry(Rd * 1.06, Rd * 1.16, 48).rotateX(-Math.PI / 2)), view.glow);
        ring.position.y = -DISC_H / 2 + 0.004;
        ring.renderOrder = 3;
        ring.visible = false;
        g.add(body, top, bottom, ring);
        g.userData = { seat, type, ring, zone: null, idx: -1, revealed: false, home: null };
        st.root.add(g);
        if (seat === mySeatIndex) bindMyDisc(g);
        return g;
      }

      function canPlayMyDisc() {
        const me = players[mySeatIndex];
        if (!me || me.isEliminated || !roundModal.classList.contains('hidden')) return false;
        return (phase === 'FIRST_CARD' && me.stack.length === 0) || (phase === 'PLAY_OR_BID' && currentTurn === mySeatIndex);
      }

      function bindMyDisc(g) {
        st.pick(g, {
          enabled: () => g.userData.zone === 'hand',
          clickable: () => canPlayMyDisc(),
          onHover: () => {
            const h = g.userData.home;
            if (h && canPlayMyDisc()) st.animate(g, { position: { x: h.x, y: h.y + 0.35, z: h.z } }, { duration: 160 });
          },
          onLeave: () => {
            const h = g.userData.home;
            if (h && g.userData.zone === 'hand') st.animate(g, { position: { x: h.x, y: h.y, z: h.z } }, { duration: 200 });
          },
          onClick: () => {
            if (g.userData.zone === 'hand' && canPlayMyDisc()) playCardToMat(mySeatIndex, g.userData.idx);
          }
        });
      }

      // ---- 席の組み立て ----
      function canRevealSeat(seat) {
        if (phase !== 'REVEALING' || highestBidder !== mySeatIndex) return false;
        if (!roundModal.classList.contains('hidden')) return false;
        const me = players[mySeatIndex];
        const target = players[seat];
        if (!me || !target) return false;
        const ownUnrevealed = me.stack.some((c) => !c.revealed);
        if (ownUnrevealed) return seat === mySeatIndex;
        return seat !== mySeatIndex && target.stack.some((c) => !c.revealed);
      }

      function buildSeats() {
        view.key = `${matchSerial}:${activePlayerCount}`;
        view.seats.forEach((s) => {
          st.removeObject(s.mat);
          st.removeObject(s.ring);
          if (s.label) s.label.remove();
        });
        view.seats.clear();
        view.discs.forEach((list) => list.forEach((d) => st.removeObject(d)));
        view.discs.clear();
        view.prevHand.clear();

        const n = activePlayerCount;
        const { Rm, Rd } = seatGeometry(n);
        for (let i = 0; i < n; i++) {
          const { u, t } = seatAxes(i, n);
          const mat = new THREE.Group();
          mat.position.set(u.x * MAT_DIST, 0, u.z * MAT_DIST);
          const body = new THREE.Mesh(geoC(`sk-mat:${Rm.toFixed(3)}`, () => st.geo.disc(Rm, MAT_H, 0.02)), st.kit.matte('#1f1a17', { roughness: 0.85 }));
          body.position.y = MAT_H / 2;
          body.castShadow = true;
          body.receiveShadow = true;
          const top = new THREE.Mesh(capGeo(Rm - 0.02), matTopMat(i, false));
          top.position.y = MAT_H + 0.0008;
          top.receiveShadow = true;
          mat.add(body, top);
          st.root.add(mat);

          // 手番・めくれる席を示す輪
          const ring = new THREE.Mesh(geoC(`sk-mat-ring:${Rm.toFixed(3)}`, () => new THREE.RingGeometry(Rm * 1.05, Rm * 1.13, 64).rotateX(-Math.PI / 2)), view.glow);
          ring.position.set(mat.position.x, 0.004, mat.position.z);
          ring.renderOrder = 3;
          ring.visible = false;
          st.root.add(ring);

          st.pick(mat, {
            clickable: () => canRevealSeat(i),
            onHover: () => { if (canRevealSeat(i)) st.animate(mat, { position: { y: 0.05 } }, { duration: 150 }); },
            onLeave: () => st.animate(mat, { position: { y: 0 } }, { duration: 200 }),
            onClick: () => { if (canRevealSeat(i)) revealTopDiscOfSeat(i); }
          });

          let label = null;
          if (i !== mySeatIndex) {
            label = st.label('', { className: 'sk-seat' });
            label.at(u.x * (HAND_DIST + 1.0), 0.3, u.z * (HAND_DIST + 1.0));
          }
          view.seats.set(i, { mat, top, ring, label, u, t, Rm, Rd, won: false });
          view.discs.set(i, []);
        }
      }

      function buildTable() {
        // 円卓 (胡桃の縁と革張りの天板)
        const rim = new THREE.Mesh(st.geo.disc(TABLE_R, 0.36, 0.1), st.kit.wood('walnut', { repeat: 0.12, seed: 29, clearcoat: 0.45 }));
        rim.position.y = -0.18;
        rim.castShadow = true;
        rim.receiveShadow = true;
        st.root.add(rim);
        const leather = new THREE.Mesh(new THREE.CircleGeometry(TABLE_R - 0.62, 96).rotateX(-Math.PI / 2), st.kit.felt('#3b2421', { repeat: 0.45 }));
        leather.position.y = 0.0015;
        leather.receiveShadow = true;
        st.root.add(leather);
        const inlay = new THREE.Mesh(new THREE.RingGeometry(TABLE_R - 0.66, TABLE_R - 0.6, 128).rotateX(-Math.PI / 2), st.kit.metal('#b08a45', { roughness: 0.35 }));
        inlay.position.y = 0.003;
        st.root.add(inlay);
        const emblem = new THREE.Mesh(
          new THREE.PlaneGeometry(4.2, 4.2).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: st.kit.texture(emblemCanvas(B3D)), transparent: true, depthWrite: false, toneMapped: false })
        );
        emblem.position.y = 0.004;
        emblem.renderOrder = 1;
        st.root.add(emblem);
      }

      // ---- 円盤の配置 ----
      function jitter(seat, i, k) {
        const x = Math.sin(seat * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453;
        return x - Math.floor(x) - 0.5;
      }

      function poseFor(p, slot) {
        const s = view.seats.get(p.index);
        const { u, t, Rd, Rm } = s;
        const mx = u.x * MAT_DIST;
        const mz = u.z * MAT_DIST;
        if (slot.zone === 'stack' && !slot.revealed) {
          return {
            x: mx + jitter(p.index, slot.i, 1) * 0.08,
            y: MAT_H + DISC_H / 2 + slot.i * (DISC_H + 0.004),
            z: mz + jitter(p.index, slot.i, 2) * 0.08,
            rx: 0, ry: jitter(p.index, slot.i, 3) * 0.6, rz: Math.PI, s: 1
          };
        }
        if (slot.zone === 'stack') {
          // めくった円盤はコースターから卓の中央へ向けて並べる (最後にめくったものがいちばん手前)
          const k = slot.k;
          const d = MAT_DIST - (Rm + Rd * 0.95 + k * Rd * 0.6);
          return { x: u.x * d, y: DISC_H / 2 + 0.004 + k * 0.003, z: u.z * d, rx: 0, ry: 0, rz: 0, s: 1 };
        }
        if (p.index === mySeatIndex) {
          // 下の操作パネルと同じく左から順に並べる
          const n = p.hand.length;
          const off = (slot.i - (n - 1) / 2) * Rd * 2.15;
          const d = HAND_DIST - 0.45;
          return { x: u.x * d - t.x * off, y: DISC_H / 2 + 0.004, z: u.z * d - t.z * off, rx: 0, ry: 0, rz: 0, s: 1 };
        }
        // 相手の手元の円盤は伏せて重ねる
        return {
          x: u.x * (HAND_DIST - 0.3) + jitter(p.index, slot.i, 4) * 0.06,
          y: DISC_H * 0.8 / 2 + 0.004 + slot.i * (DISC_H * 0.8 + 0.004),
          z: u.z * (HAND_DIST - 0.3) + jitter(p.index, slot.i, 5) * 0.06,
          rx: 0, ry: jitter(p.index, slot.i, 6) * 0.8, rz: Math.PI, s: 0.8
        };
      }

      function place(obj, pose, moving, delay) {
        const h = obj.userData.home;
        if (h && h.x === pose.x && h.y === pose.y && h.z === pose.z && h.rz === pose.rz && h.s === pose.s) return;
        obj.userData.home = pose;
        st.animate(obj, {
          position: { x: pose.x, y: pose.y, z: pose.z },
          rotation: { x: pose.rx, y: pose.ry, z: pose.rz },
          scale: pose.s
        }, { duration: moving ? 620 : 320, delay, arc: moving ? 1.1 : 0, ease: 'inOutCubic' });
      }

      function loseDisc(obj, delay) {
        obj.userData.zone = 'lost';
        st.animate(obj, {
          position: { x: obj.position.x * 1.6, y: 3.5, z: obj.position.z * 1.6 },
          rotation: { x: 1.4, y: obj.rotation.y + 2, z: obj.rotation.z },
          scale: 0.4
        }, { duration: 800, delay, ease: 'inOutCubic', complete: () => st.removeObject(obj) });
      }

      function syncSeat(p, order) {
        const seat = view.seats.get(p.index);
        if (!seat) return order;
        const objs = view.discs.get(p.index) || [];
        const slots = [];
        // めくった順 (上から) に 0, 1, 2…
        const revealedOrder = new Map();
        for (let i = p.stack.length - 1; i >= 0; i--) {
          if (p.stack[i].revealed) revealedOrder.set(i, revealedOrder.size);
        }
        p.stack.forEach((c, i) => slots.push({ zone: 'stack', i, type: c.type, revealed: c.revealed, k: revealedOrder.get(i) }));
        p.hand.forEach((type, i) => slots.push({ zone: 'hand', i, type }));

        // 手元から1枚出しただけなら、どの位置の円盤が出たかを前回の並びから割り出す
        const prevHand = view.prevHand.get(p.index) || [];
        let removedIdx = -1;
        if (p.hand.length === prevHand.length - 1) {
          removedIdx = p.hand.findIndex((type, i) => type !== prevHand[i]);
          if (removedIdx < 0) removedIdx = p.hand.length;
        }
        const oldHandIdx = (i) => (removedIdx >= 0 && i >= removedIdx ? i + 1 : i);

        const assigned = new Array(slots.length).fill(null);
        const free = new Set(objs);
        // 1) 同じ場所・同じ種類の円盤はそのまま
        slots.forEach((s, k) => {
          const idx = s.zone === 'hand' ? oldHandIdx(s.i) : s.i;
          const o = objs.find((d) => free.has(d) && d.userData.zone === s.zone && d.userData.idx === idx && d.userData.type === s.type);
          if (o) {
            assigned[k] = o;
            free.delete(o);
          }
        });
        // 2) 場所が変わった円盤 (コースターへは出した位置の円盤を、手元へはコースターから戻るものを優先)
        slots.forEach((s, k) => {
          if (assigned[k]) return;
          const cands = [...free].filter((d) => d.userData.type === s.type);
          const o = (s.zone === 'stack' && cands.find((d) => d.userData.zone === 'hand' && d.userData.idx === removedIdx))
            || cands.find((d) => d.userData.zone === (s.zone === 'stack' ? 'hand' : 'stack'))
            || cands[0];
          if (o) {
            assigned[k] = o;
            free.delete(o);
          }
        });
        view.prevHand.set(p.index, p.hand.slice());
        // 3) 余った円盤は失ったもの
        free.forEach((o) => loseDisc(o, 200));
        // 4) 足りない円盤は新しく置く
        const fresh = new Set();
        slots.forEach((s, k) => {
          if (!assigned[k]) {
            assigned[k] = makeDisc(p.index, s.type, seat.Rd);
            fresh.add(assigned[k]);
          }
        });
        view.discs.set(p.index, assigned);

        slots.forEach((s, k) => {
          const o = assigned[k];
          const pose = poseFor(p, s);
          const moving = o.userData.zone !== s.zone || o.userData.revealed !== !!s.revealed;
          o.userData.zone = s.zone;
          o.userData.idx = s.i;
          o.userData.revealed = !!s.revealed;
          if (fresh.has(o)) {
            o.position.set(pose.x, pose.y + 2.2, pose.z);
            o.rotation.set(pose.rx, pose.ry, pose.rz);
            o.scale.setScalar(pose.s);
            o.userData.home = null;
            place(o, pose, false, 120 + order * 45);
            order++;
          } else {
            place(o, pose, moving, 0);
          }
        });
        return order;
      }

      function syncTable() {
        if (!st) return;
        if (view.key !== `${matchSerial}:${activePlayerCount}`) buildSeats();

        let order = 0;
        players.forEach((p) => {
          if (!p.isActive) return;
          order = syncSeat(p, order);
          const seat = view.seats.get(p.index);
          // 1勝したコースターは金色の面に
          const won = p.wins >= 1;
          if (seat.won !== won) {
            seat.won = won;
            seat.top.material = matTopMat(p.index, won);
            if (won) {
              seat.mat.scale.setScalar(1.12);
              st.animate(seat.mat, { scale: 1 }, { duration: 500, ease: 'outBack' });
            }
          }
          const isTurn = phase !== 'FIRST_CARD' && phase !== 'ROUND_END' && phase !== 'GAME_OVER' && currentTurn === p.index && !p.isEliminated;
          seat.ring.visible = isTurn || canRevealSeat(p.index);
          if (seat.label) {
            const status = p.isEliminated ? '脱落' : p.passed && phase === 'BIDDING' ? 'パス' : `手元 ${p.hand.length} · 場 ${p.stack.length}`;
            seat.label.el.innerHTML = `<b style="color:${p.theme.color}">${p.name}${p.wins ? ' ●' : ''}</b><span>${status}</span>`;
            seat.label.el.classList.toggle('is-turn', isTurn);
            seat.label.el.classList.toggle('is-out', p.isEliminated);
          }
        });

        // 自分の手元の円盤: 出せるときは縁が光る
        (view.discs.get(mySeatIndex) || []).forEach((d) => {
          d.userData.ring.visible = d.userData.zone === 'hand' && canPlayMyDisc();
        });

        // 卓の中央に最高宣言
        if (highestBid > 0 && (phase === 'BIDDING' || phase === 'REVEALING')) {
          const cap = phase === 'REVEALING' ? `あと ${revealsRemaining}枚` : '最高宣言';
          view.center.el.innerHTML = `<span class="sk-center-num">${highestBid}</span><span class="sk-center-cap">${cap}</span>`;
          view.center.show(true);
        } else {
          view.center.show(false);
        }
        st.refreshHover();
      }

      function initStage(threeLib) {
        THREE = threeLib;
        st = B3D.createStage(THREE, stageWrapEl, {
          embed: true,
          radius: 18.5,
          phi: 0.64,
          extent: 9,
          tableY: false,
          minRadius: 9,
          maxRadius: 28,
          maxPhi: 1.2,
          keyIntensity: 1.8,
          onFrame(now) {
            if (view.glow) view.glow.opacity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(now / 260));
          }
        });
        view.glow = st.kit.cached('sk-glow', () => new THREE.MeshBasicMaterial({
          color: st.kit.color('#e2b867'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false
        }));
        // 自分の席 (手前) と手元の円盤が画面に収まるよう、卓を少し奥へずらす
        st.root.position.z = -1.3;
        buildTable();
        view.center = st.label('', { className: 'sk-center' });
        view.center.at(0, 0.2, 0);
        view.center.show(false);
        B3D.current = st;
        syncTable();
      }

      // ====================================================
      // 操作パネル
      // ====================================================
      function updateAllUI() {
        roundBadge.textContent = `ラウンド ${roundNumber}`;
        phasePill.textContent = PHASE_LABELS[phase] || phase;
        announceText.textContent = statusBannerText;

        // 最高宣言
        if (highestBid > 0 && highestBidder >= 0) {
          bidCounter.classList.remove('hidden');
          bidValEl.textContent = highestBid;
          bidderNameEl.textContent = players[highestBidder].name;
        } else {
          bidCounter.classList.add('hidden');
        }

        // 1. プレイヤー
        playersStrip.innerHTML = '';
        players.filter(p => p.isActive).forEach(p => {
          const isTurn = (phase !== 'FIRST_CARD' && currentTurn === p.index && !p.isEliminated);
          const status = p.isEliminated ? '脱落' : (p.passed && phase === 'BIDDING' ? '<em>パス</em>' : `手元 ${p.hand.length} · 場 ${p.stack.length}`);
          const badge = document.createElement('div');
          badge.className = `sk-player ${isTurn ? 'is-turn' : ''} ${p.isEliminated ? 'is-out' : ''}`;
          badge.innerHTML = `
            <span class="sk-swatch" style="--c:${p.theme.color}"></span>
            <div>
              <div class="sk-player-name"><span>${p.name}</span><span class="sk-wins"><i class="${p.wins >= 1 ? 'on' : ''}"></i><i class="${p.wins >= 2 ? 'on' : ''}"></i></span></div>
              <div class="sk-player-sub">${status} · 円盤 ${p.ownedCards.length}</div>
            </div>
          `;
          playersStrip.appendChild(badge);
        });

        // 2. 自分の円盤
        const me = players[mySeatIndex];
        if (me) {
          handCardsEl.innerHTML = '';
          const canPlayCard = !me.isEliminated && (
            (phase === 'FIRST_CARD' && me.stack.length === 0) ||
            (phase === 'PLAY_OR_BID' && currentTurn === mySeatIndex)
          );

          if (me.hand.length === 0) {
            handCardsEl.innerHTML = `<span class="sk-empty">${me.isEliminated ? '円盤はありません' : 'すべてコースターに出しています'}</span>`;
          } else {
            me.hand.forEach((cardType, hIdx) => {
              const btn = document.createElement('button');
              btn.className = `sk-disc ${cardType === DISC_FLOWER ? 'is-flower' : 'is-skull'}`;
              btn.textContent = cardType === DISC_FLOWER ? '花' : '髑髏';
              btn.disabled = !canPlayCard;
              if (canPlayCard) btn.addEventListener('click', () => playCardToMat(mySeatIndex, hIdx));
              handCardsEl.appendChild(btn);
            });
          }
        }

        // 3. 操作
        actionControlsEl.innerHTML = '';
        const addBtn = (label, cls, onClick) => {
          const b = document.createElement('button');
          b.className = `sk-btn ${cls}`;
          b.textContent = label;
          b.addEventListener('click', onClick);
          actionControlsEl.appendChild(b);
        };

        if (!me || me.isEliminated) {
          actionLbl.textContent = phase === 'GAME_OVER' ? '' : 'あなたは脱落しました（観戦中）';
        } else if (phase === 'FIRST_CARD') {
          actionLbl.textContent = '最初の1枚を伏せる';
          actionControlsEl.innerHTML = me.stack.length === 0
            ? `<span class="sk-prompt">円盤を選んでコースターに伏せてください</span>`
            : `<span class="sk-wait">他のプレイヤーを待っています</span>`;
        } else if (phase === 'PLAY_OR_BID') {
          if (currentTurn === mySeatIndex) {
            actionLbl.textContent = '重ねるか、何枚めくれるか宣言';
            const totalDiscs = getTotalDiscsOnTable();
            for (let b = 1; b <= totalDiscs; b++) addBtn(`${b}枚`, 'is-bid', () => makeBid(mySeatIndex, b));
          } else {
            actionLbl.textContent = '';
            actionControlsEl.innerHTML = `<span class="sk-wait">${players[currentTurn].name}の手番です</span>`;
          }
        } else if (phase === 'BIDDING') {
          if (currentTurn === mySeatIndex) {
            actionLbl.textContent = `${highestBid + 1}枚以上で競り上げるか、パス`;
            const totalDiscs = getTotalDiscsOnTable();
            for (let b = highestBid + 1; b <= totalDiscs; b++) addBtn(`${b}枚`, 'is-bid', () => makeBid(mySeatIndex, b));
            addBtn('パス', '', () => passBid(mySeatIndex));
          } else {
            actionLbl.textContent = '';
            actionControlsEl.innerHTML = `<span class="sk-wait">${players[currentTurn].name}が考えています（最高宣言 ${highestBid}枚）</span>`;
          }
        } else if (phase === 'REVEALING') {
          if (highestBidder === mySeatIndex) {
            const ownUnrevealed = me.stack.some(c => !c.revealed);
            actionLbl.textContent = `挑戦中: あと${revealsRemaining}枚。光っているコースターを選んでもめくれます`;
            if (ownUnrevealed) {
              addBtn(`自分のコースターをめくる（残り${me.stack.filter(c => !c.revealed).length}枚）`, 'is-primary', () => revealTopDiscOfSeat(mySeatIndex));
            } else {
              players.filter(p => p.isActive && !p.isEliminated && p.index !== mySeatIndex).forEach(p => {
                const unrevCount = p.stack.filter(c => !c.revealed).length;
                if (unrevCount > 0) addBtn(`${p.name}（${unrevCount}枚）`, '', () => revealTopDiscOfSeat(p.index));
              });
            }
          } else {
            actionLbl.textContent = '';
            actionControlsEl.innerHTML = `<span class="sk-wait">${players[highestBidder].name}が円盤をめくっています</span>`;
          }
        } else {
          actionLbl.textContent = '';
        }

        syncTable();
      }

      // ====================================================
      // 上部の操作 & P2P通信イベント
      // ====================================================
      countSelect.addEventListener('change', (e) => {
        activePlayerCount = parseInt(e.target.value, 10);
        initMatch(true);
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'change_count', count: activePlayerCount });
        }
      });

      cpuToggleBtn.addEventListener('click', () => {
        vsCpu = !vsCpu;
        cpuToggleBtn.textContent = vsCpu ? 'CPU 自動: オン' : 'CPU 自動: オフ';
        if (vsCpu) scheduleCpuTurnIfNeeded();
      });
      cpuToggleBtn.textContent = vsCpu ? 'CPU 自動: オン' : 'CPU 自動: オフ';

      newGameBtn.addEventListener('click', () => {
        initMatch(true);
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'restart_match' });
        }
      });

      bridge.onReceive((data) => {
        if (data.game !== 'skull') return;
        if (data.type === 'change_count') {
          activePlayerCount = data.count;
          countSelect.value = data.count.toString();
          initMatch(true);
        } else if (data.type === 'play_card') {
          playCardToMat(data.seatIdx, data.handIdx, true);
        } else if (data.type === 'make_bid') {
          makeBid(data.seatIdx, data.bidAmount, true);
        } else if (data.type === 'pass_bid') {
          passBid(data.seatIdx, true);
        } else if (data.type === 'reveal_disc') {
          revealTopDiscOfSeat(data.targetSeatIdx, true);
        } else if (data.type === 'restart_match') {
          initMatch(true);
        }
      });

      bridge.onPlayerJoined(() => {
        mySeatIndex = bridge.isHost ? 0 : 1;
        initMatch(true);
        bridge.showToast('対戦相手が着席しました');
      });

      // 起動
      initMatch(true);
      B3D.ensureThree().then((threeLib) => {
        if (isDestroyed || !threeLib) return;
        initStage(threeLib);
      });

      this.cleanup = () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
        if (st) {
          if (B3D.current === st) B3D.current = null;
          st.destroy();
          st = null;
        }
      };
      return this.cleanup;
    },

    unmount() {
      if (this.cleanup) this.cleanup();
    }
  });
})();
