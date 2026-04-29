/**
 * configurator.js: Rota bazlı dinamik koltuk ve kargo optimizasyonu.
 * GÜNCELLEME: 
 * - Hafif (Large) ve Ağır (Heavy) kargo fiyatlandırması eklendi.
 * - Kargo için otomatik optimizasyon (Demand split) mantığı kuruldu.
 */

const Configurator = {
    /**
     * Kullanıcının arayüzden girdiği koltuk veya kargo değerlerini çeker.
     */
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    /**
     * Kargo konfigürasyonunu çeker (L: Hafif, H: Ağır).
     */
    getCargoConfig: function() {
        return {
            l: parseInt(document.getElementById('cargoL')?.value) || 0,
            h: parseInt(document.getElementById('cargoH')?.value) || 0
        };
    },

    /**
     * Rota talebine göre en ideal kargo dağılımını hesaplar.
     * AM4'te Ağır (Heavy) yük her zaman daha kârlıdır.
     */
    calculateOptimalCargo: function(plane, route, manualTrips = null) {
        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(24 / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { l: 0, h: 100 }; // Varsayılan %100 Heavy

        // Toplam kargo talebi (Eğer L/H split verisi yoksa %70 L, %30 H olarak simüle edilir)
        const totalDemand = route.demand.c || (route.demand.y * 500);
        const demandL = Math.floor(totalDemand * 0.7 / trips);
        const demandH = Math.floor(totalDemand * 0.3 / trips);

        let remCap = plane.capacity;
        let sH = Math.min(demandH, remCap);
        remCap -= sH;
        let sL = Math.min(demandL, remCap);

        // Eğer talep uçağın kapasitesinden çok azsa, kapasiteyi 70/30 oranında doldur
        if (sH + sL < plane.capacity) {
            sH = Math.floor(plane.capacity * 0.3);
            sL = plane.capacity - sH;
        }

        return { l: sL, h: sH };
    },

    /**
     * Uçak ve rota için en kârlı koltuk dağılımını hesaplar (Yolcu).
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
     * Kapasite kontrolünü günceller (Hem Yolcu hem Kargo için).
     */
    updateCapacityCheck: function() {
        const isPax = document.getElementById('pax-route').classList.contains('active');
        const planeSelectId = isPax ? 'paxRouteSelect' : 'cargoRouteSelect';
        const infoDivId = isPax ? 'capacityInfo' : 'cargoCapacityInfo';
        
        const planeName = document.getElementById(planeSelectId)?.value;
        const infoDiv = document.getElementById(infoDivId);
        
        if (!planeName || !aircraftData[planeName]) return false;

        const plane = aircraftData[planeName];
        let used = 0;

        if (isPax) {
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
     * Analizden gelen önerileri inputlara aktarır.
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
     * Oyun moduna göre bilet fiyatlarını döndürür.
     */
    getTicketMultipliers: function(distance) {
        const mode = window.gameMode || 'realism';
        const multiplier = mode === 'easy' ? 1.1 : 1.0;
        
        return {
            y: ((0.4 * distance) + 170) * multiplier,
            j: ((0.8 * distance) + 560) * multiplier,
            f: ((1.2 * distance) + 1200) * multiplier,
            // Kargo Fiyatları (Yeni Eklendi)
            l: ((0.07 * distance) + 50) * multiplier,
            h: ((0.11 * distance) + 150) * multiplier
        };
    }
};
