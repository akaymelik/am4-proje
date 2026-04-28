/**
 * logic.js: Süre gösterimi ve sefer sayısı limitlerini birbirinden ayıran güncel motor.
 */

const Logic = {
    /**
     * Sadece gerçek uçuş süresini hesaplar (Arayüzde gösterilecek olan).
     * Formül: Mesafe / Hız
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed);
    },

    /**
     * Sefer başına net kârı ve operasyonel döngüyü hesaplar.
     */
    calculateProfit: function(plane, route, seats = null, manualTrips = null) {
        const currentMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'realism';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        // 1. Havada geçen süre (Görsel süre)
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        
        // 2. AM4 Hazırlık dahil toplam döngü süresi (Sefer sayısı hesabı için)
        // 0.5 saat (30dk) zorunlu hazırlık payıdır.
        const cycleTime = airTime + 0.5; 
        
        // 3. Günde yapılabilecek fiziksel maksimum sefer sayısı
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: airTime };

        let grossRevenue = 0;

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            let coef = route.distance > 5000 ? 0.47 : (route.distance > 2000 ? 0.52 : 0.56);
            const totalDailyCapacity = plane.capacity * trips;
            const totalDailyDemand = route.demand.c || (route.demand.y * 500) || 0;
            const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
            grossRevenue = (actualDailyCarry * (route.distance * coef / 100) * multiplier) / trips;
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            const prices = Configurator.getTicketMultipliers(route.distance);
            const activeSeats = (seats && (seats.y + seats.j + seats.f > 0)) 
                ? seats 
                : Configurator.calculateOptimalSeats(plane, route, trips);

            const carryY = Math.min(activeSeats.y * trips, route.demand.y || 0) / trips;
            const carryJ = Math.min(activeSeats.j * trips, route.demand.j || 0) / trips;
            const carryF = Math.min(activeSeats.f * trips, route.demand.f || 0) / trips;

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        const fuelCost = route.distance * plane.fuel_consumption * 1.1;
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        const netProfitPerFlight = grossRevenue - (fuelCost + staffCost);

        return {
            profitPerFlight: netProfitPerFlight,
            appliedTrips: trips,
            duration: airTime // Burada artık hazırlık süresi OLMAYAN gerçek uçuş süresini döndürüyoruz
        };
    },

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
                        duration: calculation.duration, // Gerçek süre
                        efficiency: (dailyProfit / plane.price) * 100,
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let candidates = [];
        
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

        const maxEff = Math.max(...candidates.map(c => c.efficiency)) || 1;
        const maxProfit = Math.max(...candidates.map(c => c.dailyProfit)) || 1;

        candidates.forEach(c => {
            const normEff = c.efficiency / maxEff;
            const normProfit = c.dailyProfit / maxProfit;
            c.finalScore = (normEff * 0.3) + (normProfit * 0.7);
        });

        return candidates.sort((a, b) => b.finalScore - a.finalScore);
    }
};
