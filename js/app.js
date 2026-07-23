/**
 * 終端機主控制與 UI 觸發器
 */
const App = {
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbzK0Wwi4s4WJDIyJgnz6LiZf69wyDlK-lSFgHQTq2mAhyI1w9oE09DeHVeGoTwj4iCz/exec', // 貼上你的 GAS Web App URL
  currentTab: 'trading',
  selectedItemId: null,

  init() {
    TerminalData.init();
    this.bindEvents();
    this.render();
    if (this.GAS_API_URL !== 'YOUR_GAS_DEPLOYMENT_URL_HERE') {
      this.fetchAllTabs();
    }
  },

  bindEvents() {
    // 頁籤切換
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTab = e.target.dataset.tab;
        this.selectedItemId = null;
        this.render();
      });
    });

    // 搜尋過濾器
    document.getElementById('search-input').addEventListener('input', () => this.renderList());

    // 同步按鈕
    document.getElementById('sync-btn').addEventListener('click', () => this.fetchAllTabs());

    // Modal 彈窗與表單觸發
    document.getElementById('add-btn').addEventListener('click', () => this.openModal());
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('hud-form').addEventListener('submit', (e) => this.handleFormSubmit(e));
  },

  render() {
    this.renderList();
    this.renderDetail();
  },

  // 1. 渲染左側搜尋列表
  renderList() {
    const listEl = document.getElementById('item-list');
    const keyword = document.getElementById('search-input').value;
    const rawList = TerminalData.get(this.currentTab);
    const filtered = TerminalLogic.filterItems(rawList, keyword);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state">無符合條件數據</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(item => {
      const isSelected = item.id === this.selectedItemId ? 'selected' : '';
      let title = '', sub = '';

      if (this.currentTab === 'trading') {
        title = `${item.systemName} (${item.economyLevel || 1}★)`;
        sub = `類型: ${item.type || '未指定'} | 折扣: ${item.buyPercent}%`;
      } else if (this.currentTab === 'data') {
        title = `🪐 ${item.planetName}`;
        sub = `星系: ${item.systemName} | 環境: ${item.biome}`;
      } else if (this.currentTab === 'money') {
        title = `${item.action === 'Buy' ? '🔴 支出' : '🟢 收入'} $${item.amount}`;
        sub = `${item.category} - ${item.timestamp}`;
      }

      return `
        <div class="list-item ${isSelected}" onclick="App.selectItem('${item.id}')">
          <div style="font-weight:bold; color: var(--accent-cyan);">${title}</div>
          <div style="font-size:0.8rem; color: var(--text-dim); margin-top:4px;">${sub}</div>
        </div>
      `;
    }).join('');
  },

  selectItem(id) {
    this.selectedItemId = id;
    this.render();
  },

  // 2. 渲染右側樹狀 Detail 面板
  renderDetail() {
    const detailEl = document.getElementById('detail-view');
    const list = TerminalData.get(this.currentTab);
    const item = list.find(i => i.id === this.selectedItemId);

    if (!item) {
      detailEl.innerHTML = `<div class="empty-state">請選擇左側項目以檢視詳細數據鏈</div>`;
      return;
    }

    let treeHtml = `<h2 style="color:var(--accent-cyan); border-bottom:1px solid var(--border-color); padding-bottom:10px;">數據詳細剖析 (TREE VIEW)</h2>`;

    if (this.currentTab === 'trading') {
      const score = TerminalLogic.calculateProfitScore(item.buyPercent, item.sellPercent, item.economyLevel);
      const cd = TerminalLogic.checkCooldown(item.lastSold);

      treeHtml += `
        <div class="tree-node"><span class="tree-label">SYSTEM_NAME:</span> <span class="tree-value">${item.systemName}</span></div>
        <div class="tree-node"><span class="tree-label">RACE / GUILD:</span> <span class="tree-value">${item.race} / ${item.guild}</span></div>
        <div class="tree-node"><span class="tree-label">TRADE_METRICS:</span>
          <div class="tree-node"><span class="tree-label">Buy %:</span> <span class="tree-value">${item.buyPercent}%</span></div>
          <div class="tree-node"><span class="tree-label">Sell %:</span> <span class="tree-value">+${item.sellPercent}%</span></div>
          <div class="tree-node"><span class="tree-label">Profit Score:</span> <span class="tree-value" style="color:var(--success-color);">${score}</span></div>
        </div>
        <div class="tree-node"><span class="tree-label">MARKET_STATUS:</span> <span class="tree-value">${TerminalLogic.formatRemainingTime(cd.remainingMs)}</span></div>
        <br/>
        <button class="hud-btn glow" onclick="App.markAsSold('${item.id}')">⚡ 剛在此處大批賣出 (重置24H CD)</button>
      `;
    } else {
      // 繪製通用樹狀結構
      Object.keys(item).forEach(key => {
        treeHtml += `
          <div class="tree-node">
            <span class="tree-label">${key.toUpperCase()}:</span> 
            <span class="tree-value">${item[key]}</span>
          </div>
        `;
      });
    }

    detailEl.innerHTML = treeHtml;
  },

  // 更新交易時間（大批賣出）
  markAsSold(id) {
    const nowStr = new Date().toISOString();
    TerminalData.updateItem('trading', id, { lastSold: nowStr });
    this.saveToBackend('trading', { id, lastSold: nowStr });
    this.render();
  },

  // 3. 模組動態 Form 建立與 Modal 控制
  openModal() {
    const fieldsEl = document.getElementById('form-fields');
    let fields = '';

    if (this.currentTab === 'trading') {
      fields = `
        <div class="form-group"><label>星系名稱</label><input name="systemName" required /></div>
        <div class="form-group"><label>貿易類型</label><select name="type">
          <option value="採礦">採礦</option><option value="製造">製造</option><option value="科技">科技</option><option value="發電">發電</option>
          <option value="商業">商業</option><option value="高級材料">高級材料</option><option value="科學">科學</option>
        </select></div>
        <div class="form-group"><label>星系等級 (1~3)</label><input type="number" name="economyLevel" min="1" max="3" value="3" /></div>
        <div class="form-group"><label>Buy % (折扣)</label><input type="number" name="buyPercent" value="-60" /></div>
        <div class="form-group"><label>Sell % (溢價)</label><input type="number" name="sellPercent" value="70" /></div>
      `;
    } else if (this.currentTab === 'data') {
      fields = `
        <div class="form-group"><label>所屬星系</label><input name="systemName" required /></div>
        <div class="form-group"><label>星球名稱</label><input name="planetName" required /></div>
        <div class="form-group"><label>生態類型 (Biome)</label><input name="biome" placeholder="例: 溫和 / 毒性 / 極寒" /></div>
        <div class="form-group"><label>礦物與產物元素</label><input name="minerals" placeholder="例: 銅, 活性銅, 鈉" /></div>
      `;
    } else if (this.currentTab === 'money') {
      fields = `
        <div class="form-group"><label>動作</label><select name="action"><option value="Sell">賣出 (收入)</option><option value="Buy">買入 (支出)</option></select></div>
        <div class="form-group"><label>金額 (Units)</label><input type="number" name="amount" required /></div>
        <div class="form-group"><label>類別</label><input name="category" placeholder="例: 跑商 / 買飛船" /></div>
      `;
    }

    fieldsEl.innerHTML = fields;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); },

  async handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const item = { id: Date.now().toString(), timestamp: new Date().toLocaleString() };
    formData.forEach((val, key) => item[key] = val);

    TerminalData.add(this.currentTab, item);
    this.closeModal();
    this.render();

    await this.saveToBackend(this.currentTab, item);
  },

  // 4. API 通信與雲端同步
  async fetchAllTabs() {
    ['trading', 'data', 'money'].forEach(async (tab) => {
      try {
        const res = await fetch(`${this.GAS_API_URL}?sheet=${tab}`);
        const data = await res.json();
        if (Array.isArray(data)) TerminalData.set(tab, data);
      } catch (err) { console.error(`同步 ${tab} 失敗:`, err); }
    });
    this.render();
  },

  async saveToBackend(sheet, item) {
    if (this.GAS_API_URL === 'YOUR_GAS_DEPLOYMENT_URL_HERE') return;
    try {
      await fetch(this.GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sheet, data: item })
      });
    } catch (e) { console.error('後端寫入失敗:', e); }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());