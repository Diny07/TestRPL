// ============================================
// AUTH — Fase 1, Langkah 1.2 + 1.4 (redirect)
// ============================================

// Kalau ternyata user sudah login (sesi masih aktif),
// tidak perlu lihat form lagi — langsung ke dashboard.
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = "dashboard.html";
  }
})();

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authStatus = document.getElementById("authStatus");

// --- Toggle tampilan tab Login/Register ---
tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  authStatus.textContent = "";
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  authStatus.textContent = "";
});

// --- REGISTER ---
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authStatus.style.color = "#374151";
  authStatus.textContent = "Mendaftarkan...";

  const full_name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  // full_name dikirim sebagai metadata, nanti ditangkap oleh
  // trigger handle_new_user() di database (lihat Langkah 1.1)
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name }
    }
  });

  if (error) {
    authStatus.style.color = "red";
    authStatus.textContent = "Gagal daftar: " + error.message;
    return;
  }

  authStatus.style.color = "green";
  authStatus.textContent = "Berhasil daftar! Silakan Masuk.";
  registerForm.reset();
  tabLogin.click();
});

// --- LOGIN ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authStatus.style.color = "#374151";
  authStatus.textContent = "Memeriksa akun...";

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authStatus.style.color = "red";
    authStatus.textContent = "Gagal masuk: " + error.message;
    return;
  }

  // Ambil role dari tabel profiles untuk memastikan
  // trigger di Langkah 1.1 berjalan benar
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("full_name, role")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    authStatus.style.color = "red";
    authStatus.textContent = "Login OK, tapi profil tidak ditemukan: " + profileError.message;
    return;
  }

  authStatus.style.color = "green";
  authStatus.textContent = `Selamat datang, ${profile.full_name} (role: ${profile.role})`;
  console.log("Login berhasil:", profile);

  // Beri jeda sedikit supaya pesan sempat terbaca, lalu pindah ke dashboard
  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 800);
});