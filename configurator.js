/**
 * configurator.js: Master Verilere Dayalı Konfigürasyon ve Fiyatlandırma Modülü.
 * GÜNCELLEME: 
 * - Bilet çarpanları (1.10, 1.08, 1.06) aşağı yuvarlanarak (floor) Master kurallarına bağlandı.
 * - PAX Hiyerarşisi (F > J > Y) kâr maksimizasyonu için önceliklendirildi.
 * - Kargo %70 Kapasite Sınırı ve Large Load önceliği eklendi.
 */

const Configurator = {
    /**
     * Master Veri: Bilet ve Kargo birim fiyatlarını hesaplar.
     * Easy modda sınıfa özel çarpanlar (Y:1.10, J:1.08, F:1.06) uygulanır.
     */
    getTicketMultipliers: function(distance, mode = window.gameMode) {
        const isEasy = (mode === 'easy');
        
        // Yolcu Bilet Formülleri (Master Data - Auto Price x Multiplier)
        // Master Kuralı: Hesaplanan fiyatlar 1$ aşağı yuvarlanmalıdır.
        const yPrice = ((0.4 * distance) + 170) * (isEasy ? 1.10 : 1.0);
        const jPrice = ((0.8 * distance) + 560) * (isEasy ? 1.08 : 1.0);
        const fPrice = ((1.2 * distance) + 1200) * (isEasy ? 1.06 : 1.0);

        // Kargo Gelir Formülleri (Mesafe dilimlerine göre katsayı seçimi)
        const cargoRate = (distance < 2000 ? 0.56 : distance < 5000 ? 0.52 : 0.47);
        const lPrice = cargoRate * (isEasy ? 1.10 : 1.0) * distance;
        const hPrice = (cargoRate - 0.08) * (isEasy ? 1.08 : 1.0) * distance;

        return {
            y: Math.floor(yPrice),
            j: Math.floor(jPrice),
            f: Math.floor(fPrice),
            l: lPrice, // logic.js içinde /100 işlemi yapılır
            h: hPrice
        };
    },

    /**
     * Kapasite Dolum Hiyerarşisi: Master Rehber uyarınca F > J > Y.
     * Bu fonksiyon uçağın alanını en kârlı sınıflardan başlayarak doldurur.
     */
    calculateOptimalSeats: function(plane, route, trips = 1) {
        let remainingArea = plane.capacity;
        
        // Günlük talebi sefer sayısına bölerek uçuş başına düşen talebi bul
        const flightF = Math.floor((route.demand.f || 0) / trips);
        const flightJ = Math.floor((route.demand.j || 0) / trips);
        const flightY = Math.floor((route.demand.y || 0) / trips);

        // 1. Önce First Class (F) - Her koltuk 3 birim yer kaplar
        const f = Math.min(flightF, Math.floor(remainingArea / 3));
        remainingArea -= (f * 3);

        // 2. Kalan yere Business (J) - Her koltuk 2 birim yer kaplar
        const j = Math.min(flightJ, Math.floor(remainingArea / 2));
        remainingArea -= (j * 2);

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
     * Uçağın fiziksel limitlerini kontrol eder.
     */
    updateCapacityCheck: function() {
        const isPax = document.getElementById('pax-route').classList.contains('active');
        const planeName = document.getElementById(isPax ? 'paxRouteSelect' : 'cargoRouteSelect').value;
        if (!planeName) return;

        const p = aircraftData[planeName];
        let used = 0;
        
        if (isPax) {
            used = (Number(document.getElementById('seatsY').value) || 0) + 
                   (Number(document.getElementById('seatsJ').value) * 2 || 0) + 
                   (Number(document.getElementById('seatsF').value) * 3 || 0);
        } else {
            used = (Number(document.getElementById('cargoL').value) || 0) + 
                   (Number(document.getElementById('cargoH').value) || 0);
        }

        const info = document.getElementById(isPax ? 'capacityInfo' : 'cargoCapacityInfo');
        // Kargo için Master %70 limitini baz al, Yolcu için tam kapasite
        const maxCap = (p.type === "cargo") ? p.capacity * 0.7 : p.capacity;
        
        const remaining = Math.floor(maxCap - used);
        
        if (used > maxCap) {
            info.innerText = `LİMİT AŞILDI! (${used} / ${Math.floor(maxCap)})`;
            info.className = "status-box status-danger";
        } else {
            info.innerText = `Kapasite: ${used} / ${Math.floor(maxCap)} (${remaining} boş)`;
            info.className = "status-box status-success";
        }
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
        
        // Kapasite bilgisini anlık güncelle
        this.updateCapacityCheck();
        
        // Kullanıcıyı yukarıdaki konfigürasyon paneline yumuşak bir geçişle taşır
        const targetId = v3 !== null ? 'paxRouteSelect' : 'cargoRouteSelect';
        const anchor = document.getElementById(targetId);
        if (anchor) {
            window.scrollTo({ top: anchor.offsetTop - 100, behavior: 'smooth' });
        }
    }
};

// Modüler erişim için global pencereye bağla
window.Configurator = Configurator;
