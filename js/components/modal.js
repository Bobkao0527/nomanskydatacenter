import { addData } from '../services/db-service.js';

export class ModalView {
    constructor(systemsData, onSuccess) {
        this.modal = document.getElementById('data-modal');
        this.typeSelect = document.getElementById('form-data-type');
        this.formContainer = document.getElementById('dynamic-form-fields');
        this.systemsData = systemsData;
        this.onSuccess = onSuccess;

        this.bindEvents();
        this.renderFormFields('system'); // 預設渲染星系表單
    }

    updateData(systems) {
        this.systemsData = systems;
    }

    open() { this.modal.classList.remove('hidden'); }
    close() { this.modal.classList.add('hidden'); }

    bindEvents() {
        document.getElementById('btn-close-modal').addEventListener('click', () => this.close());
        this.typeSelect.addEventListener('change', (e) => this.renderFormFields(e.target.value));
        
        document.getElementById('btn-submit-form').addEventListener('click', async () => {
            const type = this.typeSelect.value;
            const data = this.collectFormData(type);
            if (!data) return; // 驗證未過

            const collectionMap = { 'system': 'systems', 'planet': 'planets', 'waypoint': 'waypoints' };
            document.getElementById('btn-submit-form').textContent = "UPLOADING...";
            try {
                await addData(collectionMap[type], data);
                this.close();
                this.onSuccess(); // 通知主程式重新抓資料
            } catch(e) {
                alert("上傳失敗，請確認 Firebase 設定或網路連線");
            } finally {
                document.getElementById('btn-submit-form').textContent = "UPLOAD DATA";
            }
        });
    }

    renderFormFields(type) {
        let html = '';
        if (type === 'system') {
            html = `
                <div class="form-group"><label>星系名稱</label><input type="text" id="i-name" class="hud-input" required></div>
                <div class="form-group"><label>買/賣%</label><input type="text" id="i-trade" class="hud-input" placeholder="+10% / -5%"></div>
                <div class="form-group"><label>衝突等級</label><input type="text" id="i-conflict" class="hud-input"></div>
                <div class="form-group"><label>優勢種族</label><input type="text" id="i-race" class="hud-input"></div>
                <div class="form-group"><label>經濟等級</label><input type="text" id="i-econ-level" class="hud-input"></div>
            `;
        } else if (type === 'planet') {
            const sysOptions = this.systemsData.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            html = `
                <div class="form-group"><label>所屬星系</label><select id="i-sysId" class="hud-input">${sysOptions}</select></div>
                <div class="form-group"><label>星球名稱</label><input type="text" id="i-name" class="hud-input" required></div>
                <div class="form-group"><label>星球類型</label><input type="text" id="i-type" class="hud-input" placeholder="輻射 / 繁茂..."></div>
                <div class="form-group"><label>天氣類型</label><input type="text" id="i-weather" class="hud-input"></div>
                <div class="form-group"><label>盛產資源 (用逗號分隔)</label><input type="text" id="i-resources" class="hud-input" placeholder="銅, 鈾, 磁化鐵氧體"></div>
            `;
        } else if (type === 'waypoint') {
            let plOptions = '';
            this.systemsData.forEach(s => {
                if(s.planets) s.planets.forEach(p => plOptions += `<option value="${p.id}">${s.name} - ${p.name}</option>`);
            });
            html = `
                <div class="form-group"><label>所屬星球</label><select id="i-plId" class="hud-input">${plOptions}</select></div>
                <div class="form-group"><label>標記名稱</label><input type="text" id="i-name" class="hud-input" required></div>
                <div class="form-group"><label>類型</label><input type="text" id="i-type" class="hud-input" placeholder="交易站 / 墜毀船..."></div>
                <div class="form-group"><label>緯度 (Lat)</label><input type="text" id="i-lat" class="hud-input"></div>
                <div class="form-group"><label>經度 (Lng)</label><input type="text" id="i-lng" class="hud-input"></div>
            `;
        }
        this.formContainer.innerHTML = html;
    }

    collectFormData(type) {
        const getVal = (id) => document.getElementById(id)?.value || '';
        const name = getVal('i-name');
        if(!name) { alert("名稱為必填"); return null; }

        if (type === 'system') {
            return { name, tradeRate: getVal('i-trade'), conflict: getVal('i-conflict'), race: getVal('i-race'), economyLevel: getVal('i-econ-level') };
        } else if (type === 'planet') {
            const res = getVal('i-resources').split(',').map(s=>s.trim()).filter(s=>s);
            return { systemId: getVal('i-sysId'), name, type: getVal('i-type'), weather: getVal('i-weather'), resources: res };
        } else {
            return { planetId: getVal('i-plId'), name, type: getVal('i-type'), lat: getVal('i-lat'), lng: getVal('i-lng') };
        }
    }
}
