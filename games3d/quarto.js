/**
 * クアルトの3D表示 — 丸いウォルナット盤に、明るい木・濃い木で削った16種の駒。
 * 2D盤面: .qrt-board-frame / #qrt-board > .qrt-cell(16, .win-highlight)
 *         > .qrt-piece(.light|.dark, .round|.square, .short|.tall, .hollow)
 */
(function () {
  const SP = 1.45;
  const BOARD_R = 3.95;

  window.BoardArena3D.registerAdapter('quarto', (THREE, container, api) => {
    const frameEl = container.querySelector('.qrt-board-frame');
    const boardEl = container.querySelector('#qrt-board');
    if (!frameEl || !boardEl) return null;

    const st = api.createStage(THREE, frameEl, { radius: 12.4, phi: 0.78, lookY: 0.4, extent: 4.4, tableY: -0.4 });
    const { kit, geo, root, markers } = st;

    // ---- 盤 ----
    const boardMat = kit.wood('darkWalnut', { repeat: 0.18 });
    const board = new THREE.Mesh(geo.disc(BOARD_R, 0.4, 0.07, 96), boardMat);
    board.position.y = -0.2;
    board.castShadow = true;
    board.receiveShadow = true;
    root.add(board);

    // 回転体の上面は木目が渦になるので、平らな円を重ねて木目をまっすぐ見せる
    const top = new THREE.Mesh(
      geo.cached('qrt-top', () => new THREE.CircleGeometry(BOARD_R - 0.07, 96).rotateX(-Math.PI / 2)),
      kit.wood('darkWalnut', { repeat: 1, seed: 8 })
    );
    top.position.y = 0.0015;
    top.receiveShadow = true;
    root.add(top);

    const inlayMat = kit.wood('maple', { repeat: 0.8, seed: 77 });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(BOARD_R - 0.28, 0.022, 8, 128).rotateX(Math.PI / 2), inlayMat);
    outerRing.position.y = 0.004;
    root.add(outerRing);

    const pos = (r, c) => ({ x: (c - 1.5) * SP, z: (r - 1.5) * SP });
    const recessGeo = geo.cached('qrt-recess', () => new THREE.CircleGeometry(0.6, 48).rotateX(-Math.PI / 2));
    const recessMat = kit.matte('#24170f', { roughness: 0.8 });
    const ringGeo = geo.cached('qrt-ring', () => new THREE.TorusGeometry(0.6, 0.014, 8, 64).rotateX(Math.PI / 2));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const p = pos(r, c);
        const recess = new THREE.Mesh(recessGeo, recessMat);
        recess.position.set(p.x, 0.003, p.z);
        recess.receiveShadow = true;
        root.add(recess);
        const ring = new THREE.Mesh(ringGeo, inlayMat);
        ring.position.set(p.x, 0.004, p.z);
        root.add(ring);
      }
    }

    // ---- 駒 ----
    const woodLight = kit.wood('maple', { repeat: 1.6, seed: 51, vertical: true, clearcoat: 0.45 });
    const woodDark = kit.wood('cherry', { repeat: 1.6, seed: 52, vertical: true, clearcoat: 0.45 });
    const holeMat = kit.matte('#1a110b', { roughness: 0.9 });

    function roundGeo(h, hollow) {
      return geo.cached(`qrt-round:${h}:${hollow}`, () => {
        const R = 0.42;
        const b = 0.05;
        const pts = [[0, 0], [R - b, 0], [R, b], [R, h - b], [R - b, h]];
        if (hollow) {
          const ri = 0.22;
          pts.push([ri + 0.03, h], [ri, h - 0.03], [ri, h - 0.24], [0, h - 0.24]);
        } else {
          pts.push([0, h]);
        }
        return geo.lathe(pts, 56);
      });
    }

    function squareGeo(h, hollow) {
      return geo.cached(`qrt-square:${h}:${hollow}`, () => {
        const s = 0.76;
        const g = geo.slab(s, s, h, {
          bevel: 0.04,
          radius: 0.08,
          holes: hollow ? [geo.circlePath(0, 0, 0.26)] : []
        });
        g.translate(0, h / 2, 0);
        return g;
      });
    }

    function createPiece(el) {
      const light = el.classList.contains('light');
      const round = el.classList.contains('round');
      const tall = el.classList.contains('tall');
      const hollow = el.classList.contains('hollow');
      const h = tall ? 1.5 : 0.86;
      const mat = light ? woodLight : woodDark;
      const holder = new THREE.Group();
      const body = new THREE.Group();
      const main = new THREE.Mesh(round ? roundGeo(h, hollow) : squareGeo(h, hollow), mat);
      main.castShadow = true;
      main.receiveShadow = true;
      body.add(main);
      if (hollow && !round) {
        // 角柱の穴は底を作る
        const floor = new THREE.Mesh(geo.cached('qrt-floor', () => new THREE.CircleGeometry(0.25, 32).rotateX(-Math.PI / 2)), holeMat);
        floor.position.y = h - 0.24;
        body.add(floor);
      }
      if (hollow && round) {
        const floor = new THREE.Mesh(geo.cached('qrt-rfloor', () => new THREE.CircleGeometry(0.23, 32).rotateX(-Math.PI / 2)), holeMat);
        floor.position.y = h - 0.238;
        body.add(floor);
      }
      const shadow = markers.contact(1.3, 1.3, 0.55);
      shadow.position.y = 0.006;
      holder.add(shadow, body);
      holder.userData.body = body;
      holder.userData.sig = el.className;
      return holder;
    }

    // ---- 印 ----
    const winGroup = new THREE.Group();
    root.add(winGroup);
    const hoverRing = markers.ring(0.62, 0.68, '#f4ede1', 0.7);
    hoverRing.visible = false;
    root.add(hoverRing);

    const cells = () => boardEl.querySelectorAll('.qrt-cell');
    const isEmpty = (r, c) => {
      const cell = cells()[r * 4 + c];
      return !!cell && !cell.querySelector('.qrt-piece');
    };

    const picker = st.gridPicker({
      rows: 4,
      cols: 4,
      step: SP,
      y: 0.01,
      clickable: isEmpty,
      onHover: (r, c) => {
        hoverRing.visible = isEmpty(r, c);
        const p = pos(r, c);
        hoverRing.position.set(p.x, 0.008, p.z);
      },
      onLeave: () => { hoverRing.visible = false; },
      onClick: (r, c) => {
        const cell = cells()[r * 4 + c];
        if (cell) cell.click();
      }
    });

    // ---- 同期 ----
    const pieces = new Array(16).fill(null);
    let first = true;

    function sync() {
      const list = cells();
      if (list.length < 16) return;
      st.clearGroup(winGroup);
      list.forEach((cell, i) => {
        const el = cell.querySelector('.qrt-piece');
        const p = pos(Math.floor(i / 4), i % 4);
        if (pieces[i] && (!el || pieces[i].userData.sig !== el.className)) {
          st.removeObject(pieces[i]);
          pieces[i] = null;
        }
        if (el && !pieces[i]) {
          const holder = createPiece(el);
          holder.position.set(p.x, 0, p.z);
          root.add(holder);
          pieces[i] = holder;
          if (!first) {
            holder.userData.body.position.y = 1.6;
            st.animate(holder.userData.body, { position: { y: 0 } }, { duration: 420, ease: 'outBounce' });
          }
        }
        if (cell.classList.contains('win-highlight')) {
          const ring = markers.ring(0.66, 0.74, '#e2b867', 0.95);
          ring.position.set(p.x, 0.01, p.z);
          winGroup.add(ring);
        }
      });
      const h = picker.hovered;
      hoverRing.visible = !!h && isEmpty(h.r, h.c);
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
