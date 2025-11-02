<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { logout } from '../firebaseService' // ログアウト関数をインポート
import { user } from '../store/user' // ユーザー情報をインポート

const router = useRouter()

const handleLogout = async () => {
  try {
    await logout()
    router.push('/') // ログアウト後にホームページへ移動
  } catch (error) {
    console.error('ログアウトエラー:', error)
  }
}
</script>

<template>
  <header class="header">
    <div class="logo">
      <RouterLink :to="user ? '/main' : '/'">Thanks</RouterLink>
    </div>

    <nav v-if="!user" class="auth-nav">
      <RouterLink to="/register" class="btn signup">無料で始める</RouterLink>
      <RouterLink to="/login" class="btn login">ログイン</RouterLink>
    </nav>

    <nav v-else class="auth-nav">
    <RouterLink v-if="user" to="/mypage" class="btn login">
        <span v-if="user.displayName">{{ user.displayName }}</span>
        <span v-else>マイページ</span>
    </RouterLink>
    <button @click="handleLogout" class="btn logout">ログアウト</button>
    </nav>

  </header>
</template>

<style scoped>
/* ★★★ ランディングページとフォントを統一 ★★★ */
@import url('https://fonts.googleapis.comcom/css2?family=Nunito:wght@800&family=Poppins:wght@400;700&display=swap');

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 2rem;
  background-color: #FFFFFF;
  border-bottom: 1px solid #fdeee0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  font-family: 'Poppins', sans-serif;

  /* ★★★ ここからが追加したスタイルです ★★★ */
  position: fixed; /* 要素を画面に固定する */
  top: 0;          /* 画面の上端を基準にする */
  left: 0;         /* 画面の左端を基準にする */
  width: 100%;     /* 横幅を画面全体に広げる */
  z-index: 1000;   /* 他の要素より手前に表示する */
  box-sizing: border-box; /* paddingを含めてwidthを100%にする */
}

.logo a {
  font-family: 'Nunito', sans-serif;
  font-weight: 800;
  font-size: 1.8rem;
  text-decoration: none;
  background: linear-gradient(45deg, #FF8C42, #EE965F);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

.auth-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* ★★★ 全ボタン共通のスタイルを定義 ★★★ */
.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.5rem;
  border-radius: 50px;
  text-decoration: none;
  font-weight: bold;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  border: 2px solid transparent;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
  white-space: nowrap; /* ボタン内のテキストが改行しないようにする */
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

/* ★★★ ランディングページのデザインを適用 ★★★ */
.signup {
  background-color: #ee965fff;
  color: white;
}
.signup:hover {
  filter: brightness(1.1);
}

.login {
  background-color: #FFFFFF;
  color: #dc8144ff;
  border-color: #dc8144ff;
}
.login:hover {
  background-color: #FFF7F0;
  border-color: #f79254ff;
}

/* ★★★ ログアウトボタンのデザインを更新 ★★★ */
.logout {
  background-color: #4b5563;  /* 落ち着いたダークグレー */
  color: white;             /* 文字は白 */
  border-color: #4b5563;   /* ボーダーも同色で統一 */
}
.logout:hover {
  background-color: #374151;  /* ホバーでさらに濃いグレーに */
  border-color: #374151;
}

/* ★★★ スマートフォンなど画面が小さい端末向けの調整 ★★★ */
@media (max-width: 480px) {
  .header {
    /* 横の余白を少し狭くして、ボタンがはみ出るのを防ぎます */
    padding: 0.8rem 1rem;
  }

  .logo a {
    /* ロゴも少し小さくしてスペースを確保します */
    font-size: 1.5rem;
  }

  .btn {
    /* ボタンの余白と文字サイズを少し小さくします */
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }

  .auth-nav {
    /* ボタン同士の間隔を少し狭くします */
    gap: 0.5rem;
  }
}
</style>

