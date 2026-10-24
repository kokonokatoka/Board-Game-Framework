/**
 * ドミニオン (2〜4人)
 * 銅貨7枚と屋敷3枚の小さな山札から始め、サプライのカードを買い足して山札を育てるデッキ構築ゲーム。
 *
 * - 基本7種と王国カード16種（地下貯蔵庫・礼拝堂・堀・村・木こり・工房・鍛冶屋・民兵・改築・金貸し・
 *   庭園・市場・研究所・祝祭・鉱山・魔女）から10種を使う。終了は属州切れかサプライ3山切れ
 * - 卓は共通エンジン (arena-3d-engine.js) のステージに、印刷したカードと山札を並べて描く
 */

(function () {
  // 全カード定義
  // lines: カード下部の効果文 / glyph: 絵柄の位置に置く一文字
  const CARD_DB = {
    // ===== 財宝 =====
    copper: { id: 'copper', name: '銅貨', cost: 0, type: 'treasure', coins: 1, vp: 0, desc: '+1コイン', lines: ['1コインを生む'] },
    silver: { id: 'silver', name: '銀貨', cost: 3, type: 'treasure', coins: 2, vp: 0, desc: '+2コイン', lines: ['2コインを生む'] },
    gold:   { id: 'gold',   name: '金貨', cost: 6, type: 'treasure', coins: 3, vp: 0, desc: '+3コイン', lines: ['3コインを生む'] },

    // ===== 勝利点・呪い =====
    estate:   { id: 'estate',   name: '屋敷', cost: 2, type: 'victory', coins: 0, vp: 1,  desc: '1勝利点',  lines: ['1 勝利点'] },
    duchy:    { id: 'duchy',    name: '公領', cost: 5, type: 'victory', coins: 0, vp: 3,  desc: '3勝利点',  lines: ['3 勝利点'] },
    province: { id: 'province', name: '属州', cost: 8, type: 'victory', coins: 0, vp: 6,  desc: '6勝利点',  lines: ['6 勝利点'] },
    curse:    { id: 'curse',    name: '呪い', cost: 0, type: 'curse',   coins: 0, vp: -1, desc: '-1勝利点', lines: ['-1 勝利点'] },

    // ===== 王国カード (16種) =====
    cellar: {
      id: 'cellar', name: '地下貯蔵庫', cost: 2, type: 'action', glyph: '蔵',
      plusCards: 0, plusActions: 1, plusBuys: 0, plusCoins: 0,
      desc: '+1アクション、手札を好きな枚数捨てて同じ枚数を引く', lines: ['+1 アクション', '手札を好きな枚数捨て、同じ枚数を引く']
    },
    chapel: {
      id: 'chapel', name: '礼拝堂', cost: 2, type: 'action', glyph: '祈',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: '手札を4枚まで廃棄する', lines: ['手札を4枚まで廃棄する']
    },
    moat: {
      id: 'moat', name: '堀', cost: 2, type: 'action-reaction', glyph: '堀',
      plusCards: 2, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: '+2カード、手札にあれば他のプレイヤーのアタックを受けない', lines: ['+2 カード', '手札にあるあいだ、他のプレイヤーのアタックを受けない']
    },
    village: {
      id: 'village', name: '村', cost: 3, type: 'action', glyph: '村',
      plusCards: 1, plusActions: 2, plusBuys: 0, plusCoins: 0,
      desc: '+1カード、+2アクション', lines: ['+1 カード', '+2 アクション']
    },
    woodcutter: {
      id: 'woodcutter', name: '木こり', cost: 3, type: 'action', glyph: '樵',
      plusCards: 0, plusActions: 0, plusBuys: 1, plusCoins: 2,
      desc: '+1購入、+2コイン', lines: ['+1 購入', '+2 コイン']
    },
    workshop: {
      id: 'workshop', name: '工房', cost: 3, type: 'action', glyph: '工',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: 'コスト4以下のカードを1枚獲得する', lines: ['コスト4以下のカードを1枚獲得する']
    },
    smithy: {
      id: 'smithy', name: '鍛冶屋', cost: 4, type: 'action', glyph: '鍛',
      plusCards: 3, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: '+3カード', lines: ['+3 カード']
    },
    militia: {
      id: 'militia', name: '民兵', cost: 4, type: 'action-attack', glyph: '兵',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 2,
      desc: '+2コイン、他のプレイヤーは手札が3枚になるまで捨てる', lines: ['+2 コイン', '他のプレイヤーは手札が3枚になるまで捨てる']
    },
    remodel: {
      id: 'remodel', name: '改築', cost: 4, type: 'action', glyph: '改',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: '手札を1枚廃棄し、そのコスト+2以下のカードを1枚獲得する', lines: ['手札を1枚廃棄し、そのコスト+2までのカードを1枚獲得する']
    },
    moneylender: {
      id: 'moneylender', name: '金貸し', cost: 4, type: 'action', glyph: '貸',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: '手札の銅貨を1枚廃棄して+3コイン', lines: ['手札の銅貨を1枚廃棄し、+3 コイン']
    },
    gardens: {
      id: 'gardens', name: '庭園', cost: 4, type: 'victory', coins: 0, vp: 0, glyph: '庭',
      desc: '自分のカード10枚につき1勝利点', lines: ['自分のカード10枚につき 1 勝利点']
    },
    market: {
      id: 'market', name: '市場', cost: 5, type: 'action', glyph: '市',
      plusCards: 1, plusActions: 1, plusBuys: 1, plusCoins: 1,
      desc: '+1カード、+1アクション、+1購入、+1コイン', lines: ['+1 カード', '+1 アクション', '+1 購入', '+1 コイン']
    },
    laboratory: {
      id: 'laboratory', name: '研究所', cost: 5, type: 'action', glyph: '研',
      plusCards: 2, plusActions: 1, plusBuys: 0, plusCoins: 0,
      desc: '+2カード、+1アクション', lines: ['+2 カード', '+1 アクション']
    },
    festival: {
      id: 'festival', name: '祝祭', cost: 5, type: 'action', glyph: '祭',
      plusCards: 0, plusActions: 2, plusBuys: 1, plusCoins: 2,
      desc: '+2アクション、+1購入、+2コイン', lines: ['+2 アクション', '+1 購入', '+2 コイン']
    },
    mine: {
      id: 'mine', name: '鉱山', cost: 5, type: 'action', glyph: '鉱',
      plusCards: 0, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: '財宝を1枚廃棄し、コスト+3以下の財宝を手札に獲得する', lines: ['手札の財宝を1枚廃棄し、コスト+3までの財宝を手札に獲得する']
    },
    witch: {
      id: 'witch', name: '魔女', cost: 5, type: 'action-attack', glyph: '魔',
      plusCards: 2, plusActions: 0, plusBuys: 0, plusCoins: 0,
      desc: '+2カード、他のプレイヤーは呪いを1枚獲得する', lines: ['+2 カード', '他のプレイヤーは呪いを1枚獲得する']
    }
  };

  const KINGDOM_PRESETS = {
    first_game: {
      name: '最初のゲーム',
      cards: ['cellar', 'moat', 'village', 'woodcutter', 'workshop', 'smithy', 'militia', 'remodel', 'market', 'mine']
    },
    witch_money: {
      name: '魔女と金貨',
      cards: ['chapel', 'moat', 'village', 'moneylender', 'smithy', 'militia', 'market', 'laboratory', 'mine', 'witch']
    },
    engine_gardens: {
      name: '祝祭と庭園',
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
    { name: 'あなた', color: '#4f86b8' },
    { name: 'CPU 宰相', color: '#b5473c' },
    { name: 'CPU 将軍', color: '#5d9160' },
    { name: 'CPU 大司教', color: '#c79a3c' }
  ];

  // カードの種類ごとの色 (絵柄の地と操作パネルの印)
  const KIND_STYLE = {
    action:   { band: '#44536a', label: 'アクション' },
    attack:   { band: '#7a332c', label: 'アクション・アタック' },
    reaction: { band: '#2f5f80', label: 'アクション・リアクション' },
    treasure: { band: '#8d6c27', label: '財宝' },
    victory:  { band: '#3c6a42', label: '勝利点' },
    curse:    { band: '#563769', label: '呪い' }
  };
  const METAL = { copper: '#a8643a', silver: '#9aa1a8', gold: '#c9a043' };

  function cardKind(c) {
    if (c.type === 'action-attack') return 'attack';
    if (c.type === 'action-reaction') return 'reaction';
    if (c.type === 'action') return 'action';
    return c.type;
  }
  const kindColor = (id) => (CARD_DB[id].type === 'treasure' ? METAL[id] : KIND_STYLE[cardKind(CARD_DB[id])].band);

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

  // ====================================================
  // カードの印刷面 (canvas)
  // ====================================================
  const UI_FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic UI", sans-serif';
  const SERIF = '"Marcellus", Georgia, "Times New Roman", serif';

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
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

  // 日本語の折り返し (句読点を行頭に置かない)
  function wrapText(ctx, text, maxW) {
    const out = [];
    let line = '';
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line && !'、。）」'.includes(ch)) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out;
  }

  function drawShield(ctx, cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy + h * 0.05);
    ctx.quadraticCurveTo(cx + w / 2, cy + h * 0.38, cx, cy + h / 2);
    ctx.quadraticCurveTo(cx - w / 2, cy + h * 0.38, cx - w / 2, cy + h * 0.05);
    ctx.closePath();
  }

  function cardCanvas(B3D, id) {
    const c = CARD_DB[id];
    return B3D.canvas.cached(`dom-card:${id}`, 512, 716, (ctx, w, h) => {
      const kind = cardKind(c);
      const band = c.type === 'treasure' ? METAL[id] : KIND_STYLE[kind].band;

      // 紙
      B3D.canvas.paintNoise(ctx, w, h, '#ebe1c6', 10, id.length * 31 + 7, 600);
      ctx.strokeStyle = 'rgba(70, 52, 34, 0.5)';
      ctx.lineWidth = 3;
      roundRectPath(ctx, 20, 20, w - 40, h - 40, 16);
      ctx.stroke();

      // 名前
      ctx.fillStyle = '#2a2119';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 48;
      ctx.font = `700 ${size}px ${UI_FONT}`;
      while (ctx.measureText(c.name).width > w - 120 && size > 30) {
        size -= 2;
        ctx.font = `700 ${size}px ${UI_FONT}`;
      }
      ctx.fillText(c.name, w / 2, 70);
      ctx.strokeStyle = 'rgba(70, 52, 34, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(150, 108);
      ctx.lineTo(w - 150, 108);
      ctx.stroke();

      // 絵柄の地
      const ax = 40;
      const ay = 120;
      const aw = w - 80;
      const ah = 300;
      const g = ctx.createLinearGradient(0, ay, 0, ay + ah);
      g.addColorStop(0, shade(band, 0.12));
      g.addColorStop(1, shade(band, -0.32));
      ctx.fillStyle = g;
      ctx.fillRect(ax, ay, aw, ah);
      const light = ctx.createRadialGradient(w / 2, ay + 40, 10, w / 2, ay + 60, aw * 0.75);
      light.addColorStop(0, 'rgba(255, 245, 225, 0.22)');
      light.addColorStop(1, 'rgba(255, 245, 225, 0)');
      ctx.fillStyle = light;
      ctx.fillRect(ax, ay, aw, ah);
      ctx.save();
      ctx.beginPath();
      ctx.rect(ax, ay, aw, ah);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 240, 210, 0.06)';
      ctx.lineWidth = 2;
      for (let x = -ah; x < aw; x += 14) {
        ctx.beginPath();
        ctx.moveTo(ax + x, ay + ah);
        ctx.lineTo(ax + x + ah, ay);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(40, 28, 18, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ax, ay, aw, ah);

      const cx = w / 2;
      const cy = ay + ah / 2;
      if (c.type === 'treasure') {
        // 硬貨
        const r = 104;
        const cg = ctx.createRadialGradient(cx - 30, cy - 34, 10, cx, cy, r);
        cg.addColorStop(0, shade(band, 0.45));
        cg.addColorStop(0.7, band);
        cg.addColorStop(1, shade(band, -0.35));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shade(band, -0.45);
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 250, 235, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `700 118px ${UI_FONT}`;
        ctx.fillStyle = 'rgba(255, 250, 235, 0.35)';
        ctx.fillText(String(c.coins), cx + 2, cy + 8);
        ctx.fillStyle = shade(band, -0.6);
        ctx.fillText(String(c.coins), cx, cy + 6);
      } else if (c.type === 'victory' || c.type === 'curse') {
        // 紋章
        const sg = ctx.createLinearGradient(0, cy - 110, 0, cy + 110);
        sg.addColorStop(0, shade(band, 0.35));
        sg.addColorStop(1, shade(band, -0.25));
        ctx.fillStyle = sg;
        drawShield(ctx, cx, cy, 180, 220);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 244, 220, 0.6)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#f3ead6';
        if (c.glyph) {
          ctx.font = `700 104px ${UI_FONT}`;
          ctx.fillText(c.glyph, cx, cy - 6);
        } else {
          ctx.font = `700 112px ${UI_FONT}`;
          ctx.fillText(String(c.vp), cx, cy - 4);
        }
      } else {
        // メダリオンに一文字
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 240, 210, 0.55)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 86, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f3ead6';
        ctx.font = `700 112px ${UI_FONT}`;
        ctx.fillText(c.glyph || c.name[0], cx, cy + 2);
      }

      // 効果文
      const boxTop = 440;
      const boxBottom = 616;
      const rendered = [];
      c.lines.forEach((text) => {
        const big = /^[+-]\d/.test(text) || /^\d/.test(text);
        ctx.font = big ? `700 40px ${UI_FONT}` : `500 29px ${UI_FONT}`;
        wrapText(ctx, text, w - 120).forEach((ln) => rendered.push({ ln, font: ctx.font, lh: big ? 50 : 40 }));
      });
      const total = rendered.reduce((s, r) => s + r.lh, 0);
      let y = boxTop + (boxBottom - boxTop - total) / 2;
      ctx.fillStyle = '#2a2119';
      rendered.forEach((r) => {
        ctx.font = r.font;
        ctx.fillText(r.ln, w / 2, y + r.lh / 2);
        y += r.lh;
      });

      // コストと種類
      ctx.strokeStyle = 'rgba(70, 52, 34, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 626);
      ctx.lineTo(w - 40, 626);
      ctx.stroke();
      const coin = ctx.createRadialGradient(72, 656, 4, 80, 664, 32);
      coin.addColorStop(0, '#f2d88c');
      coin.addColorStop(1, '#a8812e');
      ctx.fillStyle = coin;
      ctx.beginPath();
      ctx.arc(80, 664, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6f5420';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#2a1d10';
      ctx.font = `700 34px ${UI_FONT}`;
      ctx.fillText(String(c.cost), 80, 666);
      ctx.fillStyle = '#6a5844';
      ctx.font = `500 22px ${UI_FONT}`;
      ctx.fillText(KIND_STYLE[kind].label, w / 2 + 24, 666);
    });
  }

  function cardBackCanvas(B3D) {
    return B3D.canvas.cached('dom-card-back', 512, 716, (ctx, w, h) => {
      B3D.canvas.paintNoise(ctx, w, h, '#26324a', 10, 909, 400);
      const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.75);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c4a258';
      ctx.lineWidth = 4;
      roundRectPath(ctx, 26, 26, w - 52, h - 52, 18);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, 40, 40, w - 80, h - 80, 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, 170, 230, 0, 0, Math.PI * 2);
      ctx.stroke();
      [[w / 2, h / 2 - 260], [w / 2, h / 2 + 260]].forEach(([x, y]) => {
        ctx.fillStyle = '#c4a258';
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x + 12, y);
        ctx.lineTo(x, y + 12);
        ctx.lineTo(x - 12, y);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = '#d9b968';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `400 54px ${SERIF}`;
      const word = 'DOMINION';
      const spacing = 8;
      const widths = [...word].map((ch) => ctx.measureText(ch).width);
      const totalW = widths.reduce((s, x) => s + x, 0) + spacing * (word.length - 1);
      let x = w / 2 - totalW / 2;
      [...word].forEach((ch, i) => {
        ctx.fillText(ch, x + widths[i] / 2, h / 2);
        x += widths[i] + spacing;
      });
    });
  }

  window.BoardArena.registerGame({
    id: 'dominion',
    name: 'ドミニオン',
    icon: '',
    category: 'デッキ構築',
    minPlayers: 2,
    maxPlayers: 4,
    description: '銅貨7枚と屋敷3枚の小さな山札から始め、王国カードと財宝を買い足して自分だけの山札を育てるデッキ構築ゲーム。',

    mount(container, bridge) {
      let isDestroyed = false;
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
      let gameSerial = 0;  // 新しいゲームごとに増える (3D の卓を組み直す目印)
      let turnSerial = 0;  // 手番ごとに増える (場札を片付ける目印)

      // 特殊カード効果待ち状態: null | { mode: 'GAIN_UP_TO', maxCost, dest: 'discard'|'hand', filterType: null|'treasure', title }
      let pendingGain = null;
      let logBannerText = '手札のアクションか財宝を出して、サプライからカードを買いましょう。';

      container.innerHTML = `
        <style>
          .dom-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: var(--text);
            font-family: var(--font-ui);
          }
          .dom-top-bar, .dom-dock {
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
          .dom-players-row { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 480px; min-width: 0; }
          .dom-player {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px 7px 10px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 4px;
            transition: border-color 0.25s, background 0.25s;
          }
          .dom-player.is-turn { border-color: rgba(226, 184, 103, 0.6); background: rgba(226, 184, 103, 0.07); }
          .dom-swatch {
            flex: none;
            width: 12px;
            height: 12px;
            border-radius: 2px;
            background: var(--c);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
          }
          .dom-player-name { display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-weight: 700; white-space: nowrap; }
          .dom-player-vp { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
          .dom-player-vp small { margin-left: 2px; font-size: 10px; font-weight: 500; color: var(--text-3); }
          .dom-player-sub { font-size: 11px; color: var(--text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
          .dom-controls, .dom-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .dom-actions { justify-content: flex-end; }
          .dom-btn, .dom-select {
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
          .dom-select {
            padding-right: 28px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a8a6a0' stroke-width='1.2'/%3E%3C/svg%3E") no-repeat right 10px center;
          }
          .dom-select option { background: #161618; color: #ecebe6; }
          .dom-btn:hover:not(:disabled), .dom-select:hover { color: var(--text); border-color: rgba(255, 255, 255, 0.34); }
          .dom-btn:disabled { opacity: 0.35; cursor: not-allowed; }
          .dom-btn.is-primary { background: var(--text); border-color: var(--text); color: var(--text-inverse); font-weight: 700; }
          .dom-btn.is-primary:hover:not(:disabled) { background: #fff; color: var(--text-inverse); }

          .dom-stage-wrap { position: relative; }
          .dom-stage-wrap .ba3d-stage { height: clamp(440px, calc(100vh - 290px), 880px); }
          .dom-status {
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
          .dom-turn {
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
          .dom-turn div {
            min-width: 64px;
            padding: 7px 12px 6px;
            background: rgba(14, 12, 11, 0.6);
            display: flex;
            flex-direction: column;
            gap: 1px;
          }
          .dom-turn span { font-size: 10px; letter-spacing: 0.08em; color: rgba(236, 235, 230, 0.55); }
          .dom-turn b { font-size: 20px; font-weight: 700; line-height: 1.1; color: #ecebe6; font-variant-numeric: tabular-nums; }
          .dom-turn .is-coin b { color: #e2b867; }
          .dom-preview {
            position: absolute;
            right: 14px;
            top: 50%;
            z-index: 6;
            width: clamp(150px, 17vw, 220px);
            transform: translate(12px, -50%);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.18s ease, transform 0.18s ease;
          }
          .dom-preview.is-visible { opacity: 1; transform: translate(0, -50%); }
          .dom-preview canvas {
            display: block;
            width: 100%;
            height: auto;
            border-radius: 9px;
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.4);
          }

          .dom-hand-strip { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; flex: 1 1 400px; min-width: 0; }
          .dom-hand-label { margin-right: 4px; font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
          .dom-chip {
            position: relative;
            display: inline-flex;
            align-items: baseline;
            gap: 6px;
            padding: 6px 10px 6px 12px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 3px;
            color: var(--text);
            font: 500 12px/1.4 var(--font-ui);
            cursor: pointer;
            overflow: hidden;
            transition: border-color 0.2s, transform 0.2s;
          }
          .dom-chip::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--c); }
          .dom-chip small { font-size: 10px; color: var(--text-3); }
          .dom-chip:hover:not(:disabled) { border-color: rgba(226, 184, 103, 0.7); transform: translateY(-1px); }
          .dom-chip:disabled { cursor: default; opacity: 0.55; }
          .dom-wait { font-size: 12px; color: var(--text-3); }
          .dom-prompt { font-size: 12px; color: #e2b867; }

          .ba3d-label.dom-count {
            padding: 1px 6px;
            background: rgba(14, 12, 11, 0.62);
            color: rgba(236, 235, 230, 0.9);
            font-size: 11px;
          }
          .ba3d-label.dom-count.is-empty { color: #d39486; }
          .ba3d-label.dom-zone { padding: 0; background: none; color: rgba(236, 235, 230, 0.6); font-size: 11px; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); }

          .dom-modal-overlay {
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
          .dom-modal-overlay.visible { display: flex; }
          .dom-modal-box {
            width: min(560px, 100%);
            max-height: 100%;
            overflow: auto;
            padding: 22px 24px;
            background: var(--bg-raised);
            border: 1px solid var(--line-strong);
            border-radius: 6px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          }
          .dom-modal-title { font-size: 17px; font-weight: 700; }
          .dom-modal-sub { margin-top: 4px; font-size: 12px; color: var(--text-3); }
          .dom-modal-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
          .dom-chip.is-selected { border-color: rgba(226, 184, 103, 0.85); background: rgba(226, 184, 103, 0.1); }
          .dom-modal-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; margin-top: 18px; }
          .dom-rank { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--line); font-size: 13px; }
          .dom-rank-pos { width: 18px; color: var(--text-3); font-variant-numeric: tabular-nums; }
          .dom-rank-meta { font-size: 11px; color: var(--text-3); }
          .dom-rank-vp { margin-left: auto; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
          .dom-rank-vp small { margin-left: 2px; font-size: 10px; font-weight: 500; color: var(--text-3); }

          @media (max-width: 640px) {
            .dom-stage-wrap .ba3d-stage { height: min(64vh, 480px); }
            .dom-status { max-width: calc(100% - 110px); font-size: 12px; }
            .dom-player-sub { display: none; }
            .dom-preview { display: none; }
          }
        </style>

        <div class="dom-wrapper">
          <div class="dom-top-bar">
            <div class="dom-players-row" id="dom-players-row"></div>
            <div class="dom-controls">
              <select id="dom-preset-sel" class="dom-select" aria-label="王国カードの組み合わせ">
                <option value="first_game">最初のゲーム</option>
                <option value="witch_money">魔女と金貨</option>
                <option value="engine_gardens">祝祭と庭園</option>
                <option value="random">ランダム10種</option>
              </select>
              <select id="dom-pcount-sel" class="dom-select" aria-label="人数">
                <option value="2" selected>2人</option>
                <option value="3">3人</option>
                <option value="4">4人</option>
              </select>
              <button class="dom-btn" id="dom-new-btn">新しいゲーム</button>
            </div>
          </div>

          <div class="dom-stage-wrap" id="dom-stage-wrap">
            <div class="dom-status" id="dom-banner"></div>
            <div class="dom-turn">
              <div><span>アクション</span><b id="dom-stat-act">1</b></div>
              <div><span>購入</span><b id="dom-stat-buy">1</b></div>
              <div class="is-coin"><span>コイン</span><b id="dom-stat-coin">0</b></div>
            </div>
            <div class="dom-preview" id="dom-preview"><canvas width="512" height="716"></canvas></div>
            <div class="dom-modal-overlay" id="dom-modal-overlay">
              <div class="dom-modal-box" id="dom-modal-box"></div>
            </div>
          </div>

          <div class="dom-dock">
            <div class="dom-hand-strip" id="dom-hand-strip"></div>
            <div class="dom-actions" id="dom-action-btns"></div>
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
      const previewEl = container.querySelector('#dom-preview');
      const previewCanvas = previewEl.querySelector('canvas');
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
          name: idx === mySeat ? 'あなた' : (vsCpu ? PLAYER_THEMES[idx].name : `プレイヤー ${idx + 1}`),
          color: PLAYER_THEMES[idx].color,
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

        gameSerial++;
        turnIndex = 0;
        startPlayerTurn(0);
      }

      function startPlayerTurn(pIdx) {
        turnIndex = pIdx;
        turnSerial++;
        const p = players[pIdx];
        p.turnsTaken++;
        actionsLeft = 1;
        buysLeft = 1;
        coinsPool = 0;
        pendingGain = null;
        closeModal();

        const hasActionCard = p.hand.some((cid) => CARD_DB[cid].type.startsWith('action'));
        turnPhase = hasActionCard ? 'ACTION' : 'BUY';

        logBannerText = p.isCpu
          ? `${p.name}の手番です。`
          : `${p.name}の手番です。${hasActionCard ? 'アクションを使うか、財宝を出して買い物をしましょう。' : '財宝を出して、サプライからカードを買いましょう。'}`;
        renderAll();

        if (p.isCpu) runCpuTurn();
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
          logBannerText = `${p.name}が${card.name}を出しました（${coinsPool}コイン）。`;
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

          logBannerText = `${p.name}が${card.name}を使いました（${card.desc}）。`;

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
          logBannerText = `${p.name}が財宝をまとめて出しました（${coinsPool}コイン、購入 ${buysLeft}回）。`;
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
            renderAll();
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
            renderAll();
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
            pendingGain = { mode: 'GAIN_UP_TO', maxCost: 4, dest: 'discard', filterType: null, title: '工房: コスト4以下のカードを1枚選んで獲得してください。' };
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
            logBannerText = `${p.name}が金貸しで銅貨を1枚廃棄し、3コインを得ました。`;
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
            renderAll();
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
            renderAll();
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
              affected.push(`${other.name}は堀で防ぎました`);
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
            affected.push(`${other.name}は手札を3枚に`);
          });
          logBannerText = `${p.name}が民兵を使いました（${affected.join('、')}）。`;
          renderAll();
          return;
        }

        if (cid === 'witch') {
          DomSfx.attack();
          const cursedLog = [];
          players.forEach((other) => {
            if (other.idx === p.idx) return;
            if (other.hand.includes('moat')) {
              cursedLog.push(`${other.name}は堀で防ぎました`);
              return;
            }
            if (supply.curse > 0) {
              supply.curse--;
              other.discard.push('curse');
              cursedLog.push(`${other.name}が呪いを獲得`);
            }
          });
          logBannerText = `${p.name}が魔女を使いました（${cursedLog.join('、') || '呪いは残っていません'}）。`;
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
          logBannerText = `${p.name}が${card.name}を獲得しました。`;
          renderAll();
          return;
        }

        // 2. 通常購入（コインが足りなければ手札の財宝を自動で出す）
        if (buysLeft <= 0) return;

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
        logBannerText = `${p.name}が${card.name}を買いました（残り ${coinsPool}コイン、購入 ${buysLeft}回）。`;

        if (isGameOverConditionMet()) {
          finishGame();
          return;
        }

        renderAll();
        if (buysLeft <= 0) {
          // 購入回数を使い切ったら少し見せてから片付ける (その間に手番を終えた場合は何もしない)
          const serial = turnSerial;
          cpuTimer = setTimeout(() => { if (serial === turnSerial) endCleanUpTurn(); }, 650);
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
        renderAll();
        openGameOverModal();
      }

      // ====================================================
      // 3. 地下貯蔵庫・礼拝堂・改築・鉱山・勝敗のダイアログ
      // ====================================================
      function closeModal() {
        modalOverlayEl.classList.remove('visible');
      }

      function openModal(html) {
        modalBoxEl.innerHTML = html;
        modalOverlayEl.classList.add('visible');
      }

      const chip = (cid, attrs, extra = '') => {
        const c = CARD_DB[cid];
        return `<button class="dom-chip" ${attrs} style="--c:${kindColor(cid)}">${c.name}<small>${extra || `コスト${c.cost}`}</small></button>`;
      };

      function openCellarModal(p) {
        const selected = new Set();
        function renderCellar() {
          openModal(`
            <div class="dom-modal-title">地下貯蔵庫</div>
            <div class="dom-modal-sub">捨てるカードを選んでください。捨てた枚数だけ山札から引きます。</div>
            <div class="dom-modal-chips">
              ${p.hand.map((cid, idx) => chip(cid, `data-idx="${idx}"`, selected.has(idx) ? '捨てる' : '')).join('')}
            </div>
            <div class="dom-modal-actions">
              <button class="dom-btn is-primary" id="dom-cellar-ok">${selected.size ? `${selected.size}枚捨てて引き直す` : '捨てずに続ける'}</button>
            </div>
          `);
          modalBoxEl.querySelectorAll('[data-idx]').forEach((b) => {
            const i = parseInt(b.getAttribute('data-idx'), 10);
            b.classList.toggle('is-selected', selected.has(i));
            b.onclick = () => {
              if (selected.has(i)) selected.delete(i);
              else selected.add(i);
              renderCellar();
            };
          });
          modalBoxEl.querySelector('#dom-cellar-ok').onclick = () => {
            const indices = Array.from(selected).sort((a, b) => b - a);
            indices.forEach((i) => {
              p.discard.push(p.hand.splice(i, 1)[0]);
            });
            if (indices.length > 0) drawCards(p, indices.length);
            closeModal();
            renderAll();
          };
        }
        renderCellar();
      }

      function openChapelModal(p) {
        const selected = new Set();
        function renderChapel() {
          openModal(`
            <div class="dom-modal-title">礼拝堂</div>
            <div class="dom-modal-sub">廃棄するカードを4枚まで選んでください（${selected.size} / 4）。屋敷や銅貨を減らすと山札がよく回ります。</div>
            <div class="dom-modal-chips">
              ${p.hand.map((cid, idx) => chip(cid, `data-idx="${idx}"`, selected.has(idx) ? '廃棄' : '')).join('')}
            </div>
            <div class="dom-modal-actions">
              <button class="dom-btn is-primary" id="dom-chapel-ok">${selected.size ? `${selected.size}枚を廃棄する` : '廃棄しない'}</button>
            </div>
          `);
          modalBoxEl.querySelectorAll('[data-idx]').forEach((b) => {
            const i = parseInt(b.getAttribute('data-idx'), 10);
            b.classList.toggle('is-selected', selected.has(i));
            b.onclick = () => {
              if (selected.has(i)) selected.delete(i);
              else if (selected.size < 4) selected.add(i);
              renderChapel();
            };
          });
          modalBoxEl.querySelector('#dom-chapel-ok').onclick = () => {
            const indices = Array.from(selected).sort((a, b) => b - a);
            indices.forEach((i) => {
              trashPile.push(p.hand.splice(i, 1)[0]);
            });
            closeModal();
            renderAll();
          };
        }
        renderChapel();
      }

      function openRemodelModal(p) {
        openModal(`
          <div class="dom-modal-title">改築</div>
          <div class="dom-modal-sub">廃棄するカードを1枚選んでください。そのコスト+2までのカードを獲得できます。</div>
          <div class="dom-modal-chips">
            ${p.hand.map((cid, idx) => chip(cid, `data-ridx="${idx}"`, `コスト${CARD_DB[cid].cost} → ${CARD_DB[cid].cost + 2}まで`)).join('')}
          </div>
        `);
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
              title: `改築: コスト${maxCost}以下のカードを1枚選んで獲得してください。`
            };
            logBannerText = pendingGain.title;
            renderAll();
          };
        });
      }

      function openMineModal(p) {
        const treasures = p.hand.map((cid, idx) => ({ cid, idx })).filter((x) => CARD_DB[x.cid].type === 'treasure');
        openModal(`
          <div class="dom-modal-title">鉱山</div>
          <div class="dom-modal-sub">廃棄する財宝を選んでください。コスト+3までの財宝を手札に獲得します。</div>
          <div class="dom-modal-chips">
            ${treasures.map((x) => chip(x.cid, `data-midx="${x.idx}"`, `→ コスト${CARD_DB[x.cid].cost + 3}まで`)).join('')}
          </div>
        `);
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
              title: `鉱山: コスト${maxCost}以下の財宝を1枚選んで手札に獲得してください。`
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
        if (winner.idx === mySeat) bridge.recordWin();
        const rows = ranked.map((p, i) => `
          <div class="dom-rank">
            <span class="dom-rank-pos">${i + 1}</span>
            <span class="dom-swatch" style="--c:${p.color}"></span>
            <div>
              <div>${p.name}</div>
              <div class="dom-rank-meta">カード ${getAllPlayerCards(p).length}枚 · 手番 ${p.turnsTaken}回</div>
            </div>
            <span class="dom-rank-vp">${calcPlayerVP(p)}<small>点</small></span>
          </div>
        `).join('');

        openModal(`
          <div class="dom-modal-title">${winner.idx === mySeat ? 'あなたの勝利' : `${winner.name}の勝利`}</div>
          <div class="dom-modal-sub">${(supply.province || 0) <= 0 ? '属州がなくなりました。' : 'サプライの山が3つなくなりました。'}</div>
          <div style="margin-top:12px;">${rows}</div>
          <div class="dom-modal-actions">
            <button class="dom-btn is-primary" id="dom-rematch-btn">もう一度遊ぶ</button>
          </div>
        `);
        modalBoxEl.querySelector('#dom-rematch-btn').onclick = () => initGame();
      }

      // ====================================================
      // 4. CPU (アクション連鎖 ＋ 財宝と属州を狙う買い方)
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

      function chooseCpuBuy() {
        if (coinsPool >= 8 && supply.province > 0) return 'province';
        if (coinsPool >= 6 && supply.gold > 0) return 'gold';
        if (coinsPool >= 5) {
          const lv5 = ['witch', 'market', 'laboratory', 'festival', 'mine'].filter((k) => supply[k] > 0);
          if (supply.province <= 4 && supply.duchy > 0) return 'duchy';
          if (lv5.length > 0) return lv5[Math.floor(Math.random() * lv5.length)];
          if (supply.duchy > 0) return 'duchy';
          return null;
        }
        if (coinsPool >= 4) {
          const lv4 = ['smithy', 'militia', 'moneylender', 'gardens'].filter((k) => supply[k] > 0);
          if (lv4.length > 0 && Math.random() < 0.65) return lv4[Math.floor(Math.random() * lv4.length)];
          if (supply.silver > 0) return 'silver';
          return null;
        }
        if (coinsPool >= 3) {
          const lv3 = ['village', 'workshop', 'woodcutter'].filter((k) => supply[k] > 0);
          if (supply.silver > 0 && Math.random() < 0.7) return 'silver';
          if (lv3.length > 0) return lv3[Math.floor(Math.random() * lv3.length)];
          return null;
        }
        if (coinsPool >= 2 && supply.province <= 3 && supply.estate > 0) return 'estate';
        return null;
      }

      // 1枚ずつ間をおいて進め、卓の上で何をしたか追えるようにする
      async function runCpuTurn() {
        const serial = turnSerial;
        const wait = (ms) => new Promise((resolve) => { cpuTimer = setTimeout(resolve, ms); });
        const alive = () => !isDestroyed && turnPhase !== 'GAME_OVER' && serial === turnSerial;
        const cpu = players[turnIndex];
        if (!cpu || !cpu.isCpu) return;

        await wait(750);

        // 1. アクション (+アクション系を優先)
        while (alive() && actionsLeft > 0 && turnPhase === 'ACTION') {
          const actIndices = cpu.hand
            .map((cid, idx) => ({ cid, idx, card: CARD_DB[cid] }))
            .filter((x) => x.card.type.startsWith('action'));
          if (actIndices.length === 0) break;
          actIndices.sort((a, b) => (b.card.plusActions || 0) - (a.card.plusActions || 0));
          const before = cpu.playArea.length;
          playHandCardAt(cpu, actIndices[0].idx);
          if (cpu.playArea.length === before) break;
          await wait(800);
        }
        if (!alive()) return;

        // 2. 財宝
        if (cpu.hand.some((cid) => CARD_DB[cid].type === 'treasure')) {
          playAllTreasures(cpu);
          await wait(700);
        } else {
          turnPhase = 'BUY';
        }

        // 3. 購入
        while (alive() && buysLeft > 0) {
          const buyTarget = chooseCpuBuy();
          if (!buyTarget) break;
          buysLeft--;
          coinsPool -= CARD_DB[buyTarget].cost;
          supply[buyTarget]--;
          cpu.discard.push(buyTarget);
          DomSfx.buy();
          logBannerText = `${cpu.name}が${CARD_DB[buyTarget].name}を買いました。`;
          if (isGameOverConditionMet()) {
            finishGame();
            return;
          }
          renderAll();
          await wait(650);
        }
        if (!alive()) return;

        await wait(700);
        if (alive()) endCleanUpTurn();
      }

      // ====================================================
      // 5. 3D の卓 (共通エンジンのステージにカードを並べる)
      // ====================================================
      const B3D = window.BoardArena3D;
      const CW = 0.92;   // カードの幅
      const CD = 1.29;   // カードの長さ
      const CT = 0.012;  // カードの厚み
      const PILE_STEP = 0.0065; // 山札 1 枚あたりの高さ

      const BASE_ROW_Z = -3.7;
      const KINGDOM_ROW_Z = [-1.95, -0.3];
      const DECK_POS = { x: -5.45, z: 1.5 };
      const DISCARD_POS = { x: -4.2, z: 1.5 };
      const TRASH_POS = { x: 5.25, z: -1.12 };
      const PLAY_ROW = { x0: -2.55, z: 1.4, step: 0.66 };
      const HAND_ROW = { z: 3.3, y: 0.55, tilt: 0.86 };
      const FAR_POS = { x: 0, y: 2.6, z: -8 };

      let THREE = null;
      let st = null;
      const view = {
        gameKey: -1,
        cards: null,      // 手札・場札・飛んでいるカード
        piles: new Map(), // サプライ
        deck: null,
        discard: null,
        trash: null,
        labels: [],
        hand: [],         // [{ cardId, obj }] (自分の手札と同じ並び)
        play: [],         // [{ cardId, obj }] (手番プレイヤーの場札)
        playKey: -1,
        playOwner: -1,
        lastSerial: -1,
        lastActive: -1,
        trashLen: 0,
        myDiscardLen: 0,
        glow: null,
        previewId: null
      };

      const geoC = (key, make) => st.geo.cached(key, make);

      function faceGeo() {
        return geoC('dom-face', () => {
          const g = new THREE.ShapeGeometry(st.geo.roundedRectShape(CW, CD, 0.055), 6);
          const uv = g.attributes.uv;
          const pos = g.attributes.position;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (pos.getY(i) + CD / 2) / CD);
          g.rotateX(-Math.PI / 2);
          return g;
        });
      }

      // 置ける・買えるカードを囲む細い枠
      function outlineGeo(w, d) {
        return geoC(`dom-outline:${w}:${d}`, () => {
          const shape = st.geo.roundedRectShape(w + 0.09, d + 0.09, 0.09);
          shape.holes.push(st.geo.roundedRectShape(w + 0.02, d + 0.02, 0.065));
          return new THREE.ShapeGeometry(shape, 6).rotateX(-Math.PI / 2);
        });
      }

      const edgeMat = () => st.kit.matte('#e6dcc3', { roughness: 0.85 });
      const faceMat = (id) => st.kit.cached(`dom-face:${id}`, () => new THREE.MeshStandardMaterial({
        map: st.kit.texture(cardCanvas(B3D, id)), roughness: 0.62, metalness: 0, envMapIntensity: 0.4
      }));
      const emptyMat = (id) => st.kit.cached(`dom-empty:${id}`, () => new THREE.MeshStandardMaterial({
        map: st.kit.texture(cardCanvas(B3D, id)), color: st.kit.color('#4a4540'), roughness: 0.9, transparent: true, opacity: 0.55, envMapIntensity: 0.2
      }));
      const backMat = () => st.kit.cached('dom-back', () => new THREE.MeshStandardMaterial({
        map: st.kit.texture(cardBackCanvas(B3D)), roughness: 0.55, metalness: 0, envMapIntensity: 0.45
      }));

      // ---- 1枚のカード ----
      function makeCard(id) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(geoC('dom-card-body', () => st.geo.slab(CW, CD, CT, { bevel: 0.003, radius: 0.055 })), edgeMat());
        body.castShadow = true;
        body.receiveShadow = true;
        const front = new THREE.Mesh(faceGeo(), faceMat(id));
        front.position.y = CT / 2 + 0.0006;
        const back = new THREE.Mesh(faceGeo(), backMat());
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
        return g;
      }

      // ---- 山 (サプライ・山札・捨て札・廃棄) ----
      function makePile(x, z, capMat, labelText) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        const body = new THREE.Mesh(
          geoC('dom-pile-body', () => st.geo.slab(CW * 0.99, CD * 0.99, 1, { bevel: 0.002, radius: 0.055, bevelSegments: 1 }).translate(0, 0.5, 0)),
          edgeMat()
        );
        body.castShadow = true;
        body.receiveShadow = true;
        const cap = new THREE.Mesh(faceGeo(), capMat);
        const shadow = st.markers.contact(CW * 1.45, CD * 1.35, 0.42);
        shadow.position.y = 0.002;
        const ring = new THREE.Mesh(outlineGeo(CW, CD), view.glow);
        ring.position.y = 0.004;
        ring.renderOrder = 3;
        ring.visible = false;
        // 空になった場所を示す淡い枠
        const slot = new THREE.Mesh(outlineGeo(CW, CD), st.kit.ghost('#d8c9a6', 0.18));
        slot.position.y = 0.003;
        slot.renderOrder = 2;
        slot.visible = false;
        group.add(shadow, slot, ring, body, cap);
        st.root.add(group);

        const label = st.label('', { className: 'dom-count' });
        label.at(x, 0.02, z + CD / 2 + 0.2);
        view.labels.push(label);
        let zoneLabel = null;
        if (labelText) {
          zoneLabel = st.label(labelText, { className: 'dom-zone' });
          zoneLabel.at(x, 0.02, z - CD / 2 - 0.2);
          view.labels.push(zoneLabel);
        }

        const pile = {
          x,
          z,
          group,
          ring,
          count: -1,
          height: 0,
          set(count, mat, text) {
            pile.count = count;
            pile.height = count > 0 ? Math.max(CT, Math.min(count, 60) * PILE_STEP) : 0;
            body.visible = count > 0;
            shadow.visible = count > 0;
            slot.visible = count === 0;
            body.scale.y = Math.max(0.0001, pile.height);
            cap.position.y = pile.height + 0.0008;
            if (mat) cap.material = mat;
            cap.visible = !!mat;
            label.set(text !== undefined ? text : String(count));
            label.el.classList.toggle('is-empty', count === 0);
          }
        };
        return pile;
      }

      function supplyPos(id) {
        const b = BASE_KEYS.indexOf(id);
        if (b >= 0) return { x: -4.5 + b * 1.5, z: BASE_ROW_Z };
        const k = kingdomKeys.indexOf(id);
        return { x: -3 + (k % 5) * 1.5, z: KINGDOM_ROW_Z[Math.floor(k / 5)] };
      }

      // ---- 手札・場札の配置 ----
      function handSlot(i, n) {
        const spacing = Math.min(1.0, 8.6 / Math.max(1, n));
        const t = i - (n - 1) / 2;
        return {
          x: t * spacing,
          y: HAND_ROW.y - Math.abs(t) * 0.015 + i * 0.002,
          z: HAND_ROW.z + Math.abs(t) * 0.025 + i * 0.004,
          rx: HAND_ROW.tilt,
          ry: -t * 0.03,
          rz: 0
        };
      }

      function playSlot(i) {
        return { x: PLAY_ROW.x0 + i * PLAY_ROW.step, y: CT / 2 + i * 0.0035, z: PLAY_ROW.z, rx: 0, ry: 0, rz: 0 };
      }

      function moveTo(obj, slot, o = {}) {
        const h = obj.userData.home;
        if (h && !o.force && h.x === slot.x && h.y === slot.y && h.z === slot.z && h.rx === slot.rx && h.ry === slot.ry) return;
        obj.userData.home = slot;
        st.animate(obj, {
          position: { x: slot.x, y: slot.y, z: slot.z },
          rotation: { x: slot.rx, y: slot.ry, z: slot.rz || 0 },
          scale: 1
        }, { duration: o.duration || 440, delay: o.delay || 0, arc: o.arc || 0, ease: o.ease || 'outCubic' });
      }

      function spawnCard(id, from, faceDown) {
        const obj = makeCard(id);
        obj.position.set(from.x, from.y, from.z);
        obj.rotation.set(0, 0, faceDown ? Math.PI : 0);
        bindCard(obj);
        return obj;
      }

      function flyAway(obj, to, o = {}) {
        obj.userData.zone = 'fly';
        obj.userData.glow.visible = false;
        st.animate(obj, {
          position: { x: to.x, y: to.y, z: to.z },
          rotation: { x: 0, y: 0, z: 0 },
          scale: o.shrink ? 0.6 : 1
        }, {
          duration: o.duration || 460,
          delay: o.delay || 0,
          arc: o.arc ?? 0.8,
          ease: 'inOutCubic',
          complete: () => st.removeObject(obj)
        });
      }

      const discardTarget = () => ({ x: DISCARD_POS.x, y: (view.discard ? view.discard.height : 0) + CT, z: DISCARD_POS.z });
      const trashTarget = () => ({ x: TRASH_POS.x, y: (view.trash ? view.trash.height : 0) + CT, z: TRASH_POS.z });
      const deckSource = () => ({ x: DECK_POS.x, y: (view.deck ? view.deck.height : 0) + CT, z: DECK_POS.z });

      // ---- 操作 ----
      function isMyTurn() {
        const p = players[turnIndex];
        return p && !p.isCpu && turnPhase !== 'GAME_OVER' && !modalOverlayEl.classList.contains('visible');
      }

      function canPlayHandCard(cid) {
        if (!isMyTurn() || pendingGain || turnIndex !== mySeat) return false;
        const c = CARD_DB[cid];
        return c.type === 'treasure' || (c.type.startsWith('action') && turnPhase === 'ACTION' && actionsLeft > 0);
      }

      function canSelectSupplyCard(cid) {
        if (!isMyTurn() || (supply[cid] || 0) <= 0) return false;
        const p = players[turnIndex];
        const c = CARD_DB[cid];
        if (pendingGain) {
          if (c.cost > pendingGain.maxCost) return false;
          if (pendingGain.filterType && c.type !== pendingGain.filterType) return false;
          return true;
        }
        if (cid === 'curse') return false;
        const potentialCoins = coinsPool + p.hand.reduce((s, x) => s + (CARD_DB[x].type === 'treasure' ? CARD_DB[x].coins : 0), 0);
        return buysLeft > 0 && potentialCoins >= c.cost;
      }

      function showPreview(id) {
        if (!id) return;
        if (view.previewId !== id) {
          const ctx = previewCanvas.getContext('2d');
          ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          ctx.drawImage(cardCanvas(B3D, id), 0, 0);
          view.previewId = id;
        }
        previewEl.classList.add('is-visible');
      }

      function hidePreview() {
        previewEl.classList.remove('is-visible');
      }

      function bindCard(obj) {
        st.pick(obj, {
          enabled: () => obj.userData.zone !== 'fly',
          clickable: () => obj.userData.zone === 'hand' && canPlayHandCard(obj.userData.cardId),
          onHover: () => {
            showPreview(obj.userData.cardId);
            const h = obj.userData.home;
            if (obj.userData.zone === 'hand' && h) {
              st.animate(obj, { position: { x: h.x, y: h.y + 0.28, z: h.z - 0.12 }, scale: 1.06 }, { duration: 160 });
            }
          },
          onLeave: () => {
            hidePreview();
            const h = obj.userData.home;
            if (obj.userData.zone === 'hand' && h) {
              st.animate(obj, { position: { x: h.x, y: h.y, z: h.z }, scale: 1 }, { duration: 200 });
            }
          },
          onClick: () => {
            if (obj.userData.zone !== 'hand') return;
            const me = players[mySeat];
            const idx = view.hand.findIndex((e) => e.obj === obj);
            if (me && idx >= 0 && canPlayHandCard(obj.userData.cardId)) {
              hidePreview();
              playHandCardAt(me, idx);
            }
          }
        });
      }

      function bindPile(pile, id) {
        st.pick(pile.group, {
          clickable: () => canSelectSupplyCard(id),
          onHover: () => {
            showPreview(id);
            st.animate(pile.group, { position: { y: 0.07 } }, { duration: 160 });
          },
          onLeave: () => {
            hidePreview();
            st.animate(pile.group, { position: { y: 0 } }, { duration: 200 });
          },
          onClick: () => {
            if (canSelectSupplyCard(id)) handleSupplyPileClick(id);
          }
        });
      }

      // ---- 卓の組み立て ----
      function buildTable() {
        const mat = new THREE.Mesh(
          st.geo.slab(15.2, 11.4, 0.06, { bevel: 0.02, radius: 0.35 }),
          st.kit.felt('#2b3b33', { repeat: 0.5 })
        );
        mat.position.set(0, -0.03, -0.25);
        mat.receiveShadow = true;
        st.root.add(mat);
        // 卓の縁に沿った細い線 (サプライと自分の場の境目)
        const line = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 0.012).rotateX(-Math.PI / 2), st.kit.ghost('#d8c9a6', 0.22));
        line.position.set(0, 0.002, 0.6);
        st.root.add(line);
      }

      function resetTable() {
        view.gameKey = gameSerial;
        hidePreview();
        st.clearGroup(view.cards);
        view.piles.forEach((p) => st.removeObject(p.group));
        view.piles.clear();
        [view.deck, view.discard, view.trash].forEach((p) => { if (p) st.removeObject(p.group); });
        view.labels.forEach((lb) => lb.remove());
        view.labels = [];
        view.hand = [];
        view.play = [];
        view.playKey = -1;
        view.playOwner = -1;
        view.lastSerial = -1;
        view.lastActive = -1;
        view.trashLen = 0;

        [...BASE_KEYS, ...kingdomKeys].forEach((id, i) => {
          const pos = supplyPos(id);
          const pile = makePile(pos.x, pos.z, faceMat(id));
          pile.set(supply[id] || 0, faceMat(id));
          bindPile(pile, id);
          view.piles.set(id, pile);
          // 山が置かれていく導入
          pile.group.position.y = 1.2;
          st.animate(pile.group, { position: { y: 0 } }, { duration: 420, delay: 80 + i * 40, ease: 'outCubic' });
        });

        view.deck = makePile(DECK_POS.x, DECK_POS.z, backMat(), '山札');
        view.discard = makePile(DISCARD_POS.x, DISCARD_POS.z, null, '捨て札');
        view.trash = makePile(TRASH_POS.x, TRASH_POS.z, null, '廃棄');
        st.pick(view.discard.group, {
          onHover: () => { const me = players[mySeat]; if (me && me.discard.length) showPreview(me.discard[me.discard.length - 1]); },
          onLeave: hidePreview
        });
        st.pick(view.trash.group, {
          onHover: () => { if (trashPile.length) showPreview(trashPile[trashPile.length - 1]); },
          onLeave: hidePreview
        });

        const me = players[mySeat] || players[0];
        view.myDiscardLen = me ? me.discard.length : 0;
      }

      // ---- 同期 ----
      function syncSupply() {
        const gains = [];
        view.piles.forEach((pile, id) => {
          const n = supply[id] || 0;
          const prev = pile.count;
          if (n !== prev) pile.set(n, n > 0 ? faceMat(id) : emptyMat(id));
          for (let k = 0; k < prev - n; k++) gains.push({ id, x: pile.x, y: pile.height + CT, z: pile.z });
        });
        return gains;
      }

      function syncHand(me, gains) {
        const fresh = view.lastActive === mySeat && view.lastSerial !== turnSerial;
        let old = view.hand;
        const released = [];
        if (fresh) {
          released.push(...old);
          old = [];
        }
        const used = new Array(old.length).fill(false);
        let drawOrder = 0;
        const next = me.hand.map((id) => {
          const j = old.findIndex((o, k) => !used[k] && o.cardId === id);
          if (j >= 0) {
            used[j] = true;
            return old[j];
          }
          const gi = gains.findIndex((g) => g.id === id);
          let obj;
          if (gi >= 0) {
            const g = gains.splice(gi, 1)[0];
            obj = spawnCard(id, g, false);
          } else {
            obj = spawnCard(id, deckSource(), true);
          }
          obj.userData.drawOrder = drawOrder++;
          return { cardId: id, obj };
        });
        old.forEach((o, k) => { if (!used[k]) released.push(o); });
        view.hand = next;
        next.forEach((e, i) => {
          e.obj.userData.zone = 'hand';
          const delay = e.obj.userData.drawOrder !== undefined ? 120 + e.obj.userData.drawOrder * 90 : 0;
          delete e.obj.userData.drawOrder;
          moveTo(e.obj, handSlot(i, next.length), { delay, arc: delay ? 0.5 : 0 });
        });
        return released;
      }

      function syncPlay(active, released) {
        if (view.playKey !== turnSerial) {
          // 前の手番の場札を片付ける (自分なら捨て札へ、相手なら卓の奥へ)
          const mine = view.playOwner === mySeat;
          view.play.forEach((e, i) => flyAway(e.obj, mine ? discardTarget() : FAR_POS, { delay: i * 40, shrink: !mine }));
          view.play = [];
          view.playKey = turnSerial;
          view.playOwner = active ? active.idx : -1;
        }
        const area = active ? active.playArea : [];
        for (let i = view.play.length; i < area.length; i++) {
          const id = area[i];
          let obj = null;
          if (active.idx === mySeat) {
            const j = released.findIndex((o) => o.cardId === id);
            if (j >= 0) obj = released.splice(j, 1)[0].obj;
          }
          if (!obj) obj = spawnCard(id, active.idx === mySeat ? deckSource() : FAR_POS, false);
          obj.userData.zone = 'play';
          obj.userData.glow.visible = false;
          view.play.push({ cardId: id, obj });
          moveTo(obj, playSlot(i), { arc: 0.5, duration: 480 });
        }
      }

      function syncPiles(me, trashNew, released, gains, discardNew) {
        // 手札から離れたカード: 廃棄されたものは廃棄の山へ、それ以外は捨て札へ
        released.forEach((o, i) => {
          const k = trashNew.indexOf(o.cardId);
          if (k >= 0) {
            trashNew.splice(k, 1);
            flyAway(o.obj, trashTarget(), { delay: i * 50 });
          } else {
            flyAway(o.obj, discardTarget(), { delay: i * 50 });
          }
        });
        // サプライから獲得されたカード: 自分の捨て札に入ったものはそこへ、他は卓の奥へ
        gains.forEach((g, i) => {
          const obj = spawnCard(g.id, g, false);
          obj.userData.zone = 'fly';
          const k = discardNew.indexOf(g.id);
          if (k >= 0) {
            discardNew.splice(k, 1);
            flyAway(obj, discardTarget(), { delay: 60 + i * 80, arc: 1.1, duration: 560 });
          } else {
            flyAway(obj, FAR_POS, { delay: 60 + i * 80, arc: 0.6, duration: 620, shrink: true });
          }
        });

        view.deck.set(me.deck.length, me.deck.length ? backMat() : null);
        const top = me.discard[me.discard.length - 1];
        view.discard.set(me.discard.length, top ? faceMat(top) : null);
        const trashTop = trashPile[trashPile.length - 1];
        view.trash.set(trashPile.length, trashTop ? faceMat(trashTop) : null);
      }

      function refreshHighlights() {
        view.hand.forEach((e) => { e.obj.userData.glow.visible = canPlayHandCard(e.cardId); });
        view.piles.forEach((pile, id) => { pile.ring.visible = canSelectSupplyCard(id); });
        st.refreshHover();
      }

      function syncTable() {
        if (!st) return;
        if (view.gameKey !== gameSerial) resetTable();
        const me = players[mySeat] || players[0];
        const active = players[turnIndex];
        if (!me) return;

        const gains = syncSupply();
        const trashNew = trashPile.slice(view.trashLen);
        view.trashLen = trashPile.length;
        const discardNew = me.discard.length >= view.myDiscardLen ? me.discard.slice(view.myDiscardLen) : me.discard.slice();
        view.myDiscardLen = me.discard.length;

        const released = syncHand(me, gains);
        syncPlay(active, released);
        syncPiles(me, trashNew, released, gains, discardNew);
        refreshHighlights();

        view.lastSerial = turnSerial;
        view.lastActive = turnIndex;
      }

      function initStage(threeLib) {
        THREE = threeLib;
        st = B3D.createStage(THREE, stageWrapEl, {
          embed: true,
          radius: 13,
          phi: 0.72,
          lookY: 0,
          extent: 7.5,
          tableY: -0.06,
          tableWood: 'darkWalnut',
          minRadius: 7,
          maxRadius: 24,
          maxPhi: 1.15,
          onFrame(now) {
            if (view.glow) view.glow.opacity = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(now / 260));
          }
        });
        view.glow = st.kit.cached('dom-glow', () => new THREE.MeshBasicMaterial({
          color: st.kit.color('#e2b867'), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false
        }));
        view.cards = new THREE.Group();
        st.root.add(view.cards);
        buildTable();
        B3D.current = st;
      }

      // ====================================================
      // 6. 操作パネル
      // ====================================================
      function renderAll() {
        const me = players[mySeat] || players[0];
        const activeP = players[turnIndex];
        const myTurn = activeP && !activeP.isCpu && turnPhase !== 'GAME_OVER';

        // 1. プレイヤー
        playersRowEl.innerHTML = players.map((p) => {
          const isTurn = p.idx === turnIndex && turnPhase !== 'GAME_OVER';
          return `
            <div class="dom-player ${isTurn ? 'is-turn' : ''}">
              <span class="dom-swatch" style="--c:${p.color}"></span>
              <div>
                <div class="dom-player-name"><span>${p.name}</span><span class="dom-player-vp">${calcPlayerVP(p)}<small>点</small></span></div>
                <div class="dom-player-sub">山札 ${p.deck.length} · 手札 ${p.hand.length} · 捨て札 ${p.discard.length}</div>
              </div>
            </div>
          `;
        }).join('');

        // 2. 状況と手番の残り
        bannerEl.textContent = logBannerText;
        statActEl.textContent = actionsLeft;
        statBuyEl.textContent = buysLeft;
        statCoinEl.textContent = coinsPool;

        // 3. 手札と操作
        if (me) {
          handStripEl.innerHTML = `<span class="dom-hand-label">手札</span>` + me.hand.map((cid, idx) => {
            const c = CARD_DB[cid];
            const playable = myTurn && turnIndex === mySeat && !pendingGain && (c.type === 'treasure' || (c.type.startsWith('action') && turnPhase === 'ACTION' && actionsLeft > 0));
            return `<button class="dom-chip" data-hidx="${idx}" style="--c:${kindColor(cid)}" title="${c.desc}" ${playable ? '' : 'disabled'}>${c.name}</button>`;
          }).join('');
          handStripEl.querySelectorAll('[data-hidx]').forEach((el) => {
            el.onclick = () => playHandCardAt(me, parseInt(el.getAttribute('data-hidx'), 10));
            el.onmouseenter = () => showPreview(me.hand[parseInt(el.getAttribute('data-hidx'), 10)]);
            el.onmouseleave = hidePreview;
          });
        }

        if (turnPhase === 'GAME_OVER') {
          actionBtnsEl.innerHTML = `<button class="dom-btn" id="dom-again-btn">もう一度遊ぶ</button>`;
          actionBtnsEl.querySelector('#dom-again-btn').onclick = () => initGame();
        } else if (!myTurn) {
          actionBtnsEl.innerHTML = `<span class="dom-wait">${activeP ? activeP.name : ''}の手番です</span>`;
        } else if (pendingGain) {
          actionBtnsEl.innerHTML = `<span class="dom-prompt">光っているサプライのカードを選んでください</span>`;
        } else {
          const hasTreasuresInHand = activeP.hand.some((cid) => CARD_DB[cid].type === 'treasure');
          actionBtnsEl.innerHTML = `
            <button class="dom-btn" id="dom-play-all-tr" ${hasTreasuresInHand ? '' : 'disabled'}>財宝をまとめて出す</button>
            <button class="dom-btn is-primary" id="dom-end-turn-btn">手番を終える</button>
          `;
          const trBtn = actionBtnsEl.querySelector('#dom-play-all-tr');
          if (trBtn && hasTreasuresInHand) trBtn.onclick = () => playAllTreasures(activeP);
          actionBtnsEl.querySelector('#dom-end-turn-btn').onclick = () => endCleanUpTurn();
        }

        syncTable();
      }

      presetSelEl.onchange = () => initGame();
      pcountSelEl.onchange = () => initGame();
      newBtnEl.onclick = () => initGame();

      B3D.ensureThree().then((threeLib) => {
        if (isDestroyed || !threeLib) return;
        initStage(threeLib);
        initGame();
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
