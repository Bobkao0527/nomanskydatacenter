import { TreeView } from './tree.js';
import { ShowView } from './show.js';

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyQ2UUfi5r-L3uuPv0hqskdjItB2p7rFE-RPajC2G5g9QpOSSY583hAI8oo-_FJQTz0/exec';

document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('sys-status');
    let schemaConfig = {};
    let rawDictData = {};
    let isDirty = false;

    const markDirty = () => {
        isDirty = true;
        if (statusEl.textContent !== 'SAVING...') {
            statusEl.textContent = 'UNSAVED_CHANGES';
            statusEl.className = 'status-error';
        }
    };

    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // 1. 載入 schema.json 預填選單與樣板
    try {
        const schemaRes = await fetch('./schema.json');
        schemaConfig = await schemaRes.json();
    } catch (err) {
        console.error("Schema 載入失敗:", err);
    }

    // 2. 初始化 View 面板
    const showView = new ShowView('data-display', schemaConfig, (evt) => {
        markDirty();

        // 處理節點重命名
        if (evt.action === 'rename_node') {
            const { pathArr, newName } = evt;
            const { parent, key, parentPath } = treeView.getParentAndKey(pathArr);
            if (parent && key && newName && key !== newName) {
                const targetVal = parent[key];
                delete parent[key];
                parent[newName] = targetVal;

                // 重新刷新並定位到新 Key 的路徑
                const newPathStr = [...parentPath, newName].join('/');
                treeView.render(rawDictData);
                treeView.selectNode(newPathStr);
            }
        } else {
            treeView.render(rawDictData);
        }
    });

    const treeView = new TreeView('tree-root', (selectedInfo) => {
        showView.render(selectedInfo);
    });

    // 3. 綁定「樣板新增」按鈕事件
    
    // 🌌 新增星系 (放最頂層)
    document.getElementById('btn-add-galaxy')?.addEventListener('click', () => {
        const name = prompt("請輸入新星系名稱：", "新星系");
        if (!name) return;

        const template = schemaConfig.galaxyTemplate || {};
        rawDictData[name] = JSON.parse(JSON.stringify(template));
        markDirty();
        treeView.render(rawDictData);
        treeView.selectNode(name);
    });

    // 🪐 新增星球
    document.getElementById('btn-add-planet')?.addEventListener('click', () => {
        const name = prompt("請輸入新星球名稱：", "新星球");
        if (!name) return;

        const template = schemaConfig.planetTemplate || {};
        treeView.addNode('folder', template, name);
        markDirty();
    });

    // 📍 新增地標 / 基地
    document.getElementById('btn-add-landmark')?.addEventListener('click', () => {
        const name = prompt("請輸入地標或基地名稱：", "新基地");
        if (!name) return;

        const template = schemaConfig.landmarkTemplate || {};
        treeView.addNode('data', template, name);
        markDirty();
    });

    // 🗑 刪除選取項目
    document.getElementById('btn-delete-node')?.addEventListener('click', () => {
        if (confirm("確定要刪除當前選取的項目及其內容？")) {
            treeView.deleteSelectedNode();
            markDirty();
            showView.render(null);
        }
    });

    // 4. 儲存至 GAS (直接存純 Dictionary JSON)
    document.getElementById('btn-sync-cloud')?.addEventListener('click', async () => {
        try {
            statusEl.textContent = 'SAVING...';
            statusEl.className = '';

            const res = await fetch(GAS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'save_all', data: rawDictData })
            });

            const result = await res.json();
            if (result.status === 'success') {
                isDirty = false;
                statusEl.textContent = 'DB_ONLINE';
                statusEl.className = 'status-ok';
                alert('數據已順利同步至 Google Sheets！');
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            console.error('Save failed:', err);
            statusEl.textContent = 'SYNC_ERROR';
            statusEl.className = 'status-error';
            alert('雲端同步失敗！');
        }
    });

    // 5. 初始化載入雲端資料
    const loadInitialData = async () => {
        try {
            statusEl.textContent = 'FETCHING...';
            const res = await fetch(GAS_API_URL);
            rawDictData = await res.json();

            // 若空資料，帶入預設範本
            if (!rawDictData || typeof rawDictData !== 'object' || Array.isArray(rawDictData)) {
                rawDictData = {
                    "賽博坦星系": schemaConfig.galaxyTemplate || {}
                };
            }

            isDirty = false;
            statusEl.textContent = 'DB_ONLINE';
            statusEl.className = 'status-ok';
            treeView.render(rawDictData);
        } catch (err) {
            console.error('Load initial data error:', err);
            statusEl.textContent = 'DB_OFFLINE';
            statusEl.className = 'status-error';
        }
    };

    await loadInitialData();
});