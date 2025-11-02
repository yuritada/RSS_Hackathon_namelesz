import {
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  increment,
  runTransaction,
  arrayUnion,
} from "firebase/firestore";
// config.js から db と postsCollection をインポートする想定
import { db, postsCollection } from '../config'; // ★ db のみ使用
// users.js から getUserProfile をインポートする必要がある場合 (例: getPostChain で使う可能性)
// import { getUserProfile } from '../users'; // 必要に応じてコメント解除

/**
 * 新しいThanksを投稿する関数 (feelingとtagsを追加)
 */
export const addThanksPost = async ({ text, feeling, tags, authorId, isAnonymous }) => {
  await addDoc(postsCollection, {
    type: "thanks",
    text, feeling: feeling || null, tags: tags || [],
    authorId, isAnonymous,
    timestamp: serverTimestamp(),
    likeCount: 0,
    actionCount: 0,
    depth: 0,
    likedBy: [], // likedBy配列を追加
  });
};

/**
 * Next Action を投稿する関数 (トランザクションの読み書き順序を修正)
 * ★ MyPageView (tasks オブジェクト) からの実行に対応
 */
export const addNextAction = async ({ text, feeling, tags, authorId, isAnonymous, parentPost }) => {

  // ★ 1. parentPost が tasks オブジェクトか posts オブジェクトか判定
  //    tasks オブジェクトは 'postId' フィールドを持つと仮定 (スクリーンショットより)
  const isTaskObject = parentPost.hasOwnProperty('postId');

  // ★ 2. 参照するドキュメントIDとRefを決定
  //    isTaskObject が true なら、parentPost.postId (posts の ID) を使う
  //    isTaskObject が false なら、parentPost.id (posts の ID) を使う
  const parentPostIdInPosts = isTaskObject ? parentPost.postId : parentPost.id;
  
  //    isTaskObject が true の場合のみ、tasks ドキュメント (完了対象) への参照を作成
  const taskDocRef = isTaskObject ? doc(db, "tasks", parentPost.id) : null;

  //    posts コレクションの親投稿への参照
  const parentPostRef = doc(db, "posts", parentPostIdInPosts);
  
  // ★ 3. トランザクション内で posts の更新と tasks の更新を同時に行う
  await runTransaction(db, async (transaction) => {
    
    // --- 3a. 親投稿 (posts) の情報を取得 ---
    const parentDoc = await transaction.get(parentPostRef);
    if (!parentDoc.exists()) throw "Parent document (posts) does not exist!";
    
    // --- 3b. ルート投稿 (posts) の情報を取得 ---
    const parentData = parentDoc.data();
    const rootId = parentData.type === 'thanks' ? parentPostIdInPosts : parentData.rootPostId;
    const rootPostRef = doc(db, "posts", rootId);

    let rootDoc = null;
    if (parentPostIdInPosts !== rootId) {
      rootDoc = await transaction.get(rootPostRef);
      if (!rootDoc.exists()) throw "Root document (posts) does not exist!";
    }

    // --- 3c. 新しい Action 投稿 (posts) のデータを作成 ---
    const newActionData = {
      type: "action", text, feeling: feeling || null, tags: tags || [],
      authorId, isAnonymous,
      timestamp: serverTimestamp(),
      likeCount: 0,
      actionCount: 0,
      depth: parentData.depth + 1,
      parentPostId: parentPostIdInPosts, // posts の親ID
      rootPostId: rootId,
      parentAuthorId: parentData.authorId,
      likedBy: [],
    };
    
    // ★ 3d. (重要) もしタスク経由なら、タスク (tasks) を更新 ---
    //    先に新しい Action 投稿 (posts) の参照 (ID) を作成
    const newActionRef = doc(postsCollection);
    
    if (taskDocRef) {
      // taskDocRef (例: tasks/jRLOkgweDEwV...) を更新
      transaction.update(taskDocRef, {
        status: "completed",
        isFinished: true, // MyPageView.vue のフィルタリング用
        completedAt: serverTimestamp(),
        completedActionId: newActionRef.id // どのAction投稿によって完了したかを記録
      });
    }

    // --- 3e. 親投稿とルート投稿 (posts) の actionCount を更新 ---
    const newParentActionCount = (parentData.actionCount || 0) + 1;
    transaction.update(parentPostRef, { actionCount: newParentActionCount });

    if (rootDoc) {
      const newRootActionCount = (rootDoc.data().actionCount || 0) + 1;
      transaction.update(rootPostRef, { actionCount: newRootActionCount });
    }

    // --- 3f. 新しい Action 投稿 (posts) を作成 ---
    transaction.set(newActionRef, newActionData);
  });
};


/**
 * 投稿に「いいね」を追加する（1ユーザー10回まで／一覧表示対応版）
 */
export const likePost = async (postId, userId) => {
  const docRef = doc(db, "posts", postId); // doc() には db が必要

  try {
    await runTransaction(db, async (transaction) => { // runTransaction には db が必要
      const postDoc = await transaction.get(docRef);
      if (!postDoc.exists()) {
        throw "投稿が見つかりません";
      }

      const postData = postDoc.data();
      const currentUserLikeCount = postData.likesMap?.[userId] || 0;

      if (currentUserLikeCount < 10) {
        const userLikesField = `likesMap.${userId}`;

        const updateData = {
          [userLikesField]: increment(1), // ユーザー個人のカウントを+1
          likeCount: increment(1)       // 投稿全体の合計カウントも+1
        };

        // このユーザーからの「いいね」が初回の場合のみ、likedBy配列にIDを追加する
        if (currentUserLikeCount === 0) {
          updateData.likedBy = arrayUnion(userId);
        }

        transaction.update(docRef, updateData);

      } else {
        console.log("いいねは10回までです。");
      }
    });
  } catch (error) {
    console.error("いいね処理に失敗しました:", error);
    // エラーハンドリング: フロントエンド側でUIを元に戻すなどの処理が必要になる場合がある
    throw error; // エラーを再スローして呼び出し元に伝える
  }
};

/**
 * 投稿をIDで指定して削除する関数 (主にテスト用)
 */
export const deletePost = async (postId) => {
  const docRef = doc(db, "posts", postId); // doc() には db が必要
  await deleteDoc(docRef);
};