export class ShowView {
    constructor(containerId, schemaConfig, onNodeUpdated) {
        this.container = document.getElementById(containerId);
        this.schemaConfig = schemaConfig || {};
        this.onNodeUpdated = onNodeUpdated;
        this.currentInfo = null;
    }

    render(nodeInfo) {
        this.currentInfo = nodeInfo;
        if (!nodeInfo || !nodeInfo.pathStr) {
            this.container.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:50px;">NO NODE SELECTED</div>';
            return;
        }

        const { nodeName, data, isData } = nodeInfo;
        const valueOptionsConfig = this.schemaConfig.valueOptions || {};
        const multiSelectConfig = this.schemaConfig.multiSelectOptions || {}; // 👈 1. 新增：取得多選設定

        let html = `
            <div class="editor-header">
                <input type="text" id="edit-node-name" value="${nodeName}" placeholder="節點名稱">
                <span class="badge">${!isData ? '分類目錄 (Folder)' : '資料欄位 (Data)'}</span>
            </div>
        `;

        if (!isData) {
            const childCount = Object.keys(data || {}).length;
            html += `<p style="color:var(--text-muted);">內部包含子項目：${childCount} 個</p>`;
        } else {
            const entries = Object.entries(data || {});

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="color:var(--text-light)">屬性表單 (Key-Value)</span>
                    <button class="hud-btn small" id="btn-add-attr">+ 增加自訂屬性</button>
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
                const multiOptions = multiSelectConfig[key]; // 👈 取出多選選項
                const options = valueOptionsConfig[key];      // 取出單選選項
                let valueControlHtml = '';

                // 👈 2. 優先判斷：如果是多選標籤欄位 (例如：礦物、植物)
                if (multiOptions && Array.isArray(multiOptions)) {
                    // 將當前字串切割成陣列 (例如 "鈉, 銅" -> ["鈉", "銅"])
                    const selectedList = val ? String(val).split(',').map(s => s.trim()) : [];

                    const tagsHtml = multiOptions.map(opt => {
                        const isSelected = selectedList.includes(opt);
                        return `<button type="button" class="tag-btn ${isSelected ? 'tag-active' : ''}" data-tag="${opt}">${opt}</button>`;
                    }).join('');

                    valueControlHtml = `
                        <div class="tag-group-container">
                            ${tagsHtml}
                        </div>
                        <!-- 隱藏的 input 用來跟既有的同步邏輯接軌 -->
                        <input type="hidden" class="attr-input attr-val" value="${val}">
                    `;
                } 
                // 次要判斷：單選下拉選單
                else if (options && Array.isArray(options)) {
                    let selectOptionsHtml = options.map(opt => {
                        const selected = (val === opt) ? 'selected' : '';
                        return `<option value="${opt}" ${selected}>${opt}</option>`;
                    }).join('');

                    if (val && !options.includes(val)) {
                        selectOptionsHtml = `<option value="${val}" selected>${val} (自訂)</option>` + selectOptionsHtml;
                    }

                    valueControlHtml = `
                        <select class="attr-input attr-val">
                            ${selectOptionsHtml}
                        </select>
                    `;
                } 
                // 預設：普通純文字框
                else {
                    valueControlHtml = `
                        <input type="text" class="attr-input attr-val" value="${val}" placeholder="屬性值 (Value)">
                    `;
                }

                html += `
                    <tr data-idx="${idx}">
                        <td>
                            <input type="text" class="attr-input attr-key" value="${key}" placeholder="屬性名 (Key)">
                        </td>
                        <td>
                            ${valueControlHtml}
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
        // 重命名節點 Key
        document.getElementById('edit-node-name')?.addEventListener('change', (e) => {
            const newName = e.target.value.trim();
            if (newName && newName !== this.currentInfo.nodeName) {
                this.onNodeUpdated({
                    action: 'rename_node',
                    pathArr: this.currentInfo.pathArr,
                    newName: newName
                });
            }
        });

        if (!this.currentInfo.isData) return;

        // 同步 DOM 輸入資料至內部物件
        const syncAttributes = () => {
            const newAttrs = {};
            const rows = this.container.querySelectorAll('#attr-body tr');

            rows.forEach(row => {
                const keyInput = row.querySelector('.attr-key');
                const valInput = row.querySelector('.attr-val');
                let key = keyInput ? keyInput.value.trim() : '';
                const val = valInput ? valInput.value : '';

                if (key !== '') {
                    let originalKey = key;
                    let counter = 1;
                    while (newAttrs.hasOwnProperty(key)) {
                        key = `${originalKey}_${counter}`;
                        counter++;
                    }
                    newAttrs[key] = val;
                }
            });

            for (const k in this.currentInfo.data) delete this.currentInfo.data[k];
            Object.assign(this.currentInfo.data, newAttrs);
            
            this.onNodeUpdated({ action: 'update_data' });
        };

        // 當 Key 或 Value (Input/Select) 改變時，同步觸發資料寫回
        this.container.querySelectorAll('.attr-key, .attr-val').forEach(input => {
            input.addEventListener('input', syncAttributes);
            input.addEventListener('change', (e) => {
                // 如果是 Key 改變了，重新渲染畫面讓它有機會匹配到新的 <select> 選單
                if (e.target.classList.contains('attr-key')) {
                    this.render(this.currentInfo);
                }
                syncAttributes();
            });
        });

        // 👈 新增：多選標籤 (Tag Button) 點擊切換事件
        this.container.querySelectorAll('.tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagBtn = e.currentTarget;
                const td = tagBtn.closest('td'); // 精準抓取當前這格表格
                const hiddenInput = td?.querySelector('.attr-val');

                // 1. 切換點亮/熄滅狀態
                tagBtn.classList.toggle('tag-active');

                // 2. 收集所有點亮的標籤
                const activeTags = Array.from(td.querySelectorAll('.tag-btn.tag-active'))
                                        .map(b => b.dataset.tag);

                // 3. 更新隱藏欄位並觸發資料寫回
                if (hiddenInput) {
                    hiddenInput.value = activeTags.join(', ');
                }
                syncAttributes();
            });
        });

        // 新增屬性
        document.getElementById('btn-add-attr')?.addEventListener('click', () => {
            let count = Object.keys(this.currentInfo.data).length + 1;
            let newKey = `新屬性_${count}`;
            while (this.currentInfo.data.hasOwnProperty(newKey)) {
                count++;
                newKey = `新屬性_${count}`;
            }

            this.currentInfo.data[newKey] = '';
            this.render(this.currentInfo);
            this.onNodeUpdated({ action: 'update_data' });
        });

        // 刪除屬性
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