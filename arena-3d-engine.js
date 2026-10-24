/**
 * 🌐 BOARD ARENA - Unified 3D WebGL & Godot 4.7 GLB Asset Engine (arena-3d-engine.js)
 *
 * Godot 4.7 (GLTFDocument) で生成・エクスポートされた .glb 3Dモデル群 (assets/models/*.glb) と
 * Three.js (r128 + GLTFLoader) を統合し、全16ゲームすべてをフル3D化するハイブリッド3Dエンジン。
 *
 * 主な機能:
 * - Godot 4.7 .glb モデルの非同期プリロード＆キャッシュ（ローカル file:// 環境用のプロシージャルPBRメッシュ自動フォールバック付き）
 * - 既存の13ゲーム（オセロ、五目並べ、コネクト4、チェッカー、コリドール、クアルト、マンカラ、ブロックス、
 *   ドット＆ボックス、バトルシップ、ヨット、ポーカー、コードネーム）の盤面をリアルタイム3D WebGLステージへ変換
 * - 3Dレイキャストによる直接クリック＆ホバー操作、マウスドラッグ360°カメラ回転、ホイールズーム、視点プリセット切替
 * - 3Dアニメーション（オセロ石の180°立体反転、コネクト4のコイン落下、ヨットの3Dサイコロ回転、コマの放物線ジャンプ）
 */

(function () {
  const MODEL_PATHS = {
    othello_disc: 'assets/models/othello_disc.glb',
    gomoku_black: 'assets/models/gomoku_stone_black.glb',
    gomoku_white: 'assets/models/gomoku_stone_white.glb',
    checkers_red: 'assets/models/checkers_red.glb',
    checkers_white: 'assets/models/checkers_white.glb',
    checkers_crown: 'assets/models/checkers_crown.glb',
    connect4_red: 'assets/models/connect4_red.glb',
    connect4_yellow: 'assets/models/connect4_yellow.glb',
    quoridor_blue: 'assets/models/quoridor_pawn_blue.glb',
    quoridor_red: 'assets/models/quoridor_pawn_red.glb',
    quoridor_wall: 'assets/models/quoridor_wall.glb',
    mancala_gem: 'assets/models/mancala_gem.glb',
    battleship_unit: 'assets/models/battleship_unit.glb',
    yacht_die: 'assets/models/yacht_die.glb',
    poker_chip: 'assets/models/poker_chip.glb',
    blokus_block: 'assets/models/blokus_block.glb',
    dab_pillar: 'assets/models/dab_pillar.glb',
    splendor_token: 'assets/models/splendor_token.glb',
    catan_settlement: 'assets/models/catan_settlement.glb',
    catan_city: 'assets/models/catan_city.glb',
    catan_road: 'assets/models/catan_road.glb',
    catan_robber: 'assets/models/catan_robber.glb',
    dominion_crown: 'assets/models/dominion_crown.glb',
    dominion_coin: 'assets/models/dominion_coin.glb',
    dominion_shield: 'assets/models/dominion_shield.glb'
  };

  // 既に独自3D実装を持つ6ゲームはラッパー対象外
  const NATIVE_3D_GAMES = new Set(['skull', 'gobblet', 'block_battle_3d', 'splendor', 'catan', 'dominion']);

  const glbCache = new Map();
  let threeLoadPromise = null;

  function ensureThreeAndLoader() {
    if (threeLoadPromise) return threeLoadPromise;
    threeLoadPromise = new Promise((resolve) => {
      function loadGltfLoader() {
        if (window.THREE && window.THREE.GLTFLoader) {
          preloadAllGlbModels();
          return resolve(window.THREE);
        }
        const s2 = document.createElement('script');
        s2.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
        s2.onload = () => {
          preloadAllGlbModels();
          resolve(window.THREE);
        };
        s2.onerror = () => resolve(window.THREE);
        document.head.appendChild(s2);
      }

      if (window.THREE) {
        loadGltfLoader();
      } else {
        const s1 = document.createElement('script');
        s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        s1.dataset.threeCdn = 'true';
        s1.onload = loadGltfLoader;
        document.head.appendChild(s1);
      }
    });
    return threeLoadPromise;
  }

  function preloadAllGlbModels() {
    if (!window.THREE || !window.THREE.GLTFLoader) return;
    if (window.location.protocol === 'file:') return; // file:// ではCORS制限のためプロシージャルPBRメッシュを使用
    const loader = new window.THREE.GLTFLoader();
    Object.entries(MODEL_PATHS).forEach(([key, url]) => {
      loader.load(
        url,
        (gltf) => {
          if (gltf && gltf.scene) {
            gltf.scene.traverse((c) => {
              if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
              }
            });
            glbCache.set(key, gltf.scene);
          }
        },
        undefined,
        () => {}
      );
    });
  }

  // Godot GLBキャッシュからクローン取得（未ロード時は同形状のPBRメッシュを生成）
  function instantiateModel(THREE, key, fallbackFactory) {
    if (glbCache.has(key)) {
      const clone = glbCache.get(key).clone(true);
      clone.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      return clone;
    }
    return fallbackFactory(THREE);
  }

  // 共通3DステージCSSの注入
  function injectEngineCSS() {
    if (document.getElementById('ba-3d-engine-css')) return;
    const style = document.createElement('style');
    style.id = 'ba-3d-engine-css';
    style.textContent = `
      .ba3d-stage-host {
        position: relative;
        width: 100%;
        height: calc(100vh - 215px);
        min-height: 460px;
        max-height: 780px;
        background: radial-gradient(circle at 50% 35%, #1e293b 0%, #090d16 92%);
        border-radius: 16px;
        border: 1px solid rgba(56, 189, 248, 0.28);
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.7);
        overflow: hidden;
        user-select: none;
      }
      .ba3d-stage-host.compact-stage {
        height: calc(100vh - 240px);
        min-height: 440px;
      }
      .ba3d-stage-host canvas {
        width: 100% !important;
        height: 100% !important;
        display: block;
        cursor: grab;
      }
      .ba3d-stage-host canvas:active {
        cursor: grabbing;
      }
      .ba3d-hud-controls {
        position: absolute;
        top: 10px;
        right: 12px;
        z-index: 15;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .ba3d-hud-badge {
        position: absolute;
        bottom: 10px;
        left: 12px;
        z-index: 15;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(6px);
        border: 1px solid rgba(56, 189, 248, 0.35);
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 999px;
        pointer-events: none;
      }
      .ba3d-btn {
        background: rgba(15, 23, 42, 0.86);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(148, 163, 184, 0.35);
        color: #f1f5f9;
        font-size: 11px;
        font-weight: 800;
        padding: 5px 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .ba3d-btn:hover {
        border-color: #38bdf8;
        color: #38bdf8;
        transform: translateY(-1px);
      }
      .ba3d-hidden-2d {
        display: none !important;
      }
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
      .blk-layout > .ba3d-stage-host, .qto-layout > .ba3d-stage-host {
        flex: 1 1 560px;
        min-width: 340px;
      }
    `;
    document.head.appendChild(style);
  }

  // 共通3Dステージ構築クラス
  function createInteractive3DStage(THREE, targetBoardEl, opts = {}) {
    injectEngineCSS();

    const hostEl = document.createElement('div');
    hostEl.className = 'ba3d-stage-host' + (opts.compact ? ' compact-stage' : '');

    const hudEl = document.createElement('div');
    hudEl.className = 'ba3d-hud-controls';

    const camBtn = document.createElement('button');
    camBtn.className = 'ba3d-btn';
    camBtn.textContent = '🎥 視点切替 (斜め/真上)';

    const toggle2DBtn = document.createElement('button');
    toggle2DBtn.className = 'ba3d-btn';
    toggle2DBtn.textContent = '📋 2D盤面切替';

    hudEl.appendChild(camBtn);
    hudEl.appendChild(toggle2DBtn);
    hostEl.appendChild(hudEl);

    const badgeEl = document.createElement('div');
    badgeEl.className = 'ba3d-hud-badge';
    badgeEl.textContent = '🧊 Godot 4.7 GLB + Three.js 3D Engine｜ドラッグ:回転 / ホイール:ズーム / クリック:着手';
    hostEl.appendChild(badgeEl);

    targetBoardEl.parentNode.insertBefore(hostEl, targetBoardEl);
    targetBoardEl.classList.add('ba3d-hidden-2d');

    let is2DMode = false;
    toggle2DBtn.addEventListener('click', () => {
      is2DMode = !is2DMode;
      if (is2DMode) {
        targetBoardEl.classList.remove('ba3d-hidden-2d');
        hostEl.style.height = '260px';
         hostEl.style.minHeight = '220px';
        toggle2DBtn.textContent = '🧊 3D最大化に戻す';
      } else {
        targetBoardEl.classList.add('ba3d-hidden-2d');
        hostEl.style.height = '';
        hostEl.style.minHeight = '';
        toggle2DBtn.textContent = '📋 2D盤面切替';
      }
      setTimeout(onResize, 30);
    });

    const w = hostEl.clientWidth || 800;
    const h = hostEl.clientHeight || 540;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opts.fov || 38, w / h, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    hostEl.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;

    // 3点スタジオライティング
    const ambLight = new THREE.AmbientLight(0xe2e8f0, 0.85);
    scene.add(ambLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.25);
    keyLight.position.set(7, 15, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    const d = opts.shadowExtent || 9.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-9, 8, -8);
    scene.add(rimLight);

    // カメラ軌道パラメータ
    const defaultPhi = opts.camPhi ?? 0.72;
    const defaultRadius = opts.camRadius ?? 12.0;
    const defaultTheta = opts.camTheta ?? 0;
    const lookY = opts.lookY ?? 0.0;

    let camTheta = defaultTheta;
    let camPhi = defaultPhi;
    let camRadius = defaultRadius;
    let targetTheta = defaultTheta;
    let targetPhi = defaultPhi;
    let targetRadius = defaultRadius;
    let isTopDown = false;

    camBtn.addEventListener('click', () => {
      isTopDown = !isTopDown;
      if (isTopDown) {
        targetTheta = 0;
        targetPhi = 0.12;
        targetRadius = defaultRadius * 1.04;
      } else {
        targetTheta = defaultTheta;
        targetPhi = defaultPhi;
        targetRadius = defaultRadius;
      }
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const interactiveMeshes = [];
    const activeAnims = []; // { mesh, startPos, endPos, startRotX, endRotX, arc, startTime, duration }

    let pointerDown = false;
    let downPos = { x: 0, y: 0 };
    let dragging = false;
    let lastHoveredObj = null;

    function updateMouse(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDown = true;
      dragging = false;
      downPos = { x: e.clientX, y: e.clientY };
    });

    const onWinMove = (e) => {
      if (pointerDown) {
        const dx = e.clientX - downPos.x;
        const dy = e.clientY - downPos.y;
        if (Math.hypot(dx, dy) > 5) {
          dragging = true;
          targetTheta -= dx * 0.007;
          targetPhi = Math.max(0.10, Math.min(1.38, targetPhi - dy * 0.006));
          downPos = { x: e.clientX, y: e.clientY };
        }
      } else if (interactiveMeshes.length > 0) {
        updateMouse(e);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(interactiveMeshes, true);
        let hitTarget = null;
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj && !obj.userData?.onClick && !obj.userData?.onHover) {
            obj = obj.parent;
          }
          hitTarget = obj;
        }
        if (hitTarget !== lastHoveredObj) {
          if (lastHoveredObj && lastHoveredObj.userData?.onLeave) {
            lastHoveredObj.userData.onLeave();
          }
          lastHoveredObj = hitTarget;
          if (hitTarget && hitTarget.userData?.onHover) {
            hitTarget.userData.onHover();
          }
        }
      }
    };

    const onWinUp = (e) => {
      if (!pointerDown) return;
      pointerDown = false;
      if (!dragging && e.target === renderer.domElement) {
        updateMouse(e);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(interactiveMeshes, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj && !obj.userData?.onClick) {
            obj = obj.parent;
          }
          if (obj && obj.userData?.onClick) {
            obj.userData.onClick();
          }
        }
      }
    };

    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);

    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      targetRadius = Math.max(5.5, Math.min(24.0, targetRadius + e.deltaY * 0.006));
    }, { passive: false });

    function onResize() {
      if (!hostEl.isConnected) return;
      const nw = hostEl.clientWidth || 800;
      const nh = hostEl.clientHeight || 540;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
    window.addEventListener('resize', onResize);

    let destroyed = false;
    let rafId = null;

    function animate(now) {
      if (destroyed) return;
      rafId = requestAnimationFrame(animate);

      camTheta += (targetTheta - camTheta) * 0.14;
      camPhi += (targetPhi - camPhi) * 0.14;
      camRadius += (targetRadius - camRadius) * 0.14;

      camera.position.set(
        camRadius * Math.sin(camPhi) * Math.sin(camTheta),
        camRadius * Math.cos(camPhi),
        camRadius * Math.sin(camPhi) * Math.cos(camTheta)
      );
      camera.lookAt(0, lookY, 0);

      for (let i = activeAnims.length - 1; i >= 0; i--) {
        const a = activeAnims[i];
        const t = Math.min(1, (now - a.startTime) / a.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        if (a.mesh) {
          a.mesh.position.x = a.startPos.x + (a.endPos.x - a.startPos.x) * ease;
          a.mesh.position.z = a.startPos.z + (a.endPos.z - a.startPos.z) * ease;
          const baseY = a.startPos.y + (a.endPos.y - a.startPos.y) * ease;
          a.mesh.position.y = baseY + Math.sin(t * Math.PI) * (a.arc || 0);
          if (a.endRotX !== undefined) {
            a.mesh.rotation.x = a.startRotX + (a.endRotX - a.startRotX) * ease;
          }
          if (a.endRotZ !== undefined) {
            a.mesh.rotation.z = a.startRotZ + (a.endRotZ - a.startRotZ) * ease;
          }
        }
        if (t >= 1) activeAnims.splice(i, 1);
      }

      if (opts.onTick) opts.onTick(now);
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(animate);

    return {
      THREE,
      scene,
      camera,
      renderer,
      maxAniso,
      hostEl,
      interactiveMeshes,
      activeAnims,
      addAnim(anim) {
        activeAnims.push(Object.assign({ startTime: performance.now(), duration: 320, arc: 0.6 }, anim));
      },
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('pointermove', onWinMove);
        window.removeEventListener('pointerup', onWinUp);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
      }
    };
  }

  // 高解像度テキストビルボード生成ヘルパー
  function makeTextSprite(THREE, text, bgColor = 'rgba(15,23,42,0.9)', borderColor = '#fbbf24', textColor = '#fde047', scaleW = 1.6, scaleH = 0.65) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 10;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(12, 12, 488, 176, 36);
    else ctx.rect(12, 12, 488, 176);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '900 78px "Inter", "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 104);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(scaleW, scaleH, 1);
    return sp;
  }

  // ====================================================
  // 各ゲーム専用 3D シーンビルダー & DOM 同期アダプター
  // ====================================================

  // 1. 🟢 3D オセロ (Othello)
  function mountOthello3D(THREE, container) {
    const frameEl = container.querySelector('.othello-board-frame');
    const gridEl = container.querySelector('#othello-grid');
    if (!frameEl || !gridEl) return null;

    const st = createInteractive3DStage(THREE, frameEl, { camPhi: 0.68, camRadius: 11.2 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    // マホガニー外枠＆グリーンフェルト盤
    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.42, 8.8),
      new THREE.MeshStandardMaterial({ color: 0x3e1f14, roughness: 0.35, metalness: 0.15 })
    );
    frameMesh.position.y = -0.22;
    frameMesh.receiveShadow = true;
    st.scene.add(frameMesh);

    const prevBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
    const discMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));

    // 8x8 タイル
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = (c - 3.5) * 0.98;
        const z = (r - 3.5) * 0.98;
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(0.92, 0.08, 0.92),
          new THREE.MeshStandardMaterial({ color: (r + c) % 2 === 0 ? 0x15803d : 0x166534, roughness: 0.65 })
        );
        tile.position.set(x, 0.02, z);
        tile.receiveShadow = true;
        tile.userData = {
          onClick: () => {
            const cells = gridEl.querySelectorAll('.oth-cell');
            if (cells[r * 8 + c]) cells[r * 8 + c].click();
          }
        };
        st.scene.add(tile);
        st.interactiveMeshes.push(tile);
      }
    }

    function createOthelloDisc3D() {
      return instantiateModel(THREE, 'othello_disc', (T) => {
        const g = new T.Group();
        const bHalf = new T.Mesh(
          new T.CylinderGeometry(0.39, 0.41, 0.07, 32),
          new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.2, metalness: 0.15 })
        );
        bHalf.position.y = 0.035;
        bHalf.castShadow = true;
        const wHalf = new T.Mesh(
          new T.CylinderGeometry(0.41, 0.39, 0.07, 32),
          new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18, metalness: 0.05 })
        );
        wHalf.position.y = -0.035;
        wHalf.castShadow = true;
        g.add(bHalf, wHalf);
        return g;
      });
    }

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      const cells = gridEl.querySelectorAll('.oth-cell');
      if (cells.length < 64) return;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = cells[r * 8 + c];
          const x = (c - 3.5) * 0.98;
          const z = (r - 3.5) * 0.98;
          const pieceEl = cell.querySelector('.oth-piece');
          const color = pieceEl ? (pieceEl.classList.contains('b') ? 'b' : 'w') : null;

          if (cell.classList.contains('valid')) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(0.16, 0.28, 24),
              new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(x, 0.08, z);
            dynGroup.add(ring);
          }

          if (color) {
            let dm = discMeshes[r][c];
            const targetRotX = color === 'b' ? 0 : Math.PI;
            if (!dm) {
              dm = createOthelloDisc3D();
              dm.position.set(x, 0.14, z);
              dm.rotation.x = targetRotX;
              st.scene.add(dm);
              discMeshes[r][c] = dm;
              st.addAnim({
                mesh: dm,
                startPos: { x, y: 1.5, z },
                endPos: { x, y: 0.14, z },
                arc: 0.2,
                duration: 240
              });
            } else if (prevBoard[r][c] && prevBoard[r][c] !== color) {
              // 挟まれた石の180度3D反転アニメーション！
              st.addAnim({
                mesh: dm,
                startPos: { x, y: 0.14, z },
                endPos: { x, y: 0.14, z },
                startRotX: dm.rotation.x,
                endRotX: targetRotX,
                arc: 0.85,
                duration: 380
              });
            }
          } else if (discMeshes[r][c]) {
            st.scene.remove(discMeshes[r][c]);
            discMeshes[r][c] = null;
          }
          prevBoard[r][c] = color;
        }
      }
    }

    sync();
    return { st, sync };
  }

  // 2. ⚫ 3D 五目並べ (Gomoku)
  function mountGomoku3D(THREE, container) {
    const frameEl = container.querySelector('.gomoku-board-frame');
    const gridEl = container.querySelector('#gomoku-grid');
    if (!frameEl || !gridEl) return null;

    const st = createInteractive3DStage(THREE, frameEl, { camPhi: 0.65, camRadius: 11.8 });
    const stonesGroup = new THREE.Group();
    st.scene.add(stonesGroup);

    // 榧(カヤ)碁盤 3D
    const goban = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.65, 9.6),
      new THREE.MeshStandardMaterial({ color: 0xd9b37c, roughness: 0.45, metalness: 0.05 })
    );
    goban.position.y = -0.325;
    goban.receiveShadow = true;
    st.scene.add(goban);

    const SP = 0.78;
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x271206 });
    for (let i = 0; i < 11; i++) {
      const pos = (i - 5) * SP;
      const hLine = new THREE.Mesh(new THREE.BoxGeometry(SP * 10, 0.02, 0.03), lineMat);
      hLine.position.set(0, 0.01, pos);
      const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, SP * 10), lineMat);
      vLine.position.set(pos, 0.01, 0);
      st.scene.add(hLine, vLine);
    }

    // 11x11 交点ヒットターゲット
    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < 11; c++) {
        const x = (c - 5) * SP;
        const z = (r - 5) * SP;
        const hit = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0 })
        );
        hit.position.set(x, 0.05, z);
        hit.userData = {
          onHover: () => { hit.material.opacity = 0.32; },
          onLeave: () => { hit.material.opacity = 0.0; },
          onClick: () => {
            const cells = gridEl.querySelectorAll('.gom-cell');
            if (cells[r * 11 + c]) cells[r * 11 + c].click();
          }
        };
        st.scene.add(hit);
        st.interactiveMeshes.push(hit);
      }
    }

    function sync() {
      while (stonesGroup.children.length > 0) stonesGroup.remove(stonesGroup.children[0]);
      const cells = gridEl.querySelectorAll('.gom-cell');
      if (cells.length < 121) return;

      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 11; c++) {
          const pieceEl = cells[r * 11 + c].querySelector('.gom-piece');
          if (!pieceEl) continue;
          const isBlack = pieceEl.classList.contains('b');
          const stone = instantiateModel(THREE, isBlack ? 'gomoku_black' : 'gomoku_white', (T) => {
            const m = new T.Mesh(
              new T.SphereGeometry(0.35, 24, 16),
              new T.MeshStandardMaterial({
                color: isBlack ? 0x111827 : 0xf8fafc,
                roughness: isBlack ? 0.18 : 0.12,
                metalness: 0.08
              })
            );
            m.scale.set(1, 0.38, 1);
            m.castShadow = true;
            return m;
          });
          stone.position.set((c - 5) * SP, 0.1, (r - 5) * SP);
          stonesGroup.add(stone);
        }
      }
    }

    sync();
    return { st, sync };
  }

  // 3. 🔴 3D コネクトフォー (Connect 4 - 立体縦置き重力ラック)
  function mountConnect4_3D(THREE, container) {
    const frameEl = container.querySelector('.c4-board-frame');
    const guideEl = container.querySelector('#c4-drop-guide');
    const boardEl = container.querySelector('#c4-board');
    if (!frameEl || !boardEl) return null;
    if (guideEl) guideEl.classList.add('ba3d-hidden-2d');

    const st = createInteractive3DStage(THREE, frameEl, { camPhi: 1.18, camRadius: 10.6, lookY: 0.3 });
    const coinsGroup = new THREE.Group();
    st.scene.add(coinsGroup);

    // 台座
    const tableBase = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.35, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
    );
    tableBase.position.y = -2.85;
    tableBase.receiveShadow = true;
    st.scene.add(tableBase);

    // 青の立体ラック柱＆横バー
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.28, metalness: 0.2, transparent: true, opacity: 0.82 });
    const SP = 0.94;
    for (let r = 0; r <= 6; r++) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(7 * SP + 0.4, 0.16, 0.34), rackMat);
      hBar.position.set(0, (2.5 - r) * SP + 0.47, 0);
      st.scene.add(hBar);
    }
    for (let c = 0; c <= 7; c++) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6 * SP + 0.3, 0.36), rackMat);
      vBar.position.set((c - 3.5) * SP, 0, 0);
      st.scene.add(vBar);
    }

    // 7列のクリック・ホバー判定＆上部プレビューコイン
    const hoverCoin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.14, 32),
      new THREE.MeshStandardMaterial({ color: 0xef4444, transparent: true, opacity: 0.75 })
    );
    hoverCoin.rotation.x = Math.PI / 2;
    hoverCoin.visible = false;
    st.scene.add(hoverCoin);

    for (let c = 0; c < 7; c++) {
      const x = (c - 3) * SP;
      const colHit = new THREE.Mesh(
        new THREE.BoxGeometry(SP * 0.95, 6 * SP + 1.2, 0.6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      colHit.position.set(x, 0.3, 0);
      colHit.userData = {
        onHover: () => {
          hoverCoin.position.set(x, 3.45, 0);
          hoverCoin.visible = true;
        },
        onLeave: () => {
          hoverCoin.visible = false;
        },
        onClick: () => {
          const cells = boardEl.querySelectorAll('.c4-cell');
          if (cells[c]) cells[c].click();
        }
      };
      st.scene.add(colHit);
      st.interactiveMeshes.push(colHit);
    }

    const coinMeshes = Array.from({ length: 6 }, () => Array(7).fill(null));

    function sync() {
      const cells = boardEl.querySelectorAll('.c4-cell');
      if (cells.length < 42) return;

      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          const coinEl = cells[r * 7 + c].querySelector('.c4-coin');
          const x = (c - 3) * SP;
          const y = (2.5 - r) * SP;

          if (coinEl) {
            const isP1 = coinEl.classList.contains('p1');
            const isWin = coinEl.classList.contains('win');
            if (!coinMeshes[r][c]) {
              const cm = instantiateModel(THREE, isP1 ? 'connect4_red' : 'connect4_yellow', (T) => {
                const m = new T.Mesh(
                  new T.CylinderGeometry(0.40, 0.40, 0.16, 32),
                  new T.MeshStandardMaterial({
                    color: isP1 ? 0xef4444 : 0xfacc15,
                    roughness: 0.22,
                    metalness: 0.25
                  })
                );
                m.rotation.x = Math.PI / 2;
                m.castShadow = true;
                return m;
              });
              cm.position.set(x, y, 0);
              st.scene.add(cm);
              coinMeshes[r][c] = cm;
              // 上部スロットから落下アニメーション！
              st.addAnim({
                mesh: cm,
                startPos: { x, y: 3.6, z: 0 },
                endPos: { x, y, z: 0 },
                arc: 0,
                duration: 340
              });
            }
            if (isWin && coinMeshes[r][c]) {
              coinMeshes[r][c].scale.set(1.14, 1.14, 1.14);
            }
          } else if (coinMeshes[r][c]) {
            st.scene.remove(coinMeshes[r][c]);
            coinMeshes[r][c] = null;
          }
        }
      }
    }

    sync();
    return { st, sync };
  }

  // 4. 👑 3D チェッカー (Checkers)
  function mountCheckers3D(THREE, container) {
    const frameEl = container.querySelector('.chk-board-frame');
    const boardEl = container.querySelector('#chk-board');
    if (!frameEl || !boardEl) return null;

    const st = createInteractive3DStage(THREE, frameEl, { camPhi: 0.70, camRadius: 11.2 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.42, 8.8),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.4 })
    );
    frameMesh.position.y = -0.22;
    frameMesh.receiveShadow = true;
    st.scene.add(frameMesh);

    const SP = 0.98;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isDark = (r + c) % 2 === 1;
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(0.94, 0.08, 0.94),
          new THREE.MeshStandardMaterial({ color: isDark ? 0x713f12 : 0xfef08a, roughness: 0.45 })
        );
        tile.position.set((c - 3.5) * SP, 0.02, (r - 3.5) * SP);
        tile.receiveShadow = true;
        tile.userData = {
          onClick: () => {
            const cells = boardEl.querySelectorAll('.chk-cell');
            const cell = cells[r * 8 + c];
            if (!cell) return;
            const piece = cell.querySelector('.chk-piece');
            if (piece) piece.click();
            else cell.click();
          }
        };
        st.scene.add(tile);
        st.interactiveMeshes.push(tile);
      }
    }

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      const cells = boardEl.querySelectorAll('.chk-cell');
      if (cells.length < 64) return;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = cells[r * 8 + c];
          const x = (c - 3.5) * SP;
          const z = (r - 3.5) * SP;
          const isSelected = cell.classList.contains('selected');
          const isValid = cell.classList.contains('valid-move');

          if (isValid || isSelected) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(0.28, 0.42, 28),
              new THREE.MeshBasicMaterial({ color: isSelected ? 0xfacc15 : 0x22c55e, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(x, 0.08, z);
            dynGroup.add(ring);
          }

          const pieceEl = cell.querySelector('.chk-piece');
          if (pieceEl) {
            const isP1 = pieceEl.classList.contains('p1');
            const isKing = pieceEl.textContent.includes('👑');
            const pm = instantiateModel(THREE, isP1 ? 'checkers_red' : 'checkers_white', (T) => {
              const m = new T.Mesh(
                new T.CylinderGeometry(0.38, 0.40, 0.18, 32),
                new T.MeshStandardMaterial({ color: isP1 ? 0xdc2626 : 0xf1f5f9, roughness: 0.25, metalness: 0.15 })
              );
              m.castShadow = true;
              return m;
            });
            pm.position.set(x, isSelected ? 0.42 : 0.12, z);
            dynGroup.add(pm);

            if (isKing) {
              const crown = instantiateModel(THREE, 'checkers_crown', (T) => {
                return new T.Mesh(
                  new T.CylinderGeometry(0.24, 0.18, 0.16, 16),
                  new T.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.8 })
                );
              });
              crown.position.set(x, (isSelected ? 0.42 : 0.12) + 0.18, z);
              dynGroup.add(crown);
            }
          }
        }
      }
    }

    sync();
    return { st, sync };
  }

  // 5. 🧭 3D コリドール (Quoridor)
  function mountQuoridor3D(THREE, container) {
    const boardContainer = container.querySelector('.qd-board-container');
    const boardEl = container.querySelector('#qd-board');
    if (!boardContainer || !boardEl) return null;

    const st = createInteractive3DStage(THREE, boardContainer, { camPhi: 0.72, camRadius: 12.6 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10.2, 0.45, 10.2),
      new THREE.MeshStandardMaterial({ color: 0x271206, roughness: 0.55 })
    );
    baseMesh.position.y = -0.24;
    baseMesh.receiveShadow = true;
    st.scene.add(baseMesh);

    const SP = 1.04;

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      st.interactiveMeshes.length = 0;

      const children = Array.from(boardEl.children);
      children.forEach((el) => {
        const gr = parseInt(el.style.gridRow, 10) - 1;
        const gc = parseInt(el.style.gridColumn, 10) - 1;
        if (isNaN(gr) || isNaN(gc)) return;

        if (el.classList.contains('qd-cell')) {
          const r = gr / 2;
          const c = gc / 2;
          const x = (c - 4) * SP;
          const z = (r - 4) * SP;
          const isValid = el.classList.contains('valid-move');

          const tile = new THREE.Mesh(
            new THREE.BoxGeometry(0.84, 0.12, 0.84),
            new THREE.MeshStandardMaterial({
              color: isValid ? 0xd97706 : 0x6c2e0b,
              roughness: 0.45
            })
          );
          tile.position.set(x, 0.04, z);
          tile.receiveShadow = true;
          tile.userData = { onClick: () => el.click() };
          dynGroup.add(tile);
          st.interactiveMeshes.push(tile);

          const pawnEl = el.querySelector('.qd-pawn');
          if (pawnEl) {
            const isP1 = pawnEl.classList.contains('p1');
            const pawn = instantiateModel(THREE, isP1 ? 'quoridor_blue' : 'quoridor_red', (T) => {
              const g = new T.Group();
              const body = new T.Mesh(
                new T.CylinderGeometry(0.18, 0.30, 0.65, 24),
                new T.MeshStandardMaterial({ color: isP1 ? 0x38bdf8 : 0xef4444, roughness: 0.25 })
              );
              body.position.y = 0.35;
              const head = new T.Mesh(
                new T.SphereGeometry(0.22, 24, 16),
                new T.MeshStandardMaterial({ color: isP1 ? 0x38bdf8 : 0xef4444, roughness: 0.25 })
              );
              head.position.y = 0.75;
              g.add(body, head);
              return g;
            });
            pawn.position.set(x, 0.10, z);
            dynGroup.add(pawn);
          }
        } else if (el.classList.contains('qd-wall-h-slot')) {
          const r = (gr - 1) / 2;
          const c = gc / 2;
          const x = (c - 4) * SP;
          const z = (r - 3.5) * SP;
          const placed = el.classList.contains('placed');

          const wallSeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.92, placed ? 0.62 : 0.08, 0.15),
            new THREE.MeshStandardMaterial({
              color: placed ? 0xf59e0b : 0x3b1d0a,
              roughness: 0.35,
              transparent: !placed,
              opacity: placed ? 1.0 : 0.45
            })
          );
          wallSeg.position.set(x, placed ? 0.32 : 0.04, z);
          if (placed) wallSeg.castShadow = true;
          wallSeg.userData = {
            onHover: () => { if (!placed) wallSeg.material.color.setHex(0xfde047); },
            onLeave: () => { if (!placed) wallSeg.material.color.setHex(0x3b1d0a); },
            onClick: () => el.click()
          };
          dynGroup.add(wallSeg);
          st.interactiveMeshes.push(wallSeg);
        } else if (el.classList.contains('qd-wall-v-slot')) {
          const r = gr / 2;
          const c = (gc - 1) / 2;
          const x = (c - 3.5) * SP;
          const z = (r - 4) * SP;
          const placed = el.classList.contains('placed');

          const wallSeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, placed ? 0.62 : 0.08, 0.92),
            new THREE.MeshStandardMaterial({
              color: placed ? 0xf59e0b : 0x3b1d0a,
              roughness: 0.35,
              transparent: !placed,
              opacity: placed ? 1.0 : 0.45
            })
          );
          wallSeg.position.set(x, placed ? 0.32 : 0.04, z);
          if (placed) wallSeg.castShadow = true;
          wallSeg.userData = {
            onHover: () => { if (!placed) wallSeg.material.color.setHex(0xfde047); },
            onLeave: () => { if (!placed) wallSeg.material.color.setHex(0x3b1d0a); },
            onClick: () => el.click()
          };
          dynGroup.add(wallSeg);
          st.interactiveMeshes.push(wallSeg);
        }
      });
    }

    sync();
    return { st, sync };
  }

  // 6. 🪵 3D クアルト (Quarto - 4属性16種の3D彫刻コマ)
  function mountQuarto3D(THREE, container) {
    const frameEl = container.querySelector('.qrt-board-frame');
    const boardEl = container.querySelector('#qrt-board');
    if (!frameEl || !boardEl) return null;

    const st = createInteractive3DStage(THREE, frameEl, { camPhi: 0.76, camRadius: 9.8 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x3b1908, roughness: 0.4 })
    );
    base.position.y = -0.2;
    base.receiveShadow = true;
    st.scene.add(base);

    const SP = 1.45;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = (c - 1.5) * SP;
        const z = (r - 1.5) * SP;
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.58, 0.60, 0.08, 32),
          new THREE.MeshStandardMaterial({ color: 0x6c2e0b, roughness: 0.5 })
        );
        pad.position.set(x, 0.04, z);
        pad.receiveShadow = true;
        pad.userData = {
          onClick: () => {
            const cells = boardEl.querySelectorAll('.qrt-cell');
            if (cells[r * 4 + c]) cells[r * 4 + c].click();
          }
        };
        st.scene.add(pad);
        st.interactiveMeshes.push(pad);
      }
    }

    function createQuartoPiece3D(pieceEl) {
      const isLight = pieceEl.classList.contains('light');
      const isRound = pieceEl.classList.contains('round');
      const isTall = pieceEl.classList.contains('tall');
      const isHollow = pieceEl.classList.contains('hollow');

      const h = isTall ? 1.55 : 0.88;
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: isLight ? 0xfde68a : 0x334155,
        roughness: 0.28,
        metalness: 0.15
      });

      const bodyGeo = isRound
        ? new THREE.CylinderGeometry(0.42, 0.44, h, 32)
        : new THREE.BoxGeometry(0.74, h, 0.74);
      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      if (isHollow) {
        // 頭頂の穴（中空くぼみ）を黒シリンダー＋リムで立体表現
        const holeMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.06, 24),
          new THREE.MeshBasicMaterial({ color: 0x090d16 })
        );
        holeMesh.position.y = h + 0.01;
        const rimMesh = new THREE.Mesh(
          new THREE.TorusGeometry(0.26, 0.045, 12, 24),
          mat
        );
        rimMesh.rotation.x = Math.PI / 2;
        rimMesh.position.y = h + 0.02;
        group.add(holeMesh, rimMesh);
      }
      return group;
    }

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      const cells = boardEl.querySelectorAll('.qrt-cell');
      if (cells.length < 16) return;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const cell = cells[r * 4 + c];
          const pEl = cell.querySelector('.qrt-piece');
          if (!pEl) continue;
          const pm = createQuartoPiece3D(pEl);
          pm.position.set((c - 1.5) * SP, 0.08, (r - 1.5) * SP);
          dynGroup.add(pm);
        }
      }
    }

    sync();
    return { st, sync };
  }

  // 7. 🪨 3D マンカラ (Mancala)
  function mountMancala3D(THREE, container) {
    const frameEl = container.querySelector('.mancala-board-frame');
    if (!frameEl) return null;

    const st = createInteractive3DStage(THREE, frameEl, { camPhi: 0.72, camRadius: 11.8 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    // 木製マンカラボード
    const boardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 0.55, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x5c2b09, roughness: 0.45 })
    );
    boardMesh.position.y = -0.25;
    boardMesh.receiveShadow = true;
    st.scene.add(boardMesh);

    function getPitWorldPos(idx) {
      if (idx === 6) return { x: 4.9, z: 0, isStore: true };
      if (idx === 13) return { x: -4.9, z: 0, isStore: true };
      if (idx >= 0 && idx <= 5) {
        return { x: (idx - 2.5) * 1.42, z: 1.15, isStore: false };
      }
      const topSlot = 12 - idx;
      return { x: (topSlot - 2.5) * 1.42, z: -1.15, isStore: false };
    }

    for (let i = 0; i < 14; i++) {
      const pos = getPitWorldPos(i);
      const pitGeo = pos.isStore
        ? new THREE.CylinderGeometry(0.75, 0.68, 0.14, 32)
        : new THREE.CylinderGeometry(0.56, 0.48, 0.14, 32);
      const pitMesh = new THREE.Mesh(
        pitGeo,
        new THREE.MeshStandardMaterial({ color: 0x271206, roughness: 0.7 })
      );
      if (pos.isStore) pitMesh.scale.set(1, 1, 2.2);
      pitMesh.position.set(pos.x, 0.02, pos.z);
      pitMesh.userData = {
        onClick: () => {
          const domPit = container.querySelector(`#pit-${i}`);
          if (domPit) domPit.click();
        }
      };
      st.scene.add(pitMesh);
      st.interactiveMeshes.push(pitMesh);
    }

    const gemColors = [0x38bdf8, 0xf87171, 0xfacc15, 0x4ade80, 0xc084fc];

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      for (let i = 0; i < 14; i++) {
        const countEl = container.querySelector(`#count-${i}`);
        const pitEl = container.querySelector(`#pit-${i}`);
        if (!countEl || !pitEl) continue;
        const count = parseInt(countEl.textContent, 10) || 0;
        const pos = getPitWorldPos(i);

        if (pitEl.classList.contains('selectable')) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.54, 0.64, 28),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(pos.x, 0.10, pos.z);
          dynGroup.add(ring);
        }

        // 3D宝石の配置
        const vis = Math.min(count, 20);
        for (let s = 0; s < vis; s++) {
          const angle = s * 2.399;
          const rad = Math.min(0.35, Math.sqrt(s) * 0.09);
          const zSpread = pos.isStore ? 1.8 : 1.0;
          const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.14, 1),
            new THREE.MeshStandardMaterial({
              color: gemColors[s % gemColors.length],
              roughness: 0.15,
              metalness: 0.25
            })
          );
          gem.position.set(
            pos.x + Math.cos(angle) * rad,
            0.14 + Math.floor(s / 5) * 0.12,
            pos.z + Math.sin(angle) * rad * zSpread
          );
          gem.castShadow = true;
          dynGroup.add(gem);
        }

        // 個数ビルボード
        const sp = makeTextSprite(
          THREE,
          `${count}`,
          'rgba(15,23,42,0.88)',
          i === 6 ? '#f59e0b' : (i === 13 ? '#38bdf8' : '#64748b'),
          '#fde047',
          0.95,
          0.42
        );
        sp.position.set(pos.x, 0.85, pos.z + (pos.z > 0 ? 0.55 : (pos.z < 0 ? -0.55 : 0)));
        dynGroup.add(sp);
      }
    }

    sync();
    return { st, sync };
  }

  // 8. 🟦 3D ブロックス (Blokus - 14x14 クリスタル陣取り)
  function mountBlokus3D(THREE, container) {
    const boardContainer = container.querySelector('.blokus-board-container');
    const gridEl = container.querySelector('#blokus-grid');
    if (!boardContainer || !gridEl) return null;

    const st = createInteractive3DStage(THREE, boardContainer, { camPhi: 0.62, camRadius: 12.2, compact: true });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    const SP = 0.64;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(14 * SP + 0.5, 0.35, 14 * SP + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
    );
    base.position.y = -0.18;
    base.receiveShadow = true;
    st.scene.add(base);

    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < 14; c++) {
        const x = (c - 6.5) * SP;
        const z = (r - 6.5) * SP;
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(SP * 0.92, 0.06, SP * 0.92),
          new THREE.MeshStandardMaterial({ color: (r + c) % 2 === 0 ? 0x1e293b : 0x172033, roughness: 0.7 })
        );
        tile.position.set(x, 0.02, z);
        tile.userData = {
          onHover: () => {
            const cells = gridEl.querySelectorAll('.blk-cell');
            if (cells[r * 14 + c]) {
              cells[r * 14 + c].dispatchEvent(new MouseEvent('mouseenter'));
            }
          },
          onClick: () => {
            const cells = gridEl.querySelectorAll('.blk-cell');
            if (cells[r * 14 + c]) cells[r * 14 + c].click();
          }
        };
        st.scene.add(tile);
        st.interactiveMeshes.push(tile);
      }
    }

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      const cells = gridEl.querySelectorAll('.blk-cell');
      if (cells.length < 196) return;

      for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 14; c++) {
          const cell = cells[r * 14 + c];
          const x = (c - 6.5) * SP;
          const z = (r - 6.5) * SP;

          if (cell.classList.contains('start-p1') || cell.classList.contains('start-p2')) {
            const isP1 = cell.classList.contains('start-p1');
            const dot = new THREE.Mesh(
              new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16),
              new THREE.MeshBasicMaterial({ color: isP1 ? 0xa855f7 : 0xf97316 })
            );
            dot.position.set(x, 0.06, z);
            dynGroup.add(dot);
          }

          const isP1 = cell.classList.contains('filled-p1');
          const isP2 = cell.classList.contains('filled-p2');
          const isPrevValid = cell.classList.contains('preview-valid');
          const isPrevInvalid = cell.classList.contains('preview-invalid');

          if (isP1 || isP2 || isPrevValid || isPrevInvalid) {
            const col = isP1 ? 0x9333ea : (isP2 ? 0xea580c : (isPrevValid ? 0x4ade80 : 0xef4444));
            const isPreview = !isP1 && !isP2;
            const cube = new THREE.Mesh(
              new THREE.BoxGeometry(SP * 0.88, isPreview ? 0.18 : 0.26, SP * 0.88),
              new THREE.MeshStandardMaterial({
                color: col,
                roughness: 0.2,
                metalness: 0.2,
                transparent: isPreview,
                opacity: isPreview ? 0.65 : 1.0
              })
            );
            cube.position.set(x, isPreview ? 0.22 : 0.16, z);
            cube.castShadow = !isPreview;
            dynGroup.add(cube);
          }
        }
      }
    }

    sync();
    return { st, sync };
  }

  // 9. 🟦 3D ドット＆ボックス (Dots & Boxes)
  function mountDotsAndBoxes3D(THREE, container) {
    const frameEl = container.querySelector('.dab-board-frame');
    const boardEl = container.querySelector('#dab-board');
    if (!frameEl || !boardEl) return null;

    const st = createInteractive3DStage(THREE, frameEl, { camPhi: 0.68, camRadius: 10.2 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 0.35, 8.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 })
    );
    base.position.y = -0.18;
    base.receiveShadow = true;
    st.scene.add(base);

    const SP = 1.65;

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      st.interactiveMeshes.length = 0;

      const children = Array.from(boardEl.children);
      if (children.length < 81) return;

      for (let gr = 0; gr < 9; gr++) {
        for (let gc = 0; gc < 9; gc++) {
          const el = children[gr * 9 + gc];
          const isRowDot = gr % 2 === 0;
          const isColDot = gc % 2 === 0;

          if (isRowDot && isColDot) {
            const r = gr / 2;
            const c = gc / 2;
            const pillar = instantiateModel(THREE, 'dab_pillar', (T) => {
              return new T.Mesh(
                new T.CylinderGeometry(0.18, 0.22, 0.38, 20),
                new T.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.6 })
              );
            });
            pillar.position.set((c - 2) * SP, 0.02, (r - 2) * SP);
            dynGroup.add(pillar);
          } else if (isRowDot && !isColDot) {
            const r = gr / 2;
            const c = (gc - 1) / 2;
            const drawn = el.classList.contains('drawn');
            const isP1 = el.classList.contains('p1');
            const bar = new THREE.Mesh(
              new THREE.BoxGeometry(SP - 0.32, drawn ? 0.24 : 0.10, 0.20),
              new THREE.MeshStandardMaterial({
                color: drawn ? (isP1 ? 0x38bdf8 : 0xf87171) : 0x334155,
                roughness: 0.25,
                transparent: !drawn,
                opacity: drawn ? 1.0 : 0.45
              })
            );
            bar.position.set((c - 1.5) * SP, drawn ? 0.14 : 0.06, (r - 2) * SP);
            bar.userData = {
              onHover: () => { if (!drawn) bar.material.color.setHex(0x38bdf8); },
              onLeave: () => { if (!drawn) bar.material.color.setHex(0x334155); },
              onClick: () => el.click()
            };
            dynGroup.add(bar);
            st.interactiveMeshes.push(bar);
          } else if (!isRowDot && isColDot) {
            const r = (gr - 1) / 2;
            const c = gc / 2;
            const drawn = el.classList.contains('drawn');
            const isP1 = el.classList.contains('p1');
            const bar = new THREE.Mesh(
              new THREE.BoxGeometry(0.20, drawn ? 0.24 : 0.10, SP - 0.32),
              new THREE.MeshStandardMaterial({
                color: drawn ? (isP1 ? 0x38bdf8 : 0xf87171) : 0x334155,
                roughness: 0.25,
                transparent: !drawn,
                opacity: drawn ? 1.0 : 0.45
              })
            );
            bar.position.set((c - 2) * SP, drawn ? 0.14 : 0.06, (r - 1.5) * SP);
            bar.userData = {
              onHover: () => { if (!drawn) bar.material.color.setHex(0x38bdf8); },
              onLeave: () => { if (!drawn) bar.material.color.setHex(0x334155); },
              onClick: () => el.click()
            };
            dynGroup.add(bar);
            st.interactiveMeshes.push(bar);
          } else {
            const r = (gr - 1) / 2;
            const c = (gc - 1) / 2;
            const isP1 = el.classList.contains('p1');
            const isP2 = el.classList.contains('p2');
            if (isP1 || isP2) {
              const boxBlock = new THREE.Mesh(
                new THREE.BoxGeometry(SP * 0.72, 0.22, SP * 0.72),
                new THREE.MeshStandardMaterial({
                  color: isP1 ? 0x0284c7 : 0xdc2626,
                  roughness: 0.3,
                  metalness: 0.2
                })
              );
              boxBlock.position.set((c - 1.5) * SP, 0.11, (r - 1.5) * SP);
              boxBlock.castShadow = true;
              dynGroup.add(boxBlock);
            }
          }
        }
      }
    }

    sync();
    return { st, sync };
  }

  // 10. 🚢 3D バトルシップ (Battleship - 2面3D海域＆3D戦艦・着弾マーカー)
  function mountBattleship3D(THREE, container) {
    const boardsContainer = container.querySelector('.bs-boards-container');
    const myGridEl = container.querySelector('#my-grid');
    const oppGridEl = container.querySelector('#opp-grid');
    if (!boardsContainer || !myGridEl || !oppGridEl) return null;

    const st = createInteractive3DStage(THREE, boardsContainer, { camPhi: 0.66, camRadius: 14.5 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    const SP = 0.56;
    const LEFT_CENTER_X = -3.35;
    const RIGHT_CENTER_X = 3.35;

    // 左右海域のベース＆ラベル
    [-1, 1].forEach((side) => {
      const cx = side < 0 ? LEFT_CENTER_X : RIGHT_CENTER_X;
      const seaBase = new THREE.Mesh(
        new THREE.BoxGeometry(10 * SP + 0.4, 0.28, 10 * SP + 0.4),
        new THREE.MeshStandardMaterial({ color: side < 0 ? 0x0c4a6e : 0x082f49, roughness: 0.35, metalness: 0.2 })
      );
      seaBase.position.set(cx, -0.15, 0.25);
      seaBase.receiveShadow = true;
      st.scene.add(seaBase);

      const labelSp = makeTextSprite(
        THREE,
        side < 0 ? '🛡️ 自艦隊海域' : '🎯 敵レーダー海域 (クリックで砲撃)',
        'rgba(15,23,42,0.9)',
        side < 0 ? '#38bdf8' : '#f87171',
        '#f8fafc',
        3.6,
        0.7
      );
      labelSp.position.set(cx, 0.65, -2.95);
      st.scene.add(labelSp);
    });

    // 10x10 タイル (左=自海域、右=攻撃レーダー)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const z = (r - 4.5) * SP + 0.25;
        // 左海域タイル
        const myTile = new THREE.Mesh(
          new THREE.BoxGeometry(SP * 0.9, 0.04, SP * 0.9),
          new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4 })
        );
        myTile.position.set(LEFT_CENTER_X + (c - 4.5) * SP, 0.01, z);
        st.scene.add(myTile);

        // 右海域タイル（砲撃クリック対象）
        const oppTile = new THREE.Mesh(
          new THREE.BoxGeometry(SP * 0.9, 0.05, SP * 0.9),
          new THREE.MeshStandardMaterial({ color: 0x075985, roughness: 0.4 })
        );
        oppTile.position.set(RIGHT_CENTER_X + (c - 4.5) * SP, 0.02, z);
        oppTile.userData = {
          onHover: () => { oppTile.material.color.setHex(0x38bdf8); },
          onLeave: () => { oppTile.material.color.setHex(0x075985); },
          onClick: () => {
            const cells = oppGridEl.querySelectorAll('.bs-cell');
            if (cells[r * 10 + c]) cells[r * 10 + c].click();
          }
        };
        st.scene.add(oppTile);
        st.interactiveMeshes.push(oppTile);
      }
    }

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      const myCells = myGridEl.querySelectorAll('.bs-cell');
      const oppCells = oppGridEl.querySelectorAll('.bs-cell');
      if (myCells.length < 100 || oppCells.length < 100) return;

      const renderGrid3D = (cells, centerX) => {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            const cell = cells[r * 10 + c];
            const x = centerX + (c - 4.5) * SP;
            const z = (r - 4.5) * SP + 0.25;

            if (cell.classList.contains('ship')) {
              const ship = instantiateModel(THREE, 'battleship_unit', (T) => {
                return new T.Mesh(
                  new T.BoxGeometry(SP * 0.78, 0.24, SP * 0.78),
                  new T.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.5 })
                );
              });
              ship.scale.set(0.65, 0.65, 0.65);
              ship.position.set(x, 0.05, z);
              dynGroup.add(ship);
            }
            if (cell.classList.contains('hit')) {
              const hitPeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.14, 0.18, 0.48, 16),
                new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, roughness: 0.2 })
              );
              hitPeg.position.set(x, 0.25, z);
              dynGroup.add(hitPeg);
            } else if (cell.classList.contains('miss')) {
              const missPeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.11, 0.11, 0.28, 16),
                new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 })
              );
              missPeg.position.set(x, 0.15, z);
              dynGroup.add(missPeg);
            }
          }
        }
      };

      renderGrid3D(myCells, LEFT_CENTER_X);
      renderGrid3D(oppCells, RIGHT_CENTER_X);
    }

    sync();
    return { st, sync };
  }

  // 11. 🎲 3D ヨット (Yacht - 3D物理回転ダイストレイ)
  function mountYacht3D(THREE, container) {
    const diceTrayEl = container.querySelector('.yct-dice-tray');
    const diceContainer = container.querySelector('#dice-container');
    const rollBtnDom = container.querySelector('#btn-roll-dice');
    if (!diceTrayEl || !diceContainer) return null;

    // サイコロ振るボタンを3Dステージの下に残すため、diceContainerのみを3D化
    const st = createInteractive3DStage(THREE, diceContainer, { camPhi: 0.68, camRadius: 8.8, compact: true });
    st.hostEl.style.height = '340px';
    st.hostEl.style.minHeight = '300px';

    // 八角形グリーンフェルト・ダイストレイ
    const trayFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(4.0, 4.2, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.65 })
    );
    trayFloor.position.y = -0.15;
    trayFloor.receiveShadow = true;
    st.scene.add(trayFloor);

    // 6面サイコロテクスチャ配列の生成
    function buildDieMaterials() {
      // Three.js BoxGeometry 面順序: +X(3), -X(4), +Y(1), -Y(6), +Z(2), -Z(5)
      const faceValues = [3, 4, 1, 6, 2, 5];
      const pipCoords = {
        1: [[0.5, 0.5]],
        2: [[0.28, 0.28], [0.72, 0.72]],
        3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
        4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
        5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
        6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]]
      };
      return faceValues.map((val) => {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 246, 246);

        ctx.fillStyle = val === 1 ? '#dc2626' : '#0f172a';
        pipCoords[val].forEach(([px, py]) => {
          ctx.beginPath();
          ctx.arc(px * 256, py * 256, val === 1 ? 36 : 24, 0, Math.PI * 2);
          ctx.fill();
        });
        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = st.maxAniso;
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.2 });
      });
    }

    const dieMaterials = buildDieMaterials();
    const dieMeshes = [];
    const ringMeshes = [];

    for (let i = 0; i < 5; i++) {
      const dm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), dieMaterials);
      dm.castShadow = true;
      dm.receiveShadow = true;
      dm.position.set((i - 2) * 1.4, 0.48, 0);
      dm.userData = {
        onClick: () => {
          const domDice = diceContainer.querySelectorAll('.yct-die');
          if (domDice[i]) domDice[i].click();
        }
      };
      st.scene.add(dm);
      st.interactiveMeshes.push(dm);
      dieMeshes.push(dm);

      const rm = new THREE.Mesh(
        new THREE.RingGeometry(0.62, 0.76, 28),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0 })
      );
      rm.rotation.x = -Math.PI / 2;
      st.scene.add(rm);
      ringMeshes.push(rm);
    }

    // 出目(1..6)が真上(+Y)になる回転角マップ
    const VALUE_ROTATIONS = {
      1: { x: 0, z: 0 },
      6: { x: Math.PI, z: 0 },
      2: { x: -Math.PI / 2, z: 0 },
      5: { x: Math.PI / 2, z: 0 },
      3: { x: 0, z: Math.PI / 2 },
      4: { x: 0, z: -Math.PI / 2 }
    };
    const FACE_MAP = { '⚀': 1, '⚁': 2, '⚂': 3, '⚃': 4, '⚄': 5, '⚅': 6 };

    if (rollBtnDom) {
      rollBtnDom.addEventListener('click', () => {
        const domDice = diceContainer.querySelectorAll('.yct-die');
        dieMeshes.forEach((dm, idx) => {
          if (domDice[idx] && !domDice[idx].classList.contains('kept')) {
            dm.rotation.x += Math.PI * 4;
            dm.rotation.z += Math.PI * 2;
          }
        });
      });
    }

    function sync() {
      const domDice = diceContainer.querySelectorAll('.yct-die');
      if (domDice.length < 5) return;

      domDice.forEach((dEl, i) => {
        const val = FACE_MAP[dEl.textContent.trim()] || 1;
        const isKept = dEl.classList.contains('kept');
        const rot = VALUE_ROTATIONS[val] || { x: 0, z: 0 };
        const x = (i - 2) * 1.4;
        const z = isKept ? 1.25 : -0.35;

        const dm = dieMeshes[i];
        st.addAnim({
          mesh: dm,
          startPos: { x: dm.position.x, y: dm.position.y, z: dm.position.z },
          endPos: { x, y: 0.48, z },
          startRotX: dm.rotation.x,
          endRotX: rot.x,
          startRotZ: dm.rotation.z,
          endRotZ: rot.z,
          arc: isKept ? 0.35 : 0.85,
          duration: 320
        });

        ringMeshes[i].position.set(x, 0.04, z);
        ringMeshes[i].material.opacity = isKept ? 0.9 : 0.0;
      });
    }

    sync();
    return { st, sync };
  }

  // 12. 🃏 3D ポーカー (Poker - 3Dカジノテーブル＆3Dカード＆3Dチップ)
  function mountPoker3D(THREE, container) {
    const tableEl = container.querySelector('.pk-table');
    const myCardsEl = container.querySelector('#pk-my-cards');
    const oppCardsEl = container.querySelector('#pk-opp-cards');
    const potEl = container.querySelector('#pk-pot');
    const bannerEl = container.querySelector('#pk-banner');
    const handNameEl = container.querySelector('#pk-hand-name');
    if (!tableEl || !myCardsEl || !oppCardsEl) return null;

    const st = createInteractive3DStage(THREE, tableEl, { camPhi: 0.86, camRadius: 11.4, lookY: -0.2 });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    // 3D楕円カジノテーブル
    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 5.6, 0.35, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d5c2e, roughness: 0.7 })
    );
    felt.scale.set(1.38, 1, 0.92);
    felt.position.y = -0.18;
    felt.receiveShadow = true;
    st.scene.add(felt);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(5.68, 0.32, 20, 64),
      new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.35, metalness: 0.15 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.38, 0.92, 1);
    rim.position.y = 0.02;
    st.scene.add(rim);

    function createCard3DMesh(cardEl) {
      const isBack = cardEl.classList.contains('back');
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 460;
      const ctx = c.getContext('2d');

      if (isBack) {
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(0, 0, 320, 460);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 18;
        ctx.strokeRect(14, 14, 292, 432);
        ctx.fillStyle = '#fde047';
        ctx.font = '900 54px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('POKER', 160, 230);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 320, 460);
        ctx.strokeStyle = cardEl.classList.contains('selected') ? '#f59e0b' : '#cbd5e1';
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, 306, 446);

        const rankEl = cardEl.querySelector('.pk-c-rank');
        const suitEl = cardEl.querySelector('.pk-c-suit');
        const rankStr = rankEl ? rankEl.textContent : '';
        const suitStr = suitEl ? suitEl.textContent : '';
        ctx.fillStyle = cardEl.style.color || '#0f172a';
        ctx.font = '900 68px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(rankStr, 26, 78);
        ctx.font = '150px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(suitStr, 160, 235);
      }

      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = st.maxAniso;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.04, 1.68),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 })
      );
      mesh.castShadow = true;
      return mesh;
    }

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      st.interactiveMeshes.length = 0;

      // 自分の5枚カード (手前)
      const myCards = Array.from(myCardsEl.querySelectorAll('.pk-card'));
      myCards.forEach((cEl, idx) => {
        const selected = cEl.classList.contains('selected');
        const cm = createCard3DMesh(cEl);
        cm.position.set((idx - 2) * 1.42, selected ? 0.55 : 0.16, 2.35);
        cm.rotation.x = 0.25;
        cm.userData = { onClick: () => cEl.click() };
        dynGroup.add(cm);
        st.interactiveMeshes.push(cm);
      });

      // 相手の5枚カード (奥)
      const oppCards = Array.from(oppCardsEl.querySelectorAll('.pk-card'));
      oppCards.forEach((cEl, idx) => {
        const cm = createCard3DMesh(cEl);
        cm.position.set((idx - 2) * 1.35, 0.14, -2.35);
        cm.rotation.x = 0.12;
        dynGroup.add(cm);
      });

      // 中央ポット3Dチップ＆役バナー
      const potText = potEl ? potEl.textContent : 'POT: 20';
      const handText = handNameEl ? handNameEl.textContent : '';
      const infoSp = makeTextSprite(THREE, `${potText} ｜ ${handText}`, 'rgba(15,23,42,0.92)', '#facc15', '#fde047', 5.2, 0.85);
      infoSp.position.set(0, 1.15, 0);
      dynGroup.add(infoSp);

      if (bannerEl && bannerEl.textContent) {
        const banSp = makeTextSprite(THREE, bannerEl.textContent, 'rgba(15,23,42,0.88)', '#38bdf8', '#f8fafc', 6.4, 0.72);
        banSp.position.set(0, 2.05, -0.5);
        dynGroup.add(banSp);
      }

      for (let i = 0; i < 6; i++) {
        const chip = instantiateModel(THREE, 'poker_chip', (T) => {
          return new T.Mesh(
            new T.CylinderGeometry(0.35, 0.35, 0.08, 24),
            new T.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.6 })
          );
        });
        chip.position.set(-0.6 + (i % 2) * 1.2, 0.05 + Math.floor(i / 2) * 0.09, 0.15);
        dynGroup.add(chip);
      }
    }

    sync();
    return { st, sync };
  }

  // 13. 🕵️‍♂️ 3D コードネーム (Codenames - 5x5 3Dスパイカードテーブル)
  function mountCodenames3D(THREE, container) {
    const gridContainer = container.querySelector('.cn-grid-container');
    const gridEl = container.querySelector('#cn-grid');
    if (!gridContainer || !gridEl) return null;

    const st = createInteractive3DStage(THREE, gridContainer, { camPhi: 0.62, camRadius: 11.6, compact: true });
    const dynGroup = new THREE.Group();
    st.scene.add(dynGroup);

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 0.35, 8.2),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 })
    );
    table.position.y = -0.18;
    table.receiveShadow = true;
    st.scene.add(table);

    const SX = 2.05;
    const SZ = 1.42;

    function createAgentTile3D(cardEl) {
      const wordEl = cardEl.querySelector('.card-word');
      const word = wordEl ? wordEl.textContent : cardEl.textContent.trim();
      const revealed = cardEl.classList.contains('revealed');

      let bg = '#e2e8f0';
      let fg = '#0f172a';
      let border = '#94a3b8';

      if (revealed) {
        if (cardEl.classList.contains('type-red')) { bg = '#dc2626'; fg = '#ffffff'; border = '#fca5a5'; }
        else if (cardEl.classList.contains('type-blue')) { bg = '#2563eb'; fg = '#ffffff'; border = '#93c5fd'; }
        else if (cardEl.classList.contains('type-assassin')) { bg = '#090d16'; fg = '#f87171'; border = '#ef4444'; }
        else { bg = '#475569'; fg = '#e2e8f0'; border = '#94a3b8'; }
      } else {
        if (cardEl.classList.contains('spy-red')) { bg = '#fee2e2'; border = '#ef4444'; }
        else if (cardEl.classList.contains('spy-blue')) { bg = '#dbeafe'; border = '#3b82f6'; }
        else if (cardEl.classList.contains('spy-assassin')) { bg = '#cbd5e1'; border = '#0f172a'; }
      }

      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 320;
      const ctx = c.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 320);
      ctx.strokeStyle = border;
      ctx.lineWidth = 22;
      ctx.strokeRect(11, 11, 490, 298);

      ctx.fillStyle = fg;
      ctx.font = '900 66px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, 256, 160);

      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = st.maxAniso;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.86, 0.12, 1.24),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.28 })
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    function sync() {
      while (dynGroup.children.length > 0) dynGroup.remove(dynGroup.children[0]);
      st.interactiveMeshes.length = 0;

      const cards = gridEl.querySelectorAll('.cn-card');
      if (cards.length < 25) return;

      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const cardEl = cards[r * 5 + c];
          const tileMesh = createAgentTile3D(cardEl);
          tileMesh.position.set((c - 2) * SX, 0.08, (r - 2) * SZ);
          tileMesh.userData = {
            onHover: () => { tileMesh.position.y = 0.22; },
            onLeave: () => { tileMesh.position.y = 0.08; },
            onClick: () => cardEl.click()
          };
          dynGroup.add(tileMesh);
          st.interactiveMeshes.push(tileMesh);
        }
      }
    }

    sync();
    return { st, sync };
  }

  const GAME_3D_MOUNTERS = {
    othello: mountOthello3D,
    gomoku: mountGomoku3D,
    connect4: mountConnect4_3D,
    checkers: mountCheckers3D,
    quoridor: mountQuoridor3D,
    quarto: mountQuarto3D,
    mancala: mountMancala3D,
    blokus: mountBlokus3D,
    dotsandboxes: mountDotsAndBoxes3D,
    battleship: mountBattleship3D,
    yacht: mountYacht3D,
    poker: mountPoker3D,
    codenames: mountCodenames3D
  };

  // ====================================================
  // BoardArena.registerGame の自動3Dエンハンス・フック
  // ====================================================
  function install3DHook() {
    if (!window.BoardArena || !window.BoardArena.registerGame) return;
    const origRegister = window.BoardArena.registerGame.bind(window.BoardArena);

    window.BoardArena.registerGame = function (config) {
      if (!config || !config.id) return origRegister(config);

      // タイトルとカテゴリに「3D」表記を付与して全ゲーム3D対応を明示
      if (!NATIVE_3D_GAMES.has(config.id) && GAME_3D_MOUNTERS[config.id]) {
        if (config.name && !config.name.includes('3D')) {
          config.name = '3D ' + config.name;
        }
        const origMount = config.mount;
        config.mount = function (container, bridge) {
          const origCleanup = origMount.call(this, container, bridge);
          let instance3D = null;
          let observer = null;
          let unmounted = false;

          ensureThreeAndLoader().then((THREE) => {
            if (unmounted || !THREE) return;
            const mounter = GAME_3D_MOUNTERS[config.id];
            if (!mounter) return;
            instance3D = mounter(THREE, container);
            if (instance3D && instance3D.sync) {
              let syncPending = false;
              observer = new MutationObserver(() => {
                if (syncPending || unmounted) return;
                syncPending = true;
                requestAnimationFrame(() => {
                  syncPending = false;
                  if (!unmounted && instance3D) instance3D.sync();
                });
              });
              observer.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
              });
            }
          });

          return () => {
            unmounted = true;
            if (observer) observer.disconnect();
            if (instance3D && instance3D.st) instance3D.st.destroy();
            if (typeof origCleanup === 'function') origCleanup();
          };
        };
      }

      return origRegister(config);
    };
  }

  install3DHook();
  ensureThreeAndLoader();
})();
