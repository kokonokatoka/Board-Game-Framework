/**
 * チェッカーの3D表示 — メープルとウォルナットの寄木盤に、溝付きの駒。キングは駒を2枚重ねる。
 * 2D盤面: .chk-board-frame / #chk-board > .chk-cell(.selected, .valid-move) > .chk-piece(.p1|.p2, 👑でキング)
 */
(function () {
  const N = 8;
  const STEP = 1;
  const R = 0.4;
  const H = 0.16;

  window.BoardArena3D.registerAdapter('checkers', (THREE, container, api) => {
    const frameEl = container.querySelector('.chk-board-frame');
    const boardEl = container.querySelector('#chk-board');
    if (!frameEl || !boardEl) return null;

    const st = api.createStage(THREE, frameEl, { radius: 13.4, phi: 0.68, extent: 5.4, tableY: -0.42 });
    const { kit, geo, root, markers } = st;

    // ---- 盤 ----
    const base = new THREE.Mesh(geo.slab(9.6, 9.6, 0.42, { bevel: 0.06, radius: 0.22 }), kit.wood('walnut', { repeat: 0.15, seed: 4 }));
    base.position.y = -0.21;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const opening = N * STEP;
    const rim = new THREE.Mesh(
      geo.slab(9.6, 9.6, 0.12, { bevel: 0.04, radius: 0.22, holes: [geo.roundedRectShape(opening + 0.08, opening + 0.08, 0.02)] }),
      kit.wood('walnut', { repeat: 0.15, seed: 6 })
    );
    rim.position.y = 0.06;
    rim.castShadow = true;
    root.add(rim);

    const squaresCanvas = api.canvas.cached('checkers-squares', 1024, 1024, (ctx, w, h) => {
      const s = w / N;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const dark = (r + c) % 2 === 1;
          api.canvas.paintWood(ctx, c * s, r * s, s, s, dark ? api.WOODS.walnut : api.WOODS.maple, 100 + r * N + c, (r + c) % 4 < 2);
        }
      }
      ctx.strokeStyle = 'rgba(20, 12, 6, 0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= N; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s, 0);
        ctx.lineTo(i * s, h);
        ctx.moveTo(0, i * s);
        ctx.lineTo(w, i * s);
        ctx.stroke();
      }
    });
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(opening, opening).rotateX(-Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ map: kit.texture(squaresCanvas), roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.55 })
    );
    surface.position.y = 0.002;
    surface.receiveShadow = true;
    root.add(surface);

    // ---- 駒 (側面に溝、上面に浅い同心円) ----
    const pieceGeo = geo.cached('chk-piece', () => {
      const pts = [[0, -H / 2], [R - 0.03, -H / 2], [R, -H / 2 + 0.03]];
      const ridges = 7;
      for (let i = 0; i <= ridges * 2; i++) {
        const y = -H / 2 + 0.03 + ((H - 0.06) * i) / (ridges * 2);
        pts.push([i % 2 === 0 ? R : R - 0.012, y]);
      }
      pts.push([R - 0.03, H / 2], [R * 0.72, H / 2], [R * 0.7, H / 2 - 0.012], [R * 0.6, H / 2 - 0.012], [R * 0.58, H / 2], [0, H / 2]);
      return geo.lathe(pts, 56);
    });
    const redMat = kit.lacquer('#8c241d', { roughness: 0.4, clearcoat: 0.55 });
    const ivoryMat = kit.lacquer('#ddd5c3', { roughness: 0.42, clearcoat: 0.5 });
    const goldMat = kit.metal('#c9a35a', { roughness: 0.28 });
    const crownGeo = geo.cached('chk-crown', () => new THREE.TorusGeometry(R * 0.64, 0.02, 10, 48).rotateX(Math.PI / 2));

    function createPiece(isP1) {
      const holder = new THREE.Group();
      const body = new THREE.Group();
      const disc = new THREE.Mesh(pieceGeo, isP1 ? redMat : ivoryMat);
      disc.castShadow = true;
      disc.receiveShadow = true;
      disc.position.y = H / 2;
      body.add(disc);
      const shadow = markers.contact(R * 2.5, R * 2.5, 0.5);
      shadow.position.y = 0.004;
      holder.add(shadow, body);
      holder.userData.body = body;
      holder.userData.isP1 = isP1;
      return holder;
    }

    function setKing(holder, king) {
      const body = holder.userData.body;
      if (king && !holder.userData.king) {
        const top = new THREE.Mesh(pieceGeo, holder.userData.isP1 ? redMat : ivoryMat);
        top.castShadow = true;
        top.position.y = H * 1.5 + 0.004;
        const ring = new THREE.Mesh(crownGeo, goldMat);
        ring.position.y = H * 2 + 0.006;
        body.add(top, ring);
        top.position.y += 0.6;
        st.animate(top, { position: { y: H * 1.5 + 0.004 } }, { duration: 380, ease: 'outBounce' });
        holder.userData.king = true;
      }
    }

    const cellPos = (r, c) => ({ x: (c - (N - 1) / 2) * STEP, z: (r - (N - 1) / 2) * STEP });

    // ---- 印 ----
    const hintGroup = new THREE.Group();
    root.add(hintGroup);
    const hoverSquare = markers.square(0.96, '#f4ede1', 0.12);
    hoverSquare.visible = false;
    root.add(hoverSquare);

    const cells = () => boardEl.querySelectorAll('.chk-cell');
    let clickableSet = new Set();

    const picker = st.gridPicker({
      rows: N,
      cols: N,
      step: STEP,
      y: 0.01,
      clickable: (r, c) => clickableSet.has(r * N + c),
      onHover: (r, c) => {
        hoverSquare.visible = clickableSet.has(r * N + c);
        const p = cellPos(r, c);
        hoverSquare.position.set(p.x, 0.006, p.z);
      },
      onLeave: () => { hoverSquare.visible = false; },
      onClick: (r, c) => {
        const cell = cells()[r * N + c];
        if (!cell) return;
        const piece = cell.querySelector('.chk-piece');
        (piece || cell).click();
      }
    });

    // ---- 同期 ----
    let pieces = new Array(N * N).fill(null);
    let first = true;

    function sync() {
      const list = cells();
      if (list.length < N * N) return;

      const next = [];
      const selected = new Set();
      const valid = new Set();
      list.forEach((cell, i) => {
        const p = cell.querySelector('.chk-piece');
        next[i] = p ? { p1: p.classList.contains('p1'), king: p.textContent.includes('👑') } : null;
        if (cell.classList.contains('selected')) selected.add(i);
        if (cell.classList.contains('valid-move')) valid.add(i);
      });

      // 消えた駒と現れた駒を突き合わせ、同じ色なら移動として動かす
      const removed = [];
      const added = [];
      next.forEach((n, i) => {
        const cur = pieces[i];
        if (cur && (!n || n.p1 !== cur.userData.isP1)) removed.push(i);
        if (n && (!cur || n.p1 !== cur.userData.isP1)) added.push(i);
      });

      const nextPieces = pieces.slice();
      removed.forEach((i) => { nextPieces[i] = null; });
      added.forEach((i) => {
        const n = next[i];
        const p = cellPos(Math.floor(i / N), i % N);
        const fromIdx = !first ? removed.find((j) => pieces[j] && pieces[j].userData.isP1 === n.p1 && !pieces[j].userData.moved) : undefined;
        if (fromIdx !== undefined) {
          const holder = pieces[fromIdx];
          holder.userData.moved = true;
          st.animate(holder, { position: { x: p.x, z: p.z } }, { duration: 460, arc: 0.7, ease: 'inOutCubic' });
          nextPieces[i] = holder;
        } else {
          const holder = createPiece(n.p1);
          holder.position.set(p.x, 0, p.z);
          root.add(holder);
          nextPieces[i] = holder;
          if (first) {
            holder.userData.body.position.y = 0.8;
            st.animate(holder.userData.body, { position: { y: 0 } }, { duration: 480, delay: 300 + i * 8, ease: 'outBounce' });
          }
        }
      });
      // 取られた駒は持ち上がって消える
      removed.forEach((i) => {
        const holder = pieces[i];
        if (holder.userData.moved) {
          holder.userData.moved = false;
          return;
        }
        st.animate(holder, { position: { y: 0.9 }, scale: 0.01 }, { duration: 380, delay: 260, ease: 'inOutCubic', complete: () => st.removeObject(holder) });
      });
      nextPieces.forEach((h) => { if (h) h.userData.moved = false; });
      pieces = nextPieces;

      // キング・選択中の持ち上げ
      pieces.forEach((holder, i) => {
        if (!holder) return;
        if (next[i] && next[i].king) setKing(holder, true);
        const lift = selected.has(i) ? 0.32 : 0;
        if (Math.abs(holder.userData.body.position.y - lift) > 0.001 && !holder.userData.body.userData._tween) {
          st.animate(holder.userData.body, { position: { y: lift } }, { duration: 220, ease: 'outCubic' });
        }
      });

      // 合法手の印
      st.clearGroup(hintGroup);
      valid.forEach((i) => {
        const p = cellPos(Math.floor(i / N), i % N);
        const dot = markers.dot(0.12, '#f4ede1', 0.45);
        dot.position.set(p.x, 0.008, p.z);
        hintGroup.add(dot);
      });
      selected.forEach((i) => {
        const p = cellPos(Math.floor(i / N), i % N);
        const ring = markers.ring(0.44, 0.48, '#e2b867', 0.9);
        ring.position.set(p.x, 0.008, p.z);
        hintGroup.add(ring);
      });

      // 自分の駒とその移動先をクリック可能に
      clickableSet = new Set(valid);
      next.forEach((n, i) => { if (n) clickableSet.add(i); });

      const h = picker.hovered;
      hoverSquare.visible = !!h && clickableSet.has(h.r * N + h.c);
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
