// ============================================
// KONFIGURASI KONEKSI SUPABASE
// ============================================
// Ganti 2 baris di bawah ini dengan URL & Key
// dari project Supabase Anda sendiri.
// Lokasi: Supabase Dashboard > Project Settings > API
// ============================================

const SUPABASE_URL = "https://pymipsihalzuumslibhh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5bWlwc2loYWx6dXVtc2xpYmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTQxNjMsImV4cCI6MjA5ODk3MDE2M30.EIMU9j3O6fSMWb2NjgwyRcA3reNsQd7r8Erf5Qhr8IE";

// Membuat satu client yang dipakai di seluruh project.
// Variabel ini bersifat global, dipakai oleh app.js dan
// nanti oleh semua modul (auth, warga, pengaduan, dst).
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);