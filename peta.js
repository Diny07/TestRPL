// ============================================
// MODULE: PETA WILAYAH — Fase 10, Langkah 10.1
// ============================================

let petaMapInstance = null;

async function initPetaModule() {
  // Ambil koordinat pusat wilayah dari wilayah_config
  const { data: wilayah, error } = await supabaseClient
    .from("wilayah_config")
    .select("latitude, longitude, nama_instansi")
    .limit(1)
    .single();

  const lat = (!error && wilayah && wilayah.latitude) ? wilayah.latitude : -7.264;
  const lng = (!error && wilayah && wilayah.longitude) ? wilayah.longitude : 108.263;

  // Leaflet tidak suka di-render 2x di elemen yang sama.
  // Kalau peta sudah pernah dibuat sebelumnya, hapus dulu sebelum bikin baru.
  // (Ini penting karena kita pindah-pindah menu tanpa reload halaman.)
  if (petaMapInstance) {
    petaMapInstance.remove();
    petaMapInstance = null;
  }

  // Buat peta, pusatkan ke koordinat wilayah, level zoom 14 (setingkat kecamatan/desa)
  petaMapInstance = L.map("petaMap").setView([lat, lng], 14);

  // Tile layer dari OpenStreetMap — gratis, tanpa API key, tanpa batas pemakaian wajar
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(petaMapInstance);

  // Tandai pusat wilayah dengan 1 marker sederhana dulu
  L.marker([lat, lng])
    .addTo(petaMapInstance)
    .bindPopup(`<b>${wilayah ? wilayah.nama_instansi : "Pusat Wilayah"}</b>`)
    .openPopup();

  await plotPengaduanMarkers();
}

// Warna marker berbeda sesuai status, supaya sekilas pandang
// admin bisa lihat mana yang masih baru/belum ditangani
const WARNA_STATUS = {
  baru: "#2563eb",      // biru
  diproses: "#d97706",  // oranye
  selesai: "#16a34a",   // hijau
};

function buatIkonBerwarna(warna) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${warna}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

async function plotPengaduanMarkers() {
  const { data, error } = await supabaseClient
    .from("pengaduan")
    .select("judul, kategori, status, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error || !data) return;

  data.forEach((p) => {
    const warna = WARNA_STATUS[p.status] || "#6b7280";
    L.marker([p.latitude, p.longitude], { icon: buatIkonBerwarna(warna) })
      .addTo(petaMapInstance)
      .bindPopup(`
        <b>${p.judul}</b><br>
        Kategori: ${p.kategori || "-"}<br>
        Status: <span style="text-transform:capitalize;">${p.status}</span>
      `);
  });
}