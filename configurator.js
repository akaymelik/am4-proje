/**
 * configurator.js: Koltuk yapılandırması ve kapasite kontrolü işlemleri.
 */

const Configurator = {
    // Mevcut koltuk sayılarını döner
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    // Uçağın kapasite durumunu kontrol eder ve arayüzü günceller
    updateCapacityCheck: function() {
        const planeName = document.getElementById('paxRouteSelect')?.value;
        if (!planeName || !aircraftData[planeName]) return;

        const plane = aircraftData[planeName];
        const config = this.getSeatConfig();
        
        // AM4 Yer Kaplama Oranları: Eco=1, Business=2, First=3
        const usedCapacity = config.y + (config.j * 2) + (config.f * 3);
        const remaining = plane.capacity - usedCapacity;
        
        const infoDiv = document.getElementById('capacityInfo');
        if (infoDiv) {
            infoDiv.innerText = `Toplam Kapasite: ${plane.capacity} | Kullanılan: ${usedCapacity} | Kalan: ${remaining}`;
            
            if (remaining < 0) {
                infoDiv.style.backgroundColor = "#fee2e2";
                infoDiv.style.color = "#ef4444";
                infoDiv.innerText += " (Kapasite Aşıldı!)";
            } else {
                infoDiv.style.backgroundColor = "#dcfce7";
                infoDiv.style.color = "#059669";
            }
        }
        
        return remaining >= 0;
    },

    // Koltuk sınıflarına göre bilet fiyatı çarpanlarını döner (AM4-CC Standartları)
    getTicketMultipliers: function(distance) {
        return {
            y: ((0.4 * distance) + 170) * 1.1,
            j: ((0.8 * distance) + 560) * 1.1,
            f: ((1.2 * distance) + 1200) * 1.1
        };
    }
};
