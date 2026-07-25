export class TreeView {
    constructor(containerId, onSelectNodeChange) {
        this.container = document.getElementById(containerId);
        this.onSelectNodeChange = onSelectNodeChange;
        this.treeData = {};
        this.selectedPath = null; // 儲存當前點擊的路徑 (以 '/' 隔開)
        this.expandedPaths = new Set();

        this.bindEvents();
    }

    // 判斷是否為 Data 節點 (如果 Value 內部全是字串/數值，沒有包物件)
    static isDataNode(obj) {
        if (typeof obj !== 'object' || obj === null) return false;
        const keys = Object.keys(obj);
        if (keys.length === 0) return false; // 空物件預設當作 Folder
        return keys.every(k => typeof obj[k] !== 'object' || obj[k] === null);
    }

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const label = e.target.closest('.node-label');
            if (!label) return;

            const li = label.parentElement;
            const path = li.dataset.path;

            this.selectNode(path);

            const hasChildren = li.querySelector('.tree-list');
            if (hasChildren) {
                li.classList.toggle('open');
                const isOpen = li.classList.contains('open');
                if (isOpen) {
                    this.expandedPaths.add(path);
                } else {
                    this.expandedPaths.delete(path);
                }
                const arrow = label.querySelector('.tree-arrow');
                if (arrow) arrow.textContent = isOpen ? '▼' : '▶';
            }
        });
    }

    // 透過路徑陣列在 Dictionary 中尋找目標物件
    getNodeByPath(pathArr) {
        let current = this.treeData;
        for (const key of pathArr) {
            if (current && current[key] !== undefined) {
                current = current[key];
            } else {
                return null;
            }
        }
        return current;
    }

    // 取得父節點物件與目標 Key
    getParentAndKey(pathArr) {
        if (pathArr.length === 0) return { parent: null, key: null };
        const key = pathArr[pathArr.length - 1];
        const parentPath = pathArr.slice(0, -1);
        const parent = parentPath.length === 0 ? this.treeData : this.getNodeByPath(parentPath);
        return { parent, key, parentPath };
    }

    selectNode(pathStr) {
        this.selectedPath = pathStr;
        this.container.querySelectorAll('.node-label').forEach(el => el.classList.remove('selected'));
        const targetLi = this.container.querySelector(`li[data-path="${CSS.escape(pathStr)}"]`);
        if (targetLi) {
            targetLi.querySelector('.node-label')?.classList.add('selected');
        }

        const pathArr = pathStr ? pathStr.split('/') : [];
        const nodeObj = pathArr.length > 0 ? this.getNodeByPath(pathArr) : this.treeData;
        const { key } = this.getParentAndKey(pathArr);

        this.onSelectNodeChange({
            pathStr,
            pathArr,
            nodeName: key || 'ROOT',
            data: nodeObj,
            isData: TreeView.isDataNode(nodeObj)
        });
    }

    // 新增 Folder 或 Data (修復命名與撞名邏輯)
    addNode(type, defaultContent, nodeName = '') {
        let parentObj = this.treeData;
        let parentPathArr = [];

        if (this.selectedPath) {
            const currentPathArr = this.selectedPath.split('/');
            const currentObj = this.getNodeByPath(currentPathArr);

            if (TreeView.isDataNode(currentObj)) {
                // 如果當前選到的是 Data，則新增到其同級的 Folder 內
                const { parent, parentPath } = this.getParentAndKey(currentPathArr);
                parentObj = parent;
                parentPathArr = parentPath;
            } else {
                // 如果當前是 Folder，新增至其底下
                parentObj = currentObj;
                parentPathArr = currentPathArr;
            }
        }

        // 1. 優先採用輸入的 nodeName，若沒輸入則用預設名稱
        const defaultName = type === 'folder' ? '新分類' : '新數據';
        const baseName = nodeName.trim() || defaultName;

        // 2. 判斷是否有同名 Key，沒重複就直接用原名，重複才補 _1, _2
        let newKey = baseName;
        let count = 1;
        while (parentObj.hasOwnProperty(newKey)) {
            newKey = `${baseName}_${count}`;
            count++;
        }

        // 寫入新節點
        parentObj[newKey] = JSON.parse(JSON.stringify(defaultContent));

        const newPathStr = [...parentPathArr, newKey].join('/');
        this.expandedPaths.add(parentPathArr.join('/'));
        
        this.render(this.treeData);
        this.selectNode(newPathStr);
    }

    deleteSelectedNode() {
        if (!this.selectedPath) return false;
        const pathArr = this.selectedPath.split('/');
        const { parent, key } = this.getParentAndKey(pathArr);

        if (parent && key && parent.hasOwnProperty(key)) {
            delete parent[key];
            this.expandedPaths.delete(this.selectedPath);
            this.selectedPath = null;
            this.render(this.treeData);
            return true;
        }
        return false;
    }

    render(treeData) {
        this.treeData = treeData || {};

        const buildHtml = (obj, currentPathArr = []) => {
            let html = '<ul class="tree-list">';
            const keys = Object.keys(obj);

            keys.forEach(key => {
                const val = obj[key];
                const isData = TreeView.isDataNode(val);
                const isFolder = !isData;
                const pathArr = [...currentPathArr, key];
                const pathStr = pathArr.join('/');
                
                const isSelected = pathStr === this.selectedPath ? 'selected' : '';
                const isOpen = this.expandedPaths.has(pathStr) ? 'open' : '';
                const hasChildren = isFolder && Object.keys(val).length > 0;

                html += `
                    <li class="tree-item ${isOpen}" data-path="${pathStr}">
                        <div class="node-label ${isFolder ? 'node-folder' : 'node-data'} ${isSelected}">
                            <span class="tree-arrow">${isFolder ? (hasChildren ? (isOpen ? '▼' : '▶') : '▶') : '-'}</span>
                            <span class="node-icon">${isFolder ? '📁' : '📄'}</span>
                            <span class="node-title">${key}</span>
                        </div>
                        ${isFolder ? buildHtml(val, pathArr) : ''}
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };

        this.container.innerHTML = buildHtml(this.treeData);
    }
}