/**
 * 主應用程式模組
 */
const App = {
  // 替換成你的 GAS 部署網址
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbyfoRmlYIpvIOxZv3ebggPJdgljZwXUFBEAGFLt3O4MJ-zbUFgnx94nJRZrJYoEdvAH/exec',

  init() {
    TradeData.init();
    this.bindEvents();
    this.render();
    
    // 開局自動向後端拉取最新資料 (如果已設定 URL)
    if (this.GAS_API_URL !== 'YOUR_GAS_DEPLOYMENT_URL_HERE') {
      this.fetchFromBackend();
    }
  },

  bindEvents() {
    // 表單送出事件
    document.getElementById('add-system-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddSystem();
    });

    // 重新整理/同步按鈕
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.fetchFromBackend();
    });
  },

  // 新增星系處理
  async handleAddSystem() {
    const newSystem = {
      id: Date.now().toString(),
      name: document.getElementById('sys-name').value,
      type: document.getElementById('sys-type').value,
      level: Number(document.getElementById('sys-level').value),
      buy: Number(document.getElementById('sys-buy').value || 0),
      sell: Number(document.getElementById('sys-sell').value || 0),
      lastSold: null
    };

    // 1. 先更新前端本地資料 (樂觀更新)
    TradeData.addSystem(newSystem);
    this.render();

    // 2. 背景同步至 GAS 後端
    if (this.GAS_API_URL !== 'YOUR_GAS_DEPLOYMENT_URL_HERE') {
      await this.saveToBackend(newSystem);
    }

    // 重置表單
    document.getElementById('add-system-form').reset();
  },

  // 渲染星系列表卡片
  render() {
    const listEl = document.getElementById('system-list');
    const systems = TradeData.getSystems();

    if (systems.length === 0) {
      listEl.innerHTML = '<p>目前沒有資料，請新增第一個星系站點。</p>';
      return;
    }

    listEl.innerHTML = systems.map(sys => {
      const score = TradeLogic.calculateProfitScore(sys.buy, sys.sell, sys.level);
      const cd = TradeLogic.checkCooldown(sys.lastSold);
      const statusText = TradeLogic.formatRemainingTime(cd.remainingMs);

      return `
        <div class="system-card">
          <h3>${sys.name} (${sys.level}★)</h3>
          <p>類型: <strong>${sys.type}</strong></p>
          <p>買/賣: ${sys.buy}% / +${sys.sell}%</p>
          <p>預估利潤指數: <span class="score-badge">${score}</span></p>
          <p>狀態: <span class="${cd.isCooling ? 'cooldown-active' : ''}">${statusText}</span></p>
        </div>
      `;
    }).join('');
  },

  // --- 後端 API 串接 ---

  // 從 GAS 獲取最新資料
  async fetchFromBackend() {
    try {
      const res = await fetch(this.GAS_API_URL);
      const data = await res.json();
      TradeData.setSystems(data);
      this.render();
      console.log('數據已成功從後端同步！');
    } catch (err) {
      console.error('後端拉取失敗:', err);
    }
  },

  // 儲存資料至 GAS
  async saveToBackend(systemData) {
    try {
      await fetch(this.GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(systemData)
      });
      console.log('數據已成功寫入後端！');
    } catch (err) {
      console.error('寫入後端失敗:', err);
    }
  }
};

// 頁面加載完成後啟動
document.addEventListener('DOMContentLoaded', () => App.init());
