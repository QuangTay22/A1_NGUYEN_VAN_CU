const SUPABASE_URL = "https://vzznktcbhkmoukn tyjgq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6em5rdGNiaGttdW9rbnR5anFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzk3MjYsImV4cCI6MjA4Nzg1NTcyNn0.unkyvL4_AFxRYGpnkyRfW7RHTexuVXbZF1U4Vil8d9Q";

const normalizedUrl = SUPABASE_URL.replace(/\s+/g, "");
const supabaseClient = window.supabase.createClient(normalizedUrl, SUPABASE_ANON_KEY);

const currentPage = window.location.pathname.split("/").pop() || "index.html";

const requireAuth = async () => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  return session;
};

const redirectIfAuthenticated = async () => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session) {
    window.location.href = "home.html";
  }
};

const handleLoginPage = async () => {
  await redirectIfAuthenticated();

  const loginForm = document.getElementById("login-form");
  const goSignupButton = document.getElementById("go-signup");

  goSignupButton?.addEventListener("click", () => {
    window.location.href = "signup.html";
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value;

    if (!email || !password) {
      alert("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      alert(`Đăng nhập thất bại: ${error.message}`);
      return;
    }

    window.location.href = "home.html";
  });
};

const handleSignupPage = async () => {
  await redirectIfAuthenticated();

  const signupForm = document.getElementById("signup-form");
  const goLoginButton = document.getElementById("go-login");

  goLoginButton?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("signup-email")?.value.trim();
    const password = document.getElementById("signup-password")?.value;
    const confirmPassword = document.getElementById("signup-confirm-password")?.value;

    if (!email || !password || !confirmPassword) {
      alert("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Mật khẩu xác nhận không khớp.");
      return;
    }

    const { error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      alert(`Tạo tài khoản thất bại: ${error.message}`);
      return;
    }

    alert("Tạo tài khoản thành công!");
    window.location.href = "home.html";
  });
};

const createPostElement = (post) => {
  const postElement = document.createElement("article");
  postElement.className = "post-item";

  const emailElement = document.createElement("div");
  emailElement.className = "post-email";
  emailElement.textContent = post.user_email || "Ẩn danh";

  const contentElement = document.createElement("p");
  contentElement.className = "post-content";
  contentElement.textContent = post.content;

  const timeElement = document.createElement("div");
  timeElement.className = "post-time";
  const createdAt = new Date(post.created_at);
  timeElement.textContent = createdAt.toLocaleString("vi-VN");

  postElement.append(emailElement, contentElement, timeElement);
  return postElement;
};

const loadPosts = async () => {
  const postsList = document.getElementById("posts-list");
  if (!postsList) return;

  postsList.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("posts")
    .select("id, user_email, content, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    alert(`Không thể tải bài viết: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!";
    postsList.appendChild(emptyState);
    return;
  }

  data.forEach((post) => {
    postsList.appendChild(createPostElement(post));
  });
};

const handleHomePage = async () => {
  const session = await requireAuth();
  if (!session) return;

  const postForm = document.getElementById("post-form");
  const logoutButton = document.getElementById("logout-btn");
  const postContentInput = document.getElementById("post-content");

  await loadPosts();

  postForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = postContentInput?.value.trim() || "";
    const email = session.user.email || "unknown@example.com";

    if (!content) {
      alert("Nội dung bài viết không được để trống.");
      return;
    }

    const { error } = await supabaseClient.from("posts").insert([
      {
        user_email: email,
        content,
      },
    ]);

    if (error) {
      alert(`Đăng bài thất bại: ${error.message}`);
      return;
    }

    if (postContentInput) postContentInput.value = "";
    await loadPosts();
  });

  logoutButton?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });
};

window.addEventListener("DOMContentLoaded", async () => {
  if (currentPage === "index.html" || currentPage === "") {
    await handleLoginPage();
  } else if (currentPage === "signup.html") {
    await handleSignupPage();
  } else if (currentPage === "home.html") {
    await handleHomePage();
  }
});
