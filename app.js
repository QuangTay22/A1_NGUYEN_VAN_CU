const SUPABASE_URL = "https://vzznktcbhkmoukn tyjgq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6em5rdGNiaGttdW9rbnR5anFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzk3MjYsImV4cCI6MjA4Nzg1NTcyNn0.unkyvL4_AFxRYGpnkyRfW7RHTexuVXbZF1U4Vil8d9Q";

const POST_EMAIL_COLUMNS = ["user_email", "email"];
let cachedPostEmailColumn = null;

const decodeJwtPayload = (token) => {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const getSupabaseProjectRef = () => {
  const payload = decodeJwtPayload(SUPABASE_ANON_KEY);
  if (payload && typeof payload.ref === "string" && payload.ref.length > 0) return payload.ref;

  const fallback = SUPABASE_URL.replace(/\s+/g, "").match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i);
  return fallback ? fallback[1] : null;
};

const buildSupabaseUrl = () => {
  const projectRef = getSupabaseProjectRef();
  return projectRef ? `https://${projectRef}.supabase.co` : SUPABASE_URL.replace(/\s+/g, "");
};

const ACTIVE_SUPABASE_URL = buildSupabaseUrl();
const supabaseClient = window.supabase.createClient(ACTIVE_SUPABASE_URL, SUPABASE_ANON_KEY);
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const isPreviewMode = new URLSearchParams(window.location.search).get("preview") === "1";

const getInputValue = (id) => document.getElementById(id)?.value.trim() || "";

const setButtonLoading = (button, isLoading, loadingText, defaultText) => {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
};

const handleNetworkError = (error, fallbackMessage) => {
  if (error && (error.message || "").toLowerCase().includes("failed to fetch")) {
    alert(
      `${fallbackMessage}\n\nKhông thể kết nối tới Supabase (${ACTIVE_SUPABASE_URL}).\n` +
        "Hãy kiểm tra Internet, hard refresh (Ctrl + F5), và đảm bảo project Supabase đang hoạt động."
    );
    return true;
  }
  return false;
};

const isMissingPostColumnError = (error, columnName) => {
  if (!error || !error.message) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes(`column posts.${columnName} does not exist`) ||
    message.includes(`could not find the '${columnName}' column`) ||
    message.includes(`'${columnName}' column of 'posts'`)
  );
};

const getAlternatePostColumn = (columnName) => POST_EMAIL_COLUMNS.find((col) => col !== columnName) || columnName;

const detectPostEmailColumn = async () => {
  if (cachedPostEmailColumn) return cachedPostEmailColumn;

  for (const columnName of POST_EMAIL_COLUMNS) {
    const { error } = await supabaseClient.from("posts").select(`id, ${columnName}`).limit(1);
    if (!error || !isMissingPostColumnError(error, columnName)) {
      cachedPostEmailColumn = columnName;
      return cachedPostEmailColumn;
    }
  }

  cachedPostEmailColumn = POST_EMAIL_COLUMNS[0];
  return cachedPostEmailColumn;
};

const buildPostTitle = (title, content) => {
  const fromInput = (title || "").trim();
  if (fromInput) return fromInput.slice(0, 120);

  const normalized = (content || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Bài viết mới";
  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(new Error("Không thể đọc file."));
    reader.readAsDataURL(file);
  });

const doPostInsert = async (payload) => supabaseClient.from("posts").insert([payload], { defaultToNull: false });

const removeUnknownColumnFromPayload = (payload, errorMessage) => {
  const next = { ...payload };
  ["title", "image_url", "music_url", "user_email", "email"].forEach((column) => {
    if (errorMessage.includes(`column posts.${column} does not exist`) || errorMessage.includes(`'${column}' column`)) {
      delete next[column];
    }
  });
  return next;
};

const insertPostWithFallback = async ({ email, title, content, imageUrl, musicUrl }) => {
  let payload = {
    user_email: email,
    title: buildPostTitle(title, content),
    content,
    image_url: imageUrl || null,
    music_url: musicUrl || null,
  };

  let result = await doPostInsert(payload);

  for (let i = 0; i < 4 && result.error; i += 1) {
    const message = (result.error.message || "").toLowerCase();

    if (isMissingPostColumnError(result.error, "user_email")) {
      delete payload.user_email;
      payload.email = email;
      result = await doPostInsert(payload);
      continue;
    }

    if (message.includes("does not exist") || message.includes("could not find")) {
      payload = removeUnknownColumnFromPayload(payload, message);
      result = await doPostInsert(payload);
      continue;
    }

    if (message.includes('null value') && message.includes('column "title"')) {
      payload.title = buildPostTitle(title, content);
      result = await doPostInsert(payload);
      continue;
    }

    break;
  }

  return result;
};

const requireAuth = async () => {
  if (isPreviewMode) return { user: { email: "demo@lop.vn", id: "preview" } };

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
  if (isPreviewMode) return false;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session) {
    window.location.href = "home.html";
    return true;
  }

  return false;
};

const handleLoginPage = async () => {
  const redirected = await redirectIfAuthenticated();
  if (redirected) return;

  const loginForm = document.getElementById("login-form");
  const goSignupButton = document.getElementById("go-signup");
  const loginSubmitButton = loginForm?.querySelector('button[type="submit"]');

  goSignupButton?.addEventListener("click", () => {
    window.location.href = "signup.html";
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = getInputValue("login-email");
    const password = document.getElementById("login-password")?.value || "";

    if (!email || !password) {
      alert("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setButtonLoading(loginSubmitButton, true, "Đang đăng nhập...", "Log in");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setButtonLoading(loginSubmitButton, false, "Đang đăng nhập...", "Log in");

    if (error) {
      if (handleNetworkError(error, "Đăng nhập thất bại.")) return;
      alert(`Đăng nhập thất bại: ${error.message}`);
      return;
    }

    window.location.href = "home.html";
  });
};

const handleSignupPage = async () => {
  const redirected = await redirectIfAuthenticated();
  if (redirected) return;

  const signupForm = document.getElementById("signup-form");
  const goLoginButton = document.getElementById("go-login");
  const signupSubmitButton = signupForm?.querySelector('button[type="submit"]');

  goLoginButton?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = getInputValue("signup-email");
    const password = document.getElementById("signup-password")?.value || "";
    const confirmPassword = document.getElementById("signup-confirm-password")?.value || "";

    if (!email || !password || !confirmPassword) {
      alert("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Mật khẩu xác nhận không khớp.");
      return;
    }

    setButtonLoading(signupSubmitButton, true, "Đang tạo tài khoản...", "Create account");
    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      setButtonLoading(signupSubmitButton, false, "Đang tạo tài khoản...", "Create account");
      if (handleNetworkError(error, "Tạo tài khoản thất bại.")) return;
      alert(`Tạo tài khoản thất bại: ${error.message}`);
      return;
    }

    if (!data.session) {
      setButtonLoading(signupSubmitButton, false, "Đang tạo tài khoản...", "Create account");
      alert("Tài khoản đã được tạo. Vui lòng xác nhận email (nếu được bật) rồi đăng nhập.");
      window.location.href = "index.html";
      return;
    }

    setButtonLoading(signupSubmitButton, false, "Đang tạo tài khoản...", "Create account");
    window.location.href = "home.html";
  });
};

const createPostElement = (post, emailColumn) => {
  const article = document.createElement("article");
  article.className = "post-item";

  const emailElement = document.createElement("div");
  emailElement.className = "post-email";
  emailElement.textContent = post[emailColumn] || post.user_email || post.email || "Ẩn danh";

  const titleElement = document.createElement("h3");
  titleElement.className = "post-title";
  titleElement.textContent = post.title || "Bài viết không tiêu đề";

  const contentElement = document.createElement("p");
  contentElement.className = "post-content";
  const shortContent = (post.content || "").trim();
  contentElement.textContent = shortContent.length > 180 ? `${shortContent.slice(0, 180)}...` : shortContent;

  article.append(emailElement, titleElement, contentElement);

  if (post.image_url) {
    const image = document.createElement("img");
    image.src = post.image_url;
    image.className = "post-thumb";
    image.alt = post.title || "Ảnh bài viết";
    article.appendChild(image);
  }

  if (post.music_url) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = post.music_url;
    audio.className = "media-preview";
    article.appendChild(audio);
  }

  const timeElement = document.createElement("div");
  timeElement.className = "post-time";
  timeElement.textContent = new Date(post.created_at).toLocaleString("vi-VN", { hour12: false });
  article.appendChild(timeElement);

  const actions = document.createElement("div");
  actions.className = "post-actions";
  const detail = document.createElement("a");
  detail.className = "text-link";
  detail.href = `detail.html?id=${post.id}`;
  detail.textContent = "Xem chi tiết";
  actions.appendChild(detail);
  article.appendChild(actions);

  return article;
};

const loadPosts = async () => {
  const postsList = document.getElementById("posts-list");
  if (!postsList) return;

  postsList.innerHTML = "";
  if (isPreviewMode) {
    postsList.appendChild(
      createPostElement(
        {
          id: 1,
          user_email: "demo@lop.vn",
          title: "Ngày đầu tiên đi học cùng nhau",
          content: "Chúng mình đã cười rất nhiều, ai cũng ngại ngùng nhưng ấm áp.",
          created_at: new Date().toISOString(),
        },
        "user_email"
      )
    );
    return;
  }

  let emailColumn = await detectPostEmailColumn();
  let result = await supabaseClient
    .from("posts")
    .select(`id, title, content, image_url, music_url, created_at, ${emailColumn}`)
    .order("created_at", { ascending: false });

  if (isMissingPostColumnError(result.error, emailColumn)) {
    emailColumn = getAlternatePostColumn(emailColumn);
    cachedPostEmailColumn = emailColumn;
    result = await supabaseClient
      .from("posts")
      .select(`id, title, content, image_url, music_url, created_at, ${emailColumn}`)
      .order("created_at", { ascending: false });
  }

  const { data, error } = result;
  if (error) {
    if (!handleNetworkError(error, "Không thể tải bài viết.")) alert(`Không thể tải bài viết: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!";
    postsList.appendChild(empty);
    return;
  }

  data.forEach((post) => postsList.appendChild(createPostElement(post, emailColumn)));
};

const renderSpecialDays = (days) => {
  const list = document.getElementById("special-days-list");
  if (!list) return;
  list.innerHTML = "";

  if (!days || days.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Chưa có ngày đặc biệt nào.";
    list.appendChild(empty);
    return;
  }

  days.forEach((day) => {
    const card = document.createElement("article");
    card.className = "special-card";

    card.innerHTML = `
      <h4>${day.title}</h4>
      <div class="meta">${day.date || "Chưa có ngày"}</div>
      <p>${day.description || ""}</p>
      ${day.image_url ? `<img class="post-thumb" src="${day.image_url}" alt="${day.title}" />` : ""}
      <button type="button" class="btn btn-light" data-delete-special="${day.id}">Xóa</button>
    `;

    list.appendChild(card);
  });
};

const loadSpecialDays = async () => {
  if (isPreviewMode) {
    renderSpecialDays([
      { id: 1, title: "Sinh nhật Lan", date: "2026-03-08", description: "Cả lớp chúc mừng 🎂" },
      { id: 2, title: "Ngày kỷ niệm", date: "2026-05-20", description: "Ngày gặp nhau đầu tiên" },
    ]);
    return;
  }

  const { data, error } = await supabaseClient.from("special_days").select("id, title, date, description, image_url").order("date");
  if (error) {
    if (!error.message.toLowerCase().includes("does not exist")) {
      alert(`Không thể tải ngày đặc biệt: ${error.message}`);
    }
    return;
  }
  renderSpecialDays(data || []);
};

const handleSpecialDaysCrud = async () => {
  const form = document.getElementById("special-day-form");
  const list = document.getElementById("special-days-list");
  if (!form || !list) return;

  await loadSpecialDays();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = getInputValue("special-title");
    const date = getInputValue("special-date");
    const description = getInputValue("special-description");
    const imageUrl = getInputValue("special-image");

    if (!title || !date) {
      alert("Vui lòng nhập tiêu đề và ngày cho mục đặc biệt.");
      return;
    }

    if (isPreviewMode) {
      await loadSpecialDays();
      form.reset();
      return;
    }

    const { error } = await supabaseClient.from("special_days").insert([
      { title, date, description, image_url: imageUrl || null },
    ]);

    if (error) {
      alert(`Không thể tạo ngày đặc biệt: ${error.message}`);
      return;
    }

    form.reset();
    await loadSpecialDays();
  });

  list.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.deleteSpecial;
    if (!id || isPreviewMode) return;

    const { error } = await supabaseClient.from("special_days").delete().eq("id", id);
    if (error) {
      alert(`Không thể xóa mục: ${error.message}`);
      return;
    }

    await loadSpecialDays();
  });
};

const setupMediaPreview = () => {
  const imageInput = document.getElementById("post-image");
  const musicInput = document.getElementById("post-music");
  const imagePreview = document.getElementById("image-preview");
  const musicPreview = document.getElementById("music-preview");

  imageInput?.addEventListener("change", async () => {
    const file = imageInput.files?.[0];
    if (!file || !imagePreview) return;
    imagePreview.src = await readFileAsDataUrl(file);
    imagePreview.classList.remove("hidden");
  });

  musicInput?.addEventListener("change", async () => {
    const file = musicInput.files?.[0];
    if (!file || !musicPreview) return;
    musicPreview.src = await readFileAsDataUrl(file);
    musicPreview.classList.remove("hidden");
  });
};

const handleHomePage = async () => {
  const session = await requireAuth();
  if (!session) return;

  const postForm = document.getElementById("post-form");
  const logoutButton = document.getElementById("logout-btn");
  const postTitleInput = document.getElementById("post-title");
  const postContentInput = document.getElementById("post-content");
  const imageInput = document.getElementById("post-image");
  const musicInput = document.getElementById("post-music");
  const postSubmitButton = postForm?.querySelector('button[type="submit"]');

  setupMediaPreview();
  await handleSpecialDaysCrud();
  await loadPosts();

  postForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = postTitleInput?.value || "";
    const content = postContentInput?.value.trim() || "";
    const email = session.user.email || "unknown@example.com";

    if (!content) {
      alert("Nội dung bài viết không được để trống.");
      return;
    }

    setButtonLoading(postSubmitButton, true, "Đang đăng...", "Đăng bài");

    let imageUrl = "";
    let musicUrl = "";

    try {
      imageUrl = await readFileAsDataUrl(imageInput?.files?.[0]);
      musicUrl = await readFileAsDataUrl(musicInput?.files?.[0]);
    } catch (error) {
      setButtonLoading(postSubmitButton, false, "Đang đăng...", "Đăng bài");
      alert(error.message || "Không thể đọc file upload.");
      return;
    }

    const result = await insertPostWithFallback({ email, title, content, imageUrl, musicUrl });
    setButtonLoading(postSubmitButton, false, "Đang đăng...", "Đăng bài");

    if (result.error) {
      if (handleNetworkError(result.error, "Đăng bài thất bại.")) return;
      alert(`Đăng bài thất bại: ${result.error.message}`);
      return;
    }

    if (postContentInput) postContentInput.value = "";
    if (postTitleInput) postTitleInput.value = "";
    if (imageInput) imageInput.value = "";
    if (musicInput) musicInput.value = "";
    document.getElementById("image-preview")?.classList.add("hidden");
    document.getElementById("music-preview")?.classList.add("hidden");

    await loadPosts();
  });

  logoutButton?.addEventListener("click", async () => {
    if (!isPreviewMode) {
      await supabaseClient.auth.signOut();
    }
    window.location.href = "index.html";
  });
};

const handleDetailPage = async () => {
  const session = await requireAuth();
  if (!session) return;

  const container = document.getElementById("post-detail-container");
  if (!container) return;

  const postId = new URLSearchParams(window.location.search).get("id");
  if (!postId) {
    container.innerHTML = '<p class="empty-state">Không tìm thấy bài viết.</p>';
    return;
  }

  const emailColumn = await detectPostEmailColumn();
  const { data, error } = await supabaseClient
    .from("posts")
    .select(`id, title, content, image_url, music_url, created_at, ${emailColumn}`)
    .eq("id", postId)
    .single();

  if (error || !data) {
    container.innerHTML = `<p class="empty-state">Không thể tải bài viết: ${error?.message || "Không có dữ liệu"}</p>`;
    return;
  }

  const post = createPostElement(data, emailColumn);
  post.querySelector(".post-content").textContent = data.content || "";
  const actions = post.querySelector(".post-actions");
  if (actions) actions.remove();
  container.appendChild(post);
};

window.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    alert("Không tải được thư viện Supabase. Vui lòng thử lại.");
    return;
  }

  if (currentPage === "index.html" || currentPage === "") {
    await handleLoginPage();
  } else if (currentPage === "signup.html") {
    await handleSignupPage();
  } else if (currentPage === "home.html") {
    await handleHomePage();
  } else if (currentPage === "detail.html") {
    await handleDetailPage();
  }
});
