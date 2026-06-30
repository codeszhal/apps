收支核对 PWA v13 - Separate Income / Expense Tables

Perubahan sesuai revisi:
- Goal utama: total 收入 - total 支出 = 0.
- Non-goal: jumlah baris 收入 dan 支出 tidak harus sama.
- Layout diubah:
  - 收入 menjadi tabel sendiri.
  - 支出 menjadi tabel sendiri.
- Setiap tabel memiliki 3 kolom:
  姓名 | 金额 | 合计
- Width kolom:
  - 姓名 sempit untuk ±3 karakter China.
  - 金额 paling panjang.
  - 合计 cukup untuk ±5 digit.
- Tema warna dipertahankan:
  - 收入 = panas/oranye.
  - 支出 = dingin/biru.
- Behavior sensitif input dipertahankan:
  - 金额 tetap menyimpan teks asli.
  - 合计 live calculation.
  - Auto re-check setiap 2 detik.
  - trailing =, spasi, multi-line aman.
  - invalid input mempertahankan angka valid terakhir.
- PWA siap untuk GitHub Pages dan iPhone 14 Pro Max.

Replace:
index.html
style.css
app.js
manifest.json
service-worker.js

Catatan Telegram:
Bot Token tidak di-hardcode demi keamanan. Tempel token di field Bot Token sekali, lalu tersimpan lokal di browser.

