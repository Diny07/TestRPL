// ============================================
// MODULE: FORUM DISKUSI — Fase 9, Langkah 9.2
// ============================================

let forumModuleInitialized = false;
let currentThreadId = null;

function initForumModule() {
  // Selalu mulai dari daftar thread setiap kali menu dibuka
  document.getElementById("forumListView").classList.remove("hidden");
  document.getElementById("forumDetailView").classList.add("hidden");

  loadThreadList();

  if (forumModuleInitialized) return;
  forumModuleInitialized = true;

  // --- Form buat thread baru ---
  const threadForm = document.getElementById("forumThreadForm");
  const threadStatus = document.getElementById("forumThreadStatus");

  threadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    threadStatus.style.color = "#374151";
    threadStatus.textContent = "Memposting...";

    const payload = {
      user_id: window.currentUser.id,
      judul: document.getElementById("ft_judul").value.trim(),
      konten: document.getElementById("ft_konten").value || null,
    };

    const { error } = await supabaseClient.from("forum_thread").insert(payload);

    if (error) {
      threadStatus.style.color = "red";
      threadStatus.textContent = "Gagal posting: " + error.message;
      return;
    }

    threadStatus.style.color = "green";
    threadStatus.textContent = "Berhasil diposting.";
    threadForm.reset();
    loadThreadList();
  });

  // --- Event delegation: klik thread → buka detail ---
  document.getElementById("forumThreadList").addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("button[data-action='delete-thread']");
    if (deleteBtn) {
      e.stopPropagation();
      deleteThread(deleteBtn.dataset.id);
      return;
    }

    const card = e.target.closest(".thread-card");
    if (card) openThreadDetail(card.dataset.id);
  });

  // --- Tombol kembali ke daftar ---
  document.getElementById("btnKembaliForum").addEventListener("click", () => {
    document.getElementById("forumDetailView").classList.add("hidden");
    document.getElementById("forumListView").classList.remove("hidden");
    loadThreadList(); // refresh, siapa tahu jumlah komentar berubah
  });

  // --- Form komentar ---
  const komentarForm = document.getElementById("forumKomentarForm");
  const komentarStatus = document.getElementById("forumKomentarStatus");

  komentarForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    komentarStatus.style.color = "#374151";
    komentarStatus.textContent = "Mengirim...";

    const payload = {
      thread_id: currentThreadId,
      user_id: window.currentUser.id,
      konten: document.getElementById("fk_konten").value.trim(),
    };

    const { error } = await supabaseClient.from("forum_komentar").insert(payload);

    if (error) {
      komentarStatus.style.color = "red";
      komentarStatus.textContent = "Gagal mengirim: " + error.message;
      return;
    }

    komentarStatus.textContent = "";
    komentarForm.reset();
    loadKomentarList(currentThreadId);
  });

  // --- Event delegation: hapus komentar ---
  document.getElementById("forumKomentarList").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action='delete-komentar']");
    if (!btn) return;
    deleteKomentar(btn.dataset.id);
  });
}

async function loadThreadList() {
  const container = document.getElementById("forumThreadList");
  container.innerHTML = `<p>Memuat diskusi...</p>`;

  // forum_komentar(count) = hitung jumlah komentar per thread otomatis
  const { data, error } = await supabaseClient
    .from("forum_thread")
    .select("id, judul, konten, created_at, profiles(full_name), forum_komentar(count)")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = `<p style="color:red">Gagal memuat: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<p>Belum ada diskusi. Jadilah yang pertama memulai!</p>`;
    return;
  }

  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";

  container.innerHTML = data.map((t) => {
    const tanggal = new Date(t.created_at).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric"
    });
    const namaPenulis = t.profiles ? t.profiles.full_name : "-";
    const jumlahKomentar = t.forum_komentar && t.forum_komentar[0] ? t.forum_komentar[0].count : 0;
    const isPemilik = window.currentUser && t.profiles; // pemilik dicek di server lewat RLS saat delete

    const hapusHtml = isAdmin
      ? `<button data-action="delete-thread" data-id="${t.id}" class="btn-tolak">Hapus</button>`
      : "";

    return `
      <div class="thread-card news-card" data-id="${t.id}" style="cursor:pointer; padding:1rem 1.2rem;">
        <h4 style="margin-bottom:0.3rem;">${t.judul}</h4>
        <p class="news-date">oleh ${namaPenulis} · ${tanggal} · ${jumlahKomentar} komentar</p>
        <p class="news-content" style="margin-top:0.5rem;">${(t.konten || "").slice(0, 120)}${(t.konten || "").length > 120 ? "..." : ""}</p>
        ${hapusHtml}
      </div>
    `;
  }).join("");
}

async function openThreadDetail(threadId) {
  currentThreadId = threadId;
  document.getElementById("forumListView").classList.add("hidden");
  document.getElementById("forumDetailView").classList.remove("hidden");
  document.getElementById("fk_konten").value = "";
  document.getElementById("forumKomentarStatus").textContent = "";

  const { data, error } = await supabaseClient
    .from("forum_thread")
    .select("id, judul, konten, created_at, profiles(full_name)")
    .eq("id", threadId)
    .single();

  const wrapper = document.getElementById("forumDetailThread");

  if (error || !data) {
    wrapper.innerHTML = `<p style="color:red">Gagal memuat thread.</p>`;
    return;
  }

  const tanggal = new Date(data.created_at).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });

  wrapper.innerHTML = `
    <div class="news-card-body">
      <h4>${data.judul}</h4>
      <p class="news-date">oleh ${data.profiles ? data.profiles.full_name : "-"} · ${tanggal}</p>
      <p class="news-content" style="margin-top:0.8rem;">${data.konten || ""}</p>
    </div>
  `;

  loadKomentarList(threadId);
}

async function loadKomentarList(threadId) {
  const container = document.getElementById("forumKomentarList");
  container.innerHTML = `<p>Memuat komentar...</p>`;

  const { data, error } = await supabaseClient
    .from("forum_komentar")
    .select("id, konten, created_at, profiles(full_name)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    container.innerHTML = `<p style="color:red">Gagal memuat komentar: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<p style="color:#9ca3af; font-size:0.9rem;">Belum ada komentar.</p>`;
    return;
  }

  const role = window.currentProfile ? window.currentProfile.role : null;
  const isAdmin = role === "super_admin" || role === "admin_wilayah";

  container.innerHTML = data.map((k) => {
    const waktu = new Date(k.created_at).toLocaleString("id-ID", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
    const isPemilik = window.currentUser && k.profiles; // validasi sebenarnya di RLS

    const hapusHtml = isAdmin
      ? `<button data-action="delete-komentar" data-id="${k.id}" class="btn-tolak" style="font-size:0.7rem; padding:0.15rem 0.5rem;">Hapus</button>`
      : "";

    return `
      <div class="komentar-item">
        <div class="komentar-header">
          <span class="komentar-nama">${k.profiles ? k.profiles.full_name : "-"}</span>
          <span class="komentar-waktu">${waktu}</span>
          ${hapusHtml}
        </div>
        <p class="komentar-isi">${k.konten}</p>
      </div>
    `;
  }).join("");
}

async function deleteThread(threadId) {
  if (!confirm("Hapus thread ini beserta seluruh komentarnya?")) return;
  const { error } = await supabaseClient.from("forum_thread").delete().eq("id", threadId);
  if (error) {
    alert("Gagal menghapus: " + error.message);
    return;
  }
  loadThreadList();
}

async function deleteKomentar(komentarId) {
  if (!confirm("Hapus komentar ini?")) return;
  const { error } = await supabaseClient.from("forum_komentar").delete().eq("id", komentarId);
  if (error) {
    alert("Gagal menghapus: " + error.message);
    return;
  }
  loadKomentarList(currentThreadId);
}