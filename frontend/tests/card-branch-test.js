import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

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
const auth = getAuth(app);
const db = getFirestore(app);

// テストユーザーデータ
const testUsers = [
  { email: 'root-user@example.com', password: 'test1234', displayName: 'ルート太郎' },
  { email: 'branch1-user@example.com', password: 'test1234', displayName: '枝分かれ花子' },
  { email: 'branch2-user@example.com', password: 'test1234', displayName: '枝分かれ次郎' },
  { email: 'branch3-user@example.com', password: 'test1234', displayName: '枝分かれ三郎' },
];

// ログ表示用関数
const log = (emoji, message) => console.log(`${emoji} ${message}`);
const success = (message) => log('✅', message);
const error = (message) => log('❌', message);
const info = (message) => log('ℹ️', message);
const separator = () => console.log('\n' + '='.repeat(60) + '\n');

// ユーザー作成または取得
async function createOrGetUser(userData) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const uid = userCredential.user.uid;

    // usersコレクションにプロフィール作成
    await setDoc(doc(db, 'users', uid), {
      uid,
      displayName: userData.displayName,
      email: userData.email,
      createdAt: new Date(),
    });

    success(`ユーザー作成成功: ${userData.displayName} (${userData.email})`);
    return uid;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      // 既存ユーザーの場合はログインしてUIDを取得
      const userCredential = await signInWithEmailAndPassword(auth, userData.email, userData.password);
      info(`既存ユーザー: ${userData.displayName} (${userData.email})`);
      return userCredential.user.uid;
    }
    throw err;
  }
}

// カード（投稿）を作成
async function createPost(postData) {
  const docRef = await addDoc(collection(db, 'posts'), {
    ...postData,
    timestamp: new Date(),
    likeCount: 0,
    actionCount: 0,
    likedBy: [],
    likesMap: {},
    savedAsTasks: [],
  });

  return docRef.id;
}

// メイン処理
async function generateTestData() {
  separator();
  console.log('🌳 カード枝分かれテストデータ生成開始');
  separator();

  try {
    // 1. ユーザー作成
    info('ステップ1: ユーザーアカウント作成');
    const userIds = [];

    for (const userData of testUsers) {
      const uid = await createOrGetUser(userData);
      userIds.push(uid);
    }

    separator();
    info('ステップ2: ルートカード（Thanks投稿）作成');

    // 2. ルートカード作成
    const rootPostId = await createPost({
      type: 'thanks',
      text: '【テスト】駅で困っていたら、優しい人が助けてくれました',
      feeling: '感謝',
      tags: ['駅', '優しさ', 'テスト'],
      authorId: userIds[0],
      isAnonymous: false,
      depth: 0,
      replyTo: null,
      parentPostId: null,
      rootPostId: null,
      parentAuthorId: null,
    });

    success(`ルートカード作成: ID=${rootPostId}`);

    separator();
    info('ステップ3: 枝分かれカード（NextAction）作成');

    // 3. 第1階層の枝分かれ（3つ）
    const branch1Posts = [];

    const branch1Data = [
      { text: '【テスト】私も駅で困っている人を助けました！', feeling: '嬉しい', tags: ['駅', '助け合い'] },
      { text: '【テスト】電車内で席を譲りました', feeling: '温かい', tags: ['電車', '優しさ'] },
      { text: '【テスト】道案内をしてあげました', feeling: '満足', tags: ['道案内', '親切'] },
    ];

    for (let i = 0; i < 3; i++) {
      const postId = await createPost({
        type: 'action',
        text: branch1Data[i].text,
        feeling: branch1Data[i].feeling,
        tags: branch1Data[i].tags,
        authorId: userIds[i + 1],
        isAnonymous: false,
        depth: 1,
        replyTo: rootPostId,
        parentPostId: rootPostId,
        rootPostId: rootPostId,
        parentAuthorId: userIds[0],
      });

      branch1Posts.push(postId);
      success(`枝分かれカード作成 (Lv.1): ID=${postId}`);
    }

    separator();
    info('ステップ4: さらなる枝分かれ（第2階層）作成');

    // 4. 第2階層の枝分かれ（最初の枝からさらに2つ）
    const branch2Data = [
      { text: '【テスト】その話を聞いて、私も荷物を持ってあげました', feeling: '幸せ', tags: ['助け合い', '連鎖'] },
      { text: '【テスト】バスで高齢者に声をかけました', feeling: '充実', tags: ['バス', '優しさ'] },
    ];

    for (let i = 0; i < 2; i++) {
      const postId = await createPost({
        type: 'action',
        text: branch2Data[i].text,
        feeling: branch2Data[i].feeling,
        tags: branch2Data[i].tags,
        authorId: userIds[(i + 1) % userIds.length],
        isAnonymous: false,
        depth: 2,
        replyTo: branch1Posts[0], // 最初の枝分かれに対する返信
        parentPostId: branch1Posts[0],
        rootPostId: rootPostId,
        parentAuthorId: userIds[1],
      });

      success(`枝分かれカード作成 (Lv.2): ID=${postId}`);
    }

    separator();
    success('✨ テストデータ生成完了！');

    separator();
    console.log('📋 生成されたテストアカウント一覧');
    console.log('='.repeat(60));
    testUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.displayName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log('');
    });

    separator();
    info('データ構造:');
    console.log(`
    📄 ルート (${testUsers[0].displayName})
    │
    ├─── 🔄 枝1 (${testUsers[1].displayName})
    │     ├─── 🔄 枝1-1 (${testUsers[1].displayName})
    │     └─── 🔄 枝1-2 (${testUsers[2].displayName})
    │
    ├─── 🔄 枝2 (${testUsers[2].displayName})
    │
    └─── 🔄 枝3 (${testUsers[3].displayName})
    `);

    separator();

  } catch (err) {
    error(`エラーが発生しました: ${err.message}`);
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
}

// 実行
generateTestData();
