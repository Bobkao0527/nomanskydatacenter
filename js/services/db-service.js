// js/services/db-service.js
import { db } from '../config/firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js"; // 統一改為 12.16.0

// 讀取所有資料並於前端組裝樹狀圖
export const fetchAllData = async () => {
    try {
        const systemsSnap = await getDocs(collection(db, "systems"));
        const planetsSnap = await getDocs(collection(db, "planets"));
        const waypointsSnap = await getDocs(collection(db, "waypoints"));

        let systems = [];
        let planets = [];
        let waypoints = [];

        systemsSnap.forEach(doc => systems.push({ id: doc.id, ...doc.data(), planets: [] }));
        planetsSnap.forEach(doc => planets.push({ id: doc.id, ...doc.data(), waypoints: [] }));
        waypointsSnap.forEach(doc => waypoints.push({ id: doc.id, ...doc.data() }));

        // 組裝樹狀結構
        waypoints.forEach(wp => {
            const planet = planets.find(p => p.id === wp.planetId);
            if (planet) planet.waypoints.push(wp);
        });

        planets.forEach(pl => {
            const sys = systems.find(s => s.id === pl.systemId);
            if (sys) sys.planets.push(pl);
        });

        return systems;
    } catch (error) {
        console.error("Firebase 讀取失敗，請確認 firebase-config.js 是否已正確設定！", error);
        return [];
    }
};

// 新增資料
export const addData = async (collectionName, data) => {
    try {
        const docRef = await addDoc(collection(db, collectionName), data);
        return docRef.id;
    } catch (error) {
        console.error("新增資料失敗", error);
        throw error;
    }
};

// 刪除資料（含連鎖刪除機制）
export const deleteData = async (collectionName, id) => {
    try {
        if (collectionName === 'systems') {
            // 1. 刪除星系前，先抓出屬於該星系的所有行星
            const planetsQ = query(collection(db, "planets"), where("systemId", "==", id));
            const planetsSnap = await getDocs(planetsQ);

            for (const planetDoc of planetsSnap.docs) {
                // 刪除該行星下的所有路標
                await deleteChildWaypoints(planetDoc.id);
                // 刪除行星本身
                await deleteDoc(doc(db, "planets", planetDoc.id));
            }
        } else if (collectionName === 'planets') {
            // 2. 刪除行星前，先刪除屬於該行星的所有路標
            await deleteChildWaypoints(id);
        }

        // 3. 刪除目標文件本身 (System, Planet, 或 Waypoint)
        await deleteDoc(doc(db, collectionName, id));
        console.log(`[DB] 成功刪除 ${collectionName} ID: ${id}`);
    } catch (error) {
        console.error("刪除失敗", error);
        throw error;
    }
};

// 輔助函式：刪除特定 planetId 的所有 waypoints
const deleteChildWaypoints = async (planetId) => {
    const waypointsQ = query(collection(db, "waypoints"), where("planetId", "==", planetId));
    const waypointsSnap = await getDocs(waypointsQ);
    const deletePromises = waypointsSnap.docs.map(wpDoc => deleteDoc(doc(db, "waypoints", wpDoc.id)));
    await Promise.all(deletePromises);
};