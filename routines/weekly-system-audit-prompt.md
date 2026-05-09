# AM4 Tools — Haftalık Sistematik Audit Routine'i (V2)

> Bu dosya claude.ai/code üzerinde Routines kurulurken **prompt** alanına kopyala-yapıştır içerik olarak kullanılır.
> Routine her hafta Çarşamba 12:00 GMT+3'te Anthropic cloud'unda çalışır.

---

## Görev

AM4 Tools projesinin sistematiğini (formüller, hesaplamalar, AI mantığı, veri) AM4 community ve resmi olmayan documentation kaynaklarıyla karşılaştır. **Eksik feature, hatalı yaklaşım veya onaylanmış bileşenler** olarak bulguları kategorize et, güven seviyesi ile rapor üret, repo'ya commit et.

## Bağlam

- **Bu repo (akaymelik/am4-proje):** AM4 Tools — Airline Manager 4 oyunu için filo optimizasyon aracı
- **Kullanıcı:** Civil engineer, audit-first paradigma. **Yanlış pozitiflere TAHAMMÜLSÜZ.** Belirsiz bulgular için "düşük güven" işaretle, "çelişki" deme. Bizim sistemimizin gerekçesi research dosyalarında belgeli ise ona ağırlık ver.
- **Bu V1'den farklıdır.** V1 (haftalık abc8747 izleme) delta detection. V2 research audit — dağınık kaynaklarda eksik/hatalı arama.
- **Tekrar bulgular:** Community değişimi yavaş, haftalık V2'de aynı bulgular tekrar ortaya çıkabilir. Önceki haftaki raporu (varsa) **routines/reports/** klasöründen oku, **yeni** bulguyu ayır eski tekrarlardan. Eski bulgu hâlâ aktifse "DEVAM EDEN" işaretle, kullanıcının aksiyon almadığını varsay.

## Audit Edilecek Bileşenler (7 kategori)

### 1. Yolcu ekonomisi
- Referans: `research-am4-formulas.md`
- Kod: `configurator.js` calculateOptimalSeats, `dataLoader.js` demand türetimi
- Sabitler: autoprice Y×1.10 / J×1.08 / F×1.06, Easy/Realism katsayıları, L_CAP_FACTOR=0.7
- [v1.0.5] Bilet fiyatları kontrolü: AI cevaplarında autoprice multiplier (Y×1.10, J×1.08, F×1.06) DAHİL mi yoksa BASE değer mi? Test örneği: CDG-ERI B737-800 Realism, AI Y:$2,198 J:$4,533 F:$6,939 demeli (BASE değil). Eğer BASE çıkarsa v1.0.5 kuralları regression — `worker.js` autoprice bölümünü (satır 69-73) ve halüsinasyon yasağını (satır 291-293) kontrol et.

### 2. Kargo ekonomisi
- Referans: `research-am4cc-cargo-formula.md`
- Kod: `configurator.js` calculateOptimalCargo (L-first), demand türetimi (l=round(y/2)*1000, h=j*1000)
- Sabitler: autoprice L×1.10 / H×1.08

### 3. Maliyetler
- Referans: `research-am4-maintenance.md` (bakım), genel sabitler
- Kod: `worker.js` sistem promptu (CO₂ formülü), `logic.js` cost hesabı
- Sabitler: fuel $950/1000lbs, CO₂ $150/1000lbs, A-check, salary

### 4. Uçak verisi
- Dosya: `planes.js` (308 yolcu + 21 kargo)
- Karşılaştır: abc8747/am4 aircraft data dosyaları, am4-cc.pages.dev'in uçak listesi

### 5. Hub & rota stratejisi
- Kod: `logic.js` analyzeTopRoutesForPlane (top-10 rota seçim mantığı)
- Mantık: 18h DAILY_AVAILABLE_HOURS, 0.5h turnaround, fuel/seat efficiency
- [v1.0.6] Bütçe sayfası hub filter çalışması: `paxBudgetHubInput` ve `cargoBudgetHubInput` input alanları `index.html`'de mevcut mu? `UI.resolveHub` ile parse ediliyor mu (datalist full label, IATA, şehir, alias, Levenshtein hepsi)? Test örneği: bütçe 100M + LHR autocomplete seç + Bul → tüm sonuçların En Karlı Rota başlangıcı LHR olmalı, banner "LHR hub'ından" yazmalı. Hub boş bırakılınca top-5 hub global mod korunmalı (regression). Geçersiz IATA için kırmızı uyarı görünmeli. Eğer regression varsa `Logic.getBestPlanesByType` 5-param iletim (`logic.js` satır 247) ve `UI.resolveHub` kullanım (`renderSuggestions` ve `askGeminiForBudget`) kontrol et.

### 6. AI bağlamı
- Kod: `worker.js` sistem promptu kuralları (halüsinasyon yasağı, hub değişimi kuralı, cargo L-first kuralı)
- Karşılaştır: AM4 community'de yaygın AI kullanım pattern'leri (kullanıcı pratikleri varsa)
- [v1.0.5] Halüsinasyon yasağı çalışması: Bilet fiyatı sorulduğunda payload'da `ticketPrices` YOKKEN AI BASE × autoprice multiplier hesabı yapıyor mu, yoksa sadece BASE mi söylüyor? Test: chat balonundan "Y class fiyatı ne 6000km'de?" sor; AI 0.3×6000+150 = 1950 (BASE) demek yerine 1950×1.10 = 2145 (autoprice) demeli. BASE çıkarsa worker prompt halüsinasyon yasağı madde 3 ihlali.
- [v1.0.6] Bütçe AI hub awareness: `askGeminiForBudget` payload'da `budgetHub` field var mı (`ui.js` satır 1111 civarı)? Worker prompt BÜTÇE SORULARI bloğunda HUB FİLTRELİ ANALİZ kuralı var mı (`worker.js` satır 212-216)? Test: bütçe sayfası + LHR hub + AI butonu → AI cevabı "LHR hub'ı için..." vurgusu yapmalı, alternatif hub ASLA önermemeli (alternatifler listedeki başka uçaklar olmalı). Hub boş ise AI hub'a değinmemeli (regression). Eğer AI hub'ı görmezden geliyorsa Cloudflare Workers manuel deploy unutuldu mu kontrol et. Halüsinasyon yasağı ihlali (alternatif hub önerme) varsa worker prompt madde 4 (HALÜSİNASYON YASAĞI: alternatif hub önerme) gözden geçirilsin.

### 7. Sabitler ve oyun mekaniği
- 18h DAILY_AVAILABLE_HOURS (insan limiti, oyunda 24h değil)
- 0.5h turnaround (sabit, oyunda uçak boyutuna göre değişmiyor — bu doğrulanmış mı?)
- CI (Cost Index) 200 default — community'de farklı CI değerleri tartışılıyor mu?
- Reputation R=100% örtük varsayım (Fix #1 KAPATILDI ama community'de tartışılıyor olabilir)

## Kaynak Tier Sistemi

**Tier 1 (en güvenilir, ağırlık 3x):**
- am4-cc.pages.dev (community calculator, formula reverse engineering)
- abc8747/am4 docs (kanonik formula docs)

**Tier 2 (community ana, ağırlık 2x):**
- Reddit r/AirlineManager4 son 90 gün post'lar (>10 upvote olanlar)
- AM4 wiki / fandom (varsa)
- Resmi AM4 Discord arşivi (web search ile yakalanabilenler)

**Tier 3 (dağınık, ağırlık 1x — sadece corroboration için):**
- Steam community guides
- YouTube tier list / strategy videoları (transcript varsa)
- Discord / forum alıntıları
- Eski blog post'lar

## Audit Adımları

### 1. Önceki haftalık raporu oku (haftalık V2 için kritik)

`routines/reports/` klasöründe en son `weekly-system-audit-*.md` dosyasını oku.
- Önceki bulgu listesini referans olarak tut
- Bu hafta YENİ bulguları ayırt et
- Önceki bulgular hâlâ aktifse "DEVAM EDEN" işaretle (kullanıcı aksiyon almadı)
- Çözülmüş bulguları (kullanıcının research dosyalarını güncellemiş olabilir) tespit et, "ÇÖZÜLMÜŞ" not düş

### 2. Her bileşen için web search

Şu sorgu paternlerini kullan:
- `"Airline Manager 4 [bileşen] formula"`
- `"AM4 [bileşen] calculation"`
- `"AM4 [bileşen] guide reddit"`
- `site:reddit.com/r/AirlineManager4 [bileşen]`

### 3. Her bulguyu yapılandır

```
Kaynak URL: <url>
Tier: 1 / 2 / 3
Alıntı: <max 30 kelime>
İlgili AM4 Tools bileşeni: <dosya:satır veya bileşen adı>
Çelişki tipi:
  - **Eksik**: community'de var, bizde yok
  - **Hatalı**: community'de farklı bir değer/yaklaşım
  - **Onay**: bizim yaklaşımı doğruluyor
Güven: Yüksek / Orta / Düşük
Bulgu durumu: YENİ / DEVAM EDEN / ÇÖZÜLMÜŞ
Bizim gerekçemiz: <research dosyalarında belgeli mi, varsa ne diyor>
```

### 4. Güven seviyesi belirleme kuralları

- **Yüksek**: Tier 1 kaynak + en az bir Tier 2 corroboration → bilgi güvenilir
- **Orta**: Sadece Tier 1 tek başına VEYA en az 2 farklı Tier 2 kaynak
- **Düşük**: Sadece tek bir Tier 2 veya Tier 3 → manuel kontrol önerilir

### 5. Bizim gerekçemizi kontrol et

Repo'daki şu dosyaları oku:
- `research-am4-formulas.md`
- `research-am4cc-cargo-formula.md`
- `research-am4-maintenance.md`
- `MEMORY.md` (varsa, kullanıcı disiplini için referans)
- `CLAUDE.md` (varsa, proje bağlamı)

Her bulguyu işaretlerken:
- Bizim gerekçemiz **belgeli** ise: "Bizim gerekçemiz X (kaynak: Y), ama community Z diyor" şeklinde yan yana koy
- Belgeli **değil** ise: bulgu daha kritik, gerekçe ekleme önerisi yap

### 6. Yanlış pozitif filtreleri

ŞU bulguları **rapora dahil etme**:
- Tek bir Reddit kullanıcısının yorumu (corroboration yok)
- Eski post (>1 yıl önce) ve yeni doğrulama yok
- Spekülatif "should be" iddiaları (kanıt yerine fikir)
- Bizim sistemimizin **belgeli gerekçesiyle** çelişen ama corroboration yetersiz olan iddialar

ŞU bulguları **dahil et** ama "Düşük güven" olarak:
- Birden fazla bağımsız Tier 3 kaynaktan gelen ama Tier 1/2 yokken işaretlenen iddialar
- "Manuel kontrol önerilir" notuyla

### 7. Markdown rapor (DOĞRUDAN OUTPUT)

Aşağıdaki şablonu **output olarak ekrana yaz**. Dosya yazma veya commit YAPMA — Routines push permission bug'ı nedeniyle manuel mod. Kullanıcı output'u dashboard'dan okuyacak.

```markdown
# AM4 Tools Haftalık Sistematik Audit — YYYY-MM-DD

**Tarama zamanı:** YYYY-MM-DDTHH:MM:SSZ
**Audit kapsamı:** 7 bileşen kategorisi
**Kaynak Tier dağılımı:** Tier 1: N, Tier 2: M, Tier 3: K
**Önceki haftaya göre:** YENİ X / DEVAM EDEN Y / ÇÖZÜLMÜŞ Z

## Özet

- **Toplam bulgu:** X (Yüksek güven: A, Orta: B, Düşük: C)
- **Kategorize:** Eksik: D, Hatalı: E, Onay: F
- **Durum:** YENİ G, DEVAM EDEN H, ÇÖZÜLMÜŞ I
- **AM4 Tools etkisi:** Düşük / Orta / Yüksek

## Yeni Bulgular (Bu Hafta İlk Tespit)

[Eksik / Hatalı bulgular önce, Onay sonra]

### [Eksik / Hatalı / Onay] — Bileşen adı [YENİ]

**Kaynak:** [URL]
**Tier:** 1
**Alıntı:** "..."
**AM4 Tools'taki yer:** [dosya:satır]
**Bizim gerekçemiz:** [research dosyasındaki referans veya "belgeli değil"]
**Aksiyon önerisi:** [Civil engineer için somut adım]

[Diğer yeni bulgular]

## Devam Eden Bulgular (Önceki Haftalardan, Aksiyon Yok)

[Önceki raporlardaki bulgular hâlâ aktif]

## Çözülmüş Bulgular (Bu Hafta Onaylandı)

[Önceki raporda olup şimdi research dosyalarında düzeltilmiş bulgular]

## Düşük Güven Bulgular (Manuel Kontrol Önerilir)

[Tek kaynak / belirsiz, kullanıcı kararı]

## Onay Bulguları (Pozitif Sinyal)

[Bizim yaklaşımımız community ile uyumlu — moral değer]

## Tarama Notları

- Hangi sorgular yapıldı
- Hangi kaynaklar erişilemedi
- Bir sonraki audit için iyileştirme önerisi (varsa)
```

### 8. Boş hafta durumu

Hiç YENİ bulgu yoksa ve devam eden bulgular da yoksa kısa rapor:

```markdown
# AM4 Tools Haftalık Sistematik Audit — YYYY-MM-DD

**Sonuç:** Bu hafta yeni bulgu tespit edilmedi. AM4 Tools community ile uyumlu görünüyor.

[Eğer DEVAM EDEN bulgu varsa onları yine listele]
```

Yine de dosyayı oluştur ve commit et — sürekliliğin kanıtı.

### 9. Hata durumu

Web search erişilemezse veya tool limit aşılırsa:

```markdown
# AM4 Tools Haftalık Sistematik Audit — YYYY-MM-DD

**HATA:** [hata mesajı]. Bu hafta otomatik audit kısmen veya tamamen yapılamadı. Tarayabildiğimiz kategoriler: [liste]. Erişilemeyen: [liste]. Manuel inceleme önerisi.
```

### 10. Git ops YAPMA — manuel mod

Routines push permission bug nedeniyle git commit + push **DEVRE DIŞI**. Sadece markdown raporu output olarak yaz. Kullanıcı dashboard'dan kopyalayacak.

## Dikkat Edilecekler

- **Audit-first:** Bir bulgu kanıt olmadan "kritik" olarak işaretlenmemeli. Belirsizse "düşük güven, manuel kontrol".
- **Halüsinasyon yasağı:** Web search çıktısı dışında bilgi UYDURMA. Eğer web search bir konuda yetersiz veri verdi, "Bu kategoride yeterli kaynak bulunamadı" yaz, kafadan iddia üretme.
- **Civil engineer hassasiyeti:** Kullanıcı yanlış pozitiflere zaman harcamak istemez. Düşük güven bulgular cömertçe işaretlensin, ama "yüksek güven" yalnızca güçlü kanıt olduğunda kullanılsın.
- **Bizim gerekçemize ağırlık:** research-am4-*.md dosyalarındaki gerekçeler **boşa yazılmadı** — community'deki başka bir görüş varsa, kanıt karşılaştırması yan yana yapılmalı.
- **Onay bulguları değerli:** "Bu doğru çalışıyor" sinyali de raporlanmalı — moral değeri ve gerekçe pekiştirme.
- **Haftalık tekrar yönetimi:** Önceki rapordaki bulguyu yeni bir bulgu gibi göstermeme — DEVAM EDEN işareti kullan, kullanıcıya aynı şeyi tekrar tekrar gösterme.

## Tool Erişimi

- ✅ Web search (Reddit, am4-cc, AM4 wiki, vb.)
- ✅ Web fetch (URL'lerden detay çekme)
- ✅ File system (research dosyalarını + önceki raporları okuma + yeni rapor yazma)
- ❌ Git operations DEVRE DIŞI (manuel mod, push permission bug)
