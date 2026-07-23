/**
 * 邏輯計算模組
 */
const TradeLogic = {
  // 冷卻時間常量 (24 小時，單位: 毫秒)
  COOLDOWN_MS: 24 * 60 * 60 * 1000,

  /**
   * 計算該星系的貿易獲利潛力分數
   * @param {number} buy - 折扣 % (例如 -60)
   * @param {number} sell - 溢價 % (例如 +70)
   * @param {number} level - 星系等級 (1~3)
   * @returns {number} 綜合得分 (越高越好)
   */
  calculateProfitScore(buy = 0, sell = 0, level = 1) {
    // 買入越低 (負數越大) 越好，賣出越高越好
    const margin = Number(sell) - Number(buy);
    return Math.round(margin * (level / 3));
  },

  /**
   * 判斷是否處於冷卻中
   * @param {string|number} lastSoldTime - 上次販售時間戳
   * @returns {Object} { isCooling: boolean, remainingMs: number }
   */
  checkCooldown(lastSoldTime) {
    if (!lastSoldTime) return { isCooling: false, remainingMs: 0 };
    
    const now = Date.now();
    const elapsed = now - new Date(lastSoldTime).getTime();
    const remaining = this.COOLDOWN_MS - elapsed;

    return {
      isCooling: remaining > 0,
      remainingMs: Math.max(0, remaining)
    };
  },

  /**
   * 格式化剩餘時間 (hh:mm:ss)
   */
  formatRemainingTime(ms) {
    if (ms <= 0) return "可交易";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `冷卻中 (${hours}h ${minutes}m)`;
  }
};
