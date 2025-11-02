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

/**
 * [マイページ用] 完了タブ: 自分がリプライとして投稿したaction投稿を取得
 */
export const getMyCompletedActions = async (uid) => {
  if (!uid) {
    console.log("❌ uid が空です");
    return [];
  }

  console.log("🔍 getMyCompletedActions 開始, uid:", uid);

  try {
    // 1. 自分の完了済みタスクを取得（インデックス不要なクエリに変更）
    const q = query(
      tasksCollection,
      where("userId", "==", uid),
      where("isFinished", "==", true)
      // orderBy を削除（インデックスが不要になる）
    );
    const tasksSnapshot = await getDocs(q);

    console.log("📋 完了済みタスク数:", tasksSnapshot.size);

    // 2. タスクを completedAt でソート & completedActionId を収集
    const tasks = [];
    tasksSnapshot.forEach(doc => {
      const data = doc.data();
      console.log("📄 タスクデータ:", doc.id, data);
      if (data.completedActionId) {
        tasks.push({
          actionId: data.completedActionId,
          completedAt: data.completedAt
        });
      }
    });

    // completedAt でソート（新しい順）
    tasks.sort((a, b) => {
      const aTime = a.completedAt?.toMillis() || 0;
      const bTime = b.completedAt?.toMillis() || 0;
      return bTime - aTime;
    });

    const actionIds = tasks.map(t => t.actionId);
    console.log("🎯 収集したactionIds:", actionIds);

    if (actionIds.length === 0) {
      console.log("⚠️ completedActionId が見つかりませんでした");
      return [];
    }

    // 3. postsコレクションから該当するaction投稿を取得
    const posts = [];
    const chunkSize = 30;
    for (let i = 0; i < actionIds.length; i += chunkSize) {
      const chunk = actionIds.slice(i, i + chunkSize);
      console.log("🔎 postsを検索中, chunk:", chunk);
      const postsQuery = query(
        postsCollection,
        where("__name__", "in", chunk)
      );
      const postsSnapshot = await getDocs(postsQuery);
      console.log("📬 取得した投稿数:", postsSnapshot.size);
      postsSnapshot.forEach(doc => {
        const postData = { id: doc.id, ...doc.data() };
        console.log("📮 投稿データ:", postData);
        posts.push(postData);
      });
    }

    // 4. actionIds の順序に従ってソート
    posts.sort((a, b) => {
      const aIndex = actionIds.indexOf(a.id);
      const bIndex = actionIds.indexOf(b.id);
      return aIndex - bIndex;
    });

    console.log("✅ 最終的に返す投稿数:", posts.length);
    return posts;
  } catch (error) {
    console.error("❌ Error fetching my completed actions:", error);
    return [];
  }
};
