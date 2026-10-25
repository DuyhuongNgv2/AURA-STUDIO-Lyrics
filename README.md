# AURA LYRICS STUDIO — Trình Tạo Video Kinetic Typography Chuyên Nghiệp

**Các phiên bản ngôn ngữ:** [Mở ứng dụng (Tiếng Việt)](https://duyhuongngv2.github.io/AURA-STUDIO-Lyrics/) · [English](en/) · [日本語](ja/) · [Bahasa Indonesia](id/) · [繁體中文](zh-hant/) · [简体中文](zh-hans/) · [한국어](ko/)

Panel After Effects: [ScriptUI](JIZURA_AE.jsx) · [CEP](JIZURA_CEP.zip)

**AURA LYRICS** là studio tạo video lyric chuyển động chữ (*Kinetic Typography / Kinetic Motion PV*) tự động chạy trực tiếp 100% trên trình duyệt web, không cần cài đặt phần mềm nặng, xuất file MP4 chất lượng cao lên đến 4K 60fps. Dự án sở hữu kho tàng **hơn 879 hiệu ứng chuyển động, 27 phong cách mỹ thuật, tích hợp trọn bộ hiệu ứng CapCut & Concat điện ảnh, kho Stock nền mẫu có sẵn, tải ảnh nền đa chuyển động** và nút thông minh **"Độc bản"** tự động biến hóa hiệu ứng không trùng lặp cho từng câu hát.

**Phiên bản: v1.0.0 (Bản Tiếng Việt Toàn Diện & Chuẩn Điện Ảnh)**

**▶ Mở và dùng ngay trên trình duyệt: [https://duyhuongngv2.github.io/AURA-STUDIO-Lyrics/](https://duyhuongngv2.github.io/AURA-STUDIO-Lyrics/)** (hoặc nhấp đúp vào tệp `index.html` trong thư mục máy tính).

---

## 🌟 Điểm nổi bật vượt trội

* **Không cần cài đặt, chạy offline 100%:** Toàn bộ quá trình phân tích lời, bắt nhịp nhạc, dựng hiệu ứng và xuất video diễn ra trực tiếp bên trong trình duyệt của bạn (WebCodecs + Canvas 2D), tuyệt đối không tải dữ liệu âm thanh hay lời bài hát của bạn lên bất kỳ máy chủ nào.
* **18 Phông chữ Tiếng Việt tuyển chọn:** Tích hợp sẵn các font Google Fonts OFL việt hóa hoàn hảo (*Be Vietnam Pro, Montserrat, Lexend, Dancing Script, Pacifico, Playfair Display, Anton, Syne, Caveat...*), cam kết 100% không bao giờ bị lỗi ô vuông (tofu).
* **Hiệu ứng CapCut & Concat đỉnh cao:** Bổ sung các chuyển động hot trend TikTok/CapCut (*Elastic Pop Bounce, Typewriter Blink, Smooth Slide Up, Stomp Impact, Glitch RGB, Neon Tube, Karaoke Sing-along*) cùng chuyển cảnh điện ảnh Concat (*Whip Pan vút mờ, Film Burn cháy phim & lóe sáng, RGB Split 3D*).
* **Kho Stock mẫu có sẵn (Stock Library):** Chọn nhanh 7 phôi nền nghệ thuật (*Vũ trụ Deep Galaxy, Thành phố Cyberpunk, Hoàng hôn Lo-Fi Chill, Sân khấu Spotlight, Mưa đêm thành phố, Đĩa than Vinyl cổ điển, Đen khói huyền bí*) chỉ với 1 cú click.
* **Tải ảnh nền cá nhân & 5 chế độ chuyển động:** Tải ảnh JPG/PNG/WebP từ máy tính với các chuyển động điện ảnh (*Ken Burns, Beat Pulse nảy theo bass, Lật xoay 3D, Trôi bồng bềnh, Xoay tròn*) kèm thanh trượt làm tối mờ ảnh nền tinh tế.
* **Nút "Độc bản" (Auto Biến Hóa Không Trùng Lặp - Phím `D`):** 1-click tự động phân bổ hiệu ứng bùng nổ cho điệp khúc và êm đềm cho đoạn mở đầu, đảm bảo tuyệt đối không có 2 câu liền kề nào trùng lặp hiệu ứng!
* **Bắt nhịp âm thanh tự động (BPM & Beat Sync):** Tự động phát hiện nhịp trống của bài hát để khớp nhịp chuyển cảnh, hỗ trợ công cụ gõ nhịp thủ công (Tap-to-sync) và kéo thả mốc thời gian trên Timeline.
* **Đa định dạng khung hình & Xuất video:** Hỗ trợ tỉ lệ 16:9, 9:16 (TikTok/Reels/Shorts), 1:1, 4:5, 21:9; xuất MP4 kèm nhạc, ảnh chuỗi PNG, PNG trong suốt tách nền và nền xanh (Green screen) / nền đen (Black screen) để làm phôi ghép video trên Premiere / CapCut / DaVinci Resolve.

---

## 📁 Cấu trúc tệp tin dự án

| Tệp tin / Thư mục | Chức năng |
|---|---|
| `index.html` | Bản ứng dụng chạy trên trình duyệt (đã đóng gói đơn tệp hoàn chỉnh, mở bằng Chrome/Edge/Cốc Cốc) |
| `JIZURA_AE.jsx` | Panel điều khiển dành cho Adobe After Effects (ScriptUI) |
| `JIZURA_CEP.zip` | Panel mở rộng đầy đủ giao diện dành cho Adobe After Effects (CEP Panel) |
| `src/` | Mã nguồn động cơ cốt lõi (Bộ tính toán bố cục, bộ render canvas, các pack chuyển động, âm thanh, UI) |
| `src/11p_capcut.js` | Gói hiệu ứng chuyển động CapCut & chuyển cảnh Concat độc quyền |
| `app/` | Giao diện, bản dịch tiếng Việt, CSS phong cách mỹ thuật và hệ thống đa ngôn ngữ |
| `tools/` | Bộ công cụ kiểm thử tự động, audit DOM tiếng Việt và xuất dữ liệu AE |
| `build.py` | Trình biên dịch tự động toàn bộ các ấn bản ngôn ngữ |

---

## 💻 Môi trường hoạt động

* **Trình duyệt khuyến nghị:** Google Chrome, Microsoft Edge, Cốc Cốc, Brave (hỗ trợ WebCodecs tăng tốc phần cứng tốt nhất để xuất MP4 4K mượt mà).
* **Thiết bị di động:** Hỗ trợ tốt trên iPhone (Safari iOS 16.4+) và Android (Chrome). Đối với các bài hát dài hoặc xuất video 2K/4K chất lượng cao, nên sử dụng trên máy tính (PC / Laptop).
* **Phông chữ:** Tự động nạp các bộ font Google Fonts việt hóa khi có mạng, hoặc tận dụng kho font có sẵn trên máy tính của bạn khi làm việc offline.

---

## ⚖️ Quyền sở hữu & Bản quyền thương mại

* **Video và hình ảnh tạo ra từ công cụ này thuộc 100% quyền sở hữu của bạn.** Bạn được toàn quyền sử dụng cho mục đích cá nhân hoặc thương mại (đăng YouTube, TikTok, Facebook, MV âm nhạc, v.v.).
* Bản quyền lời bài hát và tệp âm thanh thuộc về tác giả / chủ sở hữu của bài hát đó.
* Mã nguồn công cụ được phát hành theo giấy phép mã nguồn mở MIT License. Dữ liệu xử lý hoàn toàn cục bộ trong trình duyệt, không bao giờ gửi ra máy chủ ngoài.

---

## 🧭 Hướng dẫn sử dụng chi tiết (Giao diện Nâng cao & Cơ bản)

Góc trên bên phải màn hình có các nút chuyển đổi chế độ hiển thị: **Nâng cao (Pro)**, **Cơ bản (Easy)** và **Di động (Mobile)**:
* **Chế độ Nâng cao (Mặc định trên PC):** Hiển thị toàn bộ 4 Tab cấu hình sâu (*Phong cách, Hiệu ứng, Thủ thuật 879 chi tiết, Xuất file*), Timeline điều chỉnh chi tiết từng giây, bảng màu và bộ chọn hiệu ứng từng cảnh.
* **Chế độ Cơ bản:** Giao diện tối giản tập trung vào nút bấm lớn "Tạo ngẫu nhiên" và "Tạo độc bản", phù hợp khi bạn muốn ra video nhanh chỉ với 1 click.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AURA LYRICS STUDIO UI                           │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│    CỘT BÊN TRÁI     │        CỘT Ở GIỮA        │     CỘT BÊN PHẢI      │
│  (Lời & Âm thanh)   │   (Màn hình Preview)     │ (Cấu hình & Xuất file)│
│                     │                          │                       │
│ • Tiêu đề & Ca sĩ   │ • Màn hình Canvas 2D/4K  │ • Tab 1: Phong cách   │
│ • Nhập lời bài hát  │ • Thanh Transport (Play) │ • Tab 2: Hiệu ứng     │
│ • Âm thanh & BPM    │ • Nút "Độc bản" (Phím D) │ • Tab 3: Thủ thuật    │
│ • Ảnh nền & Stock   │ • Nút "Ngẫu nhiên" (R)   │ • Tab 4: Xuất video   │
│ • Danh sách câu hát │ • Timeline kéo thả nhịp  │                       │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

---

### 1. Nhập lời bài hát & Cú pháp viết lời
Mỗi dòng văn bản tương ứng với một câu hát hiển thị. Bạn có thể sử dụng các ký tự đặc biệt sau để điều khiển bố cục:

| Ký tự cú pháp | Ý nghĩa & Tác dụng | Ví dụ thực tế |
|---|---|---|
| `/` | **Ngắt cảnh cắt:** Chia câu dài thành 2 cảnh xuất hiện kế tiếp nhau | `Tôi vẫn nhớ/màu bình minh` |
| `*từ ngữ*` | **Nhấn mạnh:** Từ nằm giữa 2 dấu sao sẽ phóng to nổi bật và gán hiệu ứng mạnh mẽ | `Tình yêu này *mãi mãi* khắc sâu` |
| `!` ở cuối dòng | **Bùng nổ (Kime):** Kích hoạt hiệu ứng chớp sáng, zoom giật và rung lắc màn hình | `Không bao giờ gục ngã!` |
| `Câu hát\|Ghi chú` | **Phần chữ phụ:** Chữ sau dấu gạch đứng hiển thị nhỏ làm chú thích ở góc | `AURA\|Studio Version` |
| `[01:23.45]` | **Dấu thời gian LRC:** Đặt chính xác giây bắt đầu câu hát | `[00:15.20]Gió cuốn đi muộn phiền` |
| `[間奏 8]` hoặc `[interlude 8]` | **Đoạn dạo nhạc:** 8 giây không lời, chỉ chạy đồ họa nền và screen effects | `[interlude 8]` |

* **Nút "Mở LRC":** Tải trực tiếp tệp lời `.lrc` có sẵn dấu thời gian từ máy tính vào ứng dụng.

---

### 2. Âm thanh & Canh nhịp bài hát
1. Bấm **"Tải nhạc lên"** để chọn tệp âm thanh (`mp3`, `wav`, `m4a`, `flac`). Hệ thống sẽ tự động phân tích và dò tìm nhịp **BPM** cùng các điểm rơi phách trống.
2. **Đồng bộ bằng gõ nhịp (Tap-to-sync):** Bấm nút "Đồng bộ bằng gõ nhịp", bài hát sẽ phát và bạn chỉ cần nhấn phím **`Space`** ngay đầu mỗi câu hát khi ca sĩ cất giọng. Nhấn **`Tab`** nếu muốn đổi cảnh giữa dòng, hoặc **`Backspace`** để quay lại dòng trước.
3. **Thanh Timeline:** Kéo thả các vạch phân chia đầu câu trên thước thời gian để tinh chỉnh khớp từng mili-giây.

---

### 3. Hình ảnh nền, Kho Stock & Chuyển động ảnh
Tại khu vực **"Hình ảnh nền & Hiệu ứng"** ở cột bên trái:
* **Tải ảnh lên:** Chọn bất kỳ ảnh cá nhân nào từ máy tính (`JPG`, `PNG`, `WebP`).
* **Kho Stock mẫu có sẵn:** Chọn 1 trong 7 phong cách nền nghệ thuật làm sẵn (*Vũ trụ Galaxy, Cyberpunk, Lo-Fi Chill Sunset, Sân khấu Spotlight, Mưa đêm, Đĩa than Vinyl, Đen khói*).
* **5 Chế độ chuyển động hình ảnh:**
  - `Ken Burns`: Phóng to/thu nhỏ chậm rãi và lướt góc nhìn điện ảnh sang trọng.
  - `Beat Pulse`: Ảnh nảy đập và phóng to theo từng cú dập bass của bài hát.
  - `Lật xoay 3D (3D Card Flip)`: Nghiêng phối cảnh 3D không gian sống động.
  - `Trôi bồng bềnh (Floating Parallax)`: Trôi lơ lửng và đung đưa nhẹ nhàng.
  - `Xoay tròn (Turntable Spin)`: Xoay tròn nghệ thuật như đĩa than cổ điển.
* **Độ tối mờ (Dim Overlay):** Kéo thanh trượt từ 0% đến 90% (khuyên dùng 45% - 60%) để ảnh nền tối nhẹ, giúp chữ kinetic phát sáng nổi bật hoàn hảo.

---

### 4. Nút bấm "Độc bản" (Diversity - Phím tắt `D`)
* Nút bấm gradient rực rỡ nằm ngay trên thanh công cụ trung tâm (hoặc bấm phím **`D`** trên bàn phím).
* **Cơ chế:** Quét toàn bộ các câu hát trong bài, tự động phân phối thông minh:
  - Các đoạn cao trào / điệp khúc: Ưu tiên hiệu ứng CapCut nảy lửa (*Elastic Pop Bounce, Stomp Impact, Glitch RGB, Neon Tube, Karaoke Active...*).
  - Các đoạn tự sự / mở đầu: Ưu tiên hiệu ứng êm đềm (*Typewriter, Smooth Slide Up, Wave Sway, Smoke Fade, Highlighter...*).
  - Tự động gán các chuyển cảnh Concat (*Whip Pan, Film Burn, RGB Split*).
  - **Cam kết không trùng lặp:** Lưu bộ đệm lịch sử, đảm bảo qua từng câu hát liên tiếp không có bất kỳ câu nào bị trùng lặp hiệu ứng!

---

### 5. Toàn bộ 4 Tab cấu hình chuyên sâu (Chế độ Nâng cao)

#### Tab 1: Phong cách (Style)
* Lựa chọn 27 bộ phong cách thiết kế hoàn chỉnh (*Noir, Synth 80s, Cyberpunk, Kraft Paper, Acid, Deep Sea, Sakura, Retro Newspaper, Candy Pastel, v.v.*).
* **Vai trò phông chữ:** Thay đổi phông chữ Tiêu đề (Headline), phông chữ Thân bài (Body) hoặc thêm font cá nhân `.ttf`/`.otf` từ máy.
* **Bảng màu:** Đổi màu nhấn (Accent) và hai màu bóng lệch (Ghost A/B), hoặc bấm **"Đổi màu ngẫu nhiên"** để tạo bảng màu hài hòa theo lý thuyết vòng tròn màu sắc.

#### Tab 2: Hiệu ứng (FX)
* **Thống nhất (Unify):** Nhóm các đoạn điệp khúc lặp lại có cùng chuyển động và góc máy quay đồng bộ như một MV chuyên nghiệp.
* **Căn chỉnh chữ (Typeset):** Thu gọn khoảng cách ký tự, đặt chữ xuất hiện trước giọng hát 0.2 giây để người xem đọc kịp theo nhịp.
* **Các thanh trượt điều khiển:** Cường độ chuyển động (*Motion*), Mức độ giật nhiễu (*Glitch*), Độ lệch màu (*Chroma*), Mật độ trang trí (*Decor*), Mức độ chia nhỏ cảnh (*Density*), Độ chuyển cảnh nền (*Bg Switch*).
* **Số khung hình hoạt họa (Koma):** 12 hình/giây (chuẩn phong cách anime Nhật), 8 hình/giây (hoạt hình stop-motion) hoặc Toàn phần (mượt mà 60fps).

#### Tab 3: Thủ thuật & Kỹ thuật chi tiết (Tech)
Bao gồm danh mục **879 chi tiết** được phân loại thành 10 nhóm:
1. **Bố cục (Layout - 184 kiểu):** Chính giữa, Chữ dọc, Chữ chạy viền, Khung truyện tranh, Mưa chữ, Bảng lật, Đĩa than, v.v.
2. **Xuất hiện (Entrance - 125 kiểu):** Bật nảy lò xo CapCut, Máy đánh chữ con trỏ, Trượt mượt, Dập mạnh, Rơi chữ, Phân rã gom tụ, v.v.
3. **Giữ chuyển động (Hold - 52 kiểu):** Nhịp tim đập, Lượn sóng, Rung bass, Lơ lửng, Lắc lư con lắc, v.v.
4. **Biến mất (Exit - 109 kiểu):** Phóng xuyên qua tâm, Khói tan, Rơi tự do, Nổ tung, Cháy xém, Gập lại, v.v.
5. **Xử lý bề mặt chữ (Treatment - 62 kiểu):** Đèn Neon Tube, Dạ quang Highlighter, Hát Karaoke đổi màu, Cyberpunk, VHS Scanlines, Chữ 3D, Cầu vồng, Bóng đổ dài...
6. **Trang trí (Decor - 130 kiểu):** Thước đo, Hồng tâm radar, Vệt mực, Hoa rơi, Ngôi sao, Tia chớp, Nút Play...
7. **Hình nền (Background - 66 kiểu):** Tia mặt trời, Lưới retro, Sóng biển, Cực quang, Bàn cờ, Mưa sao băng...
8. **Máy quay (Camera - 36 kiểu):** Tiến chậm, Lia nhanh, Xoay vòng tròn máy, Rung động đất, Nghiêng phối cảnh...
9. **Hiệu ứng màn hình (FX - 69 kiểu):** Lóe sáng điện ảnh, Rung lắc, Kính vỡ, Tách kênh màu, Nhiễu TV VHS...
10. **Chuyển cảnh (Transitions - 27 kiểu):** Whip Pan lia vút mờ, Film Burn cháy sáng, RGB Split 3D, Quét kim đồng hồ, Mở khẩu độ tròn...

#### Tab 4: Xuất file (Output)
* **Tỉ lệ khung hình:** 16:9 (YouTube), 9:16 (TikTok, Shorts, Reels), 1:1 (Instagram), 4:3, 21:9 (Điện ảnh Ultra-wide).
* **Độ phân giải:** 720p, 1080p Full HD, 1440p 2K, 2160p 4K siêu nét.
* **Tốc độ khung hình (FPS):** 24fps (chuẩn phim điện ảnh), 30fps hoặc 60fps (siêu mượt mà).
* **Định dạng xuất:**
  - **MP4:** Video hoàn chỉnh có sẵn âm thanh chất lượng cao.
  - **Chuỗi PNG (ZIP):** Toàn bộ các khung hình ảnh rời sắc nét.
  - **PNG trong suốt (Transparent ZIP):** Video chữ không có nền để thả thẳng vào Premiere / CapCut / Final Cut Pro.
  - **Nền xanh (Green Screen) / Nền đen (Black Screen):** Dễ dàng lọc chroma key hoặc hòa trộn chế độ Screen.
  - **LRC:** Xuất tệp lời bài hát kèm dấu thời gian.
  - **Dành cho video dung lượng lớn:** Tính năng ghi trực tiếp vào ổ cứng không lo tràn bộ nhớ RAM trình duyệt.

---

## ⌨️ Bảng phím tắt bàn phím tiện lợi

| Phím tắt | Thao tác thực hiện |
|---|---|
| `Space` | Phát hoặc tạm dừng video xem trước (*Preview*) |
| `D` | **Kích hoạt tạo "Độc bản"** (Gán hiệu ứng CapCut biến hóa không trùng lặp) |
| `R` | **Kích hoạt "Ngẫu nhiên"** (Đổi ngẫu nhiên phong cách, chuyển động và bảng màu) |
| `Ctrl + Z` (hoặc `Cmd + Z`) | Hoàn tác thay đổi lời bài hát hoặc mốc thời gian |
| `Ctrl + Y` (hoặc `Shift + Ctrl + Z`) | Làm lại thao tác vừa hoàn tác |
| `Mũi tên Trái / Phải` | Lùi / Tiến từng khung hình video |
| `Shift + Mũi tên Trái / Phải` | Lùi / Tiến nhanh 1 giây |
| `Tab` (khi đang gõ nhịp) | Chia cảnh cắt mới ngay tức thì trong cùng dòng |
| `Backspace` (khi đang gõ nhịp) | Quay lại câu hát trước đó để gõ nhịp lại |

---

## 🔌 Tích hợp với Adobe After Effects

Ứng dụng đi kèm 2 công cụ kết nối trực tiếp với After Effects:
1. **ScriptUI Panel (`JIZURA_AE.jsx`):**
   * Đặt tệp vào thư mục `Scripts/ScriptUI Panels` trong thư mục cài đặt After Effects.
   * Cho phép dựng toàn bộ bài hát thành các Composition chứa Text Layer, Shape Layer, Keyframe và Expression native để bạn chỉnh sửa thủ công không giới hạn.
2. **CEP Extension Panel (`JIZURA_CEP.zip`):**
   * Đưa nguyên vẹn giao diện trực quan của AURA vào làm một bảng điều khiển bên trong After Effects (Window → Extensions).
   * Bấm **"Xuất cho AE"** trên trình duyệt để tải tệp `.json`, sau đó nạp vào After Effects là có ngay Project AE hoàn chỉnh.

---

## 🛠️ Hướng dẫn Nhà phát triển & Biên dịch

Mã nguồn được tổ chức thuần JavaScript hiện đại, không phụ thuộc vào các thư viện đóng gói npm cồng kềnh:
```bash
# Biên dịch ra toàn bộ các bản HTML đơn tệp
python build.py

# Kiểm thử tự động trên trình duyệt Chrome Headless
python tools/qa_vietnamese.py

# Kiểm tra rò rỉ ngôn ngữ trên cây DOM kết xuất
python tools/audit_rendered_dom.py
```

---

## 📄 Bản quyền phần mềm

* Phát hành theo giấy phép **[MIT License](LICENSE)**.
* Toàn bộ video và sản phẩm tạo ra từ phần mềm thuộc quyền sở hữu của người dùng.
* Xem thông tin chi tiết về các thư viện thành phần bên thứ ba tại [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
