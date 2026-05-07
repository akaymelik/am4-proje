# AM4 Tools — Haftalık abc8747/am4 İzleme Routine'i (V1)

> Bu dosya claude.ai/code üzerinde Routines kurulurken **prompt** alanına kopyala-yapıştır içerik olarak kullanılır.
> Routine her hafta Anthropic cloud'unda çalışır, akaymelik/am4-proje repo'suna erişimle.

---

## Görev

abc8747/am4 GitHub repo'sundaki **son 7 günün commit'lerini** incele. Kanonik formül ve uçak verisi değişikliklerini yakala, AM4 Tools projesinde güncellenmesi gereken yerleri belirle, markdown rapor üret ve repo'ya commit et.

## Bağlam

- **Bu repo (akaymelik/am4-proje):** AM4 Tools — Airline Manager 4 oyunu için filo optimizasyon aracı
- **Kanonik kaynak (abc8747/am4):** AM4'ün resmi olmayan dokumantasyon ve veri repo'su, formül kanıtları burada
- **Repodaki referans dosyalar:**
  - `research-am4-formulas.md` — yolcu formülü kanonik referansı
  - `research-am4cc-cargo-formula.md` — kargo formülü kanonik referansı
  - `planes.js` — uçak verisi (308 yolcu + 21 kargo)
- **Kullanıcı:** Civil engineer, audit-first paradigma. Belirsiz durumlarda "manuel kontrol önerilir" de, uydurma yapma.

## Adımlar

### 1. Son haftanın commit'lerini al

Web fetch ile şu endpoint'i kullan (GitHub API public, auth gerek yok):

```
https://api.github.com/repos/abc8747/am4/commits?since=<bugünden 7 gün önce ISO 8601 format>
```

Örnek: bugün 2026-05-12 ise `since=2026-05-05T00:00:00Z`. Bugünün tarihini sistemden al.

### 2. Her commit için detay al

Her commit için şu URL'den dosya değişikliklerini fetch et:

```
https://api.github.com/repos/abc8747/am4/commits/<commit_sha>
```

Şu bilgileri kaydet:
- Hash (kısa, ilk 7 karakter)
- Tarih (ISO format)
- Yazar
- Commit mesajı
- Değişen dosya listesi
- Her değişen dosyanın `additions` ve `deletions` sayısı

### 3. Kritik dosyaları izle

Aşağıdaki desenlere uyan dosyalar değiştiyse içeriklerinin yeni halini fetch et:

```
https://raw.githubusercontent.com/abc8747/am4/main/<dosya_yolu>
```

**Kritik dosya desenleri:**
- `docs/formulae.md` (yolcu formülü kanonik dokumantasyon)
- `docs/formulae/*.md` (formül alt dokumanlar)
- `docs/cargo-formula.md` veya `docs/cargo*.md` (kargo formülü)
- `res/aircrafts.json`, `src/aircrafts.json`, `data/aircrafts.json` (uçak verisi — gerçek isim repoda kontrol edilmeli)
- `res/airports.json`, `src/airports.json`, `data/airports.json` (havalimanı verisi)

### 4. AM4 Tools kanonik referanslarla karşılaştır

Mevcut repo'daki şu dosyaları oku:
- `research-am4-formulas.md`
- `research-am4cc-cargo-formula.md`
- `planes.js` (sadece header'da yorumla yazılı versiyon notu varsa o, yoksa entry sayısı)

abc8747'deki yeni değişiklikler bu kanonik referanslarla **çelişiyor mu?**
- Aynı formül ama farklı katsayı: ÇELİŞKİ — rapor et
- Yeni uçak eklenmiş: planes.js'e eklenecek aday — rapor et
- Mevcut uçağın parametresi değişmiş: planes.js güncelleme adayı — rapor et
- Sadece tipo/refactor: notu geç — kritik değil

### 5. Markdown rapor üret

Şu şablonu kullanarak `routines/reports/weekly-am4-update-YYYY-MM-DD.md` dosyası oluştur (YYYY-MM-DD = bugünün tarihi):

```markdown
# AM4 Repo Haftalık İzleme Raporu — YYYY-MM-DD

**Tarama aralığı:** YYYY-MM-DD ile YYYY-MM-DD arası (son 7 gün)
**Tarama zamanı:** YYYY-MM-DDTHH:MM:SSZ
**Repo:** abc8747/am4

## Özet

- **Toplam commit:** N
- **Kritik dosya değişikliği:** M (formül / uçak / havalimanı)
- **AM4 Tools etkisi:** [Yok / Düşük / Orta / Yüksek]

## Commit Detayları

### <hash> — YYYY-MM-DD
**Yazar:** ad
**Mesaj:** commit mesajı
**Değişen dosyalar:**
- dosya1 (+X / -Y)
- dosya2 (+X / -Y)

[Eğer kritik dosya: kısa diff özeti]

[Diğer commit'ler için aynı blok]

## Kritik Bulgular

[Eğer formül değişti, yeni uçak vb. — bu bölüm dolu olur, yoksa "Bu hafta kritik bulgu yok" yaz]

## AM4 Tools Etkisi

[Hangi dosya güncellenmeli, neden — örn:
"research-am4-formulas.md güncellenmeli: yolcu fiyat çarpanı 1.10'dan 1.12'ye değişti (commit abc1234)"]

## Aksiyon Önerileri

[Civil engineer kullanıcı için liste:
1. research-am4-formulas.md'in X bölümünü güncelle (commit abc1234 referansı)
2. planes.js'e Y uçağını ekle (data: {...})
3. Manuel kontrol önerilir: docs/formulae.md commit zyx5678'in etkisi belirsiz]
```

### 6. Boş hafta durumu

Eğer son 7 günde hiç commit yoksa, raporu kısa yaz:

```markdown
# AM4 Repo Haftalık İzleme Raporu — YYYY-MM-DD

**Sonuç:** Bu hafta abc8747/am4 repo'sunda yeni commit yok. AM4 Tools güncel.
```

Yine de dosyayı oluştur ve commit et — sürekliliğin kanıtı.

### 7. Hata durumu

GitHub API erişilemezse (rate limit, network hatası vb.):

```markdown
# AM4 Repo Haftalık İzleme Raporu — YYYY-MM-DD

**HATA:** GitHub API erişilemez (<hata mesajı>). Bu hafta otomatik tarama yapılamadı, manuel kontrol önerilir:
https://github.com/abc8747/am4/commits/main
```

### 8. Git commit + push

- `routines/reports/` klasörü yoksa oluştur
- Yeni dosyayı `git add`
- Commit mesajı: `Routines: weekly am4 update YYYY-MM-DD`
- `git push origin main`

## Dikkat Edilecekler

- **Audit-first:** Bir değişiklik kanıt olmadan "kritik" olarak işaretlenmemeli. Belirsizse "manuel kontrol önerilir" de.
- **Halüsinasyon yasağı:** abc8747'deki değişiklik yoksa rapora satır uydurma. Boş hafta için kısa rapor yeterli.
- **Tarih netliği:** YYYY-MM-DD formatını sistem tarihinden al, varsayım yapma.
- **Kanonik referans:** AM4 Tools kullanıcısı `research-am4-formulas.md` ve `research-am4cc-cargo-formula.md`'i referans olarak görüyor — bu dosyalardaki sayılarla çelişen bir şey varsa açıkça belirt.

## Tool Erişimi (Routines kurulurken seçilecek)

- ✅ Web fetch (GitHub API + raw dosya içerikleri)
- ✅ File system (rapor yazma + mevcut research dosyalarını okuma)
- ✅ Git operations (add, commit, push)
