// ============================================
// MODULE: DASHBOARD HOME — Revisi 3 (lengkap)
// ============================================

let chartPendudukHomeInstance = null;
let chartPendidikanHomeInstance = null;

async function initDashboardHomeModule() {
  const welcomeEl = document.getElementById("dashboardWelcome");
  if (window.currentProfile) {
    welcomeEl.textContent = `Selamat datang, ${window.currentProfile.full_name}! Berikut ringkasan data sistem.`;
  }

  renderSummaryCards();
  renderInsights();
  renderHomeChartPenduduk();
  renderHomeChartPendidikan();
  renderMiniList("pengaduan");
  renderMiniList("bansos");
  renderMiniList("pengumuman");
  renderAktivitasSistem();
}

// ============================================
// KARTU RINGKASAN + PERSEN PERUBAHAN
// ============================================

// Hitung: total saat ini, vs total sampai AKHIR BULAN LALU.
// Selisihnya jadi dasar persen perubahan "dari bulan lalu".
async function hitungPerubahan(table) {
  const awalBulanIni = new Date();
  awalBulanIni.setDate(1);
  awalBulanIni.setHours(0, 0, 0, 0);

  const [totalSekarang, totalSebelumBulanIni] = await Promise.all([
    supabaseClient.from(table).select("*", { count: "exact", head: true }),
    supabaseClient.from(table).select("*", { count: "exact", head: true }).lt("created_at", awalBulanIni.toISOString()),
  ]);

  const now = totalSekarang.count ?? 0;
  const before = totalSebelumBulanIni.count ?? 0;

  let persen = 0;
  if (before > 0) {
    persen = ((now - before) / before) * 100;
  } else if (now > 0) {
    persen = 100;
  }

  return { total: now, persen: Math.round(persen * 10) / 10 };
}

function tampilkanPerubahan(elId, persen) {
  const el = document.getElementById(elId);
  if (!el) return;

  if (persen === 0) {
    el.textContent = "Tidak ada perubahan";
    el.className = "summary-change flat";
    return;
  }

  const naik = persen > 0;
  el.textContent = `${naik ? "▲" : "▼"} ${Math.abs(persen)}% dari bulan lalu`;
  el.className = `summary-change ${naik ? "up" : "down"}`;
}

async function renderSummaryCards() {
  const tabel = {
    penduduk: "warga",
    pengaduan: "pengaduan",
    bansos: "bantuan_sosial",
    surat: "surat_digital",
    pengumuman: "pengumuman",
  };

  for (const [key, tableName] of Object.entries(tabel)) {
    const { total, persen } = await hitungPerubahan(tableName);
    document.getElementById(`stat_${key}`).textContent = total;
    tampilkanPerubahan(`change_${key}`, persen);
  }
}

// ============================================
// GRAFIK: Statistik Penduduk (line chart, 6 bulan)
// ============================================
async function renderHomeChartPenduduk() {
  const { data, error } = await supabaseClient.from("warga").select("created_at, jenis_kelamin");
  if (error) return;

  const bulanLabel = [];
  const bulanKey = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bulanKey.push(`${d.getFullYear()}-${d.getMonth()}`);
    bulanLabel.push(d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }));
  }

  const laki = new Array(6).fill(0);
  const perempuan = new Array(6).fill(0);

  (data || []).forEach((w) => {
    const d = new Date(w.created_at);
    const idx = bulanKey.indexOf(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx === -1) return;
    if (w.jenis_kelamin === "Laki-laki") laki[idx]++;
    else if (w.jenis_kelamin === "Perempuan") perempuan[idx]++;
  });

  const total = laki.map((v, i) => v + perempuan[i]);

  if (chartPendudukHomeInstance) chartPendudukHomeInstance.destroy();
  const ctx = document.getElementById("chartPendudukHome").getContext("2d");
  chartPendudukHomeInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: bulanLabel,
      datasets: [
        { label: "Laki-laki", data: laki, borderColor: "#2563eb", tension: 0.3 },
        { label: "Perempuan", data: perempuan, borderColor: "#ec4899", tension: 0.3 },
        { label: "Total", data: total, borderColor: "#0f766e", tension: 0.3, borderWidth: 3 },
      ],
    },
    options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

// ============================================
// GRAFIK: Persentase Pendidikan (donut chart)
// ============================================
async function renderHomeChartPendidikan() {
  const { data, error } = await supabaseClient.from("warga").select("pendidikan_terakhir");
  if (error) return;

  const hitung = {};
  (data || []).forEach((w) => {
    const label = w.pendidikan_terakhir || "Tidak diketahui";
    hitung[label] = (hitung[label] || 0) + 1;
  });

  const labels = Object.keys(hitung);
  const values = Object.values(hitung);
  const warna = ["#dc2626", "#2563eb", "#94a3b8", "#eab308", "#16a34a", "#7c3aed", "#f97316"];

  if (chartPendidikanHomeInstance) chartPendidikanHomeInstance.destroy();
  const ctx = document.getElementById("chartPendidikanHome").getContext("2d");

  if (labels.length === 0) {
    ctx.canvas.parentElement.querySelector("canvas").style.display = "none";
    return;
  }

  chartPendidikanHomeInstance = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: warna }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

// ============================================
// PANEL "TERBARU": Pengaduan / Bantuan Sosial / Pengumuman
// ============================================
async function renderMiniList(jenis) {
  if (jenis === "pengaduan") {
    const { data } = await supabaseClient
      .from("pengaduan")
      .select("judul, status, created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    renderMiniListHtml("homePengaduanList", (data || []).map((p) => ({
      judul: p.judul,
      badge: p.status,
      badgeClass: `status-${p.status}`,
      tanggal: p.created_at,
    })));
  }

  if (jenis === "bansos") {
    const { data } = await supabaseClient
      .from("penerima_bansos")
      .select("status_penyaluran, created_at, warga(full_name), bantuan_sosial(nama_program)")
      .order("created_at", { ascending: false })
      .limit(3);

    renderMiniListHtml("homeBansosList", (data || []).map((b) => ({
      judul: `${b.warga ? b.warga.full_name : "-"} — ${b.bantuan_sosial ? b.bantuan_sosial.nama_program : "-"}`,
      badge: b.status_penyaluran,
      badgeClass: `status-${b.status_penyaluran}`,
      tanggal: b.created_at,
    })));
  }

  if (jenis === "pengumuman") {
    const { data } = await supabaseClient
      .from("pengumuman")
      .select("judul, created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    renderMiniListHtml("homePengumumanList", (data || []).map((p) => ({
      judul: p.judul,
      badge: "Baru",
      badgeClass: "status-baru",
      tanggal: p.created_at,
    })));
  }
}

function renderMiniListHtml(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = `<p class="mini-empty">Belum ada data.</p>`;
    return;
  }

  el.innerHTML = items.map((item) => {
    const tanggal = new Date(item.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return `
      <div class="mini-item">
        <div>
          <p class="mini-judul">${item.judul}</p>
          <p class="mini-tanggal">${tanggal}</p>
        </div>
        <span class="status-badge ${item.badgeClass}">${item.badge}</span>
      </div>
    `;
  }).join("");
}

// ============================================
// PANEL: Aktivitas Sistem (versi ringkas, 5 teratas)
// ============================================
async function renderAktivitasSistem() {
  const el = document.getElementById("homeAktivitasList");
  el.innerHTML = `<p class="mini-empty">Memuat...</p>`;

  const [pengaduan, forum] = await Promise.all([
    supabaseClient.from("pengaduan").select("judul, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(3),
    supabaseClient.from("forum_thread").select("judul, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(3),
  ]);

  const feed = [];
  (pengaduan.data || []).forEach((p) => feed.push({
    teks: `${p.profiles ? p.profiles.full_name : "Seseorang"} membuat pengaduan "${p.judul}"`,
    waktu: p.created_at,
  }));
  (forum.data || []).forEach((f) => feed.push({
    teks: `${f.profiles ? f.profiles.full_name : "Seseorang"} membuka diskusi "${f.judul}"`,
    waktu: f.created_at,
  }));

  feed.sort((a, b) => new Date(b.waktu) - new Date(a.waktu));
  const top5 = feed.slice(0, 5);

  if (top5.length === 0) {
    el.innerHTML = `<p class="mini-empty">Belum ada aktivitas.</p>`;
    return;
  }

  el.innerHTML = top5.map((item) => {
    const waktu = new Date(item.waktu).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `<div class="mini-item"><div><p class="mini-judul">${item.teks}</p><p class="mini-tanggal">${waktu}</p></div></div>`;
  }).join("");
}

// ============================================
// INSIGHT OTOMATIS — Fase 12, Langkah 12.2
// ============================================
// Rule-based sederhana: bandingkan data bulan ini vs bulan lalu,
// lalu susun jadi kalimat ringkasan otomatis. Bukan AI, murni
// perhitungan agregat + template kalimat.
async function renderInsights() {
  const el = document.getElementById("homeInsights");
  el.innerHTML = `<p class="mini-empty">Menyusun insight...</p>`;

  const awalBulanIni = new Date();
  awalBulanIni.setDate(1);
  awalBulanIni.setHours(0, 0, 0, 0);
  const awalBulanLalu = new Date(awalBulanIni);
  awalBulanLalu.setMonth(awalBulanLalu.getMonth() - 1);

  const insights = [];

  // --- Insight 1: kategori pengaduan terbanyak bulan ini ---
  const { data: pengaduanBulanIni } = await supabaseClient
    .from("pengaduan")
    .select("kategori")
    .gte("created_at", awalBulanIni.toISOString());

  if (pengaduanBulanIni && pengaduanBulanIni.length > 0) {
    const hitungKategori = {};
    pengaduanBulanIni.forEach((p) => {
      const k = p.kategori || "Lainnya";
      hitungKategori[k] = (hitungKategori[k] || 0) + 1;
    });
    const [kategoriTeratas, jumlahTeratas] = Object.entries(hitungKategori)
      .sort((a, b) => b[1] - a[1])[0];

    insights.push({
      ikon: "📋",
      teks: `Kategori pengaduan terbanyak bulan ini: <b>${kategoriTeratas}</b> (${jumlahTeratas} laporan).`,
    });
  }

  // --- Insight 2: jenis surat paling banyak diajukan bulan ini ---
  const { data: suratBulanIni } = await supabaseClient
    .from("surat_digital")
    .select("jenis_surat(nama_surat)")
    .gte("created_at", awalBulanIni.toISOString());

  if (suratBulanIni && suratBulanIni.length > 0) {
    const hitungJenis = {};
    suratBulanIni.forEach((s) => {
      const nama = s.jenis_surat ? s.jenis_surat.nama_surat : "Lainnya";
      hitungJenis[nama] = (hitungJenis[nama] || 0) + 1;
    });
    const [jenisTeratas, jumlahJenis] = Object.entries(hitungJenis)
      .sort((a, b) => b[1] - a[1])[0];

    insights.push({
      ikon: "📄",
      teks: `Surat paling banyak diajukan bulan ini: <b>${jenisTeratas}</b> (${jumlahJenis} permohonan).`,
    });
  }

  // --- Insight 3: perbandingan bantuan tersalurkan bulan ini vs bulan lalu ---
  const [salurBulanIni, salurBulanLalu] = await Promise.all([
    supabaseClient.from("penerima_bansos").select("*", { count: "exact", head: true })
      .eq("status_penyaluran", "disalurkan")
      .gte("tanggal_penyaluran", awalBulanIni.toISOString().slice(0, 10)),
    supabaseClient.from("penerima_bansos").select("*", { count: "exact", head: true })
      .eq("status_penyaluran", "disalurkan")
      .gte("tanggal_penyaluran", awalBulanLalu.toISOString().slice(0, 10))
      .lt("tanggal_penyaluran", awalBulanIni.toISOString().slice(0, 10)),
  ]);

  const jumlahIni = salurBulanIni.count ?? 0;
  const jumlahLalu = salurBulanLalu.count ?? 0;

  if (jumlahIni > 0 || jumlahLalu > 0) {
    let kalimat;
    if (jumlahLalu === 0) {
      kalimat = `Bantuan sosial tersalurkan ke <b>${jumlahIni} warga</b> bulan ini.`;
    } else {
      const persen = Math.round(((jumlahIni - jumlahLalu) / jumlahLalu) * 100);
      const arah = persen >= 0 ? "naik" : "turun";
      kalimat = `Penyaluran bantuan sosial ${arah} <b>${Math.abs(persen)}%</b> dibanding bulan lalu (${jumlahIni} vs ${jumlahLalu} warga).`;
    }
    insights.push({ ikon: "🎁", teks: kalimat });
  }

  if (insights.length === 0) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = insights.map((i) => `
    <div class="insight-card">
      <span class="insight-icon">${i.ikon}</span>
      <p>${i.teks}</p>
    </div>
  `).join("");
}