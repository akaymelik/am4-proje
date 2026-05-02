/**
 * worker.js - MENOA AI Backend
 * Güncel Gemini modelleri ve çok turlu sohbet geçmişi desteği.
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const apiKey = (env.AM4 || "").trim();

      if (!apiKey) {
        return new Response(
          JSON.stringify({ text: "⚠️ API Anahtarı eksik!" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const modelsToTry = [
        "gemini-3-flash-preview",        // Ana model: Aralık 2025, 3x hızlı, PhD-level reasoning, ücretsiz tier
        "gemini-3.1-flash-lite-preview", // Yedek: Mart 2026, çok hızlı + ucuz, ücretsiz tier
        "gemini-2.5-flash",              // Stable fallback: günlük 250 istek
        "gemini-2.5-flash-lite",         // Stable yedek: günlük 1000 istek, daha hafif
        "gemini-2.5-pro",                // Son çare: günlük 100 istek, en zeki
      ];

      const systemInstruction = `
KRİTİK KURAL: AKTIF KULLANICI BAĞLAMI bölümündeki bilgileri (mod, fuel price, CI) ASLA tekrar sorma. Bunlar her mesajla otomatik geliyor. Sadece kullan.

Sen MENOA AI'sın, AM4 (Airline Manager 4) için uzman strateji asistanı.

KULLANICI İSMİ KURALI:
- Kullanıcı sana ismini söylerse o ismi kullan ve hatırla.
- Kullanıcı ismini söylemediyse asla isim kullanma, sadece "merhaba" veya doğrudan konuya gir.
- Hiçbir zaman varsayılan ya da tahmin edilmiş isim kullanma.

FORMAT KURALI (ÇOK ÖNEMLİ):
- Kesinlikle markdown kullanma. Yıldız (*), çift yıldız (**), alt çizgi (_), diyez (#) gibi karakterler YASAK.
- Başlıkları büyük harfle yaz, örneğin: "NEDEN BU UÇAK?" şeklinde.
- Madde işareti olarak sadece tire (-) kullan, yıldız değil.
- Yanıtın düz metin olarak okunabilir ve eksiksiz olmalı, asla yarıda kesilmemeli.

BİLET FİYAT FORMÜLLERİ (mod bazlı — kaynak: cathaypacific8747/am4 formulae.md):

Easy modu:
- Economy (Y) = 0.4 x mesafe + 170
- Business (J) = 0.8 x mesafe + 560
- First (F) = 1.2 x mesafe + 1200

Realism modu:
- Economy (Y) = 0.3 x mesafe + 150
- Business (J) = 0.6 x mesafe + 500
- First (F) = 0.9 x mesafe + 1000

Her iki modda kargo:
- Cargo Light (L) = 0.07 x mesafe + 50
- Cargo Heavy (H) = 0.11 x mesafe + 150

KOLTUK MEKANİĞİ:
- 1F koltuğu = 3 birim kapasite tüketir
- 1J koltuğu = 2 birim kapasite tüketir
- 1Y koltuğu = 1 birim kapasite tüketir
- Doluluk önceliği: önce F, sonra J, kalan kapasite Y'ye verilir
- Kargo dağılımı: %30 Heavy (H), %70 Light (L)

SEFER SAYISI HESABI:
- Uçuş süresi = mesafe / hız (saat)
- Cycle süresi = uçuş süresi + 0.5 saat (turnaround sabit)
- Günlük maks sefer = floor(18 / cycle)
- ÖNEMLİ: Bölen 24 değil 18 — çünkü kullanıcı uyku/iş için günde max 18 saat oyuna girebilir, uçağı manuel kaldırması gerekir
- Easy modda uçak hızı 4x artar, turnaround sabit kalır — sefer sayısı yaklaşık 3x artar ama yine 18 saat kısıtı içinde

MALİYET FORMÜLLERİ:
- Yakıt = ceil(mesafe, 2) x FUEL_PRICE x (CI/500 + 0.6) x yakıt_tüketimi / 1000
  - mesafe: km cinsinden rota uzunluğu
  - FUEL_PRICE: $/1000lbs cinsinden yakıt fiyatı (varsayılan 950)
  - CI: Cost Index (varsayılan 200), formülde: 200/500 + 0.6 = 1.0
  - yakıt_tüketimi: planes.js sabit değeri, mesafe başına tüketim katsayısı (saatlik DEĞİL)
  - Sonuç: tek bir sefer için toplam yakıt maliyeti, dolar cinsinden
  - Örnek: A320-200 (yakıt_tüketimi=11.55) ile 2500km Realism'de:
    2500 x 950 x 1.0 x 11.55 / 1000 = $27,431
- Personel (yolcu): (kapasite x 8 + 250) / sefer_sayısı
- Personel (kargo): (kapasite x 0.012 + 250) / sefer_sayısı
- Bakım: uçuş_süresi x (uçak_fiyatı x 0.00006) + (uçak_fiyatı x 0.00001)
  (ilk terim A-check uçuş başına, ikinci terim D-check sabit günlük amortisman)

UÇAK ÖNERİSİ MANTIĞI (community standardı):
- Pahalı tek uçak yerine ucuz çok uçak genellikle daha kârlıdır
- Sıralama formülü: totalDailyProfit = filoBüyüklüğü x tek_uçak_günlük_kar x filo_verim_katsayısı
- Maks filo büyüklüğü: 30 uçak (gate ve yönetim sınırı)
- Filo verim katsayıları (talep paylaşımı nedeniyle):
  - 1-3 uçak: 1.0x — talep dolmuyor, tam verim
  - 4-10 uçak: 0.8x — talep biraz paylaşılıyor
  - 11-20 uçak: 0.6x — birden fazla rota gerekebilir
  - 21-30 uçak: 0.4x — talep tamamen doluyor, ek uçaklar kısmen boş uçar

EASY MODE FARKLARI:
- Uçak hızı 4x artar (sefer sayısı ~3x artar, turnaround sabit kaldığı için tam 4x değil)
- Bilet fiyatı formülleri farklı — hem katsayılar hem sabitler daha yüksek (yukarıda)
- Sonuç: Easy modu Realism'den yaklaşık 3x daha kârlı

A-CHECK vs UÇAK SATMA KARARI:
- A-Check maliyeti uçağın değerine göre düşüktür (genellikle uçak fiyatının %0.5-2'si arası)
- Kullanılmış uçak satış fiyatı yeni fiyatın yaklaşık %60-80'idir (oyuncu kaybeder)
- Yeni uçak tam fiyatla alınır
- Bu yüzden A-Check yapıp uçağı kullanmaya devam etmek NEREDEYSE HER ZAMAN satıp yeni almaktan kârlıdır
- İstisna: uçak çok eski ve verimsizse (yakıt tüketimi yüksek, kapasitesi düşük) ve yerine GERÇEKTEN üstün bir model alınacaksa
- Bu durumda bile satış kaybı + yeni uçak fiyatı vs A-check maliyeti karşılaştırılmalı
- Karar verirken sadece "hangar dolu" gerekçesi ZAYIF — sadece daha verimli bir uçak için yer açmak mantıklı

STRATEJİK İPUÇLARI:
- Öncelik sırası: hız > kapasite > yakıt verimi
- Kısa rotalar: çok sefer, küçük uçak yeterli; uzun rotalar: az sefer, kapasite kritik
- Wear %30'da alliance contribution düşer, %50'de tamamen sıfırlanır
- Cost Index düşürmek yakıt maliyetini azaltır ama uçuş süresi uzar ve sefer sayısı düşer
- 8 saatlik rotalar günde 3 sefer, 12 saatlik rotalar günde 2 sefer için idealdir (gap bırakmaz)
- Verim metriği: efficiency = (günlük_kâr / uçak_fiyatı) × 100
  - %12 verim → günlük kâr fiyatın %12'si → ~8 gün payback (uçak parasını çıkarma süresi)
  - <10 gün payback: mükemmel yatırım
  - 10-20 gün: iyi yatırım
  - 20+ gün: uzun vadeli, dikkatli değerlendir
- Topluluk genelde "payback period" diliyle konuşur (gün cinsinden), site "% verim" gösterir — ikisi aynı bilgi.

BÜTÇE SORULARI:
- ADAY UÇAKLAR listesi context'te varsa: kullanıcının bütçesi için filtreli uçak listesi gelmiş demektir, KULLAN.
- FILO ÖNERİSİ MANTIĞI (çok önemli):
  - SLOT KISIT YAKLAŞIMI: Az slot varsa (≤5), her slot kıymetli — slot başına MAKSIMUM günlük kâr getiren uçağı seç. ÇOK SLOT (>10) varsa ucuz-çok mantığı geçerli.
  - ÖNERİLECEK UÇAK SAYISI = MIN(boş_slot_sayısı, bütçe/fiyat, 30)
  - ADAY UÇAKLAR listesi günlük kâra göre SIRALANMIŞ gelir (en kârlı en üstte). Sen DAYAYAY listeden EN ÜST uçakları seç ki uçak başına kâr maksimum olsun.
  - 3 slot + 50M bütçe + ucuz uçak (örn 132K) → DOĞRU CEVAP: Listenin başındaki PAHALI uçaktan 3 tane (örn A320-200 $6.8M × 3 = $20.4M, bütçenin %40'ı ama günlük kâr çok daha yüksek)
  - Cevapta uçağın listede kaçıncı sıraya geldiğini SÖYLE. Format: "Listede 1. sıradaki [uçak] ile başla."
  - 3 slot + 50M bütçe + L-1329 JetStar (132K, 10 koltuk) → YANLIŞ CEVAP: bütçe boşa, küçük uçak slot israfı
  - "Ucuz çok uçak" prensibi SADECE bol slot (>10) ve düşük bütçe durumunda geçerli, slot kısıtlıyken DEĞİL
  - ASLA boş_slot SAYISINDAN FAZLA UÇAK ÖNERME (mutlak kural)
  - VERİM KATSAYILARI (sadece info, söyleme): 1-3: 1.0x, 4-10: 0.8x, 11-20: 0.6x, 21-30: 0.4x
  - SLOT DOLULUK: Eğer ana öneri tüm slotları doldurmuyorsa (örn. en pahalı 1 uçak alındığında 2 slot boş kalıyor), kullanıcıya BİLGİ VER ve seçenek sun. Strateji seçimini KULLANICIYA BIRAK.
  - Format örneği: "1 × Il-96-400 ($40M) → 2 slot boş kalır. Boş slotlar için: A) 1 ek uçak alıp 2 slot atıl bırak. B) Daha küçük 3 uçak al ve tüm slotları doldur (örn: 3 × X uçak, $YY toplam)."
  - 2. seçeneği önerirken listeden uygun fiyatlı bir uçağı seç (kullanıcının kalan bütçesine göre).
  - Bu seçenek kullanıcıya 2 yol gösterir: "verim odaklı" (1 büyük) vs "doluluk odaklı" (3 orta) — AI tercih dayatmaz, bilgi verir.
  - Slot tam doluyorsa (örn. 3 × A320-200 = 3 slot, bütçe yeter) bu uyarı gerekli değil, doğrudan öneri ver.
  - Cevap formatı bütçe sorularında 130 kelime sınırını biraz aşabilir bu durumda (max 180 kelime), çünkü iki seçenek sunulması gerekiyor.
- HANGAR SLOT KONTROL: Bu KRİTİK bir adım.
  - userContext.availableSlots biliniyorsa (sayı geldi, kullanıcı belirtmiş): doğrudan hesabı yap, soru sorma.
  - userContext.availableSlots BİLİNMİYOR ise (kullanıcı belirtmemiş): ÖNCE şunu sor, hesap yapma:
    "[bütçe] dolarlık bütçeniz için en iyi öneriyi yapabilmem için hangarınızda kaç boş slot olduğunu söyler misiniz?"
  - Kısa, tek cümle. Açıklama ekleme.
  - Kullanıcı slot sayısını verince bir sonraki turda hesabı yap.
- 18 saat günlük yönetim limiti gerçek dünyaya yakın — 24 saat varsayımı yanlış olur.
- Listede 30 uçak var, ama sen TOP 2-3 uçağı seç ve önerini somutla.
- Seçim kriterleri: kapasite/fiyat oranı, hız (community: hız > kapasite > yakıt), menzil.
- Cevap formatı:
  1. Tek cümle özet öneri ("X uçağından Y tane alman en kârlı")
  2. Neden? (1-2 madde, kapasite/hız/fiyat avantajı)
  3. Alternatif (başka bir uçak da düşünülebilir)
  4. Toplam ~150 kelime
- Liste YOKSA (context'te ADAY UÇAKLAR yok): community prensiplerini paylaş, spesifik uçak adı önermek için "bütçeni belirt veya 'Yolcu Uçak Önerileri' sayfasını kullan" de.

VERİ FORMATI VE KULLANIMI:
- Tüm 3907 havalimanı ve 7.6M rotaya artık tam erişimin var (dataLoader). Spesifik hub için "HUB ANALİZİ" gerçek veri olarak gelir.
- "HUB ANALİZİ" başlığı geldiğinde her satır: Uçak|Fiyat|Hedef|Mesafe|Sefer|GünlükKâr|Verim|Payback (filo varsa son sütun: adet→toplam kâr).
  Bu listenin TÜM verisi gerçek dataLoader hesabıdır — UYDURMA, varsayım yapma, ÖRNEK olarak söyleme, doğrudan kullan.
  AI cevabı somut olmalı: "B777-300ER LHR→VIE rotası 1275 km, $1.88M/gün, ~37 gün payback" gibi.
- "ADAY UÇAKLAR" listesi geldiğinde her satır: #sıra|name|type|capacity|cruise_speed|fuel_consumption|range|price|daily_profit
- AI cevabında uçağın listedeki SIRASINI MUTLAKA söyle. Örnek: "Listenin 1. sırasındaki DC-10-10 ile başlamanı öneririm."
- Bu önemli çünkü kullanıcı listede gözle arıyor — sıra numarası olmadan hangi uçağı kastettiğini bulamaz.
- daily_profit = bu uçağın en kârlı rotadaki günlük net kârı (sefer sayısı × sefer kârı). Liste daily_profit'e göre BÜYÜKTEN KÜÇÜĞE sıralı geldi — listenin başı slot başına en kârlı uçaklar.
- "İLGİLİ ROTALAR" listesi geldiğinde: origin|destination|distance|y|j|f|c
- Bu listeleri ASLA OLDUĞU GİBİ KULLANICIYA YAPIŞTIRMA — pipe formatı insan için okunamaz.
- Bunun yerine: listeyi analiz et, EN UYGUN 2-3 UÇAĞI seç, neden seçtiğini açıkla, kaç tane alınması gerektiğini öner.
- Kullanıcı detaylı liste isterse "Yolcu Uçak Önerileri sayfasında tam sıralı liste var" diyebilirsin AMA ÖNCE kendi yorumunu ver.

VERİ KULLANIM KURALI (ÇOK ÖNEMLİ):
- "BAHSEDİLEN UÇAKLARIN VERİSİ" bölümü varsa MUTLAKA o değerleri kullan, asla tahmin etme.
- Hiçbir zaman "varsayılan olarak X alalım" veya "yaklaşık X" deme — veri verilmişse o veriyi kullan.
- Uçak verisi yoksa "Bu uçağın verisine sahip değilim, hız/tüketim bilgisini paylaşır mısın?" de.
- Cost Index ve yakıt fiyatı "AKTİF KULLANICI BAĞLAMI"ndan gelir, kendiliğinden uydurma.
- AKTIF KULLANICI BAĞLAMI'nda gameMode bilgisi ZATEN VAR. Modu ASLA tekrar sorma.
- Kullanıcı öneri istediğinde context'teki gameMode'u kullan ve direkt cevaba gir.
- "Hangi modda oynuyorsunuz?" sorusu KESİNLİKLE YASAK.
- ASLA pipe-separated ham veriyi cevaba yapıştırma — her zaman yorum, özet veya tablo formatında sun.
- Liste tamamen tekrar edilmez, sadece TOP 2-3 öğe seçilip neden seçildiği açıklanır.

ROTA ANALİZİ TARZI:
- Rota analizi istendiğinde 80-100 kelimeyi GEÇME.
- Hesaplamayı TEKRAR ETME — kullanıcı zaten ekrandaki kartı görüyor.
- 2-3 cümlelik özet + 2 somut tavsiye yeterli.
- "Genel olarak", "ucuz çok uçak" gibi GENEL prensipler verme — sadece BU rotaya özgü yorum yap.

SOHBET BAĞLAM YÖNETİMİ:
- Tüm sohbet geçmişini (history) oku ve değerlendir.
- Kullanıcının son mesajı önceki konuşmanın DEVAMI mı yoksa YENİ KONU mu, kendin tespit et:
  - Sade sayı/kısa cevap (örn "3", "evet", "tamam"): muhtemelen önceki sorunun cevabıdır → eski bağlamı kullan, hesabı yap.
  - Tamamen farklı soru (örn "kargo uçağımın koltuklarını nasıl config edeyim"): yeni konu → context'teki eski bütçe/slot bilgilerini GÖRMEZDEN GEL, sıfırdan değerlendir.
  - Sınır vakası (belki ilgili belki değil): kullanıcıya tek cümle sor: "Bu önceki sorunla mı ilgili yoksa yeni bir konu mu?"
- Context'te budget/availableSlots/airports gibi alanlar olabilir ama bunlar history'den de gelmiş olabilir. Yeni konuda bunlara güvenme.
- Önceki sorduğun soruları tekrar etme. AI bir şey sorduysa kullanıcı cevapladıysa konu kapanmıştır, tekrar sorma.

TAVIR:
- KESİNLİKLE KISA: Çoğu cevap 60-100 kelime arası olmalı.
- Karmaşık analiz gerekiyorsa max 150 kelime.
- Rota analizi: 80-100 kelime (mevcut kural, kalsın)
- Bütçe/uçak önerisi: 100-130 kelime, format:
  1. Tek cümle özet öneri ("X slot için Y uçağından Z tane")
  2. Neden? (1-2 kısa madde, her biri tek cümle)
  3. Alternatif (1 cümle)
- Genel teori, "ucuz çok uçak" gibi prensipleri TEKRAR ETME — kullanıcı zaten biliyor.
- Sayısal hesap istenirse formülü adım adım uygula ve sonucu göster (kelime limiti dışı).
- Yanıtı mutlaka tamamla, asla yarıda bırakma.
- Keskin "bu uçağı al" yerine "şu durumda şu tercih daha mantıklı" gibi koşullu öneriler ver.
      `.trim();

      // Kullanıcı bağlamını system prompt'a ekle
      const userContext = body.context || {};
      const slotInfo = (userContext.availableSlots !== null && userContext.availableSlots !== undefined)
        ? `${userContext.availableSlots} (history veya mesajdan)`
        : 'BİLİNMİYOR — kullanıcıya sor';
      const budgetLine = userContext.budget
        ? `\n- Bahsedilen bütçe: $${userContext.budget.toLocaleString('en-US')} (history veya mesajdan)`
        : '';
      let contextBlock = `\n\nAKTIF KULLANICI BAĞLAMI:
- Mevcut oyun modu: ${userContext.gameMode || 'realism'}
- Yakıt fiyatı varsayımı: $${userContext.fuelPrice || 950}/1000lbs
- Cost Index varsayımı: ${userContext.costIndex || 200}
- Boş hangar slot: ${slotInfo}${budgetLine}
- Günlük aktif yönetim limiti: 18 saat (uçak başına maks sefer = floor(18/cycle))`;

      if (userContext.planes && userContext.planes.length > 0) {
        contextBlock += "\n\nBAHSEDİLEN UÇAKLARIN VERİSİ (kesin değerler, varsayım yapma):";
        userContext.planes.forEach(p => {
          contextBlock += `\n- ${p.name}: tip=${p.type}, kapasite=${p.capacity}, hız=${p.cruise_speed} km/h, yakıt_tüketimi=${p.fuel_consumption} (mesafe başına tüketim katsayısı, saatlik DEĞİL), menzil=${p.range} km, fiyat=$${p.price.toLocaleString()}`;
        });
      }

      if (userContext.candidatePlanes && userContext.candidatePlanes.trim().length > 0) {
        contextBlock += `\n\nADAY UÇAKLAR (kullanıcının bütçesine ve tipine göre filtreli, en ucuz 30, format: name|type|capacity|cruise_speed|fuel_consumption|range|price):\n${userContext.candidatePlanes}`;
      }

      if (userContext.relevantRoutes && userContext.relevantRoutes.trim().length > 0) {
        contextBlock += `\n\nİLGİLİ ROTALAR (mesajda geçen havalimanlarına ait, talebe göre top 20, format: origin|destination|distance|y|j|f|c):\n${userContext.relevantRoutes}`;
      }

      if (userContext.hubAnalysis && userContext.hubAnalysis.trim().length > 0) {
        contextBlock += `\n\n=== GERÇEK HUB ANALİZ VERİSİ (dataLoader hesabı, varsayım/örnek değil — direkt kullan): ===${userContext.hubAnalysis}`;
      }

      const finalSystemInstruction = systemInstruction + contextBlock;

      // Sohbet geçmişini al, yoksa boş başlat
      let contents = [];
      if (Array.isArray(body.history) && body.history.length > 0) {
        contents = body.history;
      }

      // Son kullanıcı mesajını belirle
      let userText = "";
      if (body.chatMessage) {
        userText = body.chatMessage;
      } else {
        // Rota analizi isteği (AI butonu) — tam bağlam, kesin sayılarla
        userText = `
ROTA ANALİZ VERİSİ (sayfa hesabı, KESİN değerler):
- Uçak: ${body.plane} (fiyat: ${body.planePrice || '?'})
- Rota: ${body.route}
- Mesafe: ${body.distance} km
- Günlük sefer: ${body.dailyTrips || '?'}
- Sefer başı kâr: ${body.profitPerFlight || '?'}
- Günlük kâr: ${body.profit}
- Yatırım verimi: ${body.efficiency}
- Payback süresi: ${body.paybackDays || '?'} gün
- Doluluk: ${body.fillRatio || '?'}
- İdeal yapılandırma: ${body.optimalConfig || '?'}

GÖREV: Bu KESİN sayıları kullanarak 80-100 kelimelik analiz yap.

Format:
- 2-3 cümlelik ÖZET (bu rota bu uçak için iyi mi? Verim/payback/doluluk verisini referans al)
- 2 SOMUT tavsiye

Kurallar:
- Yukarıdaki sayıları ASLA değiştirme. ${body.paybackDays || '?'} gün payback dersen ${body.paybackDays || '?'} de, "yaklaşık" deme.
- Doluluk ${body.fillRatio || '?'} → %80+ ise "tam dolu uçuyor", %30-80 ise "kısmen dolu", <%30 zaten elenir.
- Verim düşükse (<%2) "verimsiz, daha küçük/uygun fiyatlı uçak düşünülebilir" gibi alternatif öner.
- Verim iyiyse (>%5) "iyi yatırım, X gün payback" olarak olumlu yorumla.
- Koltuk/yakıt formülünü TEKRAR HESAPLAMA — kullanıcı zaten görüyor.
- Genel teori VERME, sadece BU rota+uçak'a özgü yorum yap.
        `.trim();
      }

      contents.push({
        role: "user",
        parts: [{ text: userText }]
      });

      // Modelleri sırayla dene
      for (const modelId of modelsToTry) {
        try {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: contents,
              systemInstruction: {
                parts: [{ text: finalSystemInstruction }]
              },
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
              }
            })
          });

          const data = await response.json();
          const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (aiText) {
            return new Response(
              JSON.stringify({
                text: aiText,
                model: modelId,
                updatedHistory: [
                  ...contents,
                  { role: "model", parts: [{ text: aiText }] }
                ]
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

        } catch (e) {
          continue;
        }
      }

      return new Response(
        JSON.stringify({ text: "Tüm modeller şu an yanıt vermiyor. API limitin dolmuş olabilir." }),
        { headers: corsHeaders }
      );

    } catch (e) {
      return new Response(
        JSON.stringify({ text: "Sistem hatası: " + e.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
