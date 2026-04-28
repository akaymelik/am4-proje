/**
 * configurator.js: Koltuk yapılandırması, kapasite yönetimi ve bilet fiyatlandırma katsayıları.
 * AM4-MENOA projesi standartlarına uygun olarak geliştirilmiştir.
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
        if (!planeName || !aircraftData[planeName]) {
            this.updateInfoDisplay("Lütfen bir uçak seçin.", "neutral");
            return false;
        }

        const plane = aircraftData[planeName];
        const config = this.getSeatConfig();
        
        // Kapasite hesaplama mantığı
        const usedCapacity = config.y + (config.j * 2) + (config.f * 3);
        const remaining = plane.capacity - usedCapacity;
        
        if (remaining < 0) {
            this.updateInfoDisplay(`Kapasite Aşıldı! (${usedCapacity} / ${plane.capacity})`, "error");
            return false;
        } else {
            this.updateInfoDisplay(`Kapasite Uygun: ${usedCapacity} / ${plane.capacity} (Kalan: ${remaining})`, "success");
            return true;
        }
    },

    /**
     * Arayüzdeki kapasite bilgi kutusunu günceller.
     * @param {string} text - Mesaj
     * @param {string} status - 'success', 'error' veya 'neutral'
     */
    updateInfoDisplay: function(text, status) {
        const infoDiv = document.getElementById('capacityInfo');
        if (!infoDiv) return;

        infoDiv.innerText = text;
        
        // Renk kodları (style.css'den bağımsız olarak inline atanır)
        if (status === "success") {
            infoDiv.style.backgroundColor = "#dcfce7";
            infoDiv.style.color = "#059669";
        } else if (status === "error") {
            infoDiv.style.backgroundColor = "#fee2e2";
            infoDiv.style.color = "#ef4444";
        } else {
            infoDiv.style.backgroundColor = "#f1f5f9";
            infoDiv.style.color = "#64748b";
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
