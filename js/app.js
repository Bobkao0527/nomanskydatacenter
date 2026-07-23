/**
 * CYBER HUD 控制核心
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
    // 切換 Tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.currentTab = target.dataset.tab;
        this.selectedItemId = null;
        this.render();
      });
    });

    document.getElementById('search-input').addEventListener('input', () => this.renderList());
    document.getElementById('sync-btn').addEventListener('click', () => this.fetchAllTabs());
    document.getElementById('add-btn').addEventListener('click', () => this.openModal());
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('hud-form').addEventListener('submit', (e) => this.handleFormSubmit(e));
  },

  render() {
    this.renderList();
    this.renderDetail();
  },

  // 1. 左側清單
  renderList() {
    const listEl = document.getElementById('item-list');
    const keyword = document.getElementById('search-input').value;
    const rawList = TerminalData.get(this.currentTab);
    const filtered = TerminalLogic.filterItems(rawList, keyword);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state">[NO_DATA_FOUND]</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(item => {
      const isSelected = item.id === this.selectedItemId ? 'selected' : '';
      let title = '', sub = '';

      if (this.currentTab === 'trading') {
        title = `SYS: ${item.systemName} (${item.economyLevel || 1}★)`;
        sub = `TYPE: ${item.type} | BUY: ${item.buyPercent}% / SELL: +${item.sellPercent}%`;
      } else if (this.currentTab === 'data') {
        title = `PLANET: ${item.planetName}`;
        sub = `SYS: ${item.systemName} | BIOME: ${item.biome}`;
      } else if (this.currentTab === 'money') {
        title = `${item.action === 'Buy' ? '🔴 EXPEND' : '🟢 INCOME'} $${item.amount}`;
        sub = `${item.category} | ${item.timestamp}`;
      }

      return `
        <div class="list-item ${isSelected}" onclick="App.selectItem('${item.id}')">
          <div style="font-weight:bold; color: var(--hud-cyan); font-family: var(--font-mono);">${title}</div>
          <div style="font-size:0.75rem; color: var(--hud-text-dim); margin-top:3px;" class="font-mono">${sub}</div>
        </div>
      `;
    }).join('');
  },

  selectItem(id) {
    this.selectedItemId = id;
    this.render();
  },

  // 2. 右側 Detail (樹狀結構)
  renderDetail() {
    const detailEl = document.getElementById('detail-view');
    const list = TerminalData.get(this.currentTab);
    const item = list.find(i => i.id === this.selectedItemId);

    if (!item) {
      detailEl.innerHTML = `<div class="empty-state">[SYSTEM_READY] 請選擇左側數據卡片以展開節點...</div>`;
      return;
    }

    let treeHtml = `<h3 style="color:var(--hud-cyan); margin-top:0;">// NODE_TREE: ${item.id}</h3>`;

    if (this.currentTab === 'trading') {
      const score = TerminalLogic.calculateProfitScore(item.buyPercent, item.sellPercent, item.economyLevel);
      const cd = TerminalLogic.checkCooldown(item.lastSold);
      const levelText = TerminalLogic.ECONOMY_LEVEL_MAP[item.economyLevel] || `${item.economyLevel} 星`;

      treeHtml += `
        <div class="tree-node"><span class="tree-label">SYSTEM_NAME:</span> <span class="tree-value">${item.systemName}</span></div>
        <div class="tree-node"><span class="tree-label">TRADE_TYPE:</span> <span class="tree-value">${item.type}</span></div>
        <div class="tree-node"><span class="tree-label">ECONOMY_RATING:</span> <span class="tree-value">${levelText}</span></div>
        <div class="tree-node"><span class="tree-label">MARGIN_ANALYSIS:</span>
          <div class="tree-node"><span class="tree-label">Buy Discount %:</span> <span class="tree-value">${item.buyPercent}%</span></div>
          <div class="tree-node"><span class="tree-label">Sell Premium %:</span> <span class="tree-value">+${item.sellPercent}%</span></div>
          <div class="tree-node"><span class="tree-label">PROFIT_SCORE:</span> <span class="tree-value" style="color:var(--hud-green);">${score}</span></div>
        </div>
        <div class="tree-node"><span class="tree-label">MARKET_STATUS:</span> <span class="tree-value">${TerminalLogic.formatRemainingTime(cd.remainingMs)}</span></div>
        <br/>
        <button class="hud-btn glow-cyan w-full" onclick="App.markAsSold('${item.id}')">⚡ 剛在此處拋售商品 (刷新 24H 冷卻)</button>
      `;
    } else {
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

  markAsSold(id) {
    const nowStr = new Date().toISOString();
    TerminalData.updateItem('trading', id, { lastSold: nowStr });
    this.saveToBackend('trading', { id, lastSold: nowStr });
    this.render();
  },

  // 3. Modal 動態表單（已修正小數點、星級對照表與數學類型）
  openModal() {
    const fieldsEl = document.getElementById('form-fields');
    let fields = '';

    if (this.currentTab === 'trading') {
      fields = `
        <div class="form-group"><label>星系名稱 (System Name)</label><input class="hud-input" name="systemName" placeholder="例: Alpha-01" required /></div>
        <div class="form-group"><label>貿易類型 (Trade Type)</label>
          <select class="hud-select" name="type">
            <optgroup label="鏈條 A (3星系)">
              <option value="商業">商業 / 貿易 (🟢)</option>
              <option value="高級材料">高級材料 (🟣)</option>
              <option value="科學">科學 / 數學 (🔵)</option>
            </optgroup>
            <optgroup label="鏈條 B (4星系)">
              <option value="採礦">採礦 / 探勘 (🟠)</option>
              <option value="製造">製造 / 大量生產 (🟡)</option>
              <option value="科技">科技 / 工程 (🔷)</option>
              <option value="發電">發電 / 能源 (🔴)</option>
            </optgroup>
          </select>
        </div>
        <div class="form-group"><label>商業等級 (Economy Rating)</label>
          <select class="hud-select" name="economyLevel">
            <option value="3">3 星 (富有 / 繁榮 / 鼎盛 / 高供給 / 富裕)</option>
            <option value="2">2 星 (平均 / 尚可 / 良好 / 穩定)</option>
            <option value="1">1 星 (貧瘠 / 失敗 / 開發中 / 衰退)</option>
          </select>
        </div>
        <!-- step="0.1" 允許輸入小數點！ -->
        <div class="form-group"><label>Buy % (買入折扣，例: -62.5)</label><input type="number" step="0.1" class="hud-input" name="buyPercent" value="-60" /></div>
        <div class="form-group"><label>Sell % (賣出溢價，例: 71.3)</label><input type="number" step="0.1" class="hud-input" name="sellPercent" value="70" /></div>
      `;
    } else if (this.currentTab === 'data') {
      fields = `
        <div class="form-group"><label>所屬星系</label><input class="hud-input" name="systemName" required /></div>
        <div class="form-group"><label>星球名稱</label><input class="hud-input" name="planetName" required /></div>
        <div class="form-group"><label>生態類型 (Biome)</label><input class="hud-input" name="biome" placeholder="溫和 / 毒性 / 極寒" /></div>
        <div class="form-group"><label>礦物與產物元素 (Minerals)</label><input class="hud-input" name="minerals" placeholder="銅, 活性銅, 鈉" /></div>
        <div class="form-group"><label>特殊植被 (Plants)</label><input class="hud-input" name="plants" placeholder="霜晶, 靈魂根" /></div>
      `;
    } else if (this.currentTab === 'money') {
      fields = `
        <div class="form-group"><label>交易類型</label><select class="hud-select" name="action"><option value="Sell">賣出 (收入)</option><option value="Buy">買入 (支出)</option></select></div>
        <div class="form-group"><label>金額 (Units)</label><input type="number" class="hud-input" name="amount" required /></div>
        <div class="form-group"><label>類別 (Category)</label><input class="hud-input" name="category" placeholder="跑商 / 買飛船 / 廢棄貨船" /></div>
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

  async fetchAllTabs() {
    ['trading', 'data', 'money'].forEach(async (tab) => {
      try {
        const res = await fetch(`${this.GAS_API_URL}?sheet=${tab}`);
        const data = await res.json();
        if (Array.isArray(data)) TerminalData.set(tab, data);
      } catch (err) { console.error(`Sync error on ${tab}:`, err); }
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
    } catch (e) { console.error('Write error:', e); }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());