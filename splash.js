// ============================================
// SPLASH PAGE — Revisi 1
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  const loadingState = document.getElementById("loadingState");
  const splashContent = document.getElementById("splashContent");
  const btnMasuk = document.getElementById("btnMasuk");

  // Simulasi loading singkat (sekadar transisi visual, bukan proses berat
  // apapun) — supaya kesan "membuka aplikasi" terasa halus, bukan tiba-tiba
  setTimeout(() => {
    loadingState.classList.add("hidden");
    splashContent.classList.remove("hidden");
  }, 1200);

  btnMasuk.addEventListener("click", () => {
    window.location.href = "auth.html";
  });
});