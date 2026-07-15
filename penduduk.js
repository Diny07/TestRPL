// ============================================
// MODULE: PENDUDUK — Fase 2, Langkah 2.2
// ============================================
// Fungsi initPendudukModule() dipanggil oleh dashboard.js
// setiap kali menu "Penduduk" diklik.

let pendudukFormInitialized = false;

function initPendudukModule() {
  // Muat ulang daftar setiap kali menu dibuka (data terbaru)
  loadWargaList();

  // Pasang event listener form & search HANYA sekali
  if (pendudukFormInitialized) return;
  pendudukFormInitialized = true;

  const searchInput = document.getElementById("pendudukSearch");
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    // Debounce sederhana: tunggu 400ms setelah user berhenti mengetik
    // supaya tidak kirim request ke Supabase di tiap ketikan huruf
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadWargaList(searchInput.value.trim());
    }, 400);
  });

  // Event delegation: 1 listener di tbody, menangkap klik tombol
  // Verifikasi/Tolak yang dirender secara dinamis
  const tbody = document.getElementById("pendudukTableBody");
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const wargaId = btn.dataset.id;
    const action = btn.dataset.action; // 'terverifikasi' atau 'ditolak'
    const label = action === "terverifikasi" ? "memverifikasi" : "menolak";

    if (!confirm(`Yakin ingin ${label} data warga ini?`)) return;

    btn.disabled = true;
    btn.textContent = "Memproses...";

    // 1. Update status di tabel warga
    const { error: updateError } = await supabaseClient
      .from("warga")
      .update({ status_verifikasi: action })
      .eq("id", wargaId);

    if (updateError) {
      alert("Gagal update status: " + updateError.message);
      loadWargaList(searchInput.value.trim());
      return;
    }

    // 2. Catat ke audit_log (siapa melakukan apa)
    await supabaseClient.from("audit_log").insert({
      actor_id: window.currentUser.id,
      action: action === "terverifikasi" ? "verifikasi_warga" : "tolak_warga",
      target_table: "warga",
      target_id: wargaId,
    });

    // 3. Refresh tabel supaya status terbaru langsung terlihat
    loadWargaList(searchInput.value.trim());
  });

  const form = document.getElementById("pendudukForm");
  const statusEl = document.getElementById("pendudukStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.style.color = "#374151";
    statusEl.textContent = "Menyimpan...";

    // Ambil semua nilai dari form
    const payload = {
      nik: document.getElementById("f_nik").value.trim(),
      full_name: document.getElementById("f_nama").value.trim(),
      tempat_lahir: document.getElementById("f_tempat_lahir").value || null,
      tanggal_lahir: document.getElementById("f_tanggal_lahir").value || null,
      jenis_kelamin: document.getElementById("f_jk").value || null,
      agama: document.getElementById("f_agama").value || null,
      pekerjaan: document.getElementById("f_pekerjaan").value || null,
      status_perkawinan: document.getElementById("f_status_kawin").value || null,
      pendidikan_terakhir: document.getElementById("f_pendidikan").value || null,
      alamat: document.getElementById("f_alamat").value || null,
    };

    // Kalau yang input adalah Warga sendiri (bukan admin),
    // otomatis tautkan ke akun login-nya.
    // Kalau Admin yang input, dibiarkan tanpa user_id (data offline).
    const role = window.currentProfile ? window.currentProfile.role : null;
    if (role === "warga") {
      payload.user_id = window.currentUser.id;
    }

    const { data, error } = await supabaseClient
      .from("warga")
      .insert(payload)
      .select()
      .single();

    if (error) {
      statusEl.style.color = "red";

      // Pesan error khusus untuk NIK duplikat (paling sering terjadi)
      if (error.message.includes("duplicate key") || error.message.includes("warga_nik_key")) {
        statusEl.textContent = "Gagal simpan: NIK ini sudah terdaftar di sistem.";
      } else {
        statusEl.textContent = "Gagal simpan: " + error.message;
      }
      return;
    }

    statusEl.style.color = "green";
    statusEl.textContent = `Berhasil disimpan: ${data.full_name} (NIK: ${data.nik})`;
    form.reset();
    loadWargaList(); // refresh daftar supaya data baru langsung terlihat
  });
}

// ============================================
// Ambil & tampilkan daftar warga (dengan pencarian opsional)
// ============================================
async function loadWargaList(searchTerm = "") {
  const tbody = document.getElementById("pendudukTableBody");
  tbody.innerHTML = `<tr><td colspan="5">Memuat data...</td></tr>`;

  let query = supabaseClient
    .from("warga")
    .select("id, nik, full_name, jenis_kelamin, alamat, status_verifikasi")
    .order("created_at", { ascending: false });

  // Kalau ada kata kunci, filter nama ATAU nik yang cocok
  if (searchTerm) {
    query = query.or(`full_name.ilike.%${searchTerm}%,nik.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Belum ada data.</td></tr>`;
    return;
  }

  // Hanya Admin Wilayah & Super Admin yang boleh verifikasi/tolak
  const role = window.currentProfile ? window.currentProfile.role : null;
  const bisaVerifikasi = role === "super_admin" || role === "admin_wilayah";

  tbody.innerHTML = data.map((w) => {
    let aksiHtml = "-";

    if (bisaVerifikasi && w.status_verifikasi === "pending") {
      aksiHtml = `
        <button data-action="terverifikasi" data-id="${w.id}" class="btn-verifikasi">Verifikasi</button>
        <button data-action="ditolak" data-id="${w.id}" class="btn-tolak">Tolak</button>
      `;
    }

    return `
      <tr>
        <td>${w.nik}</td>
        <td>${w.full_name}</td>
        <td>${w.jenis_kelamin || "-"}</td>
        <td>${w.alamat || "-"}</td>
        <td><span class="status-badge status-${w.status_verifikasi}">${w.status_verifikasi}</span></td>
        <td>${aksiHtml}</td>
      </tr>
    `;
  }).join("");
}