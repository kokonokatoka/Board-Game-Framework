/**
 * オセロの3D表示 — 黒檀調の枠に沈めた緑の盤面と、白黒の円盤石。
 * 2D盤面: .othello-board-frame / #othello-grid > .oth-cell(.valid) > .oth-piece(.b|.w)
 */
(function () {
  const N = 8;
  const STEP = 1;
  const DISC_R = 0.42;
  const DISC_H = 0.15;

  window.BoardArena3D.registerAdapter('othello', (THREE, container, api) => {
    const frameEl = container.querySelector('.othello-board-frame');
    const gridEl = container.querySelector('#othello-grid');
    if (!frameEl || !gridEl) return null;

    const st = api.createStage(THREE, frameEl, { radius: 13.4, phi: 0.66, extent: 5.4, tableY: -0.42 });
    const { kit, geo, root, markers } = st;

    // ---- 盤 ----
    const base = new THREE.Mesh(geo.slab(9.6, 9.6, 0.42, { bevel: 0.06, radius: 0.24 }), kit.wood('darkWalnut', { repeat: 0.16 }));
    base.position.y = -0.21;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const opening = N * STEP + 0.14;
    const rim = new THREE.Mesh(
      geo.slab(9.6, 9.6, 0.16, {
        bevel: 0.05,
        radius: 0.24,
        holes: [geo.roundedRectShape(opening + 0.1, opening + 0.1, 0.06)]
      }),
      kit.wood('darkWalnut', { repeat: 0.16, seed: 9 })
    );
    rim.position.y = 0.08;
    rim.castShadow = true;
    rim.receiveShadow = true;
    root.add(rim);

    const surfaceCanvas = api.canvas.cached('othello-surface', 1024, 1024, (ctx, w, h) => {
      api.canvas.paintNoise(ctx, w, h, '#1f4332', 12, 21, 3600);
      const m = (0.07 / opening) * w;
      const span = w - m * 2;
      ctx.strokeStyle = 'rgba(8, 18, 12, 0.88)';
      ctx.lineWidth = 4;
      for (let i = 0; i <= N; i++) {
        const p = m + (span * i) / N;
        ctx.beginPath();
        ctx.moveTo(p, m);
        ctx.lineTo(p, h - m);
        ctx.moveTo(m, p);
        ctx.lineTo(w - m, p);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(8, 18, 12, 0.9)';
      [2, 6].forEach((a) => [2, 6].forEach((b) => {
        ctx.beginPath();
        ctx.arc(m + (span * a) / N, m + (span * b) / N, 9, 0, Math.PI * 2);
        ctx.fill();
      }));
    });
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(opening, opening).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: kit.texture(surfaceCanvas), roughness: 0.92, envMapIntensity: 0.3 })
    );
    surface.position.y = 0.002;
    surface.receiveShadow = true;
    root.add(surface);

    // ---- 石 ----
    const topGeo = geo.cached('oth-top', () => geo.lathe([
      [DISC_R, 0], [DISC_R, DISC_H / 2 - 0.035],
      [DISC_R - 0.01, DISC_H / 2 - 0.012], [DISC_R - 0.035, DISC_H / 2], [0, DISC_H / 2]
    ], 56));
    const bottomGeo = geo.cached('oth-bottom', () => geo.lathe([
      [0, -DISC_H / 2], [DISC_R - 0.035, -DISC_H / 2], [DISC_R - 0.01, -DISC_H / 2 + 0.012],
      [DISC_R, -DISC_H / 2 + 0.035], [DISC_R, 0]
    ], 56));
    const blackMat = kit.lacquer('#161514', { roughness: 0.42, clearcoat: 0.35 });
    const whiteMat = kit.lacquer('#dcd6ca', { roughness: 0.5, clearcoat: 0.3 });

    // holder (盤上の位置と接地影) の中で disc が落ちたり裏返ったりする
    function createDisc() {
      const holder = new THREE.Group();
      const disc = new THREE.Group();
      const top = new THREE.Mesh(topGeo, blackMat);
      const bottom = new THREE.Mesh(bottomGeo, whiteMat);
      [top, bottom].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
      });
      disc.add(top, bottom);
      disc.position.y = DISC_H / 2;
      const shadow = markers.contact(DISC_R * 2.5, DISC_R * 2.5, 0.5);
      shadow.position.y = 0.004;
      holder.add(shadow, disc);
      holder.userData.disc = disc;
      return holder;
    }

    const cellPos = (r, c) => ({ x: (c - (N - 1) / 2) * STEP, z: (r - (N - 1) / 2) * STEP });

    // ---- 印 (合法手・ホバー・直前の一手) ----
    const hintGroup = new THREE.Group();
    root.add(hintGroup);
    const hoverRing = markers.ring(0.3, 0.36, '#f4ede1', 0.75);
    hoverRing.visible = false;
    root.add(hoverRing);
    const lastMark = markers.dot(0.06, '#d9a45b', 0.95);
    lastMark.visible = false;
    root.add(lastMark);

    let validSet = new Set();
    const cells = () => gridEl.querySelectorAll('.oth-cell');

    const picker = st.gridPicker({
      rows: N,
      cols: N,
      step: STEP,
      y: 0.01,
      clickable: (r, c) => validSet.has(r * N + c),
      onHover: (r, c) => {
        const ok = validSet.has(r * N + c);
        hoverRing.visible = ok;
        if (ok) {
          const p = cellPos(r, c);
          hoverRing.position.set(p.x, 0.012, p.z);
        }
      },
      onLeave: () => { hoverRing.visible = false; },
      onClick: (r, c) => {
        const cell = cells()[r * N + c];
        if (cell) cell.click();
      }
    });

    // ---- 同期 ----
    const discs = new Array(N * N).fill(null);
    let state = new Array(N * N).fill(null);
    let first = true;

    function sync() {
      const list = cells();
      if (list.length < N * N) return;

      const next = [];
      const valid = new Set();
      list.forEach((cell, i) => {
        const p = cell.querySelector('.oth-piece');
        next[i] = p ? (p.classList.contains('b') ? 'b' : 'w') : null;
        if (cell.classList.contains('valid')) valid.add(i);
      });

      const placed = [];
      next.forEach((color, i) => {
        if (color && !state[i]) placed.push(i);
      });
      const isMove = !first && placed.length === 1;
      const origin = isMove ? placed[0] : null;

      next.forEach((color, i) => {
        const r = Math.floor(i / N);
        const c = i % N;
        const p = cellPos(r, c);

        if (!color) {
          if (discs[i]) {
            st.removeObject(discs[i]);
            discs[i] = null;
          }
          return;
        }

        const wantOdd = color === 'w';
        if (!discs[i]) {
          const holder = createDisc();
          const d = holder.userData.disc;
          d.rotation.x = wantOdd ? Math.PI : 0;
          holder.position.set(p.x, 0, p.z);
          root.add(holder);
          discs[i] = holder;
          if (isMove) {
            d.position.y = 1.4;
            st.animate(d, { position: { y: DISC_H / 2 } }, { duration: 340, ease: 'outBack' });
          } else if (first) {
            d.position.y = 0.9;
            st.animate(d, { position: { y: DISC_H / 2 } }, { duration: 520, delay: 500 + i * 6, ease: 'outBack' });
          }
        } else if (state[i] && state[i] !== color) {
          // 置いた石からの距離に応じて順に裏返す
          const d = discs[i].userData.disc;
          let k = Math.round(d.rotation.x / Math.PI);
          if ((Math.abs(k) % 2 === 1) !== wantOdd) k += 1;
          const dist = origin === null ? 0 : Math.max(Math.abs(Math.floor(origin / N) - r), Math.abs((origin % N) - c));
          st.animate(d, { rotation: { x: k * Math.PI }, position: { y: DISC_H / 2 } }, {
            duration: 420,
            delay: 120 + dist * 70,
            arc: 0.55,
            ease: 'inOutCubic'
          });
        }
      });

      if (isMove) {
        const p = cellPos(Math.floor(origin / N), origin % N);
        lastMark.position.set(p.x, DISC_H + 0.004, p.z);
        lastMark.visible = true;
      } else if (placed.length > 2 || next.every((v) => !v)) {
        lastMark.visible = false;
      }

      // 合法手
      validSet = valid;
      st.clearGroup(hintGroup);
      valid.forEach((i) => {
        const p = cellPos(Math.floor(i / N), i % N);
        const dot = markers.dot(0.1, '#f4ede1', 0.38);
        dot.position.set(p.x, 0.01, p.z);
        hintGroup.add(dot);
      });
      const h = picker.hovered;
      hoverRing.visible = !!h && validSet.has(h.r * N + h.c);

      state = next;
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
