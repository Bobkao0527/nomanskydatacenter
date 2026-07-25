// js/config/firebase-config.js

// 1. 引入 Firebase 核心與 Firestore 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbTgI60l6AcSocrWfkf2pC3sU5az3J5oM",
  authDomain: "bobnomanterminal.firebaseapp.com",
  projectId: "bobnomanterminal",
  storageBucket: "bobnomanterminal.firebasestorage.app",
  messagingSenderId: "215480718455",
  appId: "1:215480718455:web:3d129da05d77b991196272",
  measurementId: "G-2HKVJNBH7T"
};

// 2. 初始化 Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

// 3. 初始化 Firestore 資料庫並匯出 (供其他 JS 檔案使用)
export const db = getFirestore(app);