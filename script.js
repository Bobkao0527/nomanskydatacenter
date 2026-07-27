// script.js
const API_URL = "https://script.google.com/macros/s/AKfycbwFFcjV3PdBDoJCqTYajl9tp3rvi07CyTGscz1EWe6rwWII0HgOiKwWnM447U63PNB_/exec";

// 3D 星球檢視器模組 (Three.js)
const Planet3D = {
    scene: null,
    camera: null,
    renderer: null,
    planetGroup: null,
    markersGroup: null,
    markersMap: {},
    isAutoRotating: true,
    targetRotationY: null,
    highlightTimeout: null,
    activeMarkerName: null,
    animFrameId: null,

    init(container) {
        if (!container) return;
        
        // 重新初始化前銷毀舊有動畫循環與渲染器
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

        // 外層網格
        const sphereGeo = new THREE.SphereGeometry(1.8, 24, 24);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            wireframe: true,
            transparent: true,
            opacity: 0.25
        });
        const wireSphere = new THREE.Mesh(sphereGeo, wireMat);
        this.planetGroup.add(wireSphere);

        // 核心發光點陣
        const innerGeo = new THREE.SphereGeometry(1.78, 16, 16);
        const innerMat = new THREE.PointsMaterial({
            color: 0xbc13fe,
            size: 0.03,
            transparent: true,
            opacity: 0.6
        });
        const innerSphere = new THREE.Points(innerGeo, innerMat);
        this.planetGroup.add(innerSphere);

        // 赤道環
        const ringGeo = new THREE.RingGeometry(1.81, 1.83, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        this.planetGroup.add(ring);

        this.markersGroup = new THREE.Group();
        this.planetGroup.add(this.markersGroup);

        this.animate();
    },

    latLonToVector3(lat, lon, radius = 1.82) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const z = (radius * Math.sin(phi) * Math.sin(theta));
        const y = (radius * Math.cos(phi));

        return new THREE.Vector3(x, y, z);
    },

    renderLandmarks(landmarksObj) {
        if (!this.markersGroup) return;

        while (this.markersGroup.children.length > 0) {
            this.markersGroup.remove(this.markersGroup.children[0]);
        }
        this.markersMap = {};

        if (!landmarksObj) return;

        for (let lName in landmarksObj) {
            const lData = landmarksObj[lName];
            const lat = parseFloat(lData['緯度']) || 0;
            const lon = parseFloat(lData['經度']) || 0;

            const pos = this.latLonToVector3(lat, lon);

            const markerGeo = new THREE.SphereGeometry(0.06, 12, 12);
            const markerMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
            const markerMesh = new THREE.Mesh(markerGeo, markerMat);
            markerMesh.position.copy(pos);

            const singleMarkerGroup = new THREE.Group();
            singleMarkerGroup.add(markerMesh);

            this.markersGroup.add(singleMarkerGroup);
            this.markersMap[lName] = { group: singleMarkerGroup, mesh: markerMesh, lat: lat, lon: lon };
        }
    },

    focusLandmark(lName) {
        const item = this.markersMap[lName];
        if (!item) return;

        const targetRad = -((item.lon + 180) * (Math.PI / 180)) + Math.PI / 2;
        this.targetRotationY = targetRad;
        this.isAutoRotating = false;

        this.resetHighlights();

        item.mesh.material.color.setHex(0xff003c);
        item.mesh.scale.set(2.2, 2.2, 2.2);
        this.activeMarkerName = lName;

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
        this.activeMarkerName = null;
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

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    destroy() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.highlightTimeout) {
            clearTimeout(this.highlightTimeout);
            this.highlightTimeout = null;
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }
};

const app = {
    data: {},
    options: {},
    currentSystem: null,
    currentPlanet: null,
    activeFilters: [], // 儲存當前發揮作用的篩選條件 [{ field: '天氣', value: '宜人' }, ...]

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
            this.renderSidebar();
            
            if(this.currentSystem && this.data[this.currentSystem]) {
                this.selectSystem(this.currentSystem);
            } else {
                this.currentSystem = null;
                document.getElementById('main-content').innerHTML = `<div class="init-screen"><div class="glitch-text">SELECT SYSTEM TO BEGIN</div></div>`;
            }
        } catch (err) {
            console.error(err);
            this.setStatus('ERR_CONNECTION', 'error');
        }
    },

    async saveData() {
        this.setStatus('UPLOADING...', 'error');
        try {
            const payload = {
                action: 'save_all',
                data: this.data
            };
            
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

    // --- 篩選控制邏輯 ---
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

        if(!selectedField) {
            valSelect.style.display = 'none';
            return;
        }

        let optsArr = [];
        if(this.options.valueOptions && this.options.valueOptions[selectedField]) {
            optsArr = this.options.valueOptions[selectedField];
        } else if(this.options.multiSelectOptions && this.options.multiSelectOptions[selectedField]) {
            optsArr = this.options.multiSelectOptions[selectedField];
        }

        valSelect.innerHTML = '<option value="">-- 選擇數值 --</option>';
        optsArr.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            valSelect.appendChild(opt);
        });

        valSelect.style.display = 'block';
    },

    addSelectedFilter() {
        const fieldSelect = document.getElementById('filter-field-select');
        const valSelect = document.getElementById('filter-value-select');
        const field = fieldSelect.value;
        const value = valSelect.value;

        if(!field || !value) return;

        // 避免重複新增相同的欄位值
        const exists = this.activeFilters.some(f => f.field === field && f.value === value);
        if(!exists) {
            this.activeFilters.push({ field, value });
        }

        // 重置選單狀態
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

    renderFilterTags() {
        const tagsContainer = document.getElementById('active-filters-tags');
        if(!tagsContainer) return;

        tagsContainer.innerHTML = '';
        this.activeFilters.forEach((f, idx) => {
            const chip = document.createElement('span');
            chip.className = 'filter-chip';
            chip.innerHTML = `${f.field}: <strong>${f.value}</strong> <button class="filter-del" onclick="app.removeFilter(${idx})">✕</button>`;
            tagsContainer.appendChild(chip);
        });
    },

    // 進行疊加條件計算，找出符合所有 Filter 的星球
    getFilteredPlanets() {
        if (this.activeFilters.length === 0) return null;

        const matchedList = []; // [{ sysName, pName }, ...]

        for (let sysName in this.data) {
            const sys = this.data[sysName];
            const planets = this.getPlanets(sysName);

            planets.forEach(pName => {
                const pData = sys[pName];
                let isMatch = true;

                for (let filter of this.activeFilters) {
                    const { field, value } = filter;
                    let fieldValue = null;

                    // 尋找對應屬性 (從星系層級或星球層級)
                    if (sys['星系政治'] && sys['星系政治'][field] !== undefined) fieldValue = sys['星系政治'][field];
                    else if (sys['星系經濟'] && sys['星系經濟'][field] !== undefined) fieldValue = sys['星系經濟'][field];
                    else if (pData['環境概覽'] && pData['環境概覽'][field] !== undefined) fieldValue = pData['環境概覽'][field];
                    else if (pData['自然資源'] && pData['自然資源'][field] !== undefined) fieldValue = pData['自然資源'][field];

                    // 比對邏輯
                    if (Array.isArray(fieldValue)) {
                        if (!fieldValue.includes(value)) { isMatch = false; break; }
                    } else if (typeof fieldValue === 'string') {
                        if (fieldValue.includes(',')) {
                            const arr = fieldValue.split(',').map(s => s.trim());
                            if (!arr.includes(value)) { isMatch = false; break; }
                        } else if (fieldValue !== value) {
                            isMatch = false; break;
                        }
                    } else {
                        isMatch = false; break;
                    }
                }

                if (isMatch) {
                    matchedList.push({ sysName, pName });
                }
            });
        }

        return matchedList;
    },

    renderSidebar() {
        const list = document.getElementById('system-list');
        list.innerHTML = '';

        const filteredPlanets = this.getFilteredPlanets();

        if (filteredPlanets !== null) {
            // === 顯示篩選模式（星球清單） ===
            if (filteredPlanets.length === 0) {
                list.innerHTML = `<li style="color:var(--danger); cursor:default;">// NO MATCHING PLANETS</li>`;
                return;
            }

            filteredPlanets.forEach(item => {
                const li = document.createElement('li');
                const isCurrent = (item.sysName === this.currentSystem && item.pName === this.currentPlanet);
                if (isCurrent) li.classList.add('active');

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
            // === 顯示預設模式（星系清單） ===
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
                <span>[ PLANETARY_DATA ]</span>
                <button class="hud-btn highlight" style="font-size: 0.8rem; padding: 4px 8px;" onclick="app.promptAddPlanet()">+ ADD_PLANET</button>
            </div>
        `;

        const planets = this.getPlanets(this.currentSystem);
        
        if(planets.length > 0) {
            html += `<div class="planet-tabs">`;
            planets.forEach(pName => {
                const activeCls = (pName === this.currentPlanet) ? 'active' : '';
                html += `
                    <div class="planet-tab ${activeCls}" onclick="app.selectPlanet('${pName}')">
                        <span>${pName}</span>
                        <span class="del-planet-btn" title="刪除星球" onclick="event.stopPropagation(); app.deletePlanet('${pName}')">✕</span>
                    </div>`;
            });
            html += `</div>`;

            if(this.currentPlanet && sys[this.currentPlanet]) {
                const pData = sys[this.currentPlanet];
                html += `<div class="planet-container active">
                    <div class="data-grid">
                        ${this.generatePlanetCardHTML(this.currentPlanet, '環境概覽', pData['環境概覽'], ['類型', '天氣', '巡警', '植物群', '動物群'])}
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
                </div>`;
            }
        } else {
            html += `<div style="color:var(--cyan-dim);">// NO PLANETARY DATA FOUND. ADD PLANET TO INITIALIZE.</div>`;
        }

        document.getElementById('main-content').innerHTML = html;

        if (this.currentPlanet && sys[this.currentPlanet]) {
            setTimeout(() => {
                const canvasContainer = document.getElementById('planet-3d-canvas');
                if (canvasContainer) {
                    Planet3D.init(canvasContainer);
                    Planet3D.renderLandmarks(sys[this.currentPlanet]['地標點']);
                }
            }, 50);
        }
    },

    selectPlanet(pName) {
        this.currentPlanet = pName;
        this.renderSystemContent();
    },

    renderFieldControl(type, pName, category, key, value) {
        const valOpts = (this.options && this.options.valueOptions) ? this.options.valueOptions[key] : null;
        const multiOpts = (this.options && this.options.multiSelectOptions) ? this.options.multiSelectOptions[key] : null;

        if (valOpts) {
            const currentVal = value || '';
            let hasCurrentInOpts = valOpts.includes(currentVal);
            let optsHtml = valOpts.map(opt => 
                `<option value="${opt}" ${currentVal === opt ? 'selected' : ''}>${opt}</option>`
            ).join('');
            
            let customOpt = (currentVal && !hasCurrentInOpts) 
                ? `<option value="${currentVal}" selected>${currentVal} (自訂)</option>` : '';

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
            let selectedArr = [];
            if (Array.isArray(value)) {
                selectedArr = value;
            } else if (typeof value === 'string' && value.trim() !== '') {
                selectedArr = value.split(',').map(s => s.trim());
            }

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

            const dropdownOpts = unselectedOpts.map(opt => `<option value="${opt}">${opt}</option>`).join('');

            return `
                <div class="multi-select-box">
                    <div class="tags-wrapper">
                        ${badgesHtml || '<span class="no-tags">// 未選擇</span>'}
                    </div>
                    ${unselectedOpts.length > 0 ? `
                        <select class="hud-select mini-select" onchange="${addHandler}">
                            <option value="">+ 新增${key}...</option>
                            ${dropdownOpts}
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
        
        return `<div class="data-card">
            <h3>> ${category}</h3>
            ${fieldsHtml}
        </div>`;
    },

    generatePlanetCardHTML(pName, category, dataObj, fields) {
        if(!dataObj) dataObj = {};
        let fieldsHtml = fields.map(f => `
            <div class="input-group">
                <label>${f}</label>
                ${this.renderFieldControl('planet', pName, category, f, dataObj[f])}
            </div>
        `).join('');
        
        return `<div class="data-card">
            <h3>> ${category}</h3>
            ${fieldsHtml}
        </div>`;
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
                <div class="lm-col name">
                    <span class="lm-icon">📍</span>
                    <strong class="lm-title">${lName}</strong>
                </div>
                <div class="lm-col input-col">
                    <label>類型</label>
                    <input type="text" value="${lData['類型']||''}" onclick="event.stopPropagation();" oninput="app.updateLandmarkData('${lName}', '類型', this.value)">
                </div>
                <div class="lm-col input-col">
                    <label>經度</label>
                    <input type="text" value="${lData['經度']||''}" onclick="event.stopPropagation();" oninput="app.updateLandmarkData('${lName}', '經度', this.value); app.refresh3DLandmarks();">
                </div>
                <div class="lm-col input-col">
                    <label>緯度</label>
                    <input type="text" value="${lData['緯度']||''}" onclick="event.stopPropagation();" oninput="app.updateLandmarkData('${lName}', '緯度', this.value); app.refresh3DLandmarks();">
                </div>
                <div class="lm-col action-col">
                    <button class="del-btn-icon" onclick="event.stopPropagation(); app.deleteLandmark('${lName}')">✕</button>
                </div>
            </div>`;
        }

        return `<div class="landmark-table">${rowsHtml}</div>`;
    },

    clickLandmarkRow(lName) {
        document.querySelectorAll('.landmark-row-item').forEach(el => el.classList.remove('active-lm'));
        const activeRow = document.getElementById(`lm-row-${lName}`);
        if(activeRow) activeRow.classList.add('active-lm');

        Planet3D.focusLandmark(lName);
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
        this.renderSystemContent();
    },

    removePlanetMultiSelect(pName, category, key, item) {
        if(!this.currentSystem || !this.data[this.currentSystem][pName] || !this.data[this.currentSystem][pName][category]) return;
        let current = this.data[this.currentSystem][pName][category][key];
        let arr = Array.isArray(current) ? current : (current ? current.split(',').map(s=>s.trim()) : []);
        this.data[this.currentSystem][pName][category][key] = arr.filter(i => i !== item);
        this.renderSystemContent();
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
            "環境概覽": { "類型": "", "天氣": "", "巡警": "", "植物群": "", "動物群": "" },
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
            if(this.currentPlanet === pName) {
                this.currentPlanet = remaining.length > 0 ? remaining[0] : null;
            }
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
        this.renderSystemContent();
    },

    deleteLandmark(lName) {
        if(confirm(`刪除地標 ${lName}?`)) {
            delete this.data[this.currentSystem][this.currentPlanet]['地標點'][lName];
            this.renderSystemContent();
        }
    }
};

window.onload = () => app.fetchData();