/**
 * configurator.js: Rota bazlı dinamik koltuk ve kargo optimizasyonu.
 * AM4 Standartları: 
 * - Yolcu: Economy (1), Business (2), First (3) birim yer kaplar.
 * - Kargo: Hafif (L) ve Ağır (H) yükler 1:1 oranında kapasite kullanır.
 */

const Configurator = {
    /**
     * Kullanıcının arayüzden girdiği koltuk sayılarını çeker.
     */
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    /**
     * Kullanıcının girdiği kargo yük miktarlarını çeker.
     */
    getCargoConfig: function() {
        return {
            l: parseInt(document.getElementById('cargoL')?.value) || 0,
            h: parseInt(document.getElementById('cargoH')?.value) || 0
        };
    },

    /**
     * Rota talebine göre en kârlı kargo dağılımını hesaplar.
     * AM4 Kuralı: Ağır (Heavy) yük birim başına daha çok kazandırır.
     */
    calculateOptimalCargo: function(plane, route, manualTrips = null) {
        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(24 / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { l: 0, h: 0 };

        // Toplam kargo talebi (Veritabanında 'c' yoksa yolcu talebinden simüle edilir)
        const totalDailyDemand = route.demand.c || (route.demand.y * 500) || 0;
        const perFlightDemand = Math.floor(totalDailyDemand / trips);

        // Kargo dağılımı: Ağır yük her zaman daha kârlı olduğu için önce kapasiteyi onunla doldur.
        // Genellikle pazarın %30'u Ağır, %70'i Hafif yüktür.
        let demandH = Math.floor(perFlightDemand * 0.3);
        let demandL = perFlightDemand - demandH;

        let remCap = plane.capacity;
        let sH = Math.min(demandH, remCap);
        remCap -= sH;
        let sL = Math.min(demandL, remCap);
        
        // Eğer talep uçağın kapasitesinden fazlaysa (büyük uçaklar için)
        if (sH + sL < plane.capacity && perFlightDemand > (sH + sL)) {
            const extra = Math.min(plane.capacity - (sH + sL), perFlightDemand - (sH + sL));
            sL += extra;
        }

        return { l: sL, h: sH };
    },

    /**
     * Uçak ve rota için en kârlı koltuk dağılımını hesaplar (F > J > Y).
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
        let sF = Math.min(maxF, Math.floor(remCap / 3));
        remCap -= (sF * 3);
        let sJ = Math.min(maxJ, Math.floor(remCap / 2));
        remCap -= (sJ * 2);
        let sY = Math.min(maxY, remCap);
        
        return { y: sY, j: sJ, f: sF };
    },

    /**
     * Kapasite durumunu kontrol eder ve görsel geri bildirim sağlar.
     */
    updateCapacityCheck: function() {
        // Aktif sayfanın hangisi olduğunu bul (Yolcu mu Kargo mu?)
        const isPaxPage = document.getElementById('pax-route').classList.contains('active');
        const planeSelectId = isPaxPage ? 'paxRouteSelect' : 'cargoRouteSelect';
        const infoDivId = isPaxPage ? 'capacityInfo' : 'cargoCapacityInfo';
        
        const planeName = document.getElementById(planeSelectId)?.value;
        const infoDiv = document.getElementById(infoDivId);
        
        if (!planeName || !aircraftData[planeName]) {
            if (infoDiv) infoDiv.innerText = "Lütfen uçak seçin.";
            return false;
        }

        const plane = aircraftData[planeName];
        let used = 0;

        if (isPaxPage) {
            const config = this.getSeatConfig();
            used = config.y + (config.j * 2) + (config.f * 3);
        } else {
            const config = this.getCargoConfig();
            used = config.l + config.h;
        }

        const remaining = plane.capacity - used;
        
        if (infoDiv) {
            if (remaining < 0) {
                infoDiv.className = "status-box status-danger";
                infoDiv.innerText = `Kapasite Aşıldı! (${used} / ${plane.capacity})`;
            } else {
                infoDiv.className = "status-box status-success";
                infoDiv.innerText = `Kapasite Uygun: ${used} / ${plane.capacity} (Boş: ${remaining})`;
            }
        }
        return used <= plane.capacity;
    },

    /**
     * Analizden gelen önerileri inputlara aktarır (L/H veya Y/J/F).
     */
    applySuggestion: function(v1, v2, v3 = null) {
        if (v3 !== null) { // Yolcu (Y, J, F)
            document.getElementById('seatsY').value = v1;
            document.getElementById('seatsJ').value = v2;
            document.getElementById('seatsF').value = v3;
        } else { // Kargo (L, H)
            document.getElementById('cargoL').value = v1;
            document.getElementById('cargoH').value = v2;
        }
        this.updateCapacityCheck();
    },

    /**
     * Aktif oyun moduna göre bilet ve yük fiyatlarını döndürür.
     */
    getTicketMultipliers: function(distance) {
        const mode = window.gameMode || 'realism';
        const multiplier = mode === 'easy' ? 1.1 : 1.0;
        
        return {
            // Yolcu Fiyatları
            y: ((0.4 * distance) + 170) * multiplier,
            j: ((0.8 * distance) + 560) * multiplier,
            f: ((1.2 * distance) + 1200) * multiplier,
            // Kargo Fiyatları (Yeni Eklendi - Standart AM4 Katsayıları)
            l: ((0.07 * distance) + 50) * multiplier,
            h: ((0.11 * distance) + 150) * multiplier
        };
    }
};
