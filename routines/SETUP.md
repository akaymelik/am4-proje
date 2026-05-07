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

**Çıktı:** `routines/reports/weekly-am4-update-YYYY-MM-DD.md` markdown raporu, repo'ya commit edilir.

**Nedir, ne değildir:**
- ✅ Bilgi (monitoring + rapor)
- ❌ Otomatik PR açma (V2'de planlandı)
- ❌ planes.js veya research dosyalarını otomatik güncelleme (V2'de)
- ❌ AM4 forumları/Reddit/Discord izleme (V3'te)

**Maliyet:** Haftada 1 run, Pro plan günlük 5 routine limitinde rahat sığar.

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
