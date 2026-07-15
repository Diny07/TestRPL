// ============================================
// MODULE: MONITORING — Fase 11, Langkah 11.3
// ============================================

// Terjemahan nama aksi di audit_log ke bahasa yang lebih enak dibaca
const LABEL_AKSI = {
  verifikasi_warga: "memverifikasi data warga",
  tolak_warga: "menolak data warga",
};

async function initMonitoringModule() {
  const feedEl = document.getElementById("monitoringFeed");
  feedEl.innerHTML = `<p>Memuat aktivitas...</p>`;

  // Ambil aktivitas dari beberapa sumber sekaligus, lalu digabung jadi 1 feed.
  // Kalau salah satu query gagal (misal RLS menolak karena bukan super_admin
  // untuk audit_log), kita tetap lanjut pakai sumber lain — tidak saling blokir.
  const [pengaduan, surat, forum, auditLog] = await Promise.all([
    supabaseClient
      .from("pengaduan")
      .select("judul, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseClient
      .from("surat_digital")
      .select("created_at, jenis_surat(nama_surat), profiles!surat_digital_pemohon_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseClient
      .from("forum_thread")
      .select("judul, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseClient
      .from("audit_log")
      .select("action, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const feed = [];

  (pengaduan.data || []).forEach((p) => {
    feed.push({
      waktu: p.created_at,
      teks: `${p.profiles ? p.profiles.full_name : "Seseorang"} membuat pengaduan "${p.judul}"`,
      warna: "#2563eb",
    });
  });

  (surat.data || []).forEach((s) => {
    feed.push({
      waktu: s.created_at,
      teks: `${s.profiles ? s.profiles.full_name : "Seseorang"} mengajukan ${s.jenis_surat ? s.jenis_surat.nama_surat : "surat"}`,
      warna: "#7c3aed",
    });
  });

  (forum.data || []).forEach((f) => {
    feed.push({
      waktu: f.created_at,
      teks: `${f.profiles ? f.profiles.full_name : "Seseorang"} membuka diskusi "${f.judul}"`,
      warna: "#0f766e",
    });
  });

  (auditLog.data || []).forEach((a) => {
    const label = LABEL_AKSI[a.action] || a.action;
    feed.push({
      waktu: a.created_at,
      teks: `${a.profiles ? a.profiles.full_name : "Admin"} ${label}`,
      warna: "#d97706",
    });
  });

  // Urutkan gabungan semua sumber dari yang terbaru, ambil 20 teratas
  feed.sort((a, b) => new Date(b.waktu) - new Date(a.waktu));
  const top20 = feed.slice(0, 20);

  if (top20.length === 0) {
    feedEl.innerHTML = `<p>Belum ada aktivitas tercatat.</p>`;
    return;
  }

  feedEl.innerHTML = top20.map((item) => {
    const waktu = new Date(item.waktu).toLocaleString("id-ID", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
    return `
      <div class="monitoring-item">
        <span class="monitoring-dot" style="background:${item.warna};"></span>
        <div>
          <p class="monitoring-text">${item.teks}</p>
          <p class="monitoring-time">${waktu}</p>
        </div>
      </div>
    `;
  }).join("");
}