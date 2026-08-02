// script.js - 主程式控制、資料同步、終端管理、星系 3D 空間與 3D 地標視覺化
const API_URL = "https://script.google.com/macros/s/AKfycbwFFcjV3PdBDoJCqTYajl9tp3rvi07CyTGscz1EWe6rwWII0HgOiKwWnM447U63PNB_/exec";

// 1. 全星系 3D 星球空間檢視模組 (System Planetry Space)
const SystemPlanets3D = {
    scene: null, camera: null, renderer: null, planetsGroup: null,
    animFrameId: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    clickableMeshes: [], planetNodes: [], boundPointerDown: null,
    positionsCache: {}, // 記憶體位置快取：[sysName][planetName] = { pos, radius, ringOuter }
    currentSysName: null,
    currentSelectedPlanet: null,

    init(container, sysData, sysName, currentPlanetName) {
        if (!container) return;

        // 同星系熱更新，不銷毀場景，避免畫面閃爍
        if (this.currentSysName === sysName && this.renderer && container.contains(this.renderer.domElement)) {
            this.setSelectedPlanet(currentPlanetName);
            return;
        }

        this.destroy();
        this.currentSysName = sysName;
        this.currentSelectedPlanet = currentPlanetName;
        container.innerHTML = '';
        this.clickableMeshes = [];
        this.planetNodes = [];

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 380;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 11.5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambLight);
        const dirLight = new THREE.DirectionalLight(0x00f3ff, 0.8);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        this.planetsGroup = new THREE.Group();
        this.scene.add(this.planetsGroup);

        this.buildPlanets(sysData, sysName, currentPlanetName);

        this.boundPointerDown = (e) => this.onPointerDown(e, container);
        this.renderer.domElement.addEventListener('pointerdown', this.boundPointerDown);

        this.animate();
    },

    setSelectedPlanet(planetName) {
        this.currentSelectedPlanet = planetName;
        this.planetNodes.forEach(node => {
            const isSelected = (node.planetName === planetName);
            const targetS = isSelected ? 1.25 : 1.0;
            node.targetScale.set(targetS, targetS, targetS);

            if (node.selectionRing) {
                node.targetRingOpacity = isSelected ? 0.95 : 0.0;
            }

            if (node.labelSprite) {
                this.updateLabelSprite(node.labelSprite, node.planetName, isSelected);
            }
        });
    },

    buildPlanets(sysData, sysName, currentPlanetName) {
        const planetKeys = Object.keys(sysData).filter(k => k !== '星系政治' && k !== '星系經濟');
        if (planetKeys.length === 0) return;

        if (!this.positionsCache[sysName]) {
            this.positionsCache[sysName] = {};
        }
        const sysCache = this.positionsCache[sysName];

        Object.keys(sysCache).forEach(pName => {
            if (!planetKeys.includes(pName)) delete sysCache[pName];
        });

        const rawPlanets = planetKeys.map(pName => {
            const pData = sysData[pName];
            const env = pData['環境概覽'] || {};
            const c1 = env['星球主色'] || '#00f3ff';
            const c2 = env['星球副色'] || '#bc13fe';
            const hasRing = (env['是否有星環'] === '是' || env['是否有星環'] === true || env['是否有星環'] === 'true');
            return { name: pName, data: pData, c1, c2, hasRing };
        });

        // 絕對 2D 平面 (Z=0) 防碰撞與邊界優化排列演算法
        const placed = [];
        const minSafetyMargin = 0.6; // 星球間額外安全保護距離

        rawPlanets.forEach((p, idx) => {
            const radius = 0.55 + (Math.sin(idx * 3.7 + 1.2) * 0.5 + 0.5) * 0.45;
            const ringOuter = p.hasRing ? radius * 2.1 : radius * 1.15;

            let cached = sysCache[p.name];
            let pos = null;

            // 驗證快取位置是否仍安全、不與已放置的星球發生重疊
            if (cached && cached.pos) {
                let cacheValid = true;
                for (let other of placed) {
                    const requiredDist = (ringOuter + other.ringOuter) * 1.25 + minSafetyMargin;
                    if (cached.pos.distanceTo(other.pos) < requiredDist) {
                        cacheValid = false;
                        break;
                    }
                }
                if (cacheValid) {
                    pos = cached.pos.clone();
                }
            }

            // 若無有效快取，進行精準碰撞檢測佈局
            if (!pos) {
                let bestPos = null;
                let valid = false;

                // 1. 隨機抽樣尋找適當邊界內位置
                for (let attempt = 0; attempt < 300; attempt++) {
                    const x = (Math.random() - 0.5) * 14.0; // [-7.0, 7.0] 範圍
                    const y = (Math.random() - 0.5) * 5.2;  // [-2.6, 2.6] 範圍
                    const candidate = new THREE.Vector3(x, y, 0);

                    let collision = false;
                    for (let other of placed) {
                        const requiredDist = (ringOuter + other.ringOuter) * 1.25 + minSafetyMargin;
                        if (candidate.distanceTo(other.pos) < requiredDist) {
                            collision = true;
                            break;
                        }
                    }

                    if (!collision) {
                        bestPos = candidate;
                        valid = true;
                        break;
                    }
                }

                // 2. 若隨機抽樣失敗，採用漸進螺旋演算法確保 100% 不重疊
                if (!valid) {
                    let r = 0.6;
                    let angle = idx * 2.4;
                    while (!valid && r < 12) {
                        angle += 0.4;
                        r += 0.12;
                        const x = Math.cos(angle) * r * 1.8;
                        const y = Math.sin(angle) * r * 0.85;
                        const candidate = new THREE.Vector3(x, y, 0);

                        let collision = false;
                        for (let other of placed) {
                            const requiredDist = (ringOuter + other.ringOuter) * 1.25 + minSafetyMargin;
                            if (candidate.distanceTo(other.pos) < requiredDist) {
                                collision = true;
                                break;
                            }
                        }

                        if (!collision) {
                            bestPos = candidate;
                            valid = true;
                        }
                    }
                }

                // 極端情況保底
                if (!bestPos) {
                    bestPos = new THREE.Vector3((idx - rawPlanets.length / 2) * 2.5, 0, 0);
                }

                pos = bestPos;
            }

            sysCache[p.name] = { pos: pos.clone(), radius, ringOuter };
            placed.push({ ...p, pos, radius, ringOuter });
        });

        placed.forEach(p => {
            const planetGroup = new THREE.Group();
            planetGroup.position.copy(p.pos);
            planetGroup.userData = { planetName: p.name };

            const isSelected = (p.name === currentPlanetName);
            const initialScale = isSelected ? 1.25 : 1.0;
            planetGroup.scale.set(initialScale, initialScale, initialScale);

            // 3D 質感流光 Shader
            const uniforms = {
                color1: { value: new THREE.Color(p.c1) },
                color2: { value: new THREE.Color(p.c2) },
                time: { value: 0 }
            };

            const vertShader = `
                varying vec3 vPosition;
                varying vec3 vNormal;
                void main() {
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;

            const fragShader = `
                uniform vec3 color1;
                uniform vec3 color2;
                uniform float time;
                varying vec3 vPosition;
                varying vec3 vNormal;

                void main() {
                    vec3 normPos = normalize(vPosition);
                    float wave = sin(normPos.y * 4.5 + normPos.x * 2.5 + time * 1.6) * 0.5 + 0.5;
                    float mixFactor = clamp((normPos.y + wave * 0.4 + 1.0) * 0.5, 0.0, 1.0);
                    vec3 baseColor = mix(color1, color2, mixFactor);

                    float rim = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
                    rim = pow(rim, 2.2);

                    vec3 finalColor = baseColor + vec3(0.8, 0.95, 1.0) * rim * 0.5;
                    gl_FragColor = vec4(finalColor, 0.95);
                }
            `;

            const material = new THREE.ShaderMaterial({
                uniforms, vertexShader: vertShader, fragmentShader: fragShader, transparent: true
            });

            const sphereGeo = new THREE.SphereGeometry(p.radius, 32, 32);
            const planetMesh = new THREE.Mesh(sphereGeo, material);
            planetMesh.userData = { planetName: p.name };
            planetGroup.add(planetMesh);
            this.clickableMeshes.push(planetMesh);

            // 科幻網格線
            const wireGeo = new THREE.SphereGeometry(p.radius * 1.015, 16, 16);
            const wireMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true, transparent: true, opacity: 0.1 });
            planetGroup.add(new THREE.Mesh(wireGeo, wireMat));

            // 星環 (優化傾角與旋轉角度，確保從正面視角看寬闊清晰)
            if (p.hasRing) {
                const ringGeo = new THREE.RingGeometry(p.radius * 1.35, p.radius * 2.1, 64);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85
                });
                const ringMesh = new THREE.Mesh(ringGeo, ringMat);
                ringMesh.rotation.x = Math.PI / 3.2; // 調整傾角 (約 56 度)，使星環在正前方顯現飽滿橢圓形
                ringMesh.rotation.y = Math.PI / 8;   // 側傾立體感
                planetGroup.add(ringMesh);
            }

            // 正對鏡頭的選中科幻外框 (Billboard Circle)
            const frameGeo = new THREE.RingGeometry(p.radius * 1.18, p.radius * 1.25, 64);
            const frameMat = new THREE.MeshBasicMaterial({
                color: 0x00f3ff, side: THREE.DoubleSide, transparent: true, opacity: isSelected ? 0.95 : 0.0
            });
            const selectionRing = new THREE.Mesh(frameGeo, frameMat);
            planetGroup.add(selectionRing);

            // 文字標籤
            const sprite = this.createLabelSprite(p.name, isSelected);
            const labelYOffset = p.hasRing ? (p.radius * 1.6 + 0.3) : (p.radius + 0.5);
            sprite.position.set(0, labelYOffset, 0);
            planetGroup.add(sprite);

            this.planetsGroup.add(planetGroup);

            this.planetNodes.push({
                planetName: p.name,
                group: planetGroup,
                planetMesh,
                selectionRing,
                labelSprite: sprite,
                uniforms,
                targetScale: new THREE.Vector3(initialScale, initialScale, initialScale),
                targetRingOpacity: isSelected ? 0.95 : 0.0,
                rotSpeed: 0.004 + (Math.sin(p.radius * 10) * 0.003 + 0.003)
            });
        });
    },

    createLabelSprite(pName, isSelected) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        this.drawLabelCanvas(canvas, pName, isSelected);

        const labelTex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ 
            map: labelTex, 
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.renderOrder = 999;
        sprite.scale.set(3.3, 0.825, 1);
        sprite.userData = { canvas, labelTex };
        return sprite;
    },

    updateLabelSprite(sprite, pName, isSelected) {
        if (!sprite || !sprite.userData.canvas) return;
        this.drawLabelCanvas(sprite.userData.canvas, pName, isSelected);
        sprite.userData.labelTex.needsUpdate = true;
    },

    drawLabelCanvas(canvas, pName, isSelected) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 22px "Share Tech Mono", monospace';
        ctx.fillStyle = isSelected ? '#00f3ff' : '#d4f1f9';
        ctx.textAlign = 'center';
        ctx.shadowColor = isSelected ? '#00f3ff' : '#bc13fe';
        ctx.shadowBlur = 8;
        ctx.fillText((isSelected ? '▶ ' : '') + pName, 128, 40);
    },

    onPointerDown(event, container) {
        const rect = container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.clickableMeshes, false);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const pName = hitMesh.userData.planetName;
            if (pName) {
                app.selectPlanet(pName);
            }
        }
    },

    animate() {
        this.animFrameId = requestAnimationFrame(() => this.animate());

        this.planetNodes.forEach(node => {
            node.planetMesh.rotation.y += node.rotSpeed;
            if (node.uniforms && node.uniforms.time) {
                node.uniforms.time.value += 0.015;
            }

            // Lerp 60fps 平滑縮放動畫
            node.group.scale.lerp(node.targetScale, 0.1);

            // 外圈淡入淡出動畫
            if (node.selectionRing) {
                const curOpacity = node.selectionRing.material.opacity;
                node.selectionRing.material.opacity += (node.targetRingOpacity - curOpacity) * 0.1;
            }
        });

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    destroy() {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.renderer && this.renderer.domElement && this.boundPointerDown) {
            this.renderer.domElement.removeEventListener('pointerdown', this.boundPointerDown);
        }
        if (this.renderer) this.renderer.dispose();
        this.currentSysName = null;
    }
};

// 2. 單一星球地標 3D 檢視模組
const Planet3D = {
    scene: null, camera: null, renderer: null, planetGroup: null, markersGroup: null,
    markersMap: {}, isAutoRotating: true, targetRotationY: null, highlightTimeout: null, animFrameId: null,

    init(container) {
        if (!container) return;
        this.destroy();
        container.innerHTML = '';
        this.isAutoRotating = true;
        this.targetRotationY = null;

        const width = container.clientWidth || 320;
        const height = container.clientHeight || 320;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.z = 5.2;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        this.planetGroup = new THREE.Group();
        this.scene.add(this.planetGroup);

        const sphereGeo = new THREE.SphereGeometry(1.8, 24, 24);
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true, transparent: true, opacity: 0.25 });
        this.planetGroup.add(new THREE.Mesh(sphereGeo, wireMat));

        const innerGeo = new THREE.SphereGeometry(1.78, 16, 16);
        const innerMat = new THREE.PointsMaterial({ color: 0xbc13fe, size: 0.03, transparent: true, opacity: 0.6 });
        this.planetGroup.add(new THREE.Points(innerGeo, innerMat));

        const ringGeo = new THREE.RingGeometry(1.81, 1.83, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.4; // 傾斜赤道圈，避免純 90 度視角邊緣切面導致看不到
        this.planetGroup.add(ring);

        this.markersGroup = new THREE.Group();
        this.planetGroup.add(this.markersGroup);

        this.animate();
    },

    latLonToVector3(lat, lon, radius = 1.82) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -(radius * Math.sin(phi) * Math.cos(theta)),
            (radius * Math.cos(phi)),
            (radius * Math.sin(phi) * Math.sin(theta))
        );
    },

    renderLandmarks(landmarksObj) {
        if (!this.markersGroup) return;
        while (this.markersGroup.children.length > 0) this.markersGroup.remove(this.markersGroup.children[0]);
        this.markersMap = {};
        if (!landmarksObj) return;

        for (let lName in landmarksObj) {
            const lData = landmarksObj[lName];
            const lat = parseFloat(lData['緯度']) || 0;
            const lon = parseFloat(lData['經度']) || 0;
            const pos = this.latLonToVector3(lat, lon);

            const markerMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0x00f3ff })
            );
            markerMesh.position.copy(pos);
            const grp = new THREE.Group();
            grp.add(markerMesh);
            this.markersGroup.add(grp);
            this.markersMap[lName] = { group: grp, mesh: markerMesh, lat, lon };
        }
    },

    focusLandmark(lName) {
        const item = this.markersMap[lName];
        if (!item) return;
        this.targetRotationY = -((item.lon + 180) * (Math.PI / 180)) + Math.PI / 2;
        this.isAutoRotating = false;
        this.resetHighlights();
        item.mesh.material.color.setHex(0xff003c);
        item.mesh.scale.set(2.2, 2.2, 2.2);

        if (this.highlightTimeout) clearTimeout(this.highlightTimeout);
        this.highlightTimeout = setTimeout(() => {
            this.resetHighlights();
            this.isAutoRotating = true;
            this.targetRotationY = null;
        }, 5000);
    },

    resetHighlights() {
        for (let name in this.markersMap) {
            const item = this.markersMap[name];
            item.mesh.material.color.setHex(0x00f3ff);
            item.mesh.scale.set(1, 1, 1);
        }
    },

    animate() {
        this.animFrameId = requestAnimationFrame(() => this.animate());
        if (this.planetGroup) {
            if (this.isAutoRotating) {
                this.planetGroup.rotation.y += 0.005;
            } else if (this.targetRotationY !== null) {
                let diff = this.targetRotationY - this.planetGroup.rotation.y;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                this.planetGroup.rotation.y += diff * 0.08;
            }
        }
        if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    },

    destroy() {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.highlightTimeout) clearTimeout(this.highlightTimeout);
        if (this.renderer) this.renderer.dispose();
    }
};

// 3. 全域 App 控制器
const app = {
    data: {},
    options: {},
    currentMode: 'terminal',
    currentSystem: null,
    currentPlanet: null,
    currentSelectedRouteId: null,
    activeFilters: [],

    switchMode(mode) {
        this.currentMode = mode;
        document.getElementById('btn-mode-terminal').classList.toggle('active', mode === 'terminal');
        document.getElementById('btn-mode-trade').classList.toggle('active', mode === 'trade');

        document.getElementById('terminal-sidebar-section').style.display = (mode === 'terminal') ? 'flex' : 'none';
        document.getElementById('trade-sidebar-section').style.display = (mode === 'trade') ? 'flex' : 'none';

        if(mode === 'trade') {
            TradeUI.renderSidebar(this);
        } else {
            this.renderSidebar();
            if(this.currentSystem) this.renderSystemContent();
        }
    },

    setStatus(msg, type = '') {
        const el = document.getElementById('connection-status');
        el.textContent = `STATUS: ${msg}`;
        el.className = `status-indicator ${type}`;
    },

    async fetchData() {
        this.setStatus('FETCHING...', 'error');
        try {
            const response = await fetch(API_URL);
            const result = await response.json();
            
            if (result && (result.data !== undefined || result.options !== undefined)) {
                this.data = result.data || {};
                this.options = result.options || {};
            } else {
                this.data = result || {};
                this.options = {};
            }

            this.setStatus('ONLINE', 'success');
            this.setupFilterControls();
            
            if(this.currentMode === 'trade') {
                TradeUI.renderSidebar(this);
            } else {
                this.renderSidebar();
                if(this.currentSystem && this.data[this.currentSystem]) {
                    this.selectSystem(this.currentSystem);
                } else {
                    document.getElementById('main-content').innerHTML = `<div class="init-screen"><div class="glitch-text">SELECT SYSTEM TO BEGIN</div></div>`;
                }
            }
        } catch (err) {
            console.error(err);
            this.setStatus('ERR_CONNECTION', 'error');
        }
    },

    async saveData() {
        this.setStatus('UPLOADING...', 'error');
        try {
            const payload = { action: 'save_all', data: this.data };
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if(result.status === 'success') {
                this.setStatus('DATA_SAVED', 'success');
                setTimeout(() => this.setStatus('ONLINE', 'success'), 3000);
            } else {
                this.setStatus('ERR_SAVE_FAIL', 'error');
            }
        } catch (err) {
            console.error(err);
            this.setStatus('ERR_POST_FAIL', 'error');
        }
    },

    setupFilterControls() {
        const fieldSelect = document.getElementById('filter-field-select');
        if(!fieldSelect) return;
        fieldSelect.innerHTML = '<option value="">+ 新增篩選條件...</option>';
        const allKeys = new Set();
        if(this.options.valueOptions) Object.keys(this.options.valueOptions).forEach(k => allKeys.add(k));
        if(this.options.multiSelectOptions) Object.keys(this.options.multiSelectOptions).forEach(k => allKeys.add(k));
        allKeys.forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            fieldSelect.appendChild(opt);
        });
    },

    onFilterFieldChange() {
        const fieldSelect = document.getElementById('filter-field-select');
        const valSelect = document.getElementById('filter-value-select');
        const selectedField = fieldSelect.value;

        if(!selectedField) { valSelect.style.display = 'none'; return; }

        let optsArr = [];
        if(this.options.valueOptions && this.options.valueOptions[selectedField]) optsArr = this.options.valueOptions[selectedField];
        else if(this.options.multiSelectOptions && this.options.multiSelectOptions[selectedField]) optsArr = this.options.multiSelectOptions[selectedField];

        valSelect.innerHTML = '<option value="">-- 選擇數值 --</option>';
        optsArr.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            valSelect.appendChild(opt);
        });
        valSelect.style.display = 'block';
    },

    renderFilterTags() {
        const container = document.getElementById('active-filters-tags');
        if (!container) return;
        container.innerHTML = '';

        if (this.activeFilters.length === 0) {
            container.innerHTML = '<span class="no-tags" style="color:rgba(255,255,255,0.3); font-size:0.8rem;">// 無啟用條件</span>';
            return;
        }

        this.activeFilters.forEach((filter, index) => {
            const tag = document.createElement('span');
            tag.className = 'tag-chip';
            tag.innerHTML = `
                ${filter.field}: ${filter.value}
                <button class="tag-del" onclick="app.removeFilter(${index})">✕</button>
            `;
            container.appendChild(tag);
        });
    },

    addSelectedFilter() {
        const fieldSelect = document.getElementById('filter-field-select');
        const valSelect = document.getElementById('filter-value-select');
        const field = fieldSelect.value;
        const value = valSelect.value;

        if(!field || !value) return;
        if(!this.activeFilters.some(f => f.field === field && f.value === value)) {
            this.activeFilters.push({ field, value });
        }

        fieldSelect.value = '';
        valSelect.value = '';
        valSelect.style.display = 'none';

        this.renderFilterTags();
        this.renderSidebar();
    },

    removeFilter(index) {
        this.activeFilters.splice(index, 1);
        this.renderFilterTags();
        this.renderSidebar();
    },

    clearFilters() {
        this.activeFilters = [];
        const fieldSelect = document.getElementById('filter-field-select');
        const valSelect = document.getElementById('filter-value-select');
        if(fieldSelect) fieldSelect.value = '';
        if(valSelect) { valSelect.value = ''; valSelect.style.display = 'none'; }
        this.renderFilterTags();
        this.renderSidebar();
    },

    getFilteredPlanets() {
        if (this.activeFilters.length === 0) return null;
        const matchedList = [];

        for (let sysName in this.data) {
            const sys = this.data[sysName];
            const planets = this.getPlanets(sysName);

            planets.forEach(pName => {
                const pData = sys[pName];
                let isMatch = true;

                for (let filter of this.activeFilters) {
                    const { field, value } = filter;
                    let fieldValue = null;

                    if (sys['星系政治'] && sys['星系政治'][field] !== undefined) fieldValue = sys['星系政治'][field];
                    else if (sys['星系經濟'] && sys['星系經濟'][field] !== undefined) fieldValue = sys['星系經濟'][field];
                    else if (pData['環境概覽'] && pData['環境概覽'][field] !== undefined) fieldValue = pData['環境概覽'][field];
                    else if (pData['自然資源'] && pData['自然資源'][field] !== undefined) fieldValue = pData['自然資源'][field];

                    if (Array.isArray(fieldValue)) {
                        if (!fieldValue.includes(value)) { isMatch = false; break; }
                    } else if (typeof fieldValue === 'string') {
                        if (fieldValue.includes(',')) {
                            const arr = fieldValue.split(',').map(s => s.trim());
                            if (!arr.includes(value)) { isMatch = false; break; }
                        } else if (fieldValue !== value) { isMatch = false; break; }
                    } else { isMatch = false; break; }
                }

                if (isMatch) matchedList.push({ sysName, pName });
            });
        }
        return matchedList;
    },

    renderSidebar() {
        const list = document.getElementById('system-list');
        list.innerHTML = '';

        const filteredPlanets = this.getFilteredPlanets();

        if (filteredPlanets !== null) {
            if (filteredPlanets.length === 0) {
                list.innerHTML = `<li style="color:var(--danger); cursor:default;">// NO MATCHING PLANETS</li>`;
                return;
            }
            filteredPlanets.forEach(item => {
                const li = document.createElement('li');
                if (item.sysName === this.currentSystem && item.pName === this.currentPlanet) li.classList.add('active');
                li.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span>🪐 ${item.pName}</span>
                        <span class="sys-badge-sub">SYSTEM: ${item.sysName}</span>
                    </div>
                `;
                li.onclick = () => this.navigateToPlanet(item.sysName, item.pName);
                list.appendChild(li);
            });
        } else {
            for (let sysName in this.data) {
                const li = document.createElement('li');
                li.textContent = sysName;
                if(sysName === this.currentSystem) li.classList.add('active');
                
                li.onclick = (e) => {
                    if(e.target.tagName !== 'BUTTON') this.selectSystem(sysName);
                };

                const delBtn = document.createElement('button');
                delBtn.className = 'del-btn';
                delBtn.textContent = 'X';
                delBtn.onclick = () => this.deleteSystem(sysName);
                li.appendChild(delBtn);

                list.appendChild(li);
            }
        }
    },

    navigateToPlanet(sysName, pName) {
        this.currentSystem = sysName;
        this.currentPlanet = pName;
        this.renderSidebar();
        this.renderSystemContent();
    },

    selectSystem(sysName) {
        this.currentSystem = sysName;
        this.renderSidebar();
        const planets = this.getPlanets(sysName);
        if(planets.length > 0 && (!this.currentPlanet || !planets.includes(this.currentPlanet))) {
            this.currentPlanet = planets[0];
        } else if (planets.length === 0) {
            this.currentPlanet = null;
        }
        this.renderSystemContent();
    },

    getPlanets(sysName) {
        if(!this.data[sysName]) return [];
        return Object.keys(this.data[sysName]).filter(k => k !== '星系政治' && k !== '星系經濟');
    },

    renderSystemContent() {
        const sys = this.data[this.currentSystem];
        if(!sys) return;

        let html = `
            <div class="section-title">
                <span>[ SYSTEM: ${this.currentSystem} ]</span>
            </div>
            <div class="data-grid">
                ${this.generateCardHTML(this.currentSystem, '星系政治', sys['星系政治'], ['優勢族群', '公會', '衝突程度'])}
                ${this.generateCardHTML(this.currentSystem, '星系經濟', sys['星系經濟'], ['經濟類型', '經濟等級', '出售', '購買'])}
            </div>
            
            <div class="section-title" style="margin-top: 20px;">
                <span>[ PLANETARY_SPACE // 3D 星球空間 ]</span>
                <button class="hud-btn highlight" style="font-size: 0.8rem; padding: 4px 8px;" onclick="app.promptAddPlanet()">+ ADD_PLANET</button>
            </div>
        `;

        const planets = this.getPlanets(this.currentSystem);
        if(planets.length > 0) {
            html += `
                <div class="system-3d-wrapper">
                    <div id="system-3d-canvas"></div>
                    <div class="system-canvas-overlay">// SYSTEM_PLANETS_SPACE</div>
                    <div class="system-canvas-hint">💡 點擊 3D 星球可直接切換檢視詳細數據與地標</div>
                </div>
            `;

            html += `<div class="planet-tabs" id="planet-tabs-container">`;
            planets.forEach(pName => {
                const activeCls = (pName === this.currentPlanet) ? 'active' : '';
                html += `
                    <div class="planet-tab ${activeCls}" onclick="app.selectPlanet('${pName}')">
                        <span>${pName}</span>
                        <span class="del-planet-btn" title="刪除星球" onclick="event.stopPropagation(); app.deletePlanet('${pName}')">✕</span>
                    </div>`;
            });
            html += `</div>`;

            // 獨立出星球詳細數據容器，方便局部更新 DOM
            html += `<div id="planet-detail-section"></div>`;
        } else {
            html += `<div style="color:var(--cyan-dim);">// NO PLANETARY DATA FOUND. ADD PLANET TO INITIALIZE.</div>`;
        }

        document.getElementById('main-content').innerHTML = html;

        if (planets.length > 0) {
            setTimeout(() => {
                const sysCanvas = document.getElementById('system-3d-canvas');
                if (sysCanvas) {
                    SystemPlanets3D.init(sysCanvas, sys, this.currentSystem, this.currentPlanet);
                }
                this.renderPlanetDetailSection();
            }, 50);
        }
    },

    selectPlanet(pName) {
        if (this.currentPlanet === pName) return;
        this.currentPlanet = pName;

        const sysCanvas = document.getElementById('system-3d-canvas');
        // 若是在同星系內切換星球且 3D Canvas 仍正常存在，實施局部更新以避免閃爍與銷毀 Context
        if (sysCanvas && SystemPlanets3D.currentSysName === this.currentSystem) {
            // 1. 觸發 3D 星球的 Lerp 漸變平滑縮放動畫
            SystemPlanets3D.setSelectedPlanet(pName);

            // 2. 更新 Planet Tab 樣式
            const tabContainer = document.getElementById('planet-tabs-container');
            if (tabContainer) {
                const tabs = tabContainer.querySelectorAll('.planet-tab');
                tabs.forEach(tab => {
                    const span = tab.querySelector('span');
                    if (span) {
                        tab.classList.toggle('active', span.textContent.trim() === pName);
                    }
                });
            }

            // 3. 局部更新星球詳細數據卡片與地標面板
            this.renderPlanetDetailSection();
        } else {
            this.renderSystemContent();
        }
    },

    renderPlanetDetailSection() {
        const detailContainer = document.getElementById('planet-detail-section');
        if (!detailContainer) return;

        const sys = this.data[this.currentSystem];
        if (!sys || !this.currentPlanet || !sys[this.currentPlanet]) {
            detailContainer.innerHTML = '';
            return;
        }

        const pData = sys[this.currentPlanet];
        detailContainer.innerHTML = `
            <div class="planet-container active">
                <div class="data-grid">
                    ${this.generatePlanetCardHTML(this.currentPlanet, '環境概覽', pData['環境概覽'], ['類型', '天氣', '巡警', '植物群', '動物群', '星球主色', '星球副色', '是否有星環'])}
                    ${this.generatePlanetCardHTML(this.currentPlanet, '自然資源', pData['自然資源'], ['植物', '礦物'])}
                </div>
                
                <div class="data-card" style="margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3>> 地標點與全像定位 (LANDMARKS & 3D NAV)</h3>
                        <button class="hud-btn" style="font-size: 0.8rem; padding: 2px 6px;" onclick="app.promptAddLandmark()">+ NEW_LANDMARK</button>
                    </div>
                    
                    <div class="landmarks-section-container">
                        <div class="planet-3d-wrapper">
                            <div id="planet-3d-canvas"></div>
                            <div class="canvas-overlay-tag">// HOLO_PLANET_NAV</div>
                        </div>
                        <div class="landmark-list-wrapper">
                            ${this.generateLandmarksListHTML(pData['地標點'])}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const planetCanvas = document.getElementById('planet-3d-canvas');
        if (planetCanvas) {
            Planet3D.init(planetCanvas);
            Planet3D.renderLandmarks(pData['地標點']);
        }
    },

    refreshSystem3D() {
        if(this.currentSystem && this.data[this.currentSystem]) {
            const sysCanvas = document.getElementById('system-3d-canvas');
            if(sysCanvas) {
                SystemPlanets3D.init(sysCanvas, this.data[this.currentSystem], this.currentSystem, this.currentPlanet);
            }
        }
    },

    renderFieldControl(type, pName, category, key, value) {
        const valOpts = (this.options && this.options.valueOptions) ? this.options.valueOptions[key] : null;
        const multiOpts = (this.options && this.options.multiSelectOptions) ? this.options.multiSelectOptions[key] : null;

        if (key.includes('色') || key.includes('顏色')) {
            const colorVal = value || (key.includes('主') ? '#00f3ff' : '#bc13fe');
            const changeHandler = type === 'sys' 
                ? `app.updateSysData('${category}', '${key}', this.value); app.refreshSystem3D();`
                : `app.updatePlanetData('${pName}', '${category}', '${key}', this.value); app.refreshSystem3D();`;

            return `
                <div class="color-picker-wrapper">
                    <input type="color" class="color-picker-input" value="${colorVal}" onchange="${changeHandler}">
                    <span class="color-val-text">${colorVal}</span>
                </div>
            `;
        }

        if (key === '是否有星環') {
            const ringVal = (value === true || value === '是' || value === 'true') ? '是' : '否';
            const changeHandler = type === 'sys' 
                ? `app.updateSysData('${category}', '${key}', this.value); app.refreshSystem3D();`
                : `app.updatePlanetData('${pName}', '${category}', '${key}', this.value); app.refreshSystem3D();`;

            return `
                <select class="hud-select" onchange="${changeHandler}">
                    <option value="否" ${ringVal === '否' ? 'selected' : ''}>否</option>
                    <option value="是" ${ringVal === '是' ? 'selected' : ''}>是 (含白色星環)</option>
                </select>
            `;
        }

        if (valOpts) {
            const currentVal = value || '';
            let hasCurrentInOpts = valOpts.includes(currentVal);
            let optsHtml = valOpts.map(opt => `<option value="${opt}" ${currentVal === opt ? 'selected' : ''}>${opt}</option>`).join('');
            let customOpt = (currentVal && !hasCurrentInOpts) ? `<option value="${currentVal}" selected>${currentVal} (自訂)</option>` : '';

            const changeHandler = type === 'sys' 
                ? `app.updateSysData('${category}', '${key}', this.value)`
                : `app.updatePlanetData('${pName}', '${category}', '${key}', this.value)`;

            return `
                <select class="hud-select" onchange="${changeHandler}">
                    <option value="">-- 請選擇 --</option>
                    ${customOpt}
                    ${optsHtml}
                </select>
            `;
        } else if (multiOpts) {
            let selectedArr = Array.isArray(value) ? value : (typeof value === 'string' && value.trim() ? value.split(',').map(s => s.trim()) : []);
            const unselectedOpts = multiOpts.filter(opt => !selectedArr.includes(opt));
            
            const badgesHtml = selectedArr.map(item => {
                const removeHandler = type === 'sys'
                    ? `app.removeSysMultiSelect('${category}', '${key}', '${item}')`
                    : `app.removePlanetMultiSelect('${pName}', '${category}', '${key}', '${item}')`;
                return `<span class="tag-chip">${item}<button class="tag-del" onclick="${removeHandler}">✕</button></span>`;
            }).join('');

            const addHandler = type === 'sys'
                ? `app.addSysMultiSelect('${category}', '${key}', this.value); this.value='';`
                : `app.addPlanetMultiSelect('${pName}', '${category}', '${key}', this.value); this.value='';`;

            return `
                <div class="multi-select-box">
                    <div class="tags-wrapper">${badgesHtml || '<span class="no-tags">// 未選擇</span>'}</div>
                    ${unselectedOpts.length > 0 ? `
                        <select class="hud-select mini-select" onchange="${addHandler}">
                            <option value="">+ 新增${key}...</option>
                            ${unselectedOpts.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    ` : ''}
                </div>
            `;
        } else {
            const inputHandler = type === 'sys'
                ? `app.updateSysData('${category}', '${key}', this.value)`
                : `app.updatePlanetData('${pName}', '${category}', '${key}', this.value)`;
            return `<input type="text" value="${value || ''}" oninput="${inputHandler}">`;
        }
    },

    generateCardHTML(sysName, category, dataObj, fields) {
        if(!dataObj) dataObj = {};
        let fieldsHtml = fields.map(f => `
            <div class="input-group">
                <label>${f}</label>
                ${this.renderFieldControl('sys', null, category, f, dataObj[f])}
            </div>
        `).join('');
        return `<div class="data-card"><h3>> ${category}</h3>${fieldsHtml}</div>`;
    },

    generatePlanetCardHTML(pName, category, dataObj, fields) {
        if(!dataObj) dataObj = {};
        let fieldsHtml = fields.map(f => `
            <div class="input-group">
                <label>${f}</label>
                ${this.renderFieldControl('planet', pName, category, f, dataObj[f])}
            </div>
        `).join('');
        return `<div class="data-card"><h3>> ${category}</h3>${fieldsHtml}</div>`;
    },

    generateLandmarksListHTML(landmarksObj) {
        if (!landmarksObj || Object.keys(landmarksObj).length === 0) {
            return `<div style="color:rgba(255,255,255,0.3); font-size:0.9rem; padding: 20px;">// NO LANDMARKS DETECTED. CLICK "+ NEW_LANDMARK" TO ADD.</div>`;
        }
        let rowsHtml = '';
        for (let lName in landmarksObj) {
            const lData = landmarksObj[lName];
            rowsHtml += `
            <div class="landmark-row-item" onclick="app.clickLandmarkRow('${lName}')" id="lm-row-${lName}">
                <div class="lm-col name"><span class="lm-icon">📍</span><strong class="lm-title">${lName}</strong></div>
                <div class="lm-col input-col"><label>類型</label><input type="text" value="${lData['類型']||''}" onclick="event.stopPropagation();" oninput="app.updateLandmarkData('${lName}', '類型', this.value)"></div>
                <div class="lm-col input-col"><label>經度</label><input type="text" value="${lData['經度']||''}" onclick="event.stopPropagation();" oninput="app.updateLandmarkData('${lName}', '經度', this.value); app.refresh3DLandmarks();"></div>
                <div class="lm-col input-col"><label>緯度</label><input type="text" value="${lData['緯度']||''}" onclick="event.stopPropagation();" oninput="app.updateLandmarkData('${lName}', '緯度', this.value); app.refresh3DLandmarks();"></div>
                <div class="lm-col action-col"><button class="del-btn-icon" onclick="event.stopPropagation(); app.deleteLandmark('${lName}')">✕</button></div>
            </div>`;
        }
        return `<div class="landmark-table">${rowsHtml}</div>`;
    },

    clickLandmarkRow(lName) {
        document.querySelectorAll('.landmark-row-item').forEach(el => el.classList.remove('active-lm'));
        const activeRow = document.getElementById(`lm-row-${lName}`);
        if(activeRow) activeRow.classList.add('active-lm');
        Planet3D.focusLandmark(lName);
        this.showLandmarkModal(lName);
    },

    showLandmarkModal(lName) {
        if(!this.currentSystem || !this.currentPlanet) return;
        const targetPlanet = this.data[this.currentSystem][this.currentPlanet];
        if(!targetPlanet || !targetPlanet['地標點'] || !targetPlanet['地標點'][lName]) return;

        const lData = targetPlanet['地標點'][lName];
        const modalBody = document.getElementById('landmark-modal-body');
        if(!modalBody) return;

        modalBody.innerHTML = `
            <div class="modal-info-item">
                <label>📍 地標名稱 (NAME)</label>
                <div class="info-value modal-title-val">${lName}</div>
            </div>
            <div class="modal-info-item">
                <label>🏷 類型 (TYPE)</label>
                <input type="text" value="${lData['類型'] || ''}" oninput="app.updateLandmarkFromModal('${lName}', '類型', this.value)">
            </div>
            <div class="modal-info-item">
                <label>🌐 經度 (LONGITUDE)</label>
                <input type="text" value="${lData['經度'] || ''}" oninput="app.updateLandmarkFromModal('${lName}', '經度', this.value)">
            </div>
            <div class="modal-info-item">
                <label>🌐 緯度 (LATITUDE)</label>
                <input type="text" value="${lData['緯度'] || ''}" oninput="app.updateLandmarkFromModal('${lName}', '緯度', this.value)">
            </div>
        `;

        const modal = document.getElementById('landmark-modal');
        if(modal) modal.classList.add('active');
    },

    updateLandmarkFromModal(lName, key, value) {
        this.updateLandmarkData(lName, key, value);
        // 同步更新列表中的欄位值，確保資訊一致
        const rowEl = document.getElementById(`lm-row-${lName}`);
        if(rowEl) {
            const inputs = rowEl.querySelectorAll('input');
            if(key === '類型' && inputs[0]) inputs[0].value = value;
            if(key === '經度' && inputs[1]) inputs[1].value = value;
            if(key === '緯度' && inputs[2]) inputs[2].value = value;
        }
        if(key === '經度' || key === '緯度') {
            this.refresh3DLandmarks();
        }
    },

    closeLandmarkModal() {
        const modal = document.getElementById('landmark-modal');
        if(modal) modal.classList.remove('active');
    },

    refresh3DLandmarks() {
        if(this.currentSystem && this.currentPlanet && this.data[this.currentSystem][this.currentPlanet]) {
            Planet3D.renderLandmarks(this.data[this.currentSystem][this.currentPlanet]['地標點']);
        }
    },

    updateSysData(category, key, value) {
        if(!this.data[this.currentSystem]) return;
        this.data[this.currentSystem][category][key] = value;
    },

    addSysMultiSelect(category, key, item) {
        if(!item || !this.currentSystem) return;
        if(!this.data[this.currentSystem][category]) this.data[this.currentSystem][category] = {};
        let current = this.data[this.currentSystem][category][key];
        let arr = Array.isArray(current) ? current : (current ? current.split(',').map(s=>s.trim()) : []);
        if(!arr.includes(item)) arr.push(item);
        this.data[this.currentSystem][category][key] = arr;
        this.renderSystemContent();
    },

    removeSysMultiSelect(category, key, item) {
        if(!this.currentSystem || !this.data[this.currentSystem][category]) return;
        let current = this.data[this.currentSystem][category][key];
        let arr = Array.isArray(current) ? current : (current ? current.split(',').map(s=>s.trim()) : []);
        this.data[this.currentSystem][category][key] = arr.filter(i => i !== item);
        this.renderSystemContent();
    },

    updatePlanetData(pName, category, key, value) {
        if(!this.data[this.currentSystem] || !this.data[this.currentSystem][pName]) return;
        this.data[this.currentSystem][pName][category][key] = value;
    },

    addPlanetMultiSelect(pName, category, key, item) {
        if(!item || !this.currentSystem || !this.data[this.currentSystem][pName]) return;
        if(!this.data[this.currentSystem][pName][category]) this.data[this.currentSystem][pName][category] = {};
        let current = this.data[this.currentSystem][pName][category][key];
        let arr = Array.isArray(current) ? current : (current ? current.split(',').map(s=>s.trim()) : []);
        if(!arr.includes(item)) arr.push(item);
        this.data[this.currentSystem][pName][category][key] = arr;
        this.renderPlanetDetailSection();
    },

    removePlanetMultiSelect(pName, category, key, item) {
        if(!this.currentSystem || !this.data[this.currentSystem][pName] || !this.data[this.currentSystem][pName][category]) return;
        let current = this.data[this.currentSystem][pName][category][key];
        let arr = Array.isArray(current) ? current : (current ? current.split(',').map(s=>s.trim()) : []);
        this.data[this.currentSystem][pName][category][key] = arr.filter(i => i !== item);
        this.renderPlanetDetailSection();
    },

    updateLandmarkData(lName, key, value) {
        if(!this.data[this.currentSystem] || !this.data[this.currentSystem][this.currentPlanet]) return;
        this.data[this.currentSystem][this.currentPlanet]['地標點'][lName][key] = value;
    },

    promptAddSystem() {
        const name = prompt("輸入新星系名稱:");
        if(!name || this.data[name]) return;
        this.data[name] = {
            "星系政治": { "優勢族群": "", "公會": "", "衝突程度": "" },
            "星系經濟": { "經濟類型": "", "經濟等級": "", "出售": "", "購買": "" }
        };
        this.selectSystem(name);
    },

    deleteSystem(name) {
        if(confirm(`確認刪除星系 ${name}?`)) {
            delete this.data[name];
            if(this.currentSystem === name) this.currentSystem = null;
            this.renderSidebar();
            if(!this.currentSystem) document.getElementById('main-content').innerHTML = `<div class="init-screen"><div class="glitch-text">SELECT SYSTEM TO BEGIN</div></div>`;
        }
    },

    promptAddPlanet() {
        if(!this.currentSystem) return;
        const name = prompt("輸入新星球名稱:");
        if(!name || this.data[this.currentSystem][name]) return;
        this.data[this.currentSystem][name] = {
            "環境概覽": {
                "類型": "",
                "天氣": "",
                "巡警": "",
                "植物群": "",
                "動物群": "",
                "星球主色": "#00f3ff",
                "星球副色": "#bc13fe",
                "是否有星環": "否"
            },
            "自然資源": { "植物": [], "礦物": [] },
            "地標點": {}
        };
        this.selectPlanet(name);
    },

    deletePlanet(pName) {
        if(!this.currentSystem) return;
        if(confirm(`確認刪除星球 [ ${pName} ] ？`)) {
            delete this.data[this.currentSystem][pName];
            const remaining = this.getPlanets(this.currentSystem);
            if(this.currentPlanet === pName) this.currentPlanet = remaining.length > 0 ? remaining[0] : null;
            this.renderSystemContent();
        }
    },

    promptAddLandmark() {
        if(!this.currentSystem || !this.currentPlanet) return;
        const name = prompt("輸入地標名稱 (例如: 某某基地):");
        if(!name) return;
        const target = this.data[this.currentSystem][this.currentPlanet]['地標點'];
        if(target[name]) return;
        target[name] = { "類型": "", "經度": "0", "緯度": "0" };
        this.renderPlanetDetailSection();
    },

    deleteLandmark(lName) {
        if(confirm(`刪除地標 ${lName}?`)) {
            delete this.data[this.currentSystem][this.currentPlanet]['地標點'][lName];
            this.renderPlanetDetailSection();
        }
    }
};

window.onload = () => {
    app.fetchData();
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') app.closeLandmarkModal();
    });
};