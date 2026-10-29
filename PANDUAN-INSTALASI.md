# PANDUAN INSTALASI — PRECISE Precision 1.0 (GAS API + GitHub Pages)

## A. Backend (Google Apps Script)
1. Buka https://script.google.com → **Projek baharu**.
2. Namakan fail `Code.gs` kepada `Kode`, kemudian tampal seluruh `Kode.gs`.
3. **Project Settings** → centang *Show "appsscript.json" manifest file* → tampal isi `appsscript.json`.
4. (Pilihan, jika mahu guna data lama) **Project Settings → Script Properties** → tambah `ssId` = ID Spreadsheet lama anda. Jika tidak, setup akan mencipta yang baharu.
5. Pilih fungsi `setupAppEnvironment` → ▶ Run → beri kebenaran. Jalankan SEKALI.
6. Buka **Execution log**, salin baris `🔑 PIN sementara <e-mel> : <PIN>`. PIN ini hanya dipaparkan sekali.
7. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy → salin URL `/exec`.
8. Setiap kali Kode.gs diubah: **Deploy → Manage deployments → ✏️ → New version** (bukan New deployment).

Tambah staf: tambah baris dalam helaian `Users` (email huruf kecil, nama, `staf`, `aktif`). Kemudian isi `PIN_EMAIL` dan `PIN_BARU` dalam Kode.gs, jalankan `tetapPinPengguna`, dan KOSONGKAN semula dua nilai itu.

## B. Frontend
1. Buka `js/config.js` dan gantikan `GANTI_DENGAN_URL_EXEC_ANDA` dengan URL `/exec`.
2. Folder kerja untuk Git ialah **folder `precise-frontend` itu sendiri** (yang ada `index.html`, `css`, `js`). Jangan naik atau turun satu tahap.

## C. GitHub Pages (di PowerShell dalam folder `precise-frontend`)
Semak dahulu: `dir` mesti menunjukkan `index.html`, `css`, `js`. Jika tidak, anda salah folder.
```
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
Password semasa push = **Personal Access Token** (scope `repo`), bukan kata laluan akaun. Skrin kosong semasa tampal itu normal.

Aktifkan: repo → **Settings → Pages** → Deploy from a branch → `main` / `(root)` → Save → tunggu 1–2 minit.

## D. Kemas kini
```
git add .
git commit -m "Perihal perubahan"
git push
```
Kemudian tekan Ctrl+Shift+R.

## E. Masalah lazim
| Gejala | Punca / penyelesaian |
|---|---|
| 404 di GitHub Pages | `index.html` tiada di root repo — folder yang di-push salah |
| Halaman tanpa gaya | Folder `css/` dan `js/` rata di root — guna terminal, bukan "Upload files" |
| "GAS_URL belum diisi" | Edit `js/config.js`, push semula |
| "Tiada sambungan ke pelayan" | Deployment bukan "Anyone", atau URL bukan `/exec` |
| Ubah Kode.gs tapi tiada kesan | Belum **New version** pada deployment |
| "Terlalu banyak cubaan" | Tunggu 15 minit |
