/**
 * HUD 終端邏輯計算模組
 */
const TerminalLogic = {
  COOLDOWN_MS: 24 * 60 * 60 * 1000,

  // 1. 跑商利潤評分
  calculateProfitScore(buy = 0, sell = 0, level = 1) {
    const margin = Number(sell) - Number(buy);
    return Math.round(margin * (Number(level) / 3));
  },

  // 2. 24 小時冷卻時間計算
  checkCooldown(lastSoldTime) {
    if (!lastSoldTime) return { isCooling: false, remainingMs: 0 };
    const elapsed = Date.now() - new Date(lastSoldTime).getTime();
    const remaining = this.COOLDOWN_MS - elapsed;
    return { isCooling: remaining > 0, remainingMs: Math.max(0, remaining) };
  },

  formatRemainingTime(ms) {
    if (ms <= 0) return "🟢 最佳（可交易）";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `🔴 市場飽和 (${hours}h ${minutes}m)`;
  },

  // 3. 通用關鍵字搜尋器
  filterItems(list, keyword) {
    if (!keyword) return list;
    const term = keyword.toLowerCase();
    return list.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(term)
      )
    );
  }
};