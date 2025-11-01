import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch } from "firebase/firestore";

// --- ここにあなたのfirebaseConfigを直接貼り付けてください ---
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
// ---------------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const postsCollection = collection(db, 'posts');

async function deleteAllPosts() {
  console.log("Firestoreの'posts'コレクションから全てのドキュメントを削除します...");
  
  try {
    const querySnapshot = await getDocs(postsCollection);
    
    if (querySnapshot.empty) {
      console.log("削除するドキュメントはありませんでした。");
      return;
    }

    // 複数のドキュメントをまとめて削除するためのバッチ処理
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // バッチ処理を実行
    await batch.commit();

    console.log(`✅ 成功: ${querySnapshot.size}件のドキュメントを全て削除しました。`);

  } catch (error) {
    console.error("❌ エラー: ドキュメントの削除中にエラーが発生しました。", error);
  }
}

// 実行
deleteAllPosts();