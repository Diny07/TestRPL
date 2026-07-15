// ============================================
// MODULE: SURAT DIGITAL — Fase 7, Langkah 7.2
// ============================================

let suratModuleInitialized = false;

function initSuratModule() {
  loadJenisSuratOptions();
  loadSuratList();

  if (suratModuleInitialized) return;
  suratModuleInitialized = true;

  const form = document.getElementById("suratForm");
  const statusEl = document.getElementById("suratStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.style.color = "#374151";
    statusEl.textContent = "Mengirim permohonan...";

    const payload = {
      pemohon_id: window.currentUser.id,
      jenis_surat_id: document.getElementById("s_jenis").value,
      keperluan: document.getElementById("s_keperluan").value.trim(),
    };

    const { error } = await supabaseClient.from("surat_digital").insert(payload);

    if (error) {
      statusEl.style.color = "red";
      statusEl.textContent = "Gagal mengajukan: " + error.message;
      return;
    }

    statusEl.style.color = "green";
    statusEl.textContent = "Permohonan berhasil diajukan. Menunggu diproses admin.";
    form.reset();
    loadSuratList();
  });

  // Event delegation untuk tombol Setujui/Tolak/Cetak
  document.getElementById("suratTableBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const suratId = btn.dataset.id;

    if (action === "setujui" || action === "tolak") {
      await prosesSurat(suratId, action === "setujui" ? "disetujui" : "ditolak");
    }
    if (action === "cetak") {
      await cetakSurat(suratId);
    }
  });
}

async function prosesSurat(suratId, statusBaru) {
  const label = statusBaru === "disetujui" ? "menyetujui" : "menolak";
  const catatan = await window.showTextModal(
    `Catatan ${statusBaru === "disetujui" ? "Persetujuan" : "Penolakan"}`,
    "Opsional, contoh alasan atau catatan tambahan..."
  );
  if (catatan === null) return;

  const payload = {
    status: statusBaru,
    catatan_admin: catatan || null,
    diproses_oleh: window.currentUser.id,
  };
  if (statusBaru === "disetujui") {
    payload.approved_at = new Date().toISOString();
  }

  const { error } = await supabaseClient
    .from("surat_digital")
    .update(payload)
    .eq("id", suratId);

  if (error) {
    alert(`Gagal ${label}: ` + error.message);
    return;
  }

  loadSuratList();
}

async function cetakSurat(suratId) {
  // Ambil data lengkap surat + jenis surat (template) + nama pemohon
  const { data: surat, error } = await supabaseClient
    .from("surat_digital")
    .select("keperluan, pemohon_id, jenis_surat(nama_surat, template_konten), profiles!surat_digital_pemohon_id_fkey(full_name)")
    .eq("id", suratId)
    .single();

  if (error || !surat) {
    alert("Gagal memuat data surat: " + (error ? error.message : "tidak ditemukan"));
    return;
  }

  // Ambil NIK & alamat dari tabel warga (kalau pemohon punya data warga terkait)
  const { data: warga } = await supabaseClient
    .from("warga")
    .select("nik, alamat")
    .eq("user_id", surat.pemohon_id)
    .maybeSingle();

  const tanggalHariIni = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });

  // Ganti semua placeholder {{...}} di template dengan data asli
  let isiSurat = surat.jenis_surat.template_konten || "";
  isiSurat = isiSurat
    .replaceAll("{{nama}}", surat.profiles.full_name || "-")
    .replaceAll("{{nik}}", warga ? warga.nik : "-")
    .replaceAll("{{alamat}}", warga ? (warga.alamat || "-") : "-")
    .replaceAll("{{keperluan}}", surat.keperluan || "-")
    .replaceAll("{{tanggal}}", tanggalHariIni);

  // Buka tab baru berisi surat siap-print (bukan generate PDF library,
  // cukup pakai fitur "Print to PDF" bawaan browser)
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${surat.jenis_surat.nama_surat}</title>
      <style>
        body { font-family: 'Times New Roman', serif; max-width: 700px; margin: 40px auto; line-height: 1.6; }
        h1 { text-align: center; font-size: 1.3rem; text-decoration: underline; }
        .isi { white-space: pre-wrap; margin-top: 2rem; }
        .footer { margin-top: 3rem; text-align: right; }
      </style>
    </head>
    <body>
      <h1>${surat.jenis_surat.nama_surat.toUpperCase()}</h1>
      <div class="isi">${isiSurat}</div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function loadJenisSuratOptions() {
  const select = document.getElementById("s_jenis");
  const { data, error } = await supabaseClient
    .from("jenis_surat")
    .select("id, nama_surat")
    .order("nama_surat");

  if (error || !data) {
    select.innerHTML = `<option value="">Gagal memuat pilihan</option>`;
    return;
  }

  select.innerHTML = `<option value="">-- pilih jenis surat --</option>` +
    data.map((j) => `<option value="${j.id}">${j.nama_surat}</option>`).join("");
}

async function loadSuratList() {
  const tbody = document.getElementById("suratTableBody");
  const titleEl = document.getElementById("suratListTitle");
  tbody.innerHTML = `<tr><td colspan="5">Memuat data...</td></tr>`;

  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdminOrPetugas = ["super_admin", "admin_wilayah", "petugas_lapangan"].includes(role);
  titleEl.textContent = isAdminOrPetugas ? "Semua Permohonan Masuk" : "Permohonan Saya";

  const { data, error } = await supabaseClient
    .from("surat_digital")
    .select("id, keperluan, status, created_at, jenis_surat(nama_surat), profiles!surat_digital_pemohon_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Belum ada permohonan surat.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((s) => {
    const tanggal = new Date(s.created_at).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric"
    });
    const namaJenis = s.jenis_surat ? s.jenis_surat.nama_surat : "-";
    const namaPemohon = s.profiles ? s.profiles.full_name : "-";

    let aksiHtml = "-";
    if (isAdminOrPetugas && s.status === "diajukan") {
      aksiHtml = `
        <button data-action="setujui" data-id="${s.id}" class="btn-verifikasi">Setujui</button>
        <button data-action="tolak" data-id="${s.id}" class="btn-tolak">Tolak</button>
      `;
    } else if (s.status === "disetujui") {
      aksiHtml = `<button data-action="cetak" data-id="${s.id}" class="btn-verifikasi">Cetak Surat</button>`;
    }

    return `
      <tr>
        <td>${namaJenis}</td>
        <td>${namaPemohon}</td>
        <td>${s.keperluan || "-"}</td>
        <td><span class="status-badge status-surat-${s.status}">${s.status}</span></td>
        <td>${tanggal}</td>
        <td>${aksiHtml}</td>
      </tr>
    `;
  }).join("");
}