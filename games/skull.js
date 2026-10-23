/**
 * 💀 3D スカル (Skull / 髑髏と薔薇) - 最大8人マルチカジノ卓シミュレーター
 * Board Arena Plugin
 * 
 * 🌟 新仕様:
 * 1. 【最大8席の巨大円形カジノ卓】最初から広大な8席分のスペースを完全完備！
 * 2. 【未着席は完全グレーアウト】人がいない空席は暗い半透明グレーアウト（カードなしで視界スッキリ）！
 * 3. 【人数切り替えセレクター】上部バーで「👥 卓の人数 (2〜8人)」を自由に変更可能！
 *    - 参加人数分の席だけが鮮やかに点灯し、各席きっちり4枚固定でカードが配られます。
 * 4. 【全席に3大ゾーン完備】:
 *    - 🟦 手札エリア (重ならない4スロット)
 *    - ⚔️ 中央バトルエリア (カードを出す場)
 *    - 💀 没収エリア (失ったカードを置くペナルティスロット)
 * 5. 【スマート吸着スナップ】ドロップ時にスロットへ自動吸着し、重なりを防止！
 * 6. 【ダブルクリック反転】カードをダブルクリックするとくるっと表裏反転（めくり）！
 */

(function () {
  const MAX_SEATS = 8;
  const DISC_FLOWER = 'flower';
  const DISC_SKULL = 'skull';

  // 座席ごとのテーマカラー
  const SEAT_COLORS = [
    { name: 'あなた (P1)', hex: 0x38bdf8, css: '#38bdf8' }, // 青 (自分)
    { name: 'プレイヤー 2', hex: 0xf59e0b, css: '#f59e0b' }, // 橙
    { name: 'プレイヤー 3', hex: 0x10b981, css: '#10b981' }, // 緑
    { name: 'プレイヤー 4', hex: 0xa855f7, css: '#a855f7' }, // 紫
    { name: 'プレイヤー 5', hex: 0xec4899, css: '#ec4899' }, // ピンク
    { name: 'プレイヤー 6', hex: 0x06b6d4, css: '#06b6d4' }, // シアン
    { name: 'プレイヤー 7', hex: 0xeab308, css: '#eab308' }, // 黄
    { name: 'プレイヤー 8', hex: 0xef4444, css: '#ef4444' }  // 赤
  ];

  window.BoardArena.registerGame({
    id: 'skull',
    name: '3Dスカル (Skull)',
    icon: '💀',
    category: '3D・カジノ・ブラフ',
    minPlayers: 2,
    maxPlayers: 8,
    description: '最初から広大な8人席を用意！空席はグレーアウト、参加席だけ4枚点灯。手札・出す場・没収エリアを完備した本格卓上3Dスカル！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      let activePlayerCount = 2; // デフォルト2人対戦

      // HTML UI 構築
      container.innerHTML = `
        <div class="skull-wrapper">
          <!-- 上部コントロールバー -->
          <div class="skull-status-bar">
            <div class="skull-left-controls">
              <label class="players-select-label">
                👥 卓の参加人数:
                <select id="skull-player-count-select" class="skull-select">
                  <option value="2" selected>2人対戦 (1 vs 1)</option>
                  <option value="3">3人対戦</option>
                  <option value="4">4人対戦 (定番)</option>
                  <option value="5">5人対戦</option>
                  <option value="6">6人対戦 (本格)</option>
                  <option value="7">7人対戦</option>
                  <option value="8">8人対戦 (最大卓)</option>
                </select>
              </label>
              <span class="seat-badge-info" id="seat-badge-info">着席: 2 / 8 席 (6席グレーアウト中)</span>
            </div>

            <div class="skull-right-actions">
              <button id="btn-reset-hand" class="btn btn-sm btn-subtle" title="自分の手札4枚を手元スロットにきれいに整列します">🔄 手元に整列</button>
              <button id="btn-flip-all-down" class="btn btn-sm btn-subtle" title="手札を裏向きに伏せます">🎴 全て伏せる</button>
            </div>
          </div>

          <!-- 3D Canvas コンテナ (広大スペース) -->
          <div class="skull-canvas-container" id="skull-3d-container">
            <div class="table-center-tag">⚔️ BATTLE ZONE (中央プレイ場)</div>
            <div id="drag-hint" class="drag-hint hidden">カード掴み中</div>
          </div>

          <!-- 下部ガイドメッセージ -->
          <div class="skull-guide-footer">
            <span>🖐️ <strong>操作方法:</strong> カードをドラッグして場や没収エリアへ移動 / <strong>ダブルクリック</strong>で表裏をひっくり返す / 人数は上部で切替可能</span>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('skull-multiseat-css')) {
        const style = document.createElement('style');
        style.id = 'skull-multiseat-css';
        style.textContent = `
          .skull-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 1100px;
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
            flex-wrap: wrap;
            gap: 10px;
          }

          .skull-left-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .players-select-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            color: #fbbf24;
          }

          .skull-select {
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid #3b82f6;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            outline: none;
          }

          .seat-badge-info {
            font-size: 11px;
            color: #94a3b8;
            background: #1e293b;
            padding: 3px 8px;
            border-radius: 6px;
            border: 1px solid #334155;
          }

          .skull-right-actions {
            display: flex;
            gap: 8px;
          }

          /* 3D Canvas コンテナ (広大スペース) */
          .skull-canvas-container {
            width: 100%;
            height: 620px;
            background: radial-gradient(circle at center, #0e1726, #020617);
            border-radius: 16px;
            border: 2px solid #334155;
            position: relative;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
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

          .table-center-tag {
            position: absolute;
            top: 48%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(6px);
            padding: 4px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1px;
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
            pointer-events: none;
            z-index: 5;
          }

          .drag-hint {
            position: absolute;
            bottom: 25px;
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
            .skull-canvas-container { height: 480px; }
            .skull-status-bar { flex-direction: column; align-items: flex-start; }
          }
        `;
        document.head.appendChild(style);
      }

      const canvasContainer = container.querySelector('#skull-3d-container');
      const playerCountSelect = container.querySelector('#skull-player-count-select');
      const seatBadgeInfo = container.querySelector('#seat-badge-info');
      const btnResetHand = container.querySelector('#btn-reset-hand');
      const btnFlipAllDown = container.querySelector('#btn-flip-all-down');
      const dragHint = container.querySelector('#drag-hint');

      // ----------------------------------------------------
      // 1. Three.js シーン・広大カメラ・ライティング
      // ----------------------------------------------------
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x060913, 0.012);

      const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
      const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      
      // 全8席がゆったり見渡せる広角・高所カメラポジション
      camera.position.set(0, 26, 17);
      camera.lookAt(0, -0.5, 0.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvasContainer.appendChild(renderer.domElement);

      // ライト
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const spotLight = new THREE.SpotLight(0xfff7ed, 1.5);
      spotLight.position.set(0, 30, 0);
      spotLight.angle = Math.PI / 2.6;
      spotLight.penumbra = 0.5;
      spotLight.castShadow = true;
      scene.add(spotLight);

      const centerWarm = new THREE.PointLight(0xf59e0b, 0.9, 30);
      centerWarm.position.set(0, 6, 0);
      scene.add(centerWarm);

      // ----------------------------------------------------
      // 2. 超広大カジノテーブル (巨大円卓)
      // ----------------------------------------------------
      const tableGroup = new THREE.Group();
      const TABLE_RADIUS = 12.0;

      // 天板フェルト (上質な深緑)
      const tableGeo = new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.5, 64);
      const tableMat = new THREE.MeshStandardMaterial({
        color: 0x0f291e,
        roughness: 0.85,
        metalness: 0.05
      });
      const tableMesh = new THREE.Mesh(tableGeo, tableMat);
      tableMesh.position.y = -0.25;
      tableMesh.receiveShadow = true;
      tableGroup.add(tableMesh);

      // 外周レール (高級マホガニー材)
      const railGeo = new THREE.TorusGeometry(TABLE_RADIUS + 0.3, 0.5, 16, 64);
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x3b1d11,
        roughness: 0.35,
        metalness: 0.2
      });
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.rotation.x = Math.PI / 2;
      railMesh.position.y = 0.05;
      railMesh.receiveShadow = true;
      tableGroup.add(railMesh);

      scene.add(tableGroup);

      // ----------------------------------------------------
      // 3. テクスチャ生成 (カード・ゾーン・スロット)
      // ----------------------------------------------------
      function createTextures() {
        // ① 中央プレイエリア (バトルゾーン)
        const cPlay = document.createElement('canvas');
        cPlay.width = 512; cPlay.height = 512;
        const ctxP = cPlay.getContext('2d');
        ctxP.strokeStyle = '#f59e0b';
        ctxP.lineWidth = 10;
        ctxP.beginPath();
        ctxP.arc(256, 256, 240, 0, Math.PI * 2);
        ctxP.stroke();
        ctxP.fillStyle = 'rgba(245, 158, 11, 0.08)';
        ctxP.fill();
        ctxP.fillStyle = '#f59e0b';
        ctxP.font = 'bold 36px sans-serif';
        ctxP.textAlign = 'center';
        ctxP.fillText('⚔️ BATTLE ZONE', 256, 240);
        ctxP.font = '22px sans-serif';
        ctxP.fillText('(カードを出すエリア)', 256, 280);
        const texCenterPlay = new THREE.CanvasTexture(cPlay);

        // ② カード裏面 (ゴールド SKULL)
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

        // ③ カード表面：🌸 花
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

        // ④ カード表面：💀 ドクロ
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

        return { texCenterPlay, texBack, texFlower, texSkull };
      }

      const { texCenterPlay, texBack, texFlower, texSkull } = createTextures();

      // 中央バトルゾーンの配置
      const centerPlayGeo = new THREE.PlaneGeometry(8.5, 8.5);
      const centerPlayMat = new THREE.MeshBasicMaterial({ map: texCenterPlay, transparent: true });
      const centerPlayMesh = new THREE.Mesh(centerPlayGeo, centerPlayMat);
      centerPlayMesh.rotation.x = -Math.PI / 2;
      centerPlayMesh.position.set(0, 0.02, 0);
      scene.add(centerPlayMesh);

      // ----------------------------------------------------
      // 4. 全8席の座席オブジェクト群 (アクティブ vs グレーアウト)
      // ----------------------------------------------------
      // 各席の配置幾何学 (手前 Seat 0 から時計回りに8席)
      const seatData = [];
      const SEAT_DISTANCE = 8.8; // 中心からの距離

      for (let i = 0; i < MAX_SEATS; i++) {
        // Seat 0 を手前（angle = Math.PI / 2）
        const angle = Math.PI / 2 + (i * (2 * Math.PI / MAX_SEATS));
        const cx = Math.cos(angle) * SEAT_DISTANCE;
        const cz = Math.sin(angle) * SEAT_DISTANCE;

        seatData.push({
          index: i,
          angle: angle,
          cx: cx,
          cz: cz,
          info: SEAT_COLORS[i],
          isActive: i < activePlayerCount,
          slots: [],      // 手札スロット4つ
          forfeitSlot: null, // 没収スロット
          meshes: []      // ゾーン描画用メッシュ群 (グレーアウト切替用)
        });
      }

      // 座席マット & スロットの3Dメッシュ生成
      function buildSeatVisuals() {
        seatData.forEach((seat) => {
          const group = new THREE.Group();
          group.position.set(seat.cx, 0.03, seat.cz);
          // 席が常にテーブル中央を向くように回転
          group.rotation.y = -seat.angle - Math.PI / 2;

          // 席マット (長方形台座)
          const matCanvas = document.createElement('canvas');
          matCanvas.width = 512; matCanvas.height = 256;
          const ctxM = matCanvas.getContext('2d');
          
          // アクティブかグレーアウトか
          const isAct = seat.isActive;
          const colorHex = isAct ? seat.info.css : '#475569';
          const bgFill = isAct ? 'rgba(30, 41, 59, 0.75)' : 'rgba(15, 23, 42, 0.35)';

          ctxM.fillStyle = bgFill;
          ctxM.fillRect(10, 10, 492, 236);
          ctxM.strokeStyle = colorHex;
          ctxM.lineWidth = isAct ? 6 : 2;
          if (!isAct) ctxM.setLineDash([12, 10]);
          ctxM.strokeRect(10, 10, 492, 236);

          // 席ラベル
          ctxM.fillStyle = colorHex;
          ctxM.font = 'bold 28px sans-serif';
          ctxM.textAlign = 'left';
          const title = isAct ? seat.info.name : `⏳ 空席 (${seat.index + 1}番席)`;
          ctxM.fillText(title, 24, 45);

          if (isAct) {
            ctxM.font = '18px sans-serif';
            ctxM.fillStyle = '#94a3b8';
            ctxM.fillText('🟦 手札エリア (4枚)        💀 没収', 24, 75);
          } else {
            ctxM.font = '20px sans-serif';
            ctxM.fillStyle = '#64748b';
            ctxM.fillText('(参加待機中・グレーアウト)', 24, 75);
          }

          // 4つの手札スロット丸枠を描画
          for (let s = 0; s < 4; s++) {
            ctxM.beginPath();
            ctxM.arc(65 + s * 88, 150, 38, 0, Math.PI * 2);
            ctxM.strokeStyle = isAct ? colorHex : '#334155';
            ctxM.lineWidth = 3;
            ctxM.stroke();
            if (isAct) {
              ctxM.fillStyle = 'rgba(255, 255, 255, 0.05)';
              ctxM.fill();
            }
          }

          // 没収スロット枠
          ctxM.beginPath();
          ctxM.arc(435, 150, 42, 0, Math.PI * 2);
          ctxM.strokeStyle = isAct ? '#ef4444' : '#334155';
          ctxM.lineWidth = 3;
          ctxM.stroke();
          ctxM.font = '28px sans-serif';
          ctxM.textAlign = 'center';
          ctxM.fillText('💀', 435, 160);

          const texMat = new THREE.CanvasTexture(matCanvas);
          const matMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(5.2, 2.6),
            new THREE.MeshBasicMaterial({ map: texMat, transparent: true, opacity: isAct ? 1.0 : 0.4 })
          );
          matMesh.rotation.x = -Math.PI / 2;
          group.add(matMesh);

          scene.add(group);
          seat.meshes.push(group);

          // ワールド座標でのスロット位置を計算・保持 (スナップ・配置用)
          seat.slots = [];
          for (let s = 0; s < 4; s++) {
            // ローカル座標 (-1.95 + s * 0.9, 0, 0.25)
            const localPos = new THREE.Vector3(-1.85 + s * 0.9, 0, 0.2);
            localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
            localPos.add(group.position);
            seat.slots.push({ x: localPos.x, z: localPos.z, index: s });
          }

          // 没収スロットのワールド座標
          const localForfeit = new THREE.Vector3(1.95, 0, 0.2);
          localForfeit.applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
          localForfeit.add(group.position);
          seat.forfeitSlot = { x: localForfeit.x, z: localForfeit.z };
        });
      }

      buildSeatVisuals();

      // ----------------------------------------------------
      // 5. カード（ディスク）管理 & 4枚固定配り
      // ----------------------------------------------------
      const allDiscs = [];

      function createDiscMesh(id, seatIndex, type, isFaceUp, x, z) {
        const geo = new THREE.CylinderGeometry(0.85, 0.85, 0.09, 32);

        const matSide = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          metalness: 0.5,
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

        // 表向き = 0, 裏向き = Math.PI
        mesh.rotation.x = isFaceUp ? 0 : Math.PI;

        mesh.userData = {
          id: id,
          seatIndex: seatIndex,
          isMe: seatIndex === 0,
          type: type,
          isFaceUp: isFaceUp,
          targetX: x,
          targetY: 0.08,
          targetZ: z
        };

        scene.add(mesh);
        allDiscs.push(mesh);
        return mesh;
      }

      // 着席しているアクティブなプレイヤーのみにカードを配る（空席には配らない！）
      function refreshTableCards() {
        allDiscs.forEach(d => scene.remove(d));
        allDiscs.length = 0;

        const types = [DISC_FLOWER, DISC_FLOWER, DISC_FLOWER, DISC_SKULL];

        seatData.forEach(seat => {
          if (!seat.isActive) return; // 空席はカードなし！

          const isMe = seat.index === 0;
          types.forEach((type, idx) => {
            const slot = seat.slots[idx];
            // 自分(Seat 0)は手元で何かわかるように初期は表向き、相手は裏向き
            createDiscMesh(
              `disc_${seat.index}_${idx}`,
              seat.index,
              type,
              isMe ? true : false,
              slot.x,
              slot.z
            );
          });
        });

        // バッジ更新
        const activeCount = seatData.filter(s => s.isActive).length;
        if (seatBadgeInfo) {
          seatBadgeInfo.textContent = `着席: ${activeCount} / 8 席 (${8 - activeCount}席グレーアウト中)`;
        }
      }

      refreshTableCards();

      // 参加人数の変更処理
      function setPlayerCount(num) {
        activePlayerCount = Math.max(2, Math.min(8, num));
        
        // 既存の席ビジュアル削除
        seatData.forEach(s => {
          s.meshes.forEach(m => scene.remove(m));
          s.meshes.length = 0;
          s.isActive = s.index < activePlayerCount;
        });

        buildSeatVisuals();
        refreshTableCards();

        bridge.showToast(`卓の参加人数を【${activePlayerCount}人】に設定しました！`);
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'set_player_count', count: activePlayerCount });
        }
      }

      playerCountSelect.addEventListener('change', (e) => {
        setPlayerCount(parseInt(e.target.value, 10));
      });

      // ----------------------------------------------------
      // 6. スマート吸着スナップ (手札・中央・没収)
      // ----------------------------------------------------
      function snapToNearestZone(disc) {
        const x = disc.position.x;
        const z = disc.position.z;
        const seat = seatData[disc.userData.seatIndex];
        if (!seat) return;

        // 1. 没収エリア判定 (自分の没収スロット近く)
        const distForfeit = Math.hypot(x - seat.forfeitSlot.x, z - seat.forfeitSlot.z);
        if (distForfeit < 1.4) {
          disc.position.x = seat.forfeitSlot.x;
          disc.position.z = seat.forfeitSlot.z;
          bridge.showToast('💀 カードを【没収エリア】へ移動しました');
          return;
        }

        // 2. 自分の手札エリア判定 (手札スロット群の近く)
        let bestSlot = null;
        let minSlotDist = 999;
        seat.slots.forEach(slot => {
          const d = Math.hypot(x - slot.x, z - slot.z);
          if (d < minSlotDist) {
            minSlotDist = d;
            bestSlot = slot;
          }
        });

        if (bestSlot && minSlotDist < 1.6) {
          disc.position.x = bestSlot.x;
          disc.position.z = bestSlot.z;
          return;
        }

        // 3. 中央バトルエリア (重なり防止)
        allDiscs.forEach(other => {
          if (other !== disc && Math.hypot(other.position.x - disc.position.x, other.position.z - disc.position.z) < 0.5) {
            disc.position.x += 0.45;
            disc.position.z += 0.35;
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

          // ダブルクリック判定 (ひっくり返す)
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
          draggedDisc.position.y = 0.65; // 少し浮かせる

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

          // 円卓の半径内へ収める
          const distFromCenter = Math.hypot(nx, nz);
          if (distFromCenter < TABLE_RADIUS - 0.4) {
            draggedDisc.position.x = nx;
            draggedDisc.position.z = nz;
          }

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

      // イベントリスナー登録
      canvasContainer.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);

      canvasContainer.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);

      // 手元に整列ボタン (自分の手札4枚)
      btnResetHand.addEventListener('click', () => {
        const mySeat = seatData[0];
        const myDiscs = allDiscs.filter(d => d.userData.seatIndex === 0);
        myDiscs.forEach((disc, idx) => {
          const slot = mySeat.slots[idx];
          disc.position.set(slot.x, 0.08, slot.z);
        });
        bridge.showToast('自分の手札4枚を手元スロットに整列しました！');
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'align_hand', seatIndex: 0 });
        }
      });

      // 全て伏せるボタン
      btnFlipAllDown.addEventListener('click', () => {
        const myDiscs = allDiscs.filter(d => d.userData.seatIndex === 0);
        myDiscs.forEach(disc => {
          if (disc.userData.isFaceUp) {
            flipDisc(disc, true);
          }
        });
        bridge.showToast('自分の手札をすべて裏向きに伏せました！');
      });

      // ----------------------------------------------------
      // 8. P2P 同期イベント
      // ----------------------------------------------------
      bridge.onReceive((data) => {
        if (data.game !== 'skull') return;

        if (data.type === 'set_player_count') {
          activePlayerCount = data.count;
          if (playerCountSelect) playerCountSelect.value = data.count.toString();
          setPlayerCount(data.count);
        } else if (data.type === 'drag_move' || data.type === 'drag_drop') {
          const target = allDiscs.find(d => d.userData.id === data.id);
          if (target && target !== draggedDisc) {
            target.position.set(data.x, data.y, data.z);
            if (data.type === 'drag_drop') {
              snapToNearestZone(target);
            }
          }
        } else if (data.type === 'flip') {
          const target = allDiscs.find(d => d.userData.id === data.id);
          if (target) {
            target.userData.isFaceUp = data.isFaceUp;
            animateFlip(target, data.isFaceUp);
          }
        } else if (data.type === 'align_hand') {
          const seat = seatData[data.seatIndex];
          if (seat) {
            const discs = allDiscs.filter(d => d.userData.seatIndex === data.seatIndex);
            discs.forEach((disc, idx) => {
              const slot = seat.slots[idx];
              disc.position.set(slot.x, 0.08, slot.z);
            });
          }
        }
      });

      bridge.onPlayerJoined(() => {
        bridge.showToast('対戦相手が着席しました！');
      });

      // ----------------------------------------------------
      // 9. アニメーションレンダリング & リサイズ
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
