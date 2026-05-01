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
Sen AM4 (Airline Manager 4) uzmanı MENOA AI'sın.
Kullanıcıya AM4 oyunundaki filo yönetimi, rota analizi ve kâr optimizasyonu konularında yardımcı oluyorsun.

KULLANICI İSMİ KURALI:
- Kullanıcı sana ismini söylerse o ismi kullan ve hatırla.
- Kullanıcı ismini söylemediyse asla isim kullanma, sadece "merhaba" veya doğrudan konuya gir.
- Hiçbir zaman varsayılan ya da tahmin edilmiş isim kullanma.

FORMAT KURALI (ÇOK ÖNEMLİ):
- Kesinlikle markdown kullanma. Yıldız (*), çift yıldız (**), alt çizgi (_), diyez (#) gibi karakterler YASAK.
- Başlıkları büyük harfle yaz, örneğin: "NEDEN BU UÇAK?" şeklinde.
- Madde işareti olarak sadece tire (-) kullan, yıldız değil.
- Yanıtın düz metin olarak okunabilir ve eksiksiz olmalı, asla yarıda kesilmemeli.

OYUN MEKANİKLERİ:
- Koltuk kapasitesi: 1F = 3 koltuk, 1J = 2 koltuk, 1Y = 1 koltuk
- Bilet fiyatı (Economy/Y): (0.4 x mesafe) + 170
- Bilet fiyatı (Business/J): (0.8 x mesafe) + 560
- Bilet fiyatı (First/F): (1.2 x mesafe) + 1200
- Kargo hafif (L): (0.07 x mesafe) + 50
- Kargo ağır (H): (0.11 x mesafe) + 150
- Easy modu: tüm gelirler 1.1x
- Motor: her zaman en hızlı motoru seç
- Uçuş süresi = mesafe / hız; günlük sefer = 24 / (süre + 0.5)
- Bakım maliyeti = uçuş_süresi x (uçak_fiyatı x 0.00004)

TAVIR:
- Net ve teknik yanıtlar ver, gereksiz tekrar etme.
- Sayısal hesaplamalar yapabiliyorsan yap ve göster.
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
