/**
 * ブロックスの3D表示 — 溝の付いた樹脂の盤に、半透明感のある樹脂ブロック。
 * 2D盤面: .blokus-board-container / #blokus-grid > .blk-cell(196)
 *   .filled-p1|.filled-p2、.preview-valid|.preview-invalid、.start-p1|.start-p2
 *   セルの mouseenter でプレビュー位置を変え、click で置く。
 */
(function () {
  const N = 14;
  const STEP = 0.62;

  window.BoardArena3D.registerAdapter('blokus', (THREE, container, api) => {
    const boardContainer = container.querySelector('.blokus-board-container');
    const gridEl = container.querySelector('#blokus-grid');
    if (!boardContainer || !gridEl) return null;

    const st = api.createStage(THREE, boardContainer, { radius: 17, phi: 0.6, extent: 5, tableY: -0.36, compact: true });
    const { kit, geo, root, markers } = st;

    // ---- 盤 ----
    const span = N * STEP;
    const base = new THREE.Mesh(geo.slab(span + 0.7, span + 0.7, 0.36, { bevel: 0.06, radius: 0.2 }), kit.lacquer('#3d4046', { roughness: 0.55, clearcoat: 0.2 }));
    base.position.y = -0.18;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const gridCanvas = api.canvas.cached('blokus-grid', 1024, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#2f3237';
      ctx.fillRect(0, 0, w, h);
      const s = w / N;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const x = c * s + 3;
          const y = r * s + 3;
          const g = ctx.createLinearGradient(x, y, x, y + s - 6);
          g.addColorStop(0, '#5b5f66');
          g.addColorStop(1, '#4e5258');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, s - 6, s - 6);
        }
      }
    });
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: kit.texture(gridCanvas), roughness: 0.62, envMapIntensity: 0.5 })
    );
    surface.position.y = 0.002;
    surface.receiveShadow = true;
    root.add(surface);

    // ---- ブロック ----
    const blockGeo = geo.cached('blk-block', () => geo.roundedBox(STEP * 0.94, 0.2, STEP * 0.94, 0.045, 3));
    const plastic = (hex) => new THREE.MeshPhysicalMaterial({
      color: kit.color(hex),
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      envMapIntensity: 0.9
    });
    const mats = {
      p1: plastic('#5b4a96'),
      p2: plastic('#cf7a2b'),
      pv: kit.ghostSolid('#f4ede1', 0.45),
      pi: kit.ghostSolid('#c0392b', 0.45)
    };

    const pos = (r, c) => ({ x: (c - (N - 1) / 2) * STEP, z: (r - (N - 1) / 2) * STEP });
    const cells = () => gridEl.querySelectorAll('.blk-cell');

    st.gridPicker({
      rows: N,
      cols: N,
      step: STEP,
      y: 0.01,
      clickable: () => !!gridEl.querySelector('.preview-valid'),
      onHover: (r, c) => {
        const cell = cells()[r * N + c];
        if (cell) cell.dispatchEvent(new MouseEvent('mouseenter'));
      },
      onClick: (r, c) => {
        const cell = cells()[r * N + c];
        if (cell) cell.click();
      }
    });

    // ---- 同期 ----
    const meshes = new Array(N * N).fill(null);
    const states = new Array(N * N).fill(null);
    const startGroup = new THREE.Group();
    root.add(startGroup);
    let first = true;

    function sync() {
      const list = cells();
      if (list.length < N * N) return;
      st.clearGroup(startGroup);
      let placedOrder = 0;

      list.forEach((cell, i) => {
        const cl = cell.classList;
        const s = cl.contains('filled-p1') ? 'p1' : cl.contains('filled-p2') ? 'p2'
          : cl.contains('preview-valid') ? 'pv' : cl.contains('preview-invalid') ? 'pi' : null;
        const p = pos(Math.floor(i / N), i % N);

        if (cl.contains('start-p1') || cl.contains('start-p2')) {
          const dot = markers.dot(0.12, cl.contains('start-p1') ? '#8f7fd0' : '#e39a52', 0.9);
          dot.position.set(p.x, 0.006, p.z);
          startGroup.add(dot);
        }

        if (s === states[i]) return;
        const wasPreview = states[i] === 'pv' || states[i] === 'pi';
        states[i] = s;
        if (meshes[i]) {
          st.removeObject(meshes[i]);
          meshes[i] = null;
        }
        if (!s) return;

        const isPreview = s === 'pv' || s === 'pi';
        const m = new THREE.Mesh(blockGeo, mats[s]);
        m.userData.sharedMaterial = true;
        m.castShadow = !isPreview;
        m.receiveShadow = !isPreview;
        m.position.set(p.x, isPreview ? 0.16 : 0.1, p.z);
        root.add(m);
        meshes[i] = m;
        if (!isPreview && !first) {
          m.position.y = wasPreview ? 0.16 : 0.9;
          st.animate(m, { position: { y: 0.1 } }, { duration: 300, delay: (placedOrder++) * 30, ease: 'outBounce' });
        }
      });
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
