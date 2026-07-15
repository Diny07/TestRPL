// ============================================
// MODULE: STATISTIK & ANALITIK — Fase 11, Langkah 11.2
// ============================================

let chartPendudukInstance = null;
let chartPengaduanInstance = null;

async function initStatistikModule() {
  await renderChartPenduduk();
  await renderChartPengaduan();
}

// ============================================
// LINE CHART: pertumbuhan penduduk 6 bulan terakhir
// ============================================
async function renderChartPenduduk() {
  const { data, error } = await supabaseClient
    .from("warga")
    .select("created_at, jenis_kelamin");

  if (error) {
    console.error("Gagal memuat data penduduk:", error.message);
    return;
  }

  // Siapkan 6 bucket bulan terakhir (termasuk bulan ini)
  const bulanLabel = [];
  const bulanKey = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bulanKey.push(`${d.getFullYear()}-${d.getMonth()}`);
    bulanLabel.push(d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }));
  }

  // Hitung berapa warga laki-laki/perempuan yang datanya dibuat di tiap bulan
  const lakiPerBulan = new Array(6).fill(0);
  const perempuanPerBulan = new Array(6).fill(0);

  (data || []).forEach((w) => {
    const d = new Date(w.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = bulanKey.indexOf(key);
    if (idx === -1) return; // di luar rentang 6 bulan, lewati

    if (w.jenis_kelamin === "Laki-laki") lakiPerBulan[idx]++;
    else if (w.jenis_kelamin === "Perempuan") perempuanPerBulan[idx]++;
  });

  const totalPerBulan = lakiPerBulan.map((v, i) => v + perempuanPerBulan[i]);

  if (chartPendudukInstance) chartPendudukInstance.destroy();

  const ctx = document.getElementById("chartPenduduk").getContext("2d");
  chartPendudukInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: bulanLabel,
      datasets: [
        { label: "Laki-laki", data: lakiPerBulan, borderColor: "#2563eb", tension: 0.3 },
        { label: "Perempuan", data: perempuanPerBulan, borderColor: "#ec4899", tension: 0.3 },
        { label: "Total", data: totalPerBulan, borderColor: "#0f766e", tension: 0.3, borderWidth: 3 },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

// ============================================
// DONUT CHART: distribusi status pengaduan
// ============================================
async function renderChartPengaduan() {
  const { data, error } = await supabaseClient
    .from("pengaduan")
    .select("status");

  if (error) {
    console.error("Gagal memuat data pengaduan:", error.message);
    return;
  }

  const jumlah = { baru: 0, diproses: 0, selesai: 0 };
  (data || []).forEach((p) => {
    if (jumlah[p.status] !== undefined) jumlah[p.status]++;
  });

  if (chartPengaduanInstance) chartPengaduanInstance.destroy();

  const ctx = document.getElementById("chartPengaduan").getContext("2d");
  chartPengaduanInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Baru", "Diproses", "Selesai"],
      datasets: [{
        data: [jumlah.baru, jumlah.diproses, jumlah.selesai],
        backgroundColor: ["#2563eb", "#d97706", "#16a34a"],
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
    },
  });
}