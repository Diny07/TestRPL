// ============================================
// MODULE: BANTUAN SOSIAL — Fase 5, Langkah 5.2 + 5.3
// ============================================

let bansosFormInitialized = false;
let currentProgramId = null;
let currentPenerimaWargaIds = []; // dipakai untuk exclude warga yang sudah terdaftar saat search

function initBansosModule() {
  // Form pembuatan program hanya untuk admin — tampilkan/sembunyikan
  // sesuai role setiap kali modul dibuka (jaga-jaga kalau role berubah)
  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";
  document.getElementById("bansosFormWrapper").classList.toggle("hidden", !isAdmin);

  // Selalu mulai dari tampilan daftar program setiap kali menu dibuka
  document.getElementById("bansosProgramView").classList.remove("hidden");
  document.getElementById("bansosPenerimaView").classList.add("hidden");

  loadBansosList();

  if (bansosFormInitialized) return;
  bansosFormInitialized = true;

  const form = document.getElementById("bansosForm");
  const statusEl = document.getElementById("bansosStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.style.color = "#374151";
    statusEl.textContent = "Menyimpan...";

    const kuotaValue = document.getElementById("b_kuota").value;

    const payload = {
      nama_program: document.getElementById("b_nama").value.trim(),
      sumber_dana: document.getElementById("b_sumber").value || null,
      kuota: kuotaValue ? parseInt(kuotaValue, 10) : null,
      deskripsi: document.getElementById("b_deskripsi").value || null,
      dibuat_oleh: window.currentUser.id,
    };

    const { data, error } = await supabaseClient
      .from("bantuan_sosial")
      .insert(payload)
      .select()
      .single();

    if (error) {
      statusEl.style.color = "red";
      statusEl.textContent = "Gagal menyimpan: " + error.message;
      return;
    }

    statusEl.style.color = "green";
    statusEl.textContent = `Program "${data.nama_program}" berhasil dibuat.`;
    form.reset();
    loadBansosList();
  });

  // --- Tombol kembali dari view Penerima ke view Daftar Program ---
  document.getElementById("btnKembaliProgram").addEventListener("click", () => {
    document.getElementById("bansosPenerimaView").classList.add("hidden");
    document.getElementById("bansosProgramView").classList.remove("hidden");
  });

  // --- Event delegation: tombol "Kelola Penerima" di tabel program ---
  document.getElementById("bansosTableBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='kelola-penerima']");
    if (!btn) return;

    currentProgramId = btn.dataset.id;
    document.getElementById("penerimaProgramTitle").textContent = `Kelola Penerima — ${btn.dataset.nama}`;
    document.getElementById("bansosProgramView").classList.add("hidden");
    document.getElementById("bansosPenerimaView").classList.remove("hidden");
    document.getElementById("penerimaSearchWarga").value = "";
    document.getElementById("penerimaSearchResults").innerHTML = "";

    // loadPenerimaList harus selesai dulu (mengisi currentPenerimaWargaIds)
    // sebelum menghitung rekomendasi, supaya warga yang sudah terdaftar
    // otomatis dikecualikan dari daftar rekomendasi
    await loadPenerimaList();
    loadRekomendasiPenerima();
  });

  // --- Search & tambah warga ke program ---
  const searchInput = document.getElementById("penerimaSearchWarga");
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const keyword = searchInput.value.trim();
    if (keyword.length < 3) {
      document.getElementById("penerimaSearchResults").innerHTML = "";
      return;
    }
    searchTimer = setTimeout(() => searchWargaUntukDitambah(keyword), 400);
  });

  // --- Event delegation: tombol update status & tambah penerima ---
  document.getElementById("penerimaTableBody").addEventListener("click", handlePenerimaTableClick);
  document.getElementById("penerimaSearchResults").addEventListener("click", handleTambahPenerimaClick);
  document.getElementById("rekomendasiPenerimaList").addEventListener("click", handleTambahPenerimaClick);
}

async function loadBansosList() {
  const tbody = document.getElementById("bansosTableBody");
  tbody.innerHTML = `<tr><td colspan="4">Memuat data...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("bantuan_sosial")
    .select("id, nama_program, sumber_dana, kuota, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:red">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Belum ada program bantuan.</td></tr>`;
    return;
  }

  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";

  tbody.innerHTML = data.map((b) => {
    const tanggal = new Date(b.created_at).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric"
    });

    const aksiHtml = isAdmin
      ? `<button data-action="kelola-penerima" data-id="${b.id}" data-nama="${b.nama_program}" class="btn-verifikasi">Kelola Penerima</button>`
      : "-";

    return `
      <tr>
        <td>${b.nama_program}</td>
        <td>${b.sumber_dana || "-"}</td>
        <td>${b.kuota !== null ? b.kuota : "Tak terbatas"}</td>
        <td>${tanggal}</td>
        <td>${aksiHtml}</td>
      </tr>
    `;
  }).join("");
}

// ============================================
// KELOLA PENERIMA — Langkah 5.3
// ============================================

async function loadPenerimaList() {
  const tbody = document.getElementById("penerimaTableBody");
  tbody.innerHTML = `<tr><td colspan="5">Memuat data...</td></tr>`;

  // Embedded select: JOIN otomatis ke tabel warga lewat relasi warga_id
  const { data, error } = await supabaseClient
    .from("penerima_bansos")
    .select("id, status_penyaluran, tanggal_penyaluran, warga(id, nik, full_name)")
    .eq("bantuan_id", currentProgramId)
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:red">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  // Simpan daftar warga_id yang sudah terdaftar, dipakai untuk exclude di pencarian
  currentPenerimaWargaIds = (data || []).map((p) => p.warga.id);

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Belum ada penerima terdaftar di program ini.</td></tr>`;
    return;
  }

  const opsiStatus = ["menunggu", "disalurkan", "ditolak"];

  tbody.innerHTML = data.map((p) => {
    const tanggal = p.tanggal_penyaluran
      ? new Date(p.tanggal_penyaluran).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "-";

    const options = opsiStatus.map((s) =>
      `<option value="${s}" ${s === p.status_penyaluran ? "selected" : ""}>${s}</option>`
    ).join("");

    return `
      <tr>
        <td>${p.warga.full_name}</td>
        <td>${p.warga.nik}</td>
        <td><span class="status-badge status-${p.status_penyaluran}">${p.status_penyaluran}</span></td>
        <td>${tanggal}</td>
        <td>
          <select data-status-select style="margin-right:0.3rem; padding:0.25rem; border-radius:6px; border:1px solid #d1d5db;">
            ${options}
          </select>
          <button data-action="update-penyaluran" data-id="${p.id}" class="btn-verifikasi">Update</button>
        </td>
      </tr>
    `;
  }).join("");
}

async function handlePenerimaTableClick(e) {
  const btn = e.target.closest("button[data-action='update-penyaluran']");
  if (!btn) return;

  const penerimaId = btn.dataset.id;
  const row = btn.closest("tr");
  const statusBaru = row.querySelector("select[data-status-select]").value;

  const catatan = await window.showTextModal(
    "Catatan Penyaluran",
    "Contoh: Diambil langsung oleh penerima di kantor desa..."
  );
  if (catatan === null) return; // dibatalkan

  btn.disabled = true;
  btn.textContent = "Memproses...";

  const updatePayload = {
    status_penyaluran: statusBaru,
    catatan: catatan || null,
  };
  // Kalau statusnya "disalurkan", otomatis catat tanggal hari ini
  if (statusBaru === "disalurkan") {
    updatePayload.tanggal_penyaluran = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabaseClient
    .from("penerima_bansos")
    .update(updatePayload)
    .eq("id", penerimaId);

  if (error) {
    alert("Gagal update status: " + error.message);
  }

  loadPenerimaList();
}

async function searchWargaUntukDitambah(keyword) {
  const resultsEl = document.getElementById("penerimaSearchResults");
  resultsEl.innerHTML = `<p style="font-size:0.85rem; color:#6b7280;">Mencari...</p>`;

  const { data, error } = await supabaseClient
    .from("warga")
    .select("id, nik, full_name")
    .or(`full_name.ilike.%${keyword}%,nik.ilike.%${keyword}%`)
    .limit(8);

  if (error) {
    resultsEl.innerHTML = `<p style="color:red; font-size:0.85rem;">Gagal mencari: ${error.message}</p>`;
    return;
  }

  // Sembunyikan warga yang SUDAH terdaftar di program ini
  const hasil = (data || []).filter((w) => !currentPenerimaWargaIds.includes(w.id));

  if (hasil.length === 0) {
    resultsEl.innerHTML = `<p style="font-size:0.85rem; color:#6b7280;">Tidak ada hasil (atau semua sudah terdaftar).</p>`;
    return;
  }

  resultsEl.innerHTML = hasil.map((w) => `
    <div class="search-result-item">
      <span>${w.full_name} <span style="color:#9ca3af;">(${w.nik})</span></span>
      <button data-action="tambah-penerima" data-id="${w.id}" class="btn-verifikasi">+ Tambah</button>
    </div>
  `).join("");
}

async function handleTambahPenerimaClick(e) {
  const btn = e.target.closest("button[data-action='tambah-penerima']");
  if (!btn) return;

  const wargaId = btn.dataset.id;
  btn.disabled = true;
  btn.textContent = "Menambahkan...";

  const { error } = await supabaseClient
    .from("penerima_bansos")
    .insert({ bantuan_id: currentProgramId, warga_id: wargaId });

  if (error) {
    alert("Gagal menambahkan: " + error.message);
    btn.disabled = false;
    btn.textContent = "+ Tambah";
    return;
  }

  // Bersihkan search box & hasil, lalu refresh daftar penerima + rekomendasi
  // (warga yang baru ditambahkan harus otomatis hilang dari rekomendasi)
  document.getElementById("penerimaSearchWarga").value = "";
  document.getElementById("penerimaSearchResults").innerHTML = "";
  await loadPenerimaList();
  loadRekomendasiPenerima();
}

// ============================================
// REKOMENDASI CALON PENERIMA — Fase 12, Langkah 12.1
// ============================================
// Sistem rule-based sederhana (bukan AI/ML): setiap warga terverifikasi
// yang BELUM terdaftar di program ini diberi skor berdasarkan indikator
// kebutuhan. Skor lebih tinggi = lebih diprioritaskan untuk direkomendasikan.
async function loadRekomendasiPenerima() {
  const container = document.getElementById("rekomendasiPenerimaList");
  container.innerHTML = `<p class="mini-empty">Menganalisis data warga...</p>`;

  // 1. Ambil semua warga yang sudah terverifikasi
  const { data: semuaWarga, error: errWarga } = await supabaseClient
    .from("warga")
    .select("id, full_name, nik, pekerjaan, pendidikan_terakhir")
    .eq("status_verifikasi", "terverifikasi");

  if (errWarga || !semuaWarga) {
    container.innerHTML = `<p class="mini-empty">Gagal memuat rekomendasi.</p>`;
    return;
  }

  // 2. Cari tahu warga mana saja yang SUDAH PERNAH dapat bantuan apapun
  //    (dari program manapun, bukan cuma program yang sedang dibuka ini)
  const { data: riwayatBansos } = await supabaseClient
    .from("penerima_bansos")
    .select("warga_id");
  const wargaSudahPernahDibantu = new Set((riwayatBansos || []).map((r) => r.warga_id));

  // 3. Saring warga yang BELUM terdaftar di program yang sedang dibuka ini
  const kandidat = semuaWarga.filter((w) => !currentPenerimaWargaIds.includes(w.id));

  // 4. Hitung skor tiap kandidat berdasarkan indikator kebutuhan
  const PENDIDIKAN_RENDAH = ["SD", "Tidak Sekolah", "Tidak Tamat SD"];
  const PENDIDIKAN_MENENGAH = ["SMP"];

  const hasil = kandidat.map((w) => {
    let skor = 0;
    const alasan = [];

    if (!w.pekerjaan || w.pekerjaan.trim() === "") {
      skor += 2;
      alasan.push("belum ada pekerjaan tercatat");
    }

    if (w.pendidikan_terakhir && PENDIDIKAN_RENDAH.includes(w.pendidikan_terakhir)) {
      skor += 2;
      alasan.push("pendidikan dasar");
    } else if (w.pendidikan_terakhir && PENDIDIKAN_MENENGAH.includes(w.pendidikan_terakhir)) {
      skor += 1;
      alasan.push("pendidikan menengah pertama");
    }

    if (!wargaSudahPernahDibantu.has(w.id)) {
      skor += 1;
      alasan.push("belum pernah menerima bantuan apapun");
    }

    return { ...w, skor, alasan };
  });

  // 5. Ambil yang skornya cukup signifikan (>=2), urutkan tertinggi dulu, ambil 5 teratas
  const rekomendasi = hasil
    .filter((w) => w.skor >= 2)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, 5);

  if (rekomendasi.length === 0) {
    container.innerHTML = `<p class="mini-empty">Tidak ada rekomendasi saat ini — semua warga terverifikasi sudah cukup terwakili di data.</p>`;
    return;
  }

  container.innerHTML = rekomendasi.map((w) => {
    const labelPrioritas = w.skor >= 4 ? "Prioritas Tinggi" : "Prioritas Sedang";
    const warnaBadge = w.skor >= 4 ? "status-ditolak" : "status-pending";

    return `
      <div class="mini-item">
        <div>
          <p class="mini-judul">${w.full_name} <span style="color:#9ca3af; font-weight:400;">(${w.nik})</span></p>
          <p class="mini-tanggal">${w.alasan.join(", ")}</p>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="status-badge ${warnaBadge}">${labelPrioritas}</span>
          <button data-action="tambah-penerima" data-id="${w.id}" class="btn-verifikasi">+ Tambah</button>
        </div>
      </div>
    `;
  }).join("");
}