/**
 * configurator.js: Rota bazlı dinamik koltuk ve kargo optimizasyonu.
 * GÜNCELLEME: 
 * - PAX (Y, J, F) ve Kargo (L, H) yapılandırma mantığı tamamen ayrıldı.
 * - 'Apply Suggestion' (Yükle) fonksiyonu UI inputlarını anlık günceller.
 * - Kapasite kontrolü (updateCapacityCheck) görsel uyarı sistemine bağlandı.
 */

const Configurator = {
    /**
     * Mevcut koltuk konfigürasyonunu (Y, J, F) DOM'dan çeker.
     */
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    /**
     * Mevcut kargo yük konfigürasyonunu (L, H) DOM'dan çeker.
     */
    getCargoConfig: function() {
        return {
            l: parseInt(document.getElementById('cargoL')?.value) || 0,
            h: parseInt(document.getElementById('cargoH')?.value) || 0
        };
    },

    /**
     * Kargo yükünü optimize eder (Ağır yük öncelikli).
     * İki format desteklenir:
     *  - Legacy: route.demand.c (toplam) → %30 H / %70 L split
     *  - Yeni:   route.demand.l ve route.demand.h (am4-cc demand.cpp formülü) → doğrudan kullanılır
     */
    calculateOptimalCargo: function(plane, route, manualTrips = null) {
        if (!route.demand) return { l: 0, h: 0 };
        const hasLegacy = !!route.demand.c;
        const hasNew = !!(route.demand.l || route.demand.h);
        if (!hasLegacy && !hasNew) return { l: 0, h: 0 };

        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(DAILY_AVAILABLE_HOURS / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { l: 0, h: 0 };

        let demandH, demandL;
        if (hasNew) {
            // dataLoader formülünden geliyor: l ve h ayrı saklı
            demandL = Math.floor((route.demand.l || 0) / trips);
            demandH = Math.floor((route.demand.h || 0) / trips);
        } else {
            // Legacy: total c, AM4 pazar oranı %30 H / %70 L
            const perFlightDemand = Math.floor(route.demand.c / trips);
            demandH = Math.floor(perFlightDemand * 0.3);
            demandL = perFlightDemand - demandH;
        }

        // Kanonik kapasite mekaniği (abc8747 route.cpp `update_cargo_details`):
        //   - Heavy: 1 lbs = 1 slot (baseline, training yok)
        //   - Light: 1 lbs = 1/0.7 slot (yani aynı slot sayısı için L lbs daha az)
        //   - Constraint: h_lbs + l_lbs / 0.7 <= capacity
        // Allocation: H önce (slot başına daha çok lbs), L kalan slotlara × 0.7 ile sığar.
        const L_CAP_FACTOR = 0.7;
        let remCap = plane.capacity;
        let sH = Math.min(demandH, remCap);
        remCap -= sH;
        let sL = Math.min(demandL, Math.floor(remCap * L_CAP_FACTOR));

        return { l: sL, h: sH };
    },

    /**
     * Yolcu koltuklarını optimize eder (F > J > Y hiyerarşisi).
     */
    calculateOptimalSeats: function(plane, route, manualTrips = null) {
        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(DAILY_AVAILABLE_HOURS / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { y: 0, j: 0, f: 0 };

        // Günlük talebi sefer sayısına bölerek uçuş başına limitleri bul
        const maxF = Math.floor((route.demand.f || 0) / trips);
        const maxJ = Math.floor((route.demand.j || 0) / trips);
        const maxY = Math.floor((route.demand.y || 0) / trips);

        let remCap = plane.capacity;
        
        // 1. First Class (3x yer kaplar)
        let sF = Math.min(maxF, Math.floor(remCap / 3));
        remCap -= (sF * 3);
        
        // 2. Business Class (2x yer kaplar)
        let sJ = Math.min(maxJ, Math.floor(remCap / 2));
        remCap -= (sJ * 2);
        
        // 3. Economy Class (1x yer kaplar)
        let sY = Math.min(maxY, remCap);
        
        return { y: sY, j: sJ, f: sF };
    },

    /**
     * Kapasite aşımını kontrol eder ve görsel bildirim verir.
     */
    updateCapacityCheck: function() {
        const paxPage = document.getElementById('pax-route');
        const isPax = paxPage && paxPage.classList.contains('active');
        
        const planeSelect = document.getElementById(isPax ? 'paxRouteSelect' : 'cargoRouteSelect');
        const infoDiv = document.getElementById(isPax ? 'capacityInfo' : 'cargoCapacityInfo');
        
        const planeName = planeSelect?.value;
        if (!planeName || !aircraftData[planeName]) {
            if (infoDiv) infoDiv.innerText = "Lütfen uçak seçiniz.";
            return false;
        }

        const plane = aircraftData[planeName];
        let used = 0;

        if (isPax) {
            const config = this.getSeatConfig();
            used = config.y + (config.j * 2) + (config.f * 3);
        } else {
            const config = this.getCargoConfig();
            used = config.l + config.h;
        }

        const rem = plane.capacity - used;
        
        if (infoDiv) {
            if (rem < 0) {
                infoDiv.className = "status-box status-danger";
                infoDiv.innerText = `⚠️ Kapasite Aşıldı! (${used} / ${plane.capacity})`;
            } else {
                infoDiv.className = "status-box status-success";
                infoDiv.innerText = `✅ Kapasite Uygun: ${used} / ${plane.capacity} (Kalan: ${rem})`;
            }
        }
        return rem >= 0;
    },

    /**
     * Analiz sonuçlarından gelen ideal değerleri yukarıdaki kutucuklara aktarır.
     */
    applySuggestion: function(v1, v2, v3 = 'null') {
        const isPax = v3 !== 'null';
        
        if (isPax) {
            document.getElementById('seatsY').value = v1;
            document.getElementById('seatsJ').value = v2;
            document.getElementById('seatsF').value = v3;
        } else {
            document.getElementById('cargoL').value = v1;
            document.getElementById('cargoH').value = v2;
        }
        
        // Kapasite bilgisini anlık güncelle
        this.updateCapacityCheck();
        
        // Kullanıcıyı yukarıdaki panel ayarlarına geri kaydır
        const anchor = document.getElementById(isPax ? 'paxRouteSelect' : 'cargoRouteSelect');
        if (anchor) {
            window.scrollTo({ top: anchor.offsetTop - 100, behavior: 'smooth' });
        }
    },

    /**
     * Oyun moduna göre bilet ve kargo fiyatlarını döndürür.
     * Easy/Realism formülleri AM4 formulae.md (cathaypacific8747) kaynaklı.
     * Autoprice multiplier (Y×1.10, J×1.08, F×1.06, L×1.10, H×1.08) community
     * standardı — autoprice taban × optimal çarpan default olarak uygulanır.
     * Cargo: kanonik form `floor(autoprice * raw) / 100` ($/lbs üretir).
     * Kaynak: am4-cc.pages.dev `Vt` + abc8747/am4 src/am4/utils/cpp/ticket.cpp.
     */
    getTicketMultipliers: function(distance) {
        // Yolcu fiyatları kişi başına ($/pax) — direct. Easy ve Realism farkı pax katsayılarında.
        // Kargo ham formülü cents/lbs üretir; floor öncesi optimal çarpan, sonra /100 ile $/lbs.
        if (window.gameMode === 'easy') {
            return {
                y: ((0.4 * distance) + 170) * 1.10,
                j: ((0.8 * distance) + 560) * 1.08,
                f: ((1.2 * distance) + 1200) * 1.06,
                l: Math.floor(1.10 * ((0.0948283724581252 * distance) + 85.2045432642377)) / 100,
                h: Math.floor(1.08 * ((0.0689663577640275 * distance) + 28.2981124272893)) / 100
            };
        }
        // Realism (varsayılan)
        return {
            y: ((0.3 * distance) + 150) * 1.10,
            j: ((0.6 * distance) + 500) * 1.08,
            f: ((0.9 * distance) + 1000) * 1.06,
            l: Math.floor(1.10 * ((0.0776321822039374 * distance) + 85.0567600367807)) / 100,
            h: Math.floor(1.08 * ((0.0517742799409248 * distance) + 24.6369915396414)) / 100
        };
    }
};

// Fonksiyonu globale bağlayalım ki Apply Suggestion butonları çalışsın
window.Configurator = Configurator;
