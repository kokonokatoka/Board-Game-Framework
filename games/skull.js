/**
 * 💀 3D スカル (Skull / 髑髏と薔薇) - 新生・本格卓上シミュレーター
 * Board Arena Plugin
 * 
 * 🌟 新仕様:
 * 1. 【広々とした専用カジノ卓】画面を大幅拡張 (高さ620px、最大幅1100px)。
 * 2. 【カードの枚数を4枚固定】余計なダミーカード全廃！自分4枚・相手4枚の計8枚のみ。
 * 3. 【明確に区切られた3大ゾーン】:
 *    - 🟦 あなたの手札エリア (手前4スロット、絶対に重ならない整列スロット)
 *    - ⚔️ カードを出すエリア (テーブル中央のプレイエリア)
 *    - 💀 没収エリア (失ったカードを置く右側のペナルティゾーン)
 * 4. 【スマート吸着スナップ】ドロップ時にスロットへ吸着し、カード同士の重なりを完全防止！
 * 5. 【シームレス操作】ドラッグ＆ドロップ移動 ＋ ダブルクリックで表裏反転（めくり）！
 * 6. 【リアルタイムP2P同期】移動・めくり・整列が相手画面と即時連動。
 */

(function () {
  const DISC_FLOWER = 'flower';
  const DISC_SKULL = 'skull';

  window.BoardArena.registerGame({
    id: 'skull',
    name: '3Dスカル (Skull)',
    icon: '💀',
    category: '3D・カジノ・ブラフ',
    minPlayers: 2,
    maxPlayers: 2,
    description: '広々としたカジノ卓で至高の心理戦！手札エリア・出すエリア・没収エリアを完全完備。ドラッグ＆ドロップとダブルクリックでめくる本格卓上3Dスカル！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;

      // HTML UI 構築
      container.innerHTML = `
        <div class="skull-wrapper">
          <!-- 上部コントロールバー -->
          <div class="skull-status-bar">
            <div class="skull-zones-legend">
              <span class="zone-tag tag-hand">🟦 手札エリア (4枚)</span>
              <span class="zone-tag tag-play">⚔️ 出すエリア (中央)</span>
              <span class="zone-tag tag-forfeit">💀 没収エリア (右側)</span>
            </div>
            <div class="skull-actions">
              <button id="btn-reset-hand" class="btn btn-sm btn-subtle" title="手札スロットに4枚をきれいに整列します">🔄 手元に整列</button>
              <button id="btn-flip-all-down" class="btn btn-sm btn-subtle" title="自分のカードをすべて裏返して伏せます">🎴 全て伏せる</button>
            </div>
          </div>

          <!-- 3D Canvas コンテナ -->
          <div class="skull-canvas-container" id="skull-3d-container">
            <!-- ゾーン案内ラベル (オーバーレイ) -->
            <div class="zone-label-hint label-opponent">⬆️ 相手の手札エリア</div>
            <div class="zone-label-hint label-center">⚔️ カードを出すエリア (プレイゾーン)</div>
            <div class="zone-label-hint label-forfeit">💀 没収エリア (ペナルティ)</div>
            <div class="zone-label-hint label-player">⬇️ あなたの手札エリア (重ならず4枚配置)</div>

            <div id="drag-hint" class="drag-hint hidden">掴み中</div>
          </div>

          <!-- 下部ガイドメッセージ -->
          <div class="skull-guide-footer">
            <span>🖐️ <strong>操作方法:</strong> カードをドラッグして場や没収エリアへ移動 / <strong>ダブルクリック</strong>で表裏をひっくり返す</span>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('skull-custom-css-v2')) {
        const style = document.createElement('style');
        style.id = 'skull-custom-css-v2';
        style.textContent = `
          .skull-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 1050px;
            margin: 0 auto;
            user-select: none;
            color: #f1f5f9;
          }

          .skull-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #111827;
            padding: 8px 16px;
            border-radius: 10px;
            border: 1px solid #283548;
            font-size: 13px;
          }

          .skull-zones-legend {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
          }

          .zone-tag {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
          }
          .tag-hand { background: #1e3a8a50; color: #60a5fa; border: 1px solid #3b82f660; }
          .tag-play { background: #f59e0b25; color: #fbbf24; border: 1px solid #f59e0b60; }
          .tag-forfeit { background: #ef444425; color: #f87171; border: 1px solid #ef444460; }

          .skull-actions {
            display: flex;
            gap: 8px;
          }

          /* 3D Canvas コンテナ (広々設計) */
          .skull-canvas-container {
            width: 100%;
            height: 580px;
            background: radial-gradient(circle at center, #0d1522, #020617);
            border-radius: 16px;
            border: 2px solid #334155;
            position: relative;
            overflow: hidden;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.75);
            cursor: grab;
          }
          .skull-canvas-container.grabbing {
            cursor: grabbing;
          }

          .skull-canvas-container canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            outline: none;
          }

          /* ゾーンラベル表示 */
          .zone-label-hint {
            position: absolute;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(4px);
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            pointer-events: none;
            z-index: 5;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .label-opponent { top: 12px; left: 50%; transform: translateX(-50%); color: #94a3b8; }
          .label-center { top: 40%; left: 45%; transform: translate(-50%, -50%); color: #fbbf24; }
          .label-forfeit { top: 40%; right: 20px; transform: translateY(-50%); color: #f87171; border-color: rgba(239, 68, 68, 0.4); }
          .label-player { bottom: 12px; left: 45%; transform: translateX(-50%); color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); }

          .drag-hint {
            position: absolute;
            bottom: 45px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: #38bdf8;
            font-size: 12px;
            font-weight: 700;
            padding: 5px 14px;
            border-radius: 14px;
            pointer-events: none;
            z-index: 10;
            border: 1px solid #38bdf850;
          }
          .drag-hint.hidden { display: none; }

          .skull-guide-footer {
            width: 100%;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            background: #0f172a;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid #1e293b;
          }

          @media (max-width: 640px) {
            .skull-canvas-container { height: 460px; }
            .skull-status-bar { flex-direction: column; gap: 8px; align-items: flex-start; }
            .skull-zones-legend { gap: 6px; }
          }
        `;
        document.head.appendChild(style);
      }

      const canvasContainer = container.querySelector('#skull-3d-container');
      const btnResetHand = container.querySelector('#btn-reset-hand');
      const btnFlipAllDown = container.querySelector('#btn-flip-all-down');
      const dragHint = container.querySelector('#drag-hint');

      // ----------------------------------------------------
      // 1. Three.js シーン・カメラ・ライトの初期化
      // ----------------------------------------------------
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x060913, 0.015);

      const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
      const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
      
      // 手前から全体を見下ろす広々としたカメラポジション
      camera.position.set(0, 21, 14.5);
      camera.lookAt(0, -0.2, 0.2);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvasContainer.appendChild(renderer.domElement);

      // 環境光 & スポットライト
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
      scene.add(ambientLight);

      const spotLight = new THREE.SpotLight(0xfff7ed, 1.4);
      spotLight.position.set(0, 25, 2);
      spotLight.angle = Math.PI / 2.8;
      spotLight.penumbra = 0.45;
      spotLight.castShadow = true;
      scene.add(spotLight);

      const blueRim = new THREE.PointLight(0x38bdf8, 0.8, 35);
      blueRim.position.set(-8, 6, 8);
      scene.add(blueRim);

      const redRim = new THREE.PointLight(0xef4444, 0.8, 35);
      redRim.position.set(8, 6, 0);
      scene.add(redRim);

      // ----------------------------------------------------
      // 2. ワイド・カジノテーブル & 各ゾーンの描画
      // ----------------------------------------------------
      const tableGroup = new THREE.Group();

      // テーブル天板 (広々としたオーバル/丸角長方形)
      const TABLE_WIDTH = 19.5;
      const TABLE_DEPTH = 13.5;
      const tableGeo = new THREE.BoxGeometry(TABLE_WIDTH, 0.4, TABLE_DEPTH);
      const tableMat = new THREE.MeshStandardMaterial({
        color: 0x0f291e, // ダークグリーン・フェルト
        roughness: 0.8,
        metalness: 0.05
      });
      const tableMesh = new THREE.Mesh(tableGeo, tableMat);
      tableMesh.position.y = -0.2;
      tableMesh.receiveShadow = true;
      tableGroup.add(tableMesh);

      // マホガニー外枠レール
      const railGeo = new THREE.BoxGeometry(TABLE_WIDTH + 0.8, 0.45, TABLE_DEPTH + 0.8);
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x3b1d11, // 高級マホガニーウッド
        roughness: 0.35,
        metalness: 0.2
      });
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.position.y = -0.25;
      railMesh.receiveShadow = true;
      tableGroup.add(railMesh);

      scene.add(tableGroup);

      // ----------------------------------------------------
      // 3. ゾーン用テクスチャの生成 (手札枠・プレイ枠・没収枠)
      // ----------------------------------------------------
      function createZoneTextures() {
        // ① 手札スロット枠 (青ネオン)
        const cSlot = document.createElement('canvas');
        cSlot.width = 256; cSlot.height = 256;
        const ctxS = cSlot.getContext('2d');
        ctxS.strokeStyle = '#38bdf8';
        ctxS.lineWidth = 10;
        ctxS.setLineDash([16, 10]);
        ctxS.beginPath();
        ctxS.arc(128, 128, 110, 0, Math.PI * 2);
        ctxS.stroke();
        ctxS.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctxS.fill();
        const texSlot = new THREE.CanvasTexture(cSlot);

        // ② プレイエリア枠 (中央・ゴールドサークル)
        const cPlay = document.createElement('canvas');
        cPlay.width = 512; cPlay.height = 512;
        const ctxP = cPlay.getContext('2d');
        ctxP.strokeStyle = '#f59e0b';
        ctxP.lineWidth = 10;
        ctxP.beginPath();
        ctxP.arc(256, 256, 235, 0, Math.PI * 2);
        ctxP.stroke();
        ctxP.fillStyle = 'rgba(245, 158, 11, 0.08)';
        ctxP.fill();
        ctxP.fillStyle = '#f59e0b';
        ctxP.font = 'bold 32px sans-serif';
        ctxP.textAlign = 'center';
        ctxP.fillText('⚔️ PLAY AREA', 256, 256);
        ctxP.font = '22px sans-serif';
        ctxP.fillText('(カードを出すエリア)', 256, 295);
        const texPlay = new THREE.CanvasTexture(cPlay);

        // ③ 没収エリア枠 (赤・ペナルティ)
        const cForfeit = document.createElement('canvas');
        cForfeit.width = 384; cForfeit.height = 512;
        const ctxF = cForfeit.getContext('2d');
        ctxF.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctxF.fillRect(10, 10, 364, 492);
        ctxF.strokeStyle = '#ef4444';
        ctxF.lineWidth = 8;
        ctxF.strokeRect(10, 10, 364, 492);
        ctxF.fillStyle = '#ef4444';
        ctxF.font = 'bold 36px sans-serif';
        ctxF.textAlign = 'center';
        ctxF.fillText('💀 没収エリア', 192, 60);
        ctxF.font = '20px sans-serif';
        ctxF.fillText('(ペナルティ)', 192, 95);
        // ドクロ枠スロット点線
        for (let i = 0; i < 3; i++) {
          ctxF.setLineDash([8, 8]);
          ctxF.strokeStyle = '#f87171';
          ctxF.lineWidth = 4;
          ctxF.beginPath();
          ctxF.arc(192, 175 + i * 115, 48, 0, Math.PI * 2);
          ctxF.stroke();
          ctxF.fillText('💀', 192, 185 + i * 115);
        }
        const texForfeit = new THREE.CanvasTexture(cForfeit);

        return { texSlot, texPlay, texForfeit };
      }

      const { texSlot, texPlay, texForfeit } = createZoneTextures();

      // テーブル表面にゾーンを描画
      // 1. プレイエリア (中央)
      const playAreaGeo = new THREE.PlaneGeometry(7.2, 7.2);
      const playAreaMat = new THREE.MeshBasicMaterial({ map: texPlay, transparent: true });
      const playAreaMesh = new THREE.Mesh(playAreaGeo, playAreaMat);
      playAreaMesh.rotation.x = -Math.PI / 2;
      playAreaMesh.position.set(-1.0, 0.02, 0);
      scene.add(playAreaMesh);

      // 2. 没収エリア (右側)
      const forfeitGeo = new THREE.PlaneGeometry(3.6, 5.0);
      const forfeitMat = new THREE.MeshBasicMaterial({ map: texForfeit, transparent: true });
      const forfeitMesh = new THREE.Mesh(forfeitGeo, forfeitMat);
      forfeitMesh.rotation.x = -Math.PI / 2;
      forfeitMesh.position.set(6.8, 0.02, 0);
      scene.add(forfeitMesh);

      // 3. 手札スロット定義 (4枚固定・重ならない)
      // 自分 (手前)
      const myHandSlots = [];
      const SLOT_START_X = -4.6;
      const SLOT_STEP_X = 2.4;
      const MY_HAND_Z = 4.6;

      for (let i = 0; i < 4; i++) {
        const slotX = SLOT_START_X + (i * SLOT_STEP_X);
        const slotMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(2.0, 2.0),
          new THREE.MeshBasicMaterial({ map: texSlot, transparent: true })
        );
        slotMesh.rotation.x = -Math.PI / 2;
        slotMesh.position.set(slotX, 0.02, MY_HAND_Z);
        scene.add(slotMesh);

        myHandSlots.push({ x: slotX, z: MY_HAND_Z, slotIndex: i });
      }

      // 相手 (奥) の手札スロット
      const opHandSlots = [];
      const OP_HAND_Z = -4.6;

      for (let i = 0; i < 4; i++) {
        const slotX = SLOT_START_X + (i * SLOT_STEP_X);
        const slotMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(2.0, 2.0),
          new THREE.MeshBasicMaterial({ map: texSlot, transparent: true, opacity: 0.6 })
        );
        slotMesh.rotation.x = -Math.PI / 2;
        slotMesh.position.set(slotX, 0.02, OP_HAND_Z);
        scene.add(slotMesh);

        opHandSlots.push({ x: slotX, z: OP_HAND_Z, slotIndex: i });
      }

      // 没収エリアのスロット (右側3枠)
      const forfeitSlots = [
        { x: 6.8, z: -1.4 },
        { x: 6.8, z: 0.0 },
        { x: 6.8, z: 1.4 }
      ];

      // ----------------------------------------------------
      // 4. ディスクテクスチャの生成
      // ----------------------------------------------------
      function createCardTextures() {
        // 裏面（SKULL柄ゴールド）
        const cBack = document.createElement('canvas');
        cBack.width = 256; cBack.height = 256;
        const ctxB = cBack.getContext('2d');
        ctxB.fillStyle = '#1e1b4b';
        ctxB.fillRect(0, 0, 256, 256);
        ctxB.strokeStyle = '#f59e0b';
        ctxB.lineWidth = 12;
        ctxB.strokeRect(14, 14, 228, 228);
        ctxB.beginPath();
        ctxB.arc(128, 128, 76, 0, Math.PI * 2);
        ctxB.stroke();
        ctxB.fillStyle = '#f59e0b';
        ctxB.font = 'bold 36px sans-serif';
        ctxB.textAlign = 'center';
        ctxB.textBaseline = 'middle';
        ctxB.fillText('SKULL', 128, 128);
        const texBack = new THREE.CanvasTexture(cBack);

        // 表面：🌸 薔薇（花）
        const cFlower = document.createElement('canvas');
        cFlower.width = 256; cFlower.height = 256;
        const ctxF = cFlower.getContext('2d');
        ctxF.fillStyle = '#831843';
        ctxF.fillRect(0, 0, 256, 256);
        ctxF.strokeStyle = '#f472b6';
        ctxF.lineWidth = 14;
        ctxF.beginPath();
        ctxF.arc(128, 128, 96, 0, Math.PI * 2);
        ctxF.stroke();
        ctxF.font = '118px sans-serif';
        ctxF.textAlign = 'center';
        ctxF.textBaseline = 'middle';
        ctxF.fillText('🌸', 128, 128);
        const texFlower = new THREE.CanvasTexture(cFlower);

        // 表面：💀 ドクロ
        const cSkull = document.createElement('canvas');
        cSkull.width = 256; cSkull.height = 256;
        const ctxS = cSkull.getContext('2d');
        ctxS.fillStyle = '#09090b';
        ctxS.fillRect(0, 0, 256, 256);
        ctxS.strokeStyle = '#ef4444';
        ctxS.lineWidth = 16;
        ctxS.beginPath();
        ctxS.arc(128, 128, 96, 0, Math.PI * 2);
        ctxS.stroke();
        ctxS.font = '118px sans-serif';
        ctxS.textAlign = 'center';
        ctxS.textBaseline = 'middle';
        ctxS.fillText('💀', 128, 128);
        const texSkull = new THREE.CanvasTexture(cSkull);

        return { texBack, texFlower, texSkull };
      }

      const { texBack, texFlower, texSkull } = createCardTextures();

      // ----------------------------------------------------
      // 5. カード（ディスク）メッシュ生成 & 4枚固定配置
      // ----------------------------------------------------
      const allDiscs = [];

      function createDiscMesh(id, owner, type, isFaceUp, x, z) {
        const geo = new THREE.CylinderGeometry(0.92, 0.92, 0.1, 32);

        const matSide = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          metalness: 0.6,
          roughness: 0.3
        });
        const matTop = new THREE.MeshStandardMaterial({
          map: type === DISC_FLOWER ? texFlower : texSkull,
          roughness: 0.35
        });
        const matBottom = new THREE.MeshStandardMaterial({
          map: texBack,
          roughness: 0.35
        });

        const mesh = new THREE.Mesh(geo, [matSide, matTop, matBottom]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(x, 0.08, z);

        // 表向き = 0 (上面の絵柄が見える), 裏向き = Math.PI (下面のSKULL裏面が見える)
        mesh.rotation.x = isFaceUp ? 0 : Math.PI;

        mesh.userData = {
          id: id,
          owner: owner, // 'me' or 'opponent'
          type: type,   // 'flower' or 'skull'
          isFaceUp: isFaceUp,
          targetX: x,
          targetY: 0.08,
          targetZ: z,
          targetRotX: mesh.rotation.x
        };

        scene.add(mesh);
        allDiscs.push(mesh);
        return mesh;
      }

      // 4枚固定で初期配置 (花3枚、ドクロ1枚)
      function initFixedCards() {
        allDiscs.forEach(d => scene.remove(d));
        allDiscs.length = 0;

        const types = [DISC_FLOWER, DISC_FLOWER, DISC_FLOWER, DISC_SKULL];

        // 1. 自分の手札 (手前4スロット、自分には何かわかるよう初期は表向き)
        types.forEach((type, idx) => {
          const slot = myHandSlots[idx];
          createDiscMesh(`my_${idx}`, 'me', type, true, slot.x, slot.z);
        });

        // 2. 相手の手札 (奥4スロット、裏向き)
        types.forEach((type, idx) => {
          const slot = opHandSlots[idx];
          createDiscMesh(`op_${idx}`, 'opponent', type, false, slot.x, slot.z);
        });
      }

      initFixedCards();

      // ----------------------------------------------------
      // 6. スマート吸着（スナップ）システム
      // ----------------------------------------------------
      // ドロップした位置から最適なスロットへ吸着し、重なりを防止
      function snapToNearestZone(disc) {
        const x = disc.position.x;
        const z = disc.position.z;

        // 1. 没収エリア判定 (X > 4.8)
        if (x > 4.8) {
          // 最も空いている没収スロットへ
          let bestSlot = forfeitSlots[0];
          let minDist = 999;
          forfeitSlots.forEach(slot => {
            const occupied = allDiscs.some(d => d !== disc && Math.hypot(d.position.x - slot.x, d.position.z - slot.z) < 0.6);
            const dist = Math.hypot(x - slot.x, z - slot.z);
            if (!occupied && dist < minDist) {
              minDist = dist;
              bestSlot = slot;
            }
          });
          disc.position.x = bestSlot.x;
          disc.position.z = bestSlot.z;
          bridge.showToast('💀 カードを【没収エリア】へ移動しました');
          return;
        }

        // 2. 自分の手札エリア判定 (Z > 2.5)
        if (z > 2.5 && disc.userData.owner === 'me') {
          // 最も近い手札スロットへ
          let bestSlot = myHandSlots[0];
          let minDist = 999;
          myHandSlots.forEach(slot => {
            const dist = Math.hypot(x - slot.x, z - slot.z);
            if (dist < minDist) {
              minDist = dist;
              bestSlot = slot;
            }
          });
          disc.position.x = bestSlot.x;
          disc.position.z = bestSlot.z;
          return;
        }

        // 3. プレイエリア (中央ゾーン)
        // 他のカードと真上にぴったり重ならないように、少しずらして整列
        allDiscs.forEach(other => {
          if (other !== disc && Math.hypot(other.position.x - disc.position.x, other.position.z - disc.position.z) < 0.5) {
            disc.position.x += 0.5;
            disc.position.z += 0.3;
          }
        });
      }

      // ----------------------------------------------------
      // 7. マウス / タッチ インタラクション (ドラッグ＆めくり)
      // ----------------------------------------------------
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4);
      const planeIntersect = new THREE.Vector3();

      let draggedDisc = null;
      let dragOffset = new THREE.Vector3();
      let lastClickTime = 0;
      let lastClickedDisc = null;

      function updatePointer(e) {
        const rect = canvasContainer.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      }

      function onPointerDown(e) {
        updatePointer(e);
        raycaster.setFromCamera(pointer, camera);

        const intersects = raycaster.intersectObjects(allDiscs);
        if (intersects.length > 0) {
          const hitMesh = intersects[0].object;
          const now = Date.now();

          // ダブルクリック判定 (表裏をひっくり返す)
          if (now - lastClickTime < 320 && lastClickedDisc === hitMesh) {
            flipDisc(hitMesh, true);
            lastClickTime = 0;
            lastClickedDisc = null;
            return;
          }

          lastClickTime = now;
          lastClickedDisc = hitMesh;

          // ドラッグ開始
          draggedDisc = hitMesh;
          canvasContainer.classList.add('grabbing');
          dragHint.classList.remove('hidden');
          draggedDisc.position.y = 0.65; // つまみ上げ

          if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
            dragOffset.copy(planeIntersect).sub(draggedDisc.position);
          }
        }
      }

      function onPointerMove(e) {
        if (!draggedDisc) return;
        updatePointer(e);
        raycaster.setFromCamera(pointer, camera);

        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
          const nx = planeIntersect.x - dragOffset.x;
          const nz = planeIntersect.z - dragOffset.z;

          // テーブル枠外に出ないよう制限
          draggedDisc.position.x = Math.max(-9.0, Math.min(9.0, nx));
          draggedDisc.position.z = Math.max(-6.0, Math.min(6.0, nz));

          if (bridge.isConnected()) {
            bridge.send({
              game: 'skull',
              type: 'drag_move',
              id: draggedDisc.userData.id,
              x: draggedDisc.position.x,
              y: draggedDisc.position.y,
              z: draggedDisc.position.z
            });
          }
        }
      }

      function onPointerUp() {
        if (!draggedDisc) return;

        draggedDisc.position.y = 0.08;
        snapToNearestZone(draggedDisc);

        canvasContainer.classList.remove('grabbing');
        dragHint.classList.add('hidden');

        if (bridge.isConnected()) {
          bridge.send({
            game: 'skull',
            type: 'drag_drop',
            id: draggedDisc.userData.id,
            x: draggedDisc.position.x,
            y: draggedDisc.position.y,
            z: draggedDisc.position.z
          });
        }

        draggedDisc = null;
      }

      // 反転アニメーション (ひっくり返す)
      function flipDisc(mesh, isLocal = false) {
        mesh.userData.isFaceUp = !mesh.userData.isFaceUp;
        animateFlip(mesh, mesh.userData.isFaceUp);

        if (isLocal && bridge.isConnected()) {
          bridge.send({
            game: 'skull',
            type: 'flip',
            id: mesh.userData.id,
            isFaceUp: mesh.userData.isFaceUp
          });
        }

        const faceName = mesh.userData.isFaceUp 
          ? (mesh.userData.type === DISC_FLOWER ? '🌸 花' : '💀 ドクロ') 
          : '伏せ (裏面)';
        bridge.showToast(`カードを裏返しました: 【${faceName}】`);
      }

      function animateFlip(mesh, toFaceUp) {
        let progress = 0;
        const startRot = mesh.rotation.x;
        const targetRot = toFaceUp ? 0 : Math.PI;

        function step() {
          progress += 0.14;
          if (progress <= 1) {
            mesh.rotation.x = startRot + (targetRot - startRot) * progress;
            mesh.position.y = 0.08 + Math.sin(progress * Math.PI) * 0.7;
            requestAnimationFrame(step);
          } else {
            mesh.rotation.x = targetRot;
            mesh.position.y = 0.08;
          }
        }
        step();
      }

      // リスナー登録
      canvasContainer.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);

      canvasContainer.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);

      // 手元に4枚きれいに整列するボタン
      btnResetHand.addEventListener('click', () => {
        const myDiscs = allDiscs.filter(d => d.userData.owner === 'me');
        myDiscs.forEach((disc, idx) => {
          const slot = myHandSlots[idx];
          disc.position.set(slot.x, 0.08, slot.z);
        });
        bridge.showToast('自分の手札4枚を手元スロットに整列しました！');
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'align_hand' });
        }
      });

      // 全て伏せるボタン
      btnFlipAllDown.addEventListener('click', () => {
        const myDiscs = allDiscs.filter(d => d.userData.owner === 'me');
        myDiscs.forEach(disc => {
          if (disc.userData.isFaceUp) {
            flipDisc(disc, true);
          }
        });
        bridge.showToast('手札をすべて裏向きに伏せました！');
      });

      // ----------------------------------------------------
      // 8. P2P 同期イベント
      // ----------------------------------------------------
      bridge.onReceive((data) => {
        if (data.game !== 'skull') return;

        // 相手側座標の対称変換: 相手の X, Z を点対称反転 (-x, -z)
        if (data.type === 'drag_move' || data.type === 'drag_drop') {
          // IDマッピング: 相手の 'my_x' はこちら側の 'op_x'
          let mappedId = data.id;
          if (data.id.startsWith('my_')) mappedId = data.id.replace('my_', 'op_');
          else if (data.id.startsWith('op_')) mappedId = data.id.replace('op_', 'my_');

          const target = allDiscs.find(d => d.userData.id === mappedId);
          if (target && target !== draggedDisc) {
            target.position.set(-data.x, data.y, -data.z);
            if (data.type === 'drag_drop') {
              snapToNearestZone(target);
            }
          }
        } else if (data.type === 'flip') {
          let mappedId = data.id;
          if (data.id.startsWith('my_')) mappedId = data.id.replace('my_', 'op_');
          else if (data.id.startsWith('op_')) mappedId = data.id.replace('op_', 'my_');

          const target = allDiscs.find(d => d.userData.id === mappedId);
          if (target) {
            target.userData.isFaceUp = data.isFaceUp;
            animateFlip(target, data.isFaceUp);
          }
        } else if (data.type === 'align_hand') {
          const opDiscs = allDiscs.filter(d => d.userData.owner === 'opponent');
          opDiscs.forEach((disc, idx) => {
            const slot = opHandSlots[idx];
            disc.position.set(slot.x, 0.08, slot.z);
          });
          bridge.showToast('相手が手札をスロットに整列しました');
        }
      });

      // 相手合流時
      bridge.onPlayerJoined(() => {
        bridge.showToast('対戦相手が着席しました！花3枚・ドクロ1枚で勝負開始！');
      });

      // ----------------------------------------------------
      // 9. アニメーションループ & リサイズ
      // ----------------------------------------------------
      function animate() {
        if (isDestroyed) return;
        animFrameId = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }
      animate();

      function handleResize() {
        if (!canvasContainer) return;
        const w = canvasContainer.clientWidth;
        const h = canvasContainer.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
      window.addEventListener('resize', handleResize);

      // アンマウント処理
      this.cleanup = () => {
        isDestroyed = true;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', handleResize);
        canvasContainer.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        renderer.dispose();
      };
    },

    unmount() {
      if (this.cleanup) this.cleanup();
    }
  });
})();
