/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Hibrit Puanlama Destekli Hesaplama Motoru.
 * Güncellemeler:
 * - Air Time (Gerçek Uçuş) ve Cycle Time (Sefer Hesabı) birbirinden ayrıldı.
 * - ROI hataları için operasyonel hazırlık süresi (0.5sa) eklendi.
 * - Kargo ve Yolcu için dinamik kâr ve verimlilik analizi stabilize edildi.
 */

const Logic = {
    /**
     * Sadece uçağın havada kaldığı süreyi hesaplar (Arayüzde gösterilir).
     * Formül: Mesafe / Hız
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed);
    },

    /**
     * Tek bir uçuşun net kârını, süresini ve günlük sefer limitlerini hesaplar.
     */
    calculateProfit: function(plane, route, seats = null, manualTrips = null) {
        // Oyun modu kontrolü (Easy: 1.1x | Realism: 1.0x)
        const currentMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'realism';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        // 1. Gerçek uçuş süresi (Görsel süre)
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        
        // 2. Operasyonel döngü süresi (AM4 Standart: +30dk hazırlık)
        // Bu süre ROI ve Sefer Sayısı hesabında uçağın fiziksel sınırlarını belirler.
        const cycleTime = airTime + 0.5; 
        
        // 3. Günlük maksimum sefer kapasitesi
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: airTime };

        let grossRevenue = 0;

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            // Mesafe dilimlerine göre kargo katsayıları
            let coef = route.distance > 5000 ? 0.47 : (route.distance > 2000 ? 0.52 : 0.56);
            const totalDailyCapacity = plane.capacity * trips;
            const totalDailyDemand = route.demand.c || (route.demand.y * 500) || 0;
            const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
            
            // Tek uçuşluk brüt gelir
            grossRevenue = (actualDailyCarry * (route.distance * coef / 100) * multiplier) / trips;
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            const prices = Configurator.getTicketMultipliers(route.distance);
            
            // Koltuklar belirtilmemişse rota talebine göre en ideal dizilimi (F>J>Y) kullan
            const activeSeats = (seats && (seats.y + seats.j + seats.f > 0)) 
                ? seats 
                : Configurator.calculateOptimalSeats(plane, route, trips);

            const carryY = Math.min(activeSeats.y * trips, route.demand.y || 0) / trips;
            const carryJ = Math.min(activeSeats.j * trips, route.demand.j || 0) / trips;
            const carryF = Math.min(activeSeats.f * trips, route.demand.f || 0) / trips;

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        // --- GİDERLER ---
        // Yakıt: Mesafe * Tüketim * Ortalama Birim Fiyat ($1.1)
        const fuelCost = route.distance * plane.fuel_consumption * 1.1;
        // Personel: Yolcu uçağı için $2.5/koltuk, Kargo için $0.01/birim
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        
        const netProfitPerFlight = grossRevenue - (fuelCost + staffCost);

        return {
            profitPerFlight: netProfitPerFlight,
            appliedTrips: trips,
            duration: airTime // Hazırlık süresi hariç süreyi UI'ya gönder
        };
    },

    /**
     * Belirli bir uçak için en kârlı 10 rotayı analiz eder.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customSeats = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        popularRoutes.forEach(route => {
            if (route.distance <= plane.range) {
                const calculation = this.calculateProfit(plane, route, customSeats, manualTrips);
                
                if (calculation.profitPerFlight > 0) {
                    const dailyProfit = calculation.profitPerFlight * calculation.appliedTrips;
                    results.push({
                        ...route,
                        profitPerFlight: calculation.profitPerFlight,
                        dailyProfit: dailyProfit,
                        dailyTrips: calculation.appliedTrips,
                        duration: calculation.duration,
                        efficiency: (dailyProfit / plane.price) * 100,
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        // Günlük kâra göre sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Hibrit Puanlama Sistemi (%30 Verimlilik + %70 Günlük Kâr)
     * Bütçeye göre en iyi uçakları bulur.
     */
    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let candidates = [];
        
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= numericBudget && p.type === type) {
                // Her uçağı kendi en iyi rotasında test et
                const topResults = this.analyzeTopRoutesForPlane(name, 1, null, manualTrips);
                if (topResults.length > 0) {
                    const best = topResults[0];
                    candidates.push({
                        name: name,
                        efficiency: best.efficiency,
                        dailyProfit: best.dailyProfit,
                        profitPerFlight: best.profitPerFlight,
                        roi: best.roiDays,
                        duration: best.duration,
                        bestRouteOrigin: best.origin,
                        bestRouteName: best.destination,
                        price: p.price,
                        appliedTrips: best.dailyTrips
                    });
                }
            }
        }

        if (candidates.length === 0) return [];

        // Skor Normalizasyonu (Hataları önlemek için || 1 koruması)
        const maxEff = Math.max(...candidates.map(c => c.efficiency)) || 1;
        const maxProfit = Math.max(...candidates.map(c => c.dailyProfit)) || 1;

        candidates.forEach(c => {
            const normEff = c.efficiency / maxEff;
            const normProfit = c.dailyProfit / maxProfit;
            // %30 ROI Verimliliği + %70 Toplam Para Kazanma Gücü
            c.finalScore = (normEff * 0.3) + (normProfit * 0.7);
        });

        // Hibrit skora göre en iyiden en kötüye sırala
        return candidates.sort((a, b) => b.finalScore - a.finalScore);
    }
};
