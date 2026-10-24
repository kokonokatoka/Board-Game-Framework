/**
 * ポーカーの3D表示 — 革張りのレールが付いた楕円のフェルトテーブルに、紙のカードとクレイチップ。
 * 2D盤面: .pk-table (#pk-opp-cards, #pk-my-cards > .pk-card(.back, .selected) > .pk-c-rank / .pk-c-suit,
 *         #pk-pot, #pk-banner, #pk-hand-name, #pk-opp-chips, #pk-my-chips)
 */
(function () {
  const RX = 6.2;
  const RZ = 3.9;
  const CARD_W = 1.16;
  const CARD_H = 1.64;
  const SUITS = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };

  // スート記号を図形で描く (環境依存の絵文字グリフを避ける)
  function drawSuit(ctx, suit, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 100, s / 100);
    ctx.beginPath();
    if (suit === 'h') {
      ctx.moveTo(0, 38);
      ctx.bezierCurveTo(-60, -5, -48, -55, 0, -28);
      ctx.bezierCurveTo(48, -55, 60, -5, 0, 38);
    } else if (suit === 'd') {
      ctx.moveTo(0, -50);
      ctx.quadraticCurveTo(22, -18, 38, 0);
      ctx.quadraticCurveTo(22, 18, 0, 50);
      ctx.quadraticCurveTo(-22, 18, -38, 0);
      ctx.quadraticCurveTo(-22, -18, 0, -50);
    } else if (suit === 's') {
      ctx.moveTo(0, -48);
      ctx.bezierCurveTo(52, -8, 58, 34, 14, 26);
      ctx.quadraticCurveTo(10, 40, 20, 50);
      ctx.lineTo(-20, 50);
      ctx.quadraticCurveTo(-10, 40, -14, 26);
      ctx.bezierCurveTo(-58, 34, -52, -8, 0, -48);
    } else {
      ctx.arc(0, -24, 20, 0, Math.PI * 2);
      ctx.moveTo(-22, 8);
      ctx.arc(-22, 8, 20, 0, Math.PI * 2);
      ctx.moveTo(22, 8);
      ctx.arc(22, 8, 20, 0, Math.PI * 2);
      ctx.moveTo(-6, 10);
      ctx.quadraticCurveTo(-4, 40, -18, 50);
      ctx.lineTo(18, 50);
      ctx.quadraticCurveTo(4, 40, 6, 10);
    }
    ctx.fill();
    ctx.restore();
  }

  window.BoardArena3D.registerAdapter('poker', (THREE, container, api) => {
    const tableEl = container.querySelector('.pk-table');
    const myCardsEl = container.querySelector('#pk-my-cards');
    const oppCardsEl = container.querySelector('#pk-opp-cards');
    if (!tableEl || !myCardsEl || !oppCardsEl) return null;
    const text = (sel) => {
      const el = container.querySelector(sel);
      return el ? el.textContent.replace(/[🪙🤖]/gu, '').trim() : '';
    };

    const st = api.createStage(THREE, tableEl, { radius: 14.4, phi: 0.8, lookY: -0.2, extent: 6.6, tableY: -0.9, fov: 36, hudLeft: true });
    const { kit, geo, root } = st;

    // ---- テーブル ----
    const ellipse = (rx, rz) => {
      const s = new THREE.Shape();
      s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false);
      return s;
    };
    const feltCanvas = api.canvas.cached('pk-felt', 1024, 640, (ctx, w, h) => {
      api.canvas.paintNoise(ctx, w, h, '#1d4a37', 12, 33, 3800);
      ctx.strokeStyle = 'rgba(226, 196, 132, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.36, h * 0.33, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    const feltTex = kit.texture(feltCanvas);
    const feltGeo = new THREE.ShapeGeometry(ellipse(RX, RZ), 96);
    // ShapeGeometry の UV はワールド座標なので 0..1 に直す
    const uv = feltGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + RX) / (RX * 2), (uv.getY(i) + RZ) / (RZ * 2));
    feltGeo.rotateX(-Math.PI / 2);
    const felt = new THREE.Mesh(feltGeo, new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95, envMapIntensity: 0.3 }));
    felt.receiveShadow = true;
    root.add(felt);

    const railShape = ellipse(RX + 0.75, RZ + 0.75);
    railShape.holes.push((() => { const p = new THREE.Path(); p.absellipse(0, 0, RX - 0.02, RZ - 0.02, 0, Math.PI * 2, true); return p; })());
    const railGeo = new THREE.ExtrudeGeometry(railShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.3, bevelSegments: 6, curveSegments: 96 });
    railGeo.rotateX(-Math.PI / 2);
    const leather = new THREE.MeshStandardMaterial({ map: kit.texture(api.canvas.grain('#1c1917', 14), { repeat: 3 }), roughness: 0.55, envMapIntensity: 0.6 });
    const rail = new THREE.Mesh(railGeo, leather);
    rail.position.y = 0.06;
    rail.castShadow = true;
    rail.receiveShadow = true;
    root.add(rail);

    const apron = new THREE.Mesh(
      (() => { const g = new THREE.ExtrudeGeometry(ellipse(RX + 0.9, RZ + 0.9), { depth: 0.7, bevelEnabled: false, curveSegments: 96 }); g.rotateX(-Math.PI / 2); return g; })(),
      kit.wood('darkWalnut', { repeat: 0.3 })
    );
    apron.position.y = -0.78;
    apron.receiveShadow = true;
    root.add(apron);

    // ---- カード ----
    const cardShape = geo.roundedRectShape(CARD_W, CARD_H, 0.09);
    const faceGeo = (() => {
      const g = new THREE.ShapeGeometry(cardShape, 8);
      const a = g.attributes.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, (a.getX(i) + CARD_W / 2) / CARD_W, (a.getY(i) + CARD_H / 2) / CARD_H);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const edgeGeo = geo.slab(CARD_W, CARD_H, 0.016, { bevel: 0.004, radius: 0.09 });
    const edgeMat = kit.matte('#f1ece2', { roughness: 0.7 });

    const backCanvas = api.canvas.cached('pk-back', 290, 410, (ctx, w, h) => {
      ctx.fillStyle = '#f4efe5';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#20314f';
      ctx.fillRect(16, 16, w - 32, h - 32);
      ctx.strokeStyle = 'rgba(220, 200, 160, 0.5)';
      ctx.lineWidth = 1.2;
      for (let i = -h; i < w + h; i += 12) {
        ctx.beginPath();
        ctx.moveTo(i, 16);
        ctx.lineTo(i + h, h - 16);
        ctx.moveTo(i + h, 16);
        ctx.lineTo(i, h - 16);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(220, 200, 160, 0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, w - 48, h - 48);
    });
    const backMat = new THREE.MeshStandardMaterial({ map: kit.texture(backCanvas), roughness: 0.5, envMapIntensity: 0.5 });

    const faceMats = new Map();
    function faceMaterial(rank, suitChar) {
      const suit = SUITS[suitChar] || 's';
      const key = `${rank}${suit}`;
      if (faceMats.has(key)) return faceMats.get(key);
      const red = suit === 'h' || suit === 'd';
      const c = api.canvas.cached(`pk-face:${key}`, 290, 410, (ctx, w, h) => {
        ctx.fillStyle = '#f6f1e7';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = red ? '#a3241c' : '#1b1a19';
        ctx.font = '400 54px Marcellus, "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const corner = (flip) => {
          ctx.save();
          if (flip) {
            ctx.translate(w, h);
            ctx.rotate(Math.PI);
          }
          ctx.fillText(rank, 40, 66);
          drawSuit(ctx, suit, 40, 96, 34);
          ctx.restore();
        };
        corner(false);
        corner(true);
        drawSuit(ctx, suit, w / 2, h / 2, 130);
      });
      const mat = new THREE.MeshStandardMaterial({ map: kit.texture(c), roughness: 0.45, envMapIntensity: 0.6 });
      faceMats.set(key, mat);
      return mat;
    }

    function createCard(cardEl) {
      const g = new THREE.Group();
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.castShadow = true;
      edge.receiveShadow = true;
      g.add(edge);
      const isBack = cardEl.classList.contains('back');
      const rankEl = cardEl.querySelector('.pk-c-rank');
      const suitEl = cardEl.querySelector('.pk-c-suit');
      const top = new THREE.Mesh(faceGeo, isBack ? backMat : faceMaterial(rankEl ? rankEl.textContent.trim() : '', suitEl ? suitEl.textContent.trim() : '♠'));
      top.position.y = 0.0085;
      top.userData.sharedMaterial = true;
      const bottom = new THREE.Mesh(faceGeo, backMat);
      bottom.rotation.x = Math.PI;
      bottom.position.y = -0.0085;
      bottom.userData.sharedMaterial = true;
      g.add(top, bottom);
      g.userData.sig = `${cardEl.className}|${cardEl.textContent}`;
      return g;
    }

    // ---- チップ ----
    const chipCanvas = api.canvas.cached('pk-chip-edge', 512, 32, (ctx, w, h) => {
      ctx.fillStyle = '#8c2a22';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#efe8d9';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * (w / 8) + 10, 0, 22, h);
    });
    const chipTopCanvas = api.canvas.cached('pk-chip-top', 256, 256, (ctx, w) => {
      ctx.fillStyle = '#8c2a22';
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#efe8d9';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(w / 2, w / 2);
        ctx.rotate((i / 8) * Math.PI * 2);
        ctx.fillRect(-10, -w / 2, 20, 26);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(239, 232, 217, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    });
    const chipMats = [
      new THREE.MeshStandardMaterial({ map: kit.texture(chipCanvas), roughness: 0.55, envMapIntensity: 0.5 }),
      new THREE.MeshStandardMaterial({ map: kit.texture(chipTopCanvas), roughness: 0.5, envMapIntensity: 0.5 }),
      new THREE.MeshStandardMaterial({ map: kit.texture(chipTopCanvas), roughness: 0.5, envMapIntensity: 0.5 })
    ];
    const chipGeo = geo.cached('pk-chip', () => new THREE.CylinderGeometry(0.3, 0.3, 0.07, 48));
    const potGroup = new THREE.Group();
    root.add(potGroup);
    let potChips = -1;

    function setPot(amount) {
      const n = Math.min(24, Math.ceil(amount / 20));
      if (n === potChips) return;
      const prev = potChips;
      potChips = n;
      st.clearGroup(potGroup);
      const stacks = [[-0.38, 0.1], [0.36, -0.06], [0, 0.48]];
      for (let i = 0; i < n; i++) {
        const [sx, sz] = stacks[i % 3];
        const chip = new THREE.Mesh(chipGeo, chipMats);
        chip.userData.sharedMaterial = true;
        chip.castShadow = true;
        chip.receiveShadow = true;
        const y = 0.036 + Math.floor(i / 3) * 0.072;
        chip.position.set(sx + (Math.random() - 0.5) * 0.03, y, sz + (Math.random() - 0.5) * 0.03);
        chip.rotation.y = Math.random() * Math.PI;
        potGroup.add(chip);
        if (prev >= 0 && i >= prev) {
          chip.position.y = y + 1.2;
          st.animate(chip, { position: { y } }, { duration: 340, delay: (i - prev) * 50, ease: 'outBounce' });
        }
      }
    }

    // ---- ラベル ----
    const potLabel = st.label('', { className: 'is-strong' }).at(0, 0.2, -0.55);
    const bannerLabel = st.label('', { className: 'is-plain' }).at(0, 0.2, -1.05);
    const handLabel = st.label('', {}).at(0, 0.2, 1.05);
    const oppLabel = st.label('', { className: 'is-plain' }).at(0, 0.2, -RZ + 0.25);
    const myLabel = st.label('', { className: 'is-plain' }).at(0, 0.2, RZ - 0.15);

    // ---- 同期 ----
    const rows = { my: [], opp: [] };

    function syncRow(listEl, key, z, interactive) {
      const els = Array.from(listEl.querySelectorAll('.pk-card'));
      const row = rows[key];
      els.forEach((el, i) => {
        const x = (i - (els.length - 1) / 2) * (CARD_W + 0.24);
        const selected = el.classList.contains('selected');
        let card = row[i];
        let flipFrom = null;
        const sig = `${el.className}|${el.textContent}`;
        if (card && card.userData.sig !== sig) {
          const faceChanged = card.userData.sig.replace(' selected', '') !== sig.replace(' selected', '');
          if (faceChanged) {
            // 裏向きから表になっただけなら、その場で裏返す
            if (card.userData.sig.includes('back') && !sig.includes('back')) flipFrom = card.position.clone();
            st.removeObject(card);
            card = null;
          } else {
            card.userData.sig = sig;
          }
        }
        if (!card) {
          card = createCard(el);
          root.add(card);
          row[i] = card;
          if (flipFrom) {
            card.position.copy(flipFrom);
            card.rotation.set(0, card.rotation.y, Math.PI);
            st.animate(card, { rotation: { z: 0 }, position: { x, y: 0.02, z } }, { duration: 480, delay: i * 110, arc: 0.7, ease: 'inOutCubic' });
          } else {
            // 山札 (テーブル右奥) から配る
            card.position.set(RX - 1.6, 0.4, -RZ + 1.2);
            card.rotation.set(0, 0.6, Math.PI);
            st.animate(card, {
              position: { x, y: 0.02, z },
              rotation: { x: 0, y: (Math.random() - 0.5) * 0.06, z: 0 }
            }, { duration: 520, delay: i * 90, arc: 0.6, ease: 'outCubic' });
          }
        } else {
          st.animate(card, { position: { x, y: selected ? 0.32 : 0.02, z: selected ? z - 0.35 : z } }, { duration: 220, ease: 'outCubic' });
        }
        if (interactive) {
          st.pick(card, {
            onHover: () => { if (!card.userData._tween) card.position.y = (el.classList.contains('selected') ? 0.32 : 0.02) + 0.08; },
            onLeave: () => { if (!card.userData._tween) card.position.y = el.classList.contains('selected') ? 0.32 : 0.02; },
            onClick: () => el.click()
          });
        }
      });
      while (row.length > els.length) st.removeObject(row.pop());
    }

    function sync() {
      syncRow(myCardsEl, 'my', 2.15, true);
      syncRow(oppCardsEl, 'opp', -2.35, false);
      const potText = text('#pk-pot');
      setPot(parseInt(potText.replace(/[^0-9]/g, ''), 10) || 0);
      potLabel.set(potText.replace('POT:', 'ポット'));
      bannerLabel.set(text('#pk-banner'));
      handLabel.set(text('#pk-hand-name'));
      const oppName = container.querySelector('.pk-player-area.opp .pk-p-name');
      oppLabel.set(`${oppName ? oppName.textContent.replace(/[🤖]/gu, '').trim() : '相手'}　${text('#pk-opp-chips')}`);
      myLabel.set(`あなた　${text('#pk-my-chips')}`);
    }

    sync();
    return { st, sync };
  });
})();
