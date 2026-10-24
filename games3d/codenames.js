/**
 * コードネームの3D表示 — 木のテーブルに並べた25枚の紙カード。正体が分かるとカードが裏返る。
 * 2D盤面: .cn-grid-container / #cn-grid > .cn-card(25) > .card-word
 *   .revealed + .type-red|.type-blue|.type-neutral|.type-assassin、スパイマスター視点は .spy-*
 */
(function () {
  const CW = 1.86;
  const CD = 1.18;
  const SX = 2.08;
  const SZ = 1.4;
  const T = 0.05;
  const AGENTS = {
    red: { bg: '#9d3328', fg: '#f6eee2', label: '赤チーム' },
    blue: { bg: '#2b4f7e', fg: '#f6eee2', label: '青チーム' },
    neutral: { bg: '#cbbb98', fg: '#3b3226', label: '一般人' },
    assassin: { bg: '#161514', fg: '#d9cdb6', label: '暗殺者' }
  };
  const SPY_MARK = { red: '#b6463a', blue: '#3f67a0', neutral: '#a39477', assassin: '#141312' };

  window.BoardArena3D.registerAdapter('codenames', (THREE, container, api) => {
    const gridContainer = container.querySelector('.cn-grid-container');
    const gridEl = container.querySelector('#cn-grid');
    if (!gridContainer || !gridEl) return null;

    const st = api.createStage(THREE, gridContainer, { radius: 14, phi: 0.6, extent: 5.4, tableY: -0.02, compact: true, tableWood: 'walnut' });
    const { kit, geo, root, markers } = st;

    const pos = (r, c) => ({ x: (c - 2) * SX, z: (r - 2) * SZ });

    // ---- カード ----
    const cardShape = geo.roundedRectShape(CW, CD, 0.07);
    const faceGeo = (() => {
      const g = new THREE.ShapeGeometry(cardShape, 8);
      const a = g.attributes.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, (a.getX(i) + CW / 2) / CW, (a.getY(i) + CD / 2) / CD);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const bodyGeo = geo.slab(CW, CD, T, { bevel: 0.008, radius: 0.07 });
    const bodyMat = kit.matte('#e8dfcb', { roughness: 0.8 });

    function faceCanvas(word, spy) {
      return api.canvas.cached(`cn-face:${word}:${spy || ''}`, 512, 324, (ctx, w, h) => {
        api.canvas.paintNoise(ctx, w, h, '#efe7d4', 7, word.length * 13 + 5, 300);
        ctx.strokeStyle = 'rgba(80, 64, 44, 0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(18, 18, w - 36, h - 36);
        if (spy) {
          ctx.fillStyle = SPY_MARK[spy];
          ctx.fillRect(18, h - 52, w - 36, 34);
        }
        ctx.fillStyle = '#2a241c';
        let size = 64;
        ctx.font = `700 ${size}px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif`;
        while (ctx.measureText(word).width > w - 70 && size > 30) {
          size -= 4;
          ctx.font = `700 ${size}px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif`;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(word, w / 2, spy ? h / 2 - 14 : h / 2);
      });
    }

    function agentCanvas(type, word) {
      const a = AGENTS[type] || AGENTS.neutral;
      return api.canvas.cached(`cn-agent:${type}:${word}`, 512, 324, (ctx, w, h) => {
        api.canvas.paintNoise(ctx, w, h, a.bg, 10, type.length * 7 + 1, 400);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(18, 18, w - 36, h - 36);
        ctx.fillStyle = a.fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '500 26px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
        ctx.globalAlpha = 0.75;
        ctx.fillText(a.label, w / 2, h / 2 - 38);
        ctx.globalAlpha = 1;
        ctx.font = '700 46px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
        ctx.fillText(word, w / 2, h / 2 + 22);
      });
    }

    const matCache = new Map();
    function faceMat(canvasEl) {
      if (!matCache.has(canvasEl)) {
        matCache.set(canvasEl, new THREE.MeshStandardMaterial({ map: kit.texture(canvasEl), roughness: 0.78, envMapIntensity: 0.35 }));
      }
      return matCache.get(canvasEl);
    }

    function cardInfo(el) {
      const wordEl = el.querySelector('.card-word');
      const word = (wordEl ? wordEl.textContent : el.textContent).trim();
      const type = ['red', 'blue', 'neutral', 'assassin'].find((t) => el.classList.contains(`type-${t}`));
      const spy = ['red', 'blue', 'neutral', 'assassin'].find((t) => el.classList.contains(`spy-${t}`));
      return { word, revealed: el.classList.contains('revealed'), type, spy };
    }

    function createCard(info) {
      const holder = new THREE.Group();
      const card = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      const front = new THREE.Mesh(faceGeo, faceMat(faceCanvas(info.word, info.spy)));
      front.position.y = T / 2 + 0.001;
      front.userData.sharedMaterial = true;
      const back = new THREE.Mesh(faceGeo, faceMat(agentCanvas(info.type || 'neutral', info.word)));
      // 奥行き方向に裏返したとき文字が正立するよう Y にも半回転させる
      back.rotation.set(Math.PI, Math.PI, 0);
      back.position.y = -T / 2 - 0.001;
      back.userData.sharedMaterial = true;
      card.add(body, front, back);
      card.position.y = T / 2;
      const shadow = markers.contact(CW * 1.25, CD * 1.35, 0.4);
      shadow.position.y = 0.003;
      holder.add(shadow, card);
      holder.userData.card = card;
      holder.userData.front = front;
      holder.userData.back = back;
      return holder;
    }

    // ---- 同期 ----
    const cards = new Array(25).fill(null);
    const infos = new Array(25).fill(null);
    let first = true;

    function sync() {
      const list = gridEl.querySelectorAll('.cn-card');
      if (list.length < 25) return;
      list.forEach((el, i) => {
        const info = cardInfo(el);
        const prev = infos[i];
        const p = pos(Math.floor(i / 5), i % 5);
        let holder = cards[i];

        if (holder && prev && prev.word !== info.word) {
          st.removeObject(holder);
          holder = null;
        }
        if (!holder) {
          holder = createCard(info);
          holder.position.set(p.x, 0, p.z);
          root.add(holder);
          cards[i] = holder;
          const card = holder.userData.card;
          if (info.revealed) card.rotation.z = Math.PI;
          card.position.y = 0.9;
          st.animate(card, { position: { y: T / 2 } }, { duration: 420, delay: (first ? 300 : 0) + i * 30, ease: 'outCubic' });
        } else {
          if (!prev || prev.spy !== info.spy) holder.userData.front.material = faceMat(faceCanvas(info.word, info.spy));
          if (info.type && (!prev || prev.type !== info.type)) holder.userData.back.material = faceMat(agentCanvas(info.type, info.word));
          if (info.revealed && !(prev && prev.revealed)) {
            st.animate(holder.userData.card, { rotation: { z: Math.PI }, position: { y: T / 2 } }, { duration: 560, arc: 0.9, ease: 'inOutCubic' });
          } else if (!info.revealed && prev && prev.revealed) {
            st.animate(holder.userData.card, { rotation: { z: 0 }, position: { y: T / 2 } }, { duration: 400, ease: 'inOutCubic' });
          }
        }
        infos[i] = info;

        const card = holder.userData.card;
        st.pick(holder, {
          clickable: () => !el.classList.contains('revealed'),
          onHover: () => { if (!card.userData._tween && !info.revealed) card.position.y = T / 2 + 0.12; },
          onLeave: () => { if (!card.userData._tween) card.position.y = T / 2; },
          onClick: () => el.click()
        });
      });
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
