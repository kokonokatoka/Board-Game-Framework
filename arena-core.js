/**
 * 🎲 BOARD ARENA - Platform Core Engine (AAA Overhaul Edition)
 * マルチゲーム統合アーキテクチャ & WebRTC P2P基盤
 * 
 * 🌟 AAA Features:
 * - プレイスタイル分類 (Solo / Duo / Multi)
 * - ジャンルチップス & リアルタイム検索 & ソート
 * - ヒーロースポットライト・カルーセル
 * - 詳細ルール解説モーダル
 * - プレイヤープロフィール & 戦績カウンター & 10大実績システム
 * - Web Audio API による上品なUI効果音
 * - パスワード不要の即時自動マッチング維持
 */

(function () {
  const PEER_PREFIX = 'board-arena-v1-';

  // ==========================================
  // 1. Web Audio API サウンドエンジン (SFX)
  // ==========================================
  const SoundFx = {
    ctx: null,
    enabled: localStorage.getItem('ba_sfx_enabled') !== 'false',

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        const resume = () => {
          this.ctx.resume();
          window.removeEventListener('click', resume);
          window.removeEventListener('keydown', resume);
        };
        window.addEventListener('click', resume);
        window.addEventListener('keydown', resume);
      }
    },

    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem('ba_sfx_enabled', this.enabled ? 'true' : 'false');
      const sfxBtn = document.getElementById('sfx-toggle-btn');
      if (sfxBtn) {
        sfxBtn.textContent = this.enabled ? '🔊' : '🔇';
        sfxBtn.title = this.enabled ? '効果音: ON' : '効果音: OFF';
      }
      if (this.enabled) this.playTone(800, 0.05, 'sine', 0.1);
      return this.enabled;
    },

    playTone(freq, duration, type = 'sine', gain = 0.08) {
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    },

    playHover() {
      this.playTone(600, 0.03, 'sine', 0.03);
    },

    playClick() {
      this.playTone(1100, 0.05, 'triangle', 0.09);
    },

    playModalOpen() {
      if (!this.enabled) return;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 0.08, 'sine', 0.07), idx * 45);
      });
    },

    playGameStart() {
      if (!this.enabled) return;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 0.12, 'triangle', 0.08), idx * 60);
      });
    },

    playAchievement() {
      if (!this.enabled) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 0.15, 'triangle', 0.1), idx * 80);
      });
    }
  };

  // ==========================================
  // 2. 実績一覧定義 & プロフィール管理
  // ==========================================
  const ACHIEVEMENTS_DEF = [
    { id: 'first_game', icon: '🔰', title: '初めの一歩', desc: 'いずれかのボードゲームをプレイした' },
    { id: 'first_win', icon: '🏆', title: '初栄冠', desc: '対戦で初めて勝利を収めた' },
    { id: 'matches_5', icon: '⚔️', title: '歴戦の勇士', desc: '通算5回ゲームをプレイした' },
    { id: 'wins_3', icon: '👑', title: '勝負師', desc: '通算3回の勝利を達成した' },
    { id: 'play_skull', icon: '💀', title: '髑髏の掟', desc: '3Dスカルの心理戦に挑んだ' },
    { id: 'play_codenames', icon: '🕵️', title: '極秘任務', desc: 'コードネームでスパイ戦を繰り広げた' },
    { id: 'play_yacht', icon: '🎲', title: 'ダイス狂', desc: 'ヨットでサイコロを振った' },
    { id: 'play_quarto', icon: '🏛️', title: '四神の布石', desc: 'クアルトで相手にコマを渡した' },
    { id: 'brain_master', icon: '🧠', title: 'メンタリスト', desc: '頭脳・アブストラクト系ゲームを遊んだ' },
    { id: 'share_link', icon: '🌐', title: 'ゲームホスト', desc: '招待URLをコピーして友達を誘った' }
  ];

  const ProfileManager = {
    data: {
      username: localStorage.getItem('ba_username') || '名無しプレイヤー',
      avatar: localStorage.getItem('ba_avatar') || '👑',
      matches: parseInt(localStorage.getItem('ba_matches') || '0', 10),
      wins: parseInt(localStorage.getItem('ba_wins') || '0', 10),
      achievements: JSON.parse(localStorage.getItem('ba_achievements') || '[]'),
      playedGames: JSON.parse(localStorage.getItem('ba_played_games') || '[]')
    },

    save() {
      localStorage.setItem('ba_username', this.data.username);
      localStorage.setItem('ba_avatar', this.data.avatar);
      localStorage.setItem('ba_matches', this.data.matches.toString());
      localStorage.setItem('ba_wins', this.data.wins.toString());
      localStorage.setItem('ba_achievements', JSON.stringify(this.data.achievements));
      localStorage.setItem('ba_played_games', JSON.stringify(this.data.playedGames));
      this.updateHeaderDisplay();
    },

    updateHeaderDisplay() {
      const headerAvatar = document.getElementById('header-avatar');
      const headerName = document.getElementById('header-username');
      const headerTrophy = document.getElementById('header-trophy-count');
      if (headerAvatar) headerAvatar.textContent = this.data.avatar;
      if (headerName) headerName.textContent = this.data.username;
      if (headerTrophy) headerTrophy.textContent = `🏆 ${this.data.achievements.length}`;
    },

    setUsername(name) {
      this.data.username = name.trim() || 'プレイヤー';
      this.save();
    },

    setAvatar(av) {
      this.data.avatar = av;
      this.save();
    },

    recordMatch(gameId) {
      this.data.matches += 1;
      if (!this.data.playedGames.includes(gameId)) {
        this.data.playedGames.push(gameId);
      }
      this.unlockAchievement('first_game');
      if (this.data.matches >= 5) this.unlockAchievement('matches_5');
      if (gameId === 'skull') this.unlockAchievement('play_skull');
      if (gameId === 'codenames') this.unlockAchievement('play_codenames');
      if (gameId === 'yacht') this.unlockAchievement('play_yacht');
      if (gameId === 'quarto') this.unlockAchievement('play_quarto');
      
      const brainGames = ['othello', 'gomoku', 'gobblet', 'blokus', 'connect4', 'mancala', 'quoridor', 'checkers', 'quarto'];
      if (brainGames.includes(gameId)) {
        this.unlockAchievement('brain_master');
      }
      this.save();
    },

    recordWin() {
      this.data.wins += 1;
      this.unlockAchievement('first_win');
      if (this.data.wins >= 3) this.unlockAchievement('wins_3');
      this.save();
    },

    unlockAchievement(id) {
      if (this.data.achievements.includes(id)) return;
      this.data.achievements.push(id);
      this.save();
      SoundFx.playAchievement();

      const ach = ACHIEVEMENTS_DEF.find(a => a.id === id);
      if (ach) {
        showGlobalToast(`🎖️ 実績解除: ${ach.icon} ${ach.title}！`);
      }
    }
  };

  // ==========================================
  // 3. 全16タイトルの詳細メタデータ定義
  // ==========================================
  const GAME_METADATA = {
    othello: {
      category: '🧠 定番アブストラクト',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '5-10分',
      timeMinutes: 8,
      rating: 4.8,
      releaseOrder: 1,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(56, 189, 248, 0.2), transparent 70%)',
      detailedRules: {
        overview: '挟んで裏返す世界的人気ボードゲーム。序盤・中盤・終盤でガラリと戦況が変わる奥深さ！',
        rules: [
          '黒と白に分かれ、交互に石を盤面に打っていきます。',
          '相手の石を挟めるマスにしか打てません（挟んだ相手の石はすべて自分の色に裏返ります）。',
          '挟める場所がない場合は手番がスキップ（パス）されます。'
        ],
        winCondition: '盤面がすべて埋まるか、両者ともに打てなくなった時点で、石の多いプレイヤーの勝利！',
        proTip: '四隅の「角（スミ）」は絶対に取られない絶対安全地帯！序盤は角の隣に打たないように注意しましょう。'
      }
    },
    gomoku: {
      category: '🧠 定番ライン戦',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '3-8分',
      timeMinutes: 5,
      rating: 4.7,
      releaseOrder: 2,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(251, 191, 36, 0.2), transparent 70%)',
      detailedRules: {
        overview: '縦・横・斜めに5つ連続で碁石を並べた方が勝ちとなる、極めてシンプルかつ純粋な思考力バトル！',
        rules: [
          '黒（先手）と白（後手）が交互に盤面の交点に石を1個ずつ置きます。',
          '一度置いた石は動かすことも取り除くこともできません。'
        ],
        winCondition: '先に縦・横・斜めのいずれかの直線上に「連続して5個」自分の石を並べたプレイヤーの即時勝利！',
        proTip: '「三」を作って相手が防ぐ間に「四」を作る「四三（よんさん）」の形を先手で作るのが必勝パターンです。'
      }
    },
    gobblet: {
      category: '🎩 立体三目並べ',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '5分',
      timeMinutes: 5,
      rating: 4.8,
      releaseOrder: 3,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(239, 68, 68, 0.2), transparent 70%)',
      detailedRules: {
        overview: '大・中・小のコマを使い、相手のコマに上から被せることができる驚きの立体進化版○×ゲーム！',
        rules: [
          '各プレイヤーは大・中・小各2個の持ちゴマを持っています。',
          '手番では「手持ちのコマを空きマスに置く」「手持ちのコマを小さなコマの上に被せる」「すでに盤上にある自分のコマを移動する」のいずれかを行います。',
          '下に隠れているコマの色を覚えておく記憶力も試されます。'
        ],
        winCondition: '3×3の盤面で、自分の色のコマを縦・横・斜めのいずれかに先に3つ並べた方の勝利！',
        proTip: '被せているコマを動かした瞬間、下に隠れていた相手のコマが現れて相手の3連が完成してしまう自滅に注意！'
      }
    },
    blokus: {
      category: '🧩 陣取りパズル',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '10-15分',
      timeMinutes: 12,
      rating: 4.9,
      releaseOrder: 4,
      featured: true,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.25), transparent 70%)',
      detailedRules: {
        overview: 'ピースのカドとカドを繋げて盤面を埋め尽くす領土拡大パズル！相手の進路を封鎖せよ！',
        rules: [
          '各プレイヤーは形の異なる様々なテトロミノ・ペントミノピースを持ちます。',
          '最初の1手は盤面の指定スタートマスに重なるように置きます。',
          '2手目以降は、自分の色のピースの「カド（頂点）」同士でのみ接触させることができます。「辺」で接触させてはいけません（相手ピースの辺とは接触OK）。'
        ],
        winCondition: '両者ピースを置けなくなった時点でゲーム終了。手元に残ったピースのマス数（ペナルティ）が少ない方の勝利！',
        proTip: 'マス数の多い大きなピースから先に中央へ伸ばし、相手の陣地に入り込んで進路をブロックするのが定石です。'
      }
    },
    block_battle: {
      category: '⚡ 3D立体陣取り',
      playerTypes: ['solo', 'duo'],
      genre: 'action',
      playTime: '5-10分',
      timeMinutes: 7,
      rating: 4.8,
      releaseOrder: 5,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(147, 51, 234, 0.25), transparent 70%)',
      detailedRules: {
        overview: 'Three.jsで描画された立体空間にブロックを積み上げて高所と陣地を争う3Dリアルタイム陣取り！',
        rules: [
          'マウスドラッグでカメラを360度自由に回転させながら盤面を観察できます。',
          'クリックで立方体ブロックを配置。高さを積み重ねていくことができます。'
        ],
        winCondition: '規定ターン終了時に、より高いタワーを制圧しているかラインを完成させたプレイヤーの勝利！',
        proTip: '立体的な死角に相手がブロックを伸ばしてくることがあるため、頻繁に視点を回して立体構造を把握しましょう。'
      }
    },
    poker: {
      category: '🕵️ カード・心理戦',
      playerTypes: ['duo', 'multi'],
      genre: 'bluff',
      playTime: '10-20分',
      timeMinutes: 15,
      rating: 4.9,
      releaseOrder: 6,
      featured: true,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(16, 185, 129, 0.25), transparent 70%)',
      detailedRules: {
        overview: '手札2枚と共通コミュニティカード5枚で最強の5枚を作る世界標準「テキサスホールデム」！',
        rules: [
          'プリフロップ、フロップ（3枚）、ターン（1枚）、リバー（1枚）の順に共通カードが開きます。',
          '各ラウンドで「チェック」「ベット」「コール」「レイズ」「フォールド（降り）」のアクションを選択。'
        ],
        winCondition: 'ショーダウンで最強の役を持っているか、ブラフ（ハッタリ）で相手全員をフォールドさせればポット獲得！',
        proTip: 'どんな弱い手札でも、強気なレイズで相手を脅して降ろせば勝利できます。ポーカーフェイスが命！'
      }
    },
    codenames: {
      category: '🕵️ 言葉の推理戦',
      playerTypes: ['duo', 'multi'],
      genre: 'bluff',
      playTime: '10-15分',
      timeMinutes: 12,
      rating: 4.9,
      releaseOrder: 7,
      featured: true,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(245, 158, 11, 0.25), transparent 70%)',
      detailedRules: {
        overview: 'スパイマスターの「たった1つの単語ヒント」から仲間を探し出せ！世界的人気ワード推理ゲーム！',
        rules: [
          '25枚の単語カードから、赤チーム・青チームそれぞれの味方エージェントを見つけ出します。',
          'スパイマスターは「味方カードに共通するキーワード1単語」と「枚数」だけをヒントとして伝えます。',
          '味方の回答者は相談して単語をタップ！一般人を選ぶとターン終了、黒の暗殺者を選ぶと即座に敗北！'
        ],
        winCondition: '相手チームよりも先に、自チームのすべてのエージェントカードを開ければ勝利！',
        proTip: '複数の味方ワードを同時に連想できる絶妙な単語をひらめいた時の快感は格別です。暗殺者ワードとの混同に注意！'
      }
    },
    connect4: {
      category: '🧠 重力式四目並べ',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '3-5分',
      timeMinutes: 4,
      rating: 4.7,
      releaseOrder: 8,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(234, 179, 8, 0.2), transparent 70%)',
      detailedRules: {
        overview: 'スリットの上からコインを落とし、重力で積み重なる中で縦・横・斜めに4つ並べる古典名作！',
        rules: [
          '7列×6段のグリッドの上部をクリックしてコインを落とします。',
          'コインは一番下の空いているマスまで落下して止まります。'
        ],
        winCondition: '先に自分の色のコインを直線状（縦・横・斜め）に4つ並べたプレイヤーの勝利！',
        proTip: '中央の列（4列目）を制圧することが勝利への最大の近道です。二重のリーチ（両端空き）を作れば必勝！'
      }
    },
    mancala: {
      category: '🧠 最古の知恵比べ',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '5-10分',
      timeMinutes: 8,
      rating: 4.8,
      releaseOrder: 9,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(217, 119, 6, 0.2), transparent 70%)',
      detailedRules: {
        overview: '紀元前から親しまれる石蒔きゲーム。先の先まで石の流れを計算する数学的パズル性！',
        rules: [
          '自分の陣地にある6つのポケットから1つを選び、中の石を反時計回りに1個ずつポケットに配っていきます。',
          '【連続手番】最後の石が自分の「ゴール（ストア）」に入ると、もう一度自分の手番になります。',
          '【横取り】最後の石が自分の空のポケットに入り、その向かいの相手ポケットに石がある場合、両方の石をすべて自分のストアに獲得できます！'
        ],
        winCondition: 'どちらかのポケットがすべて空になったら終了。ストアに石をより多く集めたプレイヤーの勝利！',
        proTip: 'いかに連続手番を発生させ、相手の大量の石を横取りできるかが勝負の分かれ目です。'
      }
    },
    quoridor: {
      category: '🧠 迷路構築バトル',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '10-15分',
      timeMinutes: 12,
      rating: 4.9,
      releaseOrder: 10,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.2), transparent 70%)',
      detailedRules: {
        overview: '自分のコマを進めるか、木壁を置いて相手の行く手を阻むか！知略が交差する迷路バトル！',
        rules: [
          '手番では「自分のコマを前後左右に1マス進める」か「壁を1枚置いて相手を妨害する」のどちらかを選択。',
          '※相手のゴールまでの進路を「完全に閉ざす」壁の配置は禁止されています（必ず1本は通り道を残す）。'
        ],
        winCondition: '先に相手側の最奥の列（向かい側の端）に自分のコマを到達させたプレイヤーの勝利！',
        proTip: '壁は貴重なリソース（各10枚）。序盤に使い切らず、相手が近道を進もうとした瞬間に遠回りを強いるのが効果的です。'
      }
    },
    dotsandboxes: {
      category: '🚢 陣取りペンシルパズル',
      playerTypes: ['solo', 'duo'],
      genre: 'puzzle',
      playTime: '5-10分',
      timeMinutes: 7,
      rating: 4.6,
      releaseOrder: 11,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(14, 165, 233, 0.2), transparent 70%)',
      detailedRules: {
        overview: '格子点に1本ずつ線を引き、4本の線で四角形を囲んで陣地を獲得する連鎖ボーナスゲーム！',
        rules: [
          '交互に点と点の間に水平または垂直の線を1本引きます。',
          '正方形の4辺目を引いて箱を完成させたプレイヤーはその箱を獲得し、ボーナスとして「もう一度線を引く」権利を得ます！'
        ],
        winCondition: 'すべての箱が埋まった時点で、より多くの箱を獲得していたプレイヤーの勝利！',
        proTip: '相手に3辺揃った箱を渡さないよう、あえて安全な辺を引き続けるのが終盤の爆発的連鎖への鍵です。'
      }
    },
    skull: {
      category: '🕵️ 究極のブラフ (3D卓上)',
      playerTypes: ['solo', 'duo', 'multi'],
      genre: 'bluff',
      playTime: '10-20分',
      timeMinutes: 15,
      rating: 5.0,
      releaseOrder: 12,
      featured: true,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(239, 68, 68, 0.3), transparent 70%)',
      detailedRules: {
        overview: 'カジノテーブルで囲む至高の心理戦！手札を掴んでドラッグ＆ドロップで場に出し、ダブルクリックでめくる本格卓上3Dシミュレーター！',
        rules: [
          '各プレイヤーは花3枚・ドクロ1枚の手札を持ちます。',
          '手元からディスクを掴んでテーブル中央に伏せて出していきます（相手には裏面しか見えません）。',
          '誰かが「何枚めくれるか」のチャレンジを宣言！最高宣言者が宣言した枚数のディスクをめくります。',
          'ドクロをめくらずすべて花をめくれば1勝獲得！ドクロをめくってしまったら手札を1枚失います。'
        ],
        winCondition: '誰よりも先に「2回チャレンジ成功」を達成するか、他のプレイヤーが全員脱落すれば勝利！',
        proTip: '「自分が出したドクロ」を相手にめくらせるように誘導する大胆なブラフがこのゲームの真骨頂です。'
      }
    },
    battleship: {
      category: '🚢 レーダー索敵戦',
      playerTypes: ['solo', 'duo'],
      genre: 'puzzle',
      playTime: '10-15分',
      timeMinutes: 12,
      rating: 4.7,
      releaseOrder: 13,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(6, 182, 212, 0.25), transparent 70%)',
      detailedRules: {
        overview: '相手の視界から隠されたグリッドに艦隊を配置し、座標砲撃で敵艦の位置を暴いて撃沈する海戦パズル！',
        rules: [
          '自陣グリッドに戦艦（4マス）、巡洋艦（3マス）、駆逐艦（2マス）などを自由に配置します。',
          '交互に敵陣の座標（例: D-5）を指定して砲撃！「命中（Hit）」か「波しぶき（Miss）」かが表示されます。',
          'その船のすべてのマスに命中させると「撃沈（Sunk）」となります。'
        ],
        winCondition: '先に相手のすべての艦船を撃沈させたプレイヤーの勝利！',
        proTip: '1マス命中したら、その上下左右を集中砲撃して船の向き（縦か横か）を特定しましょう。市松模様に撃つのが索敵のコツです。'
      }
    },
    checkers: {
      category: '🧠 伝統跳躍バトル',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '5-10分',
      timeMinutes: 8,
      rating: 4.7,
      releaseOrder: 14,
      featured: false,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(220, 38, 38, 0.2), transparent 70%)',
      detailedRules: {
        overview: '斜め前方に跳び越えて敵のコマを捕獲！奥の列に達して「キング」に成れば全方向へ疾走！',
        rules: [
          'コマは黒マスの斜め前方に1マス進みます。',
          '斜め前に敵のコマがあり、その直後のマスが空いていれば、跳び越えてそのコマを捕獲（盤面から除去）できます。',
          '連続して跳び越えられる場合は、1手番で何個でも連続捕獲が可能です！',
          '相手の最奥マスに到達したコマは「キング（王）」になり、斜め後方にも移動・捕獲できるようになります。'
        ],
        winCondition: '相手のコマをすべて全滅させるか、相手が合法手を打てなくなったら勝利！',
        proTip: 'キングを作った側が圧倒的に有利になります。自陣の最後列をむやみに動かさず、相手のキング化を阻止しましょう。'
      }
    },
    quarto: {
      category: '🏛️ 史上最も受賞した名作',
      playerTypes: ['solo', 'duo'],
      genre: 'brain',
      playTime: '5-10分',
      timeMinutes: 8,
      rating: 4.9,
      releaseOrder: 15,
      featured: true,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(168, 85, 247, 0.25), transparent 70%)',
      detailedRules: {
        overview: '「自分が置くコマは相手が選ぶ」驚愕のルール！世界で最も多くの賞を受賞した四目並べの頂点！',
        rules: [
          '16個のコマはそれぞれ4つの属性を持っています：【色（白/黒）】【高さ（高/低）】【形状（丸/四角）】【穴（あり/なし）】。',
          '手番プレイヤーは「相手から渡されたコマ」を4×4の盤面の空きマスに置きます。',
          'そして、残ったコマの中から「次に相手が置くコマ」を1個選んで相手に渡します。'
        ],
        winCondition: '縦・横・斜めのいずれかの4マスに、「共通の属性を持つ4つのコマ」を並べて「クアルト！」と宣言した方の勝利！',
        proTip: '相手が勝ちになるコマを絶対に渡さないこと！盤面を凝視し、どの属性が3つ揃っているかを完璧に見極めましょう。'
      }
    },
    yacht: {
      category: '🎲 ダイス役構築',
      playerTypes: ['solo', 'duo'],
      genre: 'dice',
      playTime: '10-15分',
      timeMinutes: 12,
      rating: 4.8,
      releaseOrder: 16,
      featured: true,
      bannerBg: 'radial-gradient(circle at 80% 50%, rgba(234, 179, 8, 0.25), transparent 70%)',
      detailedRules: {
        overview: '5個のサイコロを最大3回振り直し、役を作ってスコアシートを埋める！世界的人気のダイスゲーム！',
        rules: [
          '5個のサイコロを一斉に振ります。',
          '残したいサイコロをキープし、残りを最大2回まで振り直すことができます。',
          '出目確定後、スコア表（エース〜シックス、フルハウス、ストレート、ヨット等）の空いている項目を1つ選んで得点を記録します。'
        ],
        winCondition: '全12ラウンド終了時に、スコアシートの合計得点が最も高かったプレイヤーの勝利！',
        proTip: '5つのサイコロがすべて同じ目になる「ヨット」は50点！上段（1〜6の目）で合計63点以上取ると＋35点のボーナスが獲得できます！'
      }
    }
  };

  // プラットフォーム共通ステート
  const state = {
    games: new Map(),
    activeGame: null,
    peer: null,
    conn: null,
    isHost: false,
    roomCode: '',
    isConnected: false,
    localName: ProfileManager.data.username,
    remoteName: '対戦相手',
    myPlayerIndex: 1
  };

  // フィルター＆ソート状態
  const filterState = {
    playerType: 'all',
    genre: 'all',
    searchQuery: '',
    sortBy: 'featured'
  };

  // スポットライト カルーセル状態
  const spotlightState = {
    featuredIds: ['skull', 'yacht', 'codenames', 'quarto', 'blokus', 'poker'],
    currentIndex: 0,
    timer: null,
    isHovered: false
  };

  // UI要素キャッシュ
  const el = {
    catalogView: document.getElementById('catalog-view'),
    gameView: document.getElementById('game-view'),
    gamesGrid: document.getElementById('games-grid'),
    mountPoint: document.getElementById('game-mount-point'),
    networkStatus: document.getElementById('network-status'),
    logoBtn: document.getElementById('logo-btn'),
    backBtn: document.getElementById('back-to-catalog-btn'),
    activeGameTitle: document.getElementById('active-game-title'),
    shareRoomBtn: document.getElementById('share-room-btn'),
    customRoomBtn: document.getElementById('custom-room-btn'),
    
    p1Box: document.getElementById('p1-box'),
    p2Box: document.getElementById('p2-box'),
    p1NameDisplay: document.getElementById('p1-name-display'),
    p2NameDisplay: document.getElementById('p2-name-display'),
    matchStatusBadge: document.getElementById('match-status-badge'),
    
    // スポットライト
    heroSpotlight: document.getElementById('hero-spotlight'),
    heroSpotlightBg: document.getElementById('hero-spotlight-bg'),
    spotlightTitle: document.getElementById('spotlight-title'),
    spotlightDesc: document.getElementById('spotlight-desc'),
    spotlightIcon: document.getElementById('spotlight-icon'),
    spotlightRating: document.getElementById('spotlight-rating'),
    spotlightPlayers: document.getElementById('spotlight-players'),
    spotlightDots: document.getElementById('spotlight-dots'),
    spotlightPlayBtn: document.getElementById('spotlight-play-btn'),
    spotlightRuleBtn: document.getElementById('spotlight-rule-btn'),

    // フィルター & ソート
    playerFilterTabs: document.getElementById('player-filter-tabs'),
    genreChipsScroll: document.getElementById('genre-chips-scroll'),
    gameSearchInput: document.getElementById('game-search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    sortSelector: document.getElementById('sort-selector'),
    noResultsMsg: document.getElementById('no-results-msg'),
    resetFilterBtn: document.getElementById('reset-filter-btn'),

    // ルールモーダル
    ruleModal: document.getElementById('rule-modal'),
    ruleModalIcon: document.getElementById('rule-modal-icon'),
    ruleModalTitle: document.getElementById('rule-modal-title'),
    ruleModalCategory: document.getElementById('rule-modal-category'),
    ruleModalBody: document.getElementById('rule-modal-body'),
    closeRuleModalBtn: document.getElementById('close-rule-modal-btn'),
    rulePlayNowBtn: document.getElementById('rule-play-now-btn'),

    // プロフィールモーダル
    profileBtn: document.getElementById('profile-btn'),
    profileModal: document.getElementById('profile-modal'),
    closeProfileModalBtn: document.getElementById('close-profile-modal-btn'),
    modalCurrentAvatar: document.getElementById('modal-current-avatar'),
    avatarPicker: document.getElementById('avatar-picker'),
    modalUsernameInput: document.getElementById('modal-username-input'),
    statMatches: document.getElementById('stat-matches'),
    statWins: document.getElementById('stat-wins'),
    statWinrate: document.getElementById('stat-winrate'),
    achievementsList: document.getElementById('achievements-list'),

    // ロビーモーダル
    lobbyModal: document.getElementById('lobby-modal'),
    lobbyGameTitle: document.getElementById('lobby-game-title'),
    createRoomBtn: document.getElementById('create-room-btn'),
    roomCreatedInfo: document.getElementById('room-created-info'),
    displayRoomCode: document.getElementById('display-room-code'),
    copyInviteUrlBtn: document.getElementById('copy-invite-url-btn'),
    copyToast: document.getElementById('copy-toast'),
    joinCodeInput: document.getElementById('join-code-input'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    closeLobbyBtn: document.getElementById('close-lobby-btn'),
    chatToast: document.getElementById('chat-toast'),
    sfxToggleBtn: document.getElementById('sfx-toggle-btn')
  };

  // ==========================================
  // 4. 公開 API (ゲームモジュール登録インターフェース)
  // ==========================================
  window.BoardArena = {
    registerGame(config) {
      if (!config.id) return;
      const meta = GAME_METADATA[config.id] || {};
      const fullGame = Object.assign({
        playerTypes: meta.playerTypes || ['duo'],
        genre: meta.genre || 'brain',
        playTime: meta.playTime || '5-15分',
        timeMinutes: meta.timeMinutes || 10,
        rating: meta.rating || 4.8,
        releaseOrder: meta.releaseOrder || 99,
        detailedRules: meta.detailedRules || { overview: config.description || '', rules: [], winCondition: '', proTip: '' }
      }, config);

      if (meta.category) fullGame.category = meta.category;
      state.games.set(config.id, fullGame);

      scheduleCatalogRender();
      checkInitialUrlRoute();
    }
  };

  let renderDebounce = null;
  function scheduleCatalogRender() {
    if (renderDebounce) clearTimeout(renderDebounce);
    renderDebounce = setTimeout(() => {
      renderCatalog();
      updateFilterCounts();
      initSpotlightCarousel();
    }, 40);
  }

  // ==========================================
  // 5. カタログ描画 & フィルター & ソート
  // ==========================================
  function renderCatalog() {
    if (!el.gamesGrid) return;
    el.gamesGrid.innerHTML = '';

    const gamesList = Array.from(state.games.values());
    const query = filterState.searchQuery.trim().toLowerCase();

    // フィルタリング
    const filtered = gamesList.filter(game => {
      // プレイスタイル
      if (filterState.playerType !== 'all') {
        if (!game.playerTypes || !game.playerTypes.includes(filterState.playerType)) {
          return false;
        }
      }
      // ジャンル
      if (filterState.genre !== 'all') {
        if (game.genre !== filterState.genre) {
          return false;
        }
      }
      // 検索クエリ
      if (query) {
        const titleMatch = (game.name || '').toLowerCase().includes(query);
        const descMatch = (game.description || '').toLowerCase().includes(query);
        const catMatch = (game.category || '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !catMatch) return false;
      }
      return true;
    });

    // ソート
    filtered.sort((a, b) => {
      switch (filterState.sortBy) {
        case 'newest':
          return (b.releaseOrder || 0) - (a.releaseOrder || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'time':
          return (a.timeMinutes || 0) - (b.timeMinutes || 0);
        case 'title':
          return (a.name || '').localeCompare(b.name || '', 'ja');
        case 'featured':
        default:
          // おすすめ順: スポットライト対象を優先、次いでレーティング降順
          const aFeatured = spotlightState.featuredIds.includes(a.id) ? 1 : 0;
          const bFeatured = spotlightState.featuredIds.includes(b.id) ? 1 : 0;
          if (bFeatured !== aFeatured) return bFeatured - aFeatured;
          return (b.rating || 0) - (a.rating || 0);
      }
    });

    // 結果表示判定
    if (filtered.length === 0) {
      if (el.noResultsMsg) el.noResultsMsg.classList.remove('hidden');
    } else {
      if (el.noResultsMsg) el.noResultsMsg.classList.add('hidden');
      filtered.forEach(game => {
        el.gamesGrid.appendChild(createGameCardElement(game));
      });
    }
  }

  function createGameCardElement(game) {
    const card = document.createElement('div');
    card.className = 'game-card';

    // プレイスタイル表記
    let playerLabel = '1 vs 1';
    if (game.playerTypes.includes('multi')) playerLabel = '2〜8人';
    else if (game.playerTypes.includes('solo') && game.playerTypes.length === 1) playerLabel = 'ソロ専用';
    else if (game.playerTypes.includes('solo')) playerLabel = 'ソロ / 1vs1';

    card.innerHTML = `
      <div>
        <div class="card-top">
          <div class="card-icon">${game.icon || '🎲'}</div>
          <div>
            <div class="card-title">${game.name}</div>
            <div style="display:flex;gap:6px;align-items:center;margin-top:2px;">
              <span class="card-badge">${game.category || 'ボードゲーム'}</span>
              <span style="font-size:11px;color:#fbbf24;font-weight:700;">★ ${game.rating || 4.8}</span>
            </div>
          </div>
        </div>
        <p class="card-desc">${game.description || ''}</p>
      </div>
      <div>
        <div class="card-meta">
          <span>👥 ${playerLabel}</span>
          <span>⏱️ ${game.playTime || '5-15分'}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-primary card-btn card-play-btn" style="flex:1;">⚡ 即プレイ</button>
          <button class="btn btn-secondary card-rule-btn" style="padding:0 12px;font-size:12px;" title="ルール解説を見る">📖 ルール</button>
        </div>
      </div>
    `;

    card.addEventListener('mouseenter', () => SoundFx.playHover());

    // 即プレイボタン
    const playBtn = card.querySelector('.card-play-btn');
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      SoundFx.playClick();
      autoJoinGame(game.id, 'lobby');
    });

    // ルールボタン
    const ruleBtn = card.querySelector('.card-rule-btn');
    ruleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      SoundFx.playClick();
      openRuleModal(game.id);
    });

    // カード全体クリックでも即プレイ
    card.addEventListener('click', () => {
      SoundFx.playClick();
      autoJoinGame(game.id, 'lobby');
    });

    return card;
  }

  function updateFilterCounts() {
    const gamesList = Array.from(state.games.values());
    const countAll = document.getElementById('count-all');
    const countSolo = document.getElementById('count-solo');
    const countDuo = document.getElementById('count-duo');
    const countMulti = document.getElementById('count-multi');

    if (countAll) countAll.textContent = gamesList.length;
    if (countSolo) countSolo.textContent = gamesList.filter(g => g.playerTypes && g.playerTypes.includes('solo')).length;
    if (countDuo) countDuo.textContent = gamesList.filter(g => g.playerTypes && g.playerTypes.includes('duo')).length;
    if (countMulti) countMulti.textContent = gamesList.filter(g => g.playerTypes && g.playerTypes.includes('multi')).length;
  }

  // ==========================================
  // 6. ヒーロースポットライト・カルーセル
  // ==========================================
  function initSpotlightCarousel() {
    if (!el.spotlightDots || spotlightState.featuredIds.length === 0) return;
    el.spotlightDots.innerHTML = '';

    spotlightState.featuredIds.forEach((id, idx) => {
      const dot = document.createElement('button');
      dot.className = `spotlight-dot ${idx === spotlightState.currentIndex ? 'active' : ''}`;
      dot.title = `スライド ${idx + 1}`;
      dot.addEventListener('click', () => {
        SoundFx.playClick();
        spotlightState.currentIndex = idx;
        updateSpotlightDisplay();
      });
      el.spotlightDots.appendChild(dot);
    });

    updateSpotlightDisplay();

    if (!spotlightState.timer) {
      spotlightState.timer = setInterval(() => {
        if (!spotlightState.isHovered && el.catalogView.classList.contains('active')) {
          spotlightState.currentIndex = (spotlightState.currentIndex + 1) % spotlightState.featuredIds.length;
          updateSpotlightDisplay();
        }
      }, 7000);
    }

    if (el.heroSpotlight) {
      el.heroSpotlight.addEventListener('mouseenter', () => { spotlightState.isHovered = true; });
      el.heroSpotlight.addEventListener('mouseleave', () => { spotlightState.isHovered = false; });
    }
  }

  function updateSpotlightDisplay() {
    const gameId = spotlightState.featuredIds[spotlightState.currentIndex];
    const game = state.games.get(gameId);
    if (!game) return;

    if (el.spotlightTitle) el.spotlightTitle.textContent = game.name;
    if (el.spotlightDesc) el.spotlightDesc.textContent = game.description;
    if (el.spotlightIcon) el.spotlightIcon.textContent = game.icon || '🎲';
    if (el.spotlightRating) el.spotlightRating.textContent = `★★★★★ ${game.rating || 4.9}`;

    let playerLabel = '1 vs 1';
    if (game.playerTypes.includes('multi')) playerLabel = '2〜8人';
    else if (game.playerTypes.includes('solo')) playerLabel = 'ソロ / 1vs1';
    if (el.spotlightPlayers) el.spotlightPlayers.textContent = `👥 ${playerLabel}`;

    const meta = GAME_METADATA[gameId];
    if (meta && meta.bannerBg && el.heroSpotlightBg) {
      el.heroSpotlightBg.style.background = meta.bannerBg;
    }

    // ドットのアクティブ更新
    if (el.spotlightDots) {
      const dots = el.spotlightDots.querySelectorAll('.spotlight-dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === spotlightState.currentIndex);
      });
    }

    // スポットライトボタンのイベント割り当て
    if (el.spotlightPlayBtn) {
      el.spotlightPlayBtn.onclick = () => {
        SoundFx.playClick();
        autoJoinGame(gameId, 'lobby');
      };
    }
    if (el.spotlightRuleBtn) {
      el.spotlightRuleBtn.onclick = () => {
        SoundFx.playClick();
        openRuleModal(gameId);
      };
    }
  }

  // ==========================================
  // 7. 詳細ルール解説モーダル
  // ==========================================
  let currentModalGameId = null;

  function openRuleModal(gameId) {
    const game = state.games.get(gameId);
    if (!game) return;
    currentModalGameId = gameId;

    SoundFx.playModalOpen();

    if (el.ruleModalIcon) el.ruleModalIcon.textContent = game.icon || '🎲';
    if (el.ruleModalTitle) el.ruleModalTitle.textContent = game.name;
    if (el.ruleModalCategory) el.ruleModalCategory.textContent = `${game.category} • ⏱️ ${game.playTime}`;

    const rulesData = game.detailedRules || {};
    const rulesListHtml = (rulesData.rules || [])
      .map(r => `<li>${r}</li>`)
      .join('');

    if (el.ruleModalBody) {
      el.ruleModalBody.innerHTML = `
        <div style="margin-bottom:16px;">
          <h4 style="color:#94a3b8;font-size:13px;text-transform:uppercase;margin-bottom:6px;">📖 ゲーム概要</h4>
          <p style="font-size:14px;color:#cbd5e1;line-height:1.6;">${rulesData.overview || game.description || ''}</p>
        </div>

        <div style="margin-bottom:16px;">
          <h4 style="color:#94a3b8;font-size:13px;text-transform:uppercase;margin-bottom:6px;">📋 基本ルール・遊び方</h4>
          <ul class="rule-list-items" style="padding-left:20px;font-size:14px;color:#e2e8f0;line-height:1.7;">
            ${rulesListHtml}
          </ul>
        </div>

        ${rulesData.winCondition ? `
          <div style="background:#f59e0b15;border:1px solid #f59e0b40;border-radius:10px;padding:12px;margin-bottom:16px;">
            <div style="font-weight:700;color:#fbbf24;font-size:13px;margin-bottom:4px;">🏆 勝利条件</div>
            <div style="font-size:13px;color:#fef3c7;">${rulesData.winCondition}</div>
          </div>
        ` : ''}

        ${rulesData.proTip ? `
          <div style="background:#38bdf815;border:1px solid #38bdf840;border-radius:10px;padding:12px;">
            <div style="font-weight:700;color:#38bdf8;font-size:13px;margin-bottom:4px;">💡 勝利へのアドバイス</div>
            <div style="font-size:13px;color:#e0f2fe;">${rulesData.proTip}</div>
          </div>
        ` : ''}
      `;
    }

    if (el.ruleModal) el.ruleModal.classList.remove('hidden');
  }

  function closeRuleModal() {
    if (el.ruleModal) el.ruleModal.classList.add('hidden');
    currentModalGameId = null;
  }

  if (el.closeRuleModalBtn) el.closeRuleModalBtn.addEventListener('click', closeRuleModal);
  if (el.rulePlayNowBtn) {
    el.rulePlayNowBtn.addEventListener('click', () => {
      SoundFx.playClick();
      closeRuleModal();
      if (currentModalGameId) {
        autoJoinGame(currentModalGameId, 'lobby');
      }
    });
  }
  if (el.ruleModal) {
    el.ruleModal.addEventListener('click', (e) => {
      if (e.target === el.ruleModal) closeRuleModal();
    });
  }

  // ==========================================
  // 8. プレイヤープロフィール＆実績モーダル
  // ==========================================
  function openProfileModal() {
    SoundFx.playModalOpen();

    if (el.modalCurrentAvatar) el.modalCurrentAvatar.textContent = ProfileManager.data.avatar;
    if (el.modalUsernameInput) el.modalUsernameInput.value = ProfileManager.data.username;

    if (el.statMatches) el.statMatches.textContent = ProfileManager.data.matches;
    if (el.statWins) el.statWins.textContent = ProfileManager.data.wins;
    
    const winRate = ProfileManager.data.matches > 0 
      ? Math.round((ProfileManager.data.wins / ProfileManager.data.matches) * 100) 
      : 0;
    if (el.statWinrate) el.statWinrate.textContent = `${winRate}%`;

    // アバターピッカー初期化
    if (el.avatarPicker) {
      el.avatarPicker.querySelectorAll('.av-opt').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.av === ProfileManager.data.avatar);
      });
    }

    // 実績リスト描画
    if (el.achievementsList) {
      el.achievementsList.innerHTML = '';
      ACHIEVEMENTS_DEF.forEach(ach => {
        const isUnlocked = ProfileManager.data.achievements.includes(ach.id);
        const item = document.createElement('div');
        item.className = `ach-item ${isUnlocked ? 'unlocked' : ''}`;
        item.innerHTML = `
          <div class="ach-icon">${ach.icon}</div>
          <div class="ach-info">
            <h5>${ach.title}</h5>
            <p>${ach.desc}</p>
          </div>
          <div class="ach-status">${isUnlocked ? 'アンロック済 ✨' : '未解除 🔒'}</div>
        `;
        el.achievementsList.appendChild(item);
      });
    }

    if (el.profileModal) el.profileModal.classList.remove('hidden');
  }

  function closeProfileModal() {
    if (el.profileModal) el.profileModal.classList.add('hidden');
  }

  if (el.profileBtn) el.profileBtn.addEventListener('click', openProfileModal);
  if (el.closeProfileModalBtn) el.closeProfileModalBtn.addEventListener('click', closeProfileModal);
  if (el.profileModal) {
    el.profileModal.addEventListener('click', (e) => {
      if (e.target === el.profileModal) closeProfileModal();
    });
  }

  // アバター選択
  if (el.avatarPicker) {
    el.avatarPicker.querySelectorAll('.av-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        SoundFx.playClick();
        const av = opt.dataset.av;
        ProfileManager.setAvatar(av);
        if (el.modalCurrentAvatar) el.modalCurrentAvatar.textContent = av;
        el.avatarPicker.querySelectorAll('.av-opt').forEach(o => o.classList.toggle('selected', o === opt));
      });
    });
  }

  // 名前変更
  if (el.modalUsernameInput) {
    el.modalUsernameInput.addEventListener('change', (e) => {
      ProfileManager.setUsername(e.target.value);
      state.localName = ProfileManager.data.username;
      updatePlayersBar();
      if (state.isConnected) {
        sendPlatformPacket({ type: 'name_sync', name: state.localName });
      }
    });
  }

  // サウンドトグルボタン
  if (el.sfxToggleBtn) {
    el.sfxToggleBtn.addEventListener('click', () => {
      SoundFx.toggle();
    });
  }

  // ==========================================
  // 9. フィルター・ソート・検索イベント
  // ==========================================
  // プレイスタイル区分タブ
  if (el.playerFilterTabs) {
    el.playerFilterTabs.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        SoundFx.playClick();
        el.playerFilterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filterState.playerType = tab.dataset.player;
        renderCatalog();
      });
    });
  }

  // ジャンルチップス
  if (el.genreChipsScroll) {
    el.genreChipsScroll.querySelectorAll('.genre-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        SoundFx.playClick();
        el.genreChipsScroll.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        filterState.genre = chip.dataset.genre;
        renderCatalog();
      });
    });
  }

  // リアルタイム検索
  if (el.gameSearchInput) {
    el.gameSearchInput.addEventListener('input', (e) => {
      filterState.searchQuery = e.target.value;
      if (el.searchClearBtn) {
        el.searchClearBtn.classList.toggle('hidden', !filterState.searchQuery);
      }
      renderCatalog();
    });
  }

  // 検索クリアボタン
  if (el.searchClearBtn) {
    el.searchClearBtn.addEventListener('click', () => {
      SoundFx.playClick();
      if (el.gameSearchInput) el.gameSearchInput.value = '';
      filterState.searchQuery = '';
      el.searchClearBtn.classList.add('hidden');
      renderCatalog();
    });
  }

  // ソートセレクター
  if (el.sortSelector) {
    el.sortSelector.addEventListener('change', (e) => {
      SoundFx.playClick();
      filterState.sortBy = e.target.value;
      renderCatalog();
    });
  }

  // フィルターリセットボタン
  if (el.resetFilterBtn) {
    el.resetFilterBtn.addEventListener('click', () => {
      SoundFx.playClick();
      filterState.playerType = 'all';
      filterState.genre = 'all';
      filterState.searchQuery = '';
      filterState.sortBy = 'featured';

      if (el.gameSearchInput) el.gameSearchInput.value = '';
      if (el.searchClearBtn) el.searchClearBtn.classList.add('hidden');
      if (el.sortSelector) el.sortSelector.value = 'featured';

      if (el.playerFilterTabs) {
        el.playerFilterTabs.querySelectorAll('.filter-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.player === 'all');
        });
      }
      if (el.genreChipsScroll) {
        el.genreChipsScroll.querySelectorAll('.genre-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.genre === 'all');
        });
      }
      renderCatalog();
    });
  }

  // ==========================================
  // 10. パスワード不要！スマート自動マッチング & WebRTC P2P
  // ==========================================
  let selectedGameId = null;
  let connectTimeout = null;

  function autoJoinGame(gameId, roomCode = 'lobby') {
    selectedGameId = gameId;
    state.roomCode = roomCode;
    state.isConnected = false;
    state.remoteName = '相手を探しています…';

    if (connectTimeout) {
      clearTimeout(connectTimeout);
      connectTimeout = null;
    }

    launchGame(selectedGameId);
    if (el.lobbyModal) el.lobbyModal.classList.add('hidden');

    if (el.matchStatusBadge) {
      el.matchStatusBadge.textContent = '🔍 相手を検索中…';
      el.matchStatusBadge.style.color = '#38bdf8';
    }
    showGlobalToast('部屋に接続中...');

    if (state.peer) {
      state.peer.destroy();
    }

    const targetPeerId = `${PEER_PREFIX}${gameId}-${roomCode}`;
    let isConnectedOrHost = false;

    state.peer = new Peer();

    state.peer.on('open', () => {
      if (el.networkStatus) {
        el.networkStatus.textContent = '🟢 オンライン';
        el.networkStatus.classList.add('online');
      }

      state.conn = state.peer.connect(targetPeerId, { reliable: true });

      state.conn.on('open', () => {
        isConnectedOrHost = true;
        if (connectTimeout) clearTimeout(connectTimeout);

        state.isHost = false;
        state.myPlayerIndex = 2;
        state.isConnected = true;
        setupConnectionEvents();

        sendPlatformPacket({ type: 'name_sync', name: state.localName });
        updatePlayersBar();
        SoundFx.playGameStart();
        showGlobalToast('🎉 対戦相手と合流しました！ゲーム開始！');
        registeredPlayerJoinedListeners.forEach(listener => listener());
      });

      state.conn.on('data', (data) => handleIncomingPacket(data));
      state.conn.on('close', () => {
        state.isConnected = false;
        showGlobalToast('対戦相手の通信が切断されました');
        updatePlayersBar();
      });

      connectTimeout = setTimeout(() => {
        if (!isConnectedOrHost && !state.isConnected) {
          isConnectedOrHost = true;
          becomeHost(gameId, roomCode);
        }
      }, 1200);
    });

    state.peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        if (!isConnectedOrHost && !state.isConnected) {
          isConnectedOrHost = true;
          if (connectTimeout) clearTimeout(connectTimeout);
          becomeHost(gameId, roomCode);
        }
      } else {
        if (el.networkStatus) el.networkStatus.textContent = 'エラー: ' + err.type;
      }
    });
  }

  function becomeHost(gameId, roomCode) {
    state.isHost = true;
    state.myPlayerIndex = 1;
    state.isConnected = false;
    state.remoteName = '友達待機中…';
    const targetPeerId = `${PEER_PREFIX}${gameId}-${roomCode}`;

    if (state.peer) state.peer.destroy();
    state.peer = new Peer(targetPeerId);

    state.peer.on('open', () => {
      if (el.networkStatus) {
        el.networkStatus.textContent = '🟢 オンライン';
        el.networkStatus.classList.add('online');
      }
      updatePlayersBar();
      showGlobalToast('🏠 部屋で待機中！友達が入ってきたら自動で開始します');
    });

    state.peer.on('connection', (connection) => {
      state.conn = connection;
      setupConnectionEvents();
    });

    state.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        setTimeout(() => autoJoinGame(gameId, roomCode), 300);
      }
    });

    updatePlayersBar();
  }

  // ==========================================
  // 11. ロビー & モーダル処理
  // ==========================================
  function openLobbyForGame(gameId) {
    const game = state.games.get(gameId);
    if (!game) return;
    selectedGameId = gameId;

    if (el.lobbyGameTitle) el.lobbyGameTitle.textContent = `${game.icon || ''} ${game.name}`;
    if (el.roomCreatedInfo) el.roomCreatedInfo.classList.add('hidden');
    if (el.createRoomBtn) el.createRoomBtn.disabled = false;
    if (el.lobbyModal) el.lobbyModal.classList.remove('hidden');
  }

  if (el.closeLobbyBtn) {
    el.closeLobbyBtn.addEventListener('click', () => {
      if (el.lobbyModal) el.lobbyModal.classList.add('hidden');
    });
  }

  // 部屋作成
  if (el.createRoomBtn) {
    el.createRoomBtn.addEventListener('click', () => {
      state.isHost = true;
      state.myPlayerIndex = 1;
      state.isConnected = false;
      state.remoteName = '友達待機中…';
      state.roomCode = generateRoomCode();
      const fullPeerId = `${PEER_PREFIX}${selectedGameId}-${state.roomCode}`;

      if (state.peer) state.peer.destroy();
      initPeer(fullPeerId);

      if (el.lobbyModal) el.lobbyModal.classList.add('hidden');
      launchGame(selectedGameId);

      const inviteUrl = getInviteUrl(selectedGameId, state.roomCode);
      navigator.clipboard.writeText(inviteUrl).catch(() => {});

      ProfileManager.unlockAchievement('share_link');
      showGlobalToast(`部屋を作成しました (合言葉: ${state.roomCode})！招待URLをコピーしました`);
    });
  }

  if (el.copyInviteUrlBtn) el.copyInviteUrlBtn.addEventListener('click', () => copyInviteUrl());
  if (el.shareRoomBtn) el.shareRoomBtn.addEventListener('click', () => copyInviteUrl());
  if (el.customRoomBtn) {
    el.customRoomBtn.addEventListener('click', () => {
      openLobbyForGame(selectedGameId);
    });
  }

  function getInviteUrl(gameId, code) {
    const c = code || 'lobby';
    return `${window.location.origin}${window.location.pathname}?game=${gameId}&room=${c}`;
  }

  function copyInviteUrl() {
    if (!state.roomCode) {
      showGlobalToast('部屋が作成されていません');
      return;
    }
    const url = getInviteUrl(selectedGameId, state.roomCode);
    navigator.clipboard.writeText(url).then(() => {
      ProfileManager.unlockAchievement('share_link');
      showGlobalToast('📋 招待URLをコピーしました！友達に送信してください');
    });
  }

  if (el.joinRoomBtn) {
    el.joinRoomBtn.addEventListener('click', () => {
      const code = el.joinCodeInput.value.trim().toUpperCase();
      if (code.length < 4) {
        alert('4桁の合言葉を入力してください');
        return;
      }
      startJoin(selectedGameId, code);
    });
  }

  function startJoin(gameId, code) {
    selectedGameId = gameId;
    state.isHost = false;
    state.myPlayerIndex = 2;
    state.isConnected = false;
    state.roomCode = code;
    state.remoteName = 'ホストに接続中…';
    const targetPeerId = `${PEER_PREFIX}${gameId}-${code}`;

    if (el.lobbyModal) el.lobbyModal.classList.add('hidden');
    launchGame(selectedGameId);
    showGlobalToast(`ホスト (${code}) に接続中...`);

    if (state.peer) {
      state.conn = state.peer.connect(targetPeerId, { reliable: true });
      setupConnectionEvents();
    }
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 4; i++) c += chars.charAt(Math.floor(Math.random() * chars.length));
    return c;
  }

  // ==========================================
  // 12. WebRTC P2P (PeerJS) コア
  // ==========================================
  function initPeer(customId = null) {
    if (el.networkStatus) el.networkStatus.textContent = '接続待機中...';
    state.peer = customId ? new Peer(customId) : new Peer();

    state.peer.on('open', () => {
      if (el.networkStatus) {
        el.networkStatus.textContent = '🟢 オンライン';
        el.networkStatus.classList.add('online');
      }
    });

    state.peer.on('connection', (connection) => {
      state.conn = connection;
      setupConnectionEvents();
    });

    state.peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (el.networkStatus) {
        el.networkStatus.textContent = 'エラー: ' + err.type;
        el.networkStatus.classList.remove('online');
      }
    });
  }

  const registeredGameDataListeners = new Set();
  const registeredPlayerJoinedListeners = new Set();

  function setupConnectionEvents() {
    state.conn.on('open', () => {
      state.isConnected = true;
      if (el.lobbyModal) el.lobbyModal.classList.add('hidden');

      sendPlatformPacket({ type: 'name_sync', name: state.localName });

      updatePlayersBar();
      SoundFx.playGameStart();
      showGlobalToast('🎉 対戦相手が合流しました！ゲーム開始！');

      registeredPlayerJoinedListeners.forEach(listener => listener());
    });

    state.conn.on('data', (data) => {
      handleIncomingPacket(data);
    });

    state.conn.on('close', () => {
      state.isConnected = false;
      alert('対戦相手の通信が切断されました。');
      exitToCatalog();
    });
  }

  function sendPlatformPacket(data) {
    if (state.conn && state.conn.open) {
      state.conn.send(data);
    }
  }

  function handleIncomingPacket(data) {
    if (data._platform) {
      if (data.type === 'name_sync') {
        state.remoteName = data.name;
        updatePlayersBar();
      } else if (data.type === 'emote') {
        showGlobalToast(`${state.remoteName}: ${data.msg}`);
      }
    } else {
      registeredGameDataListeners.forEach((listener) => listener(data));
    }
  }

  // ==========================================
  // 13. ゲーム起動 & マウント
  // ==========================================
  let activeUnmountFn = null;

  function launchGame(gameId) {
    const game = state.games.get(gameId);
    if (!game) return;

    if (activeUnmountFn) {
      try { activeUnmountFn(); } catch (e) {}
      activeUnmountFn = null;
    }
    if (state.activeGame && state.activeGame.unmount) {
      state.activeGame.unmount();
    }
    el.mountPoint.innerHTML = '';
    registeredGameDataListeners.clear();
    registeredPlayerJoinedListeners.clear();

    state.activeGame = game;
    if (el.activeGameTitle) el.activeGameTitle.textContent = `${game.icon || ''} ${game.name}`;

    el.catalogView.classList.remove('active');
    el.gameView.classList.add('active');

    updatePlayersBar();
    ProfileManager.recordMatch(gameId);

    const p2pBridge = {
      isHost: state.isHost,
      myPlayerIndex: state.myPlayerIndex,
      isConnected: () => state.isConnected,
      getRoomCode: () => state.roomCode,
      getLocalName: () => state.localName,
      getRemoteName: () => state.remoteName,
      send(data) {
        if (state.conn && state.conn.open) {
          state.conn.send(data);
        }
      },
      onReceive(callback) {
        registeredGameDataListeners.add(callback);
      },
      onPlayerJoined(callback) {
        registeredPlayerJoinedListeners.add(callback);
      },
      showToast(msg) {
        showGlobalToast(msg);
      },
      recordWin() {
        ProfileManager.recordWin();
      },
      unlockAchievement(id) {
        ProfileManager.unlockAchievement(id);
      }
    };

    if (game.mount) {
      const res = game.mount(el.mountPoint, p2pBridge);
      if (typeof res === 'function') {
        activeUnmountFn = res;
      }
    }
  }

  function updatePlayersBar() {
    if (state.isHost) {
      if (el.p1NameDisplay) el.p1NameDisplay.textContent = `${state.localName} (あなた)`;
      if (el.p2NameDisplay) el.p2NameDisplay.textContent = state.isConnected ? state.remoteName : `⏳ 待機中 (合言葉: ${state.roomCode})`;
      if (el.matchStatusBadge) {
        el.matchStatusBadge.textContent = state.isConnected ? '🟢 対戦中' : '⏳ 友達待機中';
        el.matchStatusBadge.style.color = state.isConnected ? '#4ade80' : '#f59e0b';
      }
    } else {
      if (el.p1NameDisplay) el.p1NameDisplay.textContent = state.remoteName;
      if (el.p2NameDisplay) el.p2NameDisplay.textContent = `${state.localName} (あなた)`;
      if (el.matchStatusBadge) {
        el.matchStatusBadge.textContent = state.isConnected ? '🟢 対戦中' : '⏳ 接続中…';
        el.matchStatusBadge.style.color = state.isConnected ? '#4ade80' : '#38bdf8';
      }
    }
  }

  if (el.backBtn) {
    el.backBtn.addEventListener('click', () => {
      if (confirm('ゲーム一覧に戻りますか？現在の部屋は閉じられます。')) {
        if (state.conn) state.conn.close();
        exitToCatalog();
      }
    });
  }

  if (el.logoBtn) {
    el.logoBtn.addEventListener('click', () => {
      if (el.gameView.classList.contains('active')) {
        el.backBtn.click();
      }
    });
  }

  function exitToCatalog() {
    if (connectTimeout) {
      clearTimeout(connectTimeout);
      connectTimeout = null;
    }
    if (state.peer) {
      state.peer.destroy();
      state.peer = null;
    }
    initPeer();
    if (activeUnmountFn) {
      try { activeUnmountFn(); } catch (e) {}
      activeUnmountFn = null;
    }
    if (activeUnmountFn) {
      try { activeUnmountFn(); } catch (e) {}
      activeUnmountFn = null;
    }
    if (state.activeGame && state.activeGame.unmount) {
      state.activeGame.unmount();
    }
    state.activeGame = null;
    state.isConnected = false;
    state.roomCode = '';
    el.mountPoint.innerHTML = '';

    el.gameView.classList.remove('active');
    el.catalogView.classList.add('active');
    window.history.replaceState({}, '', window.location.pathname);
  }

  // エモート
  document.querySelectorAll('.emote-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg;
      SoundFx.playClick();
      showGlobalToast(`あなた: ${msg}`);
      sendPlatformPacket({ _platform: true, type: 'emote', msg: msg });
    });
  });

  function showGlobalToast(text) {
    if (!el.chatToast) return;
    el.chatToast.textContent = text;
    el.chatToast.classList.remove('hidden');
    setTimeout(() => {
      if (el.chatToast) el.chatToast.classList.add('hidden');
    }, 2800);
  }

  // URLパラメータ（?game=xxx&room=yyy）の自動参加チェック
  let urlRouteChecked = false;
  function checkInitialUrlRoute() {
    if (urlRouteChecked) return;
    const params = new URLSearchParams(window.location.search);
    const targetGame = params.get('game');
    const targetRoom = params.get('room') || 'lobby';

    if (targetGame && state.games.has(targetGame)) {
      urlRouteChecked = true;
      autoJoinGame(targetGame, targetRoom);
    }
  }

  // ==========================================
  // 14. 初期化起動
  // ==========================================
  ProfileManager.updateHeaderDisplay();
  initPeer();
})();
