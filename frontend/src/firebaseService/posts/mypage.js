import {
  getDocs,
  query,
  where,
  orderBy,
  collection
} from "firebase/firestore";
// config.js から db と postsCollection をインポートする想定
import { postsCollection, tasksCollection } from '../config';

/**
 * [マイページ用] 統計情報（リレーした数、された数）を取得【修正版】
 */
export const getMyPageStats = async (uid) => {
  if (!uid) return { relaysGiven: 0, relaysReceived: 0 };

  // リレーした数: 自分が authorId で type が 'action' の投稿数
  const relaysGivenQuery = query(postsCollection, where("authorId", "==", uid), where("type", "==", "action"));

  // リレーされた数: parentAuthorId が自分で、authorId が自分ではない投稿数
  const relaysReceivedQuery = query(
    postsCollection,
    where("parentAuthorId", "==", uid),
    where("authorId", "!=", uid),
    where("type", "==", "action") //念のためtypeも指定
  );

  try {
    const [relaysGivenSnap, relaysReceivedSnap] = await Promise.all([
      getDocs(relaysGivenQuery),
      // ★ ここが relaysReceivedSnap になっていました。正しくは relaysReceivedQuery です。
      getDocs(relaysReceivedQuery) 
    ]);
    return { relaysGiven: relaysGivenSnap.size, relaysReceived: relaysReceivedSnap.size };
  } catch (error) {
    console.error("Error fetching my page stats:", error);
    return { relaysGiven: 0, relaysReceived: 0 }; // エラー時は0を返す
  }
};

/**
 * [マイページ用] 自分が投稿したThanksを取得
 */
export const getMyPosts = async (uid) => {
  if (!uid) return [];
  const q = query(postsCollection, where("authorId", "==", uid), where("type", "==", "thanks"), orderBy("timestamp", "desc"));
  try {
    const querySnapshot = await getDocs(q);
    const posts = [];
    querySnapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
    return posts;
  } catch (error) {
    console.error("Error fetching my posts:", error);
    return [];
  }
};

/**
 * ★ [マイページ用] 自分が「保管した」（Next Action待ちの）タスクを取得
 * (getMyConnectedPosts の実装を tasks を見るように変更)
 */
export const getMyConnectedPosts = async (uid) => {
  if (!uid) return [];
  // ★ 参照先を postsCollection -> tasksCollection に変更
  // ★ 検索条件を authorId -> userId に変更 (tasks コレクションのフィールド名に合わせる)
  // ★ ソート順を timestamp -> savedAt に変更 (tasks コレクションのフィールド名に合わせる)
  const q = query(tasksCollection, where("userId", "==", uid), orderBy("savedAt", "desc"));
  try {
    const querySnapshot = await getDocs(q);
    const posts = [];
    querySnapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
    // ★ MyPageView.vue 側で isFinished: false / true でフィルタリングされるので、
    //    ここでは uid に紐づくタスクをすべて返す
    return posts;
  } catch (error) {
    // ★ エラーメッセージを分かりやすく変更
    console.error("Error fetching my connected tasks:", error);
    return [];
  }
};

/**
 * [マイページ用] 自分が「いいね」した投稿を全て取得
 */
export const getMyLikedPosts = async (uid) => {
  if (!uid) return [];
  // likedBy 配列に uid が含まれる投稿を検索
  const q = query(postsCollection, where("likedBy", "array-contains", uid), orderBy("timestamp", "desc"));
  try {
    const querySnapshot = await getDocs(q);
    const posts = [];
    querySnapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
    return posts;
  } catch (error) {
    console.error("Error fetching my liked posts:", error);
    return [];
  }
};

/**
 * [マイページ用] 自分がLv.0で投稿したThanks（Root投稿）を取得
 */
export const getMyRootPosts = async (uid) => {
  if (!uid) return [];
  
  const q = query(
    postsCollection,
    where("authorId", "==", uid),
    where("type", "==", "thanks"),
    where("depth", "==", 0),
    orderBy("timestamp", "desc")
  );

  try {
    const querySnapshot = await getDocs(q);
    const posts = [];
    querySnapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
    return posts;
  } catch (error) {
    console.error("Error fetching my root posts:", error);
    return [];
  }
};