/**
 * configurator.js: Koltuk yapılandırması, kapasite yönetimi ve bilet fiyatlandırma katsayıları.
 * Bu modül, style.css içindeki durum sınıflarını kullanarak arayüzle haberleşir.
 */

const Configurator = {
    /**
     * Kullanıcının arayüzden girdiği koltuk sayılarını çeker.
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
     * Seçilen uçağın kapasitesine göre koltuk düzenini kontrol eder.
     * AM4 Kuralı: Economy=1, Business=2, First=3 birim yer kaplar.
     * @returns {boolean} Kapasite uygunsa true, aşılmışsa false döner.
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
        
        // Kapasite hesaplama mantığı (Y + J*2 + F*3)
        const usedCapacity = config.y + (config.j * 2) + (config.f * 3);
        const remaining = plane.capacity - usedCapacity;
        
        if (!infoDiv) return usedCapacity <= plane.capacity;

        if (remaining < 0) {
            infoDiv.className = "status-box status-danger";
            infoDiv.innerText = `Kapasite Aşıldı! (${usedCapacity} / ${plane.capacity})`;
            return false;
        } else {
            infoDiv.className = "status-box status-success";
            infoDiv.innerText = `Kapasite Uygun: ${usedCapacity} / ${plane.capacity} (Kalan Boş: ${remaining})`;
            return true;
        }
    },

    /**
     * AM4-CC (Command Center) Standart İdeal Fiyat Katsayıları (1.1x Easy Mode)
     * @param {number} distance - Rota mesafesi
     * @returns {Object} Sınıf bazlı bilet fiyatları
     */
    getTicketMultipliers: function(distance) {
        return {
            y: ((0.4 * distance) + 170) * 1.1,
            j: ((0.8 * distance) + 560) * 1.1,
            f: ((1.2 * distance) + 1200) * 1.1
        };
    }
};
