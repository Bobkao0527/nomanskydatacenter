import { TreeView } from './tree.js';
import { ShowView } from './show.js';

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzCYjYjzbaGo89GRhkMtO2MLbfgX71xNghxTT1WF20JUXFF4qjtmJVhxpfS3UVEf-oj/exec';

document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('sys-status');
    let schemaConfig = {};
    let rawTreeData = [];
    let isDirty = false; // 未儲存狀態標記

    const markDirty = () => {
        isDirty = true;
        if (statusEl.textContent !== 'SAVING...') {
            statusEl.textContent = 'UNSAVED_CHANGES';
            statusEl.className = 'status-error';
        }
    };

    // 視窗關閉前保護機制
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    try {
        const schemaRes = await fetch('./schema.json');
        schemaConfig = await schemaRes.json();
    } catch (err) {
        console.error("Schema 載入失敗:", err);
    }

    const showView = new ShowView('data-display', () => {
        markDirty();
        treeView.render(rawTreeData);
    });

    const treeView = new TreeView('tree-root', (selectedNode) => {
        showView.render(selectedNode);
    });

    document.getElementById('btn-add-folder')?.addEventListener('click', () => {
        const newFolder = treeView.addNode('folder', schemaConfig.defaultFolder || { name: '新資料夾', children: [] });
        markDirty();
        showView.render(newFolder);
    });

    document.getElementById('btn-add-data')?.addEventListener('click', () => {
        const newData = treeView.addNode('data', schemaConfig.defaultData || { name: '新資料', attributes: {} });
        markDirty();
        showView.render(newData);
    });

    document.getElementById('btn-delete-node')?.addEventListener('click', () => {
        if (confirm("確定要刪除當前選取的節點及其內部所有資料？")) {
            treeView.deleteSelectedNode();
            markDirty();
            showView.render(null);
        }
    });

    document.getElementById('search-input')?.addEventListener('input', (e) => {
        treeView.filter(e.target.value);
    });

    document.getElementById('btn-sync-cloud')?.addEventListener('click', async () => {
        try {
            statusEl.textContent = 'SAVING...';
            statusEl.className = '';

            const res = await fetch(GAS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'save_all', data: rawTreeData })
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
            alert('雲端同步失敗，請確認網路連線或權限設定！');
        }
    });

    const loadInitialData = async () => {
        try {
            statusEl.textContent = 'FETCHING...';
            const res = await fetch(GAS_API_URL);
            rawTreeData = await res.json();

            if (!Array.isArray(rawTreeData) || rawTreeData.length === 0) {
                rawTreeData = [{ id: 'root_1', name: '預設目錄', type: 'folder', children: [] }];
            }

            isDirty = false;
            statusEl.textContent = 'DB_ONLINE';
            statusEl.className = 'status-ok';
            treeView.render(rawTreeData);
        } catch (err) {
            console.error('Load initial data error:', err);
            statusEl.textContent = 'DB_OFFLINE';
            statusEl.className = 'status-error';
        }
    };

    await loadInitialData();
});