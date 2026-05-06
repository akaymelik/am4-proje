/**
 * ui.js: MENOA AI Arayüz, Sohbet ve Analiz Yönetimi.
 * Özellikler: Daktilo efekti, Premium UI Kartları, Konfigürasyon Aktarımı.
 * GÜNCELLEME: Chat geçmişi sessionStorage'da tutulur (sekme kapanınca sıfırlanır).
 * Bağlantı: https://ai.airm4.workers.dev/
 */

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

// Türkçe + diakritik normalize: "İstanbul" / "Istanbul" / "istanbul" hepsini "istanbul"e çevirir
function normalizeText(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ı/g, 'i');
}

// IATA whitelist ve iki seviyeli şehir haritası.
// Eskiden routes.js IIFE ile dolduruluyordu (156 popüler), şimdi dataLoader.airports (3907)'den
// UI.rebuildIndex() metoduyla doldurulur. dataLoader hazır olana kadar boş kalır.
// - cityToIata: tam ad + iki-kelime + tek-IATA'lı tek-kelime + Türkçe alias (single-IATA)
// - ambiguousCities: tek-kelime → çoklu IATA (örn. "london" → [LHR, LGW, LCY])
const KNOWN_IATA = new Set();
const cityToIata = new Map();
const ambiguousCities = new Map();

// Adım 4b yan etkisi düzeltmesi (Dokunuş 4.7): uçak adı parçaları (caravelle, boeing,
// concorde gibi ≥4 harfli alfa kısımları) Adım 4a Levenshtein fallback'inde şehir adlarına
// yanlışlıkla düzeltilmesin. aircraftData planes.js'ten gelir, ui.js yüklendiğinde dolu.
const PLANE_NAME_PARTS = new Set();
if (typeof aircraftData !== 'undefined') {
    for (let name in aircraftData) {
        const nameNorm = name.toLowerCase().replace(/[\s\-_]/g, '');
        // Sayılarla parçala, sadece ≥4 harfli alfa parçalarını al ("caravelle11r" → ["caravelle"])
        nameNorm.split(/\d+/).filter(p => p.length >= 4).forEach(p => PLANE_NAME_PARTS.add(p));
    }
}

// Mesajdan bağlam çıkar: bütçe, havalimanı, uçak tipi, sefer sayısı
function extractContextFromMessage(text) {
    const result = {
        budget: null, airports: [], planeType: null, manualTrips: null, availableSlots: null,
        // Adım 4b — uçak entity ile AND'lenecek route intent flag
        routeIntent: false,
        // Adım 4a NLU genişletme — opsiyonel uyarı/düzeltme alanları
        ambiguousAirportNotice: null,      // { iata, city, alternatives:[iata,...] }
        levenshteinAirportCorrection: null, // { typed, corrected:iata, city }
        ambiguousCountry: null              // { country, candidates:[iata,...] }
    };
    const lowerTr = text.toLocaleLowerCase('tr');

    // BÜTÇE — suffix'li (kelime/letter sınırı + plane variant koruma)
    // (?<![\w-]) negative lookbehind: "B737-100M" gibi uçak adı parçalarını engeller
    const suffixRe = /(?<![\w-])(\d+(?:[.,]\d+)?)\s*(milyar|billion|milyon|m|k|bin)\b/i;
    const suffixMatch = lowerTr.match(suffixRe);
    if (suffixMatch) {
        const num = parseFloat(suffixMatch[1].replace(',', '.'));
        const unit = suffixMatch[2].toLowerCase();
        const mult = (unit === 'milyar' || unit === 'billion') ? 1e9
                   : (unit === 'milyon' || unit === 'm') ? 1e6
                   : (unit === 'k' || unit === 'bin') ? 1e3 : 1;
        result.budget = Math.round(num * mult);
    } else {
        // Grup ayraçlı sayı (en az 2 grup): 50.000.000 yakalar, 50.000 yakalamaz
        const groupedMatch = text.match(/(?<![\w-])\d{1,3}(?:[.,]\d{3}){2,}\b/);
        if (groupedMatch) result.budget = parseInt(groupedMatch[0].replace(/[.,]/g, ''), 10);
    }

    // HAVALIMANI — apostrof split (LHR'den → "LHR" "den") + uppercase + Türkçe ek filtresi.
    // "LHR'den" yazımında DEN (Denver IATA) false positive olarak yakalanmasın.
    const TR_SUFFIXES = new Set([
        'DEN', 'DAN', 'TEN', 'TAN',           // ablative (-den/-dan/-ten/-tan)
        'NIN', 'NUN', 'NÜN', 'NIN',           // genitive (-nin/-nun)
        'CAK', 'CEK',                          // future (-cak/-cek)
        'YOR', 'BIZ', 'SIZ'                    // common Turkish 3-letter tokens
        // ROP kaldırıldı: kök neden cityToIata.get('rota') idi, whole-word match ile çözüldü.
        // Kullanıcı kasten "ROP" yazarsa Rota Island'a erişsin.
    ]);
    const seen = new Set();
    // Apostrof'u boşluğa çevir, sonra uppercase'le, sonra 3-harf ALL-CAPS yakala
    const upperText = text.replace(/[''`]/g, ' ').toUpperCase();
    const tokenRe = /\b[A-Z]{3}\b/g;
    let tm;
    while ((tm = tokenRe.exec(upperText)) !== null) {
        const upper = tm[0];
        if (TR_SUFFIXES.has(upper)) continue;
        if (seen.has(upper)) continue;
        // KNOWN_IATA (routes.js eski) veya dataLoader.iataToId (3907) üyeliği şart
        const inKnown = KNOWN_IATA.has(upper);
        const inDl = window.dataLoader && window.dataLoader.iataToId && window.dataLoader.iataToId.has(upper);
        if (inKnown || inDl) {
            seen.add(upper);
            result.airports.push(upper);
        }
    }
    // Şehir adı taraması (1): uzun-önce, cityToIata (tek-IATA'lı tüm key'ler)
    // WHOLE-WORD match (substring değil): "rota nedir?" → 'rota' (Rota Island, ROP) eşleşmesin.
    // Türkçe eklere izin ver: "Roma'dan", "Roma'ya", "Roma." vb. tetiklensin.
    const lowerNorm = normalizeText(text);
    const wordBoundaryMatch = (key) => {
        // Escape regex metakarakterleri
        const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Sınır: başta string-başı veya boşluk, sonda string-sonu veya boşluk/noktalama/apostrof/Türkçe ek başlangıcı
        // (Adım 4a) Öncesi de virgül/noktalama/tire/slash kabul. "bulgaria,burgas" → "burgas" tespit.
        const re = new RegExp(`(?:^|[\\s.,!?;:'‘’“”\\-/])${esc}(?:$|[\\s.,!?;:'‘’“”\\-/])`, 'i');
        return re.test(lowerNorm);
    };
    const sortedCities = [...cityToIata.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [city, iata] of sortedCities) {
        if (wordBoundaryMatch(city) && !seen.has(iata)) {
            seen.add(iata);
            result.airports.push(iata);
        }
    }

    // Şehir adı taraması (2): ambiguous tek-kelime → IATA'lardan biri zaten seen'daysa atla
    // (örn. "London Heathrow" zaten LHR'yi ekledi → "london" tek-kelime LGW'yi tetiklemesin)
    // Adım 4a: market'e göre EN BÜYÜĞÜNÜ seç + alternatives uyarısı (Seçenek C hibrit)
    const dl = window.dataLoader && window.dataLoader.isReady() ? window.dataLoader : null;
    for (const [word, iatas] of ambiguousCities) {
        if (!wordBoundaryMatch(word)) continue;
        if (iatas.some(i => seen.has(i))) continue;
        // Market DESC sırala (en büyük airport ilk)
        const sorted = dl
            ? [...iatas].sort((a, b) => {
                const apA = dl.getAirport(a);
                const apB = dl.getAirport(b);
                return ((apB && apB.market) || 0) - ((apA && apA.market) || 0);
            })
            : iatas;
        const chosen = sorted[0];
        seen.add(chosen);
        result.airports.push(chosen);
        // İlk uyarıyı sakla (birden fazla ambiguous şehir varsa sadece ilki — AI mesajı uzun olmasın)
        if (!result.ambiguousAirportNotice && sorted.length > 1) {
            result.ambiguousAirportNotice = {
                iata: chosen,
                city: word,
                alternatives: sorted.slice(1)
            };
        }
    }

    // TİP
    if (/\b(kargo|cargo|freight)\b/i.test(text)) result.planeType = 'cargo';
    else if (/\b(yolcu|passenger|pax)\b/i.test(text)) result.planeType = 'passenger';

    // SEFER SAYISI
    let tripsM = text.match(/g[üu]nde\s+(\d+)\s+sefer/i);
    if (!tripsM) tripsM = text.match(/(\d+)\s*sefer\s*\/\s*g[üu]n/i);
    if (!tripsM) tripsM = text.match(/(\d+)\s+sefer/i);
    if (tripsM) result.manualTrips = parseInt(tripsM[1], 10);

    // BOŞ HANGAR SLOT — "5 slot var", "3 boş slot", "4 hangar", "5 yer", "3 uçak yeri/kapasitesi/slotu"
    let slotsM = text.match(/(\d+)\s*(?:bo[şs]\s+)?(?:slot|yer|hangar)/i);
    if (!slotsM) slotsM = text.match(/(\d+)\s*u[çc]ak\s+(?:yeri|kapasitesi|slotu)/i);
    if (slotsM) result.availableSlots = parseInt(slotsM[1], 10);

    // Adım 4b — uçak için rota niyet tespiti (geniş kelime listesi, Türkçe morfoloji toleranslı)
    // Stratejik dengeler:
    //  - "uça" stem'inde yalnızca uçar/uçabilir/uçacak whitelist'i — "uçak" sözlük çakışmasını filtre
    //  - "kar" prefix'i normalize edilmiş metinde de yakalanır (kâr→kar)
    //  - "hat" → "hata" yanlış pozitifi kabul edilebilir (AND koşulu söndürür çoğunu)
    const ROUTE_INTENT_PATTERNS = [
        /\brota[a-zçğıöşü]*\b/i,            // rota, rotası, rotalar, rotada
        /\bk[âa]rl?[ıi]?\b/i,               // kâr, kar, karlı, karli
        /\bkazan[a-zçğıöşü]*\b/i,           // kazan, kazanç, kazanır
        /\bu[çc]a(?:r|bilir|cak)\b/i,       // uçar, uçabilir, uçacak (uçak HARİÇ)
        /\bnere(?:ye|den|de|ler)?\b/i,      // nereye, nereden, nerede
        /\b[öo]ner[a-zçğıöşü]*\b/i,         // öner, önerir, önerebilir
        /\btavsiye[a-zçğıöşü]*\b/i,
        /\bverim[a-zçğıöşü]*\b/i,           // verim, verimli, verimi
        /\bhat(?:t[ıaeu])?[a-zçğıöşü]*\b/i, // hat, hattı, hatta
        /\bkullan[a-zçğıöşü]*\b/i,          // kullan, kullanır, kullanılır
        /\balabilir\s+miyim\b/i,
    ];
    result.routeIntent = ROUTE_INTENT_PATTERNS.some(re => re.test(text));

    // Adım 4a NLU fallback: hâlâ airport yoksa, dataLoader.findAirportsByCity ile Levenshtein + ülke tespit
    // DİKKAT: Adım 4b geniş routeIntent listesi nedeniyle "uçar", "rota", "kar", "hat" gibi
    // intent kelimeleri Levenshtein eşik 2 ile yanlışlıkla şehir adlarına düzeltiliyordu
    // (örn "uçar" → "Ufa", 4 harf 2 fark). Bu yüzden routeIntent kelimelerini Levenshtein
    // aramasından önce skip ediyoruz. "burgaz → BOJ" gibi legitim yazım düzeltmeleri çalışır
    // (routeIntent kelimesi değiller, skip edilmezler).
    if (result.airports.length === 0 && dl) {
        // Mesajdaki >=4 harfli kelimeleri çıkar (sayı kombinasyonu hariç — uçak adı parçaları)
        const wordTokens = lowerNorm
            .split(/[\s.,!?;:'‘’“”\-/]+/)
            .filter(w => w.length >= 4 && !/\d/.test(w));
        const isRouteIntentToken = (token) => ROUTE_INTENT_PATTERNS.some(re => re.test(token));
        for (const w of wordTokens) {
            if (isRouteIntentToken(w)) continue; // Adım 4b yan etkisi: intent kelimesini Levenshtein'a verme
            if (PLANE_NAME_PARTS.has(w)) continue; // Adım 4b yan etkisi: uçak adı parçasını Levenshtein'a verme
            const found = dl.findAirportsByCity(w, { limit: 3, levenshtein: true });
            if (found.airports.length > 0) {
                const top = found.airports[0];
                result.airports.push(top.iata);
                if (found.levenshteinUsed) {
                    result.levenshteinAirportCorrection = {
                        typed: w, corrected: top.iata, city: top.name
                    };
                }
                if (found.airports.length > 1 && !result.ambiguousAirportNotice) {
                    result.ambiguousAirportNotice = {
                        iata: top.iata, city: top.name,
                        alternatives: found.airports.slice(1).map(a => a.iata)
                    };
                }
                break;  // ilk tespit yeterli
            }
        }

        // Ülke tespiti (sadece airport hâlâ yoksa) — Bulgaria, Türkiye, Germany vb.
        if (result.airports.length === 0) {
            const countryMatch = dl.findAirportsByCountry(text, { limit: 8 });
            if (countryMatch.country && countryMatch.airports.length > 0) {
                result.ambiguousCountry = {
                    country: countryMatch.country,
                    candidates: countryMatch.airports.map(a => a.iata)
                };
            }
        }
    }

    return result;
}

// Bütçe ve tipe göre filtreli uçak listesi (kompakt pipe formatı)
// Sıralama: en kârlı rotadaki günlük kâr DESC — slot kısıtlıyken AI'a "slot başına max kâr" mantığı sunmak için
function getCandidatePlanes(budget, type) {
    if (typeof aircraftData === 'undefined' || !budget) return '';
    const filtered = [];
    for (const name in aircraftData) {
        const p = aircraftData[name];
        if (p.price > budget) continue;
        if (type && p.type !== type) continue;

        // Tek uçak için en kârlı rotadaki günlük kâr
        let bestProfit = 0;
        if (typeof Logic !== 'undefined') {
            const topRoute = Logic.analyzeTopRoutesForPlane(name, 1);
            if (topRoute.length > 0) bestProfit = topRoute[0].dailyProfit;
        }

        filtered.push({ name, ...p, dailyProfit: bestProfit });
    }

    filtered.sort((a, b) => b.dailyProfit - a.dailyProfit);

    return filtered.slice(0, 30)
        .map(p => `${p.name}|${p.type}|${p.capacity}|${p.cruise_speed}|${p.fuel_consumption}|${p.range}|${p.price}|${Math.round(p.dailyProfit)}`)
        .join('\n');
}

// Belirli bir hub için bütçe/tip/slot uyumlu uçakların TOP rotalarını AI'a hazır pipe formatında verir.
// Her uçak için Logic.analyzeTopRoutesForPlane(name, 1, null, hubIata) çağrılır → o hub'tan en kârlı rota.
// Sonuç: 10 satır × ~80 karakter = ~1 KB ek context (AI'ya gerçek hub analizi).
function getHubAnalysisContext(hubIata, planeType, budget, slotsAvailable) {
    if (!hubIata || typeof aircraftData === 'undefined') return '';
    if (typeof Logic === 'undefined') return '';
    const dl = window.dataLoader;
    if (!dl || !dl.isReady()) return '';
    const hub = dl.getAirport(hubIata);
    if (!hub) return '';

    const candidates = [];
    for (const name in aircraftData) {
        const p = aircraftData[name];
        if (planeType && p.type !== planeType) continue;
        if (budget && p.price > budget) continue;
        // Top 5 rota al, ilk ≥500km olanı seç (ATR 42 → STN 66km gibi anlamsız "feeder" rotaları atla)
        const routes = Logic.analyzeTopRoutesForPlane(name, 5, null, hubIata);
        if (routes.length === 0) continue;
        const r = routes.find(rt => rt.distance >= 500) || routes[0];
        if (!r) continue;
        // Dual-code uyumlu regex: "(LIM / SPIM)" → LIM, "(LHR)" → LHR, "(EGMD)" → EGMD (iata=icao istisnası).
        const destIataMatch = r.destination.match(/\(([A-Z]{3,4})/);
        candidates.push({
            name,
            price: p.price,
            type: p.type,
            destIata: destIataMatch ? destIataMatch[1] : '?',
            distance: r.distance,
            dailyTrips: r.dailyTrips,
            dailyProfit: r.dailyProfit,
            efficiency: r.efficiency,
            paybackDays: r.dailyProfit > 0 ? Math.ceil(p.price / r.dailyProfit) : 9999
        });
    }

    if (candidates.length === 0) return '';

    let top;
    const headerExtras = [];
    if (slotsAvailable && budget) {
        // Filo bazlı: slot × adet bütçeye uyanlardan en yüksek toplam kâr
        const fleet = candidates.map(c => {
            const fleetSize = Math.min(slotsAvailable, Math.floor(budget / c.price));
            return { ...c, fleetSize, fleetProfit: c.dailyProfit * fleetSize };
        }).filter(c => c.fleetSize > 0)
          .sort((a, b) => b.fleetProfit - a.fleetProfit);
        top = fleet.slice(0, 10);
        headerExtras.push(`bütçe $${(budget/1e6).toFixed(0)}M`, `${slotsAvailable} slot`);
    } else {
        // Genel: günlük kâr (mutlak) öncelik, 50K aralığında verim tie-breaker
        // (ATR 42 %315 verimle $120K vs DC-10-10 %20 verimle $1.4M → DC-10 üstte)
        candidates.sort((a, b) => {
            if (Math.abs(a.dailyProfit - b.dailyProfit) > 50000) return b.dailyProfit - a.dailyProfit;
            return b.efficiency - a.efficiency;
        });
        top = candidates.slice(0, 10);
        if (budget) headerExtras.push(`bütçe $${(budget/1e6).toFixed(0)}M`);
    }

    const lines = top.map(p => {
        const fleetCol = ('fleetSize' in p) ? `|${p.fleetSize}adet→$${Math.round(p.fleetProfit/1e3)}K/g` : '';
        return `${p.name}|$${(p.price/1e6).toFixed(2)}M|→${p.destIata}|${p.distance}km|${p.dailyTrips}sefer|$${Math.round(p.dailyProfit/1e3)}K/g|%${p.efficiency.toFixed(1)}|${p.paybackDays}gün${fleetCol}`;
    });

    const headerStr = `${Utils.formatAirportCode(hub)} ${hub.name}, ${planeType || 'tüm'} uçaklar` + (headerExtras.length ? `, ${headerExtras.join(', ')}` : '');
    const colHeader = `Uçak|Fiyat|Hedef|Mesafe|Sefer|GünlükKâr|Verim|Payback${('fleetSize' in top[0]) ? '|FiloKâr' : ''}`;
    return `\nHUB ANALİZİ (${headerStr}):\n${colHeader}\n${lines.join('\n')}`;
}

// Havalimanı listesine göre filtreli rota listesi (kompakt pipe formatı, AI context için)
// Her airport için: o havalimanından çıkan top 20 rota (talep+demand bazlı)
function getRelevantRoutes(airports) {
    if (!airports || airports.length === 0) return '';
    const dl = window.dataLoader;
    if (!dl || !dl.isReady()) return '';

    const set = new Set(airports);
    const candidates = [];
    for (const iata of set) {
        const hub = dl.getAirport(iata);
        if (!hub) continue;
        for (const dest of dl.airports) {
            if (dest.iata === iata) continue;
            const dist = dl.getDistance(iata, dest.iata);
            if (dist == null || dist === 0) continue;
            const demand = dl.getDemand(iata, dest.iata);
            if (!demand) continue;
            const total = demand.y + demand.j + demand.f;
            candidates.push({
                origin: Utils.formatAirportLabel(hub),
                destination: Utils.formatAirportLabel(dest),
                distance: dist,
                demand,
                total
            });
        }
    }
    candidates.sort((a, b) => b.total - a.total);
    return candidates.slice(0, 20)
        .map(r => `${r.origin}|${r.destination}|${r.distance}|${r.demand.y}|${r.demand.j}|${r.demand.f}|${r.demand.l}`)
        .join('\n');
}

/**
 * Belirli bir uçak için TOP 10 rotayı pipe formatında AI'a verir (Adım 4b).
 *  - planeName: uçak adı (typoCorrection suffix'i otomatik temizlenir)
 *  - hubIata: cross-context'ten (Adım 2) veya effectiveAirports'tan; null ise top 5 hub global mod
 * Format: header (uçak fiyat type + hub) + 6 kolon × ≤10 satır.
 * Boş liste durumunda '' döner — worker.js halüsinasyon yasağı kuralı tetiklenir.
 */
function getPlaneRouteContext(planeName, hubIata) {
    if (!planeName || typeof aircraftData === 'undefined') return '';
    if (typeof Logic === 'undefined') return '';
    const dl = window.dataLoader;
    if (!dl || !dl.isReady()) return '';

    // Typo suffix temizliği (mentionedPlanes pattern'i, sendChatMessage line 1347 paraleli)
    const cleanName = planeName.replace(' (yazım düzeltildi)', '');
    const plane = aircraftData[cleanName];
    if (!plane) return '';

    const routes = Logic.analyzeTopRoutesForPlane(cleanName, 10, null, hubIata);
    if (routes.length === 0) return '';

    const lines = routes.map(r => {
        // origin/destination Utils.formatAirportLabel → "Heathrow Airport (LHR / EGLL), United Kingdom"
        // IATA çıkar (Adım 2 line 1305 regex'i ile aynı)
        const originIata = (r.origin.match(/\(([A-Z]{3})/) || [])[1] || '?';
        const destIata = (r.destination.match(/\(([A-Z]{3})/) || [])[1] || '?';
        const paybackDays = r.dailyProfit > 0 ? Math.ceil(plane.price / r.dailyProfit) : 9999;
        return `${originIata}→${destIata}|${r.distance}km|${r.dailyTrips}sefer|$${Math.round(r.dailyProfit/1e3)}K/g|%${r.efficiency.toFixed(2)}|${paybackDays}gün`;
    });

    const hubInfo = hubIata ? `hub: ${hubIata}` : 'top 5 hub global';
    const header = `${cleanName} ($${(plane.price/1e6).toFixed(2)}M, ${plane.type}), ${hubInfo}`;
    const colHeader = `Rota|Mesafe|Sefer|GünlükKâr|Verim|Payback`;
    return `\nUÇAK ROTA ÖNERİLERİ (${header}):\n${colHeader}\n${lines.join('\n')}`;
}

const UI = {
    /**
     * AI yanıtını sohbet history'sine kaydeder. Bütçe/rota AI butonlarından sonra çağrılır.
     * - sessionStorage'a [user, model] turn ekler → sohbet açıldığında AI bağlamı görür
     * - Sohbet AÇIKSA DOM'a da ekler (anlık görünür)
     * - Sohbet KAPALIYSA sadece storage'a yazar (kullanıcı sonra açtığında okur)
     */
    _persistAiToChatHistory: function(userMessage, aiText) {
        if (!userMessage || !aiText) return;
        try {
            const key = (window.Chat && Chat.STORAGE_KEY) || 'menoa_chat_history';
            const history = JSON.parse(sessionStorage.getItem(key) || '[]');
            history.push({ role: 'user', parts: [{ text: userMessage }] });
            history.push({ role: 'model', parts: [{ text: aiText }] });
            sessionStorage.setItem(key, JSON.stringify(history));

            const chatWindow = document.getElementById('chat-window');
            if (chatWindow && !chatWindow.classList.contains('chat-hidden') && window.Chat && Chat.addMessage) {
                Chat.addMessage(userMessage, 'user');
                Chat.addMessage(aiText, 'ai');
            }
        } catch (e) {
            console.warn('[UI] Chat history kaydı başarısız:', e);
        }
    },

    /**
     * Yakıt + CO₂ + Cost Index input'larını okur, window globaline yazar, localStorage'a kaydeder.
     * logic.js getFuelPrice/getCO2Price/getCostIndex'i bu globalleri okur.
     */
    applyEconomySettings: function() {
        const fuelInput = document.getElementById('fuelPriceInput');
        const co2Input = document.getElementById('co2PriceInput');
        const ciInput = document.getElementById('costIndexInput');
        const fuelStr = fuelInput?.value?.trim();
        const co2Str = co2Input?.value?.trim();
        const ciStr = ciInput?.value?.trim();
        const fuelRaw = Number(fuelStr);
        const co2Raw = Number(co2Str);
        const ciRaw = Number(ciStr);
        // Boş string ('') falsy → default'a düşer. Number('') === 0 olduğu için sadece range check yetmez.
        const fuel = (fuelStr && fuelRaw > 0 && fuelRaw < 5000) ? fuelRaw : 950;
        const co2 = (co2Str && co2Raw > 0 && co2Raw < 1000) ? co2Raw : 150;
        const ci = (ciStr && ciRaw >= 0 && ciRaw <= 500) ? ciRaw : 200;
        window.FUEL_PRICE = fuel;
        window.CO2_PRICE = co2;
        window.COST_INDEX = ci;
        try {
            if (fuelInput?.value) localStorage.setItem('menoa_fuel_price', fuel);
            else localStorage.removeItem('menoa_fuel_price');
            if (co2Input?.value) localStorage.setItem('menoa_co2_price', co2);
            else localStorage.removeItem('menoa_co2_price');
            if (ciInput?.value !== '') localStorage.setItem('menoa_cost_index', ci);
            else localStorage.removeItem('menoa_cost_index');
        } catch (e) { /* private mode */ }

        const hint = document.getElementById('economyHint');
        if (hint) {
            const isDefault = (fuel === 950 && co2 === 150 && ci === 200);
            hint.textContent = isDefault
                ? 'Boş bırakırsan varsayılan: Yakıt $950/1000lbs, CO₂ $150/1000, CI 200. Ortalama olarak satın alımda kullandığınız değerleri girin.'
                : `Aktif: Yakıt $${fuel}/1000lbs, CO₂ $${co2}/1000, CI ${ci}. Hesaplamalar bu değerlerle yapılır.`;
            hint.className = isDefault ? 'status-box status-neutral' : 'status-box status-success';
        }
    },

    /**
     * Sayfa değiştirme ve navigasyon yönetimi.
     */
    showPage: function(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(id);
        if (targetPage) targetPage.classList.add('active');
        
        UI.closeAllDropdowns();
        
        // Rota sayfaları açıldığında listeleri tazele
        if (id && id.includes('route')) {
            UI.fillSelects();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Açılır menü (Dropdown) kontrolü.
     */
    toggleDropdown: function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const isOpen = el.classList.contains('open');
        UI.closeAllDropdowns();
        if (!isOpen) el.classList.add('open');
    },

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    /**
     * Oyun modunu (Easy/Realism) ayarlar.
     */
    setGameMode: function(mode) {
        window.gameMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        
        const activeBtnId = mode === 'easy' ? 'btn-easy' : 'id-real';
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) activeBtn.classList.add('active');
        
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = "Aktif Mod: " + (mode === 'easy' ? "Easy (4x hız)" : "Realism (Standart)");
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }
    },

    /**
     * Hub autocomplete datalist'i — dataLoader.airports (3907 havalimanı) ile dolar.
     * dataLoader hazır olmadan çağrılırsa boş kalır; load().then() tekrar çağırır.
     */
    populateAirportList: function() {
        const datalist = document.getElementById('airportList');
        if (!datalist) return;
        if (!window.dataLoader || !window.dataLoader.isReady()) {
            datalist.innerHTML = '';
            return;
        }
        const fragment = document.createDocumentFragment();
        for (const a of window.dataLoader.airports) {
            const opt = document.createElement('option');
            // Dual-code: "Lima (LIM / SPIM), Perú" — substring match hem IATA hem ICAO'yu yakalar.
            // (Native datalist iki-satır custom HTML desteklemediği için tek satır içerikli format
            //  kullanıyoruz; gerçek iki-satır am4-cc paraleli için custom dropdown gerekir — ileride.)
            opt.value = Utils.formatAirportLabel(a);
            fragment.appendChild(opt);
        }
        datalist.innerHTML = '';
        datalist.appendChild(fragment);
    },

    /**
     * KNOWN_IATA + cityToIata + ambiguousCities haritalarını dataLoader.airports'tan inşa eder.
     * dataLoader.load().then() içinde çağrılır. resolveHub bu haritaları kullanır.
     */
    rebuildIndex: function() {
        if (!window.dataLoader || !window.dataLoader.isReady()) return;
        KNOWN_IATA.clear();
        cityToIata.clear();
        ambiguousCities.clear();

        // Türkçe yaygın 3-5 harfli kelimeler — havalimanı ismiyle çakışmasın
        // (örn. Rota Island airport → "rota" key, "rota nedir?" mesajında FP)
        const TURKISH_STOPWORDS = new Set([
            'rota', 'ucak', 'kar', 'yer', 'fiyat', 'gun', 'yol', 'iste',
            'gibi', 'olur', 'belki', 'ucuz', 'pahali', 'yeni', 'eski',
            'iyi', 'kotu', 'tum', 'her', 'bazi', 'bircok', 'cesitli'
        ]);

        const wordToIatas = new Map();
        const entries = [];
        for (const ap of window.dataLoader.airports) {
            KNOWN_IATA.add(ap.iata);
            const fullCity = normalizeText(ap.name);
            const words = fullCity.split(/\s+/);
            entries.push({ fullCity, words, iata: ap.iata });
            const w0 = words[0];
            if (w0 && w0.length >= 4) {
                if (!wordToIatas.has(w0)) wordToIatas.set(w0, new Set());
                wordToIatas.get(w0).add(ap.iata);
            }
        }

        for (const { fullCity, words, iata } of entries) {
            if (TURKISH_STOPWORDS.has(fullCity)) continue;
            if (fullCity.length >= 3 && !cityToIata.has(fullCity)) cityToIata.set(fullCity, iata);
            if (words.length >= 2) {
                const twoWord = words.slice(0, 2).join(' ');
                if (twoWord.length >= 6 && !cityToIata.has(twoWord)) cityToIata.set(twoWord, iata);
            }
        }

        for (const [word, iataSet] of wordToIatas) {
            if (TURKISH_STOPWORDS.has(word)) continue;  // 'rota' → ROP eklenmesin
            const iatas = [...iataSet];
            if (iatas.length === 1) {
                if (!cityToIata.has(word)) cityToIata.set(word, iatas[0]);
            } else {
                ambiguousCities.set(word, iatas);
            }
        }

        // Türkçe alias'lar (sadece IATA whitelist'te varsa, ambiguous'u override eder)
        const TURKISH_ALIASES = {
            'londra': 'LHR', 'paris': 'CDG', 'roma': 'FCO', 'pekin': 'PEK',
            'sangay': 'PVG', 'tokyo': 'NRT', 'moskova': 'SVO', 'atina': 'ATH',
            'amsterdam': 'AMS', 'berlin': 'BER', 'viyana': 'VIE', 'kahire': 'CAI',
            'istanbul': 'ISL', 'ankara': 'ESB', 'izmir': 'ADB', 'antalya': 'AYT'  // ISL = İstanbul Atatürk (parquet 2018 baz, IST yok)
        };
        for (const alias in TURKISH_ALIASES) {
            const iata = TURKISH_ALIASES[alias];
            if (KNOWN_IATA.has(iata)) {
                cityToIata.set(alias, iata);
                ambiguousCities.delete(alias);
            }
        }
    },

    /**
     * Hub input'unu IATA koduna çözer.
     * Sıralama: datalist tam string → IATA upper (KNOWN + dataLoader) → routes.js cityToIata
     *           → uzun-içeren → ambiguous → dataLoader.airports name match (3907)
     */
    resolveHub: function(input) {
        if (!input || !input.trim()) return null;
        const trimmed = input.trim();
        const dl = (window.dataLoader && window.dataLoader.isReady()) ? window.dataLoader : null;

        // 0. Datalist tam string match: "X (LIM / SPIM), Y" veya "X (LHR), Y" veya "X (EGMD), Y" → IATA.
        //    Dual-code: ilk grup IATA-tercih (3 harf), ikinci grup ICAO (varsa 4 harf, slash ile ayrılı).
        //    iata=icao istisnası (Lydd EGMD, Charlotte Amalie TIST): tek 4-harf grup; resolveIata ICAO fallback ile çözer.
        const datalistMatch = trimmed.match(/\(([A-Z]{3,4})(?:\s*\/\s*([A-Z]{3,4}))?\)/);
        if (datalistMatch) {
            const code = datalistMatch[1];
            if (KNOWN_IATA.has(code)) return code;
            if (dl && dl.iataToId.has(code)) return code;
            // 4-harf code (Lydd vb): resolveIata ile ICAO-fallback dene
            if (dl && dl.resolveIata) {
                const resolved = dl.resolveIata(code);
                if (resolved) return resolved;
            }
        }

        // 1. ALL-CAPS 3-4 letter direkt kod (IATA tercih, ICAO fallback resolveIata içinde)
        const upper = trimmed.toUpperCase();
        if (/^[A-Z]{3,4}$/.test(upper)) {
            if (KNOWN_IATA.has(upper)) return upper;
            if (dl) {
                if (dl.iataToId.has(upper)) return upper;
                // Eski/yeni IATA alias (IST→ISL, TXL→BER, SXF→BER) + ICAO fallback (SPIM→LIM, KILN→ILN)
                if (dl.resolveIata) {
                    const aliased = dl.resolveIata(upper);
                    if (aliased) return aliased;
                }
            }
        }

        // 2. routes.js cityToIata — popüler 156 şehir alias'ı (Londra/Pekin/...)
        const norm = normalizeText(trimmed);
        if (cityToIata.has(norm)) return cityToIata.get(norm);

        // 3. İçinde geçen (uzun-önce)
        const sorted = [...cityToIata.entries()].sort((a, b) => b[0].length - a[0].length);
        for (const [city, iata] of sorted) {
            if (norm.includes(city)) return iata;
        }

        // 4. Ambiguous şehir
        if (ambiguousCities.has(norm)) return ambiguousCities.get(norm)[0];

        // 5. dataLoader.airports name/fullname/country match — 3907 havalimanı
        if (dl) {
            // Önce tam name eşleşme
            for (const ap of dl.airports) {
                if (normalizeText(ap.name) === norm) return ap.iata;
            }
            // Sonra includes (örn "Istanbul" → "Istanbul Ataturk International")
            for (const ap of dl.airports) {
                const apNorm = normalizeText(ap.name);
                if (apNorm.includes(norm) || (norm.length >= 4 && norm.includes(apNorm))) return ap.iata;
            }
        }

        return null;
    },

    /**
     * Uçak seçim kutularını verilerle doldurur.
     */
    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');
        
        if (paxSelect) {
            paxSelect.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let name in aircraftData) {
                if (aircraftData[name].type === "passenger") paxSelect.add(new Option(name, name));
            }
        }
        
        if (cargoSelect) {
            cargoSelect.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let name in aircraftData) {
                if (aircraftData[name].type === "cargo") cargoSelect.add(new Option(name, name));
            }
        }
    },

    /**
     * Daktilo (Typewriter) Efekti: Metni karakter karakter ekrana basar.
     */
    typeEffect: function(element, text, speed = 10) {
        if (!element) return;
        let i = 0;
        element.innerHTML = "";
        const timer = setInterval(() => {
            if (i < text.length) {
                element.innerHTML += text.charAt(i) === "\n" ? "<br>" : text.charAt(i);
                i++;
                // Chat penceresi için otomatik aşağı kaydırma
                const chatBody = document.getElementById('chat-body');
                if (chatBody && element.closest('#chat-body')) {
                    chatBody.scrollTop = chatBody.scrollHeight;
                }
            } else {
                clearInterval(timer);
            }
        }, speed);
    },

    /**
     * Gemini AI'dan rota analizi talep eder.
     * Rota analizi geçmişe eklenmez (tek seferlik teknik sorgu).
     */
    askGemini: async function(planeName, routeData) {
        const workerUrl = "https://ai.airm4.workers.dev/";
        const resultArea = document.getElementById('aiResultArea');
        if (!resultArea) return;

        resultArea.innerHTML = `
            <div id="aiLoader">
                <span>🤖 MENOA Stratejileri Analiz Ediyor</span>
                <div class="loader-dots"><span></span><span></span><span></span></div>
            </div>`;

        // HEMEN scroll: loader gösterildiği anda tetikle, kullanıcı çalıştığını görsün.
        // Sticky navbar için 90px tampon. requestAnimationFrame: loader DOM'a yazıldıktan sonra
        // doğru pozisyon hesabı (innerHTML değişiminin frame'i tamamlanmış olur).
        requestAnimationFrame(() => {
            const targetY = resultArea.getBoundingClientRect().top + window.pageYOffset - 90;
            window.scrollTo({ top: targetY, behavior: 'smooth' });
        });

        const plane = aircraftData[planeName];
        const planeData = plane ? [{
            name: planeName,
            type: plane.type,
            capacity: plane.capacity,
            cruise_speed: plane.cruise_speed,
            fuel_consumption: plane.fuel_consumption,
            range: plane.range,
            price: plane.price,
            check_cost: plane.check_cost,  // Fix #3 — A-check sabit maliyet
            maint: plane.maint,            // Fix #3 — A-check arası saat
            co2: plane.co2                 // Fix #7 — CO₂ emisyon katsayısı
        }] : [];

        // Tam bağlam — AI "yaklaşık bin gün" gibi belirsiz konuşmasın diye kesin sayılar
        const optConfig = plane && (plane.type === 'cargo'
            ? Configurator.calculateOptimalCargo(plane, routeData, routeData.dailyTrips)
            : Configurator.calculateOptimalSeats(plane, routeData, routeData.dailyTrips));
        const totalLoad = !optConfig ? 0
            : (plane.type === 'cargo' ? (optConfig.l + optConfig.h) : (optConfig.y + optConfig.j * 2 + optConfig.f * 3));
        const fillRatio = (plane && plane.capacity) ? ((totalLoad / plane.capacity) * 100).toFixed(1) : '0';
        const profitPerFlight = routeData.dailyTrips ? routeData.dailyProfit / routeData.dailyTrips : 0;
        const paybackDays = (plane && routeData.dailyProfit > 0) ? Math.ceil(plane.price / routeData.dailyProfit) : 9999;
        const optimalConfigStr = !optConfig ? ''
            : (plane.type === 'cargo' ? `L:${optConfig.l} H:${optConfig.h}` : `Y:${optConfig.y} J:${optConfig.j} F:${optConfig.f}`);

        // Sefer başı gider breakdown'ı yeniden hesapla (fuel + maintenance + co2 ayrı kalemler).
        // r.costPerFlight / r.revenuePerFlight Logic._evalRoute'tan gelir ama fuel/maintenance/co2
        // ayrımı yok; calculateProfit doğrudan çağırıp breakdown field'larını alıyoruz.
        const calcBreakdown = plane
            ? Logic.calculateProfit(plane, routeData, null, routeData.dailyTrips)
            : null;
        const breakdown = calcBreakdown ? {
            fuelCost: calcBreakdown.fuelCost,
            maintenanceCost: calcBreakdown.maintenanceCost,
            co2Cost: calcBreakdown.co2Cost
        } : null;

        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plane: planeName,
                    route: `${routeData.origin} ➔ ${routeData.destination}`,
                    profit: Utils.formatCurrency(routeData.dailyProfit),
                    distance: routeData.distance,
                    efficiency: Utils.formatPercent(routeData.efficiency),
                    // Tam bağlam — AI'a kesin sayılar
                    dailyTrips: routeData.dailyTrips,
                    profitPerFlight: Utils.formatCurrency(profitPerFlight),
                    fillRatio: fillRatio + '%',
                    paybackDays: paybackDays,
                    optimalConfig: optimalConfigStr,
                    planePrice: plane ? Utils.formatCurrency(plane.price) : '',
                    breakdown: breakdown,  // Fix #7 — sefer başı fuel/maintenance/co2 ayrı kalemler
                    context: {
                        gameMode: window.gameMode || 'realism',
                        fuelPrice: window.FUEL_PRICE || 950,
                        co2Price: window.CO2_PRICE || 150,  // Fix #7 — AI prompt'a co2 fiyatı enjekte
                        costIndex: (window.COST_INDEX != null) ? window.COST_INDEX : 200,
                        planes: planeData
                    }
                })
            });
            const data = await response.json();
            const userMessage = `${planeName} uçağı ile ${routeData.origin} → ${routeData.destination} rotası (${routeData.distance} km) analizi`;
            this._persistAiToChatHistory(userMessage, data.text);

            // Cross-context için sessionStorage'a kaydet (Adım 2): chat follow-up'larında
            // "ÖNCEKİ ANALİZ" bloğu olarak worker prompt'a otomatik enjekte edilecek.
            // 30 dk expire (sendChatMessage tarafında kontrol).
            try {
                const lastAnalysis = {
                    timestamp: Date.now(),
                    plane: plane ? {
                        name: planeName,
                        type: plane.type,
                        capacity: plane.capacity,
                        cruise_speed: plane.cruise_speed,
                        fuel_consumption: plane.fuel_consumption,
                        range: plane.range,
                        price: plane.price,
                        check_cost: plane.check_cost,
                        maint: plane.maint,
                        co2: plane.co2
                    } : null,
                    route: {
                        origin: routeData.origin,
                        destination: routeData.destination,
                        distance: routeData.distance
                    },
                    demand: routeData.demand || {},
                    metrics: {
                        profit: routeData.dailyProfit,
                        profitPerFlight: profitPerFlight,
                        dailyTrips: routeData.dailyTrips,
                        fillRatio: fillRatio + '%',
                        paybackDays: paybackDays,
                        efficiency: routeData.efficiency
                    },
                    optimalConfig: optConfig || null,
                    breakdown: breakdown || null,
                    gameMode: window.gameMode || 'realism',
                    fuelPrice: window.FUEL_PRICE || 950,
                    co2Price: window.CO2_PRICE || 150,
                    costIndex: (window.COST_INDEX != null) ? window.COST_INDEX : 200
                };
                sessionStorage.setItem('menoa_last_analysis', JSON.stringify(lastAnalysis));
            } catch (e) { /* sessionStorage quota / private mode — sessizce geç */ }

            resultArea.innerHTML = `
                <div class="ai-report-card">
                    <h4 style="color:var(--primary); margin-bottom:10px;">🤖 MENOA AI ANALİZİ</h4>
                    <div id="typingArea" style="font-size:0.9rem; line-height:1.6;"></div>
                </div>`;

            this.typeEffect(document.getElementById('typingArea'), data.text);
            // Scroll YOK — yukarıda loader render anında zaten doğru pozisyona scroll edildi

        } catch (error) {
            resultArea.innerHTML = `<div class="status-box status-danger">Hata: ${error.message}</div>`;
        }
    },

    /**
     * Bütçeye göre en iyi uçakları ve tam rotalarını listeler.
     */
    renderSuggestions: function(cat) {
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        // dataLoader hazır değilse: bekleme mesajı + auto-retry (2 dk timeout)
        if (!window.dataLoader || !window.dataLoader.isReady()) {
            if (resultDiv) {
                resultDiv.innerHTML = `<div class="status-box status-info">
                    <strong>📊 Rota verisi yükleniyor...</strong><br>
                    İlk ziyaretinizde 47 MB veri indiriliyor (yavaş bağlantıda 1 dakika sürebilir).<br>
                    Veri hazır olunca öneriler otomatik gösterilecek.
                </div>`;
            }
            const startTime = Date.now();
            const ci = setInterval(() => {
                if (window.dataLoader && window.dataLoader.isReady()) {
                    clearInterval(ci);
                    this.renderSuggestions(cat);
                } else if (Date.now() - startTime > 120000) {
                    clearInterval(ci);
                    if (resultDiv) resultDiv.innerHTML = '<div class="status-box status-danger">Veri yüklenemedi (2 dakika geçti). Sayfayı yenileyin veya bağlantınızı kontrol edin.</div>';
                }
            }, 500);
            return;
        }

        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const tripsInput = document.getElementById(cat + 'TripsInput');
        const slotsInput = document.getElementById(cat + 'SlotsInput');
        const budget = Number(budgetInput?.value);
        const manualTrips = tripsInput?.value ? Number(tripsInput.value) : null;
        const availableSlots = slotsInput?.value ? Number(slotsInput.value) : 3;
        if (!budget || budget <= 0) {
            if (resultDiv) resultDiv.innerHTML = '<div class="status-box status-danger">Lütfen geçerli bir bütçe giriniz.</div>';
            return;
        }

        const bestPlanes = Logic.getBestPlanesByType(budget, cat === 'pax' ? 'passenger' : 'cargo', manualTrips, availableSlots);

        if (bestPlanes.length === 0) {
            resultDiv.innerHTML = '<div class="status-box status-neutral">Bu bütçeye uygun uçak bulunamadı.</div>';
            return;
        }

        const efficiencyLabels = {
            1.0: 'Tam verim — 1-3 uçak, talep dolmuyor',
            0.8: '0.8x — 4-10 uçak, talep biraz paylaşılıyor',
            0.6: '0.6x — 11-20 uçak, birden fazla rota gerekebilir',
            0.4: '0.4x — 21-30 uçak, talep tamamen doluyor'
        };

        const slotBanner = `
            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px; padding:8px 12px; background:var(--neutral-bg); border-radius:8px;">
                ${availableSlots} boş slot için sıralı öneri
            </div>`;

        const planeCards = bestPlanes.map(p => `
            <div class="plane-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.name}</strong>
                    <span style="color:var(--primary); font-weight:800;">
                        ${Utils.formatPercent(p.efficiency)} Verim
                        <span style="font-weight:400; font-size:0.78rem; color:var(--text-muted);">
                            (~${Math.ceil(100 / p.efficiency)} gün payback)
                        </span>
                    </span>
                </div>
                <div style="font-size:0.8rem; margin-top:5px; color:var(--text-muted);">
                    Fiyat: ${Utils.formatCurrency(p.price)} | Günde ${p.dailyTrips} sefer | Tek uçak günlük kâr: ${Utils.formatCurrency(Math.round(p.dailyProfit))}
                </div>
                <div style="font-size:0.88rem; margin-top:6px; color:var(--success); font-weight:700;">
                    Önerilen: ${p.fleetSize} tane satın al → Toplam günlük kâr: ${Utils.formatCurrency(Math.round(p.totalDailyProfit))}
                </div>
                <div style="font-size:0.78rem; margin-top:4px; color:var(--text-muted);">
                    Filo verimi: ${efficiencyLabels[p.fleetEfficiency]}
                </div>
                <small style="color:var(--success); font-weight:600; display:block; margin-top:5px;">
                    En Karlı Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}
                </small>
            </div>
        `).join('');

        // AI butonu LİSTENİN ÜSTÜNDE — kullanıcı 1200px scroll etmek zorunda kalmasın
        const aiSection = `
            <div class="budget-ai-section budget-ai-section-top">
                <button class="ai-budget-btn" onclick="UI.askGeminiForBudget('${cat}')">
                    🤖 AI ile Stratejik Yorum Al
                </button>
                <div id="${cat}AiResult"></div>
            </div>
            <h3 style="margin: 24px 0 16px 0; font-size: 1.1rem;">${bestPlanes.length} uçak bulundu (verim sırasına göre):</h3>`;
        resultDiv.innerHTML = slotBanner + aiSection + planeCards;
    },

    /**
     * Bütçe sayfası için AI stratejik yorum — top 10 plane listesini Worker'a gönderir,
     * AI hangi uçaktan kaç adet alınacağı + neden + alternatif yorumlar.
     */
    askGeminiForBudget: async function(cat) {
        const workerUrl = "https://ai.airm4.workers.dev/";
        const resultArea = document.getElementById(cat + 'AiResult');
        if (!resultArea) return;

        const budget = Number(document.getElementById(cat + 'BudgetInput')?.value);
        const slotsInput = document.getElementById(cat + 'SlotsInput');
        const tripsInput = document.getElementById(cat + 'TripsInput');
        const slots = slotsInput?.value ? Number(slotsInput.value) : 3;
        const trips = tripsInput?.value ? Number(tripsInput.value) : null;
        const planeType = cat === 'pax' ? 'passenger' : 'cargo';

        if (!budget || budget <= 0) {
            resultArea.innerHTML = '<div class="status-box status-danger">Önce geçerli bir bütçe gir, sonra "Bul" tıkla.</div>';
            return;
        }

        const bestPlanes = Logic.getBestPlanesByType(budget, planeType, trips, slots);
        if (bestPlanes.length === 0) {
            resultArea.innerHTML = '<div class="status-box status-neutral">Bu bütçeye uygun uçak yok, AI yorumu yapılamadı.</div>';
            return;
        }

        // Loader + anında scroll (askGemini ile aynı pattern)
        resultArea.innerHTML = `
            <div id="aiLoader">
                <span>🤖 MENOA Stratejik Analiz Yapıyor</span>
                <div class="loader-dots"><span></span><span></span><span></span></div>
            </div>`;
        requestAnimationFrame(() => {
            const targetY = resultArea.getBoundingClientRect().top + window.pageYOffset - 90;
            window.scrollTo({ top: targetY, behavior: 'smooth' });
        });

        // Top 10 listeyi worker.js'in beklediği pipe formata çevir — sıra numarası AI'a "1. sıradaki" demesine olanak verir
        const candidatesText = bestPlanes.map((p, i) => {
            const plane = aircraftData[p.name];
            return `#${i+1}|${p.name}|${plane.type}|${plane.capacity}|${plane.cruise_speed}|${plane.fuel_consumption}|${plane.range}|${plane.price}|${Math.round(p.dailyProfit)}`;
        }).join('\n');

        const userMessage = `Bütçem $${budget.toLocaleString('en-US')}, ${slots} boş slot, ${planeType === 'passenger' ? 'yolcu' : 'kargo'} uçağı arıyorum. Sayfa hesabı bana ADAY UÇAKLAR listesini verdi (top 10, daily_profit'e göre sıralı). Hangi uçaklardan kaç adet alayım, neden? Stratejik analiz yap.`;

        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatMessage: userMessage,
                    history: [],
                    context: {
                        gameMode: window.gameMode || 'realism',
                        fuelPrice: window.FUEL_PRICE || 950,
                        co2Price: window.CO2_PRICE || 150,  // Fix #7 — AI prompt'a co2 fiyatı enjekte
                        costIndex: (window.COST_INDEX != null) ? window.COST_INDEX : 200,
                        availableSlots: slots,
                        planeType: planeType,
                        budget: budget,
                        candidatePlanes: candidatesText
                    }
                })
            });
            const data = await response.json();
            this._persistAiToChatHistory(userMessage, data.text);

            resultArea.innerHTML = `
                <div class="ai-report-card">
                    <h4 style="color:var(--primary); margin-bottom:10px;">🤖 MENOA AI STRATEJİK ANALİZ</h4>
                    <div id="${cat}TypingArea" style="font-size:0.9rem; line-height:1.6;"></div>
                </div>`;
            this.typeEffect(document.getElementById(cat + 'TypingArea'), data.text || 'Yanıt alınamadı.');
        } catch (error) {
            resultArea.innerHTML = `<div class="status-box status-danger">Hata: ${error.message}</div>`;
        }
    },

    /**
     * Seçilen uçak için rota seçeneklerini listeler.
     */
    renderRouteAnalysis: function(cat) {
        const selectId = cat === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
        const resultId = cat === 'pax' ? 'paxRouteResult' : 'cargoRouteResult';
        const tripsInputId = cat === 'pax' ? 'paxRouteTripsInput' : 'cargoRouteTripsInput';
        const hubInputId = cat === 'pax' ? 'paxHubInput' : 'cargoHubInput';
        const hubInfoId = cat === 'pax' ? 'paxHubInfo' : 'cargoHubInfo';
        const planeName = document.getElementById(selectId)?.value;
        const resultDiv = document.getElementById(resultId);

        // dataLoader hazır değilse: bekleme mesajı + auto-retry (2 dk timeout)
        if (planeName && (!window.dataLoader || !window.dataLoader.isReady())) {
            if (resultDiv) {
                resultDiv.innerHTML = `<div class="status-box status-info">
                    <strong>📊 Rota verisi yükleniyor...</strong><br>
                    İlk ziyaretinizde 47 MB veri indiriliyor (yavaş bağlantıda 1 dakika sürebilir).<br>
                    Veri hazır olunca analiz otomatik gösterilecek.
                </div>`;
            }
            const startTime = Date.now();
            const ci = setInterval(() => {
                if (window.dataLoader && window.dataLoader.isReady()) {
                    clearInterval(ci);
                    this.renderRouteAnalysis(cat);
                } else if (Date.now() - startTime > 120000) {
                    clearInterval(ci);
                    if (resultDiv) resultDiv.innerHTML = '<div class="status-box status-danger">Veri yüklenemedi (2 dakika geçti). Sayfayı yenileyin.</div>';
                }
            }, 500);
            return;
        }
        const tripsInput = document.getElementById(tripsInputId);
        const manualTrips = tripsInput?.value ? Number(tripsInput.value) : null;
        const hubText = document.getElementById(hubInputId)?.value;
        const hubIata = this.resolveHub(hubText);
        const hubInfoDiv = document.getElementById(hubInfoId);

        if (!planeName) return;

        if (hubText && hubText.trim()) {
            if (hubIata) {
                if (hubInfoDiv) hubInfoDiv.innerHTML = `✅ Hub: <strong>${hubIata}</strong> — sadece bu havalimanından kalkan rotalar gösteriliyor`;
            } else {
                if (hubInfoDiv) hubInfoDiv.innerHTML = `⚠️ "${hubText}" veritabanında yok — tüm rotalar gösteriliyor`;
            }
        } else {
            if (hubInfoDiv) hubInfoDiv.innerHTML = '';
        }

        resultDiv.innerHTML = `<div id="aiResultArea"></div><h3 style="margin: 20px 0 15px 0;">Kârlı Rota Seçenekleri</h3>`;
        // analyzeTopRoutesForPlane unified: hubIata varsa o hub'tan, yoksa global (top 30 hub) tarama
        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, manualTrips, hubIata);

        if (topRoutes.length === 0) {
            const msg = hubIata
                ? `${hubIata} hub'ından bu uçakla uçulabilecek rota bulunamadı (mesafe veya talep uyumsuz olabilir).`
                : `Bu uçak için kârlı rota bulunamadı.`;
            resultDiv.innerHTML += `<div class="status-box status-neutral">${msg}</div>`;
            return;
        }

        topRoutes.forEach((r, i) => {
            const card = document.createElement('div');
            card.className = 'route-card';
            
            const plane = aircraftData[planeName];
            // r.dailyTrips Logic._evalRoute'tan gelir; geçmemek UI gösterimi ile profit hesabı
            // arasında trip sayısı farkına yol açıyordu (Fix #2.7 senkron düzeltmesi).
            const opt = plane.type === 'passenger'
                ? Configurator.calculateOptimalSeats(plane, r, r.dailyTrips)
                : Configurator.calculateOptimalCargo(plane, r, r.dailyTrips);

            // Bilet fiyatları (autoprice + Easy/Realism otomatik) — sadece görsel, hesabı etkilemez.
            const tm = Configurator.getTicketMultipliers(r.distance);
            const ticketStr = plane.type === 'passenger'
                ? `BİLET: Y:$${Math.round(tm.y).toLocaleString('en-US')} J:$${Math.round(tm.j).toLocaleString('en-US')} F:$${Math.round(tm.f).toLocaleString('en-US')}`
                : `BİLET (1 lbs): L:$${tm.l.toFixed(2)} H:$${tm.h.toFixed(2)}`;

            card.innerHTML = `
                <div class="route-header">
                    <div class="route-info">
                        <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                        <small style="color:var(--secondary);">${r.distance} km | ${r.dailyTrips} Sefer / Gün</small>
                    </div>
                    <div class="route-stats">
                        <div class="efficiency-tag">Yatırım Verimi: ${Utils.formatPercent(r.efficiency)} (~${Math.ceil(100 / r.efficiency)} gün payback)</div>
                    </div>
                </div>
                <div class="route-breakdown">
                    <div class="revenue-line">+ Sefer başı gelir: ${Utils.formatCurrency(r.revenuePerFlight)}</div>
                    <div class="cost-line">− Sefer başı gider: ${Utils.formatCurrency(r.costPerFlight)}</div>
                    <div class="net-line">Sefer net: ${Utils.formatCurrency(r.dailyTrips ? r.dailyProfit / r.dailyTrips : 0)}</div>
                    <div class="revenue-line">+ Günlük gelir: ${Utils.formatCurrency(r.dailyRevenue)}</div>
                    <div class="cost-line">− Günlük gider: ${Utils.formatCurrency(r.dailyCost)}</div>
                    <div class="net-line">Günlük net: ${Utils.formatCurrency(r.dailyProfit)}</div>
                </div>
                <div class="suggestion-bar">
                    <div class="ideal-config">
                        İDEAL: ${cat === 'pax' ? `Y:${opt.y} J:${opt.j} F:${opt.f}` : `L:${opt.l} H:${opt.h}`}
                        <div class="ticket-line">${ticketStr}</div>
                    </div>
                    <div class="action-buttons">
                        <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/\"/g, '&quot;')})">🤖 AI</button>
                        <button class="apply-btn-small" onclick="Configurator.applySuggestion(${opt.y || opt.l}, ${opt.j || opt.h}, ${opt.f || 'null'})">Yükle</button>
                    </div>
                </div>
            `;
            resultDiv.appendChild(card);
        });
    }
};

// History'den eksik bilgileri (bütçe, slot, airports, planeType) son user mesajlarından geriye çıkarır
function findInHistory(history, type) {
    if (!history || history.length === 0) return null;
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role !== 'user') continue;
        const text = msg.parts?.[0]?.text || '';
        const ext = extractContextFromMessage(text);
        if (type === 'budget' && ext.budget) return ext.budget;
        if (type === 'slots' && ext.availableSlots) return ext.availableSlots;
        if (type === 'airports' && ext.airports.length > 0) return ext.airports;
        if (type === 'planeType' && ext.planeType) return ext.planeType;
    }
    return null;
}

/** --- AI SOHBET MODÜLÜ (CHAT) --- */
const Chat = {
    /** sessionStorage anahtarı */
    STORAGE_KEY: "menoa_chat_history",

    /**
     * Geçmişi temizler — sessionStorage + DOM + hoş geldin mesajı.
     */
    clearHistory: function() {
        if (!confirm('Sohbet geçmişini temizlemek istiyor musun? Bu işlem geri alınamaz.')) return;
        try { sessionStorage.removeItem(this.STORAGE_KEY); } catch (e) {}
        const body = document.getElementById('chat-body');
        if (body) body.innerHTML = '';
        setTimeout(() => {
            this.addMessage("Geçmiş temizlendi! Bugün filonu nasıl yönetelim?", "ai");
        }, 200);
    },

    /**
     * Sohbet geçmişini sessionStorage'dan yükler.
     * Gemini API formatında [{role, parts:[{text}]}] dizisi döner.
     */
    loadHistory: function() {
        try {
            const raw = sessionStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Güncellenmiş geçmişi sessionStorage'a kaydeder.
     */
    saveHistory: function(history) {
        try {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            // Storage dolu olabilir, sessizce geç
        }
    },

    /**
     * Sayfa yüklendiğinde önceki oturumun mesajlarını ekrana basar.
     * (Aynı sekmede sayfa yenilenirse geçmiş görünür, sekme kapanırsa sıfırlanır.)
     */
    restoreMessages: function() {
        const history = this.loadHistory();
        if (history.length === 0) return;

        history.forEach(turn => {
            const sender = turn.role === "model" ? "ai" : "user";
            const text = turn.parts?.[0]?.text || "";
            this._appendMessage(text, sender, false); // typeEffect olmadan hızlı yükle
        });
    },

    toggle: function() {
        const win = document.getElementById('chat-window');
        if (win) {
            win.classList.toggle('chat-hidden');
            if (!win.classList.contains('chat-hidden')) {
                document.getElementById('chatInput')?.focus();
                // Scroll en alta
                const chatBody = document.getElementById('chat-body');
                if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
            }
        }
    },

    /**
     * Mesajı DOM'a ekler.
     * @param {string} text - Mesaj metni
     * @param {string} sender - 'ai' veya 'user'
     * @param {boolean} animate - AI mesajı için daktilo efekti kullanılsın mı
     */
    _appendMessage: function(text, sender, animate = true) {
        const body = document.getElementById('chat-body');
        if (!body) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}-msg`;
        body.appendChild(msgDiv);

        if (sender === 'ai' && animate) {
            UI.typeEffect(msgDiv, text, 12);
        } else {
            msgDiv.innerText = text;
            body.scrollTop = body.scrollHeight;
        }
    },

    /** Dışarıdan çağrılabilen addMessage (splash mesajı için) */
    addMessage: function(text, sender) {
        this._appendMessage(text, sender, sender === 'ai');
    },

    send: async function() {
        const input = document.getElementById('chatInput');
        const text = input?.value.trim();
        if (!text) return;

        // Mesajda geçen uçakları tespit et (yazım toleranslı)
        const mentionedPlanes = [];
        const textNormalized = text.toLowerCase().replace(/[\s\-_]/g, '');

        // Kandidatları çıkar: boşluktan böl, bireysel tokenlar + bitişik ikili birleşimler (bigram)
        // Bigram sayesinde "B373 100" → "b373100" kandidatı oluşur, boşluklu yazım da yakalanır
        const rawParts = text.toLowerCase().split(/\s+/).map(t => t.replace(/[\-_]/g, ''));
        const candidateSet = new Set();
        for (let i = 0; i < rawParts.length; i++) {
            const t = rawParts[i];
            if (t.length >= 3 && /[a-z]/.test(t) && /[0-9]/.test(t)) candidateSet.add(t);
            if (i + 1 < rawParts.length) {
                const bigram = t + rawParts[i + 1];
                if (bigram.length >= 4 && bigram.length <= 10 && /[a-z]/.test(bigram) && /[0-9]/.test(bigram)) candidateSet.add(bigram);
            }
        }
        const candidates = Array.from(candidateSet);

        // Harf/rakam pozisyon kalıbı eşleşme kontrolü: "a320" vs "an10" yanlış eşleşmesini önler
        function sameLetterDigitPattern(a, b) {
            const len = Math.min(a.length, b.length);
            for (let i = 0; i < len; i++) {
                if ((/[a-z]/.test(a[i])) !== (/[a-z]/.test(b[i]))) return false;
            }
            return true;
        }

        if (typeof aircraftData !== 'undefined') {
            // 1. Aşama: tam eşleşmeler (saf rakam isimler atlanır)
            const exactMatchedCandidates = new Set();
            for (let name in aircraftData) {
                const nameNorm = name.toLowerCase().replace(/[\s\-_]/g, '');
                if (!/[a-z]/.test(nameNorm)) continue;
                if (!textNormalized.includes(nameNorm)) continue;
                const p = aircraftData[name];
                mentionedPlanes.push({ name, type: p.type, capacity: p.capacity, cruise_speed: p.cruise_speed, fuel_consumption: p.fuel_consumption, range: p.range, price: p.price });
                for (const c of candidates) { if (c === nameNorm) exactMatchedCandidates.add(c); }
            }

            // 2. Aşama: Levenshtein fuzzy — exact match üretmeyen kandidatlar için en iyi eşleşme
            const fuzzyCandidates = candidates.filter(c => !exactMatchedCandidates.has(c));
            for (const cand of fuzzyCandidates) {
                let bestName = null, bestDist = Infinity;
                for (let name in aircraftData) {
                    const nameNorm = name.toLowerCase().replace(/[\s\-_]/g, '');
                    if (nameNorm.length < 4 || nameNorm.length > 10) continue;
                    if (mentionedPlanes.find(mp => mp.name === name)) continue;
                    if (cand[0] !== nameNorm[0]) continue;
                    if (Math.abs(cand.length - nameNorm.length) > 2) continue;
                    if (!sameLetterDigitPattern(cand, nameNorm)) continue;
                    const dist = levenshtein(cand, nameNorm);
                    if (dist <= 2 && dist > 0 && dist < bestDist) { bestDist = dist; bestName = name; }
                }
                if (bestName) {
                    const p = aircraftData[bestName];
                    mentionedPlanes.push({ name: bestName + ' (yazım düzeltildi)', type: p.type, capacity: p.capacity, cruise_speed: p.cruise_speed, fuel_consumption: p.fuel_consumption, range: p.range, price: p.price, typoCorrection: true, originalQuery: cand });
                }
            }
        }

        // History'i extracted'dan ÖNCE yükle ki findInHistory fallback'i çalışsın
        const history = this.loadHistory();

        // Akıllı bağlam filtreleme: bütçe/havalimanı/tip/sefer tespiti + history fallback
        const extracted = extractContextFromMessage(text);

        // History fallback: mesajda yoksa son user mesajlarından geriye doğru çıkar
        const effectiveBudget = extracted.budget || findInHistory(history, 'budget');
        const effectiveSlots = extracted.availableSlots || findInHistory(history, 'slots');

        // Adım 4a Levenshtein yan etkisi global filtre: geniş routeIntent kelime listesi
        // ("uçar", "kar", "hat" vb.) bazen şehir adlarına eşik-2 Levenshtein ile düzeltiliyor
        // (örn "uçar" → "UFA"). Bu durum hem hubAnalysis hem getRelevantRoutes hem Adım 4b'yi
        // bozuyor (AI Ufa hub analizi okuyup Ufa cevabı veriyor).
        // Kriter: routeIntent: true + Levenshtein düzeltmesi → yan etki, IATA filtrelenir.
        // "burgaz → BOJ" gibi legitim yazım düzeltmeleri (routeIntent: false) korunur.
        const isLevSideEffect = (iata) =>
            extracted.routeIntent &&
            extracted.levenshteinAirportCorrection?.corrected === iata;
        const filteredExtractedAirports = extracted.airports.filter(iata => !isLevSideEffect(iata));
        const effectiveAirports = filteredExtractedAirports.length > 0
            ? filteredExtractedAirports
            : (findInHistory(history, 'airports') || []);
        const effectiveType = extracted.planeType || findInHistory(history, 'planeType');

        const candidatePlanes = effectiveBudget ? getCandidatePlanes(effectiveBudget, effectiveType) : '';
        const relevantRoutes = effectiveAirports.length > 0 ? getRelevantRoutes(effectiveAirports) : '';

        // Cross-context (Adım 2): askGemini'den gelen son analiz ve karşılaştırma niyeti
        let usableLastAnalysis = null;
        let comparisonRoute = null;
        let comparisonPlane = null;
        try {
            const lastRaw = sessionStorage.getItem('menoa_last_analysis');
            if (lastRaw) {
                const la = JSON.parse(lastRaw);
                const ageMs = Date.now() - (la.timestamp || 0);
                // 30 dk expire — sabah analiz yapıp öğleden sonra chat yazan kullanıcıyı yanıltmasın
                if (ageMs <= 30 * 60 * 1000 && la.plane && la.route) {
                    usableLastAnalysis = la;
                }
            }
        } catch (e) { /* JSON parse / sessionStorage erişim — sessizce geç */ }

        if (usableLastAnalysis) {
            // Karşılaştırma niyeti tespit (basit keyword match — yanlış pozitif riskini düşürmek için
            // entity tespiti ile AND'lenir, sadece intent yetmez)
            const comparisonKeywords = [
                'karşılaştır', 'kıyasla', 'kiyasla', 'fark',
                'aynı uçakla', 'aynı rotada', 'alternatif', 'yerine',
                'ile uçsam', 'ile uçarsa', 'nasıl olur', 'daha kârlı', 'daha karli',
                'vs', 'arasındaki'
            ];
            const lower = text.toLocaleLowerCase('tr');
            const hasComparisonIntent = comparisonKeywords.some(kw => lower.includes(kw));

            if (hasComparisonIntent) {
                // lastAnalysis route'unun IATA çiftini çıkar (origin/destination "X (LIM / SPIM), Peru" formatında)
                const iataRe = /\(([A-Z]{3,4})/;
                const lastOriginIata = (usableLastAnalysis.route.origin.match(iataRe) || [])[1] || null;
                const lastDestIata = (usableLastAnalysis.route.destination.match(iataRe) || [])[1] || null;

                // Mesajda yeni airport çifti tespit edildiyse (lastAnalysis rotasından farklı 2 airport)
                const newAirports = effectiveAirports.filter(a => a !== lastOriginIata && a !== lastDestIata);
                if (newAirports.length >= 2 && window.dataLoader && window.dataLoader.isReady()) {
                    const dl = window.dataLoader;
                    const o = dl.getAirport(newAirports[0]);
                    const d = dl.getAirport(newAirports[1]);
                    const dist = dl.getDistance(newAirports[0], newAirports[1]);
                    if (o && d && dist) {
                        const newRoute = {
                            origin: Utils.formatAirportLabel(o),
                            destination: Utils.formatAirportLabel(d),
                            distance: dist,
                            demand: dl.getDemand(newAirports[0], newAirports[1]) || {}
                        };
                        const lastPlaneName = usableLastAnalysis.plane.name;
                        const lastPlane = aircraftData[lastPlaneName];
                        if (lastPlane) {
                            const calc = Logic.calculateProfit(lastPlane, newRoute, null, null);
                            comparisonRoute = {
                                route: newRoute,
                                calc: {
                                    profit: calc.profitPerFlight * (calc.appliedTrips || 0),
                                    profitPerFlight: calc.profitPerFlight,
                                    grossRevenue: calc.grossRevenue,
                                    totalCosts: calc.totalCosts,
                                    fuelCost: calc.fuelCost,
                                    maintenanceCost: calc.maintenanceCost,
                                    co2Cost: calc.co2Cost,
                                    appliedTrips: calc.appliedTrips
                                }
                            };
                        }
                    }
                }

                // Mesajda yeni uçak tespit edildiyse (lastAnalysis.plane.name'den farklı)
                const lastPlaneName = usableLastAnalysis.plane.name;
                const newPlane = mentionedPlanes.find(mp => {
                    const cleanName = mp.name.replace(' (yazım düzeltildi)', '');
                    return cleanName !== lastPlaneName && aircraftData[cleanName];
                });
                if (newPlane) {
                    const cleanName = newPlane.name.replace(' (yazım düzeltildi)', '');
                    const planeObj = aircraftData[cleanName];
                    // Karşılaştırma rotası varsa onu, yoksa lastAnalysis rotasını kullan
                    const baseRoute = comparisonRoute ? comparisonRoute.route : {
                        origin: usableLastAnalysis.route.origin,
                        destination: usableLastAnalysis.route.destination,
                        distance: usableLastAnalysis.route.distance,
                        demand: usableLastAnalysis.demand
                    };
                    const calc = Logic.calculateProfit(planeObj, baseRoute, null, null);
                    comparisonPlane = {
                        name: cleanName,
                        plane: { ...planeObj, name: cleanName },
                        route: baseRoute,
                        calc: {
                            profit: calc.profitPerFlight * (calc.appliedTrips || 0),
                            profitPerFlight: calc.profitPerFlight,
                            grossRevenue: calc.grossRevenue,
                            totalCosts: calc.totalCosts,
                            fuelCost: calc.fuelCost,
                            maintenanceCost: calc.maintenanceCost,
                            co2Cost: calc.co2Cost,
                            appliedTrips: calc.appliedTrips
                        }
                    };
                }
            }
        }

        // Adım 4b — uçak entity + route intent AND koşulu: o uçak için top 10 rotayı çıkar
        // Hub kaynağı 3 katmanlı fallback: cross-context (Adım 2) → mesaj/history → null (top-5 hub global)
        // v1: tek uçak (mentionedPlanes[0]); çoklu uçak Adım 2 comparisonPlane akışına bırakılır
        let planeRoutes = '';
        if (mentionedPlanes.length > 0 && extracted.routeIntent) {
            let crossContextHubIata = null;
            if (usableLastAnalysis?.route?.origin) {
                const m = usableLastAnalysis.route.origin.match(/\(([A-Z]{3})/);
                if (m) crossContextHubIata = m[1];
            }
            // Adım 4a Levenshtein düzeltmesi yan etkisi: geniş routeIntent listesi
            // ("uçar", "kar", "hat" vb.) bazen şehir adlarına eşik-2 Levenshtein ile
            // düzeltiliyor (örn "uçar" → "Ufa"). Bu IATA'yı hub olarak güvenme.
            // cityToIata explicit match'i (Londra→LHR) ve KNOWN_IATA token match'i
            // (JFK gibi) güvenilirliğini korur — sadece Levenshtein düzeltmeleri dışlanır.
            const isLevSideEffect = extracted.levenshteinAirportCorrection &&
                                    effectiveAirports.length > 0 &&
                                    extracted.levenshteinAirportCorrection.corrected === effectiveAirports[0];
            const trustedAirportHub = isLevSideEffect ? null : (effectiveAirports[0] || null);
            const planeRouteHub = crossContextHubIata || trustedAirportHub || null;
            planeRoutes = getPlaneRouteContext(mentionedPlanes[0].name, planeRouteHub);
        }

        // Hub analizi: kullanıcı bir hub belirttiyse o hub'tan TOP 10 uçak/rota gerçek dataLoader analizi
        const hubAnalysis = effectiveAirports.length > 0
            ? getHubAnalysisContext(effectiveAirports[0], effectiveType, effectiveBudget, effectiveSlots)
            : '';

        // Kullanıcı mesajını ekrana bas
        this._appendMessage(text, 'user', false);
        input.value = '';

        try {
            const response = await fetch("https://ai.airm4.workers.dev/", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatMessage: text,
                    history: history,
                    context: {
                        gameMode: window.gameMode || 'realism',
                        fuelPrice: window.FUEL_PRICE || 950,
                        co2Price: window.CO2_PRICE || 150,  // Fix #7 — AI prompt'a co2 fiyatı enjekte
                        costIndex: (window.COST_INDEX != null) ? window.COST_INDEX : 200,
                        availableSlots: effectiveSlots,
                        planeType: effectiveType,
                        budget: effectiveBudget,
                        planes: mentionedPlanes,
                        candidatePlanes: candidatePlanes,
                        relevantRoutes: relevantRoutes,
                        hubAnalysis: hubAnalysis,
                        planeRoutes: planeRoutes,
                        extracted: extracted,
                        // Cross-context (Adım 2): askGemini'den gelen son analiz + karşılaştırma hesapları
                        lastAnalysis: usableLastAnalysis,
                        comparisonRoute: comparisonRoute,
                        comparisonPlane: comparisonPlane,
                        // Adım 4a NLU uyarıları (şehir/ülke tespit + Levenshtein düzeltme)
                        ambiguousAirportNotice: extracted.ambiguousAirportNotice,
                        levenshteinAirportCorrection: extracted.levenshteinAirportCorrection,
                        ambiguousCountry: extracted.ambiguousCountry
                    }
                })
            });
            const data = await response.json();
            const aiText = data.text || "Yanıt alınamadı.";

            // AI mesajını ekrana bas
            this._appendMessage(aiText, 'ai', true);

            // Güncellenmiş geçmişi kaydet
            // Worker updatedHistory döndürüyorsa onu kullan, yoksa manuel ekle
            if (data.updatedHistory && Array.isArray(data.updatedHistory)) {
                this.saveHistory(data.updatedHistory);
            } else {
                const updated = [
                    ...history,
                    { role: "user",  parts: [{ text: text }] },
                    { role: "model", parts: [{ text: aiText }] }
                ];
                this.saveHistory(updated);
            }

        } catch (e) {
            this._appendMessage("⚠️ Hata: Motor yanıt vermiyor.", 'ai', false);
        }
    }
};

// MODÜLLERİ GLOBALE BAĞLA (ReferenceError Fix)
window.UI = UI;
window.Chat = Chat;

window.gameMode = window.gameMode || 'realism';

// Global tıklama dinleyicisi: Menü dışına tıklandığında dropdownları kapatır.
document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});
