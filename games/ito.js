/**
 * 🧶 ito (イト) - 完全2D価値観コミュニケーション＆数字昇順協力ボードゲーム
 * Board Arena Plugin (Pure Crisp 2D Edition - クモノイト＆アカイイト両モード搭載)
 *
 * 🌟 特徴:
 * 1. 【アークライトゲームズ『ito (イト)』公式2大モード完全実装 (2〜8人対応)】
 *    - 🕸️ モード1「クモノイト（協力モード・全3ステージ・ライフ3）」：
 *      1〜100のナンバーカードが配られ、数字を直接言わずに「お題に沿った言葉」だけで表現！
 *      全員の言葉のニュアンスから、数字が【小さい順（昇順）】になるように場へ1枚ずつ出していく！
 *      もし出したカードより小さい数字が誰かの手札に残っていたら、その枚数分だけ❤️ライフが減少！
 *    - ❤️ モード2「アカイイト（ペア100ニアピンモード）」：
 *      全員の宣言を聞いて、自分の数字と足して「100に最も近く、かつ100を超えない(101以上はバースト)」運命のパートナーを指名！
 * 2. 【厳選20テーマ×100段階の超リアル価値観データベース ＆ 個性派AI】
 *    - AIが自分の秘密の数字（＋人間らしい微妙な感覚のズレ！）に合わせて絶妙なたとえ言葉と理由コメントを発言！
 *    - プレイヤーはワンクリック候補選択または自由テキスト入力でたとえ言葉を宣言し、全員の宣言カードを小さい順に選んでオープン！
 */

(function () {
  // 厳選テーマ＆1〜100の段階別ワード辞書（各アイテム: [基準値(1..100), ワード, ニュアンス補足]）
  const ITO_THEMES = [
    {
      id: 'animals',
      title: '🦁 生き物の強さ（1:最弱 〜 100:最強）',
      minLabel: '1: すぐ潰れる虫',
      maxLabel: '100: 地上最強の猛獣',
      items: [
        [2, 'ミジンコ', '指先どころか水流で流されるレベル'],
        [5, 'アリ', '踏まれたら終わりだけど集団ならちょっと働く'],
        [9, 'ダンゴムシ', '丸まって防御できるだけマシ'],
        [14, 'ハムスター', '噛まれると地味にチクッとする'],
        [19, 'カブトムシ', '虫の中では王様クラス'],
        [24, 'スズメバチ', '毒針があるから人間もビビる'],
        [30, '飼い猫', '引っ掻き攻撃のスピードが速い'],
        [36, '柴犬', '本気で噛みつかれたら病院行き'],
        [42, 'ニホンザル', '知能と俊敏性があって手強い'],
        [48, 'イノシシ', '突進されたら大人でも吹き飛ぶ'],
        [54, 'カンガルー', 'ムキムキの胸筋でボクシングしてくる'],
        [60, 'オオカミ', '群れの狩猟本能と牙が鋭い'],
        [66, 'チーター', '時速100kmのスピードスター'],
        [72, 'ゴリラ', '握力500kgのジャングルの重戦車'],
        [78, 'ライオン', '百獣の王、サバンナの支配者'],
        [84, 'ホホジロザメ', '海の中で出会ったら絶望'],
        [89, 'ヒグマ（グリズリー）', '銃でも止まらない最強クラスの陸上獣'],
        [94, 'カバ', '実はライオンもワニも蹴散らす隠れ最強生物'],
        [98, 'アフリカゾウ', '体重6トン、誰も勝てない絶対王者'],
        [100, 'ティラノサウルス / シロナガスクジラ', '地球史上最大・最強の規格外モンスター']
      ]
    },
    {
      id: 'food_luxury',
      title: '🍣 食べ物の贅沢さ・ごちそう感（1:超質素 〜 100:人生最高峰）',
      minLabel: '1: 水・白米のみ',
      maxLabel: '100: 最高級フルコース',
      items: [
        [2, '水道水', '0円の究極のミニマム'],
        [6, '白ごはん（具なし）', '塩すら振っていない状態'],
        [11, 'もやし炒め', '給料日前の最強節約メシ'],
        [16, 'うまい棒 1本', '10円玉で買える小さな幸せ'],
        [22, '卵かけご飯（TKG）', 'シンプルだけど醤油と卵で満足'],
        [28, 'カップヌードル', '夜中に食べると妙に美味い'],
        [34, '牛丼（並盛）', 'ワンコインで大満足の庶民の味方'],
        [40, 'マクドナルドのLセット', 'ポテトLとコーラでちょっと豪遊気分'],
        [46, 'ラーメン屋の全部乗せ特製ラーメン', '1200円の壁を超える小さな贅沢'],
        [52, '宅配ピザ（Lサイズ）', 'パーティー感が出てテンション上がる'],
        [58, '回転寿司でお皿を気にせず食べる', '金皿・銀皿にも手を出す週末のご褒美'],
        [64, 'うな重（特上）', 'フタを開けた瞬間の香ばしさが別格'],
        [70, '焼肉食べ放題（プレミアムコース）', '厚切り牛タンもカルビも頼み放題'],
        [76, 'ホテルのディナービュッフェ', 'ローストビーフ切り分けとケーキ山盛り'],
        [82, '回らないカウンター寿司', '大将が目の前で握ってくれる緊張と至福'],
        [88, 'A5ランク松阪牛のシャトーブリアン', '口の中で溶けてなくなる極上霜降り'],
        [94, '銀座の三つ星フレンチフルコース', 'ドレスコード必須の非日常ディナー'],
        [99, '貸切クルーザーでキャビア＆ドンペリ＆大間の本マグロ', '富豪しか味わえない究極の晩餐']
      ]
    },
    {
      id: 'famous_person',
      title: '🌍 有名人・歴史人物・キャラの知名度（1:誰も知らない 〜 100:人類全員知ってる）',
      minLabel: '1: 近所の一般人',
      maxLabel: '100: 世界中の誰もが知る存在',
      items: [
        [3, '3年前のクラスの出席番号12番の人', '当事者すら顔を忘れかけているレベル'],
        [8, '地元の商店街の福引き係のおじさん', '半径500m以内でしか知られていない'],
        [14, 'マイナーなボードゲームの説明書翻訳者', 'かなりのマニアしか名前を見ない'],
        [20, '深夜アニメのモブキャラの声優', 'エンドロールを凝視する人だけ知っている'],
        [27, '都道府県魅力度ランキング42位の県のマスコット', '地元の人ならギリギリ分かるかも'],
        [34, '日本史の教科書の隅に太字じゃない名前で出てくる室町時代の武将', 'テスト前に一瞬だけ暗記した記憶'],
        [42, 'M-1グランプリ準決勝常連のお笑いコンビ', 'お笑い好きなら全員知ってる実力派'],
        [50, '紅白歌合戦に初出場したバンド', '若い世代ならみんな曲を聴いたことがある'],
        [58, '聖徳太子', '日本の小学生なら100%習うレジェンド'],
        [66, '織田信長', '日本人なら老若男女知らない人はいない'],
        [74, 'ドラえもん', 'アジア中どこへ行っても愛される青タヌキ'],
        [81, '大谷翔平', '日米のニュースで毎日顔を見るスーパースター'],
        [88, 'アインシュタイン / レオナルド・ダ・ヴィンチ', '世界史の教科書に必ず載っている天才'],
        [94, 'ピカチュウ / マリオ', '言語を問わず地球上の子供から大人まで通じる'],
        [99, 'ミッキーマウス / サンタクロース', '人類の文化に刻まれた知名度100%の象徴']
      ]
    },
    {
      id: 'pinch_level',
      title: '😱 日常〜絶체絶命のピンチ度（1:どうでもいい 〜 100:人生終了レベル）',
      minLabel: '1: ほぼノーダメージ',
      maxLabel: '100: 地球滅亡・絶体絶命',
      items: [
        [2, 'くしゃみが出そうで出ない', '3秒間だけちょっとモヤモヤするだけ'],
        [7, '割り箸がちょっと斜めに割れた', '使えるから全然問題なし'],
        [13, '自販機の下に10円玉が転がり落ちた', '諦めがつく軽傷'],
        [19, '靴下に小さな穴が空いていたのに気づいた', '座敷に上がらなければセーフ'],
        [26, '傘を持ってない日に小雨が降ってきた', '走ればなんとかなるレベル'],
        [33, 'スマホの充電が外出先で残り12%', 'モバイルバッテリーを探して焦り始める'],
        [41, '美容院で「思ってた髪型と違う」仕上がりになった', '鏡を見るたび1ヶ月間ちょっと凹む'],
        [49, '大事なテストや会議の朝に寝坊して30分前に起きた', '顔面蒼白で全力ダッシュ'],
        [57, '満員電車でお腹がギュルギュル鳴り出した（次の駅まで5分）', '冷や汗が止まらない極限の精神戦'],
        [65, 'トイレの個室で紙が1ミリも残っていないことに気づいた', 'スマホで助けを呼ぶしかない袋小路'],
        [73, '海外旅行中にパスポートと財布が入ったカバンを紛失', '大使館へ駆け込む大事件'],
        [81, 'バンジージャンプで飛んだ瞬間に「あ、紐がほつれてる」と聞こえた', '走馬灯が回り始める瞬間'],
        [89, '無人島に1人で漂流して飲み水も食料もゼロ', 'サバイバル映画の主人公状態'],
        [96, 'パラシュートが開かないまま高度3000mから落下中', '99.9%助からない絶体絶命'],
        [100, '直径100kmの巨大隕石が3分後に地球へ衝突する', '全人類が同時に終わる究極のピンチ']
      ]
    },
    {
      id: 'superpower',
      title: '⚡ 欲しい特殊能力・超能力の強さ（1:ほぼ無意味 〜 100:神の領域）',
      minLabel: '1: 一発芸レベル',
      maxLabel: '100: 全知全能・時空支配',
      items: [
        [3, '1日に1回だけ耳をちょっと動かせる能力', '飲み会ですらウケない'],
        [9, 'じゃんけんで「あいこ」を出す確率が5%上がる能力', '勝てるわけじゃないのがポイント'],
        [16, 'カップ麺の3分間を時計なしでピッタリ当てられる能力', '地味に便利だけどキッチン限定'],
        [24, '蚊に絶対に刺されなくなる能力', '夏場だけは神スキル'],
        [32, 'どんなに食べても絶対に太らない能力', '全ダイエッターが羨む体質'],
        [40, '1日2時間睡眠でも100%元気でいられる能力', '人生の自由時間が1.3倍に増える'],
        [48, '世界中のあらゆる言語をペラペラ話せる能力', 'どこへ行っても通訳なしで無双'],
        [56, '触れた家電やスマホを瞬時にフル充電できる能力', '災害時にも日常にも超便利'],
        [64, '透明人間になれる能力', 'スパイ映画のようにどこへでも潜入可能'],
        [72, '空をマッハ2で自由に飛べる能力', '通勤も海外旅行も一瞬'],
        [80, '人の心（本音）が字幕で見える能力', 'ポーカーも交渉も百戦百勝'],
        [87, '行ったことがある場所へ0秒で瞬間移動（テレポーテーション）', '距離の概念が消滅する'],
        [94, '時間を自由に止めたり巻き戻したりできる能力', 'あらゆる失敗をやり直せる最強チート'],
        [99, '思ったことがすべて現実になる全知全能の創造力', '宇宙の法則すら書き換える神の力']
      ]
    },
    {
      id: 'happy_words',
      title: '💖 言われて嬉しい言葉・出来事（1:微妙 〜 100:一生の宝物）',
      minLabel: '1: 社交辞令レベル',
      maxLabel: '100: 感涙レベルの最高の言葉',
      items: [
        [4, '「あ、今日も息してるね」', '当たり前すぎて反応に困る'],
        [10, '「なんか今日、服着てるね」', '褒めてるのかすら謎'],
        [18, '「字が意外と読めるね」', 'ハードルが低すぎる褒め言葉'],
        [26, '「今日の髪型、いつもよりまとまってるね」', 'ちょっとした変化に気づいてもらえると嬉しい'],
        [34, '「〇〇さんが選ぶお店、いつもハズレがないよね！」', 'センスを褒められて誇らしい'],
        [43, '「一緒にいると落ち着くし、なんか元気出るわ」', '人間性を肯定されてじんわり嬉しい'],
        [52, '「この仕事、〇〇さんがいなかったら絶対回らなかったよ！」', '努力が報われる最高のねぎらい'],
        [61, '「実はずっと前から憧れてました！」', '後輩や仲間から言われたら舞い上がる'],
        [70, '「あなたに出会えて、私の人生が本当に変わりました」', '胸が熱くなる感謝の言葉'],
        [80, '「生まれ変わっても、またあなたと友達（家族・パートナー）になりたい」', 'これ以上ない最大の信頼'],
        [90, '「宝くじ10億円が当選しました！＋好きな人から両思い告白」', '幸福度がカンストする奇跡の1日'],
        [99, '「あなたがこの世界に生まれてきてくれて、本当にありがとう」', '魂が震える究極の肯定']
      ]
    }
  ];

  const PLAYER_THEMES = [
    { name: 'あなた (P1)', color: '#38bdf8', avatar: '🧑‍🚀', bias: 0 },
    { name: 'ハルカ (CPU 2)', color: '#f43f5e', avatar: '👩', bias: -3 },
    { name: 'ケンジ (CPU 3)', color: '#10b981', avatar: '🧔', bias: 4 },
    { name: 'ミサキ (CPU 4)', color: '#f59e0b', avatar: '👧', bias: -2 },
    { name: 'タツヤ (CPU 5)', color: '#a855f7', avatar: '🕶️', bias: 5 },
    { name: 'ユイ (CPU 6)', color: '#ec4899', avatar: '🎀', bias: -4 }
  ];

  // Web Audio サウンド
  const ItoSfx = {
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
    clue() {
      this.play(587.33, 0.09, 'triangle', 0.11);
      setTimeout(() => this.play(880, 0.11, 'triangle', 0.1), 50);
    },
    safeOpen() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.play(f, 0.14, 'triangle', 0.14), i * 55));
    },
    damage() {
      [240, 180, 130].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'sawtooth', 0.16), i * 75));
    },
    stageClear() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'triangle', 0.16), i * 75));
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

  // お題と秘密の数値(1..100)から最も近い表現ワードを選択（AI用に人間らしい微ズレを加味）
  function pickClueForNumber(theme, secretNum, bias = 0, usedWords = new Set()) {
    const perceived = Math.max(1, Math.min(100, secretNum + bias + Math.floor((Math.random() - 0.5) * 6)));
    const sorted = theme.items
      .slice()
      .sort((a, b) => Math.abs(a[0] - perceived) - Math.abs(b[0] - perceived));
    const chosen = sorted.find((item) => !usedWords.has(item[1])) || sorted[0];
    usedWords.add(chosen[1]);
    return {
      word: chosen[1],
      nuance: chosen[2],
      refVal: chosen[0]
    };
  }

  window.BoardArena.registerGame({
    id: 'ito',
    name: 'ito (イト 2D)',
    icon: '🧶',
    category: '💬 価値観共有パーティ (2D完全版)',
    minPlayers: 2,
    maxPlayers: 6,
    description: '1〜100の秘密の数字を「お題に沿ったたとえ言葉」だけで表現し、全員のカードを小さい順に出していく大人気協力パーティゲーム！クモノイト＆アカイイト両モード収録！',

    mount(container, bridge) {
      let isDestroyed = false;

      let gameMode = 'kumonoito'; // 'kumonoito' (協力昇順モード) | 'akaiito' (ペア100ニアピンモード)
      let playerCount = 4;
      let stageNum = 1;
      let lives = 3;
      let themeIdx = 0;

      // cardsPool: Array of { id, ownerIdx, ownerName, ownerColor, avatar, number, clueWord, clueNuance, status: 'unrevealed'|'played_ok'|'discarded_fail', declared: boolean }
      let allDealtCards = [];
      let playedTimeline = []; // 場に出された順番のカード配列
      // phase: 'DECLARE' | 'ORDERING' | 'STAGE_CLEAR' | 'GAME_OVER' | 'AKAIITO_PICK' | 'AKAIITO_RESULT'
      let phase = 'DECLARE';
      let selectedPartnerCardId = null;
      let bannerMsg = '🧶 お題に合わせて、あなたの数字（1〜100）を「言葉」で宣言してください！';

      container.innerHTML = `
        <style>
          .ito-wrapper {
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            user-select: none;
            color: #f8fafc;
            font-family: 'Noto Sans JP', sans-serif;
          }
          .ito-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(244, 63, 94, 0.42);
            border-radius: 12px;
            padding: 8px 14px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          }
          .ito-status-pills {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
          }
          .ito-pill {
            background: rgba(30, 41, 59, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.35);
            padding: 5px 12px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 900;
          }
          .ito-btn {
            background: rgba(30, 41, 59, 0.94);
            border: 1px solid rgba(148, 163, 184, 0.42);
            color: #f8fafc;
            font-size: 12px;
            font-weight: 800;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .ito-btn:hover:not(:disabled) {
            border-color: #fb7185;
            color: #ffe4e6;
            transform: translateY(-1px);
          }
          .ito-btn-primary {
            background: linear-gradient(135deg, #e11d48, #be123c);
            border-color: #fda4af;
            color: #ffffff;
          }
          .ito-btn-emerald {
            background: linear-gradient(135deg, #10b981, #059669);
            border-color: #6ee7b7;
            color: #ffffff;
          }
          .ito-btn-gold {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-color: #fef08a;
            color: #0f172a;
          }
          /* テーマお題ボード */
          .ito-theme-card {
            background: linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%);
            border: 2px solid #f43f5e;
            border-radius: 16px;
            padding: 14px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
          }
          .ito-scale-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(0, 0, 0, 0.35);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 800;
            border: 1px solid rgba(255, 255, 255, 0.15);
          }
          /* メイン2Dフィールド */
          .ito-main-board {
            background: radial-gradient(circle at 50% 35%, #1e293b 0%, #0f172a 75%, #020617 100%);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 16px;
            padding: 16px;
            min-height: 430px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: inset 0 0 36px rgba(0, 0, 0, 0.7);
          }
          /* 場に出された昇順タイムライン */
          .ito-timeline-zone {
            background: rgba(15, 23, 42, 0.78);
            border: 2px dashed rgba(56, 189, 248, 0.4);
            border-radius: 14px;
            padding: 12px 16px;
            min-height: 135px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .ito-timeline-list {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }
          .ito-played-card {
            width: 132px;
            background: linear-gradient(145deg, #0f172a, #1e293b);
            border: 3px solid #10b981;
            border-radius: 12px;
            padding: 8px 10px;
            text-align: center;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55);
            position: relative;
          }
          .ito-played-card.failed {
            border-color: #ef4444;
            background: linear-gradient(145deg, #450a0a, #1e293b);
          }
          .ito-card-num-big {
            font-size: 32px;
            font-weight: 900;
            color: #fef08a;
            line-height: 1.1;
          }
          /* 全員の未公開手札（言葉の宣言カード一覧） */
          .ito-declarations-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
            gap: 12px;
          }
          .ito-decl-card {
            background: linear-gradient(145deg, #1e293b, #0f172a);
            border: 2px solid rgba(148, 163, 184, 0.38);
            border-radius: 14px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 8px;
            transition: all 0.18s;
            box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
          }
          .ito-decl-card.clickable:hover {
            transform: translateY(-4px);
            border-color: #38bdf8;
            box-shadow: 0 12px 28px rgba(56, 189, 248, 0.35);
          }
          .ito-decl-word {
            font-size: 17px;
            font-weight: 900;
            color: #fef08a;
            background: rgba(0, 0, 0, 0.35);
            padding: 8px 10px;
            border-radius: 10px;
            border-left: 4px solid #f43f5e;
          }
          /* 自分の宣言入力パネル */
          .ito-declare-box {
            background: rgba(30, 41, 59, 0.95);
            border: 2px solid #38bdf8;
            border-radius: 14px;
            padding: 14px 18px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .ito-input {
            background: #0f172a;
            border: 1px solid #64748b;
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 800;
            flex: 1;
            min-width: 220px;
          }
        </style>

        <div class="ito-wrapper">
          <div class="ito-top-bar">
            <div class="ito-status-pills" id="ito-status-pills"></div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <select id="ito-mode-sel" class="ito-btn">
                <option value="kumonoito" selected>🕸️ クモノイト (全員協力・昇順モード)</option>
                <option value="akaiito">❤️ アカイイト (ペア合計100モード)</option>
              </select>
              <select id="ito-pcount-sel" class="ito-btn">
                <option value="3">👥 3人プレイ</option>
                <option value="4" selected>👥 4人プレイ (標準)</option>
                <option value="5">👥 5人プレイ</option>
                <option value="6">👥 6人プレイ</option>
              </select>
              <button class="ito-btn" id="ito-change-theme-btn">🎲 お題変更</button>
              <button class="ito-btn" id="ito-new-btn">🔄 最初から</button>
            </div>
          </div>

          <div class="ito-theme-card" id="ito-theme-card"></div>

          <div class="ito-main-board" id="ito-main-board"></div>
        </div>
      `;

      const statusPillsEl = container.querySelector('#ito-status-pills');
      const modeSelEl = container.querySelector('#ito-mode-sel');
      const pcountSelEl = container.querySelector('#ito-pcount-sel');
      const changeThemeBtn = container.querySelector('#ito-change-theme-btn');
      const newBtnEl = container.querySelector('#ito-new-btn');
      const themeCardEl = container.querySelector('#ito-theme-card');
      const mainBoardEl = container.querySelector('#ito-main-board');

      // ====================================================
      // 1. ゲーム・ステージ初期化
      // ====================================================
      function initGame() {
        gameMode = modeSelEl.value || 'kumonoito';
        playerCount = parseInt(pcountSelEl.value, 10) || 4;
        stageNum = 1;
        lives = 3;
        themeIdx = Math.floor(Math.random() * ITO_THEMES.length);
        startStage(1);
      }

      function startStage(stNum) {
        stageNum = stNum;
        playedTimeline = [];
        selectedPartnerCardId = null;

        // 1〜100の山札をシャッフル
        const deck100 = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
        const theme = ITO_THEMES[themeIdx];
        const usedWords = new Set();

        allDealtCards = [];
        let cardCounter = 1;

        // クモノイトではステージ1: 各1枚、ステージ2: P1は2枚・他1〜2枚、ステージ3: 全員2枚（アカイイトは全員1枚）
        for (let pIdx = 0; pIdx < playerCount; pIdx++) {
          const pTheme = PLAYER_THEMES[pIdx];
          const cardsForThisPlayer = gameMode === 'akaiito'
            ? 1
            : (stNum === 1 ? 1 : (stNum === 2 ? (pIdx < 2 ? 2 : 1) : 2));

          for (let c = 0; c < cardsForThisPlayer; c++) {
            const num = deck100.pop();
            const isHuman = pIdx === 0;
            const autoClue = pickClueForNumber(theme, num, pTheme.bias, usedWords);

            allDealtCards.push({
              id: 'ito_c_' + (cardCounter++),
              ownerIdx: pIdx,
              cardIndexInHand: c + 1,
              ownerName: pTheme.name,
              ownerColor: pTheme.color,
              avatar: pTheme.avatar,
              isHuman,
              number: num,
              clueWord: isHuman ? '' : autoClue.word,
              clueNuance: isHuman ? 'あなたの秘密の数字' : autoClue.nuance,
              suggestedWord: autoClue.word,
              declared: !isHuman,
              status: 'unrevealed' // 'unrevealed' | 'played_ok' | 'discarded_fail'
            });
          }
        }

        phase = 'DECLARE';
        bannerMsg = '🗣️ あなたの秘密の数字（1〜100）を、お題に沿った「たとえ言葉」で宣言してください！';
        renderAll();
      }

      // ====================================================
      // 2. クモノイト：カードを1枚場に出す（昇順チェック＆ライフ判定）
      // ====================================================
      function playCardToTimeline(cardId) {
        if (phase !== 'ORDERING') return;
        const target = allDealtCards.find((c) => c.id === cardId && c.status === 'unrevealed');
        if (!target) return;

        // まだ未公開の他カードの中に、この target.number より小さい数字が残っていないかチェック！
        const smallerMissedCards = allDealtCards
          .filter((c) => c.status === 'unrevealed' && c.id !== target.id && c.number < target.number)
          .sort((a, b) => a.number - b.number);

        if (smallerMissedCards.length === 0) {
          // 大成功！現在残っている中で最小のカードだった！
          target.status = 'played_ok';
          playedTimeline.push({ ...target, result: 'ok' });
          ItoSfx.safeOpen();
          bannerMsg = `⭕ ナイス判断！ ${target.ownerName} の【「${target.clueWord}」＝ ${target.number}】は最小でした！`;
        } else {
          // ミス！より小さい数字が他に残っていたため、それらがすべて失敗公開されライフ減少！
          ItoSfx.damage();
          const missedDesc = smallerMissedCards.map((mc) => {
            mc.status = 'discarded_fail';
            playedTimeline.push({ ...mc, result: 'fail' });
            lives = Math.max(0, lives - 1);
            return `${mc.ownerName}の【${mc.number} (${mc.clueWord})】`;
          }).join('・');

          target.status = 'played_ok';
          playedTimeline.push({ ...target, result: 'ok' });
          bannerMsg = `💥 あっと！出した【${target.number}】より小さい ${missedDesc} が残っていました！（❤️ライフ -${smallerMissedCards.length}）`;
        }

        // ゲームオーバー判定
        if (lives <= 0) {
          phase = 'GAME_OVER';
          // 残りのカードも全て公開
          allDealtCards.forEach((c) => {
            if (c.status === 'unrevealed') {
              c.status = 'discarded_fail';
              playedTimeline.push({ ...c, result: 'fail' });
            }
          });
          bannerMsg = '💀 ライフが 0 になりました… クモノイト脱出失敗！';
          renderAll();
          return;
        }

        // 残り未公開カードが1枚以下ならステージクリア！
        const remaining = allDealtCards.filter((c) => c.status === 'unrevealed');
        if (remaining.length === 0) {
          phase = 'STAGE_CLEAR';
          ItoSfx.stageClear();
          bannerMsg = stageNum >= 3
            ? '🏆 全3ステージ完全制覇！！価値観シンクロ率100%でクモノイト完全クリア！！'
            : `🎉 ステージ ${stageNum} クリア！全員の価値観が見事に噛み合いました！`;
        }

        renderAll();
      }

      // ====================================================
      // 3. UIレンダリング
      // ====================================================
      function renderAll() {
        const theme = ITO_THEMES[themeIdx];

        // 1. 上部ステータスバー
        if (gameMode === 'kumonoito') {
          const hearts = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
          statusPillsEl.innerHTML = `
            <span class="ito-pill" style="border-color:#f43f5e;color:#fda4af;">🕸️ クモノイト：ステージ ${stageNum} / 3</span>
            <span class="ito-pill" style="border-color:#fbbf24;color:#fef08a;">ライフ：${hearts} (${lives}/3)</span>
            <span class="ito-pill" style="color:#38bdf8;">${bannerMsg}</span>
          `;
        } else {
          statusPillsEl.innerHTML = `
            <span class="ito-pill" style="border-color:#f43f5e;color:#fda4af;">❤️ アカイイト（2枚の合計を100に近づけろ！101以上はドボン！）</span>
            <span class="ito-pill" style="color:#38bdf8;">${bannerMsg}</span>
          `;
        }

        // 2. お題カード表示
        themeCardEl.innerHTML = `
          <div>
            <div style="font-size:11px;font-weight:900;color:#fda4af;letter-spacing:0.06em;">🎯 CURRENT THEME（今回のお題）</div>
            <div style="font-size:20px;font-weight:900;color:#ffffff;margin-top:2px;">${theme.title}</div>
          </div>
          <div class="ito-scale-bar">
            <span style="color:#7dd3fc;">📉 ${theme.minLabel}</span>
            <span style="color:#94a3b8;">◀━━━━━ 1 〜 100 ━━━━━▶</span>
            <span style="color:#fda4af;">📈 ${theme.maxLabel}</span>
          </div>
        `;

        // 3. フェーズ別メインボード描画
        const myUndeclared = allDealtCards.filter((c) => c.isHuman && !c.declared);

        if (phase === 'DECLARE' && myUndeclared.length > 0) {
          const currMyCard = myUndeclared[0];
          // 自分の数字に近いおすすめワード3つを候補ボタンとして提示
          const nearCandidates = theme.items
            .slice()
            .sort((a, b) => Math.abs(a[0] - currMyCard.number) - Math.abs(b[0] - currMyCard.number))
            .slice(0, 4);

          const candBtns = nearCandidates.map((item) => `
            <button class="ito-btn" data-cand="${item[1]}" style="background:#1e293b;border-color:#38bdf8;">
              💡 「${item[1]}」で宣言する
            </button>
          `).join('');

          const cpuPreviewHtml = allDealtCards
            .filter((c) => !c.isHuman)
            .map((c) => `
              <div class="ito-decl-card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-weight:900;color:${c.ownerColor};">${c.avatar} ${c.ownerName}</span>
                  <span style="font-size:11px;background:#334155;padding:2px 8px;border-radius:999px;">数字: ❓秘密</span>
                </div>
                <div class="ito-decl-word">💬「${c.clueWord}」</div>
                <div style="font-size:11px;color:#94a3b8;">${c.clueNuance}</div>
              </div>
            `).join('');

          mainBoardEl.innerHTML = `
            <div class="ito-declare-box">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <div>
                  <span style="font-size:13px;font-weight:900;color:#7dd3fc;">🤫 あなたの秘密のナンバーカード (${currMyCard.cardIndexInHand}枚目):</span>
                  <span style="font-size:30px;font-weight:900;color:#fef08a;margin-left:10px;background:#0f172a;padding:2px 14px;border-radius:10px;border:2px solid #f59e0b;">
                    ${currMyCard.number}
                  </span>
                </div>
                <span style="font-size:12px;color:#cbd5e1;">※数字を直接言わずに、お題「${theme.title}」で <b>${currMyCard.number}</b> くらいに感じるものを表現しましょう！</span>
              </div>

              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <input type="text" id="ito-custom-input" class="ito-input" value="${currMyCard.suggestedWord}" placeholder="あなたの数字を表す言葉を入力..." />
                <button class="ito-btn ito-btn-primary" id="ito-submit-clue" style="font-size:14px;padding:8px 20px;">
                  🗣️ この言葉で宣言する！
                </button>
              </div>

              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                <span style="font-size:11px;color:#94a3b8;">ワンクリック候補:</span>
                ${candBtns}
              </div>
            </div>

            <div>
              <div style="font-size:13px;font-weight:900;color:#cbd5e1;margin-bottom:8px;">👥 仲間たちの宣言（この言葉との大小関係を比べよう！）：</div>
              <div class="ito-declarations-grid">${cpuPreviewHtml}</div>
            </div>
          `;

          const inputEl = mainBoardEl.querySelector('#ito-custom-input');
          mainBoardEl.querySelectorAll('[data-cand]').forEach((b) => {
            b.onclick = () => {
              inputEl.value = b.getAttribute('data-cand');
            };
          });
          mainBoardEl.querySelector('#ito-submit-clue').onclick = () => {
            const val = (inputEl.value || '').trim() || currMyCard.suggestedWord;
            currMyCard.clueWord = val;
            currMyCard.declared = true;
            ItoSfx.clue();

            if (allDealtCards.every((c) => c.declared)) {
              if (gameMode === 'kumonoito') {
                phase = 'ORDERING';
                bannerMsg = '👆 全員の宣言が出揃いました！数字が【一番小さい】と思うカードから順番にクリックして場に出してください！';
              } else {
                phase = 'AKAIITO_PICK';
                bannerMsg = '❤️ あなたの数字と足して「100」に一番近くなる（100以下）と思うパートナーのカードをクリックして指名してください！';
              }
            }
            renderAll();
          };
          return;
        }

        // アカイイトモード（ペア指名＆結果発表）
        if (gameMode === 'akaiito') {
          const myCard = allDealtCards.find((c) => c.isHuman);
          const others = allDealtCards.filter((c) => !c.isHuman);

          if (phase === 'AKAIITO_PICK') {
            const cardsHtml = others.map((c) => `
              <div class="ito-decl-card clickable" data-pick-partner="${c.id}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-weight:900;color:${c.ownerColor};">${c.avatar} ${c.ownerName}</span>
                  <span style="font-size:11px;background:#334155;padding:2px 8px;border-radius:999px;">数字: ❓秘密</span>
                </div>
                <div class="ito-decl-word">💬「${c.clueWord}」</div>
                <div style="font-size:11px;color:#94a3b8;">${c.clueNuance}</div>
                <button class="ito-btn ito-btn-primary" style="margin-top:4px;">❤️ この人と赤い糸を結ぶ（合計100狙い）</button>
              </div>
            `).join('');

            mainBoardEl.innerHTML = `
              <div style="background:rgba(244,63,94,0.14);border:1px solid #f43f5e;padding:12px 16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <span>あなたのカード：<b>${myCard.number}</b>（宣言：「${myCard.clueWord}」）</span>
                <span style="color:#fef08a;font-weight:900;">🎯 目標：${100 - myCard.number} 以下の最大値を持っていそうな相手を指名！</span>
              </div>
              <div class="ito-declarations-grid">${cardsHtml}</div>
            `;

            mainBoardEl.querySelectorAll('[data-pick-partner]').forEach((el) => {
              el.onclick = () => {
                selectedPartnerCardId = el.getAttribute('data-pick-partner');
                phase = 'AKAIITO_RESULT';
                ItoSfx.stageClear();
                renderAll();
              };
            });
            return;
          }

          if (phase === 'AKAIITO_RESULT') {
            const partner = allDealtCards.find((c) => c.id === selectedPartnerCardId) || others[0];
            const sum = myCard.number + partner.number;
            const isBurst = sum > 100;

            const allRevealedHtml = allDealtCards.map((c) => `
              <div class="ito-decl-card" style="border-color:${c.id === partner.id || c.isHuman ? '#f43f5e' : '#475569'};">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-weight:900;color:${c.ownerColor};">${c.avatar} ${c.ownerName}</span>
                  <span style="font-size:22px;font-weight:900;color:#fef08a;">数字: ${c.number}</span>
                </div>
                <div class="ito-decl-word">💬「${c.clueWord}」</div>
              </div>
            `).join('');

            mainBoardEl.innerHTML = `
              <div style="text-align:center;padding:16px;background:rgba(15,23,42,0.9);border:2px solid ${isBurst ? '#ef4444' : '#10b981'};border-radius:14px;">
                <div style="font-size:22px;font-weight:900;color:${isBurst ? '#fb7185' : '#fef08a'};margin-bottom:6px;">
                  ${isBurst
                    ? `💥 ドボン（100超過）！ あなた(${myCard.number}) ＋ ${partner.ownerName}(${partner.number}) ＝ 合計 ${sum}`
                    : `❤️ ペア成立！ あなた(${myCard.number}) ＋ ${partner.ownerName}(${partner.number}) ＝ 合計 ${sum} / 100！`}
                </div>
                <button class="ito-btn ito-btn-gold" id="ito-akai-retry" style="margin-top:8px;">🔄 新しいお題でもう一度遊ぶ</button>
              </div>
              <div class="ito-declarations-grid">${allRevealedHtml}</div>
            `;
            mainBoardEl.querySelector('#ito-akai-retry').onclick = () => initGame();
            return;
          }
        }

        // クモノイト：昇順カード提出フェーズ / ステージクリア / ゲームオーバー
        const timelineHtml = playedTimeline.length === 0
          ? `<div style="color:#64748b;font-size:13px;padding:18px 0;">まだ場にカードが出されていません。下の宣言一覧から【一番数字が小さい】と思うカードをクリックして出しましょう！</div>`
          : playedTimeline.map((c, idx) => `
              <div class="ito-played-card ${c.result === 'fail' ? 'failed' : ''}">
                <div style="font-size:10px;color:#cbd5e1;font-weight:800;">#${idx + 1} ${c.ownerName}</div>
                <div class="ito-card-num-big">${c.number}</div>
                <div style="font-size:12px;font-weight:900;color:#f8fafc;margin-top:2px;">「${c.clueWord}」</div>
                <div style="font-size:10px;font-weight:900;color:${c.result === 'fail' ? '#fca5a5' : '#6ee7b7'};margin-top:2px;">
                  ${c.result === 'fail' ? '💥 取り残しミス (-1❤️)' : '⭕ 昇順成功！'}
                </div>
              </div>
            `).join('<span style="font-size:20px;color:#38bdf8;font-weight:900;">➔</span>');

        const unrevealedCards = allDealtCards.filter((c) => c.status === 'unrevealed');
        const unrevealedHtml = unrevealedCards.map((c) => `
          <div class="ito-decl-card clickable" data-play-card="${c.id}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:900;color:${c.ownerColor};">${c.avatar} ${c.ownerName} (${c.cardIndexInHand}枚目)</span>
              <span style="font-size:12px;font-weight:900;background:#0f172a;padding:3px 9px;border-radius:999px;color:${c.isHuman ? '#fef08a' : '#94a3b8'};">
                ${c.isHuman ? `あなたの手札: ${c.number}` : '数字: ❓秘密'}
              </span>
            </div>
            <div class="ito-decl-word">💬「${c.clueWord}」</div>
            <div style="font-size:11px;color:#94a3b8;">${c.isHuman ? 'あなたのカード' : c.clueNuance}</div>
            <button class="ito-btn ito-btn-emerald" style="width:100%;margin-top:4px;">
              ⬆️ 今これが最小！場に出す
            </button>
          </div>
        `).join('');

        let footerBannerHtml = '';
        if (phase === 'STAGE_CLEAR') {
          if (stageNum < 3) {
            footerBannerHtml = `
              <div style="text-align:center;padding:14px;background:rgba(16,185,129,0.16);border:2px solid #10b981;border-radius:14px;">
                <div style="font-size:18px;font-weight:900;color:#6ee7b7;margin-bottom:8px;">🎉 ステージ ${stageNum} クリア！手札枚数が増える次のステージへ挑みましょう！</div>
                <button class="ito-btn ito-btn-gold" id="ito-next-stage-btn" style="font-size:14px;padding:8px 22px;">
                  🚀 ステージ ${stageNum + 1} へ進む！
                </button>
              </div>
            `;
          } else {
            footerBannerHtml = `
              <div style="text-align:center;padding:16px;background:rgba(245,158,11,0.18);border:2px solid #f59e0b;border-radius:14px;">
                <div style="font-size:22px;font-weight:900;color:#fef08a;margin-bottom:8px;">🏆 全3ステージ完全制覇！！クモノイト完全クリア！！</div>
                <button class="ito-btn ito-btn-gold" id="ito-win-retry" style="font-size:14px;padding:8px 22px;">🔄 別のお題で新しく遊ぶ</button>
              </div>
            `;
          }
        } else if (phase === 'GAME_OVER') {
          footerBannerHtml = `
            <div style="text-align:center;padding:14px;background:rgba(239,68,68,0.16);border:2px solid #ef4444;border-radius:14px;">
              <div style="font-size:18px;font-weight:900;color:#fca5a5;margin-bottom:8px;">💀 ライフが 0 になりました… クモノイト脱出失敗！</div>
              <button class="ito-btn ito-btn-primary" id="ito-fail-retry" style="font-size:14px;padding:8px 22px;">🔄 もう一度挑戦する</button>
            </div>
          `;
        }

        mainBoardEl.innerHTML = `
          <div class="ito-timeline-zone">
            <div style="font-size:12px;font-weight:900;color:#38bdf8;">
              📈 場に出された昇順ライン（小 1 ➔ 大 100）：
            </div>
            <div class="ito-timeline-list">${timelineHtml}</div>
          </div>

          ${footerBannerHtml}

          ${unrevealedCards.length > 0 ? `
            <div>
              <div style="font-size:13px;font-weight:900;color:#fef08a;margin-bottom:8px;">
                👇 まだ場に出ていないカード（残り ${unrevealedCards.length} 枚）― 一番数字が小さいと思うカードをクリック！
              </div>
              <div class="ito-declarations-grid">${unrevealedHtml}</div>
            </div>
          ` : ''}
        `;

        mainBoardEl.querySelectorAll('[data-play-card]').forEach((el) => {
          el.onclick = () => {
            const cid = el.getAttribute('data-play-card');
            playCardToTimeline(cid);
          };
        });

        const nextBtn = mainBoardEl.querySelector('#ito-next-stage-btn');
        if (nextBtn) {
          nextBtn.onclick = () => {
            themeIdx = (themeIdx + 1) % ITO_THEMES.length;
            startStage(stageNum + 1);
          };
        }
        const winRetry = mainBoardEl.querySelector('#ito-win-retry');
        if (winRetry) winRetry.onclick = () => initGame();
        const failRetry = mainBoardEl.querySelector('#ito-fail-retry');
        if (failRetry) failRetry.onclick = () => initGame();
      }

      modeSelEl.onchange = () => initGame();
      pcountSelEl.onchange = () => initGame();
      changeThemeBtn.onclick = () => {
        themeIdx = (themeIdx + 1) % ITO_THEMES.length;
        startStage(stageNum);
      };
      newBtnEl.onclick = () => initGame();

      initGame();

      return () => {
        isDestroyed = true;
      };
    }
  });
})();
