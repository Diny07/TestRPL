// ============================================
// DASHBOARD SHELL — Fase 1, Langkah 1.3
// ============================================

document.addEventListener("DOMContentLoaded", async () => {

  // --- 0. HELPER MODAL GLOBAL ---
  // Dipakai modul manapun untuk minta input catatan/teks singkat,
  // menggantikan prompt() bawaan browser yang tampilannya kaku.
  // Cara pakai: const catatan = await window.showTextModal("Judul Modal");
  // Hasilnya string jika user klik Simpan, atau null jika Batal.
  window.showTextModal = function (title, placeholder = "Tulis catatan di sini...") {
    return new Promise((resolve) => {
      const overlay = document.getElementById("modalOverlay");
      const titleEl = document.getElementById("modalTitle");
      const textarea = document.getElementById("modalTextarea");
      const confirmBtn = document.getElementById("modalConfirmBtn");
      const cancelBtn = document.getElementById("modalCancelBtn");

      titleEl.textContent = title;
      textarea.placeholder = placeholder;
      textarea.value = "";
      overlay.classList.remove("hidden");
      textarea.focus();

      function cleanup(result) {
        overlay.classList.add("hidden");
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onOverlayClick);
        resolve(result);
      }
      function onConfirm() { cleanup(textarea.value); }
      function onCancel() { cleanup(null); }
      // Klik di area gelap luar kotak modal = sama seperti Batal
      function onOverlayClick(e) {
        if (e.target === overlay) cleanup(null);
      }

      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", onOverlayClick);
    });
  };

  // --- 1. PROTEKSI HALAMAN ---
  // Cek dulu apakah ada sesi login yang aktif.
  // Kalau tidak ada, langsung tendang ke halaman auth.
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "auth.html";
    return; // hentikan eksekusi script selanjutnya
  }

  const user = session.user;
  window.currentUser = user; // dipakai oleh module lain, misal js/modules/penduduk.js

  // --- 2. AMBIL DATA PROFIL (nama & role) ---
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Gagal ambil profil:", profileError.message);
  } else {
    document.getElementById("userName").textContent = profile.full_name || user.email;
    document.getElementById("userRole").textContent = profile.role;
    window.currentProfile = profile; // dipakai oleh module lain
  }

  // Notifikasi bersifat global (selalu ada di navbar), jadi diinisialisasi
  // sekali di sini — bukan lewat sistem modulAktif seperti modul per-menu
  if (typeof initNotifikasiModule === "function") {
    initNotifikasiModule();
  }

  // Dashboard adalah tampilan default yang terlihat sebelum user klik apapun,
  // jadi perlu diinisialisasi langsung di sini juga (bukan cuma lewat klik menu)
  if (typeof initDashboardHomeModule === "function") {
    initDashboardHomeModule();
  }

  // --- 3. AMBIL IDENTITAS WILAYAH (nama instansi) ---
  const { data: wilayah, error: wilayahError } = await supabaseClient
    .from("wilayah_config")
    .select("nama_instansi")
    .limit(1)
    .single();

  if (!wilayahError && wilayah) {
    document.getElementById("wilayahName").textContent = wilayah.nama_instansi;
  }

  // --- 4. LOGOUT ---
  document.getElementById("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "auth.html";
  });

  // --- 5. NAVIGASI SIDEBAR: switch antar view ---
  const menuItems = document.querySelectorAll(".menu-item[data-menu]");
  const viewPlaceholder = document.getElementById("view-placeholder");
  const viewPenduduk = document.getElementById("view-penduduk");
  const viewPengaduan = document.getElementById("view-pengaduan");
  const viewBansos = document.getElementById("view-bansos");
  const viewBerita = document.getElementById("view-berita");
  const viewSurat = document.getElementById("view-surat");
  const viewForum = document.getElementById("view-forum");
  const viewPeta = document.getElementById("view-peta");
  const viewDashboardHome = document.getElementById("view-dashboard-home");
  const viewStatistik = document.getElementById("view-statistik");
  const viewMonitoring = document.getElementById("view-monitoring");
  const contentTitle = document.getElementById("contentTitle");
  const contentBody = document.getElementById("contentBody");
  const navbarTitle = document.querySelector(".navbar-title");

  // Daftar menu yang SUDAH punya modul nyata.
  // Menu lain masih tampil placeholder sampai fasenya tiba.
  const modulAktif = {
    penduduk: viewPenduduk,
    pengaduan: viewPengaduan,
    bansos: viewBansos,
    berita: viewBerita,
    surat: viewSurat,
    forum: viewForum,
    peta: viewPeta,
    dashboard: viewDashboardHome,
    statistik: viewStatistik,
    monitoring: viewMonitoring
  };

  menuItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();

      menuItems.forEach((m) => m.classList.remove("active"));
      item.classList.add("active");

      const menuKey = item.dataset.menu;
      const menuName = item.textContent;
      navbarTitle.textContent = menuName;

      // Sembunyikan semua view dulu
      viewPlaceholder.classList.add("hidden");
      viewPenduduk.classList.add("hidden");
      viewPengaduan.classList.add("hidden");
      viewBansos.classList.add("hidden");
      viewBerita.classList.add("hidden");
      viewSurat.classList.add("hidden");
      viewForum.classList.add("hidden");
      viewPeta.classList.add("hidden");
      viewDashboardHome.classList.add("hidden");
      viewStatistik.classList.add("hidden");
      viewMonitoring.classList.add("hidden");

      if (modulAktif[menuKey]) {
        // Menu ini sudah punya modul nyata → tampilkan
        modulAktif[menuKey].classList.remove("hidden");

        // Panggil fungsi inisialisasi modul yang sesuai
        // (didefinisikan di masing-masing file js/modules/*.js)
        if (menuKey === "penduduk" && typeof initPendudukModule === "function") {
          initPendudukModule();
        }
        if (menuKey === "pengaduan" && typeof initPengaduanModule === "function") {
          initPengaduanModule();
        }
        if (menuKey === "bansos" && typeof initBansosModule === "function") {
          initBansosModule();
        }
        if (menuKey === "berita" && typeof initBeritaModule === "function") {
          initBeritaModule();
        }
        if (menuKey === "surat" && typeof initSuratModule === "function") {
          initSuratModule();
        }
        if (menuKey === "forum" && typeof initForumModule === "function") {
          initForumModule();
        }
        if (menuKey === "peta" && typeof initPetaModule === "function") {
          initPetaModule();
        }
        if (menuKey === "dashboard" && typeof initDashboardHomeModule === "function") {
          initDashboardHomeModule();
        }
        if (menuKey === "statistik" && typeof initStatistikModule === "function") {
          initStatistikModule();
        }
        if (menuKey === "monitoring" && typeof initMonitoringModule === "function") {
          initMonitoringModule();
        }
      } else {
        // Belum ada modul → tampilkan placeholder
        viewPlaceholder.classList.remove("hidden");
        contentTitle.textContent = menuName;
        contentBody.textContent = `Modul "${menuName}" belum dibangun — akan diisi pada Fase pengembangan modul ini.`;
      }
    });
  });

  // --- 6. TOPBAR: shortcut Home/SOTK/Berita/Foto/Video ---
  // Caranya: cukup "klik-kan" item sidebar yang sesuai secara terprogram,
  // supaya tidak perlu menduplikasi logika switch-view yang sudah ada.
  document.querySelectorAll(".topbar-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.shortcut;

      if (target === "sotk") {
        alert("Fitur SOTK belum tersedia — akan dibangun di fase pengembangan berikutnya.");
        return;
      }

      // Foto & Video sama-sama menuju menu Berita & Pengumuman
      // (tab "Media Center" ada di dalamnya)
      const menuKey = (target === "foto" || target === "video") ? "berita" : target;
      const sidebarItem = document.querySelector(`.menu-item[data-menu="${menuKey}"]`);
      if (sidebarItem) sidebarItem.click();

      // Kalau tujuannya Foto/Video, otomatis pindah ke tab Media Center juga
      if (target === "foto" || target === "video") {
        setTimeout(() => {
          const tabMedia = document.getElementById("tabMedia");
          if (tabMedia) tabMedia.click();
        }, 50);
      }
    });
  });

  // --- 7. TOPBAR SEARCH: shortcut cepat ke pencarian data Penduduk ---
  // Versi awal yang sederhana — ketik nama/NIK, tekan Enter,
  // otomatis pindah ke menu Penduduk dan langsung mencari.
  document.getElementById("topbarSearch").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const keyword = e.target.value.trim();
    if (!keyword) return;

    const pendudukMenuItem = document.querySelector('.menu-item[data-menu="penduduk"]');
    if (pendudukMenuItem) pendudukMenuItem.click();

    setTimeout(() => {
      const searchInput = document.getElementById("pendudukSearch");
      if (searchInput) {
        searchInput.value = keyword;
        searchInput.dispatchEvent(new Event("input"));
      }
    }, 100);
  });

  // --- 8. PANEL "Lihat Semua" di Dashboard Home: shortcut ke menu terkait ---
  document.querySelectorAll(".panel-link[data-shortcut-panel]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const menuKey = link.dataset.shortcutPanel;
      const sidebarItem = document.querySelector(`.menu-item[data-menu="${menuKey}"]`);
      if (sidebarItem) sidebarItem.click();
    });
  });

});