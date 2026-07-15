// ============================================
// MODULE: BERITA & PENGUMUMAN — Fase 6, Langkah 6.2
// ============================================

let beritaModuleInitialized = false;

function initBeritaModule() {
  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";

  document.getElementById("beritaFormWrapper").classList.toggle("hidden", !isAdmin);
  document.getElementById("pengumumanFormWrapper").classList.toggle("hidden", !isAdmin);

  loadNewsList("berita");
  loadNewsList("pengumuman");

  if (typeof initMediaModule === "function") {
    initMediaModule();
  }

  if (beritaModuleInitialized) return;
  beritaModuleInitialized = true;

  // --- Tab switching ---
  const tabBerita = document.getElementById("tabBerita");
  const tabPengumuman = document.getElementById("tabPengumuman");
  const tabMedia = document.getElementById("tabMedia");
  const beritaSection = document.getElementById("beritaSection");
  const pengumumanSection = document.getElementById("pengumumanSection");
  const mediaSection = document.getElementById("mediaSection");

  function activateTab(tab) {
    [tabBerita, tabPengumuman, tabMedia].forEach((t) => t.classList.remove("active"));
    [beritaSection, pengumumanSection, mediaSection].forEach((s) => s.classList.add("hidden"));
    tab.classList.add("active");
  }

  tabBerita.addEventListener("click", () => {
    activateTab(tabBerita);
    beritaSection.classList.remove("hidden");
  });

  tabPengumuman.addEventListener("click", () => {
    activateTab(tabPengumuman);
    pengumumanSection.classList.remove("hidden");
  });

  tabMedia.addEventListener("click", () => {
    activateTab(tabMedia);
    mediaSection.classList.remove("hidden");
  });

  // --- Setup form & daftar untuk masing-masing jenis ---
  setupNewsForm("berita");
  setupNewsForm("pengumuman");
}

// ============================================
// Fungsi generik: dipakai untuk "berita" maupun "pengumuman"
// karena strukturnya sama (judul, konten, dibuat_oleh)
// ============================================

function setupNewsForm(jenis) {
  const form = document.getElementById(`${jenis}Form`);
  const statusEl = document.getElementById(`${jenis}Status`);
  const submitBtn = document.getElementById(`${jenis}SubmitBtn`);
  const cancelEditBtn = document.getElementById(`${jenis}CancelEditBtn`);
  const editingIdInput = document.getElementById(`${jenis}_editing_id`);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.style.color = "#374151";
    statusEl.textContent = "Menyimpan...";

    const payload = {
      judul: document.getElementById(`${jenis}_judul`).value.trim(),
      konten: document.getElementById(`${jenis}_konten`).value || null,
    };
    // Kolom gambar_url hanya ada di tabel berita, bukan pengumuman
    if (jenis === "berita") {
      payload.gambar_url = document.getElementById("berita_gambar").value || null;
    }

    const editingId = editingIdInput.value;
    let error;

    if (editingId) {
      // MODE EDIT: update baris yang sudah ada
      ({ error } = await supabaseClient.from(jenis).update(payload).eq("id", editingId));
    } else {
      // MODE BARU: insert baris baru
      payload.dibuat_oleh = window.currentUser.id;
      ({ error } = await supabaseClient.from(jenis).insert(payload));
    }

    if (error) {
      statusEl.style.color = "red";
      statusEl.textContent = "Gagal menyimpan: " + error.message;
      return;
    }

    statusEl.style.color = "green";
    statusEl.textContent = editingId ? "Berhasil diperbarui." : "Berhasil dipublikasikan.";
    resetNewsForm(jenis);
    loadNewsList(jenis);
  });

  cancelEditBtn.addEventListener("click", () => resetNewsForm(jenis));

  // Event delegation untuk tombol Edit/Hapus di daftar
  document.getElementById(`${jenis}ListContainer`).addEventListener("click", (e) => {
    const editBtn = e.target.closest("button[data-action='edit']");
    const deleteBtn = e.target.closest("button[data-action='delete']");

    if (editBtn) {
      startEditNews(jenis, editBtn.dataset.id, editBtn.dataset.judul, editBtn.dataset.konten, editBtn.dataset.gambar || "");
    }
    if (deleteBtn) {
      deleteNews(jenis, deleteBtn.dataset.id);
    }
  });
}

function startEditNews(jenis, id, judul, konten, gambar) {
  document.getElementById(`${jenis}_editing_id`).value = id;
  document.getElementById(`${jenis}_judul`).value = judul;
  document.getElementById(`${jenis}_konten`).value = konten;
  if (jenis === "berita") {
    document.getElementById("berita_gambar").value = gambar;
  }
  document.getElementById(`${jenis}SubmitBtn`).textContent = "Update";
  document.getElementById(`${jenis}CancelEditBtn`).classList.remove("hidden");

  // Scroll ke form supaya user langsung lihat form terisi
  document.getElementById(`${jenis}Form`).scrollIntoView({ behavior: "smooth" });
}

function resetNewsForm(jenis) {
  document.getElementById(`${jenis}Form`).reset();
  document.getElementById(`${jenis}_editing_id`).value = "";
  document.getElementById(`${jenis}SubmitBtn`).textContent =
    jenis === "berita" ? "Publikasikan Berita" : "Publikasikan Pengumuman";
  document.getElementById(`${jenis}CancelEditBtn`).classList.add("hidden");
}

async function deleteNews(jenis, id) {
  if (!confirm("Yakin ingin menghapus ini? Tindakan tidak bisa dibatalkan.")) return;

  const { error } = await supabaseClient.from(jenis).delete().eq("id", id);
  if (error) {
    alert("Gagal menghapus: " + error.message);
    return;
  }
  loadNewsList(jenis);
}

async function loadNewsList(jenis) {
  const container = document.getElementById(`${jenis}ListContainer`);
  container.innerHTML = `<p>Memuat data...</p>`;

  const kolom = jenis === "berita"
    ? "id, judul, konten, gambar_url, created_at"
    : "id, judul, konten, created_at";

  const { data, error } = await supabaseClient
    .from(jenis)
    .select(kolom)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = `<p style="color:red">Gagal memuat: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<p>Belum ada ${jenis === "berita" ? "berita" : "pengumuman"}.</p>`;
    return;
  }

  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";

  container.innerHTML = data.map((item) => {
    const tanggal = new Date(item.created_at).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric"
    });

    const gambarHtml = (jenis === "berita" && item.gambar_url)
      ? `<img src="${item.gambar_url}" class="news-image" alt="${item.judul}">`
      : "";

    const aksiHtml = isAdmin ? `
      <div class="news-actions">
        <button data-action="edit" data-id="${item.id}"
          data-judul="${item.judul.replace(/"/g, '&quot;')}"
          data-konten="${(item.konten || '').replace(/"/g, '&quot;')}"
          data-gambar="${(item.gambar_url || '').replace(/"/g, '&quot;')}"
          class="btn-verifikasi">Edit</button>
        <button data-action="delete" data-id="${item.id}" class="btn-tolak">Hapus</button>
      </div>
    ` : "";

    return `
      <div class="news-card">
        ${gambarHtml}
        <div class="news-card-body">
          <h4>${item.judul}</h4>
          <p class="news-date">${tanggal}</p>
          <p class="news-content">${item.konten || ""}</p>
          ${aksiHtml}
        </div>
      </div>
    `;
  }).join("");
}