export class ShowView {
    constructor(containerId, onNodeUpdated) {
        this.container = document.getElementById(containerId);
        this.onNodeUpdated = onNodeUpdated;
        this.currentNode = null;
    }

    render(node) {
        this.currentNode = node;
        if (!node) {
            this.container.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:50px;">NO NODE SELECTED</div>';
            return;
        }

        const isFolder = node.type === 'folder';

        let html = `
            <div class="editor-header">
                <input type="text" id="edit-node-name" value="${node.name || ''}" placeholder="節點名稱">
                <span class="badge">${isFolder ? '資料夾 (Folder)' : '資料節點 (Data)'}</span>
            </div>
        `;

        if (isFolder) {
            const childCount = node.children ? node.children.length : 0;
            html += `<p style="color:var(--text-muted);">子項目數量：${childCount} 個</p>`;
        } else {
            node.attributes = node.attributes || {};
            const entries = Object.entries(node.attributes);

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="color:var(--text-light)">動態屬性列表 (Key-Value)</span>
                    <button class="hud-btn small" id="btn-add-attr">+ 增加屬性</button>
                </div>
                <table class="attr-table">
                    <thead>
                        <tr>
                            <th style="width:35%;">屬性名稱 (Key)</th>
                            <th>屬性值 (Value)</th>
                            <th style="width:12%;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="attr-body">
            `;

            entries.forEach(([key, val], idx) => {
                html += `
                    <tr data-idx="${idx}">
                        <td>
                            <input type="text" class="attr-input attr-key" value="${key}" placeholder="屬性名 (Key)">
                        </td>
                        <td>
                            <input type="text" class="attr-input attr-val" value="${val}" placeholder="屬性值 (Value)">
                        </td>
                        <td>
                            <button class="hud-btn small danger btn-del-attr">🗑 刪除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
        }

        this.container.innerHTML = html;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('edit-node-name')?.addEventListener('input', (e) => {
            if (this.currentNode) {
                this.currentNode.name = e.target.value;
                this.onNodeUpdated();
            }
        });

        if (this.currentNode?.type === 'folder') return;

        // 安全防護：避免重名 Key 被無預警覆蓋
        const syncAttributes = () => {
            const newAttrs = {};
            const rows = this.container.querySelectorAll('#attr-body tr');
            
            rows.forEach(row => {
                const keyInput = row.querySelector('.attr-key');
                const valInput = row.querySelector('.attr-val');
                let key = keyInput ? keyInput.value.trim() : '';
                const val = valInput ? valInput.value : '';
                
                if (key !== '') {
                    // 如果出現重複的 Key，自動加上數字標記，防止蓋掉資料
                    let originalKey = key;
                    let counter = 1;
                    while (newAttrs.hasOwnProperty(key)) {
                        key = `${originalKey}_${counter}`;
                        counter++;
                    }
                    newAttrs[key] = val;
                }
            });

            this.currentNode.attributes = newAttrs;
            this.onNodeUpdated();
        };

        this.container.querySelectorAll('.attr-key, .attr-val').forEach(input => {
            input.addEventListener('input', syncAttributes);
        });

        document.getElementById('btn-add-attr')?.addEventListener('click', () => {
            if (!this.currentNode.attributes) this.currentNode.attributes = {};
            
            let count = Object.keys(this.currentNode.attributes).length + 1;
            let newKey = `新屬性_${count}`;
            while (this.currentNode.attributes.hasOwnProperty(newKey)) {
                count++;
                newKey = `新屬性_${count}`;
            }

            this.currentNode.attributes[newKey] = '';
            this.render(this.currentNode);
            this.onNodeUpdated();
        });

        this.container.querySelectorAll('.btn-del-attr').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (row) {
                    row.remove();
                    syncAttributes();
                }
            });
        });
    }
}