/**
 * configurator.js: Rota bazlı dinamik koltuk optimizasyonu.
 * Genel başlangıç önerisi kaldırıldı, sadece rota bazlı hesaplama yapar.
 */

const Configurator = {
    /**
     * Mevcut kutucuklardaki koltuk sayılarını çeker.
     */
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    /**
     * Spesifik bir rota ve uçak için en kârlı koltuk dağılımını hesaplar.
     * AM4 Mantığı: F > J > Y hiyerarşisine göre (Kâr önceliği).
     */
    calculateOptimalSeats: function(plane, route, manualTrips = null) {
        const flightTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const maxTrips = Math.floor(24 / flightTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { y: 0, j: 0, f: 0 };

        // Sefer başına düşen tavan talepler
        const maxF = Math.floor((route.demand.f || 0) / trips);
        const maxJ = Math.floor((route.demand.j || 0) / trips);
        const maxY = Math.floor((route.demand.y || 0) / trips);

        let remCap = plane.capacity;
        let sF = 0, sJ = 0, sY = 0;

        // 1. First Class (3 birim yer kaplar)
        sF = Math.min(maxF, Math.floor(remCap / 3));
        remCap -= (sF * 3);

        // 2. Business Class (2 birim yer kaplar)
        sJ = Math.min(maxJ, Math.floor(remCap / 2));
        remCap -= (sJ * 2);

        // 3. Economy Class (1 birim yer kaplar)
        sY = Math.min(maxY, remCap);
        
        return { y: sY, j: sJ, f: sF };
    },

    /**
     * Kapasite kontrolü yapar ve UI'ı uyarır.
     */
    updateCapacityCheck: function() {
        const planeName = document.getElementById('paxRouteSelect')?.value;
        const infoDiv = document.getElementById('capacityInfo');
        
        if (!planeName || !aircraftData[planeName]) {
            if (infoDiv) {
                infoDiv.className = "status-box status-neutral";
                infoDiv.innerText = "Lütfen bir uçak seçin.";
            }
            return false;
        }

        const plane = aircraftData[planeName];
        const config = this.getSeatConfig();
        const used = config.y + (config.j * 2) + (config.f * 3);
        const remaining = plane.capacity - used;
        
        if (infoDiv) {
            if (remaining < 0) {
                infoDiv.className = "status-box status-danger";
                infoDiv.innerText = `Kapasite Aşıldı: ${used} / ${plane.capacity}`;
            } else {
                infoDiv.className = "status-box status-success";
                infoDiv.innerText = `Kapasite Uygun: ${used} / ${plane.capacity} (Kalan: ${remaining})`;
            }
        }
        return used <= plane.capacity;
    },

    /**
     * Rota sonuçlarından gelen değerleri ana kutucuklara yazar.
     */
    applySuggestion: function(y, j, f) {
        document.getElementById('seatsY').value = y;
        document.getElementById('seatsJ').value = j;
        document.getElementById('seatsF').value = f;
        this.updateCapacityCheck();
        // Görsel geri bildirim için sayfayı hafifçe yukarı kaydırabiliriz
        window.scrollTo({ top: document.getElementById('paxRouteSelect').offsetTop - 100, behavior: 'smooth' });
    },

    /**
     * Easy Mode 1.1x Katsayıları
     */
    getTicketMultipliers: function(distance) {
        return {
            y: ((0.4 * distance) + 170) * 1.1,
            j: ((0.8 * distance) + 560) * 1.1,
            f: ((1.2 * distance) + 1200) * 1.1
        };
    }
};
