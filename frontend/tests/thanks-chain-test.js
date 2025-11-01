import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
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
// ① テスト用ユーザー（善行テーマ付き）
// ======================================================
const users = [
  { email: 'thanks_root@example.com', password: 'test1234', displayName: '感謝のはじまりさん' },
  { email: 'user1@example.com', password: 'test1234', displayName: 'ドアを開ける優しささん' },
  { email: 'user2@example.com', password: 'test1234', displayName: '落とし物を渡す親切さん' },
  { email: 'user3@example.com', password: 'test1234', displayName: '傘をシェアする温かささん' },
  { email: 'user4@example.com', password: 'test1234', displayName: '声をかける気遣いさん' },
  { email: 'user5@example.com', password: 'test1234', displayName: '荷物を手伝う優しささん' },
  { email: 'user6@example.com', password: 'test1234', displayName: '資料を褒める思いやりさん' },
  { email: 'user7@example.com', password: 'test1234', displayName: '日常に感謝を伝えるさん' },
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
// ④ サンプル文データ（善行・感謝行動版）
// ======================================================
const actionTexts = [
  { text: '誕生日を祝った', feeling: '喜んでもらえて嬉しかった', tags: ['誕生日', '祝福'] },
  { text: '落とし物を見つけて渡した', feeling: '相手が安心してくれて良かった', tags: ['助け合い', '日常'] },
  { text: 'ドアを後ろの人のために押さえておいた', feeling: 'ちょっと気持ちが温かくなった', tags: ['親切', '日常'] },
  { text: 'エレベーターの開ボタンで待っていた', feeling: '当たり前だけど嬉しい気持ち', tags: ['親切', '日常'] },
  { text: '困っていそうな観光客に道を教えた', feeling: '案内できてよかった', tags: ['助け合い', '観光'] },
  { text: 'スーパーで高い棚の商品を取ってあげた', feeling: '喜んでもらえた', tags: ['親切', '日常'] },
  { text: '電車やバスで席を譲った', feeling: '勇気を出してよかった', tags: ['優しさ', '日常'] },
  { text: '大雨の日に傘をシェアした', feeling: '相手も私も嬉しかった', tags: ['助け合い', '天気'] },
  { text: '列に並ぶ人を案内した（混雑時）', feeling: 'スムーズに案内できて安心', tags: ['親切', '日常'] },
  { text: '駅の階段で重そうな荷物を持っている人を手伝った', feeling: '少し照れくさいけど良い気持ち', tags: ['助け合い', '日常'] },
  { text: '友達や同僚に「いつも助かってるよ」と伝えた', feeling: '喜んでもらえた', tags: ['感謝', '言葉'] },
  { text: 'SNSで「いいね」だけじゃなく一言感想を添えた', feeling: '気持ちを伝えられて嬉しい', tags: ['感謝', 'SNS'] },
  { text: '久しぶりの友人に「元気？」と連絡してみた', feeling: '会話が弾んで嬉しい', tags: ['感謝', '友人'] },
  { text: '遅れてきた人に「大丈夫だった？」と優しく声をかけた', feeling: '気遣えて良かった', tags: ['優しさ', '日常'] },
  { text: 'ミスをした人に「誰でもあるよ」とフォローした', feeling: '少しでも安心してもらえた', tags: ['励まし', '職場'] },
  { text: '掃除してくれている人に「ありがとうございます」と伝えた', feeling: '感謝の気持ちを伝えられた', tags: ['感謝', '日常'] },
  { text: 'お店で店員さんに「ごちそうさまでした」と笑顔で伝えた', feeling: '笑顔のやり取りができた', tags: ['感謝', '日常'] },
  { text: '同僚や後輩に「今日の資料わかりやすかった」と褒めた', feeling: '喜んでもらえて嬉しい', tags: ['感謝', '職場'] },
];

// ランダムヘルパー
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickRandom = (arr) => arr[rand(0, arr.length - 1)];

// ======================================================
// ⑤ 再帰的に感謝の連鎖を作成
// ======================================================
const MIN_DEPTH_REQUIRED = 2;
const MAX_DEPTH_ALLOWED = 4;
const STOP_PROBABILITY = 0.45;

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
      text: `${base.text}（Lv.${depth}-${i + 1}）`,
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
      text: '困っていそうな観光客に道を教える',
      feeling: '案内できてよかった',
      tags: ['観光', '助け合い'],
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
