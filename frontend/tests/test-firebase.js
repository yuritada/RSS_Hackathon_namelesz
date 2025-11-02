import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  doc,
  deleteDoc,
  runTransaction
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

// ---------------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const postsCollection = collection(db, 'posts');

// --- src/firebase.js からテストしたい関数を全てコピー ---

const getThanksPosts = async () => {
  const q = query(postsCollection, where("type", "==", "thanks"), orderBy("timestamp", "desc"));
  const querySnapshot = await getDocs(q);
  const posts = [];
  querySnapshot.forEach((doc) => posts.push({ id: doc.id, ...doc.data() }));
  return posts;
};

const addThanksPost = async ({ text, authorId, isAnonymous }) => {
  const docRef = await addDoc(postsCollection, {
    type: "thanks", text, authorId, isAnonymous,
    timestamp: serverTimestamp(), likeCount: 0, actionCount: 0,
  });
  return docRef.id; // 追加したドキュメントのIDを返す
};

const addNextAction = async ({ text, authorId, isAnonymous, parentPostId, parentThanksText, parentAuthorId }) => {
  const parentThanksRef = doc(db, "posts", parentPostId);
  await runTransaction(db, async (transaction) => {
    const parentThanksDoc = await transaction.get(parentThanksRef);
    if (!parentThanksDoc.exists()) throw "Parent document does not exist!";
    const newActionCount = (parentThanksDoc.data().actionCount || 0) + 1;
    transaction.update(parentThanksRef, { actionCount: newActionCount });
    const newActionRef = collection(db, 'posts');
    transaction.set(doc(newActionRef), {
      type: "action", text, authorId, isAnonymous,
      timestamp: serverTimestamp(), likeCount: 0,
      parentPostId, parentThanksText, parentAuthorId,
    });
  });
};

const deletePost = async (postId) => {
  const docRef = doc(db, "posts", postId);
  await deleteDoc(docRef);
};


// --- テスト実行用のメイン関数 ---

async function runAllTests() {
  console.log("--- ✅ 総合テスト開始 ---");
  let newPostId = null; // テストで追加・削除するためのIDを保存する変数

  try {
    // 1.【閲覧テスト】
    console.log("\n1. getThanksPosts() のテスト実行中...");
    const initialPosts = await getThanksPosts();
    console.log(`  -> 成功: ${initialPosts.length}件のThanks投稿を取得しました。`);

    // 2.【挿入テスト】
    console.log("\n2. addThanksPost() のテスト実行中...");
    const postData = {
      text: "総合テストで追加された投稿です。",
      authorId: "full-tester",
      isAnonymous: false,
    };
    newPostId = await addThanksPost(postData);
    console.log(`  -> 成功: 新しい投稿が追加されました。 (ID: ${newPostId})`);

    // 3.【更新/挿入テスト】
    console.log("\n3. addNextAction() のテスト実行中...");
    const actionData = {
        text: "テスト投稿へのNext Actionです。",
        authorId: "action-tester",
        isAnonymous: true,
        parentPostId: newPostId,
        parentThanksText: postData.text,
        parentAuthorId: postData.authorId,
    };
    await addNextAction(actionData);
    console.log(`  -> 成功: ID ${newPostId} にNext Actionが紐付けられました。`);

  } catch (e) {
    console.error("\n❌ テスト中にエラーが発生しました:", e);
  } finally {
    // 4.【削除テスト】（エラーが発生しても必ず実行する）
    if (newPostId) {
      console.log(`\n4. deletePost() のテスト実行中... (ID: ${newPostId})`);
      await deletePost(newPostId);
      console.log(`  -> 成功: テストで追加した投稿を削除しました。`);
    }
  }

  console.log("\n--- ✅ 総合テスト完了 ---");
}

runAllTests();
