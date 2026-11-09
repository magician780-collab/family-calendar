// modules/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDocs, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAN8GWRVvtLWH1HzyTDhJnUf_-h4Jp-UhA",
    authDomain: "all-family-calendar.firebaseapp.com",
    projectId: "all-family-calendar",
    storageBucket: "all-family-calendar.firebasestorage.app",
    messagingSenderId: "790336816938",
    appId: "1:790336816938:web:b3b06b1c9877e5ba46c053"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 啟用離線快取，讓斷網時也能看行事曆
enableIndexedDbPersistence(db).catch(() => {
    console.warn("Firebase 離線快取啟用失敗，可能是不支援的瀏覽器或分頁開太多");
});

// 定義並導出常用的資料庫參考點
export const eventsRef = collection(db, 'familyEvents');
export const membersRef = collection(db, 'familyMembers');
export const noteRef = doc(db, 'familyNotes', 'mainNote'); 
export const backupsRef = collection(db, 'familyBackups');

// 統一導出需要用到的 Firebase API，讓 app.js 可以直接呼叫，不用再寫一堆 import url
export { addDoc, updateDoc, deleteDoc, doc, setDoc, getDocs, onSnapshot };