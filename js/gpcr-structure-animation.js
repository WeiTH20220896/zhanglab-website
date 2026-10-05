/* Deposited M4–Gi cartoon coordinates: 7TRS (active), 5DSG (inactive).
 * Structural interpolation illustrates activation; it is not an MD trajectory.
 */
(() => {
    const scriptUrl = new URL(document.currentScript.src);
    const assetUrl = new URL('../data/m4-gi-structure.json', scriptUrl);
    assetUrl.search = scriptUrl.search;
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
        pocket: 'ACh · 正构结合口袋', interface: 'α5 · 胞内偶联界面',
        pause: '暂停动画', play: '继续动画', unavailable: '三维结构暂时无法加载，请刷新页面'
    } : {
        inactive: 'Inactive M4 receptor', binding: 'Acetylcholine recognition', active: 'Transmembrane rearrangement', coupling: 'M4–Gi coupled complex',
        bindingDetail: 'ACh keeps its experimental pose, with the ammonium nitrogen facing D3.32',
        activeDetail: 'Intracellular TM6 moves outward to open the Gα interface',
        coupledDetail: 'The Gα α5 helix inserts obliquely into the intracellular pocket',
        pocket: 'ACh · Orthosteric pocket', interface: 'α5 · Coupling interface',
        pause: 'Pause animation', play: 'Resume animation', unavailable: 'The 3D structure is unavailable. Please refresh the page.'
    };
    const colors = { receptor: '#278b9b', alpha: '#9670bd', alpha5: '#6e429e', beta: '#54a88b', gamma: '#b4ce7e' };
    const duration = 38;
    const smooth = value => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };
    const segment = (time, start, end) => smooth((time - start) / (end - start));
    const coordinates = atoms => atoms.map(atom => [atom.x, atom.y, atom.z]);
    const average = atoms => atoms.reduce((s, a) => ({ x: s.x + a.x / atoms.length, y: s.y + a.y / atoms.length, z: s.z + a.z / atoms.length }), { x: 0, y: 0, z: 0 });

    // The pinned renderer exposes cached scene geometry. Keep this adaptation
    // here so animation does not repeatedly regenerate ribbon meshes.
    function geometryGroups(root) {
        const result = [];
        function visit(node) {
            if (node.geometry) node.geometry.geometryGroups.forEach(group => result.push({ geometry: node.geometry, group, material: node.material }));
            (node.children || []).forEach(visit);
        }
        if (root) visit(root);
        return result;
    }
    function setOpacity(groups, opacity) {
        groups.forEach(({ material }) => {
            material.opacity = opacity;
            material.transparent = opacity < 0.999;
            material.depthWrite = opacity >= 0.999;
        });
    }
    function interpolateView(from, to, amount, result) {
        for (let i = 0; i < 4; i++) result[i] = from[i] + (to[i] - from[i]) * amount;
        let dot = 0;
        for (let i = 4; i < 8; i++) dot += from[i] * to[i];
        const sign = dot < 0 ? -1 : 1;
        dot = Math.min(1, Math.abs(dot));
        const angle = Math.acos(dot), sine = Math.sin(angle);
        const a = sine < 0.001 ? 1 - amount : Math.sin((1 - amount) * angle) / sine;
        const b = sine < 0.001 ? amount : Math.sin(amount * angle) / sine;
        let length = 0;
        for (let i = 4; i < 8; i++) { result[i] = from[i] * a + to[i] * b * sign; length += result[i] ** 2; }
        length = Math.sqrt(length);
        for (let i = 4; i < 8; i++) result[i] /= length;
    }

    async function initialize() {
        const response = await fetch(assetUrl);
        if (!response.ok) throw new Error(`Structure asset returned ${response.status}`);
        const data = await response.json();
        if (!window.$3Dmol) throw new Error('Molecular renderer is unavailable');
        // Seven spline subdivisions retain smooth helices at this panel size
        // while cutting ribbon tessellation by about half versus the default 10.
        const viewer = $3Dmol.createViewer(host, {
            backgroundColor: '#ffffff', backgroundAlpha: 0, antialias: true,
            nomouse: true, disableFog: true,
            cartoonQuality: window.matchMedia('(max-width: 680px)').matches ? 6 : 7
        });
        const receptor = viewer.addModel(data.receptor, 'pdb', { keepH: false });
        const gProtein = viewer.addModel(data.gProtein, 'pdb', { keepH: false });
        const ligand = viewer.addModel(data.ligand, 'pdb', { keepH: false });
        const bindingSite = viewer.addModel(data.bindingSite, 'pdb', { keepH: false });
        const receptorAtoms = receptor.selectedAtoms({});
        const gAtoms = gProtein.selectedAtoms({});
        const ligandAtoms = ligand.selectedAtoms({});
        const bindingAtoms = bindingSite.selectedAtoms({});
        const bindingBase = coordinates(bindingAtoms);
        const receptorBase = coordinates(receptorAtoms), gBase = coordinates(gAtoms), ligandBase = coordinates(ligandAtoms);
        if (data.inactiveCoordinates.length !== receptorAtoms.length) throw new Error('Receptor atom counts do not match');
        const receptorStyle = { cartoon: { color: colors.receptor, thickness: 0.32, arrows: true } };
        const ligandStyle = {
            stick: { radius: 0.18, colorscheme: { C: '#66717c', N: '#346abd', O: '#cc4655' } },
            sphere: { radius: 0.43, colorscheme: { C: '#66717c', N: '#346abd', O: '#cc4655' } }
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
        bindingSite.setStyle({}, {
            stick: { radius: 0.13, colorscheme: { C: '#77969a', O: '#cc4655' } },
            sphere: { radius: 0.28, colorscheme: { C: '#77969a', O: '#cc4655' } }
        });
        viewer.render();
        const activeGroups = geometryGroups(receptor.renderedMolObj);
        const activeBuffers = activeGroups.map(({ group }) => ({ positions: group.vertexArray.slice(), normals: group.normalArray.slice(), faces: group.faceArray.slice() }));
        receptorAtoms.forEach((atom, i) => { [atom.x, atom.y, atom.z] = data.inactiveCoordinates[i]; });
        receptor.setStyle({}, receptorStyle);
        viewer.render();
        const receptorGroups = geometryGroups(receptor.renderedMolObj);
        const morphBuffers = receptorGroups.map(({ group }, i) => ({
            initialPositions: group.vertexArray.slice(), initialNormals: group.normalArray.slice(), target: activeBuffers[i]
        }));
        const canMorph = receptorGroups.length === activeBuffers.length && receptorGroups.every(({ group }, i) => {
            const target = activeBuffers[i];
            return target && group.vertexArray.length === target.positions.length && group.normalArray.length === target.normals.length &&
                group.faceArray.length === target.faces.length && group.faceArray.every((face, index) => face === target.faces[index]);
        });
        const gGroups = geometryGroups(gProtein.renderedMolObj);

        // Derive camera centers and scale from the selected structural regions.
        // The complex stays in one world coordinate frame; only the view rotates.
        function captureView(selection, scale, x, y, z = -4) {
            viewer.setView([0, 0, 0, 0, 0, 0, 0, 1]);
            viewer.zoomTo(selection);
            viewer.rotate(y, 'y'); viewer.rotate(x, 'x'); viewer.rotate(z, 'z');
            viewer.zoom(scale);
            return viewer.getView();
        }
        const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const overviewView = captureView({ model: 0 }, 0.85, 8, -26);
        const pocketView = captureView({ model: 0, resi: [...range(108, 117), ...range(408, 415), ...range(436, 442)] }, 0.54, 25, -44);
        const interfaceView = captureView({ model: 0, resi: [...range(129, 136), ...range(392, 401), ...range(446, 454)] }, 0.52, -10, -30);
        const complexView = captureView({}, 0.85, 6, -18, -3);
        const arrivalView = complexView.slice();
        arrivalView[1] += 7;
        arrivalView[3] -= 24;
        const cameraFrames = [
            { t: 0, view: overviewView }, { t: 3, view: overviewView },
            { t: 7.5, view: pocketView }, { t: 12, view: pocketView },
            { t: 18, view: overviewView }, { t: 21, view: arrivalView },
            { t: 26, view: complexView }, { t: 29, view: interfaceView },
            { t: 31, view: interfaceView }, { t: 34, view: complexView },
            { t: 38, view: complexView }
        ];
        const currentView = complexView.slice();
        const d332 = average(bindingSite.selectedAtoms({ atom: ['OD1', 'OD2'] }));
        const boundNitrogen = ligandAtoms.find(atom => atom.elem === 'N');
        const alpha5Tip = average(gProtein.selectedAtoms({ chain: 'A', resi: 351, atom: 'CA' }));
        const residueLabel = viewer.addLabel('D3.32', { position: { x: d332.x - 3.5, y: d332.y, z: d332.z + 1.5 }, fontSize: 14, fontColor: '#73527c', backgroundColor: '#ffffff', backgroundOpacity: 0.9, borderThickness: 0, inFront: true });
        const alpha5Label = viewer.addLabel('α5', { position: { x: alpha5Tip.x + 3, y: alpha5Tip.y, z: alpha5Tip.z }, fontSize: 15, fontColor: colors.alpha5, backgroundColor: '#ffffff', backgroundOpacity: 0.9, borderThickness: 0, inFront: true });
        const nitrogenLabel = viewer.addLabel('N⁺', { position: { x: boundNitrogen.x + 2.6, y: boundNitrogen.y + 1.7, z: boundNitrogen.z }, fontSize: 13, fontColor: '#346abd', backgroundColor: '#ffffff', backgroundOpacity: 0.8, borderThickness: 0, inFront: true });
        let paused = motionPreference.matches, time = paused ? 35 : 0, inView = true, visibleDocument = !document.hidden;
        let lastTimestamp = performance.now(), lastDraw = -Infinity, lastActivation = -1, lastLigandOffset = -1, lastPhase = '', lastCaption = '', raf = null;
        let averageCost = 0, frameInterval = 1000 / 60;
        panel.dataset.gpcrRenderMode = canMorph ? 'cached-geometry' : 'cartoon-fallback';

        function draw(currentTime) {
            const bind = segment(currentTime, 3, 11), activation = segment(currentTime, 11, 19), coupling = segment(currentTime, 19, 27);
            // All matching backbone atoms interpolate in one coordinate frame,
            // so resolved loops meet helices without manual caps or joints.
            const receptorOpacity = 1 - 0.11 * segment(currentTime, 5, 8) * (1 - segment(currentTime, 14, 18));
            if (activation !== lastActivation) {
                receptorAtoms.forEach((atom, i) => {
                    const a = data.inactiveCoordinates[i], b = receptorBase[i];
                    atom.x = a[0] + (b[0] - a[0]) * activation;
                    atom.y = a[1] + (b[1] - a[1]) * activation;
                    atom.z = a[2] + (b[2] - a[2]) * activation;
                });
                bindingAtoms.forEach((atom, i) => {
                    const initial = data.inactiveBindingCoordinates[i], target = bindingBase[i];
                    atom.x = initial[0] + (target[0] - initial[0]) * activation;
                    atom.y = initial[1] + (target[1] - initial[1]) * activation;
                    atom.z = initial[2] + (target[2] - initial[2]) * activation;
                });
                bindingSite.syncAtomPositions();
                if (canMorph) {
                    receptorGroups.forEach(({ geometry, group }, i) => {
                        const buffer = morphBuffers[i];
                        for (let j = 0; j < group.vertexArray.length; j++) {
                            group.vertexArray[j] = buffer.initialPositions[j] + (buffer.target.positions[j] - buffer.initialPositions[j]) * activation;
                            group.normalArray[j] = buffer.initialNormals[j] + (buffer.target.normals[j] - buffer.initialNormals[j]) * activation;
                        }
                        geometry.verticesNeedUpdate = true;
                        geometry.normalsNeedUpdate = true;
                    });
                } else {
                    receptor.setStyle({}, receptorStyle);
                }
                lastActivation = activation;
            }
            setOpacity(canMorph ? receptorGroups : geometryGroups(receptor.renderedMolObj), receptorOpacity);
            const ligandOffset = 28 * (1 - bind);
            if (ligandOffset !== lastLigandOffset) {
                ligandAtoms.forEach((atom, i) => {
                    // Translation only: the experimental N→D3.32 pose stays fixed.
                    atom.x = ligandBase[i][0] - 5 * (1 - bind);
                    atom.y = ligandBase[i][1] + ligandOffset;
                    atom.z = ligandBase[i][2] + 3 * (1 - bind);
                });
                if (!ligand.syncAtomPositions()) ligand.setStyle({}, ligandStyle);
                lastLigandOffset = ligandOffset;
            }
            if (currentTime < 18) {
                gProtein.hide();
            } else {
                gProtein.show();
                const displacement = 18 * (1 - coupling);
                gAtoms.forEach((atom, i) => { atom.x = gBase[i][0]; atom.y = gBase[i][1] - displacement; atom.z = gBase[i][2]; });
                // A rigid group translation preserves all deposited subunit
                // interfaces, and keeps its ribbon geometry on the GPU.
                gProtein.renderedMolObj.position.y = -displacement;
                setOpacity(gGroups, 0.15 + 0.85 * segment(currentTime, 18, 22));
            }
            let right = 1;
            while (right < cameraFrames.length - 1 && currentTime > cameraFrames[right].t) right++;
            const a = cameraFrames[right - 1], b = cameraFrames[right];
            interpolateView(a.view, b.view, segment(currentTime, a.t, b.t), currentView);
            if (bind > 0.6 && currentTime < 15) {
                residueLabel.show(); bindingSite.show();
            } else {
                residueLabel.hide(); bindingSite.hide();
            }
            if (bind > 0.98 && currentTime < 14) nitrogenLabel.show();
            else nitrogenLabel.hide();
            if (coupling >= 0.96) alpha5Label.show();
            else alpha5Label.hide();
            // setView renders the cached scene once, including dirty buffers.
            // A second viewer.render() would double the work per animation tick.
            if (!canMorph) viewer.render();
            viewer.setView(currentView);
            const phase = currentTime < 3 ? 'inactive' : currentTime < 11 ? 'binding' : currentTime < 19 ? 'active' : 'coupling';
            if (phase !== lastPhase) {
                phases.forEach(label => label.classList.toggle('is-active', label.dataset.phase === phase));
                lastPhase = phase;
            }
            const caption = currentTime >= 7 && currentTime < 12 ? labels.pocket : currentTime >= 28 && currentTime < 32 ? labels.interface : labels[phase];
            if (caption !== lastCaption) { phaseLabel.textContent = caption; lastCaption = caption; }
            detailLabel.textContent = phase === 'binding' || (currentTime >= 7 && currentTime < 12) ? labels.bindingDetail : phase === 'active' ? labels.activeDetail : phase === 'coupling' ? labels.coupledDetail : '';
            detailLabel.classList.toggle('is-visible', phase !== 'inactive');
            progress.style.setProperty('--gpcr-progress', (currentTime / duration).toFixed(4));
            viewport.style.setProperty('--scene-fade', Math.max(1 - segment(currentTime, 0, 0.7), segment(currentTime, 37.3, 38)).toFixed(3));
            panel.dataset.gpcrPhase = phase;
            panel.dataset.gpcrTime = currentTime.toFixed(2);
        }
        function tick(timestamp) {
            raf = null;
            if (paused || !inView || !visibleDocument) return;
            time = (time + Math.min((timestamp - lastTimestamp) / 1000, 0.25)) % duration;
            lastTimestamp = timestamp;
            if (timestamp - lastDraw >= frameInterval - 0.75) {
                const start = performance.now();
                draw(time);
                averageCost = averageCost * 0.94 + (performance.now() - start) * 0.06;
                // Target 60 Hz; allow 30 Hz on devices whose render cost is
                // above the frame budget. No scene allocations during playback.
                frameInterval = averageCost > 21 ? 1000 / 30 : 1000 / 60;
                lastDraw = timestamp;
            }
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
            if (event.matches) { time = 35; draw(time); }
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
