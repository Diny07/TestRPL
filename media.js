// ============================================
// MODULE: MEDIA CENTER — Fase 6, Langkah 6.3
// ============================================

let mediaModuleInitialized = false;

function initMediaModule() {
  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";
  document.getElementById("mediaFormWrapper").classList.toggle("hidden", !isAdmin);

  loadMediaGallery();

  if (mediaModuleInitialized) return;
  mediaModuleInitialized = true;

  const form = document.getElementById("mediaForm");
  const statusEl = document.getElementById("mediaStatus");
  const submitBtn = document.getElementById("mediaSubmitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("media_file");
    const file = fileInput.files[0];
    if (!file) return;

    const judul = document.getElementById("media_judul").value.trim();
    const tipe = document.getElementById("media_tipe").value;

    submitBtn.disabled = true;
    statusEl.style.color = "#374151";
    statusEl.textContent = "Mengunggah file...";

    // Nama file dibuat unik: timestamp + nama asli (dibersihkan dari
    // karakter aneh) supaya tidak bentrok kalau ada yang upload nama sama
    const namaBersih = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${Date.now()}_${namaBersih}`;

    // 1. Upload file mentahnya ke Supabase Storage (bucket "media")
    const { error: uploadError } = await supabaseClient
      .storage
      .from("media")
      .upload(path, file);

    if (uploadError) {
      statusEl.style.color = "red";
      statusEl.textContent = "Gagal unggah: " + uploadError.message;
      submitBtn.disabled = false;
      return;
    }

    // 2. Ambil URL publik dari file yang baru diupload
    const { data: urlData } = supabaseClient
      .storage
      .from("media")
      .getPublicUrl(path);

    // 3. Simpan referensinya ke tabel media (bukan file-nya, hanya URL-nya)
    const { error: insertError } = await supabaseClient
      .from("media")
      .insert({
        judul: judul || null,
        tipe,
        file_url: urlData.publicUrl,
        diunggah_oleh: window.currentUser.id,
      });

    submitBtn.disabled = false;

    if (insertError) {
      statusEl.style.color = "red";
      statusEl.textContent = "File terunggah, tapi gagal simpan data: " + insertError.message;
      return;
    }

    statusEl.style.color = "green";
    statusEl.textContent = "Berhasil diunggah!";
    form.reset();
    loadMediaGallery();
  });

  // Event delegation untuk tombol hapus di galeri
  document.getElementById("mediaGallery").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='delete-media']");
    if (!btn) return;

    if (!confirm("Yakin ingin menghapus media ini?")) return;

    const mediaId = btn.dataset.id;
    const filePath = btn.dataset.path;

    // Hapus file fisik dari Storage, lalu hapus baris datanya
    await supabaseClient.storage.from("media").remove([filePath]);
    await supabaseClient.from("media").delete().eq("id", mediaId);

    loadMediaGallery();
  });
}

async function loadMediaGallery() {
  const gallery = document.getElementById("mediaGallery");
  gallery.innerHTML = `<p>Memuat galeri...</p>`;

  const { data, error } = await supabaseClient
    .from("media")
    .select("id, judul, tipe, file_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    gallery.innerHTML = `<p style="color:red">Gagal memuat: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    gallery.innerHTML = `<p>Belum ada foto/video yang diunggah.</p>`;
    return;
  }

  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";

  gallery.innerHTML = data.map((m) => {
    // Ambil nama file dari URL, dipakai untuk hapus file di Storage nanti
    const filePath = m.file_url.split("/media/")[1];

    const mediaHtml = m.tipe === "foto"
      ? `<img src="${m.file_url}" alt="${m.judul || ''}">`
      : `<video src="${m.file_url}" controls></video>`;

    const aksiHtml = isAdmin
      ? `<button data-action="delete-media" data-id="${m.id}" data-path="${filePath}" class="btn-tolak media-delete-btn">Hapus</button>`
      : "";

    return `
      <div class="media-item">
        ${mediaHtml}
        <div class="media-caption">
          <span>${m.judul || "(tanpa judul)"}</span>
          ${aksiHtml}
        </div>
      </div>
    `;
  }).join("");
}