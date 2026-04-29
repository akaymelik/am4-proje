/**
 * configurator.js: Rota bazlı dinamik koltuk ve kargo optimizasyonu.
 * GÜNCELLEME: 
 * - Kargo için yolcu talebinden kargo üretme (fallback) mantığı tamamen kaldırıldı.
 * - Sadece rota verisinde 'c' (Cargo) talebi olan uçuşlar için yük hesabı yapar.
 * - Kapasite kontrolü Kargo ve Yolcu sayfalarına göre dinamik çalışır.
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
        // Rota verisinde kargo talebi (c) yoksa işlem yapma
        if (!route.demand || !route.demand.c) return { l: 0, h: 0 };

        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // 30dk hazırlık
        const maxTrips = Math.floor(24 / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { l: 0, h: 0 };

        // Toplam günlük talebi sefer sayısına bölerek tek uçuşluk limitleri bul
        const totalDailyDemand = route.demand.c;
        const perFlightDemand = Math.floor(totalDailyDemand / trips);

        // AM4 Pazar Standardı: Talebin ~%30'u Ağır (H), %70'i Hafif (L) yükten oluşur.
        let demandH = Math.floor(perFlightDemand * 0.3);
        let demandL = perFlightDemand - demandH;

        let remCap = plane.capacity;
        // 1. Önce en kârlı olan Ağır Yükü doldur
        let sH = Math.min(demandH, remCap); 
        remCap -= sH;
        // 2. Kalan kapasiteye Hafif Yük koy
        let sL = Math.min(demandL, remCap); 
        
        return { l: sL, h: sH };
    },

    /**
     * Yolcu koltuklarını optimize eder (F > J > Y).
     */
    calculateOptimalSeats: function(plane, route, manualTrips = null) {
        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(24 / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { y: 0, j: 0, f: 0 };

        const maxF = Math.floor((route.demand.f || 0) / trips);
        const maxJ = Math.floor((route.demand.j || 0) / trips);
        const maxY = Math.floor((route.demand.y || 0) / trips);

        let remCap = plane.capacity;
        
        // Önce First Class (3x yer kaplar, birim başına en kârlıdır)
        let sF = Math.min(maxF, Math.floor(remCap / 3));
        remCap -= (sF * 3);
        
        // Sonra Business Class (2x yer kaplar)
        let sJ = Math.min(maxJ, Math.floor(remCap / 2));
        remCap -= (sJ * 2);
        
        // En son kalan her yer Economy
        let sY = Math.min(maxY, remCap);
        
        return { y: sY, j: sJ, f: sF };
    },

    /**
     * Uçağın kapasite aşımını kontrol eder ve görsel geri bildirim verir.
     */
    updateCapacityCheck: function() {
        // Aktif sayfanın hangisi olduğunu kontrol et
        const paxRoutePage = document.getElementById('pax-route');
        const isPaxPage = paxRoutePage && paxRoutePage.classList.contains('active');
        
        const planeSelectId = isPaxPage ? 'paxRouteSelect' : 'cargoRouteSelect';
        const infoDivId = isPaxPage ? 'capacityInfo' : 'cargoCapacityInfo';
        
        const planeName = document.getElementById(planeSelectId)?.value;
        const infoDiv = document.getElementById(infoDivId);
        
        if (!planeName || !aircraftData[planeName]) {
            if (infoDiv) infoDiv.innerText = "Lütfen bir uçak seçin.";
            return false;
        }

        const plane = aircraftData[planeName];
        let usedCapacity = 0;

        if (isPaxPage) {
            const config = this.getSeatConfig();
            // PAX: Y(1) + J(2) + F(3)
            usedCapacity = config.y + (config.j * 2) + (config.f * 3);
        } else {
            const config = this.getCargoConfig();
            // Cargo: L(1) + H(1)
            usedCapacity = config.l + config.h;
        }

        const remaining = plane.capacity - usedCapacity;
        
        if (infoDiv) {
            if (remaining < 0) {
                infoDiv.className = "status-box status-danger";
                infoDiv.innerText = `Kapasite Aşıldı! (${usedCapacity} / ${plane.capacity})`;
            } else {
                infoDiv.className = "status-box status-success";
                infoDiv.innerText = `Kapasite Uygun: ${usedCapacity} / ${plane.capacity} (Boş: ${remaining})`;
            }
        }
        return usedCapacity <= plane.capacity;
    },

    /**
     * Analizden gelen ideal değerleri inputlara aktarır.
     */
    applySuggestion: function(v1, v2, v3 = null) {
        if (v3 !== null) { // Yolcu Modu
            const yInput = document.getElementById('seatsY');
            const jInput = document.getElementById('seatsJ');
            const fInput = document.getElementById('seatsF');
            if (yInput) yInput.value = v1;
            if (jInput) jInput.value = v2;
            if (fInput) fInput.value = v3;
        } else { // Kargo Modu
            const lInput = document.getElementById('cargoL');
            const hInput = document.getElementById('cargoH');
            if (lInput) lInput.value = v1;
            if (hInput) hInput.value = v2;
        }
        
        this.updateCapacityCheck();
        
        // Kullanıcıyı yukarı (ayarlar paneline) yumuşak bir şekilde kaydır
        const focusId = v3 !== null ? 'paxRouteSelect' : 'cargoRouteSelect';
        const anchor = document.getElementById(focusId);
        if (anchor) {
            const navOffset = 90;
            const elementPosition = anchor.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({ top: elementPosition - navOffset, behavior: 'smooth' });
        }
    },

    /**
     * Aktif oyun moduna göre ideal bilet ve kargo yük fiyatlarını döndürür.
     */
    getTicketMultipliers: function(distance) {
        const mode = window.gameMode || 'realism';
        const multiplier = mode === 'easy' ? 1.1 : 1.0;
        
        return {
            // Yolcu Fiyatları
            y: ((0.4 * distance) + 170) * multiplier,
            j: ((0.8 * distance) + 560) * multiplier,
            f: ((1.2 * distance) + 1200) * multiplier,
            // Kargo Fiyatları
            l: ((0.07 * distance) + 50) * multiplier,
            h: ((0.11 * distance) + 150) * multiplier
        };
    }
};
