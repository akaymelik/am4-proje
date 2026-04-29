/**
 * configurator.js: Master Verilere Dayalı Konfigürasyon Algoritması.
 * GÜNCELLEME: 
 * - PAX Hiyerarşisi (F > J > Y) eklendi.
 * - Kargo %70 Kapasite Sınırı ve Large Load önceliği eklendi.
 * - Sınıf bazlı bilet çarpanları (1.10, 1.08, 1.06) entegre edildi.
 */

const Configurator = {
    /**
     * Master Veri: Bilet ve Kargo birim fiyatlarını hesaplar.
     * Easy modda sınıfa özel çarpanlar (1.10, 1.08, 1.06) uygulanır.
     */
    getTicketMultipliers: function(distance, mode = window.gameMode) {
        const isEasy = (mode === 'easy');
        
        // Yolcu Bilet Formülleri (Master Data)
        const yBase = (0.4 * distance) + 170;
        const jBase = (0.8 * distance) + 560;
        const fBase = (1.2 * distance) + 1200;

        // Kargo Gelir Formülleri (Mesafe dilimlerine göre)
        const cargoRate = (distance < 2000 ? 0.56 : distance < 5000 ? 0.52 : 0.47);
        const lBase = cargoRate * distance;
        const hBase = (cargoRate - 0.08) * distance;

        return {
            y: Math.floor(yBase * (isEasy ? 1.10 : 1.0)),
            j: Math.floor(jBase * (isEasy ? 1.08 : 1.0)),
            f: Math.floor(fBase * (isEasy ? 1.06 : 1.0)),
            l: (lBase * (isEasy ? 1.10 : 1.0)).toFixed(2),
            h: (hBase * (isEasy ? 1.08 : 1.0)).toFixed(2)
        };
    },

    /**
     * Kapasite Dolum Hiyerarşisi: Master Rehber uyarınca F > J > Y.
     * Bu fonksiyon uçağın alanını en kârlı şekilde doldurur.
     */
    calculateOptimalSeats: function(plane, route, trips = 1) {
        let remainingArea = plane.capacity;
        
        // Günlük talebi sefer sayısına bölerek uçuş başına düşen talebi bul
        const flightF = Math.floor((route.demand.f || 0) / trips);
        const flightJ = Math.floor((route.demand.j || 0) / trips);
        const flightY = Math.floor((route.demand.y || 0) / trips);

        // 1. Önce First Class (F) - Her koltuk 3 birim yer kaplar
        const f = Math.min(flightF, Math.floor(remainingArea / 3));
        remainingArea -= f * 3;

        // 2. Kalan yere Business (J) - Her koltuk 2 birim yer kaplar
        const j = Math.min(flightJ, Math.floor(remainingArea / 2));
        remainingArea -= j * 2;

        // 3. En son kalan tüm boşluğa Economy (Y)
        const y = Math.min(flightY, remainingArea);
        
        return { y, j, f };
    },

    /**
     * Master Kargo Kuralı: %100 Large Load konfigürasyonu kapasitenin %70'ini kullanır.
     * Large Load her zaman Heavy Load'dan daha kârlıdır.
     */
    calculateOptimalCargo: function(plane, route, trips = 1) {
        // Master Veri: Nominal kapasitenin %70'i Large Load limitidir.
        const effectiveCap = plane.capacity * 0.7; 
        const demandPerFlight = (route.demand.c || 0) / trips;
        
        // Large Load öncelikli doldurma
        const l = Math.min(demandPerFlight, Math.floor(effectiveCap));
        return { l: Math.floor(l), h: 0 };
    },

    /**
     * UI üzerindeki kapasite çubuğunu ve uyarılarını günceller.
     */
    updateCapacityCheck: function() {
        const isPax = document.getElementById('pax-route').classList.contains('active');
        const planeName = document.getElementById(isPax ? 'paxRouteSelect' : 'cargoRouteSelect').value;
        if (!planeName) return;

        const p = aircraftData[planeName];
        let used = 0;
        
        if (isPax) {
            used = Number(document.getElementById('seatsY').value || 0) + 
                   (Number(document.getElementById('seatsJ').value || 0) * 2) + 
                   (Number(document.getElementById('seatsF').value || 0) * 3);
        } else {
            used = Number(document.getElementById('cargoL').value || 0) + 
                   Number(document.getElementById('cargoH').value || 0);
        }

        const info = document.getElementById(isPax ? 'capacityInfo' : 'cargoCapacityInfo');
        // Kargo için Master %70 limitini baz al
        const maxCap = (p.type === "cargo") ? p.capacity * 0.7 : p.capacity;
        
        const remaining = Math.floor(maxCap - used);
        info.innerText = `Kullanılan: ${used} / Limit: ${Math.floor(maxCap)} (${remaining >= 0 ? remaining + ' boş' : 'LİMİT AŞILDI!'})`;
        
        info.className = "status-box " + (used > maxCap ? "status-danger" : "status-success");
    },

    /**
     * Analiz sonuçlarından gelen ideal değerleri inputlara aktarır.
     */
    applySuggestion: function(v1, v2, v3 = null) {
        if (v3 !== null) {
            document.getElementById('seatsY').value = v1;
            document.getElementById('seatsJ').value = v2;
            document.getElementById('seatsF').value = v3;
        } else {
            document.getElementById('cargoL').value = v1;
            document.getElementById('cargoH').value = v2;
        }
        this.updateCapacityCheck();
        
        // Kullanıcıyı yukarıdaki konfigürasyon paneline yumuşak bir geçişle taşır
        const targetId = v3 !== null ? 'paxRouteSelect' : 'cargoRouteSelect';
        const anchor = document.getElementById(targetId);
        if (anchor) {
            window.scrollTo({ top: anchor.offsetTop - 100, behavior: 'smooth' });
        }
    }
};

// Global erişim için bağla
window.Configurator = Configurator;
