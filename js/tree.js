export class TreeView {
    constructor(containerId, onSelectNodeChange) {
        this.container = document.getElementById(containerId);
        this.onSelectNodeChange = onSelectNodeChange;
        this.treeData = [];
        this.selectedNodeId = null;
        // 紀錄展開狀態的資料夾 ID 集合
        this.expandedNodeIds = new Set();

        this.bindEvents();
    }

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const label = e.target.closest('.node-label');
            if (!label) return;

            const li = label.parentElement;
            const nodeId = li.dataset.id;

            this.selectNode(nodeId);

            // 切換折疊狀態並紀錄
            const hasChildren = li.querySelector('.tree-list');
            if (hasChildren) {
                li.classList.toggle('open');
                const isOpen = li.classList.contains('open');
                if (isOpen) {
                    this.expandedNodeIds.add(nodeId);
                } else {
                    this.expandedNodeIds.delete(nodeId);
                }
                const arrow = label.querySelector('.tree-arrow');
                if (arrow) arrow.textContent = isOpen ? '▼' : '▶';
            }
        });
    }

    selectNode(nodeId) {
        this.selectedNodeId = nodeId;
        this.container.querySelectorAll('.node-label').forEach(el => el.classList.remove('selected'));
        const targetLi = this.container.querySelector(`li[data-id="${nodeId}"]`);
        if (targetLi) {
            const label = targetLi.querySelector('.node-label');
            label?.classList.add('selected');
        }

        const nodeObj = this.findNodeById(this.treeData, nodeId);
        this.onSelectNodeChange(nodeObj);
    }

    findNodeById(nodes, id) {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children && node.children.length > 0) {
                const found = this.findNodeById(node.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    findParentNode(nodes, targetId, parent = null) {
        for (const node of nodes) {
            if (node.id === targetId) return parent;
            if (node.children) {
                const found = this.findParentNode(node.children, targetId, node);
                if (found) return found;
            }
        }
        return null;
    }

    addNode(type, defaultTemplate) {
        const newNode = {
            id: 'node_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            ...JSON.parse(JSON.stringify(defaultTemplate)),
            type: type
        };

        if (!this.selectedNodeId) {
            this.treeData.push(newNode);
        } else {
            const targetNode = this.findNodeById(this.treeData, this.selectedNodeId);
            if (targetNode.type === 'folder') {
                targetNode.children = targetNode.children || [];
                targetNode.children.push(newNode);
                // 新增目標是 Folder，自動展開該 Folder
                this.expandedNodeIds.add(targetNode.id);
            } else {
                const parentNode = this.findParentNode(this.treeData, this.selectedNodeId);
                if (parentNode) {
                    parentNode.children.push(newNode);
                } else {
                    this.treeData.push(newNode);
                }
            }
        }

        this.render(this.treeData);
        // 新增完成後，自動將指標 focus 到新節點上
        this.selectNode(newNode.id);
        return newNode;
    }

    deleteSelectedNode() {
        if (!this.selectedNodeId) return false;

        const removeRecursive = (nodes, id) => {
            const index = nodes.findIndex(n => n.id === id);
            if (index !== -1) {
                nodes.splice(index, 1);
                return true;
            }
            for (const node of nodes) {
                if (node.children && removeRecursive(node.children, id)) return true;
            }
            return false;
        };

        const success = removeRecursive(this.treeData, this.selectedNodeId);
        if (success) {
            this.expandedNodeIds.delete(this.selectedNodeId);
            this.selectedNodeId = null;
            this.render(this.treeData);
        }
        return success;
    }

    filter(keyword) {
        const lowerKw = keyword.toLowerCase();
        const items = this.container.querySelectorAll('.tree-item');

        if (!keyword) {
            items.forEach(item => item.classList.remove('hidden'));
            return;
        }

        items.forEach(item => {
            const labelText = item.querySelector('.node-title').textContent.toLowerCase();
            if (labelText.includes(lowerKw)) {
                item.classList.remove('hidden');
                let parent = item.parentElement.closest('.tree-item');
                while (parent) {
                    parent.classList.remove('hidden');
                    parent.classList.add('open');
                    parent = parent.parentElement.closest('.tree-item');
                }
            } else {
                item.classList.add('hidden');
            }
        });
    }

    render(treeData) {
        this.treeData = treeData;
        if (!treeData || treeData.length === 0) {
            this.container.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:20px;">[ NO DATA ]</div>';
            return;
        }

        // 首次渲染預設將第一層 Folder 展開
        if (this.expandedNodeIds.size === 0) {
            treeData.forEach(node => {
                if (node.type === 'folder') this.expandedNodeIds.add(node.id);
            });
        }

        const renderNodes = (nodes) => {
            let html = '<ul class="tree-list">';
            nodes.forEach(node => {
                const isFolder = node.type === 'folder';
                const hasChildren = isFolder && node.children && node.children.length > 0;
                const isSelected = node.id === this.selectedNodeId ? 'selected' : '';
                const isOpen = this.expandedNodeIds.has(node.id) ? 'open' : '';

                html += `
                    <li class="tree-item ${isOpen}" data-id="${node.id}">
                        <div class="node-label ${isFolder ? 'node-folder' : 'node-data'} ${isSelected}">
                            <span class="tree-arrow">${isFolder ? (hasChildren ? (isOpen ? '▼' : '▶') : '▶') : '-'}</span>
                            <span class="node-icon">${isFolder ? '📁' : '📄'}</span>
                            <span class="node-title">${node.name || 'UNNAMED'}</span>
                        </div>
                        ${isFolder ? renderNodes(node.children || []) : ''}
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };

        this.container.innerHTML = renderNodes(treeData);
    }
}