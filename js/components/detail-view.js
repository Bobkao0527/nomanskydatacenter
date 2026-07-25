export class DetailView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }
    
    // (省略部分程式碼以節省空間，保持和上一版相同的 render，只更新 getActionBar)
    renderSystem(sys) {
        this.container.innerHTML = `
            <div class="data-header"><h2>${sys.name}</h2><span class="badge">經濟: ${sys.economyLevel || '未知'}</span></div>
            <div class="data-grid">
                <div class="data-item"><span class="data-label">買/賣%:</span><span class="data-value highlight">${sys.tradeRate || '--'}</span></div>
                <div class="data-item"><span class="data-label">衝突等級:</span><span class="data-value">${sys.conflict || '--'}</span></div>
                <div class="data-item"><span class="data-label">優勢種族:</span><span class="data-value">${sys.race || '--'}</span></div>
            </div>
            ${this.getActionBar()}
        `;
    }
    renderPlanet(planet, sysName) {
        const resHtml = planet.resources ? planet.resources.map(r => `<span class="tag">${r}</span>`).join('') : '無';
        this.container.innerHTML = `
            <div class="data-header"><h2>${planet.name}</h2><span class="badge planet">類別: ${planet.type || '--'}</span></div>
            <div class="data-grid">
                <div class="data-item"><span class="data-label">所屬星系:</span><span class="data-value">${sysName}</span></div>
                <div class="data-item"><span class="data-label">天氣類型:</span><span class="data-value">${planet.weather || '--'}</span></div>
            </div>
            <div class="data-grid full" style="margin-top: 20px;">
                <div class="data-item"><span class="data-label">盛產資源:</span><div class="tag-list">${resHtml}</div></div>
            </div>
            ${this.getActionBar()}
        `;
    }
    renderWaypoint(waypoint, planetName) {
        this.container.innerHTML = `
            <div class="data-header"><h2>${waypoint.name}</h2><span class="badge waypoint">功能: ${waypoint.type || '--'}</span></div>
            <div class="data-grid">
                <div class="data-item"><span class="data-label">經度:</span><span class="data-value highlight">${waypoint.lng || '--'}</span></div>
                <div class="data-item"><span class="data-label">緯度:</span><span class="data-value highlight">${waypoint.lat || '--'}</span></div>
            </div>
            ${this.getActionBar()}
        `;
    }
    getActionBar() {
        return `
            <div class="action-bar">
                <button class="hud-btn danger" id="btn-purge-data">PURGE DATA (DELETE)</button>
            </div>
        `;
    }
}
