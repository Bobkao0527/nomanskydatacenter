// commercial.js - 跑商演算法與跑商 UI 模組

// 1. 跑商計算引擎
const TradeEngine = {
    ECONOMY_MAP: {
        // --- 3 步循環 (Loop 3) ---
        '貿易':     { loop: 3, step: 1, next: '先進材料' },
        '先進材料': { loop: 3, step: 2, next: '科學' },
        '科學':     { loop: 3, step: 3, next: '貿易' },

        // --- 4 步循環 (Loop 4) ---
        '採礦':     { loop: 4, step: 1, next: '製造' },
        '製造':     { loop: 4, step: 2, next: '高科技' },
        '高科技':   { loop: 4, step: 3, next: '能源生產' },
        '能源生產': { loop: 4, step: 4, next: '採礦' }
    },

    getEconInfo(rawType) {
        if (!rawType || !this.ECONOMY_MAP[rawType]) return null;
        return { key: rawType, ...this.ECONOMY_MAP[rawType] };
    },

    parseBuyPercent(val) {
        if (!val) return 0;
        const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
        if (isNaN(num)) return 0;
        // 若使用者輸入負數 (-30%) 或正數 (30%)，皆防呆視為正向折扣貢獻
        return num < 0 ? -num : num; 
    },

    parseSellPercent(val) {
        if (!val) return 0;
        const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? 0 : num;
    },

    // 增強型 Tier 解析：從字串中提取數字 (如 "T3", "3級" -> 3)
    getTierMultiplier(tierVal) {
        if (!tierVal) return 1.0;
        const match = String(tierVal).match(/[1-4]/);
        const tier = match ? match[0] : '1';

        if (tier === '4') return 1.5; // 黑市/海盜
        if (tier === '3') return 1.3;
        if (tier === '2') return 1.1;
        return 1.0;
    },

    calculateLegProfit(sysA, sysB) {
        const buyDiscountContrib = this.parseBuyPercent(sysA['星系經濟']?.['購買']);
        const sellMarkupContrib = this.parseSellPercent(sysB['星系經濟']?.['出售']);
        const tierA = this.getTierMultiplier(sysA['星系經濟']?.['經濟等級']);
        const tierB = this.getTierMultiplier(sysB['星系經濟']?.['經濟等級']);

        const rawProfitScore = buyDiscountContrib + sellMarkupContrib;
        const weightedScore = rawProfitScore * ((tierA + tierB) / 2);

        return {
            buyDiscountContrib: Math.round(buyDiscountContrib * 10) / 10,
            sellMarkupContrib: Math.round(sellMarkupContrib * 10) / 10,
            rawScore: Math.round(rawProfitScore * 10) / 10,
            weightedScore: Math.round(weightedScore * 10) / 10
        };
    },

    analyzeRoutes(allData) {
        const systems = [];
        for (let name in allData) {
            const sys = allData[name];
            const econType = sys['星系經濟']?.['經濟類型'];
            const econInfo = this.getEconInfo(econType);
            if (econInfo) {
                systems.push({ name, data: sys, econInfo });
            }
        }

        const routes = [];

        for (let i = 0; i < systems.length; i++) {
            const startNode = systems[i];
            const maxChainLen = startNode.econInfo.loop;

            const findChains = (currentChain) => {
                const lastNode = currentChain[currentChain.length - 1];
                const nextTargetEcon = lastNode.econInfo.next;

                const candidates = systems.filter(s => s.econInfo.key === nextTargetEcon);

                for (let nextSys of candidates) {
                    const isClosedLoop = (nextSys.name === startNode.name);

                    if (isClosedLoop) {
                        if (currentChain.length >= 2) {
                            routes.push(this.buildRouteSummary(currentChain, true));
                        }
                    } else if (currentChain.length < maxChainLen) {
                        if (!currentChain.some(node => node.name === nextSys.name)) {
                            const newChain = [...currentChain, nextSys];
                            routes.push(this.buildRouteSummary(newChain, false));
                            findChains(newChain);
                        }
                    }
                }
            };

            findChains([startNode]);
        }

        return this.deduplicateAndSortRoutes(routes);
    },

    buildRouteSummary(chain, isClosed) {
        let totalWeightedScore = 0;
        let totalRawScore = 0;
        const legs = [];

        for (let i = 0; i < chain.length; i++) {
            const origin = chain[i];
            const dest = isClosed 
                ? chain[(i + 1) % chain.length] 
                : (i < chain.length - 1 ? chain[i + 1] : null);

            if (dest) {
                const legInfo = this.calculateLegProfit(origin.data, dest.data);
                totalWeightedScore += legInfo.weightedScore;
                totalRawScore += legInfo.rawScore;
                legs.push({
                    from: origin.name,
                    to: dest.name,
                    fromEcon: origin.econInfo.key,
                    toEcon: dest.econInfo.key,
                    ...legInfo
                });
            }
        }

        const avgProfitScore = legs.length > 0 ? (totalRawScore / legs.length) : 0;
        const missingNext = isClosed ? null : chain[chain.length - 1].econInfo.next;

        let canonicalId;
        if (isClosed) {
            const sortedNames = chain.map(c => c.name).sort().join('->');
            canonicalId = `CLOSED::${sortedNames}::LOOP${chain[0].econInfo.loop}`;
        } else {
            canonicalId = `OPEN::${chain.map(c => c.name).join('->')}`;
        }

        return {
            id: canonicalId,
            chain: chain.map(c => c.name),
            isClosed,
            loopType: chain[0].econInfo.loop,
            legs,
            missingNext,
            totalScore: Math.round(totalWeightedScore * 10) / 10,
            avgProfitScore: Math.round(avgProfitScore * 10) / 10
        };
    },

    deduplicateAndSortRoutes(routes) {
        const map = new Map();
        
        // 收集所有閉合環的完整鏈條字串 (例如 "A->B->C")
        const closedChainKeys = new Set(
            routes.filter(r => r.isClosed).map(r => r.chain.join('->'))
        );

        routes.forEach(r => {
            // 防呆過濾：若開放鏈的節點順序完全等於某個已閉合環，則視為重複無效開放鏈
            if (!r.isClosed && closedChainKeys.has(r.chain.join('->'))) {
                return;
            }
            if (!map.has(r.id)) map.set(r.id, r);
        });

        const unique = Array.from(map.values());
        unique.sort((a, b) => b.totalScore - a.totalScore);
        return unique;
    }
};

// 2. 跑商 UI 控制器
const TradeUI = {
    renderSidebar(app) {
        const list = document.getElementById('trade-route-list');
        if (!list) return;
        list.innerHTML = '';

        const routes = TradeEngine.analyzeRoutes(app.data);
        const filterType = document.getElementById('trade-filter-type')?.value || 'all';

        const filteredRoutes = routes.filter(r => {
            if (filterType === 'closed') return r.isClosed;
            if (filterType === 'open') return !r.isClosed;
            return true;
        });

        if (filteredRoutes.length === 0) {
            list.innerHTML = `<li style="color:var(--danger); cursor:default;">// 無匹配跑商路線</li>`;
            return;
        }

        if (!filteredRoutes.some(r => r.id === app.currentSelectedRouteId)) {
            app.currentSelectedRouteId = filteredRoutes[0].id;
        }

        filteredRoutes.forEach(r => {
            const li = document.createElement('li');
            li.setAttribute('data-route-id', r.id); // 改用 dataset 綁定 ID，避免子字串比對錯誤
            if (r.id === app.currentSelectedRouteId) li.classList.add('active');

            const statusBadge = r.isClosed 
                ? `<span class="trade-chip closed">🟢 閉合 ${r.loopType} 步環</span>` 
                : `<span class="trade-chip open">🟡 開放 ${r.chain.length} 步鏈</span>`;

            li.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        ${statusBadge}
                        <span style="color:var(--cyan); font-weight:bold;">${r.totalScore} pts</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-main); font-weight:bold;">
                        ${r.chain.join(' ➔ ')}
                    </div>
                </div>
            `;

            li.onclick = () => this.selectRoute(app, r);
            list.appendChild(li);
        });

        const selectedRoute = filteredRoutes.find(r => r.id === app.currentSelectedRouteId) || filteredRoutes[0];
        if (selectedRoute) {
            this.selectRoute(app, selectedRoute);
        }
    },

    selectRoute(app, route) {
        if (!route) return;
        app.currentSelectedRouteId = route.id;

        // 精確透過 data-route-id 進行 active 樣式切換
        const listItems = document.querySelectorAll('#trade-route-list li');
        listItems.forEach(li => {
            li.classList.toggle('active', li.getAttribute('data-route-id') === route.id);
        });

        let html = `
            <div class="section-title">
                <span>[ 🚀 跑商路線詳細分析 ]</span>
                <span style="font-size:1rem; color:${route.isClosed ? '#0f0' : '#ffaa00'};">
                    ${route.isClosed ? '🟢 完整閉合循環' : '🟡 開放單向路線'}
                </span>
            </div>

            <div class="data-grid" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:20px;">
                <div class="data-card">
                    <h3>> 路線加權總分</h3>
                    <div style="font-size:2rem; color:var(--cyan); font-weight:bold;">${route.totalScore} <span style="font-size:1rem;">PTS</span></div>
                </div>
                <div class="data-card">
                    <h3>> 單步平均基礎獲利</h3>
                    <div style="font-size:2rem; color:var(--purple); font-weight:bold;">+${route.avgProfitScore}%</div>
                </div>
                <div class="data-card">
                    <h3>> 循環類型</h3>
                    <div style="font-size:1.5rem; color:var(--text-main);">${route.loopType} 步官方循環鏈</div>
                </div>
            </div>

            <!-- 路線節點流程視覺化 -->
            <div class="data-card" style="margin-bottom:25px;">
                <h3>> 貿易航線流程圖</h3>
                <div class="trade-flow-container">
        `;

        route.chain.forEach((sysName, idx) => {
            const sys = app.data[sysName] || {};
            const econType = sys['星系經濟']?.['經濟類型'] || '未知';
            const econTier = String(sys['星系經濟']?.['經濟等級'] || '未知');
            const tierLabel = econTier === '4' ? '🏴‍☠️ 黑市/海盜' : `T${econTier} 級經濟`;

            html += `
                <div class="trade-node-card">
                    <div class="node-step">STEP ${idx + 1}</div>
                    <div class="node-title">${sysName}</div>
                    <div class="node-tag">${econType}</div>
                    <div style="font-size:0.75rem; color:rgba(212,241,249,0.6); margin-top:4px;">${tierLabel}</div>
                </div>
            `;

            if (idx < route.chain.length - 1) {
                html += `<div class="trade-arrow">➔</div>`;
            } else if (route.isClosed) {
                html += `<div class="trade-arrow closed-arrow">🔄 閉合</div>`;
            }
        });

        if (!route.isClosed && route.missingNext) {
            // 修正缺角提示邏輯：只有只差最後一個星系時才提示「補齊即可閉合」
            const isOneStepLeft = (route.chain.length === route.loopType - 1);
            const subText = isOneStepLeft ? '新增即可接成閉合環' : `需延伸此類型以靠近閉合`;

            html += `
                <div class="trade-arrow">➔</div>
                <div class="trade-node-card missing">
                    <div class="node-step">缺角提醒</div>
                    <div class="node-title" style="color:var(--danger);">尚缺星系</div>
                    <div class="node-tag" style="border-color:var(--danger); color:var(--danger);">需 【${route.missingNext}】</div>
                    <div style="font-size:0.75rem; color:var(--danger); margin-top:4px;">${subText}</div>
                </div>
            `;
        }

        html += `
                </div>
            </div>

            <!-- 每步貿易細節表格 -->
            <div class="data-card">
                <h3>> 買賣利潤拆解明細</h3>
                <table class="hud-table">
                    <thead>
                        <tr>
                            <th>航程方向</th>
                            <th>購買地折扣貢獻</th>
                            <th>目的地溢價貢獻</th>
                            <th>基礎利潤 %</th>
                            <th>加權得分</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        route.legs.forEach(leg => {
            const buyText = leg.buyDiscountContrib >= 0 ? `+${leg.buyDiscountContrib}%` : `${leg.buyDiscountContrib}%`;
            const sellText = leg.sellMarkupContrib >= 0 ? `+${leg.sellMarkupContrib}%` : `${leg.sellMarkupContrib}%`;
            const rawText = leg.rawScore >= 0 ? `+${leg.rawScore}%` : `${leg.rawScore}%`;

            html += `
                <tr>
                    <td><strong>${leg.from}</strong> (${leg.fromEcon}) ➔ <strong>${leg.to}</strong> (${leg.toEcon})</td>
                    <td style="color:#0f0;">${buyText}</td>
                    <td style="color:var(--cyan);">${sellText}</td>
                    <td style="color:var(--purple); font-weight:bold;">${rawText}</td>
                    <td style="color:var(--cyan); font-weight:bold;">${leg.weightedScore} pts</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('main-content').innerHTML = html;
    }
};