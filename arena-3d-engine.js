/**
 * BOARD ARENA - 3D テーブルトップ・エンジン (arena-3d-engine.js)
 *
 * 2D盤面を持つゲームの DOM を読み取り、Three.js (r128) の卓上シーンとして描き直す共通基盤。
 * - 写実寄りの卓上ステージ: スタジオ環境光の映り込み、スポットライトの柔らかい影、木目の天板
 * - 木目・フェルト・紙などの手続き的テクスチャと、面取り付きの盤・駒ジオメトリ
 * - 慣性付きカメラ (ドラッグで回転、ホイール／ピンチで拡大、視点切替) と導入カメラワーク
 * - ホバー／クリックを 2D 盤面のマスへ転送するポインタ処理
 * - 盤上の数値などを DOM で重ねるラベル
 *
 * 各ゲームの3D表示は games3d/*.js が BoardArena3D.registerAdapter(id, mount) で登録する。
 * mount(THREE, container, api) は { st, sync } を返し、2D盤面の DOM が変わるたびに sync() が呼ばれる。
 */

(function () {
  const adapters = {};

  // ==========================================
  // 1. Three.js / GLTFLoader の読み込み
  // ==========================================
  // GLTFLoader は独自3D実装のゲーム (カタン等) が window.THREE.GLTFLoader として使う
  let threePromise = null;

  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function ensureThree() {
    if (threePromise) return threePromise;
    threePromise = (async () => {
      if (!window.THREE) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      }
      if (window.THREE && !window.THREE.GLTFLoader) {
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
      }
      return window.THREE || null;
    })();
    return threePromise;
  }

  // ==========================================
  // 2. 共通ユーティリティ
  // ==========================================
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const EASE = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c1 = 1.4;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    // 落下して軽く弾む (弾みは控えめ)
    outBounce: (t) => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return 1 - 0.35 * (1 - (n1 * (t -= 1.5 / d1) * t + 0.75));
      if (t < 2.5 / d1) return 1 - 0.2 * (1 - (n1 * (t -= 2.25 / d1) * t + 0.9375));
      return 1 - 0.1 * (1 - (n1 * (t -= 2.625 / d1) * t + 0.984375));
    }
  };

  // ==========================================
  // 3. 手続き的テクスチャ (canvas)
  // ==========================================
  const WOODS = {
    walnut:     { base: '#4b3123', dark: '#24150d', light: '#6e4b35' },
    darkWalnut: { base: '#2c1d15', dark: '#120b07', light: '#46301f' },
    maple:      { base: '#d2b085', dark: '#a8835a', light: '#e8cda5' },
    kaya:       { base: '#c8975a', dark: '#9c6d3a', light: '#ddb47a' },
    oak:        { base: '#9a734d', dark: '#6d4e32', light: '#b9946b' },
    cherry:     { base: '#7a3f28', dark: '#4a2214', light: '#9a5a3d' }
  };

  const canvasCache = new Map();

  function cachedCanvas(key, w, h, paint) {
    if (!canvasCache.has(key)) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      paint(c.getContext('2d'), w, h);
      canvasCache.set(key, c);
    }
    return canvasCache.get(key);
  }

  // 木目を矩形領域に描く (vertical=true で木目を縦向きに)
  function paintWood(ctx, x, y, w, h, wood, seed, vertical) {
    const rng = mulberry32(seed);
    const len = vertical ? h : w;
    const across = vertical ? w : h;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    if (vertical) {
      ctx.translate(w, 0);
      ctx.rotate(Math.PI / 2);
    }

    ctx.fillStyle = wood.base;
    ctx.fillRect(0, 0, len, across);

    // 色むらの帯
    for (let i = 0; i < 7; i++) {
      const y0 = rng() * across;
      const bw = across * (0.05 + rng() * 0.18);
      ctx.globalAlpha = 0.06 + rng() * 0.1;
      ctx.fillStyle = rng() < 0.5 ? wood.dark : wood.light;
      ctx.fillRect(0, y0, len, bw);
    }

    // 木目の線
    const lines = Math.round(across / 2.6);
    for (let i = 0; i < lines; i++) {
      const y0 = rng() * across;
      const amp = 1.5 + rng() * 7;
      const freq = ((0.6 + rng() * 1.6) * Math.PI * 2) / len;
      const ph = rng() * Math.PI * 2;
      ctx.beginPath();
      for (let xx = -8; xx <= len + 8; xx += 6) {
        const yy = y0 + Math.sin(xx * freq + ph) * amp + Math.sin(xx * freq * 3.3 + ph * 1.7) * amp * 0.22;
        if (xx === -8) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.globalAlpha = 0.04 + rng() * 0.16;
      ctx.strokeStyle = rng() < 0.72 ? wood.dark : wood.light;
      ctx.lineWidth = 0.5 + rng() * 2.4;
      ctx.stroke();
    }

    // 導管
    ctx.fillStyle = wood.dark;
    const pores = Math.round((len * across) / 700);
    for (let i = 0; i < pores; i++) {
      ctx.globalAlpha = 0.12 + rng() * 0.2;
      ctx.fillRect(rng() * len, rng() * across, 1.5 + rng() * 6, 0.7);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function woodCanvas(species, seed = 7, vertical = false) {
    const wood = WOODS[species] || WOODS.walnut;
    return cachedCanvas(`wood:${species}:${seed}:${vertical}`, 1024, 1024, (ctx, w, h) => {
      paintWood(ctx, 0, 0, w, h, wood, seed, vertical);
    });
  }

  // フェルト・革などの細かいノイズ地
  function paintNoise(ctx, w, h, color, amount, seed, fibers) {
    const rng = mulberry32(seed);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rng() - 0.5) * amount;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    if (fibers) {
      for (let i = 0; i < fibers; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const a = rng() * Math.PI;
        const l = 2 + rng() * 6;
        ctx.globalAlpha = 0.05 + rng() * 0.07;
        ctx.strokeStyle = rng() < 0.5 ? '#000' : '#fff';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function feltCanvas(color, seed = 3) {
    return cachedCanvas(`felt:${color}:${seed}`, 512, 512, (ctx, w, h) => {
      paintNoise(ctx, w, h, color, 16, seed, 2600);
    });
  }

  function grainCanvas(color, amount = 10, seed = 5) {
    return cachedCanvas(`grain:${color}:${amount}:${seed}`, 512, 512, (ctx, w, h) => {
      paintNoise(ctx, w, h, color, amount, seed, 0);
    });
  }

  // 駒の真下に落とす接地影
  function contactShadowCanvas() {
    return cachedCanvas('contact-shadow', 128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // 天板の周縁を背景へ溶かすための円形アルファ
  function radialFadeCanvas() {
    return cachedCanvas('radial-fade', 512, 512, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.42, '#fff');
      g.addColorStop(1, '#000');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // ==========================================
  // 4. ジオメトリ
  // ==========================================
  function roundedRectShape(THREE, w, h, r, cx = 0, cy = 0) {
    const s = new THREE.Shape();
    const x = cx - w / 2;
    const y = cy - h / 2;
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    if (rr <= 0.0001) {
      s.moveTo(x, y);
      s.lineTo(x + w, y);
      s.lineTo(x + w, y + h);
      s.lineTo(x, y + h);
      s.lineTo(x, y);
      return s;
    }
    s.moveTo(x + rr, y);
    s.lineTo(x + w - rr, y);
    s.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - rr);
    s.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
    s.lineTo(x + rr, y + h);
    s.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + rr);
    s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  function circlePath(THREE, x, y, r) {
    const p = new THREE.Path();
    p.absarc(x, y, r, 0, Math.PI * 2, true);
    return p;
  }

  function ellipsePath(THREE, x, y, rx, ry) {
    const p = new THREE.Path();
    p.absellipse(x, y, rx, ry, 0, Math.PI * 2, true);
    return p;
  }

  // 面取り付きの板 (幅 w × 奥行 d × 厚み h)。y は -h/2..h/2。
  // holes は Shape 座標 (x, y) で渡す。ワールドでは z = -y になる。
  function slabGeometry(THREE, w, d, h, opts = {}) {
    const bevel = Math.min(opts.bevel ?? Math.min(w, d, h) * 0.12, h * 0.45);
    const radius = opts.radius ?? bevel * 1.5;
    const shape = opts.shape || roundedRectShape(THREE, w - bevel * 2, d - bevel * 2, Math.max(0.001, radius - bevel));
    (opts.holes || []).forEach((hole) => shape.holes.push(hole));
    const depth = Math.max(0.0005, h - bevel * 2);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: opts.bevelSegments ?? 4,
      curveSegments: opts.curveSegments ?? 12
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -depth / 2, 0);
    return g;
  }

  // 角の丸い直方体 (BoxGeometry の面グループと UV を保つので面ごとの材質が使える)
  function roundedBoxGeometry(THREE, width, height, depth, radius, segments = 3) {
    const seg = segments * 2 + 1;
    const r = Math.min(width / 2, height / 2, depth / 2, radius);
    const base = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
    const g = base.toNonIndexed();
    base.dispose();
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    const half = 0.5 / seg;
    const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(r);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.length; i += 3) {
      p.fromArray(pos, i);
      n.copy(p);
      n.x -= Math.sign(n.x) * half;
      n.y -= Math.sign(n.y) * half;
      n.z -= Math.sign(n.z) * half;
      n.normalize();
      pos[i] = box.x * Math.sign(p.x) + n.x * r;
      pos[i + 1] = box.y * Math.sign(p.y) + n.y * r;
      pos[i + 2] = box.z * Math.sign(p.z) + n.z * r;
      nor[i] = n.x;
      nor[i + 1] = n.y;
      nor[i + 2] = n.z;
    }

    // 丸めた後の位置から面ごとに UV を投影し直す (元の格子 UV だと平らな部分が中央の1マスに縮むため)
    // 面の並びは BoxGeometry と同じ +X, -X, +Y, -Y, +Z, -Z
    const uv = g.attributes.uv.array;
    const perFace = pos.length / 3 / 6;
    for (let v = 0; v < pos.length / 3; v++) {
      const x = pos[v * 3] / width;
      const y = pos[v * 3 + 1] / height;
      const z = pos[v * 3 + 2] / depth;
      const side = Math.floor(v / perFace);
      const uvPair = [
        [0.5 - z, 0.5 + y],
        [0.5 + z, 0.5 + y],
        [0.5 + x, 0.5 - z],
        [0.5 + x, 0.5 + z],
        [0.5 + x, 0.5 + y],
        [0.5 - x, 0.5 + y]
      ][side];
      uv[v * 2] = uvPair[0];
      uv[v * 2 + 1] = uvPair[1];
    }

    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    return g;
  }

  // 断面 [[半径, 高さ], ...] を回転させた回転体。底の中心 → 外周 → 上面の中心の順に渡す。
  function latheGeometry(THREE, points, segments = 48) {
    return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments);
  }

  // 円盤の断面 (半径 r、厚み h、角の丸み b)
  function discProfile(r, h, b, steps = 5) {
    const pts = [[0, -h / 2], [r - b, -h / 2]];
    for (let i = 1; i <= steps; i++) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / steps);
      pts.push([r - b + Math.cos(a) * b, -h / 2 + b + Math.sin(a) * b]);
    }
    pts.push([r, h / 2 - b]);
    for (let i = 1; i <= steps; i++) {
      const a = (Math.PI / 2) * (i / steps);
      pts.push([r - b + Math.cos(a) * b, h / 2 - b + Math.sin(a) * b]);
    }
    pts.push([0, h / 2]);
    return pts;
  }

  // 凸レンズ状の碁石の断面
  function lensProfile(r, h, steps = 20) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI;
      const s = Math.sin(t);
      const c = -Math.cos(t);
      pts.push([r * Math.pow(s, 0.62), (h / 2) * Math.sign(c) * Math.pow(Math.abs(c), 1.35)]);
    }
    return pts;
  }

  // ==========================================
  // 5. スタジオ環境光 (反射用の PMREM)
  // ==========================================
  function buildStudioEnvironment(THREE, renderer) {
    const env = new THREE.Scene();
    const disposables = [];
    const add = (geo, color, scalar, setup) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(scalar), side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      setup(mesh);
      env.add(mesh);
      disposables.push(geo, mat);
    };

    // 暗い部屋
    add(new THREE.BoxGeometry(24, 14, 24), '#1a1512', 0.35, (m) => {
      m.material.side = THREE.BackSide;
      m.position.y = 5;
    });
    // 天井の大きなソフトボックス
    add(new THREE.PlaneGeometry(9, 9), '#fff4e6', 2.6, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.y = 11.5;
    });
    // 左右の細長いストリップ
    add(new THREE.PlaneGeometry(2.2, 9), '#e6ecf4', 1.5, (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(-11.5, 4, 0);
    });
    add(new THREE.PlaneGeometry(2.2, 9), '#ffe2c4', 1.1, (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(11.5, 4, 2);
    });
    // 手前の弱い反射板
    add(new THREE.PlaneGeometry(12, 4), '#f2e6d8', 0.5, (m) => {
      m.position.set(0, 2, 11.5);
    });

    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(env, 0.035);
    pmrem.dispose();
    disposables.forEach((d) => d.dispose());
    return rt;
  }

  // ==========================================
  // 6. ステージ用 CSS
  // ==========================================
  function injectCSS() {
    if (document.getElementById('ba3d-css')) return;
    const style = document.createElement('style');
    style.id = 'ba3d-css';
    style.textContent = `
      .ba3d-stage {
        position: relative;
        width: 100%;
        height: clamp(420px, calc(100vh - 230px), 820px);
        border-radius: 6px;
        overflow: hidden;
        background: radial-gradient(120% 95% at 50% 32%, #2b221b 0%, #17120f 55%, #0b0908 100%);
        border: 1px solid rgba(255, 255, 255, 0.06);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
      }
      .ba3d-stage.is-compact { height: clamp(380px, calc(100vh - 280px), 720px); }
      .ba3d-stage.is-flat { height: 240px !important; min-height: 0; }
      .ba3d-stage canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
        cursor: grab;
        touch-action: none;
      }
      .ba3d-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 2;
      }
      .ba3d-label {
        position: absolute;
        left: 0;
        top: 0;
        padding: 3px 9px;
        border-radius: 3px;
        background: rgba(12, 10, 9, 0.66);
        color: #ecebe6;
        font: 500 12px/1.5 'Zen Kaku Gothic New', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
        letter-spacing: 0.04em;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        will-change: transform;
        transition: opacity 0.25s ease;
      }
      .ba3d-label.is-plain {
        padding: 0;
        background: none;
        color: rgba(236, 235, 230, 0.78);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      }
      .ba3d-label.is-strong {
        padding: 6px 14px;
        font-size: 14px;
        font-weight: 700;
      }
      .ba3d-label.is-hidden { opacity: 0; }
      .ba3d-hud {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 3;
        display: flex;
        gap: 6px;
      }
      .ba3d-stage.is-hud-left .ba3d-hud { right: auto; left: 12px; }
      .ba3d-btn {
        padding: 6px 12px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 4px;
        background: rgba(14, 12, 11, 0.55);
        color: rgba(236, 235, 230, 0.82);
        font: 500 12px/1.4 'Zen Kaku Gothic New', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
        letter-spacing: 0.04em;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: color 0.2s, border-color 0.2s, background 0.2s;
      }
      .ba3d-btn:hover { color: #fff; border-color: rgba(255, 255, 255, 0.34); }
      .ba3d-hint {
        position: absolute;
        left: 50%;
        bottom: 14px;
        z-index: 3;
        transform: translateX(-50%);
        color: rgba(236, 235, 230, 0.5);
        font: 400 12px/1.4 'Zen Kaku Gothic New', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
        letter-spacing: 0.08em;
        white-space: nowrap;
        pointer-events: none;
        transition: opacity 0.8s ease;
      }
      .ba3d-hint.is-hidden { opacity: 0; }
      .ba3d-hidden-2d { display: none !important; }
      .othello-wrapper, .gomoku-wrapper, .c4-wrapper, .chk-wrapper, .qrd-wrapper, .dab-wrapper,
      .blk-wrapper, .qto-wrapper, .yht-wrapper, .mcl-wrapper, .bs-wrapper, .pkr-wrapper, .cn-wrapper,
      .othello-main-area {
        width: 100% !important;
        max-width: 100% !important;
      }
      .othello-status-bar, .gomoku-status-bar, .c4-status-bar, .chk-status-bar, .qrd-header, .dab-header {
        width: 100% !important;
        max-width: 100% !important;
      }
      .blk-layout > .ba3d-stage, .qto-layout > .ba3d-stage {
        flex: 1 1 560px;
        min-width: 320px;
      }
      @media (max-width: 640px) {
        .ba3d-stage, .ba3d-stage.is-compact { height: min(64vh, 480px); }
        .ba3d-btn { padding: 5px 10px; font-size: 11px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ==========================================
  // 7. ステージ本体
  // ==========================================
  /**
   * opts:
   *   radius, phi, theta   既定のカメラ距離・仰角 (0=真上)・方位
   *   lookY                注視点の高さ
   *   minRadius, maxRadius ズーム範囲
   *   fov                  画角
   *   extent               盤の半径の目安 (ライトの範囲と影の範囲に使う)
   *   tableY               天板の高さ (false で天板なし)
   *   tableWood            天板の樹種
   *   compact, height      ステージの高さ
   *   hudLeft              視点ボタンを左上に置く (ゲーム側のボタンと重なる場合)
   */
  function createStage(THREE, targetEl, opts = {}) {
    injectCSS();

    const host = document.createElement('div');
    host.className = 'ba3d-stage' + (opts.compact ? ' is-compact' : '') + (opts.hudLeft ? ' is-hud-left' : '');
    if (opts.height) host.style.height = opts.height;

    const overlay = document.createElement('div');
    overlay.className = 'ba3d-overlay';
    host.appendChild(overlay);

    const hud = document.createElement('div');
    hud.className = 'ba3d-hud';
    const viewBtn = document.createElement('button');
    viewBtn.className = 'ba3d-btn';
    viewBtn.textContent = '真上から';
    const flatBtn = document.createElement('button');
    flatBtn.className = 'ba3d-btn';
    flatBtn.textContent = '2D表示';
    hud.append(viewBtn, flatBtn);
    host.appendChild(hud);

    const hint = document.createElement('div');
    hint.className = 'ba3d-hint';
    hint.textContent = 'ドラッグで回転　·　ホイールで拡大';
    host.appendChild(hint);

    targetEl.parentNode.insertBefore(host, targetEl);
    targetEl.classList.add('ba3d-hidden-2d');

    // ---- レンダラー ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure ?? 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.insertBefore(renderer.domElement, overlay);
    const canvas = renderer.domElement;
    const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;

    const scene = new THREE.Scene();
    const envRT = buildStudioEnvironment(THREE, renderer);
    scene.environment = envRT.texture;

    const root = new THREE.Group();
    scene.add(root);

    const camera = new THREE.PerspectiveCamera(opts.fov || 34, 1, 0.1, 200);

    // ---- ライティング ----
    // 主光源は斜め上からの平行光。影の範囲は盤の大きさ (extent) に合わせる。
    const extent = opts.extent || 5;
    const key = new THREE.DirectionalLight(0xfff0dc, opts.keyIntensity ?? 1.6);
    key.position.set(extent * 0.5, 16, extent * 0.9);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -extent * 1.5;
    sc.right = extent * 1.5;
    sc.top = extent * 1.5;
    sc.bottom = -extent * 1.5;
    sc.near = 4;
    sc.far = 40;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.03;
    scene.add(key, key.target);

    const fill = new THREE.HemisphereLight(0xf2e3cf, 0x1a120d, 0.15);
    scene.add(fill);

    // ---- 天板 ----
    const disposables = [envRT];
    const textures = [];

    function texture(canvasEl, o = {}) {
      const t = new THREE.CanvasTexture(canvasEl);
      if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = Math.min(maxAniso, 8);
      if (o.repeat) {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        const [rx, ry] = Array.isArray(o.repeat) ? o.repeat : [o.repeat, o.repeat];
        t.repeat.set(rx, ry);
      }
      if (o.offset) t.offset.set(o.offset[0], o.offset[1]);
      if (o.rotation) {
        t.center.set(0.5, 0.5);
        t.rotation = o.rotation;
      }
      textures.push(t);
      return t;
    }

    if (opts.tableY !== false) {
      const tableMat = new THREE.MeshStandardMaterial({
        map: texture(woodCanvas(opts.tableWood || 'darkWalnut', 11), { repeat: 5 }),
        bumpMap: texture(woodCanvas(opts.tableWood || 'darkWalnut', 11), { repeat: 5, srgb: false }),
        bumpScale: 0.004,
        alphaMap: texture(radialFadeCanvas(), { srgb: false }),
        transparent: true,
        roughness: 0.62,
        metalness: 0,
        envMapIntensity: 0.5
      });
      const table = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), tableMat);
      table.rotation.x = -Math.PI / 2;
      table.position.y = opts.tableY ?? -0.5;
      table.receiveShadow = true;
      scene.add(table);
    }

    // ---- 材質キット ----
    const matCache = new Map();
    const color = (hex) => new THREE.Color(hex).convertSRGBToLinear();

    function cached(keyName, make) {
      if (!matCache.has(keyName)) matCache.set(keyName, make());
      return matCache.get(keyName);
    }

    const kit = {
      color,
      texture,
      // 木: repeat はワールド単位あたりの繰り返し (Extrude の UV はワールド座標のため)
      wood(species, o = {}) {
        const seed = o.seed ?? 7;
        const rep = o.repeat ?? 0.12;
        return cached(`wood:${species}:${seed}:${rep}:${o.vertical}:${o.clearcoat}:${o.roughness}`, () => {
          const c = woodCanvas(species, seed, !!o.vertical);
          return new THREE.MeshPhysicalMaterial({
            map: texture(c, { repeat: rep }),
            bumpMap: texture(c, { repeat: rep, srgb: false }),
            bumpScale: 0.0035,
            roughness: o.roughness ?? 0.48,
            metalness: 0,
            clearcoat: o.clearcoat ?? 0.35,
            clearcoatRoughness: 0.32,
            envMapIntensity: 0.55
          });
        });
      },
      felt(hex, o = {}) {
        const rep = o.repeat ?? 0.35;
        return cached(`felt:${hex}:${rep}`, () => new THREE.MeshStandardMaterial({
          map: texture(feltCanvas(hex), { repeat: rep }),
          roughness: 0.96,
          metalness: 0,
          envMapIntensity: 0.35
        }));
      },
      lacquer(hex, o = {}) {
        return cached(`lacquer:${hex}:${o.roughness}:${o.clearcoat}`, () => new THREE.MeshPhysicalMaterial({
          color: color(hex),
          roughness: o.roughness ?? 0.32,
          metalness: 0,
          clearcoat: o.clearcoat ?? 0.7,
          clearcoatRoughness: 0.18,
          envMapIntensity: 0.9
        }));
      },
      matte(hex, o = {}) {
        return cached(`matte:${hex}:${o.roughness}`, () => new THREE.MeshStandardMaterial({
          color: color(hex),
          roughness: o.roughness ?? 0.72,
          metalness: 0,
          envMapIntensity: 0.6
        }));
      },
      metal(hex, o = {}) {
        return cached(`metal:${hex}:${o.roughness}`, () => new THREE.MeshStandardMaterial({
          color: color(hex),
          roughness: o.roughness ?? 0.32,
          metalness: 1,
          envMapIntensity: 1.1
        }));
      },
      grain(hex, o = {}) {
        const rep = o.repeat ?? 0.5;
        return cached(`grain:${hex}:${rep}:${o.roughness}`, () => new THREE.MeshStandardMaterial({
          map: texture(grainCanvas(hex, o.amount ?? 10), { repeat: rep }),
          roughness: o.roughness ?? 0.6,
          metalness: 0,
          envMapIntensity: 0.6
        }));
      },
      // 置ける場所などを示す半透明の印
      ghost(hex, opacity = 0.35) {
        return cached(`ghost:${hex}:${opacity}`, () => new THREE.MeshBasicMaterial({
          color: color(hex),
          transparent: true,
          opacity,
          depthWrite: false,
          toneMapped: false
        }));
      },
      ghostSolid(hex, opacity = 0.45) {
        return cached(`ghostSolid:${hex}:${opacity}`, () => new THREE.MeshStandardMaterial({
          color: color(hex),
          transparent: true,
          opacity,
          roughness: 0.4,
          depthWrite: false
        }));
      },
      invisible() {
        return cached('invisible', () => new THREE.MeshBasicMaterial({ visible: false }));
      }
    };

    // ---- 共通ジオメトリ ----
    const geoCache = new Map();
    const geo = {
      cached(keyName, make) {
        if (!geoCache.has(keyName)) geoCache.set(keyName, make());
        return geoCache.get(keyName);
      },
      slab: (w, d, h, o) => slabGeometry(THREE, w, d, h, o),
      roundedBox: (w, h, d, r, s) => roundedBoxGeometry(THREE, w, h, d, r, s),
      lathe: (pts, s) => latheGeometry(THREE, pts, s),
      disc: (r, h, b, s) => latheGeometry(THREE, discProfile(r, h, b), s || 48),
      lens: (r, h, s) => latheGeometry(THREE, lensProfile(r, h), s || 48),
      roundedRectShape: (w, h, r, cx, cy) => roundedRectShape(THREE, w, h, r, cx, cy),
      circlePath: (x, y, r) => circlePath(THREE, x, y, r),
      ellipsePath: (x, y, rx, ry) => ellipsePath(THREE, x, y, rx, ry)
    };

    // 盤上の印 (合法手・ホバー・選択)
    const markers = {
      dot(size = 0.13, hex = '#f4ede1', opacity = 0.42) {
        const m = new THREE.Mesh(geo.cached(`dot:${size}`, () => new THREE.CircleGeometry(size, 32).rotateX(-Math.PI / 2)), kit.ghost(hex, opacity));
        m.renderOrder = 2;
        return m;
      },
      ring(inner = 0.32, outer = 0.38, hex = '#f4ede1', opacity = 0.6) {
        const m = new THREE.Mesh(geo.cached(`ring:${inner}:${outer}`, () => new THREE.RingGeometry(inner, outer, 48).rotateX(-Math.PI / 2)), kit.ghost(hex, opacity));
        m.renderOrder = 2;
        return m;
      },
      square(size = 0.9, hex = '#f4ede1', opacity = 0.14) {
        const m = new THREE.Mesh(geo.cached(`square:${size}`, () => new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2)), kit.ghost(hex, opacity));
        m.renderOrder = 2;
        return m;
      },
      // 接地影 (幅 w × 奥行 d、省略時は円形)
      contact(w, d = w, opacity = 0.55) {
        const mat = cached(`contact:${opacity}`, () => new THREE.MeshBasicMaterial({
          map: texture(contactShadowCanvas(), { srgb: false }),
          transparent: true,
          opacity,
          depthWrite: false,
          toneMapped: false
        }));
        const m = new THREE.Mesh(geo.cached('contact-plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat);
        m.scale.set(w, 1, d);
        m.renderOrder = 1;
        return m;
      }
    };

    // ---- カメラ軌道 ----
    const def = {
      theta: opts.theta ?? 0,
      phi: opts.phi ?? 0.72,
      radius: opts.radius ?? 12
    };
    const lookY = opts.lookY ?? 0;
    const minRadius = opts.minRadius ?? def.radius * 0.55;
    const maxRadius = opts.maxRadius ?? def.radius * 1.7;
    const minPhi = opts.minPhi ?? 0.08;
    const maxPhi = opts.maxPhi ?? 1.32;

    // 少し引いた高い位置から定位置へ寄っていく導入
    const cam = { theta: def.theta + 0.55, phi: Math.max(minPhi, def.phi - 0.32), radius: def.radius * 1.45 };
    const target = { ...def };
    let damping = 0.035;
    const startTime = performance.now();
    let isTop = false;

    function setView(top) {
      isTop = top;
      viewBtn.textContent = top ? '斜めから' : '真上から';
      if (top) {
        target.theta = Math.round(target.theta / (Math.PI * 2)) * Math.PI * 2;
        target.phi = minPhi;
        target.radius = def.radius * 1.02;
      } else {
        target.theta = def.theta;
        target.phi = def.phi;
        target.radius = def.radius;
      }
    }
    viewBtn.addEventListener('click', () => setView(!isTop));

    let isFlat = false;
    flatBtn.addEventListener('click', () => {
      isFlat = !isFlat;
      targetEl.classList.toggle('ba3d-hidden-2d', !isFlat);
      host.classList.toggle('is-flat', isFlat);
      flatBtn.textContent = isFlat ? '3D表示' : '2D表示';
    });

    // ---- ポインタ ----
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pickables = [];
    const pointers = new Map();
    let dragging = false;
    let downAt = null;
    let pinch = null;
    let hovered = null;
    let lastPointer = null;

    function hideHint() {
      hint.classList.add('is-hidden');
    }
    setTimeout(hideHint, 6000);

    function handlersOf(obj) {
      let o = obj;
      while (o) {
        if (o.userData && o.userData.pick) return { owner: o, h: o.userData.pick };
        o = o.parent;
      }
      return null;
    }

    function pickAt(clientX, clientY) {
      if (!pickables.length) return null;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pickables, true);
      for (const hit of hits) {
        const found = handlersOf(hit.object);
        if (found && (!found.h.enabled || found.h.enabled())) return { ...found, hit };
      }
      return null;
    }

    function updateHover(clientX, clientY) {
      const res = pickAt(clientX, clientY);
      const owner = res ? res.owner : null;
      if (owner !== (hovered && hovered.owner)) {
        if (hovered && hovered.h.onLeave) hovered.h.onLeave();
        hovered = res;
        if (res && res.h.onHover) res.h.onHover(res.hit);
      } else if (res && res.h.onMove) {
        res.h.onMove(res.hit);
      }
      const clickable = res && res.h.onClick && (!res.h.clickable || res.h.clickable(res.hit));
      canvas.style.cursor = clickable ? 'pointer' : 'grab';
    }

    function clearHover() {
      if (hovered && hovered.h.onLeave) hovered.h.onLeave();
      hovered = null;
    }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        downAt = { x: e.clientX, y: e.clientY };
        dragging = false;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), radius: target.radius };
        dragging = true;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      lastPointer = { x: e.clientX, y: e.clientY };
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY);
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        target.radius = Math.max(minRadius, Math.min(maxRadius, pinch.radius * (pinch.dist / Math.max(1, dist))));
        hideHint();
        return;
      }

      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (!dragging && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) {
        dragging = true;
        clearHover();
        canvas.style.cursor = 'grabbing';
        hideHint();
      }
      if (dragging) {
        target.theta -= dx * 0.0065;
        target.phi = Math.max(minPhi, Math.min(maxPhi, target.phi - dy * 0.0055));
        if (isTop && target.phi > minPhi + 0.15) {
          isTop = false;
          viewBtn.textContent = '真上から';
        }
      }
    });

    function endPointer(e) {
      const wasDragging = dragging;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        if (!wasDragging && e.type === 'pointerup') {
          const res = pickAt(e.clientX, e.clientY);
          if (res) {
            // タッチではホバーを経由しないので、クリック前にホバーを通知する
            if (e.pointerType !== 'mouse' && res.h.onHover) res.h.onHover(res.hit);
            if (res.h.onClick) res.h.onClick(res.hit);
          }
        }
        dragging = false;
        downAt = null;
        if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY);
        else clearHover();
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !pointers.size) {
        clearHover();
        lastPointer = null;
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      target.radius = Math.max(minRadius, Math.min(maxRadius, target.radius * (1 + e.deltaY * 0.0011)));
      hideHint();
    }, { passive: false });

    // ---- トゥイーン ----
    const tweens = new Set();

    function tween(o) {
      const t = {
        start: performance.now() + (o.delay || 0),
        duration: o.duration ?? 400,
        ease: typeof o.ease === 'function' ? o.ease : (EASE[o.ease] || EASE.outCubic),
        update: o.update,
        complete: o.complete,
        cancelled: false,
        cancel() {
          this.cancelled = true;
          tweens.delete(this);
        }
      };
      tweens.add(t);
      return t;
    }

    // obj の位置・回転・拡大を目標値へ動かす。arc で放物線の高さを加える。
    function animate(obj, to, o = {}) {
      if (obj.userData._tween) obj.userData._tween.cancel();
      const fromPos = obj.position.clone();
      const fromRot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
      const fromScale = obj.scale.x;
      const toPos = to.position ? new THREE.Vector3(
        to.position.x ?? fromPos.x,
        to.position.y ?? fromPos.y,
        to.position.z ?? fromPos.z
      ) : fromPos.clone();
      const toRot = Object.assign({}, fromRot, to.rotation || {});
      const toScale = to.scale ?? fromScale;
      const arc = o.arc || 0;
      const tw = tween({
        duration: o.duration ?? 420,
        delay: o.delay,
        ease: o.ease || 'outCubic',
        update(k, raw) {
          obj.position.lerpVectors(fromPos, toPos, k);
          if (arc) obj.position.y += Math.sin(Math.min(1, raw) * Math.PI) * arc;
          obj.rotation.set(
            fromRot.x + (toRot.x - fromRot.x) * k,
            fromRot.y + (toRot.y - fromRot.y) * k,
            fromRot.z + (toRot.z - fromRot.z) * k
          );
          const s = fromScale + (toScale - fromScale) * k;
          obj.scale.set(s, s, s);
        },
        complete() {
          obj.userData._tween = null;
          if (o.complete) o.complete();
        }
      });
      obj.userData._tween = tw;
      return tw;
    }

    // ---- ラベル ----
    const labels = new Set();
    function label(text, o = {}) {
      const el = document.createElement('div');
      el.className = 'ba3d-label' + (o.className ? ' ' + o.className : '');
      el.textContent = text;
      overlay.appendChild(el);
      const lb = {
        el,
        position: new THREE.Vector3(),
        offsetY: o.offsetY || 0,
        set(t) {
          if (el.textContent !== String(t)) el.textContent = t;
          return lb;
        },
        at(x, y, z) {
          lb.position.set(x, y, z);
          return lb;
        },
        show(v) {
          el.classList.toggle('is-hidden', !v);
          return lb;
        },
        remove() {
          el.remove();
          labels.delete(lb);
        }
      };
      labels.add(lb);
      return lb;
    }

    const projected = new THREE.Vector3();
    let viewW = 1;
    let viewH = 1;

    function placeLabels() {
      labels.forEach((lb) => {
        projected.copy(lb.position);
        root.localToWorld(projected);
        projected.project(camera);
        if (projected.z > 1) {
          lb.el.style.visibility = 'hidden';
          return;
        }
        lb.el.style.visibility = '';
        const x = (projected.x * 0.5 + 0.5) * viewW;
        const y = (-projected.y * 0.5 + 0.5) * viewH + lb.offsetY;
        lb.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
    }

    // ---- リサイズ ----
    function resize() {
      const w = host.clientWidth || 800;
      const h = host.clientHeight || 520;
      if (w === viewW && h === viewH) return;
      viewW = w;
      viewH = h;
      camera.aspect = w / h;
      // 縦長・狭い画面では横方向の見える範囲を保つよう縦の画角を広げる
      const baseFov = opts.fov || 34;
      const refAspect = 1.3;
      if (camera.aspect < refAspect) {
        const halfH = Math.atan(Math.tan((baseFov * Math.PI) / 360) * refAspect);
        camera.fov = (Math.atan(Math.tan(halfH) / camera.aspect) * 360) / Math.PI;
      } else {
        camera.fov = baseFov;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ---- ループ ----
    let destroyed = false;
    let rafId = 0;
    let lastFrame = performance.now();
    let readyMarked = false;

    function frame(now) {
      if (destroyed) return;
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      // 導入中はゆっくり、その後は機敏に追従
      const introT = Math.min(1, (now - startTime) / 1600);
      damping = 0.03 + (0.16 - 0.03) * EASE.inOutCubic(introT);
      const k = 1 - Math.pow(1 - damping, dt * 60);
      cam.theta += (target.theta - cam.theta) * k;
      cam.phi += (target.phi - cam.phi) * k;
      cam.radius += (target.radius - cam.radius) * k;

      camera.position.set(
        cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta),
        lookY + cam.radius * Math.cos(cam.phi),
        cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta)
      );
      camera.lookAt(0, lookY, 0);

      tweens.forEach((t) => {
        if (now < t.start) return;
        const raw = Math.min(1, (now - t.start) / t.duration);
        t.update(t.ease(raw), raw);
        if (raw >= 1) {
          tweens.delete(t);
          if (t.complete) t.complete();
        }
      });

      if (opts.onFrame) opts.onFrame(now, dt);
      renderer.render(scene, camera);
      placeLabels();

      if (!readyMarked) {
        readyMarked = true;
        host.classList.add('is-ready');
      }
    }
    rafId = requestAnimationFrame(frame);

    // ---- 破棄 ----
    function destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      tweens.clear();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      matCache.forEach((m) => m.dispose());
      geoCache.forEach((g) => g.dispose());
      textures.forEach((t) => t.dispose());
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }

    // 子要素ごと取り除く (共有キャッシュ以外のジオメトリ・材質は破棄)
    function removeObject(obj) {
      if (!obj) return;
      if (obj.userData._tween) obj.userData._tween.cancel();
      if (obj.parent) obj.parent.remove(obj);
      obj.traverse((o) => {
        if (o.geometry && ![...geoCache.values()].includes(o.geometry) && !o.userData.sharedGeometry) o.geometry.dispose();
        if (o.material && !o.userData.sharedMaterial) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            if (![...matCache.values()].includes(m)) m.dispose();
          });
        }
      });
      const idx = pickables.indexOf(obj);
      if (idx >= 0) pickables.splice(idx, 1);
      if (hovered && hovered.owner === obj) hovered = null;
    }

    function clearGroup(group) {
      while (group.children.length) removeObject(group.children[0]);
    }

    function pick(obj, handlers) {
      obj.userData.pick = handlers;
      if (!pickables.includes(obj)) pickables.push(obj);
      return obj;
    }

    function unpick(obj) {
      const idx = pickables.indexOf(obj);
      if (idx >= 0) pickables.splice(idx, 1);
      if (obj.userData) delete obj.userData.pick;
    }

    // 盤面の格子を 1 枚の見えない板で受け、(行, 列) に変換して通知する
    function gridPicker(o) {
      const w = o.cols * o.step;
      const d = o.rows * o.step;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), kit.invisible());
      plane.position.set(o.x || 0, o.y || 0, o.z || 0);
      root.add(plane);
      let current = null;
      const toCell = (hit) => {
        const local = plane.worldToLocal(hit.point.clone());
        const c = Math.floor((local.x + w / 2) / o.step);
        const r = Math.floor((local.z + d / 2) / o.step);
        if (r < 0 || c < 0 || r >= o.rows || c >= o.cols) return null;
        return { r, c };
      };
      const emitHover = (cell) => {
        const same = cell && current && cell.r === current.r && cell.c === current.c;
        if (same) return;
        if (current && o.onLeave) o.onLeave(current.r, current.c);
        current = cell;
        if (cell && o.onHover) o.onHover(cell.r, cell.c);
      };
      pick(plane, {
        enabled: o.enabled,
        clickable: (hit) => {
          const cell = toCell(hit);
          return !!cell && (!o.clickable || o.clickable(cell.r, cell.c));
        },
        onHover: (hit) => emitHover(toCell(hit)),
        onMove: (hit) => emitHover(toCell(hit)),
        onLeave: () => emitHover(null),
        onClick: (hit) => {
          const cell = toCell(hit);
          if (cell && o.onClick) o.onClick(cell.r, cell.c);
        }
      });
      return {
        plane,
        cellCenter(r, c) {
          return {
            x: (o.x || 0) - w / 2 + (c + 0.5) * o.step,
            z: (o.z || 0) - d / 2 + (r + 0.5) * o.step
          };
        },
        get hovered() {
          return current;
        },
        refreshHover() {
          if (lastPointer) updateHover(lastPointer.x, lastPointer.y);
        }
      };
    }

    function refreshHover() {
      if (lastPointer && !pointers.size) updateHover(lastPointer.x, lastPointer.y);
    }

    return {
      THREE,
      scene,
      root,
      camera,
      renderer,
      host,
      overlay,
      kit,
      geo,
      markers,
      maxAniso,
      tween,
      animate,
      label,
      pick,
      unpick,
      gridPicker,
      removeObject,
      clearGroup,
      refreshHover,
      setView,
      destroy
    };
  }

  // ==========================================
  // 8. 公開 API
  // ==========================================
  const api = {
    registerAdapter(id, mount) {
      adapters[id] = mount;
    },
    createStage,
    EASE,
    WOODS,
    mulberry32,
    canvas: { cached: cachedCanvas, paintWood, paintNoise, wood: woodCanvas, felt: feltCanvas, grain: grainCanvas },
    shapes: { discProfile, lensProfile }
  };
  window.BoardArena3D = api;

  // ==========================================
  // 9. 操作パネルの文字から絵文字を外す
  // ==========================================
  // 盤面 (3D ステージと隠した 2D 盤面) の中はゲームの判定に使われるので触らない
  const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}☀-➿⬀-⯿️‍⃣]/gu;

  function tidyHud(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('.ba3d-stage, .ba3d-hidden-2d, script, style')) return NodeFilter.FILTER_REJECT;
        EMOJI.lastIndex = 0;
        return EMOJI.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      node.nodeValue = node.nodeValue.replace(EMOJI, '').replace(/^[ 　]+/, '').replace(/ {2,}/g, ' ');
    });
  }

  // ==========================================
  // 10. registerGame フック: 2D 盤面を 3D ステージで置き換える
  // ==========================================
  function installHook() {
    const platform = window.BoardArena;
    if (!platform || !platform.registerGame) return;
    const originalRegister = platform.registerGame.bind(platform);

    platform.registerGame = function (config) {
      if (!config || !config.id || typeof config.mount !== 'function') return originalRegister(config);

      const originalMount = config.mount;
      config.mount = function (container, bridge) {
        const cleanup = originalMount.call(this, container, bridge);
        const adapter = adapters[config.id];
        if (!adapter) return cleanup;

        let instance = null;
        let observer = null;
        let disposed = false;

        ensureThree().then((THREE) => {
          if (disposed || !THREE) return;
          try {
            instance = adapter(THREE, container, api);
          } catch (err) {
            console.error(`[BoardArena3D] ${config.id} の3D表示を初期化できませんでした`, err);
            return;
          }
          if (!instance || !instance.sync) return;
          api.current = instance.st;
          tidyHud(container);

          let pending = false;
          observer = new MutationObserver((records) => {
            // ステージ自身 (ラベルやカーソル) の変化では同期しない
            const host = instance.st && instance.st.host;
            if (host && records.every((r) => host.contains(r.target))) return;
            if (pending) return;
            pending = true;
            // 描画ループとは独立に同期する (タブが裏にあっても盤面の状態は追従させる)
            setTimeout(() => {
              pending = false;
              if (disposed || !instance) return;
              try {
                tidyHud(container);
                instance.sync();
              } catch (err) {
                console.error(`[BoardArena3D] ${config.id} の3D表示を更新できませんでした`, err);
              }
            }, 0);
          });
          observer.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });
        });

        return () => {
          disposed = true;
          if (observer) observer.disconnect();
          if (instance && instance.st) {
            if (api.current === instance.st) api.current = null;
            instance.st.destroy();
          }
          if (typeof cleanup === 'function') cleanup();
        };
      };

      return originalRegister(config);
    };
  }

  installHook();
  ensureThree();
})();
