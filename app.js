// ============================================
// TEST KONEKSI — Fase 0
// ============================================
// Tujuan: memastikan browser berhasil "bicara"
// dengan project Supabase Anda.
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");

  try {
    // Panggilan paling ringan ke Supabase: cek sesi auth.
    // Tidak butuh tabel apapun sudah dibuat, jadi aman
    // dipakai untuk test koneksi paling awal.
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    statusEl.textContent = "Koneksi ke Supabase BERHASIL ✅";
    statusEl.style.color = "green";
    console.log("Supabase connected. Session data:", data);

  } catch (err) {
    statusEl.textContent = "Koneksi GAGAL ❌ — cek URL/Key di js/supabaseClient.js";
    statusEl.style.color = "red";
    console.error("Supabase connection error:", err.message);
  }
});