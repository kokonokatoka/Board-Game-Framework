/**
 * 💀 3D スカル (Skull / 髑髏と薔薇) - 卓上シームレスシミュレーター
 * Board Arena Plugin
 * 
 * 仕様:
 * - ボタン操作・手番制御の制約を全撤廃！完全にリアルなボードゲーム卓上を再現！
 * - 回転をやめて正面固定のカジノテーブル（最大8席）
 * - 自陣（手前）に4枚のディスク（花3枚、ドクロ1枚）が並ぶ
 * - 【ドラッグ＆ドロップ】マウスでディスクを掴んでテーブル中央へシームレスに配置！
 * - 【相手からは見えない】手元のディスクは自分にだけ絵柄が見え、相手の画面からは裏面に見える！
 * - 【ダブルクリックで反転】ディスクをダブルクリックすると、くるっとめくれて表面が全員に公開！
 * - リアルタイムP2P同期（ディスクの移動・めくりが全員の画面に即時反映）
 */

(function () {
  const MAX_SEATS = 8;
  const DISC_FLOWER = 'flower';
  const DISC_SKULL = 'skull';

  window.BoardArena.registerGame({
    id: 'skull',
    name: '3Dスカル (Skull)',
    icon: '💀',
    category: '3D・カジノ・ブラフ',
    minPlayers: 2,
    maxPlayers: 8,
    description: 'ボタン操作撤廃！手札を掴んでドラッグ＆ドロップで場に出し、ダブルクリックでめくる本格卓上3Dスカル！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;

      // HTML UI (超シンプル＆直感的)
      container.innerHTML = `
        <div class="skull-wrapper">
          <!-- 上部インフォバー -->
          <div class="skull-status-bar">
            <div class="skull-guide-badge">
              🖐️ <strong>操作方法:</strong> ディスクをドラッグして移動 / <strong>ダブルクリック</strong>で裏返す
            </div>
            <div class="skull-top-actions">
              <button id="btn-collect-discs" class="btn btn-sm btn-subtle" title="全員のディスクを手元に回収・整列します">🔄 手元に配り直す</button>
            </div>
          </div>

          <!-- 3D Canvas レンダリング領域 -->
          <div class="skull-canvas-container" id="skull-3d-container">
            <div class="table-center-logo">💀 SKULL TABLE</div>
            <div id="drag-hint" class="drag-hint hidden">掴み中</div>
          </div>
        </div>
      `;

      // スタイル定義
      if (!document.getElementById('skull-custom-css')) {
        const style = document.createElement('style');
        style.id = 'skull-custom-css';
        style.textContent = `
          .skull-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 900px;
            margin: 0 auto;
            user-select: none;
            color: #f1f5f9;
          }

          .skull-status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #2b384a;
            font-size: 13px;
          }

          .skull-guide-badge {
            color: #facc15;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          /* 3D Canvas コンテナ */
          .skull-canvas-container {
            width: 100%;
            height: 520px;
            background: radial-gradient(circle at center, #111827, #030712);
            border-radius: 14px;
            border: 2px solid #374151;
            position: relative;
            overflow: hidden;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
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

          .table-center-logo {
            position: absolute;
            top: 14px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(6px);
            padding: 4px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 1.5px;
            color: #fef08a;
            border: 1px solid rgba(254, 240, 138, 0.25);
            pointer-events: none;
            z-index: 10;
          }

          .drag-hint {
            position: absolute;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.75);
            color: #38bdf8;
            font-size: 12px;
            padding: 4px 12px;
            border-radius: 12px;
            pointer-events: none;
          }
          .drag-hint.hidden { display: none; }

          @media (max-width: 640px) {
            .skull-canvas-container { height: 420px; }
            .skull-status-bar { flex-direction: column; gap: 8px; align-items: flex-start; }
          }
        `;
        document.head.appendChild(style);
      }

      const canvasContainer = container.querySelector('#skull-3d-container');
      const btnCollectDiscs = container.querySelector('#btn-collect-discs');
      const dragHint = container.querySelector('#drag-hint');

      // ----------------------------------------------------
      // 1. Three.js シーン初期化 (回転なし・固定カメラ)
      // ----------------------------------------------------
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050811, 0.02);

      const camera = new THREE.PerspectiveCamera(
        45,
        canvasContainer.clientWidth / canvasContainer.clientHeight,
        0.1,
        1000
      );
      // 手前の自陣とテーブル全体が一番見やすい固定角度
      camera.position.set(0, 18, 16);
      camera.lookAt(0, -1, -0.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvasContainer.appendChild(renderer.domElement);

      // ライト
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
      scene.add(ambientLight);

      const spotLight = new THREE.SpotLight(0xfff5ea, 1.3);
      spotLight.position.set(0, 22, 0);
      spotLight.angle = Math.PI / 3;
      spotLight.penumbra = 0.4;
      spotLight.castShadow = true;
      scene.add(spotLight);

      const warmLight = new THREE.PointLight(0xf59e0b, 0.7, 30);
      warmLight.position.set(0, 8, 4);
      scene.add(warmLight);

      // カジノテーブル (固定・回転しない)
      const tableGroup = new THREE.Group();

      // 天板グリーンフェルト
      const feltGeo = new THREE.CylinderGeometry(8.2, 8.2, 0.4, 64);
      const feltMat = new THREE.MeshStandardMaterial({
        color: 0x14532d,
        roughness: 0.85,
        metalness: 0.05
      });
      const feltMesh = new THREE.Mesh(feltGeo, feltMat);
      feltMesh.receiveShadow = true;
      feltMesh.position.y = -0.2;
      tableGroup.add(feltMesh);

      // マホガニーレール
      const railGeo = new THREE.TorusGeometry(8.4, 0.45, 16, 64);
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x451a03,
        roughness: 0.35,
        metalness: 0.15
      });
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.rotation.x = Math.PI / 2;
      railMesh.position.y = 0.05;
      railMesh.receiveShadow = true;
      tableGroup.add(railMesh);

      scene.add(tableGroup);

      // 8席のコースター（マット）を配置
      const seatPositions = [];
      const TABLE_RADIUS = 5.2;

      for (let i = 0; i < MAX_SEATS; i++) {
        // Seat 0 を手前（自分）、時計回りに配置
        const angle = -Math.PI / 2 + (i * (2 * Math.PI / MAX_SEATS));
        const cx = Math.cos(angle) * TABLE_RADIUS;
        const cz = Math.sin(angle) * TABLE_RADIUS;

        // コースター（マット）
        const coasterGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.04, 32);
        const coasterMat = new THREE.MeshStandardMaterial({
          color: i === 0 ? 0x1e3a8a : 0x1e293b,
          roughness: 0.7,
          metalness: 0.1
        });
        const coasterMesh = new THREE.Mesh(coasterGeo, coasterMat);
        coasterMesh.position.set(cx, 0.02, cz);
        coasterMesh.receiveShadow = true;
        scene.add(coasterMesh);

        seatPositions.push({ x: cx, z: cz, angle: angle });
      }

      // ----------------------------------------------------
      // 2. ディスクテクスチャの作成
      // ----------------------------------------------------
      function createTextures() {
        // 裏面（SKULL柄ゴールド）
        const cBack = document.createElement('canvas');
        cBack.width = 256; cBack.height = 256;
        const ctxB = cBack.getContext('2d');
        ctxB.fillStyle = '#1e1b4b';
        ctxB.fillRect(0, 0, 256, 256);
        ctxB.strokeStyle = '#f59e0b';
        ctxB.lineWidth = 10;
        ctxB.strokeRect(16, 16, 224, 224);
        ctxB.beginPath();
        ctxB.arc(128, 128, 75, 0, Math.PI * 2);
        ctxB.stroke();
        ctxB.fillStyle = '#f59e0b';
        ctxB.font = 'bold 38px sans-serif';
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
        ctxF.lineWidth = 12;
        ctxF.beginPath();
        ctxF.arc(128, 128, 95, 0, Math.PI * 2);
        ctxF.stroke();
        ctxF.font = '115px sans-serif';
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
        ctxS.lineWidth = 14;
        ctxS.beginPath();
        ctxS.arc(128, 128, 95, 0, Math.PI * 2);
        ctxS.stroke();
        ctxS.font = '115px sans-serif';
        ctxS.textAlign = 'center';
        ctxS.textBaseline = 'middle';
        ctxS.fillText('💀', 128, 128);
        const texSkull = new THREE.CanvasTexture(cSkull);

        return { texBack, texFlower, texSkull };
      }

      const { texBack, texFlower, texSkull } = createTextures();

      // ----------------------------------------------------
      // 3. 全プレイヤーのディスク管理
      // ----------------------------------------------------
      // 全ディスクメッシュ配列
      const allDiscs = [];

      // ディスクメッシュ生成
      // ownerSeat: 0 (自分), 1〜7 (他人)
      // discType: 'flower' or 'skull'
      function createDisc(id, ownerSeat, discType, initPos, isFaceUp = false) {
        const geo = new THREE.CylinderGeometry(0.85, 0.85, 0.08, 32);

        // マテリアル設定:
        // [側面, 上面, 下面]
        // 相手の画面からは手札の中身は見えない（裏面）！
        // 自分の画面（ownerSeat === 0）では、手元にある時も自分には何かわかるように上面にテクスチャを設定
        const isMyDisc = ownerSeat === 0;

        const matSide = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.5, roughness: 0.3 });
        const matTop = new THREE.MeshStandardMaterial({
          map: discType === DISC_FLOWER ? texFlower : texSkull,
          roughness: 0.4
        });
        const matBottom = new THREE.MeshStandardMaterial({
          map: texBack,
          roughness: 0.4
        });

        const mesh = new THREE.Mesh(geo, [matSide, matTop, matBottom]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.position.copy(initPos);

        // 表向き/裏向きの初期回転
        // isFaceUp = true ➔ 上面(絵柄)が上
        // isFaceUp = false ➔ 下面(裏面柄)が上 (X軸を180度反転)
        mesh.rotation.x = isFaceUp ? 0 : Math.PI;

        mesh.userData = {
          id: id,
          ownerSeat: ownerSeat,
          discType: discType,
          isFaceUp: isFaceUp,
          initPos: initPos.clone(),
          targetPos: initPos.clone(),
          targetRotX: mesh.rotation.x
        };

        scene.add(mesh);
        allDiscs.push(mesh);
        return mesh;
      }

      // 全プレイヤーのディスクを自陣手元に初期配置
      function resetAllDiscsToHand() {
        // 既存メッシュ削除
        allDiscs.forEach(m => scene.remove(m));
        allDiscs.length = 0;

        // 最大8席のプレイヤーに各4枚配る
        for (let seat = 0; seat < MAX_SEATS; seat++) {
          const sPos = seatPositions[seat];

          // 自陣手元エリアのオフセット計算
          // Seat 0 (自分) は画面手前下側に横1列に4枚綺麗に並べる！
          if (seat === 0) {
            const types = [DISC_FLOWER, DISC_FLOWER, DISC_FLOWER, DISC_SKULL];
            const startX = -2.8;
            const stepX = 1.85;

            types.forEach((type, idx) => {
              const pos = new THREE.Vector3(startX + (idx * stepX), 0.08, 6.8);
              // 自分には手元で何かわかるように【表向き】で手元に並べる！
              createDisc(`disc_${seat}_${idx}`, seat, type, pos, true);
            });
          } else {
            // 他の座席 (1〜7): 各席の後ろ側に伏せて4枚並べる
            const types = [DISC_FLOWER, DISC_FLOWER, DISC_FLOWER, DISC_SKULL];
            const angle = sPos.angle;
            const dist = TABLE_RADIUS + 1.6;

            types.forEach((type, idx) => {
              const spread = (idx - 1.5) * 0.45;
              const ox = Math.cos(angle) * dist + Math.sin(angle) * spread;
              const oz = Math.sin(angle) * dist - Math.cos(angle) * spread;
              const pos = new THREE.Vector3(ox, 0.08, oz);

              // 相手のディスクは自分からは【裏向き】に見える！
              createDisc(`disc_${seat}_${idx}`, seat, type, pos, false);
            });
          }
        }
      }

      // ----------------------------------------------------
      // 4. ドラッグ＆ドロップ ＆ ダブルクリック反転
      // ----------------------------------------------------
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      // 水平ドラッグ用平面 (y = 0.4)
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35);
      const planeIntersect = new THREE.Vector3();

      let draggedDisc = null;
      let dragOffset = new THREE.Vector3();
      let lastClickTime = 0;
      let lastClickedDisc = null;

      // 座標変換
      function setPointerCoords(e) {
        const rect = canvasContainer.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      }

      // マウス/タッチダウン (掴む / ダブルクリック判定)
      function onPointerDown(e) {
        setPointerCoords(e);
        raycaster.setFromCamera(pointer, camera);

        const intersects = raycaster.intersectObjects(allDiscs);
        if (intersects.length > 0) {
          const hitMesh = intersects[0].object;
          const now = Date.now();

          // ダブルクリック判定 (300ms以内の連続タップ)
          if (now - lastClickTime < 320 && lastClickedDisc === hitMesh) {
            // ★ ダブルクリックで反転 (ひっくり返す)！
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

          // 少し持ち上げる
          draggedDisc.position.y = 0.55;

          // 平面との交点をオフセットとして記憶
          if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
            dragOffset.copy(planeIntersect).sub(draggedDisc.position);
          }
        }
      }

      // マウス/タッチ移動 (ドラッグ移動)
      function onPointerMove(e) {
        if (!draggedDisc) return;
        setPointerCoords(e);
        raycaster.setFromCamera(pointer, camera);

        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
          const targetX = planeIntersect.x - dragOffset.x;
          const targetZ = planeIntersect.z - dragOffset.z;

          draggedDisc.position.x = targetX;
          draggedDisc.position.z = targetZ;

          // P2P リアルタイム同期送信
          if (bridge.isConnected()) {
            bridge.send({
              game: 'skull',
              type: 'drag_move',
              id: draggedDisc.userData.id,
              x: targetX,
              y: draggedDisc.position.y,
              z: targetZ
            });
          }
        }
      }

      // マウス/タッチアップ (着地)
      function onPointerUp(e) {
        if (!draggedDisc) return;

        // テーブルに着地 (y = 0.08)
        draggedDisc.position.y = 0.08;
        canvasContainer.classList.remove('grabbing');
        dragHint.classList.add('hidden');

        // P2P 着地同期送信
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

      // ディスク反転処理 (ひっくり返す)
      function flipDisc(mesh, isLocal = false) {
        mesh.userData.isFaceUp = !mesh.userData.isFaceUp;

        // 反転アニメーション (180度回転)
        animateFlip(mesh, mesh.userData.isFaceUp);

        if (isLocal && bridge.isConnected()) {
          bridge.send({
            game: 'skull',
            type: 'flip',
            id: mesh.userData.id,
            isFaceUp: mesh.userData.isFaceUp
          });
        }

        const faceName = mesh.userData.isFaceUp ? (mesh.userData.discType === DISC_FLOWER ? '🌸 花' : '💀 ドクロ') : '伏せ(裏面)';
        bridge.showToast(`ディスクを裏返しました: 【${faceName}】`);
      }

      // スムーズ反転アニメーション
      function animateFlip(mesh, toFaceUp) {
        let progress = 0;
        const startRot = mesh.rotation.x;
        const targetRot = toFaceUp ? 0 : Math.PI;

        function step() {
          progress += 0.12;
          if (progress <= 1) {
            mesh.rotation.x = startRot + (targetRot - startRot) * progress;
            mesh.position.y = 0.08 + Math.sin(progress * Math.PI) * 0.6;
            requestAnimationFrame(step);
          } else {
            mesh.rotation.x = targetRot;
            mesh.position.y = 0.08;
          }
        }
        step();
      }

      // イベントリスナー登録 (マウス & スマホタッチ)
      canvasContainer.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);

      canvasContainer.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);

      // 手元に配り直すボタン
      btnCollectDiscs.addEventListener('click', () => {
        resetAllDiscsToHand();
        bridge.showToast('全ディスクを手元に配り直しました！');
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'reset_discs' });
        }
      });

      // ----------------------------------------------------
      // 5. P2P 同期イベント
      // ----------------------------------------------------
      bridge.onReceive((data) => {
        if (data.game !== 'skull') return;

        if (data.type === 'drag_move' || data.type === 'drag_drop') {
          const target = allDiscs.find(d => d.userData.id === data.id);
          if (target && target !== draggedDisc) {
            target.position.set(data.x, data.y, data.z);
          }
        } else if (data.type === 'flip') {
          const target = allDiscs.find(d => d.userData.id === data.id);
          if (target) {
            target.userData.isFaceUp = data.isFaceUp;
            animateFlip(target, data.isFaceUp);
          }
        } else if (data.type === 'reset_discs') {
          resetAllDiscsToHand();
          bridge.showToast('ホストがディスクを配り直しました！');
        }
      });

      // 相手合流イベント
      bridge.onPlayerJoined(() => {
        resetAllDiscsToHand();
        bridge.showToast('対戦相手が合流しました！3Dスカル卓へようこそ！');
      });

      // リサイズハンドラ
      function onResize() {
        if (!canvasContainer) return;
        const w = canvasContainer.clientWidth;
        const h = canvasContainer.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
      window.addEventListener('resize', onResize);

      // ----------------------------------------------------
      // 6. アニメーションレンダリングループ (回転なし・固定卓)
      // ----------------------------------------------------
      function animate() {
        if (isDestroyed) return;
        animFrameId = requestAnimationFrame(animate);

        // ※テーブルの自動回転は完全停止！正面固定！

        renderer.render(scene, camera);
      }

      // 初期化実行
      resetAllDiscsToHand();
      animate();

      // アンマウント時クリーンアップ
      this.unmount = () => {
        isDestroyed = true;
        cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
        renderer.dispose();
      };
    },

    unmount() {
      if (this.unmount) this.unmount();
    }
  });
})();
