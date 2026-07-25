import { fetchAllData, deleteData } from './services/db-service.js';
import { TreeView } from './components/tree-view.js';
import { DetailView } from './components/detail-view.js';
import { ModalView } from './components/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    let globalSystems = [];
    const detailView = new DetailView('data-display');
    let currentSelected = null;

    // 載入資料函數
    const loadData = async () => {
        document.getElementById('tree-root').innerHTML = '<div style="text-align:center; color:#ff8c00; margin-top: 20px;">[ FETCHING CLOUD DATA... ]</div>';
        globalSystems = await fetchAllData();
        treeView.render(globalSystems);
        if (globalSystems.length > 0) detailView.renderSystem(globalSystems[0]);
        if (modalView) modalView.updateData(globalSystems);
    };

    // 定義樹狀圖並綁定選取邏輯
    const treeView = new TreeView('tree-root', (type, ids) => {
        currentSelected = { type, ...ids };
        const sys = globalSystems.find(s => s.id === ids.sysId);
        if (!sys) return;

        if (type === 'system') {
            document.querySelector('.detail-panel .panel-title').textContent = '[ SYSTEM_DETAILS ]';
            detailView.renderSystem(sys);
        } else if (type === 'planet') {
            document.querySelector('.detail-panel .panel-title').textContent = '[ PLANET_DETAILS ]';
            const planet = sys.planets?.find(p => p.id === ids.plId);
            if (planet) detailView.renderPlanet(planet, sys.name);
        } else if (type === 'waypoint') {
            document.querySelector('.detail-panel .panel-title').textContent = '[ WAYPOINT_DETAILS ]';
            const planet = sys.planets?.find(p => p.id === ids.plId);
            const waypoint = planet?.waypoints?.find(w => w.id === ids.wpId);
            if (waypoint) detailView.renderWaypoint(waypoint, planet.name);
        }

        // 💡 修正點：使用 onclick 直接替換，避免重複綁定事件
        // 建議讓 DetailView 渲染完成後再抓取，或者直接用 onclick
        setTimeout(() => {
            const delBtn = document.getElementById('btn-purge-data');
            if (delBtn) {
                delBtn.onclick = async () => {
                    if (confirm("警告：即將清除此資料，確定執行？")) {
                        const targetCol = type === 'system' ? 'systems' : (type === 'planet' ? 'planets' : 'waypoints');
                        const targetId = type === 'system' ? ids.sysId : (type === 'planet' ? ids.plId : ids.wpId);
                        await deleteData(targetCol, targetId);
                        await loadData();
                    }
                };
            }
        }, 0);
    });

    // 初始化 Modal
    const modalView = new ModalView(globalSystems, loadData);
    document.getElementById('btn-add-data')?.addEventListener('click', () => modalView.open());

    // 綁定搜尋框
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => treeView.filter(e.target.value));

    // 啟動！
    await loadData();
});