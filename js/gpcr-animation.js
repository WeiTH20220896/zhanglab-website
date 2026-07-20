const panel = document.querySelector('.molecular-animation');

if (panel) {
    const canvas = panel.querySelector('.gpcr-canvas');
    const viewport = panel.querySelector('.molecular-viewport');
    const phaseLabel = panel.querySelector('.molecular-phase');
    const detailLabel = panel.querySelector('.molecular-detail');
    const interactionKey = panel.querySelector('.interaction-key');
    const progressBar = panel.querySelector('.molecular-progress');
    const playbackButton = panel.querySelector('.molecular-playback');
    const timelineLabels = [...panel.querySelectorAll('.molecular-timeline [data-phase]')];
    const motifLabels = new Map(
        [...panel.querySelectorAll('.motif-callouts [data-motif]')].map(label => [label.dataset.motif, label])
    );
    const isChinese = panel.dataset.gpcrLanguage === 'zh';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const text = isChinese ? {
        inactive: '非活化GPCR',
        binding: '激动剂结合',
        active: '活化GPCR',
        coupling: 'G蛋白偶联',
        signal: '信号转导',
        gdp: 'GDP从Gα释放',
        gtp: 'GTP结合Gα',
        camp: '腺苷酸环化酶 · cAMP生成',
        pause: '暂停动画',
        play: '继续动画',
        unavailable: '此设备无法加载三维分子场景'
    } : {
        inactive: 'Inactive GPCR',
        binding: 'Agonist binding',
        active: 'Active GPCR',
        coupling: 'G protein coupling',
        signal: 'Signal transduction',
        gdp: 'GDP release from Gα',
        gtp: 'GTP binding to Gα',
        camp: 'Adenylyl cyclase · cAMP production',
        pause: 'Pause animation',
        play: 'Resume animation',
        unavailable: 'The 3D molecular scene is unavailable on this device'
    };

    const DURATION = 45;
    const COLORS = {
        helix: 0x168ca0,
        helixLight: 0x58b7c4,
        helixDark: 0x096579,
        ligand: 0xe69f00,
        ligandOxygen: 0xd55e00,
        ligandNitrogen: 0xf0e442,
        gAlpha: 0x8d6ab0,
        gAlphaLight: 0xb397c9,
        gBeta: 0x009e73,
        gGamma: 0x72b68c,
        membrane: 0xb6bec2,
        hbond: 0x56b4e9,
        ionic: 0xcc79a7,
        hydrophobic: 0xe69f00,
        motif: 0xcc79a7,
        camp: 0xe69f00
    };

    let renderer;
    let scene;
    let camera;
    let animationStart = performance.now();
    let pausedAt = 0;
    let paused = false;
    let inView = true;
    let lastPhase = '';

    const clamp01 = value => Math.min(1, Math.max(0, value));
    const smooth = value => {
        const t = clamp01(value);
        return t * t * (3 - 2 * t);
    };
    const segment = (time, start, end) => smooth((time - start) / (end - start));
    const pulse = (time, speed = 1) => 0.5 + Math.sin(time * speed) * 0.5;

    function material(color, options = {}) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.42,
            metalness: options.metalness ?? 0.04,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0
        });
    }

    function makeHelixGeometry(yStart, yEnd, turns = 8.2, radius = 0.19, phase = 0) {
        const points = [];
        const samples = 128;
        for (let index = 0; index <= samples; index += 1) {
            const t = index / samples;
            const theta = phase + t * turns * Math.PI * 2;
            points.push(new THREE.Vector3(
                Math.cos(theta) * radius,
                THREE.MathUtils.lerp(yStart, yEnd, t),
                Math.sin(theta) * radius
            ));
        }
        const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
        return new THREE.TubeGeometry(curve, 144, 0.078, 7, false);
    }

    function makeHelix(yStart = -2.9, yEnd = 2.9, color = COLORS.helix, phase = 0) {
        const group = new THREE.Group();
        const coil = new THREE.Mesh(
            makeHelixGeometry(yStart, yEnd, Math.abs(yEnd - yStart) * 1.43, 0.19, phase),
            material(color, { roughness: 0.32, metalness: 0.02 })
        );
        coil.castShadow = true;
        coil.receiveShadow = true;
        group.add(coil);

        const spineCurve = new THREE.LineCurve3(
            new THREE.Vector3(0, yStart + 0.08, 0),
            new THREE.Vector3(0, yEnd - 0.08, 0)
        );
        const spine = new THREE.Mesh(
            new THREE.TubeGeometry(spineCurve, 24, 0.047, 6, false),
            material(0xd8f0f2, { transparent: true, opacity: 0.34, roughness: 0.25 })
        );
        group.add(spine);
        return group;
    }

    function cylinderBetween(start, end, radius, color, opacity = 1) {
        const direction = new THREE.Vector3().subVectors(end, start);
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, direction.length(), 10),
            material(color, { transparent: opacity < 1, opacity, roughness: 0.38 })
        );
        mesh.position.copy(midpoint);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        return mesh;
    }

    function makeResidueMarker(color = COLORS.motif, scale = 1) {
        const group = new THREE.Group();
        const center = new THREE.Mesh(
            new THREE.SphereGeometry(0.13 * scale, 18, 14),
            material(color, { emissive: color, emissiveIntensity: 0.22, roughness: 0.3 })
        );
        const side = new THREE.Mesh(
            new THREE.SphereGeometry(0.085 * scale, 16, 12),
            material(color, { roughness: 0.3 })
        );
        side.position.set(0.18 * scale, 0.1 * scale, 0.03 * scale);
        group.add(center, side, cylinderBetween(center.position, side.position, 0.028 * scale, color));
        return group;
    }

    function makeMolecule() {
        const group = new THREE.Group();
        const atomGeometry = new THREE.SphereGeometry(0.18, 24, 18);
        const atoms = [
            { p: [-0.46, 0.03, 0], c: COLORS.ligand },
            { p: [-0.16, 0.34, 0.08], c: COLORS.ligand },
            { p: [0.26, 0.28, -0.04], c: COLORS.ligandNitrogen },
            { p: [0.5, -0.08, 0.06], c: COLORS.ligandOxygen },
            { p: [0.03, -0.28, -0.08], c: COLORS.ligand }
        ];
        const positions = atoms.map(atom => new THREE.Vector3(...atom.p));
        atoms.forEach((atom, index) => {
            const mesh = new THREE.Mesh(atomGeometry, material(atom.c, { roughness: 0.28, metalness: 0.03 }));
            mesh.position.copy(positions[index]);
            group.add(mesh);
        });
        [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 4]].forEach(([a, b]) => {
            group.add(cylinderBetween(positions[a], positions[b], 0.045, 0x9b7130));
        });
        group.scale.setScalar(0.82);
        return group;
    }

    function setObjectOpacity(object, opacity) {
        object.traverse(child => {
            if (!child.material) return;
            child.material.transparent = true;
            child.material.opacity = opacity;
            child.material.depthWrite = opacity > 0.75;
        });
    }

    function makeNucleotide(color) {
        const group = new THREE.Group();
        const ringMaterial = material(color, { emissive: color, emissiveIntensity: 0.16, roughness: 0.3 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 22), ringMaterial);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        for (let index = 0; index < 3; index += 1) {
            const phosphate = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), ringMaterial);
            phosphate.position.set(0.28 + index * 0.15, -0.03 + index * 0.03, 0);
            group.add(phosphate);
            if (index === 0) group.add(cylinderBetween(new THREE.Vector3(0.18, 0, 0), phosphate.position, 0.025, color));
        }
        return group;
    }

    function makeDashedInteraction(color, dashed = true) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
        const lineMaterial = dashed
            ? new THREE.LineDashedMaterial({ color, dashSize: 0.13, gapSize: 0.09, transparent: true, opacity: 0 })
            : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
        const line = new THREE.Line(geometry, lineMaterial);
        line.computeLineDistances();
        return line;
    }

    function updateInteraction(line, start, end, opacity) {
        const positions = line.geometry.attributes.position.array;
        positions[0] = start.x; positions[1] = start.y; positions[2] = start.z;
        positions[3] = end.x; positions[4] = end.y; positions[5] = end.z;
        line.geometry.attributes.position.needsUpdate = true;
        line.computeLineDistances();
        line.material.opacity = opacity;
        line.visible = opacity > 0.01;
    }

    function makeLipidBilayer() {
        const group = new THREE.Group();
        const headGeometry = new THREE.SphereGeometry(0.13, 10, 8);
        const tailGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6);
        const headMaterial = material(COLORS.membrane, { transparent: true, opacity: 0.58, roughness: 0.7 });
        const tailMaterial = material(0xc9ced0, { transparent: true, opacity: 0.34, roughness: 0.8 });
        const positions = [];
        for (let x = -7; x <= 7; x += 0.72) {
            for (let z = -5; z <= 5; z += 0.72) {
                if (Math.hypot(x, z) < 2.55) continue;
                positions.push([x, z]);
            }
        }
        const heads = new THREE.InstancedMesh(headGeometry, headMaterial, positions.length * 2);
        const tails = new THREE.InstancedMesh(tailGeometry, tailMaterial, positions.length * 4);
        const dummy = new THREE.Object3D();
        let headIndex = 0;
        let tailIndex = 0;
        positions.forEach(([x, z], lipidIndex) => {
            const jitter = Math.sin(lipidIndex * 2.17) * 0.055;
            [1, -1].forEach(side => {
                dummy.position.set(x, side * 3.05 + jitter, z);
                dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                heads.setMatrixAt(headIndex++, dummy.matrix);

                [-0.06, 0.06].forEach(offset => {
                    dummy.position.set(x + offset, side * 2.62 + jitter, z);
                    dummy.rotation.set(0, 0, Math.sin(lipidIndex) * 0.07);
                    dummy.updateMatrix();
                    tails.setMatrixAt(tailIndex++, dummy.matrix);
                });
            });
        });
        heads.instanceMatrix.needsUpdate = true;
        tails.instanceMatrix.needsUpdate = true;
        group.add(heads, tails);
        return group;
    }

    function makeGProtein() {
        const complex = new THREE.Group();
        const alpha = new THREE.Group();
        const betaGamma = new THREE.Group();

        const ras = new THREE.Mesh(new THREE.SphereGeometry(1, 42, 30), material(COLORS.gAlpha, { roughness: 0.5 }));
        ras.scale.set(1.28, 0.82, 0.95);
        ras.position.set(0.45, -0.3, 0);
        alpha.add(ras);

        const helicalDomain = new THREE.Mesh(new THREE.SphereGeometry(0.72, 34, 24), material(COLORS.gAlphaLight, { roughness: 0.48 }));
        helicalDomain.scale.set(0.95, 0.76, 0.82);
        helicalDomain.position.set(-0.52, -0.18, 0.18);
        alpha.add(helicalDomain);

        const alpha5 = makeHelix(0, 2.35, COLORS.gAlpha, Math.PI * 0.4);
        alpha5.scale.setScalar(0.72);
        alpha5.position.set(0.82, 0.28, 0.05);
        alpha5.rotation.z = -0.13;
        alpha.add(alpha5);

        const beta = new THREE.Group();
        const bladeGeometry = new THREE.SphereGeometry(0.46, 24, 16);
        for (let index = 0; index < 7; index += 1) {
            const angle = (index / 7) * Math.PI * 2;
            const blade = new THREE.Mesh(bladeGeometry, material(COLORS.gBeta, { roughness: 0.52 }));
            blade.scale.set(1.05, 0.36, 0.52);
            blade.position.set(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0);
            blade.rotation.z = angle;
            beta.add(blade);
        }
        beta.position.set(-1.42, -0.48, -0.05);
        beta.rotation.set(-0.18, 0.22, -0.08);
        betaGamma.add(beta);

        const gamma = makeHelix(-1.1, 1.15, COLORS.gGamma, 0.8);
        gamma.scale.setScalar(0.58);
        gamma.position.set(-2.15, -0.48, -0.18);
        gamma.rotation.z = -0.34;
        betaGamma.add(gamma);

        const gdp = makeNucleotide(0xcc79a7);
        gdp.position.set(0.35, -0.2, 0.8);
        alpha.add(gdp);
        const gtp = makeNucleotide(0xe69f00);
        gtp.position.set(4.3, 1.3, 0.8);
        setObjectOpacity(gtp, 0);
        alpha.add(gtp);

        complex.add(alpha, betaGamma);
        complex.userData = { alpha, betaGamma, alpha5, gdp, gtp };
        return complex;
    }

    function makeAdenylylCyclase() {
        const group = new THREE.Group();
        const tmMaterial = material(0x78929d, { transparent: true, opacity: 0.82, roughness: 0.6 });
        [-0.75, 0.75].forEach(clusterX => {
            for (let index = 0; index < 6; index += 1) {
                const angle = (index / 6) * Math.PI * 2;
                const helix = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 5.1, 10), tmMaterial);
                helix.position.set(clusterX + Math.cos(angle) * 0.38, 0, Math.sin(angle) * 0.38);
                helix.rotation.z = Math.sin(index * 1.7) * 0.08;
                group.add(helix);
            }
        });
        const domainMaterial = material(0x5f8995, { transparent: true, opacity: 0.84, roughness: 0.5 });
        [-0.64, 0.64].forEach(x => {
            const domain = new THREE.Mesh(new THREE.SphereGeometry(0.83, 32, 24), domainMaterial);
            domain.scale.set(1, 0.72, 0.75);
            domain.position.set(x, -3.35, 0);
            group.add(domain);
        });
        group.position.set(6.2, 0, 0);
        group.userData.materials = [tmMaterial, domainMaterial];
        return group;
    }

    function makeCampParticles() {
        const group = new THREE.Group();
        const campMaterial = material(COLORS.camp, { transparent: true, opacity: 0, emissive: COLORS.camp, emissiveIntensity: 0.12, roughness: 0.3 });
        for (let index = 0; index < 12; index += 1) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 9, 20), campMaterial.clone());
            ring.userData.offset = new THREE.Vector3(
                Math.cos(index * 2.23) * (0.7 + (index % 4) * 0.28),
                -0.25 - (index % 5) * 0.42,
                Math.sin(index * 1.67) * (0.7 + (index % 3) * 0.35)
            );
            group.add(ring);
        }
        group.position.set(6.2, -3.4, 0);
        return group;
    }

    function interpolateKeyframes(time, keyframes, target) {
        let left = keyframes[0];
        let right = keyframes[keyframes.length - 1];
        for (let index = 0; index < keyframes.length - 1; index += 1) {
            if (time >= keyframes[index].t && time <= keyframes[index + 1].t) {
                left = keyframes[index];
                right = keyframes[index + 1];
                break;
            }
        }
        const amount = right.t === left.t ? 0 : smooth((time - left.t) / (right.t - left.t));
        target.lerpVectors(left.value, right.value, amount);
    }

    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0xffffff, 0);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(31, 1, 0.1, 80);
        scene.add(new THREE.HemisphereLight(0xffffff, 0xd7e2e6, 2.25));
        const keyLight = new THREE.DirectionalLight(0xffffff, 3.8);
        keyLight.position.set(7, 11, 9);
        keyLight.castShadow = true;
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x77d6e2, 2.1);
        rimLight.position.set(-8, 2, -8);
        scene.add(rimLight);
        const warmLight = new THREE.PointLight(0xffd48b, 1.8, 18);
        warmLight.position.set(1, 3, 4);
        scene.add(warmLight);

        const membrane = makeLipidBilayer();
        scene.add(membrane);

        const receptor = new THREE.Group();
        const helixLayout = [
            [-1.95, 0.78, -0.08, -0.08],
            [-1.72, -0.86, 0.07, 0.06],
            [-0.62, -1.47, -0.05, -0.04],
            [0.78, -1.48, 0.08, 0.05],
            [1.78, -0.55, -0.07, -0.06],
            [1.78, 0.92, 0.04, 0.04],
            [0.43, 1.48, -0.06, -0.05]
        ];
        const helices = [];
        helixLayout.forEach(([x, z, rotX, rotZ], index) => {
            if (index === 5) return;
            const helix = makeHelix(-2.9, 2.9, index % 2 ? COLORS.helixLight : COLORS.helix, index * 0.52);
            helix.position.set(x, 0, z);
            helix.rotation.set(rotX, 0, rotZ);
            helices[index] = helix;
            receptor.add(helix);
        });

        const tm6Upper = makeHelix(0, 2.9, COLORS.helixDark, 2.4);
        const tm6Lower = makeHelix(0, -2.9, COLORS.helixDark, 2.4 + Math.PI);
        tm6Upper.position.set(helixLayout[5][0], 0, helixLayout[5][1]);
        tm6Lower.position.copy(tm6Upper.position);
        receptor.add(tm6Upper, tm6Lower);
        helices[5] = tm6Lower;

        const pocket = new THREE.Mesh(
            new THREE.SphereGeometry(0.82, 26, 20),
            new THREE.MeshBasicMaterial({ color: 0x56b4e9, wireframe: true, transparent: true, opacity: 0.08 })
        );
        pocket.position.set(0.05, 0.72, 0.06);
        receptor.add(pocket);

        const motifs = {
            d332: makeResidueMarker(COLORS.ionic, 1),
            w648: makeResidueMarker(COLORS.hydrophobic, 1.08),
            dry: makeResidueMarker(0x8f6ab1, 1),
            npxxy: makeResidueMarker(0x4c9bb1, 1)
        };
        motifs.d332.position.set(-0.47, 0.62, -0.76);
        motifs.w648.position.set(1.05, -0.02, 0.53);
        motifs.dry.position.set(-0.55, -2.24, -0.82);
        motifs.npxxy.position.set(0.44, -1.98, 1.08);
        Object.values(motifs).forEach(marker => receptor.add(marker));
        scene.add(receptor);

        const ligand = makeMolecule();
        scene.add(ligand);
        const ligandPath = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-1.3, 7.0, 2.5),
            new THREE.Vector3(-1.7, 3.0, 0.7),
            new THREE.Vector3(0.05, 0.72, 0.06)
        );

        const interactions = {
            hbond: makeDashedInteraction(COLORS.hbond, true),
            ionic: makeDashedInteraction(COLORS.ionic, false),
            hydrophobic: makeDashedInteraction(COLORS.hydrophobic, true)
        };
        Object.values(interactions).forEach(line => scene.add(line));

        const gProtein = makeGProtein();
        gProtein.position.set(0, -9.2, 0.15);
        scene.add(gProtein);

        const cyclase = makeAdenylylCyclase();
        setObjectOpacity(cyclase, 0);
        scene.add(cyclase);
        const campParticles = makeCampParticles();
        scene.add(campParticles);

        const cameraPositions = [
            { t: 0, value: new THREE.Vector3(7.8, 9.2, 11.5) },
            { t: 7, value: new THREE.Vector3(7.2, 6.8, 10.2) },
            { t: 13, value: new THREE.Vector3(5.7, 2.9, 7.6) },
            { t: 19, value: new THREE.Vector3(8.4, 1.2, 10.5) },
            { t: 26, value: new THREE.Vector3(7.4, -4.6, 9.4) },
            { t: 34, value: new THREE.Vector3(9.3, -5.5, 12.5) },
            { t: 42, value: new THREE.Vector3(12.7, -3.2, 15.5) },
            { t: 45, value: new THREE.Vector3(12.7, -3.2, 15.5) }
        ];
        const cameraTargets = [
            { t: 0, value: new THREE.Vector3(0, 0.8, 0) },
            { t: 7, value: new THREE.Vector3(0, 0.7, 0) },
            { t: 13, value: new THREE.Vector3(0, 0.65, 0) },
            { t: 19, value: new THREE.Vector3(0, -0.1, 0) },
            { t: 26, value: new THREE.Vector3(0.3, -2.1, 0) },
            { t: 34, value: new THREE.Vector3(1.2, -2.5, 0) },
            { t: 42, value: new THREE.Vector3(2.8, -1.7, 0) },
            { t: 45, value: new THREE.Vector3(2.8, -1.7, 0) }
        ];
        const cameraTarget = new THREE.Vector3();
        const d332World = new THREE.Vector3();
        const w648World = new THREE.Vector3();
        const ionicWorld = new THREE.Vector3();

        function resizeRenderer() {
            const width = Math.max(1, viewport.clientWidth);
            const height = Math.max(1, viewport.clientHeight);
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            const maxPixels = 2560 * 1440;
            let drawWidth = Math.floor(width * pixelRatio);
            let drawHeight = Math.floor(height * pixelRatio);
            const count = drawWidth * drawHeight;
            if (count > maxPixels) {
                const scale = Math.sqrt(maxPixels / count);
                drawWidth = Math.floor(drawWidth * scale);
                drawHeight = Math.floor(drawHeight * scale);
            }
            if (canvas.width !== drawWidth || canvas.height !== drawHeight) {
                renderer.setSize(drawWidth, drawHeight, false);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }
        }

        function updatePhase(time) {
            const phase = time < 7 ? 'inactive' : time < 15 ? 'binding' : time < 23 ? 'active' : time < 34 ? 'coupling' : 'signal';
            if (phase !== lastPhase) {
                lastPhase = phase;
                phaseLabel.textContent = text[phase];
                timelineLabels.forEach(label => label.classList.toggle('is-active', label.dataset.phase === phase));
            }
            let detail = '';
            if (time >= 28 && time < 31.5) detail = text.gdp;
            else if (time >= 31.5 && time < 35.5) detail = text.gtp;
            else if (time >= 37.5) detail = text.camp;
            detailLabel.textContent = detail;
            detailLabel.classList.toggle('is-visible', Boolean(detail));
            interactionKey.classList.toggle('is-visible', time >= 10.5 && time < 17.5);
        }

        function updateMotifLabels(time) {
            const opacity = time < 18 ? segment(time, 0.8, 2.2) : 1 - segment(time, 18, 21);
            const width = viewport.clientWidth;
            const height = viewport.clientHeight;
            Object.entries(motifs).forEach(([key, marker]) => {
                const label = motifLabels.get(key);
                if (!label) return;
                const world = new THREE.Vector3();
                marker.getWorldPosition(world);
                world.project(camera);
                const visible = world.z > -1 && world.z < 1 && opacity > 0.01;
                label.style.left = `${(world.x * 0.5 + 0.5) * width}px`;
                label.style.top = `${(-world.y * 0.5 + 0.5) * height}px`;
                label.style.opacity = visible ? opacity.toFixed(3) : '0';
            });
        }

        function updateScene(time) {
            const bind = segment(time, 7, 14.5);
            const activation = segment(time, 15, 22.5);
            const coupling = segment(time, 22.5, 29);
            const exchange = segment(time, 28, 35);
            const separation = segment(time, 34, 40);
            const signal = segment(time, 37, 44);

            interpolateKeyframes(time, cameraPositions, camera.position);
            interpolateKeyframes(time, cameraTargets, cameraTarget);
            camera.lookAt(cameraTarget);
            camera.updateMatrixWorld();

            ligand.position.copy(ligandPath.getPoint(bind));
            ligand.rotation.set(0.28 + bind * 0.7, time * 0.24, -0.18 + bind * 0.24);
            ligand.scale.setScalar(0.82 + pulse(time, 2.2) * 0.035);
            ligand.visible = time < 44;

            pocket.material.opacity = 0.055 + bind * 0.12 + pulse(time, 2.5) * 0.025;
            pocket.scale.setScalar(1 + bind * 0.08 + pulse(time, 2.5) * 0.04);

            const interactionOpacity = segment(time, 10.2, 13.2) * (1 - segment(time, 17.2, 19.4));
            motifs.d332.getWorldPosition(d332World);
            motifs.w648.getWorldPosition(w648World);
            ionicWorld.set(-0.28, 0.78, -0.45);
            receptor.localToWorld(ionicWorld);
            updateInteraction(interactions.hbond, ligand.position, d332World, interactionOpacity * 0.92);
            updateInteraction(interactions.ionic, ligand.position, ionicWorld, interactionOpacity);
            updateInteraction(interactions.hydrophobic, ligand.position, w648World, interactionOpacity * 0.78);

            tm6Lower.position.set(
                helixLayout[5][0] + activation * 0.52,
                0,
                helixLayout[5][1] + activation * 0.16
            );
            tm6Lower.rotation.z = activation * 0.34;
            tm6Lower.rotation.x = activation * -0.08;
            helices[4].position.x = helixLayout[4][0] + activation * 0.17;
            helices[4].position.y = activation * -0.16;
            helices[6].position.x = helixLayout[6][0] - activation * 0.14;
            helices[6].rotation.z = helixLayout[6][3] + activation * 0.06;
            motifs.w648.rotation.y = activation * 1.2;
            motifs.w648.position.x = 1.05 + activation * 0.16;
            motifs.dry.position.x = -0.55 + activation * 0.12;
            motifs.npxxy.position.x = 0.44 - activation * 0.13;

            const gOpacity = segment(time, 20.5, 24.5) * (1 - segment(time, 44, 45));
            setObjectOpacity(gProtein, gOpacity);
            gProtein.position.y = THREE.MathUtils.lerp(-9.2, -5.15, coupling);
            gProtein.position.x = activation * 0.15;
            gProtein.rotation.y = THREE.MathUtils.lerp(-0.3, 0.08, coupling);
            gProtein.rotation.z = THREE.MathUtils.lerp(0.1, -0.04, coupling);
            gProtein.userData.alpha5.rotation.z = -0.13 + coupling * 0.24;
            gProtein.userData.alpha5.position.y = 0.28 + coupling * 0.38;

            const gdpRelease = segment(time, 28.2, 31.6);
            gProtein.userData.gdp.position.set(
                0.35 - gdpRelease * 2.4,
                -0.2 - gdpRelease * 1.5,
                0.8 + gdpRelease * 1.1
            );
            setObjectOpacity(gProtein.userData.gdp, 1 - segment(time, 30.2, 32.5));

            const gtpBind = segment(time, 31.2, 34.8);
            gProtein.userData.gtp.position.set(
                THREE.MathUtils.lerp(4.3, 0.35, gtpBind),
                THREE.MathUtils.lerp(1.3, -0.2, gtpBind),
                THREE.MathUtils.lerp(0.8, 0.72, gtpBind)
            );
            setObjectOpacity(gProtein.userData.gtp, segment(time, 30.8, 32.4));

            gProtein.userData.alpha.position.x = separation * 4.2;
            gProtein.userData.alpha.position.y = separation * 0.22;
            gProtein.userData.betaGamma.position.x = -separation * 2.15;
            gProtein.userData.betaGamma.position.y = -separation * 0.45;
            gProtein.userData.alpha.rotation.z = -separation * 0.12;

            setObjectOpacity(cyclase, segment(time, 34, 38.5));
            cyclase.scale.setScalar(0.88 + signal * 0.12 + pulse(time, 2.6) * signal * 0.025);
            campParticles.children.forEach((particle, index) => {
                const local = clamp01(signal * 1.25 - index * 0.035);
                particle.position.copy(particle.userData.offset).multiplyScalar(local);
                particle.rotation.set(time * 0.2 + index, time * 0.15, index * 0.7);
                particle.material.opacity = local * (1 - segment(time, 44.2, 45));
            });

            membrane.rotation.y = Math.sin(time * 0.12) * 0.018;
            receptor.rotation.y = Math.sin(time * 0.17) * 0.035;
            const sceneFade = Math.max(1 - segment(time, 0, 1.15), segment(time, 44, 45));
            viewport.style.setProperty('--scene-fade', sceneFade.toFixed(3));
            progressBar.style.setProperty('--gpcr-progress', (time / DURATION).toFixed(4));
            updatePhase(time);
            updateMotifLabels(time);
        }

        function render(timestamp) {
            resizeRenderer();
            const time = reduceMotion ? 24.5 : ((timestamp - animationStart) / 1000) % DURATION;
            updateScene(time);
            renderer.render(scene, camera);
        }

        playbackButton.addEventListener('click', () => {
            if (reduceMotion) return;
            if (paused) {
                const pauseDuration = performance.now() - pausedAt;
                animationStart += pauseDuration;
                paused = false;
                panel.classList.remove('is-paused');
                playbackButton.querySelector('span').textContent = 'Ⅱ';
                playbackButton.setAttribute('aria-label', text.pause);
                if (inView) renderer.setAnimationLoop(render);
            } else {
                pausedAt = performance.now();
                paused = true;
                panel.classList.add('is-paused');
                playbackButton.querySelector('span').textContent = '▶';
                playbackButton.setAttribute('aria-label', text.play);
                renderer.setAnimationLoop(null);
            }
        });

        if (reduceMotion) {
            playbackButton.hidden = true;
            render(performance.now());
        } else {
            const visibilityObserver = new IntersectionObserver(entries => {
                inView = entries[0].isIntersecting;
                if (inView && !paused) renderer.setAnimationLoop(render);
                else renderer.setAnimationLoop(null);
            }, { threshold: 0.04 });
            visibilityObserver.observe(panel);
            renderer.setAnimationLoop(render);
        }

        window.addEventListener('resize', resizeRenderer, { passive: true });
        panel.classList.add('is-webgl-ready');
    } catch (error) {
        const fallback = panel.querySelector('.molecular-fallback span');
        if (fallback) fallback.textContent = text.unavailable;
        console.warn('GPCR molecular animation could not initialize.', error);
    }
}
