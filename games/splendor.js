/**
 * 宝石の煌き (Splendor) 2〜4人
 * 宝石を集めて発展カードを買い、カードの割引で次の買い物を軽くしていく拡大再生産のゲーム。
 *
 * - 公式ルール: 手番には「異なる3色を1枚ずつ」「同じ色を2枚 (その色が4枚以上あるとき)」
 *   「カードを予約して金を1枚」「カードを購入」のどれか1つを行う。トークンは10枚まで。
 *   手番の終わりに条件を満たした貴族が1人訪れる。誰かが15点に達したらそのラウンドの最後まで遊び、
 *   最多得点の人が勝つ (同点なら購入したカードの少ない人)。
 * - CPU は買えるカードを得点と貴族の条件で選び、買えなければ近いカードに必要な色を集める
 * - 卓は共通エンジン (arena-3d-engine.js) のステージに、厚紙のカード・貴族タイル・宝石のチップを置いて描く
 */

(function () {
  const GEM_TYPES = ['white', 'blue', 'green', 'red', 'black'];
  const ALL_TOKEN_TYPES = ['white', 'blue', 'green', 'red', 'black', 'gold'];

  // chip: トークンの地色 / gem: 宝石の絵の色 / ink: チップ上の文字色
  const GEM_META = {
    white: { name: 'ダイヤモンド', short: '白', chip: '#e4ded2', gem: '#e6eef3', ink: '#2a2622' },
    blue:  { name: 'サファイア',   short: '青', chip: '#22488a', gem: '#2d67c8', ink: '#f6f2ea' },
    green: { name: 'エメラルド',   short: '緑', chip: '#1d6644', gem: '#2a9660', ink: '#f6f2ea' },
    red:   { name: 'ルビー',       short: '赤', chip: '#92212d', gem: '#cf3343', ink: '#f6f2ea' },
    black: { name: 'オニキス',     short: '黒', chip: '#2a2624', gem: '#4c4642', ink: '#f6f2ea' },
    gold:  { name: '金',           short: '金', chip: '#b48c2c', gem: '#e3bb4f', ink: '#2a2014' }
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

  // 公式 10枚の貴族タイル (全て3点)
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
  const NOBLE_BY_ID = Object.fromEntries(NOBLE_TILES.map((n) => [n.id, n]));

  // 貴族タイルのカメオ (field: 楕円の地色 / hat: 頭の飾り)
  const NOBLE_LOOK = {
    n1:  { field: '#6b2630', hat: 'cap' },
    n2:  { field: '#2f4a6b', hat: 'hair' },
    n3:  { field: '#4a2d55', hat: 'beret' },
    n4:  { field: '#2f5446', hat: 'crown' },
    n5:  { field: '#7a3a26', hat: 'crown' },
    n6:  { field: '#5a4a22', hat: 'crown' },
    n7:  { field: '#2b3a66', hat: 'beret' },
    n8:  { field: '#2c5a5a', hat: 'hood' },
    n9:  { field: '#3a3634', hat: 'cap' },
    n10: { field: '#2e5f4a', hat: 'turban' }
  };

  const PLAYER_THEMES = [
    { name: 'あなた', color: '#4f86b8' },
    { name: 'CPU ヴェネツィア', color: '#b5473c' },
    { name: 'CPU フィレンツェ', color: '#5d9160' },
    { name: 'CPU アントワープ', color: '#c79a3c' }
  ];

  // サウンド
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
  const CARD_BY_ID = Object.fromEntries(buildFullDeck().map((c) => [c.id, c]));

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
  const UI_FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic UI", sans-serif';
  const SERIF = '"Marcellus", Georgia, "Times New Roman", serif';

  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function shade(hex, amt) {
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    const [r, g, b] = rgbOf(hex);
    return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
  }

  function mixHex(a, b, t) {
    const ca = rgbOf(a);
    const cb = rgbOf(b);
    const v = ca.map((x, i) => Math.round(x + (cb[i] - x) * t));
    return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function spacedText(ctx, text, cx, cy, spacing) {
    const widths = [...text].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((s, x) => s + x, 0) + spacing * (text.length - 1);
    let x = cx - total / 2;
    [...text].forEach((ch, i) => {
      ctx.fillText(ch, x + widths[i] / 2, cy);
      x += widths[i] + spacing;
    });
  }

  function sparkle(ctx, x, y, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s * 0.32, y);
    ctx.quadraticCurveTo(x, y, x, y + s * 0.7);
    ctx.quadraticCurveTo(x, y, x - s * 0.32, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
    ctx.restore();
  }

  // ブリリアントカットを真上から見た宝石
  function drawGem(ctx, cx, cy, r, color) {
    const base = GEM_META[color].gem;
    const n = 8;
    const outer = [];
    const inner = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.PI / n - Math.PI / 2;
      outer.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      inner.push([cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56]);
    }
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = r * 0.3;
    ctx.shadowOffsetY = r * 0.1;
    poly(outer);
    ctx.fillStyle = shade(base, -0.35);
    ctx.fill();
    ctx.restore();

    // 冠部の切子面 (左上からの光)
    const light = -Math.PI * 0.75;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const mid = ((k + 0.5) / n) * Math.PI * 2 + Math.PI / n - Math.PI / 2;
      const lum = (Math.cos(mid - light) + 1) / 2;
      ctx.beginPath();
      ctx.moveTo(outer[k][0], outer[k][1]);
      ctx.lineTo(outer[k2][0], outer[k2][1]);
      ctx.lineTo(inner[k2][0], inner[k2][1]);
      ctx.lineTo(inner[k][0], inner[k][1]);
      ctx.closePath();
      ctx.fillStyle = shade(base, -0.42 + lum * 0.64);
      ctx.fill();
    }

    // テーブル面
    const tg = ctx.createLinearGradient(cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5);
    tg.addColorStop(0, shade(base, 0.4));
    tg.addColorStop(1, shade(base, -0.08));
    poly(inner);
    ctx.fillStyle = tg;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    for (let k = 0; k < n; k++) {
      ctx.beginPath();
      ctx.moveTo(inner[k][0], inner[k][1]);
      ctx.lineTo(outer[k][0], outer[k][1]);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(inner[0][0], inner[0][1]);
    ctx.lineTo(inner[4][0], inner[4][1]);
    ctx.moveTo(inner[2][0], inner[2][1]);
    ctx.lineTo(inner[6][0], inner[6][1]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    poly(outer);
    ctx.strokeStyle = shade(base, -0.62);
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
    sparkle(ctx, cx - r * 0.24, cy - r * 0.26, r * 0.24);
  }

  // カード左下の費用の丸
  function drawPip(ctx, cx, cy, r, color, n) {
    const m = GEM_META[color];
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = r * 0.35;
    ctx.shadowOffsetY = r * 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, shade(m.chip, 0.32));
    g.addColorStop(1, shade(m.chip, -0.18));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = r * 0.13;
    ctx.strokeStyle = 'rgba(250, 245, 232, 0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `700 ${Math.round(r * 1.18)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = m.ink;
    ctx.fillText(String(n), cx, cy + r * 0.06);
  }

  // ---- カードの絵 (レベル1 鉱山 / レベル2 港 / レベル3 街) ----
  const SCENE = {
    white: { sky: ['#b9c4cf', '#ece9e2'], far: '#9aa1a8', near: '#5f5a55', accent: '#dfe7ec' },
    blue:  { sky: ['#7d9fc6', '#dfe7ee'], far: '#647d99', near: '#2e3f55', accent: '#3a74d4' },
    green: { sky: ['#97b78c', '#e8eddc'], far: '#6f8c66', near: '#36502f', accent: '#36a86e' },
    red:   { sky: ['#cf9781', '#f1dfd0'], far: '#a37463', near: '#5e3329', accent: '#d83a4a' },
    black: { sky: ['#857f88', '#d8d2cc'], far: '#6c6670', near: '#2b2728', accent: '#5c5550' }
  };

  function skyGradient(ctx, w, h, sky, horizon) {
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function ridgePath(ctx, w, h, baseY, amp, rng, segs, jagged) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const x = (i / segs) * w + (i > 0 && i < segs ? (rng() - 0.5) * (w / segs) * 0.5 : 0);
      pts.push([x, baseY - amp * (0.2 + 0.8 * rng())]);
    }
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(pts[0][0], pts[0][1]);
    if (jagged) {
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
  }

  function crystal(ctx, x, y, s, color, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.32, -s * 0.55);
    ctx.lineTo(s * 0.3, 0);
    ctx.lineTo(0, s * 0.12);
    ctx.closePath();
    ctx.fillStyle = shade(color, -0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(-s * 0.3, -s * 0.55);
    ctx.lineTo(-s * 0.28, 0);
    ctx.lineTo(0, s * 0.12);
    ctx.closePath();
    ctx.fillStyle = shade(color, 0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 14, 10, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function paintMine(ctx, w, h, t, rng) {
    skyGradient(ctx, w, h, t.sky, h * 0.62);
    ctx.fillStyle = mixHex(t.far, t.sky[1], 0.4);
    ridgePath(ctx, w, h, h * 0.5, h * 0.2, rng, 6, true);
    ctx.fill();
    ctx.fillStyle = t.far;
    ridgePath(ctx, w, h, h * 0.6, h * 0.13, rng, 5, true);
    ctx.fill();

    // 手前の丘
    const hillY = h * (0.66 + rng() * 0.04);
    const g = ctx.createLinearGradient(0, hillY - h * 0.1, 0, h);
    g.addColorStop(0, shade(t.near, 0.14));
    g.addColorStop(1, shade(t.near, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, hillY + h * 0.06);
    ctx.bezierCurveTo(w * 0.3, hillY - h * 0.05, w * 0.6, hillY - h * 0.08, w, hillY + h * 0.02);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 坑道の入口
    const ex = w * (0.52 + rng() * 0.16);
    const ey = hillY + h * 0.06;
    const ew = w * 0.16;
    const eh = h * 0.11;
    ctx.fillStyle = '#15110e';
    ctx.beginPath();
    ctx.moveTo(ex - ew / 2, ey + eh / 2);
    ctx.lineTo(ex - ew / 2, ey - eh * 0.1);
    ctx.quadraticCurveTo(ex, ey - eh * 0.75, ex + ew / 2, ey - eh * 0.1);
    ctx.lineTo(ex + ew / 2, ey + eh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7b5a3a';
    ctx.fillRect(ex - ew / 2 - ew * 0.1, ey - eh * 0.25, ew * 0.12, eh * 0.75);
    ctx.fillRect(ex + ew / 2 - ew * 0.02, ey - eh * 0.25, ew * 0.12, eh * 0.75);
    ctx.fillStyle = '#6a4c30';
    ctx.fillRect(ex - ew / 2 - ew * 0.18, ey - eh * 0.36, ew * 1.36, eh * 0.14);

    // 線路
    ctx.strokeStyle = 'rgba(36, 28, 22, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex - ew * 0.22, ey + eh / 2);
    ctx.lineTo(ex - ew * 1.1, h);
    ctx.moveTo(ex + ew * 0.22, ey + eh / 2);
    ctx.lineTo(ex + ew * 0.5, h);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let k = 1; k < 6; k++) {
      const tt = k / 6;
      const y = ey + eh / 2 + (h - ey - eh / 2) * tt;
      ctx.beginPath();
      ctx.moveTo(ex - ew * 0.22 - ew * 0.88 * tt - 4, y);
      ctx.lineTo(ex + ew * 0.22 + ew * 0.28 * tt + 4, y);
      ctx.stroke();
    }

    // 地表に覗く原石
    for (let k = 0; k < 3; k++) {
      const cx = w * (0.18 + rng() * 0.25) + (k === 2 ? w * 0.55 : 0);
      const cy = hillY + h * (0.08 + rng() * 0.1);
      crystal(ctx, cx, cy, h * (0.04 + rng() * 0.03), t.accent, (rng() - 0.5) * 0.8);
    }
  }

  function paintHarbor(ctx, w, h, t, rng) {
    const hz = h * 0.57;
    skyGradient(ctx, w, h, t.sky, hz);
    // 雲
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let k = 0; k < 3; k++) {
      const cx = w * rng();
      const cy = h * (0.25 + rng() * 0.15);
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * (0.16 + rng() * 0.1), h * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 対岸
    ctx.fillStyle = mixHex(t.far, t.sky[1], 0.3);
    ridgePath(ctx, w, h, hz + 2, h * 0.05, rng, 5, false);
    ctx.fill();
    // 海
    const sea = ctx.createLinearGradient(0, hz, 0, h);
    sea.addColorStop(0, mixHex('#5d7889', t.far, 0.3));
    sea.addColorStop(1, mixHex('#1f2e3a', t.near, 0.3));
    ctx.fillStyle = sea;
    ctx.fillRect(0, hz, w, h - hz);
    ctx.strokeStyle = 'rgba(235, 240, 240, 0.16)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 18; k++) {
      const y = hz + (h - hz) * Math.pow(rng(), 0.8);
      const x = w * rng();
      const len = w * (0.04 + rng() * 0.08) * (0.5 + (y - hz) / (h - hz));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - 2, x + len, y);
      ctx.stroke();
    }

    // 帆船
    const sx = w * (0.46 + rng() * 0.14);
    const wl = h * (0.71 + rng() * 0.03);
    const L = w * 0.46;
    ctx.fillStyle = 'rgba(10, 16, 22, 0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, wl + h * 0.05, L * 0.5, h * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
    const masts = [sx - L * 0.14, sx + L * 0.16];
    const top = wl - h * 0.36;
    ctx.strokeStyle = '#2b1f17';
    ctx.lineWidth = 3;
    masts.forEach((mx, i) => {
      ctx.beginPath();
      ctx.moveTo(mx, wl);
      ctx.lineTo(mx, top + (i ? h * 0.04 : 0));
      ctx.stroke();
    });
    masts.forEach((mx, i) => {
      const mt = top + (i ? h * 0.04 : 0);
      [[0.06, 0.15], [0.19, 0.3]].forEach(([a, b], j) => {
        const y0 = mt + (wl - mt) * a + h * 0.01;
        const y1 = mt + (wl - mt) * b + h * 0.07;
        const half = L * (0.13 + j * 0.03);
        const sg = ctx.createLinearGradient(mx - half, 0, mx + half, 0);
        sg.addColorStop(0, '#efe6d2');
        sg.addColorStop(1, '#c9bca2');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(mx - half * 0.9, y0);
        ctx.lineTo(mx + half * 0.9, y0);
        ctx.quadraticCurveTo(mx + half * 1.12, (y0 + y1) / 2, mx + half, y1);
        ctx.lineTo(mx - half, y1);
        ctx.quadraticCurveTo(mx - half * 0.82, (y0 + y1) / 2, mx - half * 0.9, y0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 46, 32, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      // 旗
      ctx.fillStyle = t.accent;
      ctx.beginPath();
      ctx.moveTo(mx, mt);
      ctx.lineTo(mx + L * 0.1, mt + h * 0.012);
      ctx.lineTo(mx, mt + h * 0.024);
      ctx.fill();
    });
    // 船体
    ctx.fillStyle = '#3d2a1f';
    ctx.beginPath();
    ctx.moveTo(sx - L / 2, wl - h * 0.04);
    ctx.lineTo(sx + L / 2, wl - h * 0.055);
    ctx.quadraticCurveTo(sx + L * 0.42, wl + h * 0.03, sx + L * 0.3, wl + h * 0.035);
    ctx.lineTo(sx - L * 0.36, wl + h * 0.035);
    ctx.quadraticCurveTo(sx - L * 0.48, wl, sx - L / 2, wl - h * 0.04);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 180, 120, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - L * 0.46, wl - h * 0.02);
    ctx.lineTo(sx + L * 0.45, wl - h * 0.033);
    ctx.stroke();
  }

  function paintCity(ctx, w, h, t, rng) {
    const base = h * 0.82;
    skyGradient(ctx, w, h, t.sky, h * 0.7);

    // 奥の家並み
    ctx.fillStyle = mixHex(t.far, t.sky[1], 0.3);
    let x = -10;
    while (x < w) {
      const bw = w * (0.08 + rng() * 0.1);
      const bh = h * (0.2 + rng() * 0.18);
      ctx.fillRect(x, base - bh - h * 0.06, bw, bh + h * 0.3);
      if (rng() < 0.35) {
        ctx.beginPath();
        ctx.moveTo(x, base - bh - h * 0.06);
        ctx.lineTo(x + bw / 2, base - bh - h * 0.14);
        ctx.lineTo(x + bw, base - bh - h * 0.06);
        ctx.fill();
      }
      x += bw * 0.92;
    }

    // ドーム
    const dx = w * (0.3 + rng() * 0.4);
    const dr = w * 0.12;
    const dy = base - h * 0.3;
    ctx.fillStyle = mixHex(t.far, t.near, 0.45);
    ctx.fillRect(dx - dr, dy, dr * 2, h * 0.3);
    ctx.beginPath();
    ctx.arc(dx, dy, dr, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(dx - dr * 0.12, dy - dr * 1.3, dr * 0.24, dr * 0.35);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(dx, dy, dr, Math.PI * 1.1, Math.PI * 1.45);
    ctx.lineTo(dx, dy);
    ctx.fill();

    // 手前の建物
    x = -w * 0.06;
    while (x < w) {
      const bw = w * (0.22 + rng() * 0.12);
      const bh = h * (0.22 + rng() * 0.12);
      const col = mixHex(t.near, '#b8a68c', 0.28 + rng() * 0.28);
      const top = base - bh;
      const fg = ctx.createLinearGradient(x, 0, x + bw, 0);
      fg.addColorStop(0, shade(col, 0.08));
      fg.addColorStop(1, shade(col, -0.2));
      ctx.fillStyle = fg;
      ctx.fillRect(x, top, bw, bh + 2);
      ctx.fillStyle = shade(col, -0.4);
      ctx.fillRect(x - 2, top - h * 0.012, bw + 4, h * 0.016);
      // 窓
      const cols = Math.max(2, Math.round(bw / (w * 0.08)));
      const rows = Math.max(1, Math.round(bh / (h * 0.09)) - 1);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = x + (bw / cols) * (c + 0.5);
          const wy = top + h * 0.035 + r * h * 0.075;
          const ww = (bw / cols) * 0.36;
          const wh = h * 0.042;
          ctx.fillStyle = rng() < 0.45 ? 'rgba(236, 214, 160, 0.85)' : 'rgba(30, 24, 20, 0.75)';
          ctx.beginPath();
          ctx.moveTo(wx - ww / 2, wy + wh);
          ctx.lineTo(wx - ww / 2, wy + ww / 2);
          ctx.arc(wx, wy + ww / 2, ww / 2, Math.PI, 0);
          ctx.lineTo(wx + ww / 2, wy + wh);
          ctx.closePath();
          ctx.fill();
        }
      }
      // 日除け
      if (rng() < 0.6) {
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        ctx.moveTo(x + bw * 0.12, base - h * 0.075);
        ctx.lineTo(x + bw * 0.88, base - h * 0.075);
        ctx.lineTo(x + bw * 0.94, base - h * 0.045);
        ctx.lineTo(x + bw * 0.06, base - h * 0.045);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        for (let s = 0; s < 6; s += 2) {
          const sx0 = x + bw * (0.12 + (0.76 / 6) * s);
          ctx.fillRect(sx0, base - h * 0.075, bw * 0.76 / 6, h * 0.03);
        }
      }
      x += bw;
    }
    // 石畳
    ctx.fillStyle = shade(t.near, -0.38);
    ctx.fillRect(0, base, w, h - base);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = base + 6; y < h; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function finishArt(ctx, w, h) {
    const v = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(20, 12, 6, 0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    const grain = window.BoardArena3D.canvas.grain('#808080', 46, 77);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(grain, 0, 0, w, h);
    ctx.restore();
  }

  function paintCardFace(ctx, w, h, card) {
    const rng = window.BoardArena3D.mulberry32(hashStr(card.id) + 17);
    const t = SCENE[card.bonus];
    ctx.save();
    if (card.level === 1) paintMine(ctx, w, h, t, rng);
    else if (card.level === 2) paintHarbor(ctx, w, h, t, rng);
    else paintCity(ctx, w, h, t, rng);
    ctx.restore();
    finishArt(ctx, w, h);

    // 上の帯: 得点とボーナスの宝石
    const bandH = h * 0.2;
    const bg = ctx.createLinearGradient(0, 0, 0, bandH);
    bg.addColorStop(0, 'rgba(250, 246, 236, 0.93)');
    bg.addColorStop(1, 'rgba(242, 236, 222, 0.86)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, bandH);
    ctx.fillStyle = 'rgba(60, 46, 32, 0.28)';
    ctx.fillRect(0, bandH, w, 2);
    if (card.points > 0) {
      ctx.fillStyle = '#2a2420';
      ctx.font = `700 ${Math.round(h * 0.14)}px ${UI_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(card.points), w * 0.09, bandH * 0.55);
    }
    drawGem(ctx, w * 0.81, bandH * 0.52, bandH * 0.37, card.bonus);

    // 費用
    const pr = h * 0.046;
    GEM_TYPES.filter((c) => card.cost[c] > 0).forEach((c, k) => {
      drawPip(ctx, w * 0.13, h * 0.915 - k * pr * 2.42, pr, c, card.cost[c]);
    });

    ctx.strokeStyle = 'rgba(255, 250, 240, 0.32)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, 9, 9, w - 18, h - 18, 12);
    ctx.stroke();
  }

  const BACK_COLORS = { 1: '#2d5a3b', 2: '#8f6c28', 3: '#29497d' };

  function paintBack(ctx, w, h, level) {
    window.BoardArena3D.canvas.paintNoise(ctx, w, h, BACK_COLORS[level], 10, 600 + level, 300);
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.36)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d6bb78';
    ctx.lineWidth = 4;
    roundRectPath(ctx, 18, 18, w - 36, h - 36, 14);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 28, 28, w - 56, h - 56, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.27);
    ctx.lineTo(w * 0.79, h / 2);
    ctx.lineTo(w / 2, h * 0.73);
    ctx.lineTo(w * 0.21, h / 2);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e2c98a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${Math.round(w * 0.2)}px ${SERIF}`;
    ctx.fillText(['I', 'II', 'III'][level - 1], w / 2, h / 2 - h * 0.01);
    for (let k = 0; k < level; k++) {
      const x = w / 2 + (k - (level - 1) / 2) * w * 0.07;
      const y = h * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = `400 ${Math.round(w * 0.062)}px ${SERIF}`;
    spacedText(ctx, 'SPLENDOR', w / 2, h * 0.87, 6);
  }

  // 胸像の横顔 (左向き、0..1 の正規化座標)
  const PROFILE = [
    [0.1, 1.05], [0.17, 0.92], [0.3, 0.84], [0.41, 0.75], [0.4, 0.66], [0.36, 0.63], [0.31, 0.6],
    [0.295, 0.56], [0.305, 0.535], [0.285, 0.515], [0.29, 0.49], [0.25, 0.465], [0.29, 0.39], [0.31, 0.34],
    [0.33, 0.26], [0.41, 0.19], [0.53, 0.17], [0.64, 0.23], [0.7, 0.36], [0.7, 0.5], [0.63, 0.62],
    [0.64, 0.7], [0.76, 0.78], [0.9, 0.86], [0.98, 1.05]
  ];

  function smoothClosed(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.closePath();
  }

  function paintCameo(ctx, x0, y0, bw, bh, look) {
    const P = (u, v) => [x0 + u * bw, y0 + v * bh];
    const ivory = ctx.createLinearGradient(x0, y0, x0 + bw, y0 + bh);
    ivory.addColorStop(0, '#f6efdf');
    ivory.addColorStop(1, '#d9ccb2');
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = bw * 0.03;
    ctx.shadowOffsetX = bw * 0.012;
    ctx.shadowOffsetY = bw * 0.018;
    ctx.fillStyle = ivory;
    smoothClosed(ctx, PROFILE.map(([u, v]) => P(u, v)));
    ctx.fill();
    ctx.restore();

    const line = 'rgba(120, 100, 76, 0.55)';
    ctx.lineWidth = Math.max(1, bw * 0.006);
    ctx.strokeStyle = line;
    // 襟
    ctx.beginPath();
    const c0 = P(0.3, 0.86);
    const c1 = P(0.78, 0.8);
    ctx.moveTo(c0[0], c0[1]);
    ctx.quadraticCurveTo(x0 + 0.52 * bw, y0 + 0.96 * bh, c1[0], c1[1]);
    ctx.stroke();

    ctx.fillStyle = ivory;
    const hat = look.hat;
    if (hat === 'crown') {
      const cg = ctx.createLinearGradient(x0, y0 + 0.08 * bh, x0, y0 + 0.24 * bh);
      cg.addColorStop(0, '#f3dc94');
      cg.addColorStop(1, '#b48c2c');
      ctx.fillStyle = cg;
      ctx.beginPath();
      const b0 = P(0.36, 0.25);
      ctx.moveTo(b0[0], b0[1]);
      [[0.37, 0.12], [0.44, 0.19], [0.5, 0.08], [0.56, 0.18], [0.63, 0.11], [0.66, 0.26]].forEach(([u, v]) => {
        const p = P(u, v);
        ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(90, 64, 20, 0.6)';
      ctx.stroke();
    } else if (hat === 'beret') {
      ctx.beginPath();
      const c = P(0.53, 0.17);
      ctx.ellipse(c[0], c[1], bw * 0.24, bh * 0.07, -0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'cap') {
      ctx.beginPath();
      const c = P(0.52, 0.27);
      ctx.ellipse(c[0], c[1], bw * 0.19, bh * 0.12, -0.1, Math.PI * 1.02, Math.PI * 2.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'turban') {
      ctx.beginPath();
      const c = P(0.53, 0.2);
      ctx.ellipse(c[0], c[1], bw * 0.23, bh * 0.13, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(...P(0.33, 0.24));
      ctx.quadraticCurveTo(...P(0.52, 0.12), ...P(0.74, 0.2));
      ctx.moveTo(...P(0.34, 0.29));
      ctx.quadraticCurveTo(...P(0.55, 0.2), ...P(0.73, 0.27));
      ctx.stroke();
      ctx.fillStyle = '#c94a4a';
      ctx.beginPath();
      ctx.arc(...P(0.38, 0.2), bw * 0.022, 0, Math.PI * 2);
      ctx.fill();
    } else if (hat === 'hood') {
      ctx.beginPath();
      ctx.moveTo(...P(0.36, 0.24));
      ctx.quadraticCurveTo(...P(0.5, 0.06), ...P(0.72, 0.22));
      ctx.quadraticCurveTo(...P(0.86, 0.5), ...P(0.84, 0.86));
      ctx.lineTo(...P(0.64, 0.78));
      ctx.quadraticCurveTo(...P(0.72, 0.5), ...P(0.36, 0.24));
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'hair') {
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(...P(0.66 + (k % 2) * 0.03, 0.42 + k * 0.06), bw * 0.045, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function paintNoble(ctx, w, h, noble) {
    const look = NOBLE_LOOK[noble.id] || NOBLE_LOOK.n1;
    window.BoardArena3D.canvas.paintNoise(ctx, w, h, '#d6c5a1', 10, 700 + hashStr(noble.id) % 50, 260);
    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(60, 40, 20, 0.3)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // カメオ
    const cx = w * 0.62;
    const cy = h * 0.45;
    const rx = w * 0.3;
    const ry = h * 0.37;
    const gold = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    gold.addColorStop(0, '#f0d98e');
    gold.addColorStop(0.5, '#b48c2c');
    gold.addColorStop(1, '#e8cf86');
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = w * 0.03;
    ctx.shadowOffsetY = w * 0.01;
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + w * 0.028, ry + w * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const fg = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, rx * 0.1, cx, cy, ry);
    fg.addColorStop(0, shade(look.field, 0.22));
    fg.addColorStop(1, shade(look.field, -0.35));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    paintCameo(ctx, cx - rx * 0.92, cy - ry * 0.98, rx * 1.84, ry * 2.0, look);
    ctx.restore();

    // 左の帯: 得点と条件
    ctx.fillStyle = 'rgba(250, 246, 236, 0.78)';
    ctx.fillRect(0, 0, w * 0.25, h);
    ctx.fillStyle = 'rgba(60, 46, 32, 0.24)';
    ctx.fillRect(w * 0.25, 0, 2, h);
    ctx.fillStyle = '#2a2420';
    ctx.font = `700 ${Math.round(h * 0.17)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(noble.points), w * 0.125, h * 0.13);
    GEM_TYPES.filter((c) => noble.req[c] > 0).forEach((c, k) => {
      const m = GEM_META[c];
      const bw = w * 0.13;
      const bh = h * 0.17;
      const x = w * 0.125 - bw / 2;
      const y = h * 0.94 - (k + 1) * bh - k * h * 0.03;
      const g = ctx.createLinearGradient(x, y, x + bw, y + bh);
      g.addColorStop(0, shade(m.chip, 0.25));
      g.addColorStop(1, shade(m.chip, -0.15));
      ctx.fillStyle = g;
      roundRectPath(ctx, x, y, bw, bh, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 245, 232, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = m.ink;
      ctx.font = `700 ${Math.round(bh * 0.6)}px ${UI_FONT}`;
      ctx.fillText(String(noble.req[c]), x + bw / 2, y + bh / 2 + 2);
    });

    // 名前
    ctx.fillStyle = 'rgba(42, 36, 32, 0.85)';
    let size = Math.round(h * 0.056);
    ctx.font = `500 ${size}px ${UI_FONT}`;
    while (ctx.measureText(noble.name).width > w * 0.68 && size > 12) {
      size -= 1;
      ctx.font = `500 ${size}px ${UI_FONT}`;
    }
    ctx.fillText(noble.name, cx, h * 0.92);
    ctx.strokeStyle = 'rgba(60, 46, 32, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }

  function paintChip(ctx, w, h, color) {
    const m = GEM_META[color];
    window.BoardArena3D.canvas.paintNoise(ctx, w, h, m.chip, 9, 300 + ALL_TOKEN_TYPES.indexOf(color), 0);
    const cx = w / 2;
    const cy = h / 2;
    const R = w / 2;
    const light = color === 'white' || color === 'gold';
    ctx.fillStyle = light ? 'rgba(90, 70, 40, 0.3)' : 'rgba(246, 238, 220, 0.82)';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, a - 0.17, a + 0.17);
      ctx.arc(cx, cy, R * 0.8, a + 0.17, a - 0.17, true);
      ctx.closePath();
      ctx.fill();
    }
    const g = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.05, cx, cy, R * 0.74);
    g.addColorStop(0, shade(m.chip, 0.16));
    g.addColorStop(1, shade(m.chip, -0.16));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = light ? 'rgba(90, 70, 40, 0.45)' : 'rgba(246, 238, 220, 0.7)';
    ctx.lineWidth = R * 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    drawGem(ctx, cx, cy, R * 0.44, color);
  }

  window.BoardArena.registerGame({
    id: 'splendor',
    name: '宝石の煌き',
    icon: '',
    category: '拡大再生産',
    minPlayers: 2,
    maxPlayers: 4,
    description: '宝石を集めて鉱山や港、街の店を手に入れ、カードの割引を育てて15点を目指す拡大再生産のゲーム。',

    mount(container, bridge) {
      let isDestroyed = false;
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
      let selectedTokens = []; // 手番中に選んでいる宝石 (例: ['white', 'blue'] / ['green', 'green'])
      let focusedCardInfo = null; // { source: 'market'|'reserved'|'deck', level, index, card }
      let gameSerial = 0; // 新しいゲームごとに増える (3D の卓を組み直す目印)
      let lastActorIdx = 0;
      let lastActionText = '';

      container.innerHTML = `
        <style>
          .spl-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: var(--text);
            font-family: var(--font-ui);
          }
          .spl-top-bar, .spl-dock {
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
          .spl-players-row { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 520px; min-width: 0; }
          .spl-player {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px 7px 10px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 4px;
            transition: border-color 0.25s, background 0.25s;
          }
          .spl-player.is-turn { border-color: rgba(226, 184, 103, 0.6); background: rgba(226, 184, 103, 0.07); }
          .spl-swatch { flex: none; width: 12px; height: 12px; border-radius: 2px; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35); }
          .spl-player-name { display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-weight: 700; white-space: nowrap; }
          .spl-player-pts { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
          .spl-player-pts small { margin-left: 2px; font-size: 10px; font-weight: 500; color: var(--text-3); }
          .spl-player-sub { display: flex; align-items: center; gap: 8px; margin-top: 2px; font-size: 11px; color: var(--text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
          .spl-gem { display: inline-flex; align-items: center; gap: 3px; color: var(--text-2); }
          .spl-gem i, .spl-hold i, .spl-pick i, .spl-cost-row i {
            flex: none;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: var(--g);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1);
          }
          .spl-gem small { color: #e2b867; font-size: 10px; }
          .spl-controls, .spl-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .spl-actions { justify-content: flex-end; flex: 1 1 380px; }
          .spl-btn, .spl-select {
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
          .spl-select {
            padding-right: 28px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a8a6a0' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
          }
          .spl-select option { background: #161618; color: #ecebe6; }
          .spl-btn:hover:not(:disabled), .spl-select:hover { color: var(--text); border-color: rgba(255, 255, 255, 0.34); }
          .spl-btn:disabled { opacity: 0.35; cursor: not-allowed; }
          .spl-btn.is-primary { background: var(--text); border-color: var(--text); color: var(--text-inverse); font-weight: 700; }
          .spl-btn.is-primary:hover:not(:disabled) { background: #fff; color: var(--text-inverse); }

          .spl-stage-wrap { position: relative; }
          .spl-stage-wrap .ba3d-stage { height: clamp(460px, calc(100vh - 290px), 900px); }
          .spl-status {
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
          .spl-phase { font-size: 10px; letter-spacing: 0.14em; color: rgba(236, 235, 230, 0.55); }
          .spl-phase em { margin-left: 8px; font-style: normal; color: #e2b867; }
          .spl-announce { margin-top: 3px; font-size: 13px; line-height: 1.55; }
          .spl-preview {
            position: absolute;
            right: 14px;
            top: 50%;
            z-index: 6;
            width: clamp(150px, 16vw, 210px);
            transform: translate(12px, -50%);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.18s ease, transform 0.18s ease;
          }
          .spl-preview.is-visible { opacity: 1; transform: translate(0, -50%); }
          .spl-preview canvas {
            display: block;
            width: 100%;
            height: auto;
            border-radius: 9px;
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.4);
          }
          .spl-preview.is-noble canvas { border-radius: 5px; }
          .spl-preview-note {
            margin-top: 8px;
            padding: 6px 9px;
            background: rgba(14, 12, 11, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            color: #ecebe6;
            font-size: 11px;
            line-height: 1.55;
            white-space: pre-line;
          }
          .spl-preview-note:empty { display: none; }
          .spl-preview-note.is-ok { color: #e2b867; }

          .spl-hand { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
          .spl-hand-label { margin-right: 2px; font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
          .spl-hold { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; font-size: 13px; font-variant-numeric: tabular-nums; }
          .spl-hold i { width: 12px; height: 12px; }
          .spl-hold b { font-weight: 700; }
          .spl-hold small { font-size: 11px; color: #e2b867; }
          .spl-hold-total { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; }
          .spl-hold-total.is-over { color: #d39486; }
          .spl-pick {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: transparent;
            border: 1px solid var(--line-strong);
            border-radius: 4px;
            color: var(--text);
            font: 500 12px/1.3 var(--font-ui);
            font-variant-numeric: tabular-nums;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
          }
          .spl-pick i { width: 11px; height: 11px; }
          .spl-pick small { color: var(--text-3); font-size: 11px; }
          .spl-pick b { color: #e2b867; font-weight: 700; }
          .spl-pick:hover:not(:disabled) { border-color: rgba(226, 184, 103, 0.7); }
          .spl-pick.is-picked { border-color: rgba(226, 184, 103, 0.85); background: rgba(226, 184, 103, 0.1); }
          .spl-pick:disabled { opacity: 0.35; cursor: default; }
          .spl-action-label { width: 100%; font-size: 11px; letter-spacing: 0.06em; color: var(--text-3); text-align: right; }
          .spl-wait { font-size: 12px; color: var(--text-3); }
          .spl-prompt { font-size: 12px; color: #e2b867; }

          .ba3d-label.spl-count { padding: 1px 6px; background: rgba(14, 12, 11, 0.62); color: rgba(236, 235, 230, 0.9); font-size: 11px; }
          .ba3d-label.spl-count.is-empty { color: #d39486; }
          .ba3d-label.spl-zone { padding: 0; background: none; color: rgba(236, 235, 230, 0.55); font-size: 11px; letter-spacing: 0.1em; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); }

          .spl-modal-overlay {
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
          .spl-modal-overlay.visible { display: flex; }
          .spl-modal-box {
            width: min(540px, 100%);
            max-height: 100%;
            overflow: auto;
            padding: 22px 24px;
            background: var(--bg-raised);
            border: 1px solid var(--line-strong);
            border-radius: 6px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          }
          .spl-modal-head { display: flex; gap: 18px; align-items: flex-start; }
          .spl-modal-art { flex: none; width: 128px; height: auto; border-radius: 7px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55); }
          .spl-modal-info { flex: 1; min-width: 0; }
          .spl-modal-kicker { font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
          .spl-modal-title { margin-top: 4px; font-size: 17px; font-weight: 700; }
          .spl-modal-desc { margin-top: 8px; font-size: 13px; line-height: 1.7; color: var(--text-2); }
          .spl-cost-list { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
          .spl-cost-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; }
          .spl-cost-row i { width: 11px; height: 11px; }
          .spl-cost-num { min-width: 18px; color: var(--text); font-weight: 700; text-align: right; }
          .spl-cost-sub { color: var(--text-3); }
          .spl-cost-sub em { font-style: normal; color: #d39486; }
          .spl-modal-note { margin-top: 12px; font-size: 12px; color: #e2b867; }
          .spl-modal-note.is-bad { color: #d39486; }
          .spl-modal-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; margin-top: 18px; }
          .spl-modal-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
          .spl-rank { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--line); font-size: 13px; }
          .spl-rank-pos { width: 18px; color: var(--text-3); font-variant-numeric: tabular-nums; }
          .spl-rank-meta { font-size: 11px; color: var(--text-3); }
          .spl-rank-pts { margin-left: auto; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
          .spl-rank-pts small { margin-left: 2px; font-size: 10px; font-weight: 500; color: var(--text-3); }

          @media (max-width: 640px) {
            .spl-stage-wrap .ba3d-stage { height: min(66vh, 500px); }
            .spl-status { max-width: calc(100% - 110px); }
            .spl-announce { font-size: 12px; }
            .spl-player-sub .spl-meta { display: none; }
            .spl-preview { display: none; }
            .spl-modal-art { width: 96px; }
          }
        </style>

        <div class="spl-wrapper">
          <div class="spl-top-bar">
            <div class="spl-players-row" id="spl-players-row"></div>
            <div class="spl-controls">
              <select id="spl-pcount-sel" class="spl-select" aria-label="人数">
                <option value="2">2人</option>
                <option value="3" selected>3人</option>
                <option value="4">4人</option>
              </select>
              <button class="spl-btn" id="spl-new-btn">新しいゲーム</button>
            </div>
          </div>

          <div class="spl-stage-wrap" id="spl-stage-wrap">
            <div class="spl-status">
              <div class="spl-phase" id="spl-phase"></div>
              <div class="spl-announce" id="spl-announce"></div>
            </div>
            <div class="spl-preview" id="spl-preview">
              <canvas width="360" height="504"></canvas>
              <div class="spl-preview-note" id="spl-preview-note"></div>
            </div>
            <div class="spl-modal-overlay" id="spl-modal-overlay">
              <div class="spl-modal-box" id="spl-modal-box"></div>
            </div>
          </div>

          <div class="spl-dock">
            <div class="spl-hand" id="spl-my-gems"></div>
            <div class="spl-actions" id="spl-action-panel"></div>
          </div>
        </div>
      `;

      const playersRowEl = container.querySelector('#spl-players-row');
      const pcountSelEl = container.querySelector('#spl-pcount-sel');
      const newBtnEl = container.querySelector('#spl-new-btn');
      const stageWrapEl = container.querySelector('#spl-stage-wrap');
      const phaseEl = container.querySelector('#spl-phase');
      const announceEl = container.querySelector('#spl-announce');
      const previewEl = container.querySelector('#spl-preview');
      const previewCanvas = previewEl.querySelector('canvas');
      const previewNoteEl = container.querySelector('#spl-preview-note');
      const modalOverlayEl = container.querySelector('#spl-modal-overlay');
      const modalBoxEl = container.querySelector('#spl-modal-box');
      const myGemsEl = container.querySelector('#spl-my-gems');
      const actionPanelEl = container.querySelector('#spl-action-panel');

      // ====================================================
      // ゲームロジック
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
          cards: [],    // 購入したカードの id
          reserved: [], // 最大3枚
          nobles: []
        };
      }

      function totalPlayerTokens(p) {
        return ALL_TOKEN_TYPES.reduce((sum, k) => sum + (p.tokens[k] || 0), 0);
      }

      // カードを購入できるか、支払いの内訳
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

      // 選択中の宝石にもう1枚加えられるか
      function canAddTokenToSelection(color) {
        if (color === 'gold') return false;
        const availInBank = bank[color] || 0;
        const alreadyPickedCount = selectedTokens.filter((c) => c === color).length;
        if (availInBank - alreadyPickedCount <= 0) return false;

        if (selectedTokens.length === 0) return true;
        if (selectedTokens.length === 1) {
          // 同じ色の2枚目は、その色が4枚以上あったときだけ
          if (selectedTokens[0] === color) return availInBank >= 4;
          return true;
        }
        if (selectedTokens.length === 2) {
          if (selectedTokens[0] === selectedTokens[1]) return false;
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
        lastActorIdx = 0;
        gameSerial++;
        closeModal();
        lastActionText = '宝石を3色1枚ずつ（または同じ色を2枚）取るか、カードを購入・予約します。';
        renderAll();
      }

      // 手番の終わりに、条件を満たす貴族が1人だけ訪れる
      function checkNobleVisit(p) {
        for (let i = 0; i < nobles.length; i++) {
          const nb = nobles[i];
          const ok = GEM_TYPES.every((c) => (p.bonuses[c] || 0) >= (nb.req[c] || 0));
          if (ok) {
            nobles.splice(i, 1);
            p.nobles.push(nb);
            p.points += nb.points;
            SplendorSfx.nobleVisit();
            lastActionText += `　${nb.name}が訪れました（3点）。`;
            break;
          }
        }
      }

      function finishTurn() {
        const p = players[turnIndex];
        selectedTokens = [];
        focusedCardInfo = null;

        // トークンは10枚まで
        if (totalPlayerTokens(p) > 10) {
          if (p.isCpu) {
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

        checkNobleVisit(p);
        if (p.points >= 15) finalRoundTriggered = true;

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
          cpuTimer = setTimeout(runCpuTurn, 1000);
        }
      }

      function describeTokens(list) {
        const counts = {};
        list.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
        return Object.entries(counts).map(([c, n]) => (n > 1 ? `${GEM_META[c].short}${n}枚` : GEM_META[c].short)).join('・');
      }

      // 宝石を受け取る (異なる3色 / 同じ色2枚)
      function executeTakeTokens(p, tokensList) {
        const counts = {};
        tokensList.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
        Object.entries(counts).forEach(([c, cnt]) => {
          bank[c] -= cnt;
          p.tokens[c] += cnt;
        });
        SplendorSfx.takeGems();
        lastActorIdx = p.idx;
        lastActionText = `${p.name}が宝石を受け取りました（${describeTokens(tokensList)}）。`;
        finishTurn();
      }

      // カードを予約する
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
        lastActorIdx = p.idx;
        lastActionText = `${p.name}がレベル${level}のカードを${source === 'deck' ? '山札から' : ''}予約しました${gotGold ? '（金を1枚受け取り）' : ''}。`;
        closeModal();
        finishTurn();
      }

      // カードを購入する
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

        ALL_TOKEN_TYPES.forEach((c) => {
          const amt = plan.pay[c] || 0;
          if (amt > 0) {
            p.tokens[c] -= amt;
            bank[c] += amt;
          }
        });

        if (source === 'market') {
          market[level][index] = decks[level].pop() || null;
        } else {
          p.reserved.splice(index, 1);
        }

        p.bonuses[card.bonus] = (p.bonuses[card.bonus] || 0) + 1;
        p.points += card.points;
        p.purchasedCount++;
        p.cards.push(card.id);

        SplendorSfx.buyCard();
        lastActorIdx = p.idx;
        lastActionText = `${p.name}がレベル${card.level}の${GEM_META[card.bonus].name}を購入しました${card.points ? `（${card.points}点）` : ''}。`;
        closeModal();
        finishTurn();
      }

      // ====================================================
      // CPU
      // ====================================================
      function runCpuTurn() {
        if (isDestroyed || phase !== 'ACTION') return;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu) return;

        // 1. 買えるカード (予約札 + 場の12枚) の中で評価の高いものを買う
        const buyCandidates = [];
        cpu.reserved.forEach((card, idx) => {
          if (getPurchasePlan(cpu, card).canBuy) {
            buyCandidates.push({ source: 'reserved', level: card.level, index: idx, card, score: evaluateCardForPlayer(cpu, card) });
          }
        });
        [3, 2, 1].forEach((lv) => {
          market[lv].forEach((card, idx) => {
            if (!card) return;
            if (getPurchasePlan(cpu, card).canBuy) {
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

        // 2. もう少しで買えるカードに足りない色を重み付けする
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

        // 3. トークンが8枚以下なら必要な色を取る
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

        // 4. 予約枠が空いていればレベル2・3のカードを予約する
        if (cpu.reserved.length < 3) {
          for (const lv of [2, 3, 1]) {
            const idx = market[lv].findIndex((c) => c !== null);
            if (idx >= 0) {
              executeReserveCard(cpu, 'market', lv, idx);
              return;
            }
          }
        }

        // 5. 取れる宝石を取るか、何もできなければパス
        if (availColors.length > 0) {
          executeTakeTokens(cpu, availColors.slice(0, Math.min(3, availColors.length)));
        } else {
          lastActorIdx = cpu.idx;
          lastActionText = `${cpu.name}はパスしました。`;
          finishTurn();
        }
      }

      function evaluateCardForPlayer(p, card) {
        let sc = card.points * 10 + card.level * 2;
        // 貴族の条件に足りない色なら加点
        nobles.forEach((nb) => {
          if ((nb.req[card.bonus] || 0) > (p.bonuses[card.bonus] || 0)) sc += 4;
        });
        return sc;
      }

      // ====================================================
      // ダイアログ (購入・予約 / トークンを戻す / 結果)
      // ====================================================
      function modalOpen() {
        return modalOverlayEl.classList.contains('visible');
      }

      function closeModal() {
        modalOverlayEl.classList.remove('visible');
        focusedCardInfo = null;
        if (st) refreshHighlights();
      }

      function showModal(html) {
        modalBoxEl.innerHTML = html;
        modalOverlayEl.classList.add('visible');
        hidePreview();
        if (st) refreshHighlights();
      }

      function drawModalArt(src) {
        const art = modalBoxEl.querySelector('.spl-modal-art');
        if (!art || !src) return;
        const ctx = art.getContext('2d');
        ctx.clearRect(0, 0, art.width, art.height);
        ctx.drawImage(src, 0, 0, art.width, art.height);
      }

      function openCardActionModal(info) {
        const p = players[turnIndex];
        if (!p || p.isCpu || phase !== 'ACTION') return;
        focusedCardInfo = info;
        const { source, level, index, card } = info;

        if (source === 'deck') {
          const full = p.reserved.length >= 3;
          const canReserve = !full && decks[level].length > 0;
          showModal(`
            <div class="spl-modal-head">
              <canvas class="spl-modal-art" width="180" height="252"></canvas>
              <div class="spl-modal-info">
                <div class="spl-modal-kicker">レベル${level}の山札 · 残り${decks[level].length}枚</div>
                <div class="spl-modal-title">伏せたまま予約する</div>
                <p class="spl-modal-desc">一番上のカードを見ないで手元に予約します。${bank.gold > 0 ? '金を1枚受け取ります。' : '金はもう残っていません。'}</p>
                ${full ? '<p class="spl-modal-note is-bad">予約できるのは3枚までです。</p>' : ''}
              </div>
            </div>
            <div class="spl-modal-actions">
              <button class="spl-btn" id="spl-m-cancel">閉じる</button>
              <button class="spl-btn is-primary" id="spl-m-res-deck" ${canReserve ? '' : 'disabled'}>予約する</button>
            </div>
          `);
          drawModalArt(backCanvas(level));
          modalBoxEl.querySelector('#spl-m-cancel').onclick = closeModal;
          const rBtn = modalBoxEl.querySelector('#spl-m-res-deck');
          if (canReserve) rBtn.onclick = () => executeReserveCard(p, 'deck', level, 0);
          return;
        }

        if (!card) return;
        const plan = getPurchasePlan(p, card);
        const reserveFull = p.reserved.length >= 3;
        const canReserve = source === 'market' && !reserveFull;
        const rows = GEM_TYPES.filter((c) => card.cost[c] > 0).map((c) => {
          const need = card.cost[c];
          const disc = Math.min(need, p.bonuses[c] || 0);
          const payN = need - disc;
          const have = p.tokens[c] || 0;
          const short = Math.max(0, payN - have);
          return `
            <div class="spl-cost-row">
              <i style="--g:${GEM_META[c].chip}"></i>
              <span class="spl-cost-num">${need}</span>
              <span>${GEM_META[c].name}</span>
              <span class="spl-cost-sub">${disc ? `割引 ${disc} · ` : ''}支払い ${payN}${short ? ` · <em>不足 ${short}</em>` : ''}</span>
            </div>`;
        }).join('');
        const lacking = plan.goldNeeded - (p.tokens.gold || 0);
        const note = plan.canBuy
          ? (plan.goldNeeded ? `金を${plan.goldNeeded}枚使って購入できます。` : '購入できます。')
          : `宝石があと${lacking}枚足りません。`;

        showModal(`
          <div class="spl-modal-head">
            <canvas class="spl-modal-art" width="180" height="252"></canvas>
            <div class="spl-modal-info">
              <div class="spl-modal-kicker">レベル${card.level} · ${source === 'reserved' ? '予約しているカード' : '場のカード'}</div>
              <div class="spl-modal-title">${GEM_META[card.bonus].name}${card.points ? ` · ${card.points}点` : ''}</div>
              <div class="spl-cost-list">${rows}</div>
              <p class="spl-modal-note ${plan.canBuy ? '' : 'is-bad'}">${note}</p>
            </div>
          </div>
          <div class="spl-modal-actions">
            <button class="spl-btn" id="spl-m-cancel">閉じる</button>
            ${source === 'market' ? `<button class="spl-btn" id="spl-m-res" ${canReserve ? '' : 'disabled'} title="${reserveFull ? '予約は3枚までです' : ''}">予約する${bank.gold > 0 ? '（金を1枚）' : ''}</button>` : ''}
            <button class="spl-btn is-primary" id="spl-m-buy" ${plan.canBuy ? '' : 'disabled'}>購入する</button>
          </div>
        `);
        drawModalArt(cardCanvas(card.id));
        modalBoxEl.querySelector('#spl-m-cancel').onclick = closeModal;
        const buyBtn = modalBoxEl.querySelector('#spl-m-buy');
        if (plan.canBuy) buyBtn.onclick = () => executeBuyCard(p, source, level, index);
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
        const btns = ALL_TOKEN_TYPES.filter((c) => p.tokens[c] > 0).map((c) => `
          <button class="spl-pick" data-ret="${c}"><i style="--g:${GEM_META[c].chip}"></i>${GEM_META[c].name}<small>${p.tokens[c]}枚</small></button>
        `).join('');
        showModal(`
          <div class="spl-modal-title">トークンは10枚までです</div>
          <p class="spl-modal-desc">いま${totalPlayerTokens(p)}枚持っています。戻す宝石をあと${excess}枚選んでください。</p>
          <div class="spl-modal-chips">${btns}</div>
        `);
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
        // 得点の高い順、同点なら購入したカードの少ない順
        const ranked = players.slice().sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return a.purchasedCount - b.purchasedCount;
        });
        const winner = ranked[0];
        const rows = ranked.map((p, i) => `
          <div class="spl-rank">
            <span class="spl-rank-pos">${i + 1}</span>
            <span class="spl-swatch" style="--c:${p.color}"></span>
            <div>
              <div>${p.name}</div>
              <div class="spl-rank-meta">カード ${p.purchasedCount}枚 · 貴族 ${p.nobles.length}人</div>
            </div>
            <span class="spl-rank-pts">${p.points}<small>点</small></span>
          </div>
        `).join('');
        showModal(`
          <div class="spl-modal-title">${winner.idx === mySeat ? 'あなたの勝ちです' : `${winner.name}の勝ちです`}</div>
          <p class="spl-modal-desc">${winner.points}点で決着しました。</p>
          <div style="margin-top:8px;">${rows}</div>
          <div class="spl-modal-actions">
            <button class="spl-btn" id="spl-m-close">盤面を見る</button>
            <button class="spl-btn is-primary" id="spl-m-rematch">もう一度遊ぶ</button>
          </div>
        `);
        modalBoxEl.querySelector('#spl-m-close').onclick = closeModal;
        modalBoxEl.querySelector('#spl-m-rematch').onclick = () => initGame();
      }

      // ====================================================
      // 3D の卓
      // ====================================================
      const B3D = window.BoardArena3D;
      const CW = 1.0;   // カードの幅
      const CD = 1.4;   // カードの長さ
      const CT = 0.012; // カードの厚み
      const DECK_STEP = 0.0055;
      const DECK_X = -2.9;
      const COL_X = [-1.62, -0.46, 0.7, 1.86];
      const ROW_Z = { 3: -2.75, 2: -1.2, 1: 0.35 };
      const NOBLE_S = 1.02;
      const NOBLE_T = 0.032;
      const NOBLE_Z = -4.42;
      const NOBLE_STEP = 1.18;
      const NOBLE_CX = -0.52;
      const CHIP_R = 0.3;
      const CHIP_H = 0.058;
      const BANK_X = 3.3;
      const BANK_Z = { white: -3.75, blue: -2.9, green: -2.05, red: -1.2, black: -0.35, gold: 0.6 };
      const PILE_X = { white: -2.9, blue: -1.62, green: -0.46, red: 0.7, black: 1.86 };
      const PILE_Z = 2.15;
      const PILE_STEP = 0.16;
      const MINE_POS = { white: [2.8, 1.95], blue: [3.64, 1.95], green: [2.8, 2.67], red: [3.64, 2.67], black: [2.8, 3.39], gold: [3.64, 3.39] };
      const RES_X = -4.3;
      const RES_Z = 1.95;
      const RES_STEP = 0.44;
      const MY_NOBLE = { x: -4.3, z: 3.98 };

      let THREE = null;
      let st = null;
      const view = {
        gameKey: -1,
        cards: null,  // カードと貴族タイル
        chips: null,  // 飛んでいるチップ
        market: { 1: [], 2: [], 3: [] },
        decks: {},
        bank: {},
        mine: {},
        piles: {},
        reserved: [],
        nobles: [],
        myNobles: [],
        shown: null,
        labels: [],
        flights: 0,
        glow: null,
        previewKey: null
      };

      // ---- canvas (この卓の間だけ持つ) ----
      const canvases = new Map();
      function localCanvas(key, w, h, paint) {
        if (!canvases.has(key)) {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          paint(c.getContext('2d'), w, h);
          canvases.set(key, c);
        }
        return canvases.get(key);
      }
      const cardCanvas = (id) => localCanvas(`card:${id}`, 360, 504, (ctx, w, h) => paintCardFace(ctx, w, h, CARD_BY_ID[id]));
      const backCanvas = (lv) => localCanvas(`back:${lv}`, 360, 504, (ctx, w, h) => paintBack(ctx, w, h, lv));
      const nobleCanvas = (id) => localCanvas(`noble:${id}`, 400, 400, (ctx, w, h) => paintNoble(ctx, w, h, NOBLE_BY_ID[id]));
      const chipCanvas = (c) => localCanvas(`chip:${c}`, 256, 256, (ctx, w, h) => paintChip(ctx, w, h, c));

      // ---- ジオメトリと材質 ----
      const geoC = (key, make) => st.geo.cached(key, make);

      function faceGeo(w = CW, d = CD, r = 0.06) {
        return geoC(`spl-face:${w}:${d}:${r}`, () => {
          const g = new THREE.ShapeGeometry(st.geo.roundedRectShape(w, d, r), 6);
          const uv = g.attributes.uv;
          const pos = g.attributes.position;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + d / 2) / d);
          g.rotateX(-Math.PI / 2);
          return g;
        });
      }

      // 選べるカードを囲む細い枠
      function outlineGeo(w, d) {
        return geoC(`spl-outline:${w}:${d}`, () => {
          const shape = st.geo.roundedRectShape(w + 0.09, d + 0.09, 0.09);
          shape.holes.push(st.geo.roundedRectShape(w + 0.02, d + 0.02, 0.065));
          return new THREE.ShapeGeometry(shape, 6).rotateX(-Math.PI / 2);
        });
      }

      const edgeMat = () => st.kit.matte('#e6ddc9', { roughness: 0.85 });
      const faceMat = (id) => st.kit.cached(`spl-face:${id}`, () => new THREE.MeshStandardMaterial({
        map: st.kit.texture(cardCanvas(id)), roughness: 0.58, metalness: 0, envMapIntensity: 0.45
      }));
      const backMat = (lv) => st.kit.cached(`spl-back:${lv}`, () => new THREE.MeshStandardMaterial({
        map: st.kit.texture(backCanvas(lv)), roughness: 0.55, metalness: 0, envMapIntensity: 0.45
      }));
      const nobleMat = (id) => st.kit.cached(`spl-noble:${id}`, () => new THREE.MeshStandardMaterial({
        map: st.kit.texture(nobleCanvas(id)), roughness: 0.6, metalness: 0, envMapIntensity: 0.45
      }));
      const chipBodyMat = (c) => st.kit.cached(`spl-chip-body:${c}`, () => new THREE.MeshPhysicalMaterial({
        color: st.kit.color(GEM_META[c].chip),
        roughness: c === 'gold' ? 0.3 : 0.4,
        metalness: c === 'gold' ? 0.45 : 0,
        clearcoat: 0.55,
        clearcoatRoughness: 0.28,
        envMapIntensity: 0.8
      }));
      const chipTopMat = (c) => st.kit.cached(`spl-chip-top:${c}`, () => new THREE.MeshStandardMaterial({
        map: st.kit.texture(chipCanvas(c)), roughness: 0.34, metalness: 0, envMapIntensity: 0.7
      }));

      // ---- 置き場所 ----
      const marketSlot = (lv, i) => ({ x: COL_X[i], y: CT / 2, z: ROW_Z[lv], rx: 0, ry: 0, rz: 0 });
      const resSlot = (i) => ({ x: RES_X, y: CT / 2 + i * 0.004, z: RES_Z + i * RES_STEP, rx: 0, ry: 0, rz: 0 });
      const pileSlot = (color, k) => ({ x: PILE_X[color], y: CT / 2 + k * 0.004, z: PILE_Z + k * PILE_STEP, rx: 0, ry: 0, rz: 0 });
      const deckTop = (lv) => ({ x: DECK_X, y: (view.decks[lv] ? view.decks[lv].height : 0) + CT, z: ROW_Z[lv] });

      // 相手の席 (卓の奥)
      function seatPos(idx) {
        const others = players.filter((p) => p.idx !== mySeat);
        const k = Math.max(0, others.findIndex((p) => p.idx === idx));
        const n = Math.max(1, others.length);
        return { x: NOBLE_CX + (k - (n - 1) / 2) * 3.4, y: 0.9, z: -6.4 };
      }

      function moveTo(obj, slot, o = {}) {
        const h = obj.userData.home;
        if (h && !o.force && h.x === slot.x && h.y === slot.y && h.z === slot.z && h.rz === slot.rz) return;
        obj.userData.home = slot;
        st.animate(obj, {
          position: { x: slot.x, y: slot.y, z: slot.z },
          rotation: { x: slot.rx || 0, y: slot.ry || 0, z: slot.rz || 0 },
          scale: 1
        }, { duration: o.duration || 440, delay: o.delay || 0, arc: o.arc || 0, ease: o.ease || 'outCubic' });
      }

      function flyAway(obj, to, o = {}) {
        obj.userData.zone = 'fly';
        if (obj.userData.glow) obj.userData.glow.visible = false;
        st.animate(obj, {
          position: { x: to.x, y: to.y, z: to.z },
          rotation: { x: 0, y: 0, z: o.faceDown ? Math.PI : 0 },
          scale: o.shrink ? 0.55 : 1
        }, {
          duration: o.duration || 620,
          delay: o.delay || 0,
          arc: o.arc ?? 0.9,
          ease: 'inOutCubic',
          complete: () => st.removeObject(obj)
        });
      }

      // ---- カード ----
      function makeCard(id) {
        const card = CARD_BY_ID[id];
        const g = new THREE.Group();
        const body = new THREE.Mesh(geoC('spl-card-body', () => st.geo.slab(CW, CD, CT, { bevel: 0.003, radius: 0.06 })), edgeMat());
        body.castShadow = true;
        body.receiveShadow = true;
        const front = new THREE.Mesh(faceGeo(), faceMat(id));
        front.position.y = CT / 2 + 0.0006;
        const back = new THREE.Mesh(faceGeo(), backMat(card.level));
        back.rotation.x = Math.PI;
        back.position.y = -CT / 2 - 0.0006;
        const glow = new THREE.Mesh(outlineGeo(CW, CD), view.glow);
        glow.position.y = CT / 2 + 0.001;
        glow.renderOrder = 3;
        glow.visible = false;
        g.add(body, front, back, glow);
        g.userData.cardId = id;
        g.userData.glow = glow;
        view.cards.add(g);
        bindCard(g);
        return g;
      }

      function bindCard(obj) {
        const zone = () => obj.userData.zone;
        st.pick(obj, {
          enabled: () => zone() !== 'fly',
          clickable: () => (zone() === 'market' || zone() === 'reserved') && isMyTurn(),
          onHover: () => {
            showPreview('card', obj.userData.cardId, zone());
            const h = obj.userData.home;
            if ((zone() === 'market' || zone() === 'reserved') && h) {
              st.animate(obj, { position: { x: h.x, y: h.y + 0.14, z: h.z } }, { duration: 160 });
            }
          },
          onLeave: () => {
            hidePreview();
            const h = obj.userData.home;
            if ((zone() === 'market' || zone() === 'reserved') && h) {
              st.animate(obj, { position: { x: h.x, y: h.y, z: h.z } }, { duration: 200 });
            }
          },
          onClick: () => {
            if (!isMyTurn()) return;
            const id = obj.userData.cardId;
            if (zone() === 'market') {
              for (const lv of [1, 2, 3]) {
                const i = view.market[lv].findIndex((e) => e && e.obj === obj);
                if (i >= 0 && market[lv][i] && market[lv][i].id === id) {
                  openCardActionModal({ source: 'market', level: lv, index: i, card: market[lv][i] });
                  return;
                }
              }
            } else if (zone() === 'reserved') {
              const p = players[turnIndex];
              const i = p.reserved.findIndex((c) => c.id === id);
              if (i >= 0) openCardActionModal({ source: 'reserved', level: p.reserved[i].level, index: i, card: p.reserved[i] });
            }
          }
        });
      }

      // ---- 山札 ----
      function makeDeck(lv) {
        const x = DECK_X;
        const z = ROW_Z[lv];
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        const body = new THREE.Mesh(
          geoC('spl-deck-body', () => st.geo.slab(CW * 0.99, CD * 0.99, 1, { bevel: 0.002, radius: 0.06, bevelSegments: 1 }).translate(0, 0.5, 0)),
          edgeMat()
        );
        body.castShadow = true;
        body.receiveShadow = true;
        const cap = new THREE.Mesh(faceGeo(), backMat(lv));
        const shadow = st.markers.contact(CW * 1.45, CD * 1.35, 0.42);
        shadow.position.y = 0.002;
        const slot = new THREE.Mesh(outlineGeo(CW, CD), st.kit.ghost('#d8c9a6', 0.16));
        slot.position.y = 0.003;
        slot.renderOrder = 2;
        slot.visible = false;
        group.add(shadow, slot, body, cap);
        st.root.add(group);

        const label = st.label('', { className: 'spl-count' });
        label.at(x - CW / 2 - 0.26, 0.02, z);
        view.labels.push(label);

        const deck = {
          lv,
          group,
          count: -1,
          height: 0,
          set(n) {
            deck.count = n;
            deck.height = n > 0 ? Math.max(CT, n * DECK_STEP) : 0;
            body.visible = n > 0;
            cap.visible = n > 0;
            shadow.visible = n > 0;
            slot.visible = n === 0;
            body.scale.y = Math.max(0.0001, deck.height);
            cap.position.y = deck.height + 0.0008;
            label.set(String(n));
            label.el.classList.toggle('is-empty', n === 0);
          }
        };
        st.pick(group, {
          clickable: () => canReserveFromDeck(lv),
          onHover: () => {
            showPreview('back', lv);
            st.animate(group, { position: { y: 0.06 } }, { duration: 160 });
          },
          onLeave: () => {
            hidePreview();
            st.animate(group, { position: { y: 0 } }, { duration: 200 });
          },
          onClick: () => {
            if (canReserveFromDeck(lv)) openCardActionModal({ source: 'deck', level: lv, index: 0, card: null });
          }
        });
        return deck;
      }

      // ---- 貴族タイル ----
      function makeNoble(id) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(
          geoC('spl-noble-body', () => st.geo.slab(NOBLE_S, NOBLE_S, NOBLE_T, { bevel: 0.006, radius: 0.04 })),
          st.kit.matte('#3b302a', { roughness: 0.8 })
        );
        body.castShadow = true;
        body.receiveShadow = true;
        const face = new THREE.Mesh(faceGeo(NOBLE_S, NOBLE_S, 0.04), nobleMat(id));
        face.position.y = NOBLE_T / 2 + 0.0006;
        g.add(body, face);
        g.userData.nobleId = id;
        view.cards.add(g);
        st.pick(g, {
          enabled: () => g.userData.zone !== 'fly',
          onHover: () => showPreview('noble', id),
          onLeave: hidePreview
        });
        return g;
      }

      // ---- 宝石のチップ ----
      function makeChip(color) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(geoC('spl-chip', () => st.geo.disc(CHIP_R, CHIP_H, CHIP_H * 0.3, 40)), chipBodyMat(color));
        body.castShadow = true;
        body.receiveShadow = true;
        const top = new THREE.Mesh(geoC('spl-chip-top', () => new THREE.CircleGeometry(CHIP_R * 0.86, 40).rotateX(-Math.PI / 2)), chipTopMat(color));
        top.position.y = CHIP_H / 2 + 0.0008;
        g.add(body, top);
        return g;
      }

      function chipHome(stack, k) {
        const rng = B3D.mulberry32((k + 1) * 97 + ALL_TOKEN_TYPES.indexOf(stack.color) * 13 + (stack.mine ? 500 : 0));
        return { x: (rng() - 0.5) * 0.035, y: CHIP_H / 2 + k * CHIP_H, z: (rng() - 0.5) * 0.035, ry: rng() * Math.PI * 2 };
      }

      function makeStack(color, x, z, mine) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        st.root.add(group);
        const shadow = st.markers.contact(CHIP_R * 2.5, CHIP_R * 2.5, 0.45);
        shadow.position.y = 0.002;
        const slot = st.markers.ring(CHIP_R - 0.03, CHIP_R, '#d8c9a6', 0.16);
        slot.position.y = 0.003;
        group.add(shadow, slot);
        const label = st.label('', { className: 'spl-count' });
        label.at(x + CHIP_R + 0.22, 0.02, z);
        view.labels.push(label);
        const stack = { color, group, chips: [], count: 0, incoming: 0, lifted: 0, x, z, mine, shadow, slot, label };
        if (!mine && color !== 'gold') {
          st.pick(group, {
            clickable: () => isMyTurn() && (canAddTokenToSelection(color) || selectedTokens.includes(color)),
            onHover: () => st.animate(group, { position: { y: isMyTurn() ? 0.04 : 0 } }, { duration: 160 }),
            onLeave: () => st.animate(group, { position: { y: 0 } }, { duration: 200 }),
            onClick: (hit) => {
              let o = hit.object;
              while (o && o.parent !== group) o = o.parent;
              if (o && o.userData.up) deselectToken(color);
              else handleTokenBankClick(color);
            }
          });
        }
        return stack;
      }

      function layoutStack(stack, force) {
        const n = stack.chips.length;
        const lifted = Math.min(stack.lifted, n);
        stack.chips.forEach((chip, k) => {
          const hm = chipHome(stack, k);
          const up = k >= n - lifted ? 1 : 0;
          if (chip.userData.up === up && !force) return;
          chip.userData.up = up;
          const j = k - (n - lifted);
          const pos = up ? { x: hm.x, y: (n - lifted) * CHIP_H + 0.36 + j * (CHIP_H + 0.06), z: hm.z + 0.12 } : hm;
          st.animate(chip, {
            position: { x: pos.x, y: pos.y, z: pos.z },
            rotation: { x: up ? 0.5 : 0, y: hm.ry, z: 0 }
          }, { duration: up ? 340 : 260, ease: up ? 'outBack' : 'outCubic' });
        });
      }

      function setStack(stack, n) {
        while (stack.chips.length < n) {
          const k = stack.chips.length;
          const chip = makeChip(stack.color);
          const hm = chipHome(stack, k);
          chip.position.set(hm.x, hm.y, hm.z);
          chip.rotation.y = hm.ry;
          chip.userData.up = 0;
          stack.group.add(chip);
          stack.chips.push(chip);
        }
        while (stack.chips.length > n) st.removeObject(stack.chips.pop());
        stack.count = n;
        stack.shadow.visible = n > 0;
        stack.slot.visible = n === 0;
        stack.label.set(String(n));
        stack.label.el.classList.toggle('is-empty', n === 0);
        stack.label.show(n > 0 || !stack.mine);
        layoutStack(stack);
      }

      // スタックの上から k 枚を取り出し、それぞれの位置を返す
      function takeFromStack(stack, k) {
        const starts = [];
        for (let j = 0; j < k; j++) {
          const chip = stack.chips[stack.chips.length - 1 - j];
          if (chip) {
            starts.push({ x: stack.x + chip.position.x, y: chip.position.y, z: stack.z + chip.position.z, ry: chip.rotation.y });
          } else {
            starts.push({ x: stack.x, y: CHIP_H / 2, z: stack.z, ry: 0 });
          }
        }
        setStack(stack, Math.max(0, stack.count - k));
        return starts;
      }

      function incomingTop(stack) {
        const k = stack.count + stack.incoming;
        stack.incoming++;
        const hm = chipHome(stack, k);
        return { x: stack.x + hm.x, y: hm.y, z: stack.z + hm.z, ry: hm.ry };
      }

      function arrive(stack) {
        stack.incoming = Math.max(0, stack.incoming - 1);
        setStack(stack, stack.count + 1);
      }

      // 飛んでいる最中のずれを、すべて着地したところで実際の枚数に揃える
      function settle() {
        const me = players[mySeat] || players[0];
        ALL_TOKEN_TYPES.forEach((c) => {
          view.bank[c].incoming = 0;
          view.mine[c].incoming = 0;
          if (view.bank[c].count !== bank[c]) setStack(view.bank[c], bank[c]);
          if (me && view.mine[c].count !== me.tokens[c]) setStack(view.mine[c], me.tokens[c]);
        });
      }

      function flyChip(color, from, to, delay, onArrive) {
        const chip = makeChip(color);
        chip.position.set(from.x, from.y, from.z);
        chip.rotation.y = from.ry || 0;
        if (from.scale) chip.scale.setScalar(from.scale);
        view.chips.add(chip);
        view.flights++;
        const key = view.gameKey;
        st.animate(chip, {
          position: { x: to.x, y: to.y, z: to.z },
          rotation: { x: 0, y: to.ry ?? (from.ry || 0) + Math.PI * 0.5, z: 0 },
          scale: to.scale ?? 1
        }, {
          duration: 560,
          delay,
          arc: 0.9,
          ease: 'inOutCubic',
          complete: () => {
            st.removeObject(chip);
            if (key !== view.gameKey) return;
            view.flights = Math.max(0, view.flights - 1);
            if (onArrive) onArrive();
            if (view.flights === 0) settle();
          }
        });
      }

      // ---- 操作できるか ----
      function isMyTurn() {
        const p = players[turnIndex];
        return !!p && !p.isCpu && phase === 'ACTION' && !modalOpen();
      }

      function canReserveFromDeck(lv) {
        return isMyTurn() && players[turnIndex].reserved.length < 3 && decks[lv].length > 0;
      }

      function handleTokenBankClick(color) {
        const p = players[turnIndex];
        if (!p || p.isCpu || phase !== 'ACTION') return;
        if (canAddTokenToSelection(color)) {
          selectedTokens.push(color);
          SplendorSfx.gemClick();
          renderAll();
        } else if (selectedTokens.includes(color)) {
          deselectToken(color);
        }
      }

      function deselectToken(color) {
        const idx = selectedTokens.lastIndexOf(color);
        if (idx < 0) return;
        selectedTokens.splice(idx, 1);
        SplendorSfx.gemClick();
        renderAll();
      }

      // ---- 拡大表示 ----
      function previewNote(kind, id, zone) {
        const me = players[mySeat] || players[0];
        if (!me) return { text: '' };
        if (kind === 'noble') {
          const nb = NOBLE_BY_ID[id];
          const req = GEM_TYPES.filter((c) => nb.req[c] > 0).map((c) => `${GEM_META[c].short}${nb.req[c]}`).join(' · ');
          return { text: `${nb.name} · 3点\n訪問の条件: カードの割引 ${req}` };
        }
        if (kind === 'back') {
          return { text: `レベル${id}の山札 · 残り${decks[id].length}枚${canReserveFromDeck(id) ? '\n選ぶと伏せたまま予約できます' : ''}` };
        }
        const card = CARD_BY_ID[id];
        if (zone === 'pile') {
          return { text: `${GEM_META[card.bonus].name}の割引 +1${card.points ? ` · ${card.points}点` : ''}` };
        }
        const plan = getPurchasePlan(me, card);
        if (plan.canBuy) {
          return { text: plan.goldNeeded ? `金を${plan.goldNeeded}枚使えば買えます` : 'いま買えます', ok: true };
        }
        const parts = GEM_TYPES.map((c) => {
          const need = Math.max(0, card.cost[c] - (me.bonuses[c] || 0) - (me.tokens[c] || 0));
          return need ? `${GEM_META[c].short}${need}` : '';
        }).filter(Boolean);
        return { text: `あと ${parts.join(' · ')}${me.tokens.gold ? `\n金${me.tokens.gold}枚で一部を補えます` : ''}` };
      }

      function showPreview(kind, id, zone) {
        const key = `${kind}:${id}`;
        if (view.previewKey !== key) {
          const src = kind === 'card' ? cardCanvas(id) : kind === 'back' ? backCanvas(id) : nobleCanvas(id);
          previewCanvas.width = src.width;
          previewCanvas.height = src.height;
          previewCanvas.getContext('2d').drawImage(src, 0, 0);
          view.previewKey = key;
        }
        const note = previewNote(kind, id, zone);
        previewNoteEl.textContent = note.text;
        previewNoteEl.classList.toggle('is-ok', !!note.ok);
        previewEl.classList.toggle('is-noble', kind === 'noble');
        previewEl.classList.add('is-visible');
      }

      function hidePreview() {
        previewEl.classList.remove('is-visible');
      }

      // ---- 卓の組み立て ----
      function buildTable() {
        const mat = new THREE.Mesh(
          st.geo.slab(10.6, 10.4, 0.05, { bevel: 0.02, radius: 0.3 }),
          st.kit.felt('#1b252d', { repeat: 0.5 })
        );
        mat.position.set(-0.45, -0.025, -0.35);
        mat.receiveShadow = true;
        st.root.add(mat);
        // 場と自分の手元の境目
        const line = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 0.012).rotateX(-Math.PI / 2), st.kit.ghost('#d8c9a6', 0.2));
        line.position.set(-0.45, 0.002, 1.3);
        st.root.add(line);
      }

      function resetTable() {
        view.gameKey = gameSerial;
        hidePreview();
        st.clearGroup(view.cards);
        st.clearGroup(view.chips);
        Object.values(view.decks).forEach((d) => st.removeObject(d.group));
        Object.values(view.bank).concat(Object.values(view.mine)).forEach((s) => st.removeObject(s.group));
        view.labels.forEach((lb) => lb.remove());
        view.labels = [];
        view.decks = {};
        view.bank = {};
        view.mine = {};
        view.market = { 1: [null, null, null, null], 2: [null, null, null, null], 3: [null, null, null, null] };
        view.piles = { white: [], blue: [], green: [], red: [], black: [] };
        view.reserved = [];
        view.nobles = [];
        view.myNobles = [];
        view.flights = 0;

        // 山札は場に配る前の枚数から始める (配る様子を見せる)
        [1, 2, 3].forEach((lv) => {
          const d = makeDeck(lv);
          d.set(decks[lv].length + market[lv].filter(Boolean).length);
          view.decks[lv] = d;
        });

        nobles.forEach((nb, i) => {
          const obj = makeNoble(nb.id);
          const x = NOBLE_CX + (i - (nobles.length - 1) / 2) * NOBLE_STEP;
          obj.position.set(x, 1.2, NOBLE_Z);
          obj.userData.zone = 'noble';
          st.animate(obj, { position: { y: NOBLE_T / 2 } }, { duration: 460, delay: 200 + i * 70 });
          view.nobles.push({ id: nb.id, obj });
        });

        ALL_TOKEN_TYPES.forEach((c) => {
          view.bank[c] = makeStack(c, BANK_X, BANK_Z[c], false);
          setStack(view.bank[c], bank[c]);
          const [mx, mz] = MINE_POS[c];
          view.mine[c] = makeStack(c, mx, mz, true);
          setStack(view.mine[c], 0);
        });

        const zone = st.label('予約', { className: 'spl-zone' });
        zone.at(RES_X, 0.02, RES_Z - CD / 2 - 0.2);
        view.labels.push(zone);

        view.shown = {
          tokens: players.map(() => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 })),
          decks: { 1: view.decks[1].count, 2: view.decks[2].count, 3: view.decks[3].count }
        };
      }

      // ---- 同期 ----
      function addToPile(obj, cardId, delay = 0) {
        const color = CARD_BY_ID[cardId].bonus;
        const pile = view.piles[color];
        pile.push({ cardId, obj });
        obj.userData.zone = 'pile';
        obj.userData.glow.visible = false;
        moveTo(obj, pileSlot(color, pile.length - 1), { arc: 1.0, duration: 680, delay, ease: 'inOutCubic' });
      }

      // 場から消えたカードの行き先
      function routeCard(obj, cardId, me) {
        if (me.cards.includes(cardId)) return addToPile(obj, cardId);
        if (me.reserved.some((c) => c.id === cardId)) {
          view.reserved.push({ cardId, obj });
          return;
        }
        const owner = players.find((p) => p.cards.includes(cardId) || p.reserved.some((c) => c.id === cardId));
        flyAway(obj, seatPos(owner ? owner.idx : lastActorIdx), { shrink: true });
      }

      function syncCards(me) {
        const dealt = { 1: 0, 2: 0, 3: 0 };
        let dealDelay = 0;
        [3, 2, 1].forEach((lv) => {
          for (let i = 0; i < 4; i++) {
            const card = market[lv][i];
            const slot = view.market[lv][i];
            if (slot && card && slot.cardId === card.id) continue;
            if (slot) {
              routeCard(slot.obj, slot.cardId, me);
              view.market[lv][i] = null;
            }
            if (card) {
              const from = deckTop(lv);
              const obj = makeCard(card.id);
              obj.position.set(from.x, from.y, from.z);
              obj.rotation.set(0, 0, Math.PI);
              obj.userData.zone = 'market';
              view.market[lv][i] = { cardId: card.id, obj };
              moveTo(obj, marketSlot(lv, i), { delay: 240 + dealDelay, arc: 0.55, duration: 560, ease: 'inOutCubic' });
              dealDelay += 80;
              dealt[lv]++;
            }
          }
        });

        // 自分の予約札 (場から来たもの・山札から伏せて来たもの)
        const blind = { 1: 0, 2: 0, 3: 0 };
        const next = me.reserved.map((card) => {
          let e = view.reserved.find((x) => x.cardId === card.id);
          if (!e) {
            const from = deckTop(card.level);
            const obj = makeCard(card.id);
            obj.position.set(from.x, from.y, from.z);
            obj.rotation.set(0, 0, Math.PI);
            e = { cardId: card.id, obj };
            blind[card.level]++;
          }
          return e;
        });
        view.reserved.forEach((e) => {
          if (next.includes(e)) return;
          if (me.cards.includes(e.cardId)) addToPile(e.obj, e.cardId);
          else flyAway(e.obj, seatPos(lastActorIdx), { shrink: true });
        });
        view.reserved = next;
        next.forEach((e, i) => {
          e.obj.userData.zone = 'reserved';
          moveTo(e.obj, resSlot(i), { arc: 0.8, duration: 640, ease: 'inOutCubic' });
        });

        // 山札の減り (相手が伏せて予約した分は相手の席へ飛ばす)
        [1, 2, 3].forEach((lv) => {
          const extra = view.shown.decks[lv] - decks[lv].length - dealt[lv] - blind[lv];
          const actor = players[lastActorIdx];
          for (let k = 0; k < extra && actor && actor.idx !== mySeat; k++) {
            const card = actor.reserved[actor.reserved.length - 1];
            if (!card) break;
            const from = deckTop(lv);
            const obj = makeCard(card.id);
            obj.position.set(from.x, from.y, from.z);
            obj.rotation.set(0, 0, Math.PI);
            flyAway(obj, seatPos(actor.idx), { shrink: true, faceDown: true });
          }
          view.decks[lv].set(decks[lv].length);
          view.shown.decks[lv] = decks[lv].length;
        });
      }

      function syncNobles(me) {
        view.nobles = view.nobles.filter((e) => {
          if (nobles.some((n) => n.id === e.id)) return true;
          e.obj.userData.zone = 'fly';
          if (me.nobles.some((n) => n.id === e.id)) {
            view.myNobles.push(e);
            const k = view.myNobles.length - 1;
            st.animate(e.obj, {
              position: { x: MY_NOBLE.x + k * 0.3, y: NOBLE_T * 0.4 + k * NOBLE_T, z: MY_NOBLE.z + k * 0.06 },
              rotation: { x: 0, y: 0.05 * k, z: 0 },
              scale: 0.76
            }, { duration: 820, delay: 600, arc: 1.4, ease: 'inOutCubic', complete: () => { e.obj.userData.zone = 'mine'; } });
          } else {
            const owner = players.find((p) => p.nobles.some((n) => n.id === e.id));
            flyAway(e.obj, seatPos(owner ? owner.idx : lastActorIdx), { shrink: true, delay: 600 });
          }
          return false;
        });
      }

      function syncTokens(me) {
        const shown = view.shown.tokens;
        let delay = 0;
        players.forEach((p) => {
          const isMe = p.idx === me.idx;
          ALL_TOKEN_TYPES.forEach((c) => {
            const d = p.tokens[c] - (shown[p.idx][c] || 0);
            if (!d) return;
            if (d > 0) {
              takeFromStack(view.bank[c], d).forEach((from) => {
                if (isMe) {
                  const stack = view.mine[c];
                  flyChip(c, from, incomingTop(stack), delay, () => arrive(stack));
                } else {
                  flyChip(c, from, { ...seatPos(p.idx), scale: 0.45 }, delay, null);
                }
                delay += 70;
              });
            } else {
              const n = -d;
              const starts = isMe ? takeFromStack(view.mine[c], n) : Array.from({ length: n }, () => ({ ...seatPos(p.idx), scale: 0.45 }));
              starts.forEach((from) => {
                const stack = view.bank[c];
                flyChip(c, from, incomingTop(stack), delay, () => arrive(stack));
                delay += 70;
              });
            }
            shown[p.idx][c] = p.tokens[c];
          });
        });
        if (view.flights === 0) settle();

        // 選んでいる宝石は銀行の山から浮かせる
        GEM_TYPES.forEach((c) => {
          const stack = view.bank[c];
          const lifted = phase === 'ACTION' ? selectedTokens.filter((x) => x === c).length : 0;
          if (stack.lifted !== lifted) {
            stack.lifted = lifted;
            layoutStack(stack);
          }
        });
      }

      function refreshHighlights() {
        const active = players[turnIndex];
        const mine = isMyTurn();
        [1, 2, 3].forEach((lv) => view.market[lv].forEach((e) => {
          if (e) e.obj.userData.glow.visible = mine && getPurchasePlan(active, CARD_BY_ID[e.cardId]).canBuy;
        }));
        view.reserved.forEach((e) => {
          e.obj.userData.glow.visible = mine && turnIndex === mySeat && getPurchasePlan(active, CARD_BY_ID[e.cardId]).canBuy;
        });
        st.refreshHover();
      }

      function syncTable() {
        if (!st) return;
        if (view.gameKey !== gameSerial) resetTable();
        const me = players[mySeat] || players[0];
        if (!me) return;
        syncCards(me);
        syncNobles(me);
        syncTokens(me);
        refreshHighlights();
      }

      function initStage(threeLib) {
        THREE = threeLib;
        st = B3D.createStage(THREE, stageWrapEl, {
          embed: true,
          radius: 13.6,
          phi: 0.62,
          extent: 7,
          tableY: -0.06,
          tableWood: 'darkWalnut',
          minRadius: 7,
          maxRadius: 26,
          maxPhi: 1.15,
          onFrame(now) {
            if (view.glow) view.glow.opacity = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(now / 260));
          }
        });
        view.glow = st.kit.cached('spl-glow', () => new THREE.MeshBasicMaterial({
          color: st.kit.color('#e2b867'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false
        }));
        st.root.position.set(0.45, 0, 0.2);
        view.cards = new THREE.Group();
        view.chips = new THREE.Group();
        st.root.add(view.cards, view.chips);
        buildTable();
        B3D.current = st;
        syncTable();
      }

      // ====================================================
      // 操作パネル
      // ====================================================
      function renderAll() {
        const activeP = players[turnIndex];
        const me = players[mySeat] || players[0];

        // 1. プレイヤー
        playersRowEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && phase !== 'GAME_OVER';
          const gems = ALL_TOKEN_TYPES.map((c) => {
            const t = p.tokens[c] || 0;
            const b = c === 'gold' ? 0 : (p.bonuses[c] || 0);
            if (!t && !b) return '';
            return `<span class="spl-gem" style="--g:${GEM_META[c].chip}" title="${GEM_META[c].name}: 宝石 ${t}${c !== 'gold' ? ` · カード ${b}` : ''}"><i></i>${t}${b ? `<small>+${b}</small>` : ''}</span>`;
          }).join('');
          return `
            <div class="spl-player ${isTurn ? 'is-turn' : ''}">
              <span class="spl-swatch" style="--c:${p.color}"></span>
              <div>
                <div class="spl-player-name"><span>${p.name}</span><span class="spl-player-pts">${p.points}<small>点</small></span></div>
                <div class="spl-player-sub">${gems || '<span>まだ何もありません</span>'}<span class="spl-meta">予約 ${p.reserved.length} · 貴族 ${p.nobles.length}</span></div>
              </div>
            </div>
          `;
        }).join('');

        // 2. 状況
        const round = `ラウンド ${roundNum}${phase !== 'GAME_OVER' && activeP ? ` · ${activeP.name}の手番` : ''}`;
        phaseEl.innerHTML = `${round}${finalRoundTriggered && phase !== 'GAME_OVER' ? '<em>最終ラウンド</em>' : ''}`;
        announceEl.textContent = lastActionText;

        // 3. 手元
        if (me) {
          const total = totalPlayerTokens(me);
          myGemsEl.innerHTML = `<span class="spl-hand-label">あなたの手元</span>` + ALL_TOKEN_TYPES.map((c) => `
            <span class="spl-hold" style="--g:${GEM_META[c].chip}" title="${GEM_META[c].name}: 宝石 ${me.tokens[c]}${c !== 'gold' ? ` · カードの割引 ${me.bonuses[c]}` : ''}">
              <i></i><b>${me.tokens[c]}</b>${c !== 'gold' ? `<small>+${me.bonuses[c]}</small>` : ''}
            </span>
          `).join('') + `<span class="spl-hold-total ${total > 10 ? 'is-over' : ''}">${total} / 10枚</span>`;
        }

        // 4. 操作
        const myTurn = activeP && !activeP.isCpu && phase === 'ACTION';
        if (phase === 'GAME_OVER') {
          actionPanelEl.innerHTML = `<button class="spl-btn is-primary" id="spl-rematch">もう一度遊ぶ</button>`;
          actionPanelEl.querySelector('#spl-rematch').onclick = () => initGame();
        } else if (myTurn) {
          const picks = GEM_TYPES.map((c) => {
            const picked = selectedTokens.filter((x) => x === c).length;
            const enabled = canAddTokenToSelection(c) || picked > 0;
            return `<button class="spl-pick ${picked ? 'is-picked' : ''}" data-gem="${c}" ${enabled ? '' : 'disabled'} title="${GEM_META[c].name}（残り ${bank[c]}枚）">
              <i style="--g:${GEM_META[c].chip}"></i>${GEM_META[c].short}<small>${bank[c] - picked}</small>${picked ? `<b>+${picked}</b>` : ''}
            </button>`;
          }).join('');
          const label = selectedTokens.length
            ? `選んだ宝石: ${describeTokens(selectedTokens)}`
            : '宝石を選ぶか、卓のカードを選んで購入・予約します';
          actionPanelEl.innerHTML = `
            <div class="spl-action-label">${label}</div>
            ${picks}
            ${selectedTokens.length ? `
              <button class="spl-btn" id="spl-clear-tokens">選び直す</button>
              <button class="spl-btn is-primary" id="spl-confirm-tokens">受け取る</button>
            ` : ''}
          `;
          actionPanelEl.querySelectorAll('[data-gem]').forEach((btn) => {
            btn.onclick = () => {
              const c = btn.getAttribute('data-gem');
              if (canAddTokenToSelection(c)) handleTokenBankClick(c);
              else deselectToken(c);
            };
          });
          const clr = actionPanelEl.querySelector('#spl-clear-tokens');
          if (clr) {
            clr.onclick = () => {
              selectedTokens = [];
              renderAll();
            };
          }
          const ok = actionPanelEl.querySelector('#spl-confirm-tokens');
          if (ok) ok.onclick = () => executeTakeTokens(activeP, selectedTokens.slice());
        } else if (phase === 'DISCARD_TOKENS') {
          actionPanelEl.innerHTML = `<span class="spl-prompt">戻す宝石を選んでください</span>`;
        } else {
          actionPanelEl.innerHTML = `<span class="spl-wait">${activeP ? activeP.name : ''}が考えています</span>`;
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
        canvases.clear();
      };
    }
  });
})();
