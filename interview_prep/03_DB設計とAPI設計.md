# データベース設計・API設計の詳細解説

> Firestoreのコレクション設計、クエリ設計、トランザクション設計をまとめた資料
> 「APIどう設計したの？」「DBの構造は？」という質問への対策

---

## 1. データベースの種類と選定理由

### Cloud Firestore とは

FirebaseのNoSQLドキュメントデータベース。
データを「コレクション（フォルダ）」と「ドキュメント（ファイル）」で管理する。

```
コレクション
  └── ドキュメント（JSONオブジェクト）
       └── サブコレクション（入れ子のコレクション）
```

### MySQLなどのRDBMSと比べた違い

| 観点 | Cloud Firestore（NoSQL） | MySQL（RDBMS） |
|------|-------------------------|----------------|
| データ構造 | ドキュメント（JSON） | テーブル・行・列 |
| スキーマ | 柔軟（事前定義不要） | 厳格（スキーマ定義必要） |
| JOIN | できない | できる |
| リアルタイム | ネイティブ対応 | 別途実装が必要 |
| スケール | 水平スケールしやすい | 垂直スケールが基本 |
| 向いている用途 | 柔軟なデータ・リアルタイム | 複雑なリレーション・集計 |

**なぜFirestoreを選んだか：**
- リアルタイム購読（onSnapshot）でデータ変更を自動反映できる
- サーバー不要でフロントから直接接続できる
- ハッカソンの時間制約に合った素早い開発が可能

---

## 2. コレクション設計の全体図

```
Firestore Database
│
├── posts/                    ← 投稿（Thanks & Action）
│   ├── {postId}              ← ドキュメント（1投稿）
│   └── ...
│
├── tasks/                    ← タスク（保存した投稿）
│   ├── {taskId}
│   └── ...
│
├── users/                    ← ユーザープロフィール
│   ├── {userId}
│   │   └── hiddenPosts/      ← サブコレクション（非表示投稿）
│   │       ├── {postId}
│   │       └── ...
│   └── ...
```

---

## 3. posts コレクション（最重要）

### ドキュメントの構造

```javascript
{
  // --- 基本情報 ---
  type: "thanks",          // "thanks"（感謝投稿）または "action"（行動投稿）
  text: "今日助けてくれてありがとう",  // 本文
  feeling: "嬉しい",       // 感情タグ（任意）
  tags: ["仕事", "感謝"],  // タグの配列

  // --- 投稿者情報 ---
  authorId: "uid_xxxx",    // Firebase AuthのUID
  isAnonymous: false,      // 匿名フラグ

  // --- タイムスタンプ ---
  timestamp: Timestamp,    // サーバータイムスタンプ

  // --- カウンター ---
  likeCount: 5,            // 合計いいね数
  actionCount: 2,          // この投稿への返信（Action）数

  // --- チェーン構造（Actionのみ持つ） ---
  depth: 0,                // 0=Thanks, 1以上=Action
  parentPostId: "xxxx",    // 直接の親投稿のID
  rootPostId: "yyyy",      // チェーンの根（Thanks）のID
  parentAuthorId: "zzzz",  // 親投稿の著者UID

  // --- いいね管理 ---
  likedBy: ["uid_a", "uid_b"],      // いいねしたユーザーのUID配列
  likesMap: { "uid_a": 3, "uid_b": 1 }, // ユーザーごとのいいね回数

  // --- タスク管理 ---
  savedAsTasks: ["uid_x"]  // タスク保存したユーザーのUID配列
}
```

### なぜdepth・parentPostId・rootPostIdの3つが必要か

これがDB設計の核心部分。

```
Thanks投稿(depth:0) [ID: root_001]
    │
    ├── Action投稿(depth:1) [ID: action_001]
    │   parentPostId: root_001
    │   rootPostId: root_001
    │       │
    │       └── Action投稿(depth:2) [ID: action_002]
    │           parentPostId: action_001
    │           rootPostId: root_001   ← 根は常に同じ
    │
    └── Action投稿(depth:1) [ID: action_003]
        parentPostId: root_001
        rootPostId: root_001
```

**rootPostIdが重要な理由：**
「このチェーン全体の投稿をください」というクエリを1回で実行できる。

```javascript
// rootPostId == "root_001" のAction投稿をすべて取得
const q = query(postsCollection, where("rootPostId", "==", "root_001"))
// → action_001, action_002, action_003 が一発で取れる
```

もしrootPostIdがなかったら、再帰的にクエリを繰り返す必要があり、
Firestoreでは非常に実装が複雑になる。

---

## 4. tasks コレクション

「後でActionを投稿する」タスクの管理。

```javascript
{
  // --- 基本情報 ---
  userId: "uid_xxxx",     // タスクを保存したユーザー
  postId: "post_yyyy",    // 対象の投稿ID（posts コレクション）

  // --- 投稿のスナップショット（重要） ---
  postText: "助けてくれてありがとう",  // 保存時の本文コピー
  postFeeling: "嬉しい",
  postTags: ["仕事"],
  postAuthorId: "uid_zzzz",

  // --- ステータス管理 ---
  status: "pending",      // "pending" または "completed"
  isFinished: false,
  savedAt: Timestamp,

  // --- 完了情報（完了後に記入） ---
  completedAt: null,
  completedActionId: null  // どのAction投稿で完了したか
}
```

### なぜ投稿内容のスナップショットを持つか

「投稿が後から削除されてもタスクが表示できる」ため。

元のpostsドキュメントが削除された場合、タスク一覧で「投稿内容が取得できない」問題を防ぐ。
保存時点の内容をコピーして保持することで、タスク一覧は常に表示できる。

これを**スナップショットパターン**と呼ぶ。
イベントソーシングなどの設計でよく使われる考え方。

---

## 5. users コレクション

```javascript
{
  uid: "uid_xxxx",           // Firebase Auth の UID
  displayName: "田中太郎",
  email: "tanaka@example.com",
  createdAt: Timestamp,
  photoURL: null             // プロフィール画像URL（任意）
}
```

### サブコレクション：hiddenPosts

```
users/{userId}/hiddenPosts/{postId}
```

```javascript
{
  postId: "post_xxxx",
  hiddenAt: Timestamp,

  // スナップショット（削除された投稿でもフィルタリングできるように）
  postSnapshot: {
    type: "thanks",
    text: "...",
    tags: ["xxx"],
    authorId: "uid_yyyy",
    depth: 0
  },
  authorSnapshot: {
    displayName: "匿名ユーザー",
    email: null
  }
}
```

**なぜサブコレクションか：**
投稿の非表示設定はユーザーごとに異なるため、`users/{userId}` の下に置くことで
「自分の非表示リスト」を自然に表現できる。
もしpostsに `hiddenBy: ["uid_a", "uid_b"]` のような配列を持たせると、
他のユーザーのプライバシー情報が見えてしまうリスクがある。

---

## 6. クエリ設計（「APIはどう設計していますか？」への回答）

このプロジェクトにバックエンドAPIサーバーは存在しない。
フロントエンドからFirestoreのSDKを直接呼ぶ形のため、
「API設計」 ≒ 「Firestoreクエリの設計」 と捉えてよい。

### 主要なクエリ一覧

#### 投稿一覧取得（Thanks投稿のみ）
```javascript
// firebaseService/posts/read.js
const q = query(
  postsCollection,
  where("type", "==", "thanks"),  // Thanksだけ
  orderBy("timestamp", "desc")     // 新しい順
)
```

#### チェーン全体取得
```javascript
// rootPostIdでまとめて取得する設計がポイント
const q = query(
  postsCollection,
  where("rootPostId", "==", rootId)  // 根が同じ投稿をすべて
)
// 取得後にdepthでソート
posts.sort((a, b) => (a.depth || 0) - (b.depth || 0))
```

#### いいね処理（トランザクション）
```javascript
await runTransaction(db, async (transaction) => {
  const postDoc = await transaction.get(docRef)  // 1. 読む
  const currentCount = postDoc.data().likesMap?.[userId] || 0

  if (currentCount < 10) {
    transaction.update(docRef, {
      [`likesMap.${userId}`]: increment(1),  // 2. 書く（アトミック）
      likeCount: increment(1)
    })
  }
})
```

#### Action投稿（複数ドキュメント同時更新）
```javascript
// 1回のトランザクションで以下をすべて更新
await runTransaction(db, async (transaction) => {
  // ① 親投稿のactionCountを+1
  transaction.update(parentPostRef, { actionCount: increment(1) })

  // ② ルート投稿のactionCountを+1
  transaction.update(rootPostRef, { actionCount: increment(1) })

  // ③ タスクがある場合は完了に更新
  transaction.update(taskDocRef, { status: "completed" })

  // ④ 新しいActionドキュメントを作成
  transaction.set(newActionRef, newActionData)
})
```

---

## 7. トランザクション設計（面接でよく聞かれる）

### トランザクションとは

複数のデータ操作を「全部成功 or 全部失敗」にする仕組み。

例：銀行振込
```
① Aさんの残高を-1000円する
② Bさんの残高を+1000円する
```

①が成功して②が失敗すると、お金が消えてしまう。
トランザクションを使うと「①が失敗したら②も取り消す」を保証できる。

### このプロジェクトでのトランザクション使用箇所

| 処理 | なぜトランザクションが必要か |
|------|--------------------------|
| いいね | 同時に複数ユーザーがいいねしても正しくカウントされるように |
| Action投稿 | 親投稿のactionCount更新・タスク完了・Action作成を一体として扱う |

### 競合状態（Race Condition）の問題

**トランザクションなし（問題あり）：**
```
ユーザーA: likeCount読む(=5) ............. likeCount書く(=6)
ユーザーB:              likeCount読む(=5) ............. likeCount書く(=6)
結果: likeCount = 6  ← 1回分が消えた
```

**トランザクションあり（正しい）：**
```
ユーザーA: likeCount読む(=5) → likeCount書く(=6)
ユーザーB: [待機] → likeCount読む(=6) → likeCount書く(=7)
結果: likeCount = 7  ← 正しい
```

Firestoreのトランザクションは競合した場合、自動でリトライする。

---

## 8. リアルタイム通信の設計

Firestoreには `onSnapshot` というリアルタイム購読機能がある。

```javascript
// 全投稿を購読（変更があるたびにcallbackが呼ばれる）
const unsubscribe = onSnapshot(query, (querySnapshot) => {
  const posts = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  callback(posts)
})

// 購読停止（コンポーネント破棄時に呼ぶ）
unsubscribe()
```

**注意点：**
購読を停止しないとメモリリークが発生する。
Vue 3ではコンポーネントの `onUnmounted` フックで停止処理を呼ぶ。

このプロジェクトでは `getThanksPosts()` は一回限りの取得（`getDocs`）を使っており、
`subscribeToAllPosts()` はリアルタイム購読の実装も用意されている。

---

## 9. データ整合性の設計（スナップショットパターン）

Firestoreは参照整合性（外部キー制約）を持たない。
つまり、postsドキュメントが削除されても、
そのpostIdを参照しているtasksドキュメントは残り続ける。

対策として、tasksドキュメントに投稿内容のコピー（スナップショット）を保持する：

```javascript
// tasks ドキュメント
{
  postId: "post_xxxx",      // 参照先ID（なくなる可能性がある）
  postText: "...",          // コピー（確実に残る）
  postTags: ["xxx"],        // コピー
  postAuthorId: "yyy"       // コピー
}
```

これによりpostsドキュメントが削除されてもタスク一覧が正しく表示される。

---

## 10. 非正規化（Denormalization）の考え方

RDBMSでは重複データをなくす「正規化」が基本だが、
Firestoreでは意図的にデータを重複させる「非正規化」が推奨される。

**理由：**
- Firestoreでは複数コレクションをJOINできない
- 1クエリで必要なデータを取得できるように設計する

**このプロジェクトの非正規化例：**

postsドキュメントに `parentAuthorId`（親投稿の著者ID）を持たせている。
これにより、親投稿を別途取得しなくても返信先の著者を表示できる。

```javascript
// Actionドキュメント
{
  parentPostId: "post_xxx",
  parentAuthorId: "uid_yyy",  // 非正規化：親の情報を子が持つ
}
```

---

## まとめ：面接で「DB・API設計は？」と聞かれたときの答え方

> 「Cloud Firestoreというドキュメント型NoSQLデータベースを使っています。
> 投稿（posts）・タスク（tasks）・ユーザー（users）の3コレクションが主な構成です。
>
> 特に工夫したのはチェーン構造の設計で、各Actionに `rootPostId` を持たせることで、
> チェーン全体を1クエリで取得できるようにしました。
>
> いいねやAction投稿など、複数ドキュメントを同時更新する処理には
> Firestoreのトランザクションを使い、競合状態が起きないようにしています。
>
> バックエンドAPIサーバーは存在せず、フロントエンドからFirestoreのSDKを直接呼ぶ
> BaaS構成です。アクセス制御はFirestoreのセキュリティルールで行います。」

