import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, increment, serverTimestamp
} from "firebase/firestore";


// .env.localファイルからAPIキーを安全に読み込みます
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- テストしたい関数をここにコピー ---

const signIn = async () => {
  return await signInAnonymously(auth);
};

const createUserProfile = async (user) => {
  if (!user) return;
  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: 'テストユーザー',
      createdAt: serverTimestamp(),
    });
  }
};

const likePost = async (postId) => {
  const docRef = doc(db, "posts", postId);
  await updateDoc(docRef, {
    likeCount: increment(1)
  });
};


// --- テスト実行用のメイン関数 ---

async function runAuthTests() {
  console.log("--- ✅ 認証・いいね機能テスト開始 ---");
  let testUser = null;
  let testPostId = null;

  try {
    // 1.【匿名認証テスト】
    console.log("\n1. signIn() のテスト実行中...");
    const userCredential = await signIn();
    testUser = userCredential.user;
    console.log(`  -> 成功: 匿名ユーザーでサインインしました。(UID: ${testUser.uid})`);

    // 2.【プロフィール作成テスト】
    console.log("\n2. createUserProfile() のテスト実行中...");
    await createUserProfile(testUser);
    console.log(`  -> 成功: UID ${testUser.uid} のプロフィールを作成しました。(Firestoreのusersコレクションを確認)`);

    // 3.【いいね機能の準備】テスト用の投稿を作成
    console.log("\n3. テスト用の投稿を作成中...");
    const postRef = await addDoc(collection(db, 'posts'), {
      text: "いいねテスト用の投稿",
      authorId: testUser.uid,
      likeCount: 0,
    });
    testPostId = postRef.id;
    console.log(`  -> 成功: テスト投稿を作成しました。(ID: ${testPostId})`);

    // 4.【いいね機能テスト】
    console.log(`\n4. likePost() のテスト実行中... (ID: ${testPostId})`);
    await likePost(testPostId);
    console.log(`  -> 成功: 投稿に「いいね」しました。`);

    // 5.【いいね結果の確認】
    console.log(`\n5. いいね結果の確認中...`);
    const updatedPostDoc = await getDoc(doc(db, "posts", testPostId));
    const finalLikeCount = updatedPostDoc.data().likeCount;
    if (finalLikeCount === 1) {
      console.log(`  -> 成功: likeCountが正しく 1 になりました！`);
    } else {
      throw new Error(`いいねの数が不正です: ${finalLikeCount}`);
    }

  } catch (e) {
    console.error("\n❌ テスト中にエラーが発生しました:", e);
  } finally {
    // 6.【後片付け】テストで作ったデータを削除
    console.log("\n6. 後片付け中...");
    if (testPostId) {
      await deleteDoc(doc(db, "posts", testPostId));
      console.log(`  -> 成功: テスト投稿(ID: ${testPostId})を削除しました。`);
    }
    if (testUser) {
      await deleteDoc(doc(db, "users", testUser.uid));
      console.log(`  -> 成功: テストユーザー(UID: ${testUser.uid})を削除しました。`);
    }
  }

  console.log("\n--- ✅ 認証・いいね機能テスト完了 ---");
}

runAuthTests();
