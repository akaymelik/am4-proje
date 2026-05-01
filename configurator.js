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
     * Sadece 'c' verisi olan rotalarda çalışır.
     */
    calculateOptimalCargo: function(plane, route, manualTrips = null) {
        if (!route.demand || !route.demand.c) return { l: 0, h: 0 };

        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; 
        const maxTrips = Math.floor(24 / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { l: 0, h: 0 };

        const perFlightDemand = Math.floor(route.demand.c / trips);

        // AM4 Pazar Standardı: Talebin ~%30'u Ağır (H), %70'i Hafif (L) yükten oluşur.
        let demandH = Math.floor(perFlightDemand * 0.3);
        let demandL = perFlightDemand - demandH;

        let remCap = plane.capacity;
        let sH = Math.min(demandH, remCap); 
        remCap -= sH;
        let sL = Math.min(demandL, remCap); 
        
        return { l: sL, h: sH };
    },

    /**
     * Yolcu koltuklarını optimize eder (F > J > Y hiyerarşisi).
     */
    calculateOptimalSeats: function(plane, route, manualTrips = null) {
        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(24 / cycleTime);
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
     * Oyun moduna göre bilet ve kargo gelir çarpanlarını döndürür.
     */
    getTicketMultipliers: function(distance) {
        const multiplier = (window.gameMode === 'easy') ? 1.1 : 1.0;
        
        return {
            y: ((0.4 * distance) + 170) * multiplier,
            j: ((0.8 * distance) + 560) * multiplier,
            f: ((1.2 * distance) + 1200) * multiplier,
            l: ((0.07 * distance) + 50) * multiplier,
            h: ((0.11 * distance) + 150) * multiplier
        };
    }
};

// Fonksiyonu globale bağlayalım ki Apply Suggestion butonları çalışsın
window.Configurator = Configurator;
