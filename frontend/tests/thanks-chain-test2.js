import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc
} from 'firebase/firestore';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ======================================================
// ⭐️ UIDキャッシュ (Authリクエスト削減のため)
// ======================================================
const userUidCache = new Map();

// ======================================================
// ① テスト用ユーザー
// ======================================================
const users = [
  { email: 'thanks_root@example.com', password: 'test1234', displayName: '感謝のはじまりさん' }, // Lv0
  { email: 'user1@example.com', password: 'test1234', displayName: '電車の勇気さん' },
  { email: 'user2@example.com', password: 'test1234', displayName: 'コンビニの親切さん' },
  { email: 'user3@example.com', password: 'test1234', displayName: '職場の気配りさん' },
  { email: 'user4@example.com', password: 'test1234', displayName: '道端の小さな善意さん' },
  { email: 'user5@example.com', password: 'test1234', displayName: '励ましの言葉さん' },
  { email: 'user6@example.com', password: 'test1234', displayName: '地域の見守りさん' },
  { email: 'user7@example.com', password: 'test1234', displayName: '小さなありがとうさん' },
];

// ======================================================
// ② ユーザー作成またはログイン (キャッシュ機能追加)
// ======================================================
async function getOrCreateUser(userData) {
  if (userUidCache.has(userData.email)) {
    console.log(`♻️ キャッシュ利用: ${userData.displayName}`);
    return userUidCache.get(userData.email);
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const uid = userCred.user.uid;
    await setDoc(doc(db, 'users', uid), {
      uid,
      displayName: userData.displayName,
      email: userData.email,
      createdAt: new Date(),
    });
    console.log(`✅ ユーザー作成: ${userData.displayName}`);
    userUidCache.set(userData.email, uid);
    return uid;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const login = await signInWithEmailAndPassword(auth, userData.email, userData.password);
      const uid = login.user.uid;
      console.log(`ℹ️ 既存ユーザー: ${userData.displayName}`);
      userUidCache.set(userData.email, uid);
      return uid;
    } else {
      console.error(`ユーザー処理エラー (${userData.email}):`, err.message);
      throw err;
    }
  }
}

// ======================================================
// ③ 投稿作成
// ======================================================
async function createPost(data) {
  const docRef = await addDoc(collection(db, 'posts'), {
    ...data,
    timestamp: new Date(),
    likeCount: 0,
    actionCount: 0,
    likedBy: [],
  });
  return docRef.id;
}

// ======================================================
// ④ サンプル文データ
// ======================================================
const actionTexts = [
  { text: '重い荷物を持っている人を手伝った', feeling: '少し照れくさいけど、嬉しかった', tags: ['助け合い', '行動'] },
  { text: 'コンビニで店員さんに「ありがとう」と伝えた', feeling: 'お互い笑顔になれた', tags: ['感謝', '日常'] },
  { text: '職場で落ち込んでいる同僚に声をかけた', feeling: '少しでも力になれたかな', tags: ['職場', '励まし'] },
  { text: '道に落ちているゴミを拾った', feeling: '街がきれいになって清々しい', tags: ['地域', '美化'] },
  { text: 'バスで席を譲ったら、感謝された', feeling: '勇気を出してよかった', tags: ['バス', '優しさ'] },
  { text: 'エレベーターで「開」ボタンを押して待っていた', feeling: '当たり前だけど、気持ちがいい', tags: ['親切', '日常'] },
  { text: '雨の日に傘を忘れた人に傘を貸した', feeling: '自分も嬉しくなった', tags: ['助け合い', '天気'] },
  { text: 'ベビーカーを運ぶのを手伝った', feeling: '感謝されて温かい気持ちになった', tags: ['駅', '助け合い'] },
];

// ランダムヘルパー
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickRandom = (arr) => arr[rand(0, arr.length - 1)];

// ======================================================
// ⑤ 再帰的に感謝の連鎖を作成
// ======================================================
const MIN_DEPTH_REQUIRED = 2;
const MAX_DEPTH_ALLOWED = 4;
const STOP_PROBABILITY = 0.4;

async function createChain(authorId, depth = 1, parentPostId = null, rootPostId = null, parentAuthorId = null) {
  if (depth > MAX_DEPTH_ALLOWED) {
    console.log(`... ⏹️ Lv.${depth} (親: ${parentPostId}) で最大深度到達のため終了`);
    return;
  }

  const nodeCount = rand(2, 3);
  console.log(`🌱 Lv.${depth} のノード数: ${nodeCount} (親: ${parentPostId})`);

  for (let i = 0; i < nodeCount; i++) {
    const base = pickRandom(actionTexts);
    const postId = await createPost({
      type: 'action',
      text: base.text + `（Lv.${depth}-${i + 1}）`,
      feeling: base.feeling,
      tags: base.tags,
      authorId,
      isAnonymous: false,
      depth,
      replyTo: parentPostId,
      parentPostId,
      rootPostId: rootPostId,
      parentAuthorId: parentAuthorId,
    });

    console.log(`📝 投稿作成: ${base.text} (Lv.${depth})`);

    if (depth >= MIN_DEPTH_REQUIRED && Math.random() < STOP_PROBABILITY) {
      console.log(`... 🎲 Lv.${depth} (${postId}) で確率的にブランチ終了`);
      continue;
    }

    const userIndex = (depth + i + 1) % users.length;
    const nextUserIndex = userIndex === 0 ? 1 : userIndex;
    const nextUser = users[nextUserIndex];
    const childUid = await getOrCreateUser(nextUser);

    await createChain(childUid, depth + 1, postId, rootPostId, authorId);
  }
}

// ======================================================
// ⑥ 実行エントリーポイント
// ======================================================
(async () => {
  try {
    console.log('🚀 感謝の連鎖テストデータ生成開始');

    const rootUser = users[0];
    const rootUid = await getOrCreateUser(rootUser);

    const rootPostData = {
      text: '電車で席を譲ってもらった。本当に助かった。',
      feeling: '心が温かくなった',
      tags: ['電車', '優しさ', '感謝'],
    };
    const rootPostId = await createPost({
      type: 'thanks',
      ...rootPostData,
      authorId: rootUid,
      isAnonymous: false,
      depth: 0,
      replyTo: null,
      parentPostId: null,
      rootPostId: null,
      parentAuthorId: null,
    });
    console.log(`📝 投稿作成 (Root): ${rootPostData.text} (Lv.0)`);

    const nodeCountLv1 = rand(1, 3);
    console.log(`🌱 Lv.1 のノード数: ${nodeCountLv1}`);

    for (let i = 0; i < nodeCountLv1; i++) {
      const nextUserIndex = (i + 1) % users.length;
      const actualIndex = nextUserIndex === 0 ? 1 : nextUserIndex;
      const nextUser = users[actualIndex];
      const childUid = await getOrCreateUser(nextUser);

      await createChain(childUid, 1, rootPostId, rootPostId, rootUid);
    }

    console.log('🎉 感謝の連鎖テストデータ生成完了');
  } catch (error) {
    console.error('❌ テストデータ生成中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
})();
