/**
 * configurator.js: Rota bazlı dinamik koltuk optimizasyonu ve mod yönetimi.
 * AM4 Standartları: Economy (Y)=1, Business (J)=2, First (F)=3 birim yer kaplar.
 */

const Configurator = {
    /**
     * Kullanıcının arayüzden girdiği mevcut koltuk sayılarını çeker.
     * @returns {Object} {y: Economy, j: Business, f: First}
     */
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    /**
     * Belirli bir uçak ve rota için en kârlı koltuk dağılımını hesaplar.
     * AM4 Kar Önceliği: First (3x) > Business (2x) > Economy (1x)
     * @param {Object} plane - Uçak nesnesi
     * @param {Object} route - Rota nesnesi
     * @param {number} manualTrips - Hedeflenen günlük sefer sayısı
     * @returns {Object} {y, j, f} ideal dağılım
     */
    calculateOptimalSeats: function(plane, route, manualTrips = null) {
        // Logic modülü üzerinden uçuş süresi ve sefer sayısını al
        const flightTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const maxTrips = Math.floor(24 / flightTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { y: 0, j: 0, f: 0 };

        // Sefer başına düşen maksimum pazar talebi (Darboğaz kontrolü)
        const maxF = Math.floor((route.demand.f || 0) / trips);
        const maxJ = Math.floor((route.demand.j || 0) / trips);
        const maxY = Math.floor((route.demand.y || 0) / trips);

        let remCap = plane.capacity;
        let sF = 0, sJ = 0, sY = 0;

        // 1. Öncelik: First Class (En kârlı, 3 birim yer kaplar)
        sF = Math.min(maxF, Math.floor(remCap / 3));
        remCap -= (sF * 3);

        // 2. Öncelik: Business Class (2 birim yer kaplar)
        sJ = Math.min(maxJ, Math.floor(remCap / 2));
        remCap -= (sJ * 2);

        // 3. Öncelik: Economy Class (1 birim yer kaplar)
        sY = Math.min(maxY, remCap);
        
        return { y: sY, j: sJ, f: sF };
    },

    /**
     * Uçağın kapasite durumunu kontrol eder ve görsel geri bildirim sağlar.
     */
    updateCapacityCheck: function() {
        const planeName = document.getElementById('paxRouteSelect')?.value;
        const infoDiv = document.getElementById('capacityInfo');
        
        if (!planeName || !aircraftData[planeName]) {
            if (infoDiv) {
                infoDiv.className = "status-box status-neutral";
                infoDiv.innerText = "Lütfen önce bir uçak seçin.";
            }
            return false;
        }

        const plane = aircraftData[planeName];
        const config = this.getSeatConfig();
        const usedCapacity = config.y + (config.j * 2) + (config.f * 3);
        const remaining = plane.capacity - usedCapacity;
        
        if (infoDiv) {
            if (remaining < 0) {
                infoDiv.className = "status-box status-danger";
                infoDiv.innerText = `Kapasite Aşıldı! (${usedCapacity} / ${plane.capacity})`;
            } else {
                infoDiv.className = "status-box status-success";
                infoDiv.innerText = `Kapasite Uygun: ${usedCapacity} / ${plane.capacity} (Kalan: ${remaining})`;
            }
        }
        return usedCapacity <= plane.capacity;
    },

    /**
     * Rota analizinden gelen ideal değerleri inputlara aktarır ve ekranı kaydırır.
     */
    applySuggestion: function(y, j, f) {
        const inputs = { 'seatsY': y, 'seatsJ': j, 'seatsF': f };
        
        for (let id in inputs) {
            const el = document.getElementById(id);
            if (el) el.value = inputs[id];
        }

        this.updateCapacityCheck();
        
        // Kullanıcıyı ayarlar kısmına yumuşak bir geçişle odakla
        const anchor = document.getElementById('paxRouteSelect');
        if (anchor) {
            const navOffset = 85; // Üst bar payı
            const elementPosition = anchor.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
                top: elementPosition - navOffset,
                behavior: 'smooth'
            });
        }
    },

    /**
     * Aktif oyun moduna (Easy/Realism) göre bilet fiyat çarpanlarını döndürür.
     * Easy: 1.1x | Realism: 1.0x
     */
    getTicketMultipliers: function(distance) {
        // window.gameMode global değişkeni UI üzerinden kontrol edilir.
        const mode = window.gameMode || 'easy';
        const multiplier = mode === 'easy' ? 1.1 : 1.0;
        
        return {
            y: ((0.4 * distance) + 170) * multiplier,
            j: ((0.8 * distance) + 560) * multiplier,
            f: ((1.2 * distance) + 1200) * multiplier
        };
    }
};
