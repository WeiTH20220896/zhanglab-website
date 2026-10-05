/* Deposited M4–Gi cartoon coordinates: 7TRS (active), 5DSG (inactive).
 * Structural interpolation illustrates activation; it is not an MD trajectory.
 */
(() => {
    const assetUrl = new URL('../data/m4-gi-structure.json', document.currentScript.src);
    const panel = document.querySelector('.molecular-animation');
    if (!panel) return;
    const host = panel.querySelector('.gpcr-canvas');
    const viewport = panel.querySelector('.molecular-viewport');
    const phaseLabel = panel.querySelector('.molecular-phase');
    const detailLabel = panel.querySelector('.molecular-detail');
    const playback = panel.querySelector('.molecular-playback');
    const progress = panel.querySelector('.molecular-progress');
    const phases = [...panel.querySelectorAll('[data-phase]')];
    const chinese = panel.dataset.gpcrLanguage === 'zh';
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const labels = chinese ? {
        inactive: '非活化 M4 受体', binding: '乙酰胆碱识别', active: '跨膜螺旋构象变化', coupling: 'M4–Gi 偶联复合物',
        bindingDetail: 'ACh 的季铵氮朝向 D3.32；结合后保持解析结构中的取向',
        activeDetail: 'TM6 胞内端向外移动，形成 Gα 的结合界面',
        coupledDetail: 'Gα 的 α5 螺旋斜插入受体胞内口袋',
        pause: '暂停动画', play: '继续动画', unavailable: '三维结构暂时无法加载，请刷新页面'
    } : {
        inactive: 'Inactive M4 receptor', binding: 'Acetylcholine recognition', active: 'Transmembrane rearrangement', coupling: 'M4–Gi coupled complex',
        bindingDetail: 'ACh keeps its experimental pose, with the ammonium nitrogen facing D3.32',
        activeDetail: 'Intracellular TM6 moves outward to open the Gα interface',
        coupledDetail: 'The Gα α5 helix inserts obliquely into the intracellular pocket',
        pause: 'Pause animation', play: 'Resume animation', unavailable: 'The 3D structure is unavailable. Please refresh the page.'
    };
    const colors = { receptor: '#278b9b', alpha: '#9670bd', alpha5: '#6e429e', beta: '#54a88b', gamma: '#b4ce7e' };
    const duration = 32;
    const smooth = value => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };
    const segment = (time, start, end) => smooth((time - start) / (end - start));
    const coordinates = atoms => atoms.map(atom => [atom.x, atom.y, atom.z]);
    const average = atoms => atoms.reduce((s, a) => ({ x: s.x + a.x / atoms.length, y: s.y + a.y / atoms.length, z: s.z + a.z / atoms.length }), { x: 0, y: 0, z: 0 });

    async function initialize() {
        const response = await fetch(assetUrl);
        if (!response.ok) throw new Error(`Structure asset returned ${response.status}`);
        const data = await response.json();
        if (!window.$3Dmol) throw new Error('Molecular renderer is unavailable');
        const viewer = $3Dmol.createViewer(host, { backgroundColor: '#ffffff', backgroundAlpha: 0, antialias: true, nomouse: true, disableFog: true });
        const receptor = viewer.addModel(data.receptor, 'pdb', { keepH: false });
        const gProtein = viewer.addModel(data.gProtein, 'pdb', { keepH: false });
        const ligand = viewer.addModel(data.ligand, 'pdb', { keepH: false });
        const receptorAtoms = receptor.selectedAtoms({});
        const gAtoms = gProtein.selectedAtoms({});
        const ligandAtoms = ligand.selectedAtoms({});
        const receptorBase = coordinates(receptorAtoms), gBase = coordinates(gAtoms), ligandBase = coordinates(ligandAtoms);
        if (data.inactiveCoordinates.length !== receptorAtoms.length) throw new Error('Receptor atom counts do not match');
        const receptorStyle = { cartoon: { color: colors.receptor, thickness: 0.32, arrows: true } };
        const ligandStyle = {
            stick: { radius: 0.18, colorscheme: { C: '#66717c', N: '#346abd', O: '#cc4655' } },
            sphere: { radius: 0.34, colorscheme: { C: '#66717c', N: '#346abd', O: '#cc4655' } }
        };
        function styleG(opacity = 1) {
            gProtein.setStyle({ chain: 'A' }, { cartoon: { color: colors.alpha, thickness: 0.30, arrows: true, opacity } });
            gProtein.setStyle({ chain: 'A', resi: Array.from({ length: 26 }, (_, i) => 329 + i) }, { cartoon: { color: colors.alpha5, thickness: 0.34, arrows: true, opacity } });
            gProtein.setStyle({ chain: 'B' }, { cartoon: { color: colors.beta, thickness: 0.30, arrows: true, opacity } });
            gProtein.setStyle({ chain: 'G' }, { cartoon: { color: colors.gamma, thickness: 0.30, opacity } });
        }
        receptor.setStyle({}, receptorStyle);
        styleG();
        ligand.setStyle({}, ligandStyle);
        viewer.zoomTo();
        viewer.rotate(18, 'y');
        viewer.rotate(7, 'x');
        viewer.zoom(0.86);
        const finalView = viewer.getView();
        const d332 = average(receptor.selectedAtoms({ resi: 112, atom: 'CA' }));
        const alpha5Tip = average(gProtein.selectedAtoms({ chain: 'A', resi: 351, atom: 'CA' }));
        const residueLabel = viewer.addLabel('D3.32', { position: d332, fontSize: 10, fontColor: '#73527c', backgroundColor: '#ffffff', backgroundOpacity: 0.8, borderThickness: 0, inFront: true, hidden: true });
        const alpha5Label = viewer.addLabel('α5', { position: alpha5Tip, fontSize: 12, fontColor: colors.alpha5, backgroundColor: '#ffffff', backgroundOpacity: 0.85, borderThickness: 0, inFront: true, hidden: true });
        let paused = motionPreference.matches, time = paused ? 28.5 : 0, inView = true, visibleDocument = !document.hidden;
        let lastTimestamp = performance.now(), lastDraw = -Infinity, lastActivation = -1, lastReceptorOpacity = -1, lastCoupling = -1, lastLigandOffset = -1, lastPhase = '', raf = null;

        function draw(currentTime) {
            const bind = segment(currentTime, 3, 10), activation = segment(currentTime, 10, 18), coupling = segment(currentTime, 18, 26);
            // All matching backbone atoms interpolate in one coordinate frame,
            // so resolved loops meet helices without manual caps or joints.
            const receptorOpacity = 1 - 0.10 * segment(currentTime, 5, 8) * (1 - segment(currentTime, 13, 17));
            if (Math.abs(activation - lastActivation) > 0.004 || Math.abs(receptorOpacity - lastReceptorOpacity) > 0.015 || activation === 0 && lastActivation !== 0 || activation === 1 && lastActivation !== 1) {
                receptorAtoms.forEach((atom, i) => {
                    const a = data.inactiveCoordinates[i], b = receptorBase[i];
                    atom.x = a[0] + (b[0] - a[0]) * activation;
                    atom.y = a[1] + (b[1] - a[1]) * activation;
                    atom.z = a[2] + (b[2] - a[2]) * activation;
                });
                receptor.setStyle({}, { cartoon: { ...receptorStyle.cartoon, opacity: receptorOpacity } });
                lastActivation = activation;
                lastReceptorOpacity = receptorOpacity;
            }
            const ligandOffset = 28 * (1 - bind);
            if (Math.abs(ligandOffset - lastLigandOffset) > 0.02 || bind === 1 && lastLigandOffset !== 0) {
                ligandAtoms.forEach((atom, i) => {
                    // Translation only: the experimental N→D3.32 pose stays fixed.
                    atom.x = ligandBase[i][0] - 5 * (1 - bind);
                    atom.y = ligandBase[i][1] + ligandOffset;
                    atom.z = ligandBase[i][2] + 3 * (1 - bind);
                });
                if (!ligand.syncAtomPositions()) ligand.setStyle({}, ligandStyle);
                lastLigandOffset = ligandOffset;
            }
            if (currentTime < 17) {
                gProtein.hide(); lastCoupling = -1;
            } else {
                gProtein.show();
                if (Math.abs(coupling - lastCoupling) > 0.006 || coupling === 1 && lastCoupling !== 1) {
                    const displacement = 27 * (1 - coupling);
                    gAtoms.forEach((atom, i) => { atom.x = gBase[i][0]; atom.y = gBase[i][1] - displacement; atom.z = gBase[i][2]; });
                    styleG(0.15 + 0.85 * segment(currentTime, 17, 21));
                    lastCoupling = coupling;
                }
            }
            const pullback = segment(currentTime, 13, 25), view = finalView.slice();
            view[1] = -2 + (finalView[1] + 2) * pullback;
            view[3] = finalView[3] + 40 * (1 - pullback);
            viewer.setView(view);
            if (bind > 0.6 && currentTime < 16) residueLabel.show();
            else residueLabel.hide();
            if (coupling >= 0.96) alpha5Label.show();
            else alpha5Label.hide();
            viewer.render();
            const phase = currentTime < 3 ? 'inactive' : currentTime < 10 ? 'binding' : currentTime < 18 ? 'active' : 'coupling';
            if (phase !== lastPhase) {
                phaseLabel.textContent = labels[phase];
                phases.forEach(label => label.classList.toggle('is-active', label.dataset.phase === phase));
                lastPhase = phase;
            }
            detailLabel.textContent = phase === 'binding' ? labels.bindingDetail : phase === 'active' ? labels.activeDetail : phase === 'coupling' ? labels.coupledDetail : '';
            detailLabel.classList.toggle('is-visible', phase !== 'inactive');
            progress.style.setProperty('--gpcr-progress', (currentTime / duration).toFixed(4));
            viewport.style.setProperty('--scene-fade', Math.max(1 - segment(currentTime, 0, 0.7), segment(currentTime, 31.3, 32)).toFixed(3));
            panel.dataset.gpcrPhase = phase;
            panel.dataset.gpcrTime = currentTime.toFixed(2);
        }
        function tick(timestamp) {
            raf = null;
            if (paused || !inView || !visibleDocument) return;
            time = (time + Math.min((timestamp - lastTimestamp) / 1000, 0.25)) % duration;
            lastTimestamp = timestamp;
            if (timestamp - lastDraw >= 100) { draw(time); lastDraw = timestamp; }
            raf = requestAnimationFrame(tick);
        }
        function resumeLoop() {
            lastTimestamp = performance.now();
            if (raf === null && !paused && inView && visibleDocument) raf = requestAnimationFrame(tick);
        }
        playback.addEventListener('click', () => {
            paused = !paused;
            panel.classList.toggle('is-paused', paused);
            playback.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
            playback.setAttribute('aria-label', paused ? labels.play : labels.pause);
            playback.setAttribute('aria-pressed', String(paused));
            resumeLoop();
        });
        // Deterministic stage selection for inspecting structural transitions.
        panel.addEventListener('gpcr:seek', event => { time = Math.min(duration - 0.01, Math.max(0, Number(event.detail) || 0)); draw(time); lastTimestamp = performance.now(); });
        new IntersectionObserver(entries => { inView = entries[0].isIntersecting; resumeLoop(); }, { threshold: 0.04 }).observe(panel);
        document.addEventListener('visibilitychange', () => { visibleDocument = !document.hidden; resumeLoop(); });
        new ResizeObserver(() => { viewer.resize(); draw(time); }).observe(host);
        motionPreference.addEventListener('change', event => {
            paused = event.matches; playback.hidden = event.matches;
            if (event.matches) { time = 28.5; draw(time); }
            resumeLoop();
        });
        if (motionPreference.matches) playback.hidden = true;
        draw(time);
        panel.classList.add('is-webgl-ready');
        resumeLoop();
    }
    initialize().catch(error => {
        panel.querySelector('.molecular-fallback span').textContent = labels.unavailable;
        console.warn('GPCR structure could not initialize.', error);
    });
})();
