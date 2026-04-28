/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Hibrit Puanlama Destekli Hesaplama Motoru.
 * Desteklenen Modlar: Easy Mode (1.1x) ve Realism (1.0x).
 * Güncelleme: %30 Verimlilik + %70 Toplam Kâr ağırlıklı puanlama sistemi entegre edildi.
 */

const Logic = {
    /**
     * Uçuş süresini hesaplar (AM4 Standart: Mesafe / Hız + 0.5sa Hazırlık Süresi).
     * @param {number} distance - Rota mesafesi (km)
     * @param {number} speed - Uçağın seyir hızı (km/s)
     * @returns {number} Toplam uçuş süresi (ondalık saat)
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed) + 0.5;
    },

    /**
     * Tek bir uçuşun net kârını, süresini ve uygulanabilir sefer sayısını hesaplar.
     */
    calculateProfit: function(plane, route, seats = null, manualTrips = null) {
        // Global gameMode değişkenini kontrol et (Varsayılan: easy)
        const currentMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'easy';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        const flightTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const maxTrips = Math.floor(24 / flightTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: flightTime };

        let grossRevenue = 0;

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            // Mesafe dilimlerine göre kargo gelir katsayıları
            let coef = route.distance > 5000 ? 0.47 : (route.distance > 2000 ? 0.52 : 0.56);
            
            const totalDailyCapacity = plane.capacity * trips;
            
            // Eğer routes.js içinde 'c' verisi yoksa yolcu talebini kargoya simüle et
            const totalDailyDemand = route.demand.c || (route.demand.y * 500) || 0;
            
            // Pazar darboğazı kontrolü
            const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
            
            grossRevenue = (actualDailyCarry * (route.distance * coef / 100) * multiplier) / trips;
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            const prices = Configurator.getTicketMultipliers(route.distance);
            
            // Eğer koltuklar girilmemişse, potansiyel kâr için tam kapasiteyi baz al
            const activeSeats = (seats && (seats.y + seats.j + seats.f > 0)) 
                ? seats 
                : { y: plane.capacity, j: 0, f: 0 };

            const carryY = Math.min(activeSeats.y * trips, route.demand.y || 0) / trips;
            const carryJ = Math.min(activeSeats.j * trips, route.demand.j || 0) / trips;
            const carryF = Math.min(activeSeats.f * trips, route.demand.f || 0) / trips;

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        // --- GİDERLER ---
        const fuelCost = route.distance * plane.fuel_consumption * 1.1; // Yakıt birim maliyeti $1.1
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        
        const netProfitPerFlight = grossRevenue - (fuelCost + staffCost);

        return {
            profitPerFlight: netProfitPerFlight,
            appliedTrips: trips,
            duration: flightTime
        };
    },

    /**
     * Belirli bir uçak için en kârlı 10 rotayı analiz eder.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customSeats = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        const isSeatsEmpty = !customSeats || (customSeats.y + customSeats.j + customSeats.f === 0);

        popularRoutes.forEach(route => {
            if (route.distance <= plane.range) {
                let seatsToUse = customSeats;
                
                // Akıllı Analiz: Koltuklar boşsa rota talebine göre en iyi dizilimi hesapla
                if (plane.type === "passenger" && isSeatsEmpty) {
                    seatsToUse = Configurator.calculateOptimalSeats(plane, route, manualTrips);
                }

                const calculation = this.calculateProfit(plane, route, seatsToUse, manualTrips);
                
                if (calculation.profitPerFlight > 0) {
                    const dailyProfit = calculation.profitPerFlight * calculation.appliedTrips;
                    results.push({
                        ...route,
                        dailyProfit: dailyProfit,
                        dailyTrips: calculation.appliedTrips,
                        duration: calculation.duration,
                        efficiency: (dailyProfit / plane.price) * 100, // Ham veri olarak tutulur, UI formatlar
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        // En yüksek günlük kâra göre sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Hibrit Puanlama Sistemi (%30 Verimlilik + %70 Toplam Günlük Kâr)
     * Verilen bütçeye göre en mantıklı uçakları bulur.
     */
    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let candidates = [];
        
        // 1. Adım: Uygun uçakları listele ve performanslarını al
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= numericBudget && p.type === type) {
                const topResults = this.analyzeTopRoutesForPlane(name, 1, null, manualTrips);
                if (topResults.length > 0) {
                    const best = topResults[0];
                    candidates.push({
                        name: name,
                        efficiency: best.efficiency,
                        dailyProfit: best.dailyProfit,
                        roi: best.roiDays,
                        duration: best.duration,
                        bestRouteOrigin: best.origin,
                        bestRouteName: best.destination,
                        price: p.price
                    });
                }
            }
        }

        if (candidates.length === 0) return [];

        // 2. Adım: Normalizasyon için en yüksek değerleri belirle
        const maxEff = Math.max(...candidates.map(c => c.efficiency));
        const maxProfit = Math.max(...candidates.map(c => c.dailyProfit));

        // 3. Adım: Hibrit Skor Hesaplama
        candidates.forEach(c => {
            const normalizedEff = maxEff > 0 ? (c.efficiency / maxEff) : 0;
            const normalizedProfit = maxProfit > 0 ? (c.dailyProfit / maxProfit) : 0;
            
            // Hibrit Puan: %30 Verimlilik + %70 Günlük Kâr
            c.finalScore = (normalizedEff * 0.3) + (normalizedProfit * 0.7);
        });

        // 4. Adım: Final skoruna göre sırala
        return candidates.sort((a, b) => b.finalScore - a.finalScore);
    }
};
