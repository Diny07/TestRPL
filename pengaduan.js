// ============================================
// MODULE: PENGADUAN — Fase 4, Langkah 4.2
// ============================================

let pengaduanFormInitialized = false;
let pengaduanPickMapInstance = null;
let pengaduanPickMarker = null;

async function initPengaduanModule() {
  loadPengaduanList();
  await initPengaduanPickMap();

  if (pengaduanFormInitialized) return;
  pengaduanFormInitialized = true;

  const form = document.getElementById("pengaduanForm");
  const statusEl = document.getElementById("pengaduanStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.style.color = "#374151";
    statusEl.textContent = "Mengirim...";

    const payload = {
      pelapor_id: window.currentUser.id,
      judul: document.getElementById("p_judul").value.trim(),
      kategori: document.getElementById("p_kategori").value || null,
      lokasi: document.getElementById("p_lokasi").value || null,
      deskripsi: document.getElementById("p_deskripsi").value || null,
      latitude: document.getElementById("p_lat").value || null,
      longitude: document.getElementById("p_lng").value || null,
    };

    const { data, error } = await supabaseClient
      .from("pengaduan")
      .insert(payload)
      .select()
      .single();

    if (error) {
      statusEl.style.color = "red";
      statusEl.textContent = "Gagal mengirim: " + error.message;
      return;
    }

    statusEl.style.color = "green";
    statusEl.textContent = `Pengaduan "${data.judul}" berhasil dikirim.`;
    form.reset();
    // Reset juga marker di peta picker (form.reset() tidak menyentuh Leaflet)
    if (pengaduanPickMarker) {
      pengaduanPickMapInstance.removeLayer(pengaduanPickMarker);
      pengaduanPickMarker = null;
    }
    document.getElementById("pengaduanPickInfo").textContent = "Belum ada titik dipilih.";
    loadPengaduanList();
  });

  // Event delegation: 1 listener di tbody, menangkap klik tombol
  // "Update Status" yang dirender secara dinamis (hanya untuk admin/petugas)
  const tbody = document.getElementById("pengaduanTableBody");
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='update-status']");
    if (!btn) return;

    const pengaduanId = btn.dataset.id;
    const row = btn.closest("tr");
    const selectEl = row.querySelector("select[data-status-select]");
    const statusBaru = selectEl.value;

    const catatan = await window.showTextModal(
      "Catatan Tindak Lanjut",
      "Contoh: Sedang ditinjau petugas lapangan..."
    );
    if (catatan === null) return; // user klik Batal, hentikan aksi

    btn.disabled = true;
    btn.textContent = "Memproses...";

    // 1. Update status di tabel pengaduan
    const { error: updateError } = await supabaseClient
      .from("pengaduan")
      .update({ status: statusBaru })
      .eq("id", pengaduanId);

    if (updateError) {
      alert("Gagal update status: " + updateError.message);
      loadPengaduanList();
      return;
    }

    // 2. Catat riwayat tindak lanjut
    await supabaseClient.from("tindak_lanjut").insert({
      pengaduan_id: pengaduanId,
      petugas_id: window.currentUser.id,
      catatan: catatan || null,
      status_baru: statusBaru,
    });

    // 3. Refresh tabel
    loadPengaduanList();
  });
}

async function initPengaduanPickMap() {
  // Kalau peta picker sudah pernah dibuat, jangan bikin ulang —
  // cukup pastikan ukurannya benar (jaga-jaga setelah sempat hilang/hidden)
  if (pengaduanPickMapInstance) {
    setTimeout(() => pengaduanPickMapInstance.invalidateSize(), 100);
    return;
  }

  const { data: wilayah } = await supabaseClient
    .from("wilayah_config")
    .select("latitude, longitude")
    .limit(1)
    .single();

  const lat = wilayah?.latitude || -7.264;
  const lng = wilayah?.longitude || 108.263;

  pengaduanPickMapInstance = L.map("pengaduanPickMap").setView([lat, lng], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(pengaduanPickMapInstance);

  // Klik di peta = taruh/pindahkan marker ke titik itu
  pengaduanPickMapInstance.on("click", (e) => {
    const { lat: clickLat, lng: clickLng } = e.latlng;

    if (pengaduanPickMarker) {
      pengaduanPickMarker.setLatLng([clickLat, clickLng]);
    } else {
      pengaduanPickMarker = L.marker([clickLat, clickLng]).addTo(pengaduanPickMapInstance);
    }

    document.getElementById("p_lat").value = clickLat;
    document.getElementById("p_lng").value = clickLng;
    document.getElementById("pengaduanPickInfo").textContent =
      `Lokasi dipilih: ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`;
  });

  // Perbaikan wajib: peta dibuat saat elemen sudah terlihat, tapi kadang
  // ukurannya belum terhitung sempurna oleh browser — paksa hitung ulang
  setTimeout(() => pengaduanPickMapInstance.invalidateSize(), 100);
}

async function loadPengaduanList() {
  const tbody = document.getElementById("pengaduanTableBody");
  const titleEl = document.getElementById("pengaduanListTitle");
  tbody.innerHTML = `<tr><td colspan="6">Memuat data...</td></tr>`;

  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdminOrPetugas = ["super_admin", "admin_wilayah", "petugas_lapangan"].includes(role);

  // Judul daftar menyesuaikan siapa yang login, biar jelas
  // apakah yang ditampilkan "semua" atau "milik sendiri"
  titleEl.textContent = isAdminOrPetugas ? "Semua Pengaduan Masuk" : "Pengaduan Saya";

  // profiles(full_name) di sini adalah "embedded select" bawaan Supabase:
  // otomatis JOIN ke tabel profiles lewat relasi pelapor_id, tanpa perlu
  // menulis JOIN SQL manual.
  const { data, error } = await supabaseClient
    .from("pengaduan")
    .select("id, judul, kategori, lokasi, status, created_at, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:red">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">Belum ada pengaduan.</td></tr>`;
    return;
  }

  const opsiStatus = ["baru", "diproses", "selesai"];

  tbody.innerHTML = data.map((p) => {
    const tanggal = new Date(p.created_at).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric"
    });
    const namaPelapor = p.profiles ? p.profiles.full_name : "-";

    let aksiHtml = "-";
    if (isAdminOrPetugas) {
      const options = opsiStatus.map((s) =>
        `<option value="${s}" ${s === p.status ? "selected" : ""}>${s}</option>`
      ).join("");

      aksiHtml = `
        <select data-status-select style="margin-right:0.3rem; padding:0.25rem; border-radius:6px; border:1px solid #d1d5db;">
          ${options}
        </select>
        <button data-action="update-status" data-id="${p.id}" class="btn-verifikasi">Update</button>
      `;
    }

    return `
      <tr>
        <td>${p.judul}</td>
        <td>${p.kategori || "-"}</td>
        <td>${p.lokasi || "-"}</td>
        <td>${namaPelapor}</td>
        <td><span class="status-badge status-${p.status}">${p.status}</span></td>
        <td>${tanggal}</td>
        <td>${aksiHtml}</td>
      </tr>
    `;
  }).join("");
}