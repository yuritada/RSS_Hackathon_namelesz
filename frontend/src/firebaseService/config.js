import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection } from "firebase/firestore";

// .env.localファイルからAPIキーを安全に読み込みます
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firestore と Auth のインスタンスを取得してエクスポート
export const db = getFirestore(app);
export const auth = getAuth(app);

// posts コレクションへの参照もここでエクスポート
export const postsCollection = collection(db, 'posts');
// users コレクションへの参照も追加しておくと便利
export const usersCollection = collection(db, 'users');

// ★ 'tasks' コレクションへの参照を追加
export const tasksCollection = collection(db, 'tasks');