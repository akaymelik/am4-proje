# MENOA AI - AM4 Strateji Paneli

AM4 (Airline Manager 4) oyunu için yapay zeka destekli filo yönetim aracı.

## Dosya Yapısı

| Dosya | Açıklama |
|-------|----------|
| index.html | Ana sayfa ve chat widget |
| style.css | Tüm stiller |
| planes.js | Uçak veritabanı |
| routes.js | Rota veritabanı |
| logic.js | Kâr/verimlilik hesaplama motoru |
| configurator.js | Koltuk ve kargo optimizasyonu |
| utils.js | Formatlama yardımcıları |
| ui.js | Arayüz ve chat modülü (sessionStorage geçmişi) |
| worker.js | Cloudflare Worker - Gemini AI backend |

## Kurulum

### Cloudflare Pages (Frontend)
index.html, style.css, planes.js, routes.js, logic.js,
configurator.js, utils.js, ui.js dosyalarını deploy et.

Script sırası (index.html): planes.js → routes.js → utils.js → configurator.js → logic.js → ui.js

### Cloudflare Workers (Backend)
worker.js dosyasını ayrı bir Worker olarak deploy et.
Environment variable olarak AM4 = <Gemini API Key> ekle.

## Kullanılan Modeller (Ücretsiz)
- gemini-2.5-flash      → Ana model (250 istek/gün)
- gemini-2.5-flash-lite → Yedek (1000 istek/gün)
- gemini-2.5-pro        → Son çare (100 istek/gün)

## Canlı Site
https://am4-proje.pages.dev/
