/**
 * ドット＆ボックスの3D表示 — 木の台に貼った紙の上に真鍮の鋲、色付きの棒で線を引く。
 * 2D盤面: .dab-board-frame / #dab-board の 9×9 グリッド (行・列とも偶数が点)
 *   .dab-edge-h / .dab-edge-v (.drawn .p1|.p2)、.dab-box (.p1|.p2)
 */
(function () {
  const ROWS = 4;
  const COLS = 4;
  const SP = 1.7;
  const STICK_T = 0.11;

  window.BoardArena3D.registerAdapter('dotsandboxes', (THREE, container, api) => {
    const frameEl = container.querySelector('.dab-board-frame');
    const boardEl = container.querySelector('#dab-board');
    if (!frameEl || !boardEl) return null;

    const st = api.createStage(THREE, frameEl, { radius: 13.6, phi: 0.66, extent: 4.6, tableY: -0.36 });
    const { kit, geo, root, markers } = st;

    // ---- 台と紙 ----
    const W = COLS * SP + 1.6;
    const D = ROWS * SP + 1.6;
    const base = new THREE.Mesh(geo.slab(W, D, 0.34, { bevel: 0.06, radius: 0.18 }), kit.wood('oak', { repeat: 0.2, seed: 61 }));
    base.position.y = -0.17;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const paperCanvas = api.canvas.cached('dab-paper', 1024, 1024, (ctx, w, h) => {
      api.canvas.paintNoise(ctx, w, h, '#d8cdb6', 9, 81, 900);
      ctx.strokeStyle = 'rgba(80, 110, 150, 0.14)';
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 32) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }
    });
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.6, D - 0.6).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: kit.texture(paperCanvas), roughness: 0.92, envMapIntensity: 0.3 })
    );
    paper.position.y = 0.003;
    paper.receiveShadow = true;
    root.add(paper);

    const dotX = (c) => (c - COLS / 2) * SP;
    const dotZ = (r) => (r - ROWS / 2) * SP;

    // 真鍮の鋲
    const pinGeo = geo.cached('dab-pin', () => geo.lathe([[0, 0], [0.13, 0], [0.13, 0.03], [0.07, 0.06], [0.07, 0.12], [0.11, 0.15], [0.09, 0.19], [0, 0.2]], 32));
    const brass = kit.metal('#b58a4a', { roughness: 0.3 });
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const pin = new THREE.Mesh(pinGeo, brass);
        pin.position.set(dotX(c), 0, dotZ(r));
        pin.castShadow = true;
        root.add(pin);
      }
    }

    // ---- 棒とマス ----
    const stickH = geo.cached('dab-stick-h', () => geo.roundedBox(SP - 0.3, STICK_T, STICK_T * 1.4, 0.04, 2));
    const stickV = geo.cached('dab-stick-v', () => geo.roundedBox(STICK_T * 1.4, STICK_T, SP - 0.3, 0.04, 2));
    const inkMats = { p1: kit.lacquer('#2f5d8c', { roughness: 0.45 }), p2: kit.lacquer('#9c3a2e', { roughness: 0.45 }) };
    const ghost = kit.ghostSolid('#3b3127', 0.35);
    const tileGeo = geo.cached('dab-tile', () => geo.slab(SP - 0.42, SP - 0.42, 0.04, { bevel: 0.01, radius: 0.06 }));
    const tileMats = { p1: kit.matte('#7a96b8', { roughness: 0.85 }), p2: kit.matte('#c08a7c', { roughness: 0.85 }) };

    const items = new Map();
    const pickGroup = new THREE.Group();
    root.add(pickGroup);
    let first = true;
    let hoverKey = null;
    let ghostMesh = null;

    function showGhost(key, isH, x, z) {
      if (ghostMesh) {
        st.removeObject(ghostMesh);
        ghostMesh = null;
      }
      hoverKey = key;
      if (!key) return;
      ghostMesh = new THREE.Mesh(isH ? stickH : stickV, ghost);
      ghostMesh.position.set(x, STICK_T / 2 + 0.01, z);
      root.add(ghostMesh);
    }

    function sync() {
      const children = Array.from(boardEl.children);
      if (children.length < (ROWS * 2 + 1) * (COLS * 2 + 1)) return;
      st.clearGroup(pickGroup);
      const seen = new Set();
      let order = 0;

      children.forEach((el, idx) => {
        const gr = Math.floor(idx / (COLS * 2 + 1));
        const gc = idx % (COLS * 2 + 1);
        const isH = el.classList.contains('dab-edge-h');
        const isV = el.classList.contains('dab-edge-v');
        const isBox = el.classList.contains('dab-box');
        if (!isH && !isV && !isBox) return;

        const x = isV ? dotX(gc / 2) : dotX((gc - 1) / 2 + 0.5);
        const z = isH ? dotZ(gr / 2) : dotZ((gr - 1) / 2 + 0.5);
        const owner = el.classList.contains('p1') ? 'p1' : el.classList.contains('p2') ? 'p2' : null;
        const drawn = isBox ? !!owner : el.classList.contains('drawn');
        const key = `${gr},${gc}`;

        if (drawn) {
          seen.add(key);
          if (!items.has(key)) {
            const m = new THREE.Mesh(isBox ? tileGeo : isH ? stickH : stickV, isBox ? tileMats[owner] : inkMats[owner]);
            m.castShadow = !isBox;
            m.receiveShadow = true;
            const y = isBox ? 0.025 : STICK_T / 2 + 0.01;
            m.position.set(x, y, z);
            root.add(m);
            items.set(key, m);
            if (!first) {
              if (isBox) {
                m.scale.set(0.01, 0.01, 0.01);
                st.animate(m, { scale: 1 }, { duration: 360, delay: 180 + order * 80, ease: 'outBack' });
              } else {
                m.position.y = 0.9;
                st.animate(m, { position: { y } }, { duration: 300, ease: 'outBounce' });
              }
              order++;
            }
            if (hoverKey === key) showGhost(null);
          }
        } else if (!isBox) {
          const hit = new THREE.Mesh(isH ? geo.cached('dab-hit-h', () => new THREE.BoxGeometry(SP - 0.3, 0.3, 0.5)) : geo.cached('dab-hit-v', () => new THREE.BoxGeometry(0.5, 0.3, SP - 0.3)), kit.invisible());
          hit.position.set(x, 0.15, z);
          pickGroup.add(hit);
          st.pick(hit, {
            onHover: () => showGhost(key, isH, x, z),
            onLeave: () => { if (hoverKey === key) showGhost(null); },
            onClick: () => el.click()
          });
        }
      });

      items.forEach((m, key) => {
        if (!seen.has(key)) {
          st.removeObject(m);
          items.delete(key);
        }
      });
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
