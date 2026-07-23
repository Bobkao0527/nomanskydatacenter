/**
 * 終端機集中資料數據中心
 */
const TerminalData = {
  trading: [],
  data: [],
  money: [],

  init() {
    this.trading = JSON.parse(localStorage.getItem('nms_hud_trading') || '[]');
    this.data = JSON.parse(localStorage.getItem('nms_hud_data') || '[]');
    this.money = JSON.parse(localStorage.getItem('nms_hud_money') || '[]');
  },

  get(sheet) { return this[sheet] || []; },

  set(sheet, list) {
    this[sheet] = list;
    localStorage.setItem(`nms_hud_${sheet}`, JSON.stringify(list));
  },

  add(sheet, item) {
    this[sheet].unshift(item);
    this.set(sheet, this[sheet]);
  },

  updateItem(sheet, id, updatedFields) {
    const list = this.get(sheet);
    const index = list.findIndex(i => i.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...updatedFields };
      this.set(sheet, list);
    }
  }
};