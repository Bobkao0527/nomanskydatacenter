/**
 * 資料狀態模組
 */
const TradeData = {
  systems: [],

  // 初始化：優先讀取 LocalStorage
  init() {
    const local = localStorage.getItem('nms_trade_systems');
    if (local) {
      try {
        this.systems = JSON.parse(local);
      } catch (e) {
        this.systems = [];
      }
    }
    return this.systems;
  },

  // 更新記憶體與 LocalStorage
  setSystems(data) {
    this.systems = data;
    localStorage.setItem('nms_trade_systems', JSON.stringify(data));
  },

  // 新增單一星系
  addSystem(systemObj) {
    this.systems.push(systemObj);
    this.setSystems(this.systems);
  },

  // 取得目前的所有星系
  getSystems() {
    return this.systems;
  }
};
