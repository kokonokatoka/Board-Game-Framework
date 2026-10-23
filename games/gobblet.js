/**
 * 👾 3D ゴブレットゴブラーズ (Gobblet Gobblers 3D Pro Edition)
 * Board Arena Plugin - Complete Three.js 3D Interactive Edition
 *
 * Features:
 * - 本格 Three.js 3D 立体ゴブラー（大・中・小の3サイズ、動く目玉・トサカ・中空ドーム構造）
 * - 立体3×3クロスバー盤面 ＆ 両プレイヤーの3D待機ベンチ（全12体のコマを3D空間に完全配置）
 * - 3Dレイキャスト直接操作（コマをクリックすると空中に浮き上がり、ターゲットマスで上からガブッと被さる放物線アニメーション）
 * - 盤上のコマを持ち上げた際、下に隠れていたコマが実際に3Dで現れるリアル構造
 * - 2Dクイック操作ドック併設・カメラ視点プリセット（斜め3D / 真上 / ドラッグ自由回転）
 * - 記憶＆先読み搭載の賢いCPU AI（ふつう / つよい切替）＋ Web Audio API 効果音 ＋ P2Pオンライン対戦対応
 */

(function () {
  const P1 = 1; // オレンジ (あなた / Host)
  const P2 = 2; // ブルー (CPU / 相手 / Guest)

  const SIZES = {
    1: { name: '小 (S)', short: 'S', radius: 0.42, height: 0.78, liftY: 1.55, colorBoost: 0 },
    2: { name: '中 (M)', short: 'M', radius: 0.64, height: 1.15, liftY: 1.85, colorBoost: 1 },
    3: { name: '大 (L)', short: 'L', radius: 0.88, height: 1.55, liftY: 2.15, colorBoost: 2 }
  };

  const WIN_LINES = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]]
  ];

  // Three.js CDN ローダー
  function loadThreeJS() {
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve(window.THREE);
      const existing = document.querySelector('script[data-three-cdn="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.THREE));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.dataset.threeCdn = 'true';
      script.onload = () => resolve(window.THREE);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Web Audio API 効果音
  function createGobbletSfx() {
    let ctx = null;
    function ensure() {
      if (!ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(freq, dur, type = 'sine', gain = 0.08, delay = 0, endFreq = null) {
      if (localStorage.getItem('ba_sfx_enabled') === 'false') return;
      const c = ensure();
      if (!c) return;
      try {
        const t0 = c.currentTime + delay;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur);
      } catch (e) {}
    }
    return {
      select() {
        tone(520, 0.09, 'sine', 0.08, 0, 780);
      },
      place() {
        tone(260, 0.08, 'triangle', 0.11, 0, 140);
        tone(420, 0.05, 'sine', 0.06, 0.03);
      },
      gobble() {
        // ガブッと被せる効果音
        tone(620, 0.14, 'sawtooth', 0.08, 0, 180);
        tone(160, 0.12, 'triangle', 0.14, 0.09, 95);
      },
      win() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.08));
      },
      lose() {
        [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, 0.24, 'sawtooth', 0.07, i * 0.09));
      }
    };
  }

  window.BoardArena.registerGame({
    id: 'gobblet',
    name: '3D ゴブレットゴブラーズ',
    category: '🎩 立体三目並べ (3D)',
    icon: '👾',
    players: '1〜2人',
    playTime: '3-5分',
    description: '大・中・小の立体モンスターコマを上から「ガブッ！」と被せて乗っ取る進化系3D三目並べ！記憶と読み合いの心理戦！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      const sfx = createGobbletSfx();

      // ゲーム状態
      // board[r][c] は { id, player, size } のスタック配列
      let board = [
        [[], [], []],
        [[], [], []],
        [[], [], []]
      ];
      // ベンチ待機中のコマ: benchSlots[player] = 6スロット (size 3,3,2,2,1,1)
      let benchPieces = { [P1]: [], [P2]: [] };

      let currentTurn = P1;
      let isGameOver = false;
      let winningLineCoords = null;
      let winnerPlayer = null;
      let vsCpu = !bridge.isConnected();
      let cpuHard = true; // デフォルトで賢いAI
      let myPlayer = bridge.isHost ? P1 : P2;

      // 選択中のコマ:
      // { type: 'hand', player, size, pieceId } または { type: 'board', r, c, player, size, pieceId }
      let selectedPiece = null;
      let hoveredCell = null; // { r, c }

      // HTML レイアウト (画面幅最大・フローティングHUD＋下部スリムドック)
      container.innerHTML = `
        <div class="gob3d-wrapper">
          <div class="gob3d-stage" id="gob3d-stage">
            <!-- 左上ステータス＆手番HUD -->
            <div class="gob3d-hud-topleft">
              <div class="gob3d-turn-pill" id="gob3d-turn-badge">🟠 あなたの手番 (オレンジ)</div>
              <div class="gob3d-hint-pill" id="gob3d-hint">手持ちまたは盤面のコマをクリックして選択</div>
            </div>

            <!-- 右上モード＆カメラ操作HUD -->
            <div class="gob3d-hud-topright">
              <button id="gob3d-mode-btn" class="gob3d-hud-btn active">${vsCpu ? '🤖 CPU対戦 (強)' : '👥 2人対戦'}</button>
              <button id="gob3d-cam-angle-btn" class="gob3d-hud-btn" title="斜め3D視点 / 真上視点の切替">🎥 視点切替</button>
              <button id="gob3d-restart-top-btn" class="gob3d-hud-btn" title="ゲームを最初からやり直す">🔄 リセット</button>
            </div>

            <!-- 勝敗オーバーレイ -->
            <div id="gob3d-result-overlay" class="gob3d-result-overlay hidden">
              <div class="gob3d-result-card">
                <div class="gob3d-result-title" id="gob3d-res-text">🎉 オレンジの勝利！</div>
                <div class="gob3d-result-sub" id="gob3d-res-sub">3つのゴブラーが一列に並びました！</div>
                <button id="gob3d-restart-btn" class="btn btn-primary">もう一度遊ぶ</button>
              </div>
            </div>
          </div>

          <!-- 下部クイック操作＆手持ちインジケーターバー -->
          <div class="gob3d-bottom-dock">
            <div class="gob3d-hand-group p1-group">
              <span class="gob3d-hand-title p1">🟠 あなたの手持ち:</span>
              <div class="gob3d-hand-btns" id="gob3d-p1-hand"></div>
            </div>

            <div class="gob3d-selected-banner" id="gob3d-selected-banner">
              3D空間のコマを直接クリック、または左のボタンで選択（ドラッグで視点回転）
            </div>

            <div class="gob3d-hand-group p2-group">
              <span class="gob3d-hand-title p2" id="gob3d-p2-label">🔵 CPUの手持ち:</span>
              <div class="gob3d-hand-btns" id="gob3d-p2-hand"></div>
            </div>
          </div>
        </div>
      `;

      if (!document.getElementById('gobblet-3d-pro-css')) {
        const style = document.createElement('style');
        style.id = 'gobblet-3d-pro-css';
        style.textContent = `
          .gob3d-wrapper {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 100%;
            gap: 8px;
            user-select: none;
          }
          .gob3d-stage {
            position: relative;
            width: 100%;
            height: calc(100vh - 200px);
            min-height: 480px;
            max-height: 840px;
            background: radial-gradient(circle at 50% 35%, #1e293b 0%, #090d16 90%);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 18px 42px rgba(0, 0, 0, 0.65);
            overflow: hidden;
          }
          .gob3d-stage canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            cursor: grab;
          }
          .gob3d-stage canvas:active {
            cursor: grabbing;
          }
          .gob3d-hud-topleft {
            position: absolute;
            top: 12px;
            left: 14px;
            z-index: 10;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            pointer-events: none;
          }
          .gob3d-turn-pill {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(249, 115, 22, 0.5);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 14px;
            font-weight: 800;
            color: #fb923c;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          }
          .gob3d-hint-pill {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 5px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            color: #cbd5e1;
          }
          .gob3d-hud-topright {
            position: absolute;
            top: 12px;
            right: 14px;
            z-index: 10;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .gob3d-hud-btn {
            background: rgba(15, 23, 42, 0.82);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(148, 163, 184, 0.3);
            color: #e2e8f0;
            font-size: 12px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .gob3d-hud-btn:hover {
            border-color: #38bdf8;
            color: #fff;
            transform: translateY(-1px);
          }
          .gob3d-hud-btn.active {
            border-color: #38bdf8;
            color: #38bdf8;
          }
          .gob3d-result-overlay {
            position: absolute;
            inset: 0;
            z-index: 25;
            background: rgba(9, 13, 22, 0.68);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .gob3d-result-overlay.hidden {
            display: none;
          }
          .gob3d-result-card {
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #f59e0b;
            border-radius: 18px;
            padding: 24px 36px;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
          }
          .gob3d-result-title {
            font-size: 26px;
            font-weight: 900;
            color: #facc15;
          }
          .gob3d-result-sub {
            font-size: 13px;
            color: #cbd5e1;
            margin-bottom: 6px;
          }
          .gob3d-bottom-dock {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            background: #111827;
            border: 1px solid #283548;
            border-radius: 12px;
            padding: 8px 16px;
            flex-wrap: wrap;
          }
          .gob3d-hand-group {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .gob3d-hand-title {
            font-size: 13px;
            font-weight: 800;
          }
          .gob3d-hand-title.p1 { color: #fb923c; }
          .gob3d-hand-title.p2 { color: #38bdf8; }
          .gob3d-hand-btns {
            display: flex;
            gap: 6px;
          }
          .gob3d-size-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 5px 11px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            border: 2px solid transparent;
            background: #1e293b;
            color: #f8fafc;
            transition: all 0.15s;
          }
          .gob3d-size-btn.p1 { border-color: rgba(249, 115, 22, 0.4); }
          .gob3d-size-btn.p2 { border-color: rgba(56, 189, 248, 0.4); }
          .gob3d-size-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            background: #334155;
          }
          .gob3d-size-btn.selected {
            border-color: #facc15 !important;
            background: rgba(250, 204, 21, 0.18);
            box-shadow: 0 0 12px rgba(250, 204, 21, 0.5);
          }
          .gob3d-size-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }
          .gob3d-selected-banner {
            font-size: 12px;
            font-weight: 700;
            color: #94a3b8;
            text-align: center;
            flex: 1;
            min-width: 200px;
          }
        `;
        document.head.appendChild(style);
      }

      const stageEl = container.querySelector('#gob3d-stage');
      const turnBadgeEl = container.querySelector('#gob3d-turn-badge');
      const hintEl = container.querySelector('#gob3d-hint');
      const modeBtn = container.querySelector('#gob3d-mode-btn');
      const camAngleBtn = container.querySelector('#gob3d-cam-angle-btn');
      const restartTopBtn = container.querySelector('#gob3d-restart-top-btn');
      const resultOverlayEl = container.querySelector('#gob3d-result-overlay');
      const resTextEl = container.querySelector('#gob3d-res-text');
      const resSubEl = container.querySelector('#gob3d-res-sub');
      const restartBtn = container.querySelector('#gob3d-restart-btn');
      const p1HandEl = container.querySelector('#gob3d-p1-hand');
      const p2HandEl = container.querySelector('#gob3d-p2-hand');
      const p2LabelEl = container.querySelector('#gob3d-p2-label');
      const selectedBannerEl = container.querySelector('#gob3d-selected-banner');

      // Three.js オブジェクト参照
      let THREE = null;
      let scene = null;
      let camera = null;
      let renderer = null;
      let raycaster = null;
      let mouse = null;

      // カメラ極座標 (ドラッグ回転 & 視点プリセット)
      let camTheta = 0;
      let camPhi = 0.82; // 斜め見下ろし
      let camRadius = 11.2;
      let targetCamTheta = 0;
      let targetCamPhi = 0.82;
      let targetCamRadius = 11.2;
      let topDownMode = false;

      // 3Dメッシュ辞書
      // pieceMeshes: Map<pieceId, THREE.Group>
      const pieceMeshes = new Map();
      // pieceAnimState: Map<pieceId, { startPos, targetPos, arcHeight, startTime, duration }>
      const pieceAnims = new Map();
      // 3×3 セルヒットターゲット & ハイライトリング
      const cellTargets = []; // { r, c, mesh, ringMesh }
      let ghostMesh = null;

      // セル座標変換 (3×3 マス、間隔 2.15)
      const CELL_SPACING = 2.15;
      function cellToWorld(r, c) {
        return {
          x: (c - 1) * CELL_SPACING,
          z: (r - 1) * CELL_SPACING
        };
      }

      // ベンチ待機スロット座標 (P1は手前側/左側、P2は奥側/右側)
      // スロット 0..5: [L, L, M, M, S, S]
      function benchSlotToWorld(player, slotIdx) {
        const xSide = player === P1 ? -4.55 : 4.55;
        const colOffset = (slotIdx % 2 === 0) ? -0.68 : 0.68;
        const rowGroup = Math.floor(slotIdx / 2); // 0: L, 1: M, 2: S
        const zPos = (rowGroup - 1) * 2.05;
        return {
          x: xSide + colOffset,
          z: zPos
        };
      }

      // 3Dゴブラーキャラクター生成 (中空ドーム＋目玉＋サイズ別トサカ)
      function createGobblerMesh(pieceObj) {
        const group = new THREE.Group();
        const cfg = SIZES[pieceObj.size];
        const isP1 = pieceObj.player === P1;

        const mainColor = isP1 ? 0xf97316 : 0x0ea5e9;
        const rimColor = isP1 ? 0xfdba74 : 0x7dd3fc;
        const crestColor = isP1 ? 0xfacc15 : 0x38bdf8;

        const bodyMat = new THREE.MeshStandardMaterial({
          color: mainColor,
          roughness: 0.28,
          metalness: 0.12
        });
        const rimMat = new THREE.MeshStandardMaterial({
          color: rimColor,
          roughness: 0.35,
          metalness: 0.15
        });

        // 1. 胴体シリンダー (下が少し広がるベル型)
        const cylH = cfg.height * 0.62;
        const cylGeo = new THREE.CylinderGeometry(cfg.radius * 0.88, cfg.radius, cylH, 32);
        const cylMesh = new THREE.Mesh(cylGeo, bodyMat);
        cylMesh.position.y = cylH / 2 + 0.06;
        cylMesh.castShadow = true;
        cylMesh.receiveShadow = true;
        group.add(cylMesh);

        // 2. 下端のスカートリム（被せる口の部分）
        const torusGeo = new THREE.TorusGeometry(cfg.radius * 0.96, 0.065, 14, 32);
        const torusMesh = new THREE.Mesh(torusGeo, rimMat);
        torusMesh.rotation.x = Math.PI / 2;
        torusMesh.position.y = 0.065;
        torusMesh.castShadow = true;
        group.add(torusMesh);

        // 3. 頭頂ドーム
        const domeGeo = new THREE.SphereGeometry(cfg.radius * 0.88, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
        const domeMesh = new THREE.Mesh(domeGeo, bodyMat);
        domeMesh.position.y = cylH + 0.04;
        domeMesh.castShadow = true;
        domeMesh.receiveShadow = true;
        group.add(domeMesh);

        // 4. ギョロ目玉 (白目＋黒目＋ハイライト)
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
        const eyeRadius = cfg.radius * 0.23;
        const eyeY = cylH + cfg.radius * 0.22;
        const eyeZ = cfg.radius * 0.78;
        const eyeXSpread = cfg.radius * 0.34;

        [-1, 1].forEach((side) => {
          const eyeGroup = new THREE.Group();
          const whiteGeo = new THREE.SphereGeometry(eyeRadius, 18, 18);
          const whiteMesh = new THREE.Mesh(whiteGeo, eyeWhiteMat);
          eyeGroup.add(whiteMesh);

          const pupilGeo = new THREE.SphereGeometry(eyeRadius * 0.52, 14, 14);
          const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
          pupilMesh.position.set(0, 0.02, eyeRadius * 0.72);
          eyeGroup.add(pupilMesh);

          eyeGroup.position.set(side * eyeXSpread, eyeY, eyeZ);
          group.add(eyeGroup);
        });

        // 5. かわいい口 / くちばし風スマイルライン
        const smileGeo = new THREE.TorusGeometry(cfg.radius * 0.22, 0.032, 10, 20, Math.PI);
        const smileMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
        const smileMesh = new THREE.Mesh(smileGeo, smileMat);
        smileMesh.rotation.x = Math.PI;
        smileMesh.position.set(0, cylH * 0.65, cfg.radius * 0.91);
        group.add(smileMesh);

        // 6. サイズ別の頭頂トサカ / 王冠突起 (S=1本、M=2本、L=3本クラウン)
        const crestMat = new THREE.MeshStandardMaterial({
          color: crestColor,
          roughness: 0.25,
          metalness: 0.25
        });
        const topY = cylH + cfg.radius * 0.85;
        const spikes = pieceObj.size;
        for (let i = 0; i < spikes; i++) {
          const offset = (i - (spikes - 1) / 2) * (cfg.radius * 0.28);
          const coneGeo = new THREE.ConeGeometry(cfg.radius * 0.14, cfg.radius * 0.36, 14);
          const coneMesh = new THREE.Mesh(coneGeo, crestMat);
          coneMesh.position.set(offset, topY + 0.05, 0);
          coneMesh.rotation.z = -offset * 0.5;
          coneMesh.castShadow = true;
          group.add(coneMesh);
        }

        // P1のコマは中央（または手前）を向き、P2のコマも正面を見やすく調整
        group.rotation.y = isP1 ? 0.22 : -0.22;

        // レイキャスト逆引き用に userData をすべての子メッシュに設定
        group.userData = { pieceId: pieceObj.id };
        group.traverse((child) => {
          if (child.isMesh) {
            child.userData = { pieceId: pieceObj.id };
          }
        });

        return group;
      }

      // 3Dシーン構築
      function setupThreeScene() {
        scene = new THREE.Scene();

        const w = stageEl.clientWidth || 960;
        const h = stageEl.clientHeight || 560;
        camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stageEl.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // ライティング
        const ambient = new THREE.AmbientLight(0xdbeafe, 0.72);
        scene.add(ambient);

        const mainLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
        mainLight.position.set(6, 14, 9);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 2;
        mainLight.shadow.camera.far = 30;
        const d = 8.5;
        mainLight.shadow.camera.left = -d;
        mainLight.shadow.camera.right = d;
        mainLight.shadow.camera.top = d;
        mainLight.shadow.camera.bottom = -d;
        scene.add(mainLight);

        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
        rimLight.position.set(-8, 7, -7);
        scene.add(rimLight);

        // テーブルステージ床
        const tableGeo = new THREE.CylinderGeometry(7.6, 8.0, 0.45, 64);
        const tableMat = new THREE.MeshStandardMaterial({
          color: 0x131c2e,
          roughness: 0.65,
          metalness: 0.2
        });
        const tableMesh = new THREE.Mesh(tableGeo, tableMat);
        tableMesh.position.y = -0.23;
        tableMesh.receiveShadow = true;
        scene.add(tableMesh);

        // テーブル外周のゴールドリング
        const outerRingGeo = new THREE.TorusGeometry(7.65, 0.08, 16, 64);
        const outerRingMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.3,
          metalness: 0.6
        });
        const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
        outerRing.rotation.x = Math.PI / 2;
        outerRing.position.y = 0.01;
        scene.add(outerRing);

        // 中央 3×3 プレイマット
        const matGeo = new THREE.BoxGeometry(6.8, 0.08, 6.8);
        const matMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.55,
          metalness: 0.1
        });
        const matMesh = new THREE.Mesh(matGeo, matMat);
        matMesh.position.y = 0.02;
        matMesh.receiveShadow = true;
        scene.add(matMesh);

        // 実物ゴブレットゴブラーズ風の立体クロスバー（井桁グリッド棒 4本）
        const barMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          roughness: 0.32,
          metalness: 0.18
        });
        const barLength = 6.5;
        const barHeight = 0.22;
        const barWidth = 0.22;
        const barOffsets = [-CELL_SPACING / 2, CELL_SPACING / 2];

        barOffsets.forEach((offset) => {
          // 横バー
          const hBarGeo = new THREE.BoxGeometry(barLength, barHeight, barWidth);
          const hBar = new THREE.Mesh(hBarGeo, barMat);
          hBar.position.set(0, barHeight / 2 + 0.04, offset);
          hBar.castShadow = true;
          hBar.receiveShadow = true;
          scene.add(hBar);

          // 縦バー
          const vBarGeo = new THREE.BoxGeometry(barWidth, barHeight, barLength);
          const vBar = new THREE.Mesh(vBarGeo, barMat);
          vBar.position.set(offset, barHeight / 2 + 0.04, 0);
          vBar.castShadow = true;
          vBar.receiveShadow = true;
          scene.add(vBar);
        });

        // P1 / P2 の3D待機ベンチ台座
        [P1, P2].forEach((p) => {
          const benchX = p === P1 ? -4.55 : 4.55;
          const benchColor = p === P1 ? 0x431407 : 0x082f49;
          const borderColor = p === P1 ? 0xf97316 : 0x0ea5e9;

          const baseGeo = new THREE.BoxGeometry(2.35, 0.14, 5.8);
          const baseMat = new THREE.MeshStandardMaterial({ color: benchColor, roughness: 0.5 });
          const baseMesh = new THREE.Mesh(baseGeo, baseMat);
          baseMesh.position.set(benchX, 0.07, 0);
          baseMesh.receiveShadow = true;
          scene.add(baseMesh);

          // 各スロットの丸台座
          for (let s = 0; s < 6; s++) {
            const pos = benchSlotToWorld(p, s);
            const padGeo = new THREE.CylinderGeometry(0.55, 0.58, 0.06, 24);
            const padMat = new THREE.MeshStandardMaterial({ color: borderColor, roughness: 0.4, transparent: true, opacity: 0.35 });
            const padMesh = new THREE.Mesh(padGeo, padMat);
            padMesh.position.set(pos.x, 0.15, pos.z);
            scene.add(padMesh);
          }
        });

        // 3×3 セルのクリック判定タイル ＆ ターゲットハイライトリング
        cellTargets.length = 0;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const pos = cellToWorld(r, c);

            // セル床タイル
            const tileGeo = new THREE.BoxGeometry(1.88, 0.06, 1.88);
            const tileMat = new THREE.MeshStandardMaterial({
              color: (r + c) % 2 === 0 ? 0x26354d : 0x1e2b40,
              roughness: 0.6
            });
            const tileMesh = new THREE.Mesh(tileGeo, tileMat);
            tileMesh.position.set(pos.x, 0.06, pos.z);
            tileMesh.receiveShadow = true;
            tileMesh.userData = { isCell: true, r, c };
            scene.add(tileMesh);

            // ターゲットリング (有効な移動先・勝利ライン表示用)
            const ringGeo = new THREE.RingGeometry(0.68, 0.86, 32);
            const ringMat = new THREE.MeshBasicMaterial({
              color: 0x4ade80,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.0
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = -Math.PI / 2;
            ringMesh.position.set(pos.x, 0.11, pos.z);
            scene.add(ringMesh);

            cellTargets.push({ r, c, mesh: tileMesh, ringMesh });
          }
        }

        // ホバー時の半透明ゴーストプレビュー
        const ghostGeo = new THREE.CylinderGeometry(0.5, 0.65, 1.0, 24);
        const ghostMat = new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.32,
          wireframe: false
        });
        ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
        ghostMesh.visible = false;
        scene.add(ghostMesh);
      }

      // 全12体のコマを初期化して3D空間に配置
      function initGame() {
        board = [
          [[], [], []],
          [[], [], []],
          [[], [], []]
        ];
        selectedPiece = null;
        hoveredCell = null;
        currentTurn = P1;
        isGameOver = false;
        winningLineCoords = null;
        winnerPlayer = null;
        resultOverlayEl.classList.add('hidden');

        // 既存3Dコマを削除
        pieceMeshes.forEach((mesh) => {
          if (scene) scene.remove(mesh);
        });
        pieceMeshes.clear();
        pieceAnims.clear();

        benchPieces = { [P1]: [], [P2]: [] };
        const sizeOrder = [3, 3, 2, 2, 1, 1];

        [P1, P2].forEach((player) => {
          sizeOrder.forEach((size, slotIdx) => {
            const pieceObj = {
              id: `p${player}_s${size}_${slotIdx}`,
              player,
              size,
              benchSlot: slotIdx,
              inBench: true
            };
            benchPieces[player].push(pieceObj);

            if (THREE && scene) {
              const mesh = createGobblerMesh(pieceObj);
              const pos = benchSlotToWorld(player, slotIdx);
              mesh.position.set(pos.x, 0.16, pos.z);
              scene.add(mesh);
              pieceMeshes.set(pieceObj.id, mesh);
            }
          });
        });

        updateUIAnd3DTargets();
      }

      // コマの目標座標アニメーション登録
      function animatePieceTo(pieceId, targetX, targetY, targetZ, arcHeight = 1.6, duration = 340) {
        const mesh = pieceMeshes.get(pieceId);
        if (!mesh) return;
        pieceAnims.set(pieceId, {
          startPos: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
          targetPos: { x: targetX, y: targetY, z: targetZ },
          arcHeight,
          startTime: performance.now(),
          duration
        });
      }

      // 全てのコマの位置を現在の盤面・選択状態に同期
      function syncAllPiecePositions(animatedPieceId = null, customArc = 1.8) {
        // 1. ベンチにあるコマ
        [P1, P2].forEach((player) => {
          benchPieces[player].forEach((p) => {
            if (!p.inBench) return;
            const pos = benchSlotToWorld(player, p.benchSlot);
            const isSelected = selectedPiece && selectedPiece.pieceId === p.id;
            const targetY = isSelected ? SIZES[p.size].liftY : 0.16;
            animatePieceTo(p.id, pos.x, targetY, pos.z, isSelected ? 0.6 : 0.3, 220);
          });
        });

        // 2. 盤上にあるコマ（スタック内のすべてのコマがそのマスに実在し、一番上の選択中コマだけ浮き上がる！）
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const stack = board[r][c];
            const pos = cellToWorld(r, c);
            stack.forEach((p, idx) => {
              const isTop = idx === stack.length - 1;
              const isSelected = isTop && selectedPiece && selectedPiece.pieceId === p.id;
              const targetY = isSelected ? SIZES[p.size].liftY : 0.09;
              const dur = p.id === animatedPieceId ? 380 : 220;
              const arc = p.id === animatedPieceId ? customArc : (isSelected ? 0.5 : 0.25);
              animatePieceTo(p.id, pos.x, targetY, pos.z, arc, dur);
            });
          }
        }
      }

      // 指定マスにサイズ size のコマを置けるか
      function canPlaceOnCell(r, c, size) {
        const stack = board[r][c];
        if (stack.length === 0) return true;
        const top = stack[stack.length - 1];
        return size > top.size;
      }

      // 勝敗判定 (相手の3連が同時に露出した場合は相手優先でチェック)
      function checkWinState(moverPlayer) {
        const opponent = moverPlayer === P1 ? P2 : P1;
        let moverWinLine = null;
        let oppWinLine = null;

        for (const line of WIN_LINES) {
          const [a, b, c] = line;
          const topA = board[a[0]][a[1]].at(-1);
          const topB = board[b[0]][b[1]].at(-1);
          const topC = board[c[0]][c[1]].at(-1);

          if (topA && topB && topC && topA.player === topB.player && topB.player === topC.player) {
            if (topA.player === opponent) oppWinLine = line;
            if (topA.player === moverPlayer) moverWinLine = line;
          }
        }

        // 自分のコマを動かしたことで相手の3連が露出し、それを塞げなかった場合は相手の勝ち（公式ルール）
        if (oppWinLine) return { winner: opponent, line: oppWinLine };
        if (moverWinLine) return { winner: moverPlayer, line: moverWinLine };
        return null;
      }

      // 手の実行
      function executeMove(moveData, isLocal = false) {
        if (isGameOver) return;
        const { from, to, player } = moveData;
        let movingPiece = null;
        const targetWasOccupied = board[to.r][to.c].length > 0;

        if (from.type === 'hand') {
          // ベンチから該当サイズの未使用コマを取得
          if (from.pieceId) {
            movingPiece = benchPieces[player].find(p => p.id === from.pieceId && p.inBench);
          }
          if (!movingPiece) {
            movingPiece = benchPieces[player].find(p => p.size === from.size && p.inBench);
          }
          if (!movingPiece) return;
          movingPiece.inBench = false;
        } else if (from.type === 'board') {
          const stack = board[from.r][from.c];
          if (stack.length === 0) return;
          movingPiece = stack.pop();
        }

        if (!movingPiece) return;
        board[to.r][to.c].push(movingPiece);

        // 効果音（上から被せた時はガブッ！、空きマスはコトン）
        if (targetWasOccupied) {
          sfx.gobble();
        } else {
          sfx.place();
        }

        if (isLocal && bridge.isConnected()) {
          bridge.send({
            game: 'gobblet',
            type: 'move',
            move: {
              from: { type: from.type, size: movingPiece.size, r: from.r, c: from.c, pieceId: movingPiece.id },
              to: { r: to.r, c: to.c },
              player
            }
          });
        }

        selectedPiece = null;
        hoveredCell = null;
        syncAllPiecePositions(movingPiece.id, targetWasOccupied ? 2.45 : 1.75);

        const winInfo = checkWinState(player);
        if (winInfo) {
          isGameOver = true;
          winnerPlayer = winInfo.winner;
          winningLineCoords = winInfo.line;

          const isMyWin = (vsCpu && winnerPlayer === P1) || (!vsCpu && winnerPlayer === myPlayer);
          if (isMyWin) sfx.win();
          else sfx.lose();

          const winnerLabel = winnerPlayer === P1
            ? '🎉 オレンジ (あなた) の勝利！！'
            : (vsCpu ? '💀 ブルー (CPU) の勝利！' : '🎉 ブルー の勝利！！');
          resTextEl.textContent = winnerLabel;
          resSubEl.textContent = targetWasOccupied
            ? '鮮やかなゴブル（被せ）で3連を完成させました！'
            : '見事3つのゴブラーが一列に揃いました！';

          setTimeout(() => {
            if (!isDestroyed && isGameOver) {
              resultOverlayEl.classList.remove('hidden');
            }
          }, 650);

          bridge.showToast(winnerLabel);
          if (winnerPlayer === P1) bridge.recordWin();
        } else {
          currentTurn = currentTurn === P1 ? P2 : P1;
        }

        updateUIAnd3DTargets();

        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      }

      // 手持ちの残り個数集計
      function getHandCounts(player) {
        const counts = { 1: 0, 2: 0, 3: 0 };
        benchPieces[player].forEach((p) => {
          if (p.inBench) counts[p.size]++;
        });
        return counts;
      }

      // UI ＆ 3Dリング表示の更新
      function updateUIAnd3DTargets() {
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
        const activePlayer = isConnected ? myPlayer : currentTurn;

        p2LabelEl.textContent = `${vsCpu ? '🔵 CPU' : '🔵 相手'}の手持ち:`;

        if (!isGameOver) {
          if (currentTurn === P1) {
            turnBadgeEl.textContent = '🟠 あなたの手番 (オレンジ)';
            turnBadgeEl.style.color = '#fb923c';
            turnBadgeEl.style.borderColor = 'rgba(249, 115, 22, 0.6)';
          } else {
            turnBadgeEl.textContent = vsCpu ? '🔵 CPUが思考中… (ブルー)' : '🔵 相手の手番 (ブルー)';
            turnBadgeEl.style.color = '#38bdf8';
            turnBadgeEl.style.borderColor = 'rgba(56, 189, 248, 0.6)';
          }

          if (isHumanTurn) {
            if (selectedPiece) {
              const srcLabel = selectedPiece.type === 'hand'
                ? `手持ちの【${SIZES[selectedPiece.size].name}】`
                : `盤面(${selectedPiece.r + 1},${selectedPiece.c + 1})の【${SIZES[selectedPiece.size].name}】`;
              hintEl.textContent = `${srcLabel}を選択中 → 緑色に光るマスをクリックして配置！`;
              selectedBannerEl.textContent = `✨ ${srcLabel} を選択中（小さなコマの上にガブッと被せられます）`;
              selectedBannerEl.style.color = '#facc15';
            } else {
              hintEl.textContent = '3Dベンチまたは盤上の自分のコマをクリックして選択';
              selectedBannerEl.textContent = '💡 3D空間のコマを直接クリック、または下のサイズボタンで選択（ドラッグで視点回転）';
              selectedBannerEl.style.color = '#94a3b8';
            }
          } else {
            hintEl.textContent = '相手のアクションを待っています…';
            selectedBannerEl.textContent = '⏳ 相手の手番です…';
            selectedBannerEl.style.color = '#94a3b8';
          }
        } else {
          turnBadgeEl.textContent = winnerPlayer === P1 ? '🏆 オレンジの勝利！' : '🏆 ブルーの勝利！';
          hintEl.textContent = '「もう一度遊ぶ」または右上のリセットで再戦できます';
        }

        // 下部クイック手持ちボタンの描画
        renderQuickHandButtons(P1, p1HandEl, isHumanTurn && currentTurn === P1);
        renderQuickHandButtons(P2, p2HandEl, !vsCpu && isHumanTurn && currentTurn === P2);

        // 3D セルリングのハイライト更新
        cellTargets.forEach((ct) => {
          const { r, c, ringMesh } = ct;
          if (isGameOver && winningLineCoords) {
            const isWinCell = winningLineCoords.some(([wr, wc]) => wr === r && wc === c);
            if (isWinCell) {
              ringMesh.material.color.setHex(0xfacc15);
              ringMesh.material.opacity = 0.9;
              return;
            }
          }

          if (isHumanTurn && selectedPiece) {
            const isSource = selectedPiece.type === 'board' && selectedPiece.r === r && selectedPiece.c === c;
            if (isSource) {
              ringMesh.material.color.setHex(0xfacc15);
              ringMesh.material.opacity = 0.85;
            } else if (canPlaceOnCell(r, c, selectedPiece.size)) {
              ringMesh.material.color.setHex(0x4ade80);
              ringMesh.material.opacity = 0.65;
            } else {
              ringMesh.material.opacity = 0.0;
            }
          } else {
            ringMesh.material.opacity = 0.0;
          }
        });

        // ゴーストプレビュー更新
        updateGhostPreview(isHumanTurn);
      }

      function renderQuickHandButtons(player, containerEl, canSelect) {
        containerEl.innerHTML = '';
        const counts = getHandCounts(player);
        [3, 2, 1].forEach((size) => {
          const btn = document.createElement('button');
          btn.className = `gob3d-size-btn ${player === P1 ? 'p1' : 'p2'}`;
          if (selectedPiece && selectedPiece.type === 'hand' && selectedPiece.player === player && selectedPiece.size === size) {
            btn.classList.add('selected');
          }
          btn.disabled = !canSelect || counts[size] <= 0;
          btn.innerHTML = `<span>${SIZES[size].name}</span> <span>×${counts[size]}</span>`;
          btn.addEventListener('click', () => {
            if (!canSelect || counts[size] <= 0) return;
            const benchCandidate = benchPieces[player].find(p => p.inBench && p.size === size);
            if (!benchCandidate) return;

            if (selectedPiece && selectedPiece.type === 'hand' && selectedPiece.player === player && selectedPiece.size === size) {
              selectedPiece = null;
            } else {
              selectedPiece = {
                type: 'hand',
                player,
                size,
                pieceId: benchCandidate.id
              };
              sfx.select();
            }
            syncAllPiecePositions();
            updateUIAnd3DTargets();
          });
          containerEl.appendChild(btn);
        });
      }

      function updateGhostPreview(isHumanTurn) {
        if (!ghostMesh) return;
        if (!isHumanTurn || !selectedPiece || !hoveredCell || isGameOver) {
          ghostMesh.visible = false;
          return;
        }
        const { r, c } = hoveredCell;
        const isSource = selectedPiece.type === 'board' && selectedPiece.r === r && selectedPiece.c === c;
        if (isSource || !canPlaceOnCell(r, c, selectedPiece.size)) {
          ghostMesh.visible = false;
          return;
        }
        const cfg = SIZES[selectedPiece.size];
        const pos = cellToWorld(r, c);
        ghostMesh.scale.set(cfg.radius * 1.45, cfg.height * 0.9, cfg.radius * 1.45);
        ghostMesh.position.set(pos.x, cfg.height * 0.45 + 0.12, pos.z);
        ghostMesh.visible = true;
      }

      // ==========================================
      // 🧠 記憶＆先読み搭載 ゴブレットCPU AI
      // ==========================================
      function getAllLegalMoves(player) {
        const moves = [];
        const handCounts = getHandCounts(player);

        // 1. 手持ちからの配置（同じサイズは1つだけ代表として生成）
        [3, 2, 1].forEach((size) => {
          if (handCounts[size] > 0) {
            const benchPiece = benchPieces[player].find(p => p.inBench && p.size === size);
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                if (canPlaceOnCell(r, c, size)) {
                  moves.push({
                    from: { type: 'hand', size, pieceId: benchPiece ? benchPiece.id : null },
                    to: { r, c },
                    player
                  });
                }
              }
            }
          }
        });

        // 2. 盤上からの移動
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const top = board[r][c].at(-1);
            if (top && top.player === player) {
              for (let tr = 0; tr < 3; tr++) {
                for (let tc = 0; tc < 3; tc++) {
                  if (r === tr && c === tc) continue;
                  if (canPlaceOnCell(tr, tc, top.size)) {
                    moves.push({
                      from: { type: 'board', r, c, size: top.size, pieceId: top.id },
                      to: { r: tr, c: tc },
                      player
                    });
                  }
                }
              }
            }
          }
        }
        return moves;
      }

      function applyTempMove(m) {
        if (m.from.type === 'hand') {
          board[m.to.r][m.to.c].push({ id: 'temp', player: m.player, size: m.from.size });
        } else {
          const piece = board[m.from.r][m.from.c].pop();
          board[m.to.r][m.to.c].push(piece);
        }
      }

      function revertTempMove(m) {
        if (m.from.type === 'hand') {
          board[m.to.r][m.to.c].pop();
        } else {
          const piece = board[m.to.r][m.to.c].pop();
          board[m.from.r][m.from.c].push(piece);
        }
      }

      // 盤面評価関数
      function evaluateBoardForCpu() {
        let score = 0;
        for (const line of WIN_LINES) {
          let p2Count = 0;
          let p1Count = 0;
          let p2SizeSum = 0;
          let p1SizeSum = 0;
          for (const [r, c] of line) {
            const top = board[r][c].at(-1);
            if (top) {
              if (top.player === P2) {
                p2Count++;
                p2SizeSum += top.size;
              } else {
                p1Count++;
                p1SizeSum += top.size;
              }
            }
          }
          if (p2Count === 3) return 10000;
          if (p1Count === 3) return -10000;
          if (p2Count === 2 && p1Count === 0) score += 45 + p2SizeSum * 4;
          if (p1Count === 2 && p2Count === 0) score -= 55 + p1SizeSum * 4;
          if (p2Count === 1 && p1Count === 0) score += 8 + p2SizeSum;
          if (p1Count === 1 && p2Count === 0) score -= 8 + p1SizeSum;
        }

        // 中央マスの支配ボーナス
        const centerTop = board[1][1].at(-1);
        if (centerTop) {
          score += (centerTop.player === P2 ? 18 : -18) * centerTop.size;
        }
        return score;
      }

      function triggerCpuMove() {
        if (isGameOver || isDestroyed) return;
        setTimeout(() => {
          if (isGameOver || currentTurn !== P2 || isDestroyed) return;
          const legalMoves = getAllLegalMoves(P2);
          if (legalMoves.length === 0) return;

          // 1. 即座にCPUが勝てる手があれば実行
          for (const m of legalMoves) {
            applyTempMove(m);
            const w = checkWinState(P2);
            revertTempMove(m);
            if (w && w.winner === P2) {
              executeMove(m, false);
              return;
            }
          }

          // 2. 各手をシミュレーションし、自滅手（動かした結果P1が勝つ、または次の1手でP1に即勝たれる手）を除外しつつ最高評価の手を選択
          let bestMove = legalMoves[0];
          let bestScore = -Infinity;

          for (const m of legalMoves) {
            applyTempMove(m);
            const immediateCheck = checkWinState(P2);
            if (immediateCheck && immediateCheck.winner === P1) {
              // 自分のコマを退かしたせいで下からP1の3連が露出した自滅手
              revertTempMove(m);
              continue;
            }

            let moveScore = evaluateBoardForCpu();

            // 相手のコマに上から被せる手にはボーナス
            if (board[m.to.r][m.to.c].length >= 2) {
              const coveredPiece = board[m.to.r][m.to.c][board[m.to.r][m.to.c].length - 2];
              if (coveredPiece.player === P1) {
                moveScore += 22 + coveredPiece.size * 8;
              }
            }

            if (cpuHard) {
              // 次のP1の手でP1が即勝利できる手があるか1手先読み
              const oppMoves = getAllLegalMoves(P1);
              let oppCanWinImmediately = false;
              for (const om of oppMoves) {
                applyTempMove(om);
                const ow = checkWinState(P1);
                revertTempMove(om);
                if (ow && ow.winner === P1) {
                  oppCanWinImmediately = true;
                  break;
                }
              }
              if (oppCanWinImmediately) {
                moveScore -= 5000;
              }
            } else {
              moveScore += (Math.random() - 0.5) * 35;
            }

            revertTempMove(m);

            if (moveScore > bestScore) {
              bestScore = moveScore;
              bestMove = m;
            }
          }

          executeMove(bestMove, false);
        }, 520);
      }

      // ==========================================
      // 🖱️ 3D マウス・タッチ操作（カメラ回転 ＆ レイキャスト選択）
      // ==========================================
      let isPointerDown = false;
      let pointerDownPos = { x: 0, y: 0 };
      let isDraggingCamera = false;

      function updateMouseNormalized(clientX, clientY) {
        if (!renderer || !mouse) return;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      }

      function handleStageClick(clientX, clientY) {
        if (isGameOver || !raycaster || !camera || !scene) return;
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
        if (!isHumanTurn) return;
        const activePlayer = isConnected ? myPlayer : currentTurn;

        updateMouseNormalized(clientX, clientY);
        raycaster.setFromCamera(mouse, camera);

        // 1. コマとの交差判定
        const pieceMeshList = Array.from(pieceMeshes.values());
        const pieceHits = raycaster.intersectObjects(pieceMeshList, true);

        let clickedPieceId = null;
        if (pieceHits.length > 0) {
          clickedPieceId = pieceHits[0].object.userData.pieceId;
        }

        if (clickedPieceId) {
          // そのコマがベンチにあるか盤上にあるか探す
          for (const p of [P1, P2]) {
            const benchP = benchPieces[p].find(item => item.id === clickedPieceId && item.inBench);
            if (benchP) {
              if (benchP.player === activePlayer) {
                if (selectedPiece && selectedPiece.pieceId === benchP.id) {
                  selectedPiece = null;
                } else {
                  selectedPiece = {
                    type: 'hand',
                    player: benchP.player,
                    size: benchP.size,
                    pieceId: benchP.id
                  };
                  sfx.select();
                }
                syncAllPiecePositions();
                updateUIAnd3DTargets();
              }
              return;
            }
          }

          // 盤上のコマだった場合：そのマス (r, c) を特定
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const stack = board[r][c];
              if (stack.some(item => item.id === clickedPieceId)) {
                const top = stack[stack.length - 1];
                // 既にコマを選択中で、このマスの上から被せられるなら被せる！
                if (selectedPiece && !(selectedPiece.type === 'board' && selectedPiece.r === r && selectedPiece.c === c)) {
                  if (canPlaceOnCell(r, c, selectedPiece.size)) {
                    executeMove({
                      from: selectedPiece,
                      to: { r, c },
                      player: activePlayer
                    }, isConnected);
                    return;
                  }
                }
                // 自分のトップコマなら選択/解除
                if (top && top.player === activePlayer) {
                  if (selectedPiece && selectedPiece.pieceId === top.id) {
                    selectedPiece = null;
                  } else {
                    selectedPiece = {
                      type: 'board',
                      r,
                      c,
                      player: top.player,
                      size: top.size,
                      pieceId: top.id
                    };
                    sfx.select();
                  }
                  syncAllPiecePositions();
                  updateUIAnd3DTargets();
                }
                return;
              }
            }
          }
        }

        // 2. マス目タイルとの交差判定
        const tileMeshes = cellTargets.map(ct => ct.mesh);
        const tileHits = raycaster.intersectObjects(tileMeshes, false);
        if (tileHits.length > 0) {
          const { r, c } = tileHits[0].object.userData;
          if (selectedPiece && canPlaceOnCell(r, c, selectedPiece.size)) {
            if (!(selectedPiece.type === 'board' && selectedPiece.r === r && selectedPiece.c === c)) {
              executeMove({
                from: selectedPiece,
                to: { r, c },
                player: activePlayer
              }, isConnected);
              return;
            }
          }
          // コマ未選択時に自分のコマがあるマスをクリックした場合
          const top = board[r][c].at(-1);
          if (top && top.player === activePlayer) {
            selectedPiece = {
              type: 'board',
              r,
              c,
              player: top.player,
              size: top.size,
              pieceId: top.id
            };
            sfx.select();
            syncAllPiecePositions();
            updateUIAnd3DTargets();
          }
        }
      }

      function handleStageHover(clientX, clientY) {
        if (!raycaster || !camera || !scene || isGameOver) return;
        updateMouseNormalized(clientX, clientY);
        raycaster.setFromCamera(mouse, camera);

        const tileMeshes = cellTargets.map(ct => ct.mesh);
        const tileHits = raycaster.intersectObjects(tileMeshes, false);
        if (tileHits.length > 0) {
          const { r, c } = tileHits[0].object.userData;
          hoveredCell = { r, c };
        } else {
          hoveredCell = null;
        }
        const isConnected = bridge.isConnected();
        const isHumanTurn = (!isConnected && !vsCpu) || (vsCpu && currentTurn === P1) || (isConnected && currentTurn === myPlayer);
        updateGhostPreview(isHumanTurn);
      }

      // ボタンイベント
      modeBtn.addEventListener('click', () => {
        if (bridge.isConnected()) {
          bridge.showToast('オンライン対戦中はモードを変更できません');
          return;
        }
        if (vsCpu && cpuHard) {
          cpuHard = false;
          modeBtn.textContent = '🤖 CPU対戦 (普通)';
          bridge.showToast('🤖 CPU難易度：ふつう に切り替えました');
        } else if (vsCpu && !cpuHard) {
          vsCpu = false;
          modeBtn.textContent = '👥 2人対戦 (ローカル)';
          bridge.showToast('👥 ローカル2人対戦モードに切り替えました');
        } else {
          vsCpu = true;
          cpuHard = true;
          modeBtn.textContent = '🤖 CPU対戦 (強)';
          bridge.showToast('🤖 CPU対戦モード (強AI) に切り替えました');
        }
        updateUIAnd3DTargets();
        if (vsCpu && currentTurn === P2 && !isGameOver) {
          triggerCpuMove();
        }
      });

      camAngleBtn.addEventListener('click', () => {
        topDownMode = !topDownMode;
        if (topDownMode) {
          targetCamTheta = 0;
          targetCamPhi = 0.22; // 真上近い視点（隠れたコマや並びが見やすい）
          targetCamRadius = 10.6;
          camAngleBtn.textContent = '🎥 斜め3D視点へ';
        } else {
          targetCamTheta = 0;
          targetCamPhi = 0.82;
          targetCamRadius = 11.2;
          camAngleBtn.textContent = '🎥 視点切替';
        }
      });

      function triggerRestart() {
        initGame();
        if (bridge.isConnected()) {
          bridge.send({ game: 'gobblet', type: 'restart' });
        }
        bridge.showToast('新しいゲームを開始しました！');
      }

      restartBtn.addEventListener('click', triggerRestart);
      restartTopBtn.addEventListener('click', triggerRestart);

      // P2P 連携
      bridge.onPlayerJoined(() => {
        myPlayer = bridge.isHost ? P1 : P2;
        vsCpu = false;
        modeBtn.textContent = '👥 オンライン対戦中';
        initGame();
        bridge.showToast('対戦相手が合流しました！3Dゴブレット開始！');
      });

      bridge.onReceive((data) => {
        if (!data || data.game !== 'gobblet') return;
        if (data.type === 'move') {
          executeMove(data.move, false);
        } else if (data.type === 'restart') {
          initGame();
          bridge.showToast('相手が再戦を開始しました！');
        }
      });

      // リサイズ対応
      function onResize() {
        if (isDestroyed || !renderer || !camera) return;
        const w = stageEl.clientWidth || 960;
        const h = stageEl.clientHeight || 560;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
      window.addEventListener('resize', onResize);

      // Three.js ロード＆レンダリングループ開始
      loadThreeJS().then((threeLib) => {
        if (isDestroyed) return;
        THREE = threeLib;
        setupThreeScene();
        initGame();

        const domEl = renderer.domElement;

        domEl.addEventListener('pointerdown', (e) => {
          isPointerDown = true;
          isDraggingCamera = false;
          pointerDownPos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('pointermove', (e) => {
          if (isDestroyed) return;
          if (isPointerDown) {
            const dx = e.clientX - pointerDownPos.x;
            const dy = e.clientY - pointerDownPos.y;
            if (Math.hypot(dx, dy) > 6) {
              isDraggingCamera = true;
              targetCamTheta -= dx * 0.007;
              targetCamPhi = Math.max(0.2, Math.min(1.28, targetCamPhi - dy * 0.006));
              pointerDownPos = { x: e.clientX, y: e.clientY };
            }
          } else {
            handleStageHover(e.clientX, e.clientY);
          }
        });

        window.addEventListener('pointerup', (e) => {
          if (!isPointerDown) return;
          isPointerDown = false;
          if (!isDraggingCamera && e.target === domEl) {
            handleStageClick(e.clientX, e.clientY);
          }
        });

        domEl.addEventListener('wheel', (e) => {
          e.preventDefault();
          targetCamRadius = Math.max(7.5, Math.min(15.5, targetCamRadius + e.deltaY * 0.005));
        }, { passive: false });

        // アニメーションループ
        function animate(now) {
          if (isDestroyed) return;
          animFrameId = requestAnimationFrame(animate);

          // カメラ補間
          camTheta += (targetCamTheta - camTheta) * 0.12;
          camPhi += (targetCamPhi - camPhi) * 0.12;
          camRadius += (targetCamRadius - camRadius) * 0.12;

          camera.position.x = camRadius * Math.sin(camPhi) * Math.sin(camTheta);
          camera.position.y = camRadius * Math.cos(camPhi);
          camera.position.z = camRadius * Math.sin(camPhi) * Math.cos(camTheta);
          camera.lookAt(0, 0.35, 0);

          // コマの放物線移動アニメーション補間
          pieceAnims.forEach((anim, pieceId) => {
            const mesh = pieceMeshes.get(pieceId);
            if (!mesh) {
              pieceAnims.delete(pieceId);
              return;
            }
            const t = Math.min(1, (now - anim.startTime) / anim.duration);
            const ease = 1 - Math.pow(1 - t, 3);
            mesh.position.x = anim.startPos.x + (anim.targetPos.x - anim.startPos.x) * ease;
            mesh.position.z = anim.startPos.z + (anim.targetPos.z - anim.startPos.z) * ease;
            const baseY = anim.startPos.y + (anim.targetPos.y - anim.startPos.y) * ease;
            const arcOffset = Math.sin(t * Math.PI) * anim.arcHeight;
            mesh.position.y = baseY + arcOffset;

            if (t >= 1) {
              mesh.position.set(anim.targetPos.x, anim.targetPos.y, anim.targetPos.z);
              pieceAnims.delete(pieceId);
            }
          });

          // 選択中コマのふわふわ浮遊＆勝利時の喜びジャンプ演出
          if (selectedPiece && !pieceAnims.has(selectedPiece.pieceId)) {
            const selMesh = pieceMeshes.get(selectedPiece.pieceId);
            if (selMesh) {
              const baseLift = SIZES[selectedPiece.size].liftY;
              selMesh.position.y = baseLift + Math.sin(now * 0.006) * 0.12;
            }
          }

          if (isGameOver && winningLineCoords) {
            winningLineCoords.forEach(([wr, wc], idx) => {
              const top = board[wr][wc].at(-1);
              if (top && !pieceAnims.has(top.id)) {
                const winMesh = pieceMeshes.get(top.id);
                if (winMesh) {
                  winMesh.position.y = 0.09 + Math.abs(Math.sin(now * 0.006 + idx * 0.6)) * 0.48;
                }
              }
            });
          }

          renderer.render(scene, camera);
        }
        animFrameId = requestAnimationFrame(animate);
      });

      return () => {
        isDestroyed = true;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', onResize);
        if (renderer && renderer.domElement) {
          renderer.dispose();
        }
      };
    }
  });
})();
