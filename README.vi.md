# AURA — Kinetic Lyrics & Typography Studio

> **Trình tạo video lời bài hát chữ nhảy (Kinetic Typography) chạy trực tiếp trên trình duyệt web, hỗ trợ 100% font tiếng Việt không vỡ dấu.**

[![Bilingual EN/VI](https://img.shields.io/badge/Language-Ti%E1%BA%BFng%20Vi%E1%BB%87t%20%7C%20English-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Zero Tofu](https://img.shields.io/badge/Vietnamese%20Typography-100%25%20Verified-brightgreen.svg)](#)
[![Offline Ready](https://img.shields.io/badge/Offline%20Ready-Single%20HTML-orange.svg)](#)

---

## 🌟 Giới thiệu

**AURA STUDIO** là công cụ chuyên nghiệp giúp biến lời bài hát thành video lyric chữ nhảy (*Kinetic Motion / Lyric PV*) mượt mà ngay trong trình duyệt mà **không cần cài đặt phần mềm nặng**.

Dự án được xây dựng và tối ưu riêng cho người dùng Việt Nam:
* **Bản địa hóa 100% tiếng Việt:** Giao diện, nút bấm, bảng điều khiển, hướng dẫn phím tắt và thông báo lỗi hoàn toàn bằng tiếng Việt chuẩn ngữ cảnh dựng phim.
* **Đầy đủ 860 hiệu ứng chữ nhảy:** Kết hợp bố cục (Layout), hiệu ứng xuất hiện (Enter), giữ hình (Hold), biến mất (Exit), trang trí (Decor), chuyển động máy quay (Cam) và hiệu ứng màn hình (FX).
* **Bộ Font Việt hóa tích hợp sẵn (Zero-Tofu):** Gõ chữ tiếng Việt có dấu (*ă, â, đ, ê, ô, ơ, ư, dấu ngã, hỏi, nặng, sắc, huyền*) hiển thị chuẩn đẹp tuyệt đối 100%, không bao giờ bị lỗi nhảy font mặc định.
* **Xử lý cục bộ 100% (Local-first):** Nhạc, lời bài hát và video được xử lý hoàn toàn trên trình duyệt của bạn, bảo mật tuyệt đối, không gửi bất kỳ dữ liệu nào lên máy chủ.

---

## 🚀 Bắt đầu nhanh trong 3 bước

1. **Nhập lời bài hát:**
   * Dán lời bài hát vào ô bên trái (mỗi dòng là một câu/cụm từ).
   * Hỗ trợ import trực tiếp file `.lrc` hoặc `.txt`.
2. **Tải bài hát & Căn nhịp:**
   * Tải file audio (`.mp3`, `.wav`, `.m4a`, `.flac`).
   * Bấm nút **"Bắt nhịp" (Tap to sync)** và nhấn phím `Space` theo nhịp bài hát để định thời gian cho từng dòng.
3. **Chọn hiệu ứng & Xuất video:**
   * Nhấn phím `R` hoặc nút **"Ngẫu nhiên" (Randomize)** để thử các biến thể phong cách, chuyển động và bảng màu.
   * Chọn tỉ lệ khung hình (16:9, 9:16 cho TikTok/Shorts, 1:1, 4:5...) và nhấn **"Xuất MP4"**.

---

## 🔤 Kho Font chữ Việt hóa tích hợp sẵn

AURA đã bundle sẵn các bộ font chuẩn bản quyền quốc tế (SIL Open Font License):

| Nhóm phong cách | Bộ font | Đặc điểm & Ứng dụng |
| :--- | :--- | :--- |
| **Quốc dân / Đa dụng** | `Be Vietnam Pro` (400, 700, 900) | Bộ font thiết kế riêng cho tiếng Việt, cân đối và sắc nét ở mọi kích cỡ |
| **Hiện đại / Kinetic** | `Montserrat` (800 ExtraBold) | Chữ dày dặn, đậm chất Pop, năng động và đập nhịp mạnh mẽ |
| **Bo tròn / Thân thiện** | `Lexend` (600 SemiBold) | Nét bo tròn hiện đại, tốc độ đọc chữ cực kỳ mượt khi chuyển động nhanh |
| **Thanh lịch / Trung tính** | `Noto Sans` (500 Medium) | Tối giản, thanh mảnh, phù hợp các đoạn rap nhanh hoặc subtitle phụ |
| **Trữ tình / Ballad** | `Noto Serif` (600 SemiBold) | Nét có chân Mincho sang trọng, dành riêng cho các bản Ballad và nhạc Acoustic |
| **Poster / Punchline** | `Oswald` (600 SemiBold) | Dáng chữ nén (Condensed), tạo ấn tượng thị giác mạnh mẽ cho các câu đắt giá |

Engine tự động nhận diện và ánh xạ (fallback) thông minh: Khi bạn chọn bất kỳ phong cách nào, hệ thống luôn ưu tiên font tiếng Việt tương ứng, triệt tiêu 100% lỗi vỡ chữ.

---

## ✍️ Cú pháp viết lời bài hát (Syntax)

| Cú pháp | Ý nghĩa & Ví dụ |
| :--- | :--- |
| `/` | **Ngắt cảnh trong cùng 1 dòng:** `Đường về quê hương / sáng ngời` (chia câu thành 2 nhịp cắt) |
| `*từ khóa*` | **Nhấn mạnh từ:** `Lời hứa *mãi mãi* khắc sâu` (chữ "mãi mãi" phóng to và có hiệu ứng nổi bật) |
| `!` ở cuối dòng | **Điểm nhấn mạnh:** Thêm hiệu ứng chớp sáng (flash) và rung lắc màn hình |
| `[interlude 8]` | **Đoạn nhạc dạo không lời:** Tạo 8 giây nghỉ chỉ có hiệu ứng nền và trang trí đồ họa |
| `chữ\|chú thích` | **Chữ chú thích nhỏ (Ruby/Gloss):** Thêm dòng chữ nhỏ phía trên chữ chính |
| `[01:23.45]Lời hát` | **Dấu thời gian LRC:** Giữ nguyên timestamp khi nhập từ file LRC |
| `#` | **Dòng ghi chú:** Dòng bắt đầu bằng dấu `#` sẽ được bỏ qua |

---

## ⌨️ Phím tắt tiện lợi

* **`Space`**: Bắt nhịp dòng (trong chế độ Bắt nhịp) hoặc Phát/Tạm dừng video xem trước.
* **`Tab`**: Bắt nhịp điểm cắt cảnh nhỏ trong dòng (khi dòng có chứa dấu `/`).
* **`Backspace`**: Hoàn tác 1 nhịp vừa bắt (lùi lại 1 dòng).
* **`R`**: Đổi ngẫu nhiên toàn bộ phong cách, bảng màu, hiệu ứng (Tạo biến thể mới).
* **`◀` / `▶`**: Xem lại biến thể trước hoặc chuyển sang biến thể tiếp theo.
* **`Ctrl + Z` / `Ctrl + Shift + Z`**: Hoàn tác / Làm lại chỉnh sửa lời và thời gian.

---

## 💻 Cách sử dụng

### 1. Dùng trực tiếp trên máy tính (Offline 100%)
* Tải repository về máy.
* Nhấp đúp chuột vào file **`index.html`** để mở bản Tiếng Việt, hoặc **`en/index.html`** để mở bản Tiếng Anh.
* Chạy hoàn toàn trên trình duyệt mà không cần cài thêm Node.js hay Python.

### 2. Dùng Online qua GitHub Pages
* Bật GitHub Pages trong mục **Settings > Pages** của repository.
* Chọn Branch **`main`** và thư mục **`/ (root)`**.

### 3. Tự Build mã nguồn (Dành cho Lập trình viên)
Yêu cầu Python 3.10+:
```bash
# Build lại toàn bộ các phiên bản ngôn ngữ
python build.py

# Chạy kiểm thử tự động toàn diện trên Google Chrome
python tools/qa_vietnamese.py
```

---

## 📄 Quyền sở hữu & Bản quyền

* **Video và hình ảnh tạo ra:** Hoàn toàn thuộc quyền sở hữu của bạn. Bạn có toàn quyền sử dụng cho mục đích thương mại hoặc cá nhân.
* **Bản quyền âm nhạc & Lời bài hát:** Thuộc về tác giả và chủ sở hữu tác phẩm tương ứng.
* **Mã nguồn:** Phát hành theo giấy phép mã nguồn mở **MIT License**. Xem chi tiết tại [LICENSE](LICENSE).

---

*Phát triển bởi đội ngũ AURA Music Studio — Tối ưu hóa trải nghiệm sáng tạo âm nhạc và video lyric tại Việt Nam.*
