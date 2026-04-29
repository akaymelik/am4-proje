/**
 * configurator.js: Rota bazlı dinamik koltuk ve kargo optimizasyonu.
 * AM4 Standartları: 
 * - Yolcu: Economy (1), Business (2), First (3) birim yer kaplar.
 * - Kargo: Hafif (Large-L) ve Ağır (Heavy-H) yükler 1:1 oranında kapasite kullanır.
 * Güncelleme: Kargo L/H fiyat katsayıları ve pazar talebi bölüştürme mantığı eklendi.
 */

const Configurator = {
    /**
     * Kullanıcının arayüzden girdiği koltuk sayılarını (PAX) çeker.
     */
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    /**
     * Kullanıcının arayüzden girdiği kargo yük miktarlarını (Cargo) çeker.
     */
    getCargoConfig: function() {
        return {
            l: parseInt(document.getElementById('cargoL')?.value) || 0,
            h: parseInt(document.getElementById('cargoH')?.value) || 0
        };
    },

    /**
     * Rota talebine göre en kârlı kargo dağılımını hesaplar.
     * AM4 Kuralı: Ağır (Heavy) yük birim başına her zaman daha çok kazandırır.
     */
    calculateOptimalCargo: function(plane, route, manualTrips = null) {
        const airTime = Logic.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // 30dk hazırlık payı
        const maxTrips = Math.floor(24 / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;

        if (trips <= 0) return { l: 0, h: 0 };

        // Toplam kargo talebi (Veritabanında 'c' yoksa yolcu talebinden simüle edilir)
        const totalDailyDemand = route.demand.c || (route.demand.y * 500) || 0;
        const perFlightDemand = Math.floor(totalDailyDemand / trips);

        // Kargo dağılımı: Ağır yük daha kârlı olduğu için önce kapasiteyi onunla doldur.
        // AM4 pazar standardı: Talebin yaklaşık %30'u Ağır (H), %70'i Hafif (L) yükten oluşur.
        let demandH = Math.floor(perFlightDemand * 0.3);
        let demandL = perFlightDemand - demandH;

        let remCap = plane.capacity;
        let sH = Math.min(demandH, remCap); // Önce Ağır Yükü doldur
        remCap -= sH;
        let sL = Math.min(demandL, remCap); // Kalan boşluğa Hafif Yük koy
        
        return { l: sL, h: sH };
    },

    /**
     * Uçak ve rota için en kârlı koltuk dağılımını hesaplar (PAX).
     * Kar Önceliği: First (3x) > Business (2x) > Economy (1x)
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
        
        // 1. Önce First Class (Kapasite başına en kârlı)
        let sF = Math.min(maxF, Math.floor(remCap / 3));
        remCap -= (sF * 3);
        
        // 2. Sonra Business Class
        let sJ = Math.min(maxJ, Math.floor(remCap / 2));
        remCap -= (sJ * 2);
        
        // 3. Kalan her yer Economy
        let sY = Math.min(maxY, remCap);
        
        return { y: sY, j: sJ, f: sF };
    },

    /**
     * Uçağın kapasite durumunu kontrol eder ve görsel geri bildirim verir.
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
            // PAX Formülü: Y + 2J + 3F
            used = config.y + (config.j * 2) + (config.f * 3);
        } else {
            const config = this.getCargoConfig();
            // Cargo Formülü: L + H (1:1 oran)
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
     * Analiz sonuçlarından gelen ideal değerleri otomatik olarak giriş alanlarına aktarır.
     */
    applySuggestion: function(v1, v2, v3 = null) {
        if (v3 !== null) { // Yolcu Modu (Y, J, F)
            document.getElementById('seatsY').value = v1;
            document.getElementById('seatsJ').value = v2;
            document.getElementById('seatsF').value = v3;
        } else { // Kargo Modu (L, H)
            document.getElementById('cargoL').value = v1;
            document.getElementById('cargoH').value = v2;
        }
        
        // Değerler aktarıldıktan sonra kapasite kutusunu güncelle
        this.updateCapacityCheck();
        
        // Kullanıcıyı ayarlar kısmına yumuşak kaydır
        const focusId = v3 !== null ? 'paxRouteSelect' : 'cargoRouteSelect';
        const anchor = document.getElementById(focusId);
        if (anchor) {
            const navOffset = 90;
            const elementPosition = anchor.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({ top: elementPosition - navOffset, behavior: 'smooth' });
        }
    },

    /**
     * Aktif oyun moduna (Easy/Realism) göre bilet ve yük fiyatlarını döndürür.
     * Formüller AM4 Command Center standartlarındadır.
     */
    getTicketMultipliers: function(distance) {
        const mode = window.gameMode || 'realism';
        const multiplier = mode === 'easy' ? 1.1 : 1.0;
        
        return {
            // --- Yolcu Bilet Fiyatları ---
            y: ((0.4 * distance) + 170) * multiplier,
            j: ((0.8 * distance) + 560) * multiplier,
            f: ((1.2 * distance) + 1200) * multiplier,
            
            // --- Kargo Yük Fiyatları ---
            l: ((0.07 * distance) + 50) * multiplier, // Hafif (Large)
            h: ((0.11 * distance) + 150) * multiplier  // Ağır (Heavy)
        };
    }
};
