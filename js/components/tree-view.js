export class TreeView {
    constructor(containerId, onNodeSelect) {
        this.container = document.getElementById(containerId);
        this.onNodeSelect = onNodeSelect;
        this.systems = []; // 儲存原始資料供搜尋比對
        this.bindEvents();
    }

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const label = e.target.closest('.node-label');
            if (!label) return;
            
            this.container.querySelectorAll('.node-label').forEach(el => el.classList.remove('active'));
            label.classList.add('active');

            const li = label.parentElement;
            
            const hasChildren = li.querySelector('.tree-list');
            if (hasChildren) {
                li.classList.toggle('open');
                const arrow = label.querySelector('.tree-arrow');
                if(arrow) arrow.textContent = li.classList.contains('open') ? '▼' : '▶';
            }

            const type = li.dataset.type;
            this.onNodeSelect(type, { 
                sysId: li.dataset.sysId, plId: li.dataset.plId, wpId: li.dataset.wpId 
            });
        });
    }

    // 搜尋過濾邏輯
    filter(keyword) {
        const lowerKw = keyword.toLowerCase();
        const items = this.container.querySelectorAll('.tree-item');
        
        if (!keyword) {
            items.forEach(item => item.classList.remove('hidden'));
            return;
        }

        items.forEach(item => {
            const label = item.querySelector('.node-label').textContent.toLowerCase();
            if (label.includes(lowerKw)) {
                item.classList.remove('hidden');
                // 如果子節點符合，強制展開父節點
                let parent = item.parentElement.closest('.tree-item');
                while(parent) {
                    parent.classList.remove('hidden');
                    parent.classList.add('open');
                    const arrow = parent.querySelector('.tree-arrow');
                    if(arrow) arrow.textContent = '▼';
                    parent = parent.parentElement.closest('.tree-item');
                }
            } else {
                item.classList.add('hidden');
            }
        });
    }

    render(systems) {
        this.systems = systems;
        if(systems.length === 0) {
            this.container.innerHTML = '<div style="text-align:center; color:#ff3300; margin-top:20px;">NO DATA / DB ERROR</div>';
            return;
        }

        let html = '<ul class="tree-list">';
        systems.forEach(sys => {
            const hasPlanets = sys.planets && sys.planets.length > 0;
            html += `
                <li class="tree-item system-node open" data-type="system" data-sys-id="${sys.id}">
                    <span class="node-label"><span class="tree-arrow">${hasPlanets ? '▼' : ' '}</span>${sys.name}</span>
                    ${hasPlanets ? `
                        <ul class="tree-list">
                            ${sys.planets.map(pl => {
                                const hasWaypoints = pl.waypoints && pl.waypoints.length > 0;
                                return `
                                <li class="tree-item planet-node" data-type="planet" data-sys-id="${sys.id}" data-pl-id="${pl.id}">
                                    <span class="node-label"><span class="tree-arrow">${hasWaypoints ? '▶' : ' '}</span>${pl.name}</span>
                                    ${hasWaypoints ? `
                                        <ul class="tree-list">
                                            ${pl.waypoints.map(wp => `
                                                <li class="tree-item waypoint-node" data-type="waypoint" data-sys-id="${sys.id}" data-pl-id="${pl.id}" data-wp-id="${wp.id}">
                                                    <span class="node-label"><span class="tree-arrow">-</span>${wp.name}</span>
                                                </li>
                                            `).join('')}
                                        </ul>
                                    ` : ''}
                                </li>`
                            }).join('')}
                        </ul>
                    ` : ''}
                </li>
            `;
        });
        html += '</ul>';
        this.container.innerHTML = html;
    }
}
