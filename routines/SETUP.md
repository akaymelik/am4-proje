# AM4 Tools Routines — Setup ve Bakım Belgesi

Bu dosya, projeye eklenmiş Claude Code Routines'larının ne yaptığını, nasıl kurulduğunu ve nasıl bakımı yapıldığını anlatır.

## Mevcut Routines

### V1: Haftalık abc8747/am4 İzleme

**Amaç:** abc8747/am4 GitHub repo'su (kanonik formül/veri kaynağımız) güncellendiğinde haberdar olmak. Manuel takibi otomatikleştirmek.

**Tetik:** Haftalık (önerilen: Pazar 22:00 yerel saat)

**Kapsam:**
- Son 7 günün commit'leri taranır
- Kritik dosyalardaki değişiklikler raporlanır:
  - `docs/formulae.md` (yolcu formülü)
  - `docs/formulae/*.md` (formül alt dokümanlar)
  - Uçak verisi dosyaları (`res/aircrafts.json` veya benzeri)
  - Havalimanı verisi (`res/airports.json` veya benzeri)
- AM4 Tools kanonik referanslarla (`research-am4-formulas.md`, `research-am4cc-cargo-formula.md`, `planes.js`) çelişki kontrolü yapılır

**Çıktı:** Routine sonucunda **doğrudan output** olarak markdown rapor üretilir. Routines dashboard'dan run detayına girip okuma + kopyala-yapıştır yapılır. (Routines push permission bug nedeniyle git commit + push devre dışı.)

**Nedir, ne değildir:**
- ✅ Bilgi (monitoring + rapor)
- ❌ Otomatik PR açma (V2'de planlandı)
- ❌ planes.js veya research dosyalarını otomatik güncelleme (V2'de)
- ❌ AM4 forumları/Reddit/Discord izleme (V3'te)

**Maliyet:** Haftada 1 run, Pro plan günlük 5 routine limitinde rahat sığar.

### V2: Haftalık AM4 Sistematik Audit

**Amaç:** AM4 Tools projesinin tüm sistematiğini (formüller, hesaplamalar, AI mantığı) community ve resmi olmayan documentation kaynaklarıyla karşılaştır. Eksik feature, hatalı yaklaşım veya onaylama bulgularını rapor et.

**V1'den farkı:**
- V1: Delta detection (kanonik tek kaynak, abc8747/am4)
- V2: Research audit (dağınık community kaynakları, eksik/hatalı arama)

**Tetik:** Haftalık (önerilen: Çarşamba 12:00 GMT+3 — V1 ile çakışmasın diye haftanın ortası)

**Kapsam (7 bileşen):**
1. Yolcu ekonomisi (revenue, demand, autoprice, calculateOptimalSeats)
2. Kargo ekonomisi (L-first, demand türetimi, calculateOptimalCargo)
3. Maliyetler (yakıt, CO₂, bakım, A-check, salary)
4. Uçak verisi (planes.js — 308 yolcu + 21 kargo)
5. Hub & rota stratejisi (logic.js analyzeTopRoutesForPlane)
6. AI bağlamı (worker.js sistem promptu kuralları)
7. Sabitler (18h DAILY_AVAILABLE_HOURS, 0.5h turnaround, L_CAP_FACTOR=0.7, CI 200)

**Kaynak Tier sistemi (yanlış pozitif filtresi):**
- **Tier 1** (ağırlık 3x): am4-cc.pages.dev, abc8747/am4 docs
- **Tier 2** (ağırlık 2x): Reddit r/AirlineManager4 son 90 gün >10 upvote
- **Tier 3** (ağırlık 1x — sadece corroboration): Steam guides, YouTube transcripts, Discord/forum

**Güven seviyeleri:**
- **Yüksek**: Tier 1 + en az bir Tier 2 corroboration
- **Orta**: Tier 1 tek başına veya 2× Tier 2
- **Düşük**: Tek Tier 2 veya Tier 3 → manuel kontrol önerilir

**Çıktı:** Routine sonucunda **doğrudan output** olarak markdown rapor üretilir (manuel okuma). (Routines push permission bug nedeniyle git commit + push devre dışı.)

**Maliyet:** Haftalık 1 run, web search yoğun. V1 + V2 = haftada 2 run, ayda ~8. Pro plan günlük 5 limit içinde rahat. Token kullanımı V1'den yüksek (web search yoğun), fatura monitör edilmeli.

## V2 Kurulum

V1 ile aynı adımlar (claude.ai/code → New Routine), farklılıklar:
- **Trigger:** Schedule → Weekly → **Çarşamba** 12:00 GMT+3 (V1 Pazar ile çakışmasın)
- **Prompt:** `routines/weekly-system-audit-prompt.md` içeriği
- **Tool access:** V1 ile aynı (web fetch + file system + git ops, "Allow unrestricted git push" açık)
- **Repository:** akaymelik/am4-proje

## Kurulum

1. https://claude.ai/code adresine git
2. Sol menüde **Routines** sekmesi → **+ New Routine**
3. **Repository:** `akaymelik/am4-proje` seç
4. **Trigger:** Schedule → Weekly → Sunday 22:00 (veya tercih ettiğin saat)
5. **Prompt:** `routines/weekly-am4-monitor-prompt.md` dosyasının içeriğini kopyala-yapıştır
6. **Tool access:** Web fetch + Git operations + File system (varsayılan ayarlar yeterli)
7. **Save**

## Bakım

- **İlk hafta:** Çıktıyı `routines/reports/` klasöründen incele, prompt'un nasıl performans verdiğini değerlendir.
- **Hata/eksik bulunca:** `weekly-am4-monitor-prompt.md` dosyasını güncelle, claude.ai/code'da routine'in prompt'unu yenile.
- **Routine silmek/durdurmak:** claude.ai/code → Routines → ilgili routine → Pause veya Delete.

## V2 Roadmap (Gelecek İyileştirmeler)

Aşağıdakiler V1 çalışıp güvenilirliği kanıtlandıktan sonra düşünülecek:

- **Otomatik PR**: Formül değişikliği tespit edilince `research-am4-formulas.md` üzerinde diff oluşturup PR aç
- **planes.js güncellemesi**: Yeni uçak tespit edilince planes.js'e ekleme önerisi
- **AM4 community izleme**: Reddit r/AirlineManager4 + AM4 Discord + oyuncu forumları taraması
- **Diff hesaplama**: abc8747 değişikliği ile mevcut research-am4-formulas.md arasında satır bazlı diff

## Hata Durumları

- **GitHub API erişilemez:** Routine yine de çalışır, "Bu hafta GitHub erişilemez, manuel kontrol gerek" raporu üretir
- **Tool access eksik:** Routines dashboard'da hata görünür, prompt'a tool access tanımı eklenmemiş demek
- **Boş hafta:** Hiç değişiklik yoksa "Bu hafta değişiklik yok" diye kısa rapor yazılır, yine de commit edilir (sürekliliğin kanıtı)
