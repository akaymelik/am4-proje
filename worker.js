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
        "gemini-2.5-flash",       // Ana model: günlük 250 istek, hızlı
        "gemini-2.5-flash-lite",  // Yedek: günlük 1000 istek, daha hafif
        "gemini-2.5-pro",         // Son çare: günlük 100 istek, en zeki
      ];

      const systemInstruction = `
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
- Günlük maks sefer = floor(24 / cycle)
- Easy modda uçak hızı 4x artar, turnaround sabit kalır — bu nedenle sefer sayısı yaklaşık 3x artar

MALİYET FORMÜLLERİ:
- Yakıt: ceil(mesafe, 2) x 950 x (200/500 + 0.6) x yakıt_tüketimi / 1000
  (950 = FUEL_PRICE $/1000lbs varsayılan, 200 = Cost Index varsayılan)
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

STRATEJİK İPUÇLARI:
- Öncelik sırası: hız > kapasite > yakıt verimi
- Kısa rotalar: çok sefer, küçük uçak yeterli; uzun rotalar: az sefer, kapasite kritik
- Wear %30'da alliance contribution düşer, %50'de tamamen sıfırlanır
- Cost Index düşürmek yakıt maliyetini azaltır ama uçuş süresi uzar ve sefer sayısı düşer
- 8 saatlik rotalar günde 3 sefer, 12 saatlik rotalar günde 2 sefer için idealdir (gap bırakmaz)

TAVIR:
- Net, teknik, kısa cevaplar ver.
- Sayısal hesap istenirse formülü adım adım uygula ve sonucu göster.
- Keskin "bu uçağı al" yerine "şu durumda şu tercih daha mantıklı" gibi koşullu öneriler ver.
- Yanıtı mutlaka tamamla, asla yarıda bırakma.
      `.trim();

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
        // Rota analizi isteği (AI butonu)
        userText = `
${body.plane} ucagi icin rota analizi yap:
- Rota: ${body.route}
- Mesafe: ${body.distance} km
- Tahmini gunluk kar: ${body.profit}
- Yatirim verimi: ${body.efficiency}

Bu rotanin guclu/zayif yonlerini belirt ve optimizasyon onerileri sun. Markdown kullanma, duz metin yaz.
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
                parts: [{ text: systemInstruction }]
              },
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
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
