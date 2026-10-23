/**
 * 💀 3D スカル (Skull / 髑髏と薔薇) Component
 * Board Arena Plugin
 * 
 * Three.js を用いた本格3Dカジノテーブル！
 * 最大8人で囲む、世界最高峰のブラフ＆チキンレースボードゲーム！
 * 
 * 薔薇（花）を重ねてハッタリをかけ、ドクロを避けて目標枚数をめくり切れ！
 * 2回チャレンジ成功で完全勝利！ドクロを踏んだらディスクが散る！
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
    description: 'カジノテーブルで囲む至高の心理戦！花を仕込むかドクロを潜ませるか！？2回達成で大勝利！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;

      // プレイヤー情報管理 (最大8席)
      // 席 0: 自分 (ローカルプレイヤー)
      let players = [];
      let currentTurnSeat = 0;
      let phase = 'PLACING'; // 'PLACING' | 'BIDDING' | 'REVEALING' | 'ROUND_OVER' | 'GAME_OVER'
      let currentBid = 0;
      let highestBidder = null; // seat index
      let targetRevealCount = 0;
      let revealedCount = 0;
      let startPlayerSeat = 0;

      // HTML UI 構造
      container.innerHTML = `
        <div class="skull-wrapper">
          <!-- 上部ステータスバー -->
          <div class="skull-status-bar">
            <div class="turn-badge" id="skull-turn-badge">カードを配置してください</div>
            <div class="skull-bid-info" id="skull-bid-info">
              最高ビッド: <strong id="skull-highest-bid">なし</strong>
            </div>
            <div class="skull-phase-pill" id="skull-phase-pill">配置フェーズ</div>
          </div>

          <!-- 3D Canvas レンダリング領域 -->
          <div class="skull-canvas-container" id="skull-3d-container">
            <!-- 3Dオーバーレイ案内テキスト -->
            <div class="skull-center-announce" id="skull-announce">💀 3D SKULL TABLE</div>
          </div>

          <!-- 下部操作パネル (手札・アクションボタン) -->
          <div class="skull-controls-panel">
            <!-- 自分の手持ちディスク -->
            <div class="my-discs-area">
              <span class="ctrl-label">あなたの手札:</span>
              <div class="discs-tray" id="my-discs-tray"></div>
            </div>

            <!-- アクション操作ボタン群 -->
            <div class="actions-area" id="skull-actions-area">
              <!-- 配置ボタン -->
              <div class="action-group" id="group-placing">
                <button id="btn-place-flower" class="btn btn-sm btn-flower">🌸 花を伏せる</button>
                <button id="btn-place-skull" class="btn btn-sm btn-skull">💀 ドクロを伏せる</button>
                <button id="btn-start-bid" class="btn btn-sm btn-primary" disabled>⚡ チャレンジ開始</button>
              </div>

              <!-- ビッドボタン -->
              <div class="action-group hidden" id="group-bidding">
                <div class="bid-stepper">
                  <button id="btn-bid-minus" class="btn-step">-</button>
                  <span id="bid-number-display" class="bid-num">1</span>
                  <button id="btn-bid-plus" class="btn-step">+</button>
                </div>
                <button id="btn-submit-bid" class="btn btn-sm btn-primary">ビッド宣言</button>
                <button id="btn-pass-bid" class="btn btn-sm btn-subtle">パス</button>
              </div>

              <!-- めくり中メッセージ -->
              <div class="action-group hidden" id="group-revealing">
                <span class="reveal-hint" id="reveal-hint-text">自分のマットから順にカードをクリックしてめくってください！</span>
              </div>
            </div>
          </div>

          <!-- 結果バナー -->
          <div id="skull-result-banner" class="skull-result-banner hidden">
            <span id="skull-result-text">勝敗結果</span>
            <button id="skull-restart-btn" class="btn btn-sm btn-primary">次のラウンド</button>
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
            max-width: 860px;
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
            font-size: 14px;
          }

          .skull-bid-info {
            color: #f59e0b;
            font-weight: 700;
          }

          .skull-phase-pill {
            background: #0f172a;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            color: #38bdf8;
            border: 1px solid #0284c7;
          }

          /* 3D Canvas コンテナ */
          .skull-canvas-container {
            width: 100%;
            height: 440px;
            background: radial-gradient(circle at center, #111827, #030712);
            border-radius: 14px;
            border: 2px solid #374151;
            position: relative;
            overflow: hidden;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.7);
          }

          .skull-canvas-container canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            outline: none;
          }

          .skull-center-announce {
            position: absolute;
            top: 14px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(6px);
            padding: 6px 18px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 1px;
            color: #fef08a;
            border: 1px solid rgba(254, 240, 138, 0.3);
            pointer-events: none;
            z-index: 10;
          }

          /* 下部コントロール */
          .skull-controls-panel {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background: #18202c;
            padding: 10px 16px;
            border-radius: 10px;
            border: 1px solid #2b384a;
            gap: 12px;
            flex-wrap: wrap;
          }

          .my-discs-area {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .ctrl-label {
            font-size: 13px;
            color: #94a3b8;
            font-weight: 700;
          }

          .discs-tray {
            display: flex;
            gap: 8px;
          }

          .disc-pill {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 800;
          }
          .disc-pill.flower { background: #831843; color: #fbcfe8; border: 1px solid #f472b6; }
          .disc-pill.skull { background: #374151; color: #f87171; border: 1px solid #ef4444; }

          .actions-area {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .action-group {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .action-group.hidden { display: none; }

          .btn-flower {
            background: linear-gradient(135deg, #db2777, #be185d);
            color: #fff;
            border: 1px solid #f472b6;
          }
          .btn-flower:hover { background: #db2777; }

          .btn-skull {
            background: linear-gradient(135deg, #1f2937, #111827);
            color: #f87171;
            border: 1px solid #ef4444;
          }
          .btn-skull:hover { background: #374151; }

          /* ビッドステッパー */
          .bid-stepper {
            display: flex;
            align-items: center;
            gap: 6px;
            background: #0f172a;
            border: 1px solid #475569;
            border-radius: 8px;
            padding: 2px 6px;
          }
          .btn-step {
            background: #334155;
            color: #fff;
            border: none;
            width: 26px;
            height: 26px;
            border-radius: 4px;
            font-weight: 800;
            cursor: pointer;
          }
          .bid-num {
            font-size: 16px;
            font-weight: 900;
            color: #f59e0b;
            min-width: 28px;
            text-align: center;
          }

          .reveal-hint {
            font-size: 13px;
            color: #facc15;
            font-weight: 700;
            animation: pulse 1s infinite alternate;
          }

          /* 結果バナー */
          .skull-result-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: #1e293b;
            border: 2px solid #10b981;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 700;
          }
          .skull-result-banner.hidden { display: none; }

          @media (max-width: 640px) {
            .skull-canvas-container { height: 340px; }
            .skull-controls-panel { flex-direction: column; align-items: flex-start; }
          }
        `;
        document.head.appendChild(style);
      }

      // 要素
      const canvasContainer = container.querySelector('#skull-3d-container');
      const turnBadge = container.querySelector('#skull-turn-badge');
      const bidInfoEl = container.querySelector('#skull-highest-bid');
      const phasePill = container.querySelector('#skull-phase-pill');
      const announceEl = container.querySelector('#skull-announce');
      const discsTrayEl = container.querySelector('#my-discs-tray');
      const groupPlacing = container.querySelector('#group-placing');
      const groupBidding = container.querySelector('#group-bidding');
      const groupRevealing = container.querySelector('#group-revealing');
      const revealHintText = container.querySelector('#reveal-hint-text');
      const btnPlaceFlower = container.querySelector('#btn-place-flower');
      const btnPlaceSkull = container.querySelector('#btn-place-skull');
      const btnStartBid = container.querySelector('#btn-start-bid');
      const btnBidMinus = container.querySelector('#btn-bid-minus');
      const btnBidPlus = container.querySelector('#btn-bid-plus');
      const bidNumDisplay = container.querySelector('#bid-number-display');
      const btnSubmitBid = container.querySelector('#btn-submit-bid');
      const btnPassBid = container.querySelector('#btn-pass-bid');
      const resBanner = container.querySelector('#skull-result-banner');
      const resText = container.querySelector('#skull-result-text');
      const restartBtn = container.querySelector('#skull-restart-btn');

      // ----------------------------------------------------
      // 1. Three.js 3D シーン初期化
      // ----------------------------------------------------
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050811, 0.022);

      const camera = new THREE.PerspectiveCamera(
        42,
        canvasContainer.clientWidth / canvasContainer.clientHeight,
        0.1,
        1000
      );
      // カジノテーブルをやや斜め上から見下ろすカメラ
      camera.position.set(0, 19, 21);
      camera.lookAt(0, -0.5, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvasContainer.appendChild(renderer.domElement);

      // ライト
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
      scene.add(ambientLight);

      // カジノテーブル中央のメインスポットライト
      const tableLight = new THREE.SpotLight(0xfff5ea, 1.4);
      tableLight.position.set(0, 24, 0);
      tableLight.angle = Math.PI / 3;
      tableLight.penumbra = 0.5;
      tableLight.castShadow = true;
      scene.add(tableLight);

      // 暖かいポイントライト
      const warmLight = new THREE.PointLight(0xf59e0b, 0.8, 30);
      warmLight.position.set(0, 8, 4);
      scene.add(warmLight);

      // カジノテーブルの作成 (直径 約16mのフェルトテーブル)
      const tableGroup = new THREE.Group();

      // グリーンフェルト天板
      const feltGeo = new THREE.CylinderGeometry(8.2, 8.2, 0.4, 64);
      const feltMat = new THREE.MeshStandardMaterial({
        color: 0x14532d, // 高級カジノグリーン
        roughness: 0.85,
        metalness: 0.05
      });
      const feltMesh = new THREE.Mesh(feltGeo, feltMat);
      feltMesh.receiveShadow = true;
      feltMesh.position.y = -0.2;
      tableGroup.add(feltMesh);

      // テーブル外周のマホガニーウッドレール (アームレスト)
      const railGeo = new THREE.TorusGeometry(8.4, 0.45, 16, 64);
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x451a03, // マホガニーブラウン
        roughness: 0.35,
        metalness: 0.15
      });
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.rotation.x = Math.PI / 2;
      railMesh.position.y = 0.05;
      railMesh.receiveShadow = true;
      tableGroup.add(railMesh);

      scene.add(tableGroup);

      // 8席のコースター＆カードメッシュ管理
      // seatMeshes[seatIdx] = { coasterMesh, discMeshes: [] }
      const seatMeshes = [];
      const TABLE_RADIUS = 5.8;

      for (let i = 0; i < MAX_SEATS; i++) {
        // Seat 0 を手前下（自分）、時計回りに配置
        const angle = -Math.PI / 2 + (i * (2 * Math.PI / MAX_SEATS));
        const cx = Math.cos(angle) * TABLE_RADIUS;
        const cz = Math.sin(angle) * TABLE_RADIUS;

        // コースター（マット）
        const coasterGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.06, 32);
        const coasterMat = new THREE.MeshStandardMaterial({
          color: i === 0 ? 0x1e3a8a : 0x1f2937,
          roughness: 0.6,
          metalness: 0.2
        });
        const coasterMesh = new THREE.Mesh(coasterGeo, coasterMat);
        coasterMesh.position.set(cx, 0.04, cz);
        coasterMesh.receiveShadow = true;
        coasterMesh.userData = { seat: i, type: 'coaster' };
        scene.add(coasterMesh);

        seatMeshes.push({
          x: cx,
          z: cz,
          coasterMesh: coasterMesh,
          discMeshes: []
        });
      }

      // カードマテリアルテクスチャ（Canvasで動的生成）
      function createDiscTextures() {
        // 1. 裏面テクスチャ（ゴールドの神秘的な幾何学模様）
        const cBack = document.createElement('canvas');
        cBack.width = 256; cBack.height = 256;
        const ctxB = cBack.getContext('2d');
        ctxB.fillStyle = '#1e1b4b';
        ctxB.fillRect(0, 0, 256, 256);
        ctxB.strokeStyle = '#f59e0b';
        ctxB.lineWidth = 8;
        ctxB.strokeRect(16, 16, 224, 224);
        ctxB.beginPath();
        ctxB.arc(128, 128, 80, 0, Math.PI * 2);
        ctxB.stroke();
        ctxB.fillStyle = '#f59e0b';
        ctxB.font = 'bold 36px sans-serif';
        ctxB.textAlign = 'center';
        ctxB.textBaseline = 'middle';
        ctxB.fillText('SKULL', 128, 128);
        const texBack = new THREE.CanvasTexture(cBack);

        // 2. 🌸 薔薇（花）表面テクスチャ
        const cFlower = document.createElement('canvas');
        cFlower.width = 256; cFlower.height = 256;
        const ctxF = cFlower.getContext('2d');
        ctxF.fillStyle = '#831843';
        ctxF.fillRect(0, 0, 256, 256);
        ctxF.strokeStyle = '#f472b6';
        ctxF.lineWidth = 10;
        ctxF.beginPath();
        ctxF.arc(128, 128, 100, 0, Math.PI * 2);
        ctxF.stroke();
        ctxF.font = '110px sans-serif';
        ctxF.textAlign = 'center';
        ctxF.textBaseline = 'middle';
        ctxF.fillText('🌸', 128, 128);
        const texFlower = new THREE.CanvasTexture(cFlower);

        // 3. 💀 ドクロ表面テクスチャ
        const cSkull = document.createElement('canvas');
        cSkull.width = 256; cSkull.height = 256;
        const ctxS = cSkull.getContext('2d');
        ctxS.fillStyle = '#09090b';
        ctxS.fillRect(0, 0, 256, 256);
        ctxS.strokeStyle = '#ef4444';
        ctxS.lineWidth = 12;
        ctxS.beginPath();
        ctxS.arc(128, 128, 100, 0, Math.PI * 2);
        ctxS.stroke();
        ctxS.font = '110px sans-serif';
        ctxS.textAlign = 'center';
        ctxS.textBaseline = 'middle';
        ctxS.fillText('💀', 128, 128);
        const texSkull = new THREE.CanvasTexture(cSkull);

        return { texBack, texFlower, texSkull };
      }

      const { texBack, texFlower, texSkull } = createDiscTextures();

      // ディスク3Dメッシュ作成関数
      function create3DDisc(discType, seatIdx, stackHeight) {
        const geo = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 32);

        // 上面（表面: 花またはドクロ）、下面（裏面）、側面
        const matTop = new THREE.MeshStandardMaterial({
          map: discType === DISC_FLOWER ? texFlower : texSkull,
          roughness: 0.4
        });
        const matBottom = new THREE.MeshStandardMaterial({
          map: texBack,
          roughness: 0.4
        });
        const matSide = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          metalness: 0.6,
          roughness: 0.3
        });

        const mesh = new THREE.Mesh(geo, [matSide, matTop, matBottom]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const seat = seatMeshes[seatIdx];
        // 最初は裏面を上にして伏せる (X軸を180度反転)
        mesh.rotation.x = Math.PI;
        mesh.position.set(seat.x, 0.08 + stackHeight * 0.1, seat.z);
        mesh.userData = {
          seat: seatIdx,
          discType: discType,
          isRevealed: false,
          stackIdx: stackHeight
        };

        scene.add(mesh);
        return mesh;
      }

      // ----------------------------------------------------
      // 2. スカルのゲームロジック
      // ----------------------------------------------------
      function initGame() {
        // プレイヤー初期化 (座席 0〜7)
        // 席0: 自分, 席1: 相手(P2) または AI, 他の席も身内やボットで埋められる
        players = [];
        for (let i = 0; i < MAX_SEATS; i++) {
          players.push({
            id: i,
            name: i === 0 ? `${bridge.getLocalName()} (あなた)` : (i === 1 ? bridge.getRemoteName() : `プレイヤー ${i + 1}`),
            isActive: i < 4, // デフォルト4人対戦（2〜8人対応）
            discs: [DISC_FLOWER, DISC_FLOWER, DISC_FLOWER, DISC_SKULL], // 花3枚、ドクロ1枚
            played: [], // マット上のスタック [{ type, mesh, revealed }]
            wins: 0,
            hasPassedBid: false,
            eliminated: false
          });
        }

        startPlayerSeat = 0;
        startNewRound();
      }

      function startNewRound() {
        // 各プレイヤーの場のカードをクリア
        players.forEach((p, sIdx) => {
          p.played = [];
          p.hasPassedBid = false;

          // 3Dメッシュ破棄
          seatMeshes[sIdx].discMeshes.forEach(m => scene.remove(m));
          seatMeshes[sIdx].discMeshes = [];
        });

        phase = 'PLACING';
        currentTurnSeat = startPlayerSeat;
        currentBid = 0;
        highestBidder = null;
        targetRevealCount = 0;
        revealedCount = 0;

        resBanner.classList.add('hidden');
        announceEl.textContent = '🌸 全員まずカードを1枚伏せてください';
        updateUI();
      }

      // カードをマットに伏せて置く
      function placeDisc(discType, isLocal = false) {
        const p = players[currentTurnSeat];
        const discIdx = p.discs.indexOf(discType);
        if (discIdx === -1) {
          bridge.showToast('そのカードは手持ちにありません！');
          return;
        }

        // 手札から除外してマットのスタックへ
        p.discs.splice(discIdx, 1);

        const stackHeight = p.played.length;
        const mesh = create3DDisc(discType, currentTurnSeat, stackHeight);
        seatMeshes[currentTurnSeat].discMeshes.push(mesh);

        p.played.push({
          type: discType,
          mesh: mesh,
          revealed: false
        });

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'place', discType: discType, seat: currentTurnSeat });
        }

        // 次の手番へ
        advanceTurnAfterPlacing();
      }

      function advanceTurnAfterPlacing() {
        // 次のアクティブプレイヤーへ
        let nextSeat = (currentTurnSeat + 1) % MAX_SEATS;
        while (!players[nextSeat].isActive || players[nextSeat].eliminated) {
          nextSeat = (nextSeat + 1) % MAX_SEATS;
        }
        currentTurnSeat = nextSeat;

        // 全員が最低1枚置いたか判定
        const allPlacedOnce = players.filter(p => p.isActive && !p.eliminated).every(p => p.played.length >= 1);
        btnStartBid.disabled = !allPlacedOnce;

        // 誰かの手札が尽きたら自動でビッドフェーズへ
        const anyOutOfHand = players.filter(p => p.isActive && !p.eliminated).some(p => p.discs.length === 0);
        if (anyOutOfHand && allPlacedOnce) {
          startBiddingPhase();
          return;
        }

        updateUI();
      }

      // チャレンジ（ビッドフェーズ）開始
      function startBiddingPhase() {
        phase = 'BIDDING';
        currentBid = 1;
        highestBidder = currentTurnSeat;
        announceEl.textContent = `⚡ ${players[currentTurnSeat].name} がチャレンジを宣言しました！`;
        updateUI();
      }

      // ビッド宣言
      function submitBid(amount, isLocal = false) {
        if (amount <= currentBid) {
          bridge.showToast(`現在値 (${currentBid}) より高い数字を宣言してください！`);
          return;
        }

        const totalCardsOnTable = getTotalCardsOnTable();
        if (amount > totalCardsOnTable) {
          bridge.showToast(`場の合計枚数 (${totalCardsOnTable}枚) を超えるビッドはできません！`);
          return;
        }

        currentBid = amount;
        highestBidder = currentTurnSeat;

        announceEl.textContent = `📢 ${players[currentTurnSeat].name} が 【${currentBid} 枚】 をビッド！`;
        bridge.showToast(`${players[currentTurnSeat].name} が ${currentBid} 枚を宣言！`);

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'bid', amount: currentBid, seat: currentTurnSeat });
        }

        // 場の最大枚数なら即座にめくりフェーズへ
        if (currentBid === totalCardsOnTable) {
          startRevealingPhase();
          return;
        }

        advanceBidTurn();
      }

      // ビッドをパス
      function passBid(isLocal = false) {
        players[currentTurnSeat].hasPassedBid = true;
        announceEl.textContent = `🏳️ ${players[currentTurnSeat].name} がパスしました。`;

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'pass_bid', seat: currentTurnSeat });
        }

        // パスしていない人が1人だけ残ったらその人が挑戦者！
        const activeBidders = players.filter(p => p.isActive && !p.eliminated && !p.hasPassedBid);
        if (activeBidders.length === 1) {
          highestBidder = activeBidders[0].id;
          startRevealingPhase();
          return;
        }

        advanceBidTurn();
      }

      function advanceBidTurn() {
        let nextSeat = (currentTurnSeat + 1) % MAX_SEATS;
        while (!players[nextSeat].isActive || players[nextSeat].eliminated || players[nextSeat].hasPassedBid) {
          nextSeat = (nextSeat + 1) % MAX_SEATS;
        }
        currentTurnSeat = nextSeat;
        updateUI();
      }

      // めくりフェーズ開始
      function startRevealingPhase() {
        phase = 'REVEALING';
        currentTurnSeat = highestBidder;
        targetRevealCount = currentBid;
        revealedCount = 0;

        announceEl.textContent = `🔍 ${players[highestBidder].name} の挑戦！【${targetRevealCount} 枚】の花をめくれ！`;
        updateUI();
      }

      // カードを1枚めくる
      function revealCardAt(seatIdx, isLocal = false) {
        const p = players[seatIdx];
        // 一番上の未めくりカードを取得
        const unrevealed = p.played.filter(c => !c.revealed);
        if (unrevealed.length === 0) return;

        const targetCard = unrevealed[unrevealed.length - 1]; // 一番上
        targetCard.revealed = true;

        // 3Dフリップアニメーション
        animateFlip(targetCard.mesh);

        if (isLocal && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'reveal', seat: seatIdx });
        }

        // 判定
        if (targetCard.type === DISC_SKULL) {
          // 💀 ドクロを引いてしまった！チャレンジ即失敗！
          announceEl.textContent = `💀 ドクロ出現！！ ${players[highestBidder].name} のチャレンジ失敗！`;
          bridge.showToast('💀 ドクロが出ました！チャレンジ失敗！');

          // ペナルティ：挑戦者のディスクをランダムに1枚除外 (-1枚)
          penalizeChallenger(highestBidder);

          phase = 'ROUND_OVER';
          resText.textContent = `💀 ドクロが出現しました！ ${players[highestBidder].name} の挑戦失敗…`;
          resBanner.classList.remove('hidden');
          updateUI();
          return;
        }

        // 🌸 花だった！
        revealedCount++;
        announceEl.textContent = `🌸 花が出ました！ (${revealedCount} / ${targetRevealCount})`;

        if (revealedCount >= targetRevealCount) {
          // 🎉 チャレンジ成功！！
          players[highestBidder].wins++;
          announceEl.textContent = `🎉 チャレンジ成功！！ ${players[highestBidder].name} が勝利点獲得！ (${players[highestBidder].wins}/2)`;

          if (players[highestBidder].wins >= 2) {
            // ゲーム完全優勝！！
            phase = 'GAME_OVER';
            resText.textContent = `👑 ${players[highestBidder].name} が2勝達成！完全勝利！！`;
            resBanner.classList.remove('hidden');
            bridge.showToast(`${players[highestBidder].name} の完全勝利！`);
          } else {
            phase = 'ROUND_OVER';
            resText.textContent = `🎉 チャレンジ成功！ ${players[highestBidder].name} が1勝獲得！ (あと1勝で優勝)`;
            resBanner.classList.remove('hidden');
            startPlayerSeat = highestBidder;
          }
        }

        updateUI();
      }

      // 3Dカード反転アニメーション
      function animateFlip(mesh) {
        let progress = 0;
        const initialY = mesh.position.y;

        function step() {
          progress += 0.08;
          if (progress <= 1) {
            // フワッと持ち上がりながら180度回転
            mesh.position.y = initialY + Math.sin(progress * Math.PI) * 0.8;
            mesh.rotation.x = Math.PI - (progress * Math.PI); // 180度から0度へ
            requestAnimationFrame(step);
          } else {
            mesh.position.y = initialY;
            mesh.rotation.x = 0; // 表面が上
          }
        }
        step();
      }

      // ペナルティ（手札を1枚失う）
      function penalizeChallenger(challengerSeat) {
        const p = players[challengerSeat];
        // 全手持ちディスク（手札＋マット上の残り）から1枚ランダム破棄
        const allDiscs = [...p.discs, ...p.played.map(c => c.type)];
        if (allDiscs.length > 0) {
          const removedIdx = Math.floor(Math.random() * allDiscs.length);
          allDiscs.splice(removedIdx, 1);
          p.discs = allDiscs; // 次ラウンドへ持ち越し
        }

        if (p.discs.length === 0) {
          p.eliminated = true;
          bridge.showToast(`${p.name} はすべてのディスクを失い脱落しました！`);
        }
      }

      function getTotalCardsOnTable() {
        return players.filter(p => p.isActive).reduce((sum, p) => sum + p.played.length, 0);
      }

      // ----------------------------------------------------
      // 3. UI 更新
      // ----------------------------------------------------
      function updateUI() {
        const isMyTurn = currentTurnSeat === 0 && phase !== 'ROUND_OVER' && phase !== 'GAME_OVER';

        // 手番バッジ
        turnBadge.textContent = isMyTurn ? '🟢 あなたの手番です！' : `${players[currentTurnSeat].name} の手番中…`;
        turnBadge.style.color = isMyTurn ? '#4ade80' : '#f59e0b';

        bidInfoEl.textContent = highestBidder !== null ? `${players[highestBidder].name} (${currentBid} 枚)` : 'なし';

        // フェーズ表示
        if (phase === 'PLACING') phasePill.textContent = '配置フェーズ';
        else if (phase === 'BIDDING') phasePill.textContent = 'ビッド(競り)中';
        else if (phase === 'REVEALING') phasePill.textContent = `めくり中 (${revealedCount}/${targetRevealCount})`;
        else phasePill.textContent = 'ラウンド終了';

        // 自分の手札トレイ表示
        discsTrayEl.innerHTML = '';
        const myP = players[0];
        const flowerCount = myP.discs.filter(d => d === DISC_FLOWER).length;
        const skullCount = myP.discs.filter(d => d === DISC_SKULL).length;

        if (flowerCount > 0) {
          const fPill = document.createElement('div');
          fPill.className = 'disc-pill flower';
          fPill.textContent = `🌸 花 ×${flowerCount}`;
          discsTrayEl.appendChild(fPill);
        }
        if (skullCount > 0) {
          const sPill = document.createElement('div');
          sPill.className = 'disc-pill skull';
          sPill.textContent = `💀 ドクロ ×${skullCount}`;
          discsTrayEl.appendChild(sPill);
        }

        // コントロールボタン切り替え
        groupPlacing.classList.toggle('hidden', phase !== 'PLACING');
        groupBidding.classList.toggle('hidden', phase !== 'BIDDING');
        groupRevealing.classList.toggle('hidden', phase !== 'REVEALING');

        // 配置ボタンの活性制御
        btnPlaceFlower.disabled = !isMyTurn || flowerCount === 0;
        btnPlaceSkull.disabled = !isMyTurn || skullCount === 0;

        // ビッドボタン制御
        if (phase === 'BIDDING') {
          const totalCards = getTotalCardsOnTable();
          let bidVal = parseInt(bidNumDisplay.textContent, 10);
          if (bidVal <= currentBid) {
            bidVal = currentBid + 1;
            bidNumDisplay.textContent = Math.min(bidVal, totalCards);
          }
          btnSubmitBid.disabled = !isMyTurn;
          btnPassBid.disabled = !isMyTurn;
        }

        // めくり案内
        if (phase === 'REVEALING') {
          const myUnrevealed = players[0].played.filter(c => !c.revealed).length;
          if (currentTurnSeat === 0) {
            if (myUnrevealed > 0) {
              revealHintText.textContent = `【ルール】まず自分のマットのカード (${myUnrevealed}枚) をクリックしてめくってください！`;
            } else {
              revealHintText.textContent = '【OK!】他人のマットの一番上のカードをクリックしてめくってください！';
            }
          } else {
            revealHintText.textContent = `${players[currentTurnSeat].name} がカードをめくっています…`;
          }
        }
      }

      // ----------------------------------------------------
      // 4. クリック＆レイキャスト操作 (3D上のカードをクリック)
      // ----------------------------------------------------
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      canvasContainer.addEventListener('click', (e) => {
        if (phase !== 'REVEALING' || currentTurnSeat !== 0) return;

        const rect = canvasContainer.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // クリック可能なディスクを探す
        const allDiscs = [];
        seatMeshes.forEach(s => allDiscs.push(...s.discMeshes));
        const intersects = raycaster.intersectObjects(allDiscs);

        if (intersects.length > 0) {
          const hitMesh = intersects[0].object;
          const targetSeat = hitMesh.userData.seat;
          const myUnrevealed = players[0].played.filter(c => !c.revealed).length;

          // まず自分のカードをめくり切るルール
          if (myUnrevealed > 0 && targetSeat !== 0) {
            bridge.showToast('先に自分のマットのカードをすべてめくる必要があります！');
            return;
          }

          // その席の一番上のみめくれる
          const p = players[targetSeat];
          const unrevealed = p.played.filter(c => !c.revealed);
          if (unrevealed.length > 0 && unrevealed[unrevealed.length - 1].mesh === hitMesh) {
            revealCardAt(targetSeat, true);
          } else {
            bridge.showToast('めくれるのは一番上のカードのみです！');
          }
        }
      });

      // ----------------------------------------------------
      // 5. ボタンイベントリスナー
      // ----------------------------------------------------
      btnPlaceFlower.addEventListener('click', () => placeDisc(DISC_FLOWER, true));
      btnPlaceSkull.addEventListener('click', () => placeDisc(DISC_SKULL, true));

      btnStartBid.addEventListener('click', () => {
        if (currentTurnSeat !== 0 || phase !== 'PLACING') return;
        startBiddingPhase();
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'start_bidding' });
        }
      });

      btnBidMinus.addEventListener('click', () => {
        let val = parseInt(bidNumDisplay.textContent, 10);
        if (val > currentBid + 1) {
          bidNumDisplay.textContent = val - 1;
        }
      });

      btnBidPlus.addEventListener('click', () => {
        let val = parseInt(bidNumDisplay.textContent, 10);
        const max = getTotalCardsOnTable();
        if (val < max) {
          bidNumDisplay.textContent = val + 1;
        }
      });

      btnSubmitBid.addEventListener('click', () => {
        const val = parseInt(bidNumDisplay.textContent, 10);
        submitBid(val, true);
      });

      btnPassBid.addEventListener('click', () => passBid(true));

      restartBtn.addEventListener('click', () => {
        if (phase === 'GAME_OVER') {
          initGame();
        } else {
          startNewRound();
        }
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'next_round' });
        }
      });

      // ----------------------------------------------------
      // 6. P2P 受信イベント
      // ----------------------------------------------------
      bridge.onReceive((data) => {
        if (data.game !== 'skull') return;
        if (data.type === 'place') {
          currentTurnSeat = data.seat;
          placeDisc(data.discType, false);
        } else if (data.type === 'start_bidding') {
          startBiddingPhase();
        } else if (data.type === 'bid') {
          currentTurnSeat = data.seat;
          submitBid(data.amount, false);
        } else if (data.type === 'pass_bid') {
          currentTurnSeat = data.seat;
          passBid(false);
        } else if (data.type === 'reveal') {
          revealCardAt(data.seat, false);
        } else if (data.type === 'next_round') {
          startNewRound();
        }
      });

      // 相手合流イベント
      bridge.onPlayerJoined(() => {
        initGame();
        bridge.showToast('対戦相手が合流しました！3Dスカル開始！');
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
      // 7. アニメーションレンダリングループ
      // ----------------------------------------------------
      function animate() {
        if (isDestroyed) return;
        animFrameId = requestAnimationFrame(animate);

        // テーブルをほんのりゆっくり自転（臨場感演出）
        tableGroup.rotation.y += 0.0006;
        seatMeshes.forEach((s, idx) => {
          // コースターとディスクもテーブルに合わせて回転
          const angle = -Math.PI / 2 + (idx * (2 * Math.PI / MAX_SEATS)) + tableGroup.rotation.y;
          s.x = Math.cos(angle) * TABLE_RADIUS;
          s.z = Math.sin(angle) * TABLE_RADIUS;
          s.coasterMesh.position.x = s.x;
          s.coasterMesh.position.z = s.z;

          s.discMeshes.forEach(mesh => {
            mesh.position.x = s.x;
            mesh.position.z = s.z;
          });
        });

        renderer.render(scene, camera);
      }

      // ゲーム開始
      initGame();
      animate();

      // アンマウント時
      this.unmount = () => {
        isDestroyed = true;
        cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
      };
    },

    unmount() {
      if (this.unmount) this.unmount();
    }
  });
})();
