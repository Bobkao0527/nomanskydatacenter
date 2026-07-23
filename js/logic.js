/**
 * CYBER HUD 數據邏輯與對照表
 */
const TerminalLogic = {
  COOLDOWN_MS: 24 * 60 * 60 * 1000,

  // 1. 遊戲內建 商業等級 (Economy Level) 對照清單
  ECONOMY_LEVEL_MAP: {
    3: "3 星 [高] (富有 / 繁榮 / 鼎盛 / 富裕 / 大量生產 / 高供給 / 有持續性 / 舒適)",
    2: "2 星 [中] (平均 / 尚可 / 良好 / 充足 / 穩定)",
    1: "1 星 [低] (貧瘠 / 失敗 / 開發中 / 衰退 / 混亂)"
  },

  // 2. 計算獲利潛力指數 (支援小數點與 3 星加權)
  calculateProfitScore(buy = 0, sell = 0, level = 1) {
    const margin = parseFloat(sell) - parseFloat(buy); // buy 通常為負數, margin = sell - (-buy)
    return Math.round(margin * (parseInt(level) / 3) * 10) / 10;
  },

  // 3. 24 小時冷卻檢測
  checkCooldown(lastSoldTime) {
    if (!lastSoldTime) return { isCooling: false, remainingMs: 0 };
    const elapsed = Date.now() - new Date(lastSoldTime).getTime();
    const remaining = this.COOLDOWN_MS - elapsed;
    return { isCooling: remaining > 0, remainingMs: Math.max(0, remaining) };
  },

  formatRemainingTime(ms) {
    if (ms <= 0) return "🟢 最佳狀態 (可即刻拋售)";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `🔴 市場飽和 (價格崩盤中，剩餘 ${hours}h ${minutes}m)`;
  },

  filterItems(list, keyword) {
    if (!keyword) return list;
    const term = keyword.toLowerCase();
    return list.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(term))
    );
  }
};