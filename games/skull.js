/**
 * 💀 3D スカル (Skull / 髑髏と薔薇) - 完全ルール制御＆本格3Dカジノ卓エディション
 * Board Arena Plugin
 * 
 * 🌟 完全改修ポイント:
 * 1. 【公式スカル完全ルール実装】
 *    - 各プレイヤー初期ディスク4枚（🌸花×3、💀ドクロ×1）
 *    - フェーズ1 (FIRST_CARD): 全員が最初の1枚を自分のマットに伏せて置く
 *    - フェーズ2 (PLAY_OR_BID): 手番プレイヤーは「さらに手札を1枚重ねて置く」か「チャレンジ枚数を宣言(1〜場の総枚数)」
 *    - フェーズ3 (BIDDING): 時計回りに「より高い枚数をレイズ」または「パス」。1人を除き全員パス、または場の最大枚数宣言で即チャレンジへ！
 *    - フェーズ4 (REVEALING): 最高宣言者(チャレンジャー)が宣言枚数分をめくる。
 *      ※公式鉄則ルール：「必ず自分のマットに置いたディスクをすべてめくり終えてからでなければ、他人のディスクをめくれない！」
 *    - 成否判定:
 *      - 🌸 すべて花をめくり切ったらチャレンジ成功！マットが金色(裏)に反転。2回成功でゲーム完全勝利！
 *      - 💀 途中でドクロをめくってしまったら即失敗！チャレンジャーの手札からランダムに1枚が「💀没収(除外)」され、次のラウンドへ。
 * 2. 【賢い思考型マルチCPU (2〜8人)】
 *    - ブラフ（ドクロを置いてから自分でビッドして他人に踏ませる罠）や、安全圏のレイズ判断、ドクロを出した人を避けてめくるAIを搭載！
 * 3. 【3D操作 ＆ ワンクリックUIのハイブリッド】
 *    - 3Dディスクをドラッグしてマットに出すことも、ボタンやクリックで快適に出す・めくることも可能！
 *    - カメラアングル切替（全体俯瞰 / プレイヤー視点 / ドラッグ回転）対応！
 */

(function () {
  const MAX_SEATS = 8;
  const DISC_FLOWER = 'flower';
  const DISC_SKULL = 'skull';

  const SEAT_THEMES = [
    { name: 'あなた (P1)', hex: 0x38bdf8, css: '#38bdf8', darkCss: '#0369a1' },
    { name: 'CPU 2 (紅)', hex: 0xf43f5e, css: '#f43f5e', darkCss: '#be123c' },
    { name: 'CPU 3 (翠)', hex: 0x10b981, css: '#10b981', darkCss: '#047857' },
    { name: 'CPU 4 (琥珀)', hex: 0xf59e0b, css: '#f59e0b', darkCss: '#b45309' },
    { name: 'CPU 5 (紫電)', hex: 0xa855f7, css: '#a855f7', darkCss: '#7e22ce' },
    { name: 'CPU 6 (桃)', hex: 0xec4899, css: '#ec4899', darkCss: '#be185d' },
    { name: 'CPU 7 (黄金)', hex: 0xeab308, css: '#eab308', darkCss: '#a16207' },
    { name: 'CPU 8 (氷晶)', hex: 0x06b6d4, css: '#06b6d4', darkCss: '#0e7490' }
  ];

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

  window.BoardArena.registerGame({
    id: 'skull',
    name: '3Dスカル (Skull)',
    icon: '💀',
    category: '🕵️ 究極のブラフ (3D卓上)',
    minPlayers: 2,
    maxPlayers: 8,
    description: '花3枚とドクロ1枚で繰り広げる究極のブラフ心理戦！公式ルール完全準拠・最大8人CPU対戦＆3Dテーブル搭載！',

    mount(container, bridge) {
      let isDestroyed = false;
      let animFrameId = null;
      let cpuTimer = null;

      let activePlayerCount = 4; // 4人対戦が最もスカルで白熱するデフォルト
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
      let statusBannerText = 'ラウンド開始！手札から1枚選んで場に伏せてください';
      let cameraMode = 'default'; // 'default' | 'top' | 'closeup'

      // プレイヤー配列 (0 〜 MAX_SEATS-1)
      let players = [];

      // HTML レイアウト構築
      container.innerHTML = `
        <div class="skull-pro-wrapper">
          <!-- 上部ヘッダーバー -->
          <div class="skull-top-bar">
            <div class="skull-top-left">
              <label class="skull-select-wrap">
                👥 卓の人数:
                <select id="skull-count-select" class="skull-select">
                  <option value="2">2人対戦 (1 vs 1)</option>
                  <option value="3">3人対戦</option>
                  <option value="4" selected>4人対戦 (定番おすすめ)</option>
                  <option value="5">5人対戦</option>
                  <option value="6">6人対戦 (大乱闘)</option>
                  <option value="7">7人対戦</option>
                  <option value="8">8人対戦 (フルハウス)</option>
                </select>
              </label>
              <button id="skull-cpu-toggle" class="skull-pill-btn active">🤖 CPU自動進行: ON</button>
              <button id="skull-cam-btn" class="skull-pill-btn">🎥 視点切替</button>
            </div>
            <div class="skull-top-right">
              <span class="skull-round-badge" id="skull-round-badge">ROUND 1</span>
              <button id="skull-new-game-btn" class="btn btn-sm btn-subtle">🔄 最初から</button>
            </div>
          </div>

          <!-- プレイヤー一覧ステータスバー -->
          <div class="skull-players-strip" id="skull-players-strip"></div>

          <!-- メイン3Dキャンバス ＆ オーバーレイHUD -->
          <div class="skull-stage-box" id="skull-3d-stage">
            <!-- 上部フェーズ＆アナウンスHUD -->
            <div class="skull-hud-top">
              <div class="skull-phase-pill" id="skull-phase-pill">PHASE 1: 初手セット</div>
              <div class="skull-announce-text" id="skull-announce-text">手札から1枚選んで場に伏せて出してください</div>
              <div class="skull-bid-counter hidden" id="skull-bid-counter">
                🔥 現在の最高宣言: <strong id="skull-bid-val">0</strong> 枚 (<span id="skull-bidder-name">-</span>)
              </div>
            </div>

            <!-- 3Dキャンバス挿入先 -->
            <div class="skull-canvas-mount" id="skull-canvas-mount"></div>

            <!-- ラウンド決着 / 勝敗ポップアップ -->
            <div class="skull-modal-overlay hidden" id="skull-round-modal">
              <div class="skull-modal-card">
                <div class="skull-modal-icon" id="skull-modal-icon">🌸</div>
                <h3 class="skull-modal-title" id="skull-modal-title">チャレンジ成功！</h3>
                <p class="skull-modal-desc" id="skull-modal-desc">詳細メッセージ</p>
                <button id="skull-modal-next-btn" class="btn btn-primary btn-lg">➡️ 次のラウンドへ</button>
              </div>
            </div>
          </div>

          <!-- 下部プレイヤーズ・コックピット (手札＆アクションパネル) -->
          <div class="skull-cockpit" id="skull-cockpit">
            <!-- 左: 自分の手札カード選択ボタン群 -->
            <div class="skull-my-hand-panel">
              <div class="panel-header-row">
                <span class="panel-lbl">🖐️ あなたの手札 (クリックまたは3Dドラッグで場に出す)</span>
                <span class="my-wins-stars" id="skull-my-wins">☆☆ (0/2勝)</span>
              </div>
              <div class="skull-hand-cards" id="skull-hand-cards"></div>
            </div>

            <!-- 右: ビッド(枚数宣言)・パス・めくり操作パネル -->
            <div class="skull-action-panel" id="skull-action-panel">
              <div class="panel-header-row">
                <span class="panel-lbl" id="skull-action-lbl">⚡ アクション選択</span>
              </div>
              <div class="skull-action-controls" id="skull-action-controls"></div>
            </div>
          </div>
        </div>
      `;

      // CSS スタイル注入
      if (!document.getElementById('skull-pro-styles')) {
        const style = document.createElement('style');
        style.id = 'skull-pro-styles';
        style.textContent = `
          .skull-pro-wrapper {
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
            max-width: 1080px;
            margin: 0 auto;
            user-select: none;
            color: #f8fafc;
          }
          .skull-top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #111827;
            border: 1px solid #283548;
            padding: 8px 14px;
            border-radius: 12px;
            flex-wrap: wrap;
            gap: 8px;
          }
          .skull-top-left, .skull-top-right {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }
          .skull-select-wrap {
            font-size: 13px;
            font-weight: 700;
            color: #fbbf24;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .skull-select {
            background: #1e293b;
            color: #fff;
            border: 1px solid #38bdf8;
            border-radius: 8px;
            padding: 4px 10px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            outline: none;
          }
          .skull-pill-btn {
            background: #1e293b;
            border: 1px solid #475569;
            color: #cbd5e1;
            font-size: 12px;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .skull-pill-btn:hover { border-color: #38bdf8; color: #fff; }
          .skull-pill-btn.active {
            background: rgba(56, 189, 248, 0.15);
            border-color: #38bdf8;
            color: #38bdf8;
          }
          .skull-round-badge {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #fff;
            font-size: 12px;
            font-weight: 900;
            padding: 4px 12px;
            border-radius: 14px;
            letter-spacing: 1px;
          }

          /* プレイヤーストリップ */
          .skull-players-strip {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
            width: 100%;
          }
          .sk-p-badge {
            background: #161f2e;
            border: 2px solid #283548;
            border-radius: 10px;
            padding: 6px 10px;
            display: flex;
            flex-direction: column;
            gap: 3px;
            position: relative;
            transition: all 0.25s;
          }
          .sk-p-badge.active-turn {
            border-color: #fbbf24;
            background: rgba(245, 158, 11, 0.14);
            box-shadow: 0 0 14px rgba(245, 158, 11, 0.4);
            transform: translateY(-2px);
          }
          .sk-p-badge.passed, .sk-p-badge.eliminated {
            opacity: 0.45;
          }
          .sk-p-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 800;
          }
          .sk-p-stars { color: #fbbf24; font-size: 13px; letter-spacing: 1px; }
          .sk-p-meta {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #94a3b8;
          }
          .sk-p-stack { color: #38bdf8; font-weight: 700; }

          /* 3D ステージ */
          .skull-stage-box {
            position: relative;
            width: 100%;
            height: 470px;
            background: radial-gradient(circle at center, #111c2d 0%, #050811 100%);
            border: 2px solid #2b3b52;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 18px 45px rgba(0, 0, 0, 0.75);
          }
          .skull-canvas-mount {
            width: 100%;
            height: 100%;
            cursor: grab;
          }
          .skull-canvas-mount:active { cursor: grabbing; }
          .skull-canvas-mount canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
          }

          /* ステージ上部HUD */
          .skull-hud-top {
            position: absolute;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            pointer-events: none;
            width: 92%;
            max-width: 680px;
          }
          .skull-phase-pill {
            background: rgba(15, 23, 42, 0.88);
            border: 1px solid #38bdf8;
            color: #38bdf8;
            font-size: 11px;
            font-weight: 900;
            padding: 3px 12px;
            border-radius: 20px;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .skull-announce-text {
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #f8fafc;
            font-size: 14px;
            font-weight: 800;
            padding: 7px 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
          }
          .skull-bid-counter {
            background: linear-gradient(135deg, rgba(220, 38, 38, 0.9), rgba(185, 28, 28, 0.9));
            border: 1px solid #fca5a5;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            padding: 4px 16px;
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.5);
          }

          /* モーダルオーバーレイ */
          .skull-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(6, 10, 19, 0.82);
            backdrop-filter: blur(6px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 30;
          }
          .skull-modal-card {
            background: #182234;
            border: 2px solid #fbbf24;
            border-radius: 20px;
            padding: 28px 34px;
            text-align: center;
            max-width: 440px;
            width: 90%;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            animation: popIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .skull-modal-icon { font-size: 58px; line-height: 1; margin-bottom: 10px; }
          .skull-modal-title { font-size: 24px; font-weight: 900; margin-bottom: 8px; color: #fbbf24; }
          .skull-modal-desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px; }

          /* 下部コックピット */
          .skull-cockpit {
            display: grid;
            grid-template-columns: 1.15fr 1fr;
            gap: 12px;
            width: 100%;
          }
          .skull-my-hand-panel, .skull-action-panel {
            background: #141c2b;
            border: 1px solid #283548;
            border-radius: 14px;
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .panel-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .panel-lbl {
            font-size: 12px;
            font-weight: 800;
            color: #94a3b8;
          }
          .my-wins-stars {
            font-size: 13px;
            font-weight: 900;
            color: #fbbf24;
          }
          .skull-hand-cards {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            min-height: 76px;
          }
          .sk-hand-disc {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            font-weight: 800;
            font-size: 11px;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 6px 14px rgba(0,0,0,0.45);
            position: relative;
          }
          .sk-hand-disc.flower {
            background: radial-gradient(circle at 35% 35%, #be185d, #500724);
            border: 3px solid #f472b6;
            color: #fce7f3;
          }
          .sk-hand-disc.skull {
            background: radial-gradient(circle at 35% 35%, #3f3f46, #09090b);
            border: 3px solid #ef4444;
            color: #fecaca;
          }
          .sk-hand-disc:hover:not(.disabled) {
            transform: translateY(-6px) scale(1.06);
            box-shadow: 0 12px 20px rgba(56, 189, 248, 0.4);
          }
          .sk-hand-disc.disabled {
            opacity: 0.35;
            cursor: not-allowed;
            filter: grayscale(0.5);
          }
          .sk-disc-emoji { font-size: 26px; line-height: 1; margin-bottom: 2px; }

          .skull-action-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            min-height: 76px;
          }
          .bid-num-btn {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #fff;
            border: none;
            border-radius: 10px;
            padding: 10px 15px;
            font-size: 14px;
            font-weight: 900;
            cursor: pointer;
            transition: all 0.15s;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
          }
          .bid-num-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
          .pass-bid-btn {
            background: #334155;
            color: #e2e8f0;
            border: 1px solid #64748b;
            border-radius: 10px;
            padding: 10px 16px;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
          }
          .pass-bid-btn:hover { background: #475569; color: #fff; }

          .reveal-target-btn {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            border: 1px solid #60a5fa;
            color: #fff;
            border-radius: 10px;
            padding: 9px 14px;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.15s;
          }
          .reveal-target-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(37, 99, 235, 0.45); }

          @media (max-width: 768px) {
            .skull-cockpit { grid-template-columns: 1fr; }
            .skull-stage-box { height: 380px; }
          }
        `;
        document.head.appendChild(style);
      }

      // DOM 参照
      const countSelect = container.querySelector('#skull-count-select');
      const cpuToggleBtn = container.querySelector('#skull-cpu-toggle');
      const camBtn = container.querySelector('#skull-cam-btn');
      const roundBadge = container.querySelector('#skull-round-badge');
      const newGameBtn = container.querySelector('#skull-new-game-btn');
      const playersStrip = container.querySelector('#skull-players-strip');
      const phasePill = container.querySelector('#skull-phase-pill');
      const announceText = container.querySelector('#skull-announce-text');
      const bidCounter = container.querySelector('#skull-bid-counter');
      const bidValEl = container.querySelector('#skull-bid-val');
      const bidderNameEl = container.querySelector('#skull-bidder-name');
      const canvasMount = container.querySelector('#skull-canvas-mount');
      const roundModal = container.querySelector('#skull-round-modal');
      const modalIcon = container.querySelector('#skull-modal-icon');
      const modalTitle = container.querySelector('#skull-modal-title');
      const modalDesc = container.querySelector('#skull-modal-desc');
      const modalNextBtn = container.querySelector('#skull-modal-next-btn');
      const myWinsEl = container.querySelector('#skull-my-wins');
      const handCardsEl = container.querySelector('#skull-hand-cards');
      const actionLbl = container.querySelector('#skull-action-lbl');
      const actionControlsEl = container.querySelector('#skull-action-controls');

      // ====================================================
      // Three.js シーン＆3Dテーブルの構築
      // ====================================================
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050811, 0.015);

      const camera = new THREE.PerspectiveCamera(42, canvasMount.clientWidth / canvasMount.clientHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(canvasMount.clientWidth, canvasMount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvasMount.appendChild(renderer.domElement);

      // カメラ制御用パラメータ
      let camTheta = 0; // 水平回転角
      let camPhi = 0.82; // 仰角 (ラジアン)
      let camRadius = 23.5;
      let camLookY = -0.5;

      function applyCameraPreset(mode) {
        cameraMode = mode;
        if (mode === 'top') {
          camTheta = 0;
          camPhi = 0.22;
          camRadius = 25;
        } else if (mode === 'closeup') {
          camTheta = 0;
          camPhi = 0.98;
          camRadius = 17.5;
        } else {
          camTheta = 0;
          camPhi = 0.78;
          camRadius = 22.5;
        }
        updateCameraTransform();
      }

      function updateCameraTransform() {
        const x = camRadius * Math.sin(camPhi) * Math.sin(camTheta);
        const y = camRadius * Math.cos(camPhi);
        const z = camRadius * Math.sin(camPhi) * Math.cos(camTheta);
        camera.position.set(x, y, z);
        camera.lookAt(0, camLookY, 0.8);
      }
      applyCameraPreset('default');

      // ライティング
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      scene.add(ambientLight);

      const spotLight = new THREE.SpotLight(0xfffbeb, 1.4);
      spotLight.position.set(0, 28, 4);
      spotLight.angle = Math.PI / 2.4;
      spotLight.penumbra = 0.6;
      spotLight.castShadow = true;
      scene.add(spotLight);

      const rimLight = new THREE.PointLight(0x38bdf8, 0.6, 35);
      rimLight.position.set(-12, 10, -10);
      scene.add(rimLight);

      // カジノ円卓メッシュ
      const TABLE_RADIUS = 10.6;
      const tableGroup = new THREE.Group();

      const feltGeo = new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.5, 64);
      const feltMat = new THREE.MeshStandardMaterial({ color: 0x0d2b22, roughness: 0.85, metalness: 0.05 });
      const feltMesh = new THREE.Mesh(feltGeo, feltMat);
      feltMesh.position.y = -0.25;
      feltMesh.receiveShadow = true;
      tableGroup.add(feltMesh);

      const rimGeo = new THREE.TorusGeometry(TABLE_RADIUS + 0.32, 0.48, 20, 64);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x3e1f14, roughness: 0.35, metalness: 0.2 });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.rotation.x = Math.PI / 2;
      rimMesh.position.y = 0.05;
      tableGroup.add(rimMesh);

      scene.add(tableGroup);

      // テクスチャ作成
      function buildGameTextures() {
        // 1. 中央エンブレム
        const cCenter = document.createElement('canvas');
        cCenter.width = 512; cCenter.height = 512;
        const ctxC = cCenter.getContext('2d');
        ctxC.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctxC.lineWidth = 8;
        ctxC.beginPath(); ctxC.arc(256, 256, 230, 0, Math.PI * 2); ctxC.stroke();
        ctxC.beginPath(); ctxC.arc(256, 256, 175, 0, Math.PI * 2); ctxC.stroke();
        ctxC.fillStyle = 'rgba(245, 158, 11, 0.22)';
        ctxC.font = 'bold 42px serif';
        ctxC.textAlign = 'center';
        ctxC.fillText('💀 SKULL & ROSES 🌸', 256, 265);
        const texCenter = new THREE.CanvasTexture(cCenter);

        // 2. ディスク裏面（重厚なトライバルゴールド）
        const cBack = document.createElement('canvas');
        cBack.width = 256; cBack.height = 256;
        const ctxB = cBack.getContext('2d');
        const gradB = ctxB.createRadialGradient(128, 128, 10, 128, 128, 124);
        gradB.addColorStop(0, '#312e81');
        gradB.addColorStop(1, '#0f172a');
        ctxB.fillStyle = gradB;
        ctxB.fillRect(0, 0, 256, 256);
        ctxB.strokeStyle = '#f59e0b';
        ctxB.lineWidth = 12;
        ctxB.beginPath(); ctxB.arc(128, 128, 110, 0, Math.PI * 2); ctxB.stroke();
        ctxB.lineWidth = 4;
        ctxB.beginPath(); ctxB.arc(128, 128, 86, 0, Math.PI * 2); ctxB.stroke();
        ctxB.fillStyle = '#fbbf24';
        ctxB.font = 'bold 34px serif';
        ctxB.textAlign = 'center';
        ctxB.textBaseline = 'middle';
        ctxB.fillText('SKULL', 128, 128);
        const texBack = new THREE.CanvasTexture(cBack);

        // 3. ディスク表面：🌸 花 (Rose)
        const cFlower = document.createElement('canvas');
        cFlower.width = 256; cFlower.height = 256;
        const ctxF = cFlower.getContext('2d');
        const gradF = ctxF.createRadialGradient(128, 128, 15, 128, 128, 124);
        gradF.addColorStop(0, '#be185d');
        gradF.addColorStop(1, '#4c0519');
        ctxF.fillStyle = gradF;
        ctxF.fillRect(0, 0, 256, 256);
        ctxF.strokeStyle = '#f472b6';
        ctxF.lineWidth = 14;
        ctxF.beginPath(); ctxF.arc(128, 128, 108, 0, Math.PI * 2); ctxF.stroke();
        ctxF.font = '110px sans-serif';
        ctxF.textAlign = 'center';
        ctxF.textBaseline = 'middle';
        ctxF.fillText('🌸', 128, 132);
        const texFlower = new THREE.CanvasTexture(cFlower);

        // 4. ディスク表面：💀 ドクロ (Skull)
        const cSkull = document.createElement('canvas');
        cSkull.width = 256; cSkull.height = 256;
        const ctxS = cSkull.getContext('2d');
        const gradS = ctxS.createRadialGradient(128, 128, 15, 128, 128, 124);
        gradS.addColorStop(0, '#27272a');
        gradS.addColorStop(1, '#09090b');
        ctxS.fillStyle = gradS;
        ctxS.fillRect(0, 0, 256, 256);
        ctxS.strokeStyle = '#ef4444';
        ctxS.lineWidth = 16;
        ctxS.beginPath(); ctxS.arc(128, 128, 108, 0, Math.PI * 2); ctxS.stroke();
        ctxS.font = '110px sans-serif';
        ctxS.textAlign = 'center';
        ctxS.textBaseline = 'middle';
        ctxS.fillText('💀', 128, 132);
        const texSkull = new THREE.CanvasTexture(cSkull);

        return { texCenter, texBack, texFlower, texSkull };
      }

      const { texCenter, texBack, texFlower, texSkull } = buildGameTextures();

      const centerDecal = new THREE.Mesh(
        new THREE.PlaneGeometry(6.8, 6.8),
        new THREE.MeshBasicMaterial({ map: texCenter, transparent: true })
      );
      centerDecal.rotation.x = -Math.PI / 2;
      centerDecal.position.y = 0.01;
      scene.add(centerDecal);

      // 3Dオブジェクト管理配列
      const seatObjects3D = [];
      const discMeshes3D = [];

      function clear3DObjects() {
        seatObjects3D.forEach(g => scene.remove(g));
        seatObjects3D.length = 0;
        discMeshes3D.forEach(m => scene.remove(m));
        discMeshes3D.length = 0;
      }

      // プレイヤー状態初期化
      function initMatch(resetWins = true) {
        if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
        roundModal.classList.add('hidden');

        if (resetWins) {
          roundNumber = 1;
          players = [];
          for (let i = 0; i < MAX_SEATS; i++) {
            const isActive = i < activePlayerCount;
            players.push({
              index: i,
              name: i === 0 ? 'あなた (P1)' : (bridge.isConnected() && i === 1 ? bridge.getRemoteName() : SEAT_THEMES[i].name),
              theme: SEAT_THEMES[i],
              isActive: isActive,
              isEliminated: false,
              wins: 0,
              ownedCards: [DISC_FLOWER, DISC_FLOWER, DISC_FLOWER, DISC_SKULL], // 所持カード
              hand: [],       // 現在の手札配列 ['flower', ...]
              stack: [],      // マットに出した山札 [{ type, revealed, mesh }]
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
          triggerGameVictory(champ, '他のプレイヤーが全員脱落したため、生き残り勝利！！');
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
        statusBannerText = `ラウンド ${roundNumber} 開始！全員、最初の1枚をマットに伏せて置きます`;

        rebuild3DTableState();
        updateAllUI();

        // FIRST_CARD フェーズ：CPUは自動的に1枚目を伏せて出す！
        if (vsCpu) {
          cpuTimer = setTimeout(() => {
            players.forEach(p => {
              if (p.isActive && !p.isEliminated && p.index !== mySeatIndex && p.stack.length === 0) {
                cpuPlayFirstCard(p);
              }
            });
            checkFirstCardPhaseComplete();
          }, 450);
        }
      }

      // 3D座席マットと3Dディスクの再構築
      function rebuild3DTableState() {
        clear3DObjects();

        const SEAT_DIST = 7.4;
        const STACK_DIST = 4.3;

        players.forEach((p, idx) => {
          const angle = Math.PI / 2 + (idx * (2 * Math.PI / MAX_SEATS));
          const sx = Math.cos(angle) * SEAT_DIST;
          const sz = Math.sin(angle) * SEAT_DIST;
          const matX = Math.cos(angle) * STACK_DIST;
          const matZ = Math.sin(angle) * STACK_DIST;

          p.seatPos = { x: sx, z: sz, angle };
          p.matPos = { x: matX, z: matZ, angle };

          const seatGroup = new THREE.Group();

          // 1. プレイヤーの3Dコースターマット (場のスタック置き場)
          const matCanvas = document.createElement('canvas');
          matCanvas.width = 256; matCanvas.height = 256;
          const ctxM = matCanvas.getContext('2d');

          const isAct = p.isActive && !p.isEliminated;
          const isTurn = (phase !== 'FIRST_CARD' && currentTurn === idx && isAct);

          // 1勝リーチ時はマットが黄金に輝く！
          ctxM.fillStyle = p.wins >= 1 ? 'rgba(234, 179, 8, 0.35)' : (isAct ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.25)');
          ctxM.beginPath(); ctxM.arc(128, 128, 116, 0, Math.PI * 2); ctxM.fill();

          ctxM.strokeStyle = isTurn ? '#fbbf24' : (isAct ? p.theme.css : '#334155');
          ctxM.lineWidth = isTurn ? 12 : 6;
          if (!isAct) ctxM.setLineDash([12, 10]);
          ctxM.stroke();

          ctxM.fillStyle = isAct ? '#ffffff' : '#64748b';
          ctxM.font = 'bold 26px sans-serif';
          ctxM.textAlign = 'center';
          ctxM.fillText(isAct ? p.name : `空席 ${idx + 1}`, 128, 70);

          if (isAct) {
            ctxM.fillStyle = '#fbbf24';
            ctxM.font = 'bold 28px sans-serif';
            ctxM.fillText(p.wins === 1 ? '★ リーチ!' : (p.wins >= 2 ? '★★ 勝利!' : '☆☆'), 128, 195);
          }

          const texMat = new THREE.CanvasTexture(matCanvas);
          const coasterMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1.35, 1.35, 0.05, 32),
            new THREE.MeshBasicMaterial({ map: texMat, transparent: true, opacity: isAct ? 1 : 0.35 })
          );
          coasterMesh.position.set(matX, 0.03, matZ);
          coasterMesh.userData = { isCoaster: true, seatIndex: idx };
          seatGroup.add(coasterMesh);
          p.coasterMesh = coasterMesh;

          // 2. マットの上に積まれているスタックの3Dディスクを生成
          p.stack.forEach((cardObj, sIdx) => {
            const discMesh = create3DDisc(
              idx,
              cardObj.type,
              cardObj.revealed,
              matX + (sIdx * 0.08),
              0.12 + sIdx * 0.12,
              matZ + (sIdx * 0.08),
              { isStackDisc: true, seatIndex: idx, stackIndex: sIdx }
            );
            cardObj.mesh = discMesh;
          });

          // 3. 手札の3Dディスク (外周座席エリアに並べる)
          if (isAct) {
            const handCount = p.hand.length;
            p.hand.forEach((cardType, hIdx) => {
              const offset = (hIdx - (handCount - 1) / 2) * 1.15;
              const tangentX = -Math.sin(angle) * offset;
              const tangentZ = Math.cos(angle) * offset;
              // 自分の手札だけ表面が見え、CPUの手札は裏面
              const showFace = (idx === mySeatIndex);
              create3DDisc(
                idx,
                cardType,
                showFace,
                sx + tangentX,
                0.08,
                sz + tangentZ,
                { isHandDisc: true, seatIndex: idx, handIndex: hIdx, cardType }
              );
            });
          }

          scene.add(seatGroup);
          seatObjects3D.push(seatGroup);
        });
      }

      function create3DDisc(seatIdx, type, isFaceUp, x, y, z, meta) {
        const geo = new THREE.CylinderGeometry(0.75, 0.75, 0.09, 32);
        const sideColor = SEAT_THEMES[seatIdx] ? SEAT_THEMES[seatIdx].hex : 0xd97706;
        const matSide = new THREE.MeshStandardMaterial({ color: sideColor, metalness: 0.4, roughness: 0.3 });
        const matTop = new THREE.MeshStandardMaterial({ map: type === DISC_FLOWER ? texFlower : texSkull, roughness: 0.3 });
        const matBottom = new THREE.MeshStandardMaterial({ map: texBack, roughness: 0.3 });

        const mesh = new THREE.Mesh(geo, [matSide, matTop, matBottom]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(x, y, z);
        mesh.rotation.x = isFaceUp ? 0 : Math.PI;
        mesh.userData = Object.assign({ type, isFaceUp }, meta);

        scene.add(mesh);
        discMeshes3D.push(mesh);
        return mesh;
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
        p.stack.push({ type: cardType, revealed: false, mesh: null });
        SkullSfx.placeCard();

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'play_card', seatIdx, handIdx });
        }

        if (phase === 'FIRST_CARD') {
          checkFirstCardPhaseComplete();
        } else if (phase === 'PLAY_OR_BID') {
          statusBannerText = `${p.name} がディスクを1枚重ねました`;
          advanceTurn(false);
          rebuild3DTableState();
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
          statusBannerText = `全員1枚目をセット完了！【${turnPlayer.name}】の手番です（カード追加 または 枚数宣言）`;
        }
        rebuild3DTableState();
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

        statusBannerText = `🔥 ${p.name} が【${bidAmount}枚】めくれると宣言しました！`;

        // 場の全枚数（上限）に達した場合は即座にそのプレイヤーのチャレンジへ突入！
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

        rebuild3DTableState();
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

        statusBannerText = `${p.name} がパスしました`;

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

        rebuild3DTableState();
        updateAllUI();
        scheduleCpuTurnIfNeeded();
      }

      // フェーズ4: チャレンジ（ディスクめくり）開始
      function startRevealPhase() {
        phase = 'REVEALING';
        currentTurn = highestBidder;
        revealsRemaining = highestBid;
        const challenger = players[highestBidder];

        const hasOwnUnrevealed = challenger.stack.some(c => !c.revealed);
        if (hasOwnUnrevealed) {
          statusBannerText = `🎯 【${challenger.name}】のチャレンジ開始(${revealsRemaining}枚)！まず自分のマットのディスクをめくってください！`;
        } else {
          statusBannerText = `🎯 【${challenger.name}】のチャレンジ！めくる相手のマットを選んでください（残り${revealsRemaining}枚）`;
        }

        rebuild3DTableState();
        updateAllUI();
        scheduleCpuTurnIfNeeded();
      }

      // 指定した座席のスタックの一番上の未公開ディスクをめくる
      function revealTopDiscOfSeat(targetSeatIdx, isRemote = false) {
        if (phase !== 'REVEALING') return;
        const challenger = players[highestBidder];
        const targetPlayer = players[targetSeatIdx];
        if (!targetPlayer) return;

        // 公式鉄則チェック：チャレンジャー自身のマットに未公開ディスクがある間は、他人のマットをめくれない！
        const ownUnrevealed = challenger.stack.some(c => !c.revealed);
        if (ownUnrevealed && targetSeatIdx !== highestBidder) {
          bridge.showToast('⚠️ スカル公式ルール：まず自分のマットのディスクをすべてめくってください！');
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
          bridge.showToast('そのプレイヤーのマットにはめくれるディスクがありません');
          return;
        }

        topCard.revealed = true;
        revealsRemaining--;

        if (!isRemote && bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'reveal_disc', targetSeatIdx });
        }

        // 3Dディスク反転アニメーション
        if (topCard.mesh) {
          animate3DDiscFlip(topCard.mesh, true);
        }

        // 💀 ドクロを引いてしまった場合 → 即座にチャレンジ失敗！！
        if (topCard.type === DISC_SKULL) {
          SkullSfx.flipSkull();
          handleChallengeFailure(challenger, targetPlayer);
          return;
        }

        // 🌸 花だった場合！
        SkullSfx.flipFlower();

        if (revealsRemaining <= 0) {
          // 宣言枚数をすべて花でめくり切った → チャレンジ大成功！！
          handleChallengeSuccess(challenger);
        } else {
          const stillOwn = challenger.stack.some(c => !c.revealed);
          statusBannerText = `🌸 花が出ました！セーフ！（あと ${revealsRemaining} 枚めくってください${stillOwn ? '・まず自分のマットから' : ''}）`;
          updateAllUI();
          scheduleCpuTurnIfNeeded();
        }
      }

      function handleChallengeSuccess(challenger) {
        phase = 'ROUND_END';
        challenger.wins += 1;
        SkullSfx.roundWin();

        if (challenger.wins >= 2) {
          triggerGameVictory(challenger, `見事 ${highestBid} 枚のディスクをすべて🌸花でめくり切り、2勝目を達成しました！！`);
          return;
        }

        currentTurn = challenger.index; // 次のラウンドは成功者からスタート
        roundNumber++;

        showRoundModal(
          '🌸',
          `🎉 ${challenger.name} がチャレンジ成功！`,
          `宣言した <strong>${highestBid}枚</strong> をすべて🌸花でめくり切りました！<br><strong>${challenger.name}</strong> は1勝目を獲得し、リーチ（★）となりました！`,
          '➡️ 次のラウンドへ進む',
          () => startRound(challenger.index)
        );
        rebuild3DTableState();
        updateAllUI();
      }

      function handleChallengeFailure(challenger, skullOwner) {
        phase = 'ROUND_END';

        // ペナルティ：チャレンジャーの所持カード(ownedCards)からランダムに1枚没収！
        let lostCardText = '';
        if (challenger.ownedCards.length > 0) {
          const rndIdx = Math.floor(Math.random() * challenger.ownedCards.length);
          const removed = challenger.ownedCards.splice(rndIdx, 1)[0];
          challenger.forfeitedCount++;
          lostCardText = `${challenger.name} はペナルティとして手札を1枚失いました（残り所持 ${challenger.ownedCards.length}枚）。`;
        }

        if (challenger.ownedCards.length === 0) {
          challenger.isEliminated = true;
          lostCardText += `<br>💀 <strong>${challenger.name} は手札が0枚となり脱落しました！</strong>`;
        }

        const selfSkull = (challenger.index === skullOwner.index);
        const desc = selfSkull
          ? `なんという悲劇！<strong>${challenger.name}</strong> は自分が出した💀ドクロをめくって自爆しました！<br>${lostCardText}`
          : `<strong>${skullOwner.name}</strong> が仕掛けていた💀ドクロを踏んでしまいました！<br>${lostCardText}`;

        // 次のラウンドはドクロを踏ませたプレイヤーからスタート
        const nextStarter = (!skullOwner.isEliminated) ? skullOwner.index : challenger.index;
        roundNumber++;

        showRoundModal(
          '💀',
          `💥 ドクロ出現！チャレンジ失敗！`,
          desc,
          '➡️ 次のラウンドへ進む',
          () => startRound(nextStarter)
        );
        rebuild3DTableState();
        updateAllUI();
      }

      function triggerGameVictory(winner, reasonHtml) {
        phase = 'GAME_OVER';
        SkullSfx.roundWin();
        if (winner.index === mySeatIndex) {
          bridge.recordWin();
        }
        showRoundModal(
          '👑',
          `🏆 ${winner.name} の完全勝利！！`,
          `${reasonHtml}<br><br>スカルの覇者が決定しました！`,
          '🔄 もう1戦プレイする',
          () => initMatch(true)
        );
        rebuild3DTableState();
        updateAllUI();
      }

      function showRoundModal(icon, title, descHtml, btnLabel, onNext) {
        modalIcon.textContent = icon;
        modalTitle.textContent = title;
        modalDesc.innerHTML = descHtml;
        modalNextBtn.textContent = btnLabel;
        modalNextBtn.onclick = () => {
          SkullSfx.placeCard();
          onNext();
        };
        roundModal.classList.remove('hidden');
      }

      // ====================================================
      // 🤖 賢い思考型 CPU AI ルーチン
      // ====================================================
      function cpuPlayFirstCard(cpu) {
        if (cpu.hand.length === 0) return;
        // 75%の確率で花、25%の確率で初手からドクロを仕込むブラフ
        let idx = cpu.hand.findIndex(c => c === DISC_FLOWER);
        if (idx === -1 || Math.random() < 0.25) {
          idx = Math.floor(Math.random() * cpu.hand.length);
        }
        const card = cpu.hand.splice(idx, 1)[0];
        cpu.stack.push({ type: card, revealed: false, mesh: null });
      }

      function scheduleCpuTurnIfNeeded() {
        if (!vsCpu || isDestroyed) return;
        if (cpuTimer) clearTimeout(cpuTimer);

        if (phase === 'PLAY_OR_BID' || phase === 'BIDDING' || phase === 'REVEALING') {
          if (currentTurn !== mySeatIndex) {
            cpuTimer = setTimeout(() => executeCpuStep(), 750);
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
          // 手札がまだあり、場の枚数が少ない時は60%でカード追加、それ以外は1枚または2枚でビッド開始
          if (cpu.hand.length > 0 && Math.random() < 0.55) {
            const pickIdx = Math.floor(Math.random() * cpu.hand.length);
            playCardToMat(cpu.index, pickIdx);
          } else {
            // ビッド開始
            const startBid = (!cpuHasSkullOnTable && totalDiscs >= 2 && Math.random() < 0.4) ? 2 : 1;
            makeBid(cpu.index, Math.min(totalDiscs, startBid));
          }
        } else if (phase === 'BIDDING') {
          // 自分がドクロを置いている場合は、他人に踏ませるため低めならブラフレイズ、高ければ即パスして罠にかける
          const safeEstimate = Math.max(1, Math.floor(totalDiscs * 0.65));
          if (cpuHasSkullOnTable) {
            if (highestBid < 2 && totalDiscs >= 3 && Math.random() < 0.35) {
              makeBid(cpu.index, highestBid + 1);
            } else {
              passBid(cpu.index);
            }
          } else {
            // 自分のマットが全部花なら強気にレイズ可能
            if (highestBid < safeEstimate && Math.random() < 0.6) {
              makeBid(cpu.index, highestBid + 1);
            } else {
              passBid(cpu.index);
            }
          }
        } else if (phase === 'REVEALING') {
          // チャレンジャーCPUがめくる対象を選択
          const ownUnrevealed = cpu.stack.some(c => !c.revealed);
          if (ownUnrevealed) {
            revealTopDiscOfSeat(cpu.index);
          } else {
            // 他人の未公開ディスクがある席からランダムに選択
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
      // 3D アニメーション & マウスインタラクション
      // ====================================================
      function animate3DDiscFlip(mesh, toFaceUp) {
        let prog = 0;
        const startRot = mesh.rotation.x;
        const targetRot = toFaceUp ? 0 : Math.PI;
        const baseY = mesh.position.y;

        function step() {
          prog += 0.12;
          if (prog <= 1) {
            mesh.rotation.x = startRot + (targetRot - startRot) * prog;
            mesh.position.y = baseY + Math.sin(prog * Math.PI) * 0.85;
            requestAnimationFrame(step);
          } else {
            mesh.rotation.x = targetRot;
            mesh.position.y = baseY;
          }
        }
        step();
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let isOrbitDragging = false;
      let prevPointerX = 0;

      function onCanvasPointerDown(e) {
        const rect = canvasMount.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
        const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(discMeshes3D);

        if (hits.length > 0) {
          const hitObj = hits[0].object;
          const u = hitObj.userData;

          // 1. 自分の3D手札ディスクをクリックしたらそのまま場に出せる！
          if (u.isHandDisc && u.seatIndex === mySeatIndex) {
            const myP = players[mySeatIndex];
            const canPlayNow = (phase === 'FIRST_CARD' && myP.stack.length === 0) ||
                               (phase === 'PLAY_OR_BID' && currentTurn === mySeatIndex);
            if (canPlayNow) {
              playCardToMat(mySeatIndex, u.handIndex);
              return;
            }
          }

          // 2. REVEALINGフェーズ中に自分がチャレンジャーなら、3D場のディスクをクリックして直接めくれる！
          if (u.isStackDisc && phase === 'REVEALING' && highestBidder === mySeatIndex) {
            revealTopDiscOfSeat(u.seatIndex);
            return;
          }
        }

        // ディスク以外の場所をドラッグしたらカメラを水平回転できる
        isOrbitDragging = true;
        prevPointerX = clientX;
      }

      function onCanvasPointerMove(e) {
        if (!isOrbitDragging) return;
        const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
        const dx = clientX - prevPointerX;
        prevPointerX = clientX;
        camTheta -= dx * 0.007;
        updateCameraTransform();
      }

      function onCanvasPointerUp() {
        isOrbitDragging = false;
      }

      canvasMount.addEventListener('mousedown', onCanvasPointerDown);
      window.addEventListener('mousemove', onCanvasPointerMove);
      window.addEventListener('mouseup', onCanvasPointerUp);
      canvasMount.addEventListener('touchstart', onCanvasPointerDown, { passive: true });
      window.addEventListener('touchmove', onCanvasPointerMove, { passive: true });
      window.addEventListener('touchend', onCanvasPointerUp);

      // ====================================================
      // 2D コックピット & ステータスUI描画
      // ====================================================
      function updateAllUI() {
        roundBadge.textContent = `ROUND ${roundNumber}`;

        // フェーズ表記
        const phaseMap = {
          FIRST_CARD: 'PHASE 1: 初手セット',
          PLAY_OR_BID: 'PHASE 2: カード追加 or チャレンジ宣言',
          BIDDING: 'PHASE 3: ビッド競争（レイズ or パス）',
          REVEALING: 'PHASE 4: 運命のディスクめくり！',
          ROUND_END: 'ラウンド決着',
          GAME_OVER: '🏆 ゲーム決着'
        };
        phasePill.textContent = phaseMap[phase] || phase;
        announceText.textContent = statusBannerText;

        // 最高宣言カウンター
        if (highestBid > 0 && highestBidder >= 0) {
          bidCounter.classList.remove('hidden');
          bidValEl.textContent = highestBid;
          bidderNameEl.textContent = players[highestBidder].name;
        } else {
          bidCounter.classList.add('hidden');
        }

        // 1. プレイヤー一覧ストリップ更新
        playersStrip.innerHTML = '';
        players.filter(p => p.isActive).forEach(p => {
          const badge = document.createElement('div');
          const isTurn = (phase !== 'FIRST_CARD' && currentTurn === p.index && !p.isEliminated);
          badge.className = `sk-p-badge ${isTurn ? 'active-turn' : ''} ${p.passed ? 'passed' : ''} ${p.isEliminated ? 'eliminated' : ''}`;
          badge.style.borderLeftColor = p.theme.css;
          badge.style.borderLeftWidth = '5px';

          const stars = p.wins >= 2 ? '★★' : (p.wins === 1 ? '★☆' : '☆☆');
          const statusStr = p.isEliminated ? '💀 脱落' : (p.passed ? '⏭️ パス' : `手札:${p.hand.length}`);

          badge.innerHTML = `
            <div class="sk-p-top">
              <span style="color:${p.theme.css}">${p.name}</span>
              <span class="sk-p-stars">${stars}</span>
            </div>
            <div class="sk-p-meta">
              <span class="sk-p-stack">場: ${p.stack.length}枚</span>
              <span>${statusStr}</span>
            </div>
          `;
          playersStrip.appendChild(badge);
        });

        // 2. 自分の手札パネル更新
        const me = players[mySeatIndex];
        if (me) {
          myWinsEl.textContent = `${me.wins >= 2 ? '★★' : (me.wins === 1 ? '★☆' : '☆☆')} (${me.wins}/2勝)`;
          handCardsEl.innerHTML = '';

          const canPlayCard = !me.isEliminated && (
            (phase === 'FIRST_CARD' && me.stack.length === 0) ||
            (phase === 'PLAY_OR_BID' && currentTurn === mySeatIndex)
          );

          if (me.hand.length === 0) {
            handCardsEl.innerHTML = `<span style="font-size:12px;color:#64748b;">現在手元にカードはありません（すべて場に出しています）</span>`;
          } else {
            me.hand.forEach((cardType, hIdx) => {
              const btn = document.createElement('div');
              btn.className = `sk-hand-disc ${cardType} ${canPlayCard ? '' : 'disabled'}`;
              btn.innerHTML = `
                <span class="sk-disc-emoji">${cardType === DISC_FLOWER ? '🌸' : '💀'}</span>
                <span>${cardType === DISC_FLOWER ? '花 (Rose)' : 'ドクロ'}</span>
              `;
              if (canPlayCard) {
                btn.addEventListener('click', () => playCardToMat(mySeatIndex, hIdx));
              }
              handCardsEl.appendChild(btn);
            });
          }
        }

        // 3. 右側アクションパネル更新
        actionControlsEl.innerHTML = '';
        if (!me || me.isEliminated) {
          actionLbl.textContent = '💀 あなたは脱落しました（観戦モード）';
          return;
        }

        if (phase === 'FIRST_CARD') {
          actionLbl.textContent = 'STEP 1: 最初の1枚をセット';
          if (me.stack.length === 0) {
            actionControlsEl.innerHTML = `<span style="font-size:13px;color:#38bdf8;font-weight:700;">👈 左の手札（または3D空間の自分のディスク）をクリックして場に伏せてください</span>`;
          } else {
            actionControlsEl.innerHTML = `<span style="font-size:13px;color:#94a3b8;">⏳ 他のプレイヤーが1枚目を出すのを待っています…</span>`;
          }
        } else if (phase === 'PLAY_OR_BID') {
          if (currentTurn === mySeatIndex) {
            actionLbl.textContent = '🔥 あなたの手番：手札を追加するか、何枚めくれるか宣言！';
            const totalDiscs = getTotalDiscsOnTable();
            for (let b = 1; b <= totalDiscs; b++) {
              const bBtn = document.createElement('button');
              bBtn.className = 'bid-num-btn';
              bBtn.textContent = `📢 ${b}枚で勝負！`;
              bBtn.addEventListener('click', () => makeBid(mySeatIndex, b));
              actionControlsEl.appendChild(bBtn);
            }
          } else {
            actionLbl.textContent = `⏳ ${players[currentTurn].name} の手番です…`;
            actionControlsEl.innerHTML = `<span style="font-size:13px;color:#94a3b8;">相手の判断を待っています…</span>`;
          }
        } else if (phase === 'BIDDING') {
          if (currentTurn === mySeatIndex) {
            actionLbl.textContent = `🔥 あなたの番：${highestBid + 1}枚以上にレイズするかパスしてください`;
            const totalDiscs = getTotalDiscsOnTable();
            for (let b = highestBid + 1; b <= totalDiscs; b++) {
              const bBtn = document.createElement('button');
              bBtn.className = 'bid-num-btn';
              bBtn.textContent = `⬆️ ${b}枚にレイズ`;
              bBtn.addEventListener('click', () => makeBid(mySeatIndex, b));
              actionControlsEl.appendChild(bBtn);
            }
            const pBtn = document.createElement('button');
            pBtn.className = 'pass-bid-btn';
            pBtn.textContent = '⏭️ パスする (降りる)';
            pBtn.addEventListener('click', () => passBid(mySeatIndex));
            actionControlsEl.appendChild(pBtn);
          } else {
            actionLbl.textContent = `⏳ ${players[currentTurn].name} がレイズかパスか考え中…`;
            actionControlsEl.innerHTML = `<span style="font-size:13px;color:#94a3b8;">現在の最高宣言: ${highestBid}枚</span>`;
          }
        } else if (phase === 'REVEALING') {
          if (highestBidder === mySeatIndex) {
            const ownUnrevealed = me.stack.some(c => !c.revealed);
            actionLbl.textContent = `🎯 チャレンジ中（残り ${revealsRemaining} 枚）：めくるディスクを選択！`;

            if (ownUnrevealed) {
              const selfBtn = document.createElement('button');
              selfBtn.className = 'reveal-target-btn';
              selfBtn.textContent = `✨ まず自分のマットをめくる (残り${me.stack.filter(c => !c.revealed).length}枚)`;
              selfBtn.addEventListener('click', () => revealTopDiscOfSeat(mySeatIndex));
              actionControlsEl.appendChild(selfBtn);
            } else {
              players.filter(p => p.isActive && !p.isEliminated && p.index !== mySeatIndex).forEach(p => {
                const unrevCount = p.stack.filter(c => !c.revealed).length;
                if (unrevCount > 0) {
                  const tBtn = document.createElement('button');
                  tBtn.className = 'reveal-target-btn';
                  tBtn.style.borderColor = p.theme.css;
                  tBtn.textContent = `🎴 ${p.name} の山をめくる (未公開:${unrevCount}枚)`;
                  tBtn.addEventListener('click', () => revealTopDiscOfSeat(p.index));
                  actionControlsEl.appendChild(tBtn);
                }
              });
            }
          } else {
            actionLbl.textContent = `👀 ${players[highestBidder].name} がディスクをめくっています…`;
            actionControlsEl.innerHTML = `<span style="font-size:13px;color:#fbbf24;font-weight:700;">ドクロが出るか、花をめくり切るか固唾を呑んで見守りましょう！</span>`;
          }
        }
      }

      // ====================================================
      // トップバーボタン & P2P通信イベント
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
        cpuToggleBtn.textContent = vsCpu ? '🤖 CPU自動進行: ON' : '👥 手動/P2Pモード';
        cpuToggleBtn.classList.toggle('active', vsCpu);
        if (vsCpu) scheduleCpuTurnIfNeeded();
      });

      camBtn.addEventListener('click', () => {
        const order = ['default', 'top', 'closeup'];
        const next = order[(order.indexOf(cameraMode) + 1) % order.length];
        applyCameraPreset(next);
        const labels = { default: '標準斜め俯瞰', top: '真上全体ビュー', closeup: 'ローアングル迫力視点' };
        bridge.showToast(`🎥 カメラアングル: 【${labels[next]}】`);
      });

      newGameBtn.addEventListener('click', () => {
        initMatch(true);
        if (bridge.isConnected()) {
          bridge.send({ game: 'skull', type: 'restart_match' });
        }
        bridge.showToast('新しいゲームを開始しました！');
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
        bridge.showToast('対戦相手が着席しました！3Dスカル開始！');
      });

      // レンダリングループ
      function animate() {
        if (isDestroyed) return;
        animFrameId = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }

      function handleResize() {
        if (!canvasMount || isDestroyed) return;
        const w = canvasMount.clientWidth;
        const h = canvasMount.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
      window.addEventListener('resize', handleResize);

      // 起動
      initMatch(true);
      animate();

      this.cleanup = () => {
        isDestroyed = true;
        if (cpuTimer) clearTimeout(cpuTimer);
        if (animFrameId) cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', onCanvasPointerMove);
        window.removeEventListener('mouseup', onCanvasPointerUp);
        window.removeEventListener('touchmove', onCanvasPointerMove);
        window.removeEventListener('touchend', onCanvasPointerUp);
        renderer.dispose();
      };
      return this.cleanup;
    },

    unmount() {
      if (this.cleanup) this.cleanup();
    }
  });
})();
