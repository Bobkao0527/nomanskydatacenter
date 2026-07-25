import { PlanetSphere } from './sphere.js';

export class VisualView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.btnBack = document.getElementById('btn-view-back');
        this.pathDisplay = document.getElementById('view-path-display');
        this.infoPanel = document.getElementById('view-info-panel');
        this.contentArea = document.getElementById('view-content-area');
        
        this.rawDictData = null;
        this.currentPath = []; // [] = 宇宙, ['星系'], ['星系', '星球']
        
        this.btnBack.addEventListener('click', () => {
            if (this.currentPath.length > 0) {
                this.currentPath.pop();
                this.renderLevel();
            }
        });
    }

    render(data) {
        this.rawDictData = data;
        this.currentPath = [];
        this.renderLevel();
    }

    // 取得當前路徑下的資料物件
    getCurrentData() {
        let current = this.rawDictData;
        for (const key of this.currentPath) {
            if (current && current[key]) current = current[key];
            else return null;
        }
        return current;
    }

    // 判斷是否為「資料節點」(非目錄)
    isDataNode(obj) {
        if (typeof obj !== 'object' || obj === null) return false;
        const keys = Object.keys(obj);
        if (keys.length === 0) return false;
        return keys.every(k => typeof obj[k] !== 'object' || obj[k] === null);
    }

    renderLevel() {
        const data = this.getCurrentData();
        if (!data) return;

        // 更新導航列
        this.btnBack.style.display = this.currentPath.length > 0 ? 'block' : 'none';
        this.pathDisplay.textContent = this.currentPath.length === 0 
            ? '[ 宇宙全覽 : 星系資料庫 ]' 
            : `[ ${this.currentPath.join(' / ')} ]`;

        // 將子項目分類為「屬性資料」(Info) 與「子目錄」(Children)
        const infos = {};
        const children = {};
        const landmarks = []; // 專門收集含有經緯度的地標點

        Object.entries(data).forEach(([key, val]) => {
            if (this.isDataNode(val)) {
                if (val['經度'] !== undefined && val['緯度'] !== undefined) {
                    landmarks.push({ name: key, ...val });
                } else {
                    infos[key] = val;
                }
            } else {
                children[key] = val;
            }
        });

        this.renderInfoPanel(infos);

        const level = this.currentPath.length;
        this.contentArea.innerHTML = '';

        if (level === 0 || level === 1) {
            // 第1層(宇宙) 或 第2層(星系)：呈現子項目(星系或星球)卡片列表
            this.renderList(Object.keys(children), level === 0 ? '🌌' : '🪐');
        } else if (level === 2) {
            // 第3層(星球)：呈現 3D 球體與地標列表
            this.renderPlanetInteractive(landmarks);
        }
    }

    renderInfoPanel(infos) {
        if (Object.keys(infos).length === 0) {
            this.infoPanel.style.display = 'none';
            return;
        }
        this.infoPanel.style.display = 'grid';
        this.infoPanel.innerHTML = '';
        
        Object.entries(infos).forEach(([title, attrs]) => {
            let html = `<div class="info-block"><div class="info-title">■ ${title}</div>`;
            Object.entries(attrs).forEach(([k, v]) => {
                html += `<div class="info-item"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`;
            });
            html += `</div>`;
            this.infoPanel.innerHTML += html;
        });
    }

    renderList(items, icon) {
        const listDiv = document.createElement('div');
        listDiv.className = 'view-list-container';
        
        if (items.length === 0) {
            listDiv.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: var(--text-muted);">無觀測資料</div>';
        } else {
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'view-card';
                card.innerHTML = `<h2>${icon}</h2><div style="margin-top:10px;">${item}</div>`;
                card.addEventListener('click', () => {
                    this.currentPath.push(item);
                    this.renderLevel();
                });
                listDiv.appendChild(card);
            });
        }
        this.contentArea.appendChild(listDiv);
    }

    renderPlanetInteractive(landmarks) {
        const grid = document.createElement('div');
        grid.className = 'planet-view-grid';
        
        // 左側 Canvas 容器
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'canvas-container';
        const canvas = document.createElement('canvas');
        canvas.id = 'planet-canvas';
        canvasContainer.appendChild(canvas);
        
        // 右側地標列表
        const listContainer = document.createElement('div');
        listContainer.className = 'landmark-list';
        
        grid.appendChild(canvasContainer);
        grid.appendChild(listContainer);
        this.contentArea.appendChild(grid);

        // 初始化 3D 球體
        const sphere = new PlanetSphere(canvas, landmarks);

        if (landmarks.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text-muted); text-align:center; margin-top:20px;">尚無紀錄地標</div>';
        } else {
            landmarks.forEach(lm => {
                const div = document.createElement('div');
                div.className = 'landmark-item';
                div.innerHTML = `
                    <div style="color:var(--text-main); font-weight:bold;">📍 ${lm.name}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:5px;">
                        類型: ${lm['類型'] || '未知'} | 經度: ${lm['經度']} | 緯度: ${lm['緯度']}
                    </div>
                `;
                div.addEventListener('click', () => {
                    document.querySelectorAll('.landmark-item').forEach(el => el.classList.remove('active'));
                    div.classList.add('active');
                    sphere.highlightLandmark(lm.name);
                });
                listContainer.appendChild(div);
            });
        }
    }
}