# RynAssist — Telegram Digital Store Bot

RynAssist adalah pondasi bot Telegram auto-order produk digital berbasis inline keyboard. Proyek ini menggunakan **Node.js**, **Telegraf**, dan **SQLite** (`better-sqlite3`) dengan transaksi atomik agar satu item stok tidak dapat dikirim dua kali.

## Fitur

### User

- Menu `/start`, daftar produk, produk populer, dan pagination (10 produk per halaman).
- Pemilihan produk lewat inline button atau nomor pada halaman terakhir.
- Detail produk, pengatur quantity, validasi stok, saldo, dan riwayat transaksi.
- Konfirmasi sebelum pembayaran saldo; debit saldo, pembuatan order, dan pengambilan stok dilakukan dalam satu transaksi database.
- Langganan notifikasi restock saat stok kosong.
- `Buy (Now)` memakai provider placeholder yang **tidak** membuat pembayaran palsu.

### Admin

- Tambah, edit, hapus/nonaktifkan produk dan restock item digital.
- Lihat stok, order, user, dan statistik sederhana.
- Tambah/kurangi saldo user dengan audit log.
- Broadcast ke user dan pengiriman notifikasi restock.
- Semua command admin hanya menerima Telegram ID dalam `ADMIN_IDS`.

## Struktur

```text
src/
├── commands/       # /start dan command admin
├── config/         # konfigurasi environment
├── database/       # koneksi dan skema SQLite
├── handlers/       # callback produk dan akun
├── keyboards/      # inline keyboard
├── services/       # user, produk, order, restock, payment
└── utils/          # formatter dan helper Telegram
scripts/            # syntax checker dan seed
test/               # pengujian order atomik
```

## Persyaratan

- Node.js 20 atau lebih baru.
- Token bot dari [@BotFather](https://t.me/BotFather).

## Instalasi dan Menjalankan

```bash
git clone <repository-url>
cd Rynassist-tele
npm install
cp .env.example .env
```

Edit `.env`:

```dotenv
BOT_TOKEN=token_asli_dari_botfather
ADMIN_IDS=123456789,987654321
DATABASE_PATH=./data/rynassist.db
STORE_NAME=RynAssist
CURRENCY=Rp
```

`ADMIN_IDS` adalah daftar Telegram user ID numerik yang dipisahkan koma. Jangan commit `.env`; file tersebut sudah masuk `.gitignore`.

Jalankan production:

```bash
npm start
```

Mode development dengan watch:

```bash
npm run dev
```

## Produk Dummy

Seed bersifat opsional dan idempotent. Perintah berikut menambahkan hanya tiga produk dummy beserta lima item stok uji:

```bash
npm run seed
```

Hapus produk dummy sebelum produksi melalui Telegram memakai `/deleteproduct ID`. Gunakan `/stocks` untuk menemukan ID. Produk yang sudah memiliki order akan dinonaktifkan demi menjaga integritas riwayat; produk tanpa order akan dihapus beserta stoknya. Alternatif untuk database pengembangan yang belum berisi data penting: hentikan bot, hapus `data/rynassist.db`, lalu jalankan ulang.

## Command Admin

Gunakan karakter `|` sebagai pemisah:

```text
/admin
/addproduct KODE | Nama Produk | 15000 | Deskripsi
/editproduct 1 | price | 17500
/editproduct 1 | name | Nama Baru
/deleteproduct 1
/restock 1 | email1@example.com|password1 | email2@example.com|password2
/stocks
/orders
/users
/balance 123456789 | 50000 | Top up manual
/balance 123456789 | -10000 | Koreksi saldo
/broadcast Pesan pengumuman
/stats
```

Karena `|` adalah pemisah, setiap item restock sebaiknya tidak mengandung karakter tersebut. Untuk data `email/password`, gunakan format seperti `email:password` atau pemisah lain di dalam item.

Field `/editproduct` yang diizinkan: `code`, `name`, `description`, `price`, dan `is_active` (`1` aktif, `0` nonaktif). Harga dan saldo disimpan sebagai bilangan bulat (rupiah), bukan floating point.

## Jaminan Stok dan Order

Saat user menekan konfirmasi saldo, sistem menjalankan satu transaksi SQLite:

1. Klaim `purchase_intent` yang masih pending dan belum kedaluwarsa.
2. Validasi produk, quantity, stok, serta saldo terbaru.
3. Debit saldo secara kondisional.
4. Buat order berinvoice unik.
5. Ubah setiap stok dari `available` menjadi `sold` secara kondisional.
6. Simpan salinan delivery pada `order_items`, tambah sold count, dan selesaikan intent.

Constraint unik pada `order_items.stock_item_id`, status stok, transaksi database, dan intent sekali pakai mencegah double delivery dan double order. Bila satu tahap gagal, seluruh perubahan di-rollback.

Callback produk ditandatangani menggunakan HMAC berbasis `BOT_TOKEN` dan terikat pada Telegram user ID. Saat konfirmasi, server tidak mempercayai nilai callback: user, produk, quantity, status produk, harga intent, stok terbaru, serta saldo diperiksa ulang. Jangan pernah membagikan `BOT_TOKEN`.

> SQLite cukup untuk satu proses bot. Bila kelak menjalankan banyak instance bot atau volume sangat tinggi, migrasikan storage/locking ke database server seperti PostgreSQL.

## Menambahkan Payment Provider Asli

`src/services/payment/baseProvider.js` mendefinisikan kontrak provider dan `placeholderProvider.js` secara eksplisit menyatakan gateway belum tersedia. Untuk integrasi nyata:

1. Buat provider baru yang mengimplementasikan `createPayment()` dan `verifyPayment()`.
2. Simpan referensi pembayaran eksternal dan status callback/webhook pada tabel/migrasi baru.
3. Setelah webhook terverifikasi secara kriptografis, panggil service fulfillment yang sama/hasil refactor dari order service.
4. Wajib gunakan idempotency key provider dan transaksi database.

Jangan menandai order sebagai paid berdasarkan redirect dari client saja.

## Pemeriksaan

```bash
npm run check
npm test
```

Database dibuat otomatis pada startup. Backup file database beserta WAL/SHM hanya saat proses dihentikan, atau gunakan mekanisme backup SQLite yang benar.
