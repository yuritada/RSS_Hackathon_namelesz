<script setup>
import { useRouter } from 'vue-router'
import { ref, onMounted, computed, watch } from 'vue' // ★ computed は不要になるので削除してもOK
import { onAuthStateChanged } from 'firebase/auth' // ★ 1. onAuthStateChanged をインポート
import { auth, getUserProfile, getMyPageStats, getMyPosts, getMyConnectedPosts, getMyLikedPosts } from '../firebaseService'
import ThanksCard from '../components/ThanksCard.vue'
import { replyToPost, isPostFormModalOpen } from '../store/modal'

const router = useRouter()

const goBack = () => {
  router.push('/main')
}

const userProfile = ref(null)
const stats = ref({ relaysGiven: 0, relaysReceived: 0 })
const activeTab = ref('myPosts')
const posts = ref([])
const isLoading = ref(true) // ★ 初期値は true のまま
const isLoadingTab = ref(false)
// const uid = computed(() => auth.currentUser?.uid) // ★ 2. この行を削除
const uid = ref(null) // ★ 3. uid を ref に変更

const fetchFunctions = {
  myPosts: getMyPosts,
  connected: getMyConnectedPosts,
  unFinishedConnected: async (uid) => {
    const allConnected = await getMyConnectedPosts(uid)
    return allConnected.filter(post => !post.isFinished)
  },
  finishedConnected: async (uid) => {
    const allConnected = await getMyConnectedPosts(uid)
    return allConnected.filter(post => post.isFinished)
  },
  liked: getMyLikedPosts
}

const switchTab = async (tabName) => {
  if (!uid.value) return; // ★ ref なので .value でOK
  activeTab.value = tabName
  isLoadingTab.value = true
  posts.value = []
  try {
    posts.value = await fetchFunctions[tabName](uid.value)
  } catch (error) {
    console.error(`${tabName}の投稿取得に失敗:`, error)
  } finally {
    isLoadingTab.value = false
  }
}

const handleNextActionClick = (post) => {
  replyToPost.value = post
  isPostFormModalOpen.value = true
}

watch(isPostFormModalOpen, (newValue, oldValue) => {
  if (oldValue === true && newValue === false) {
    if (activeTab.value === 'unFinishedConnected' || activeTab.value === 'finishedConnected') {
      switchTab(activeTab.value)
    }
  }
})

// ★ 4. onMounted の中身を onAuthStateChanged でラップする
onMounted(() => {
  // onAuthStateChanged は認証状態の監視を開始し、解除用の関数(unsubscribe)を返す
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    // このコールバックは、認証状態が確定した時（リロード時）に1回実行される
    
    if (firebaseUser) {
      // ★ ユーザーがログインしている場合
      uid.value = firebaseUser.uid // ★ ref に uid をセット
      
      // ★ ログインしているので、データを取得する（元のonMountedのロジック）
      try {
        const [profile, statsData] = await Promise.all([
          getUserProfile(uid.value),
          getMyPageStats(uid.value)
        ])
        userProfile.value = profile
        stats.value = statsData
        await switchTab('unFinishedConnected') 
      } catch (error) {
        console.error("マイページ情報の取得に失敗:", error)
      } finally {
        isLoading.value = false // ★ データを読み終えたらローディング解除
      }

    } else {
      // ★ ユーザーがログインしていない場合
      uid.value = null
      isLoading.value = false // ★ ローディング解除
    }
    
    // ★ 5. ページロード時の初回チェックが終わったら、監視を解除する
    // (これがないと、このページでログアウトした時などにも再度実行されてしまうため)
    unsubscribe()
  })
})
</script>

<template>
  <div class="page-container">

    <div class="header-actions">
      <button @click="goBack" class="back-button">← 戻る</button>
    </div>

    <div v-if="isLoading" class="message"><p>読み込み中...</p></div>

    <div v-else-if="!uid" class="message"><p>このページを表示するにはログインが必要です。</p></div>

    <div v-else>
      <header class="profile-header">
        <div class="avatar-placeholder"></div>
        <div class="profile-info">
          <h1>{{ userProfile?.displayName || '名無しさん' }}</h1>
          <p>{{ auth.currentUser.email || 'メールアドレス未設定' }}</p>
        </div>
      </header>

      <section class="stats-container">
        <div class="stat-item">
          <span class="stat-label">リレーした数</span>
          <span class="stat-value">{{ stats.relaysGiven }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">リレーされた数</span>
          <span class="stat-value">{{ stats.relaysReceived }}</span>
        </div>
      </section>

      <nav class="tabs">
        <a @click.prevent="switchTab('unFinishedConnected')" :class="{ active: activeTab === 'unFinishedConnected' }">ボトルメール (Shared)</a>
        <a @click.prevent="switchTab('finishedConnected')" :class="{ active: activeTab === 'finishedConnected' }">完了 (Finished)</a>
        <a @click.prevent="switchTab('myPosts')" :class="{ active: activeTab === 'myPosts' }">自分の投稿 (Thanks)</a>
        <a @click.prevent="switchTab('liked')" :class="{ active: activeTab === 'liked' }">いいね</a>
      </nav>

      <div class="content-area">
        <div v-if="isLoadingTab" class="message"><p>読み込み中...</p></div>
        <div v-else-if="posts.length > 0" class="posts-list">
          <ThanksCard 
            v-for="post in posts" 
            :key="post.id" 
            :post="post"
            :show-next-action-button="activeTab === 'unFinishedConnected'"
            @next-action-clicked="handleNextActionClick"
          />
        </div>
        <div v-else class="message"><p>表示する投稿がありません。</p></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* スタイル部分は変更なし */
.header-actions {
  margin-bottom: 2rem;
}
.back-button {
  display: inline-flex; /* アイコンとテキストをきれいに並べるため */
  align-items: center;
  gap: 0.5rem;

  font-size: 1rem; /* 文字を少し大きく */
  font-weight: bold;
  color: #dc8144ff; /* テーマカラーを使用 */
  background-color: #fff;
  border: 2px solid #dc8144ff; /* テーマカラーの枠線 */
  padding: 0.7rem 1.5rem; /* ボタンを大きく */
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 3px 6px rgba(0,0,0,0.05); /* 影を追加 */
}
.back-button:hover {
  background-color: #dc8144ff; /* ホバー時に色を反転 */
  color: #fff;
  transform: translateY(-2px); /* 少し浮き上がる効果 */
  box-shadow: 0 5px 10px rgba(0,0,0,0.1);
}

.page-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.profile-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #eee;
}
.avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #e0e0e0;
}
.profile-info h1 {
  margin: 0 0 0.5rem;
  font-size: 1.8rem;
}
.profile-info p {
  margin: 0;
  color: #888;
}
.stats-container {
  display: flex;
  justify-content: space-around;
  margin-bottom: 2.5rem;
  text-align: center;
}
.stat-label {
  display: block;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}
.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #dc8144ff;
}
.tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 2rem;
}
.tabs a {
  padding: 1rem 1.5rem;
  text-decoration: none;
  color: #888;
  font-weight: bold;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}
.tabs a:hover {
  color: #333;
}
.tabs a.active {
  color: #dc8144ff;
  border-bottom-color: #dc8144ff;
}
.posts-list {
  display: grid;
  gap: 1.5rem;
}
.message {
  text-align: center;
  color: #666;
  margin-top: 3rem;
  font-size: 1.1rem;
}
</style>