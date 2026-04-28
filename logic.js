/**
 * logic.js: AM4 Pazar Talebi Kısıtlamalı ve Hibrit Puanlama Destekli Hesaplama Motoru.
 * Güncelleme: Uçak önerilerinde %30 Verimlilik + %70 Toplam Kâr ağırlıklandırması eklendi.
 */

const Logic = {
    /**
     * Uçuş süresini hesaplar (Mesafe / Hız + 0.5sa Hazırlık).
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed) + 0.5;
    },

    /**
     * Tek bir uçuşun net kârını hesaplar.
     */
    calculateProfit: function(plane, route, seats = null, manualTrips = null) {
        const currentMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'easy';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        const flightTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const maxTrips = Math.floor(24 / flightTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: flightTime };

        let grossRevenue = 0;

        if (plane.type === "cargo") {
            let coef = route.distance > 5000 ? 0.47 : (route.distance > 2000 ? 0.52 : 0.56);
            const totalDailyCapacity = plane.capacity * trips;
            const totalDailyDemand = route.demand.c || (route.demand.y * 500) || 0;
            const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
            grossRevenue = (actualDailyCarry * (route.distance * coef / 100) * multiplier) / trips;
        } else {
            const prices = Configurator.getTicketMultipliers(route.distance);
            const activeSeats = (seats && (seats.y + seats.j + seats.f > 0)) 
                ? seats 
                : { y: plane.capacity, j: 0, f: 0 };

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
            duration: flightTime
        };
    },

    /**
     * Belirli bir uçak için en kârlı rotayı analiz eder.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customSeats = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        const isSeatsEmpty = !customSeats || (customSeats.y + customSeats.j + customSeats.f === 0);

        popularRoutes.forEach(route => {
            if (route.distance <= plane.range) {
                let seatsToUse = customSeats;
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
                        efficiency: ((dailyProfit / plane.price) * 100),
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Hibrit Puanlama Sistemi (%30 Verimlilik + %70 Günlük Kâr)
     */
    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let candidates = [];
        
        // 1. Adım: Bütçeye uygun uçakları topla ve temel verilerini hesapla
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

        // 2. Adım: Normalizasyon için maksimum değerleri bul
        const maxEff = Math.max(...candidates.map(c => c.efficiency));
        const maxProfit = Math.max(...candidates.map(c => c.dailyProfit));

        // 3. Adım: Hibrit Puanı hesapla (%30 Eff + %70 Profit)
        candidates.forEach(c => {
            const normEff = maxEff > 0 ? c.efficiency / maxEff : 0;
            const normProfit = maxProfit > 0 ? c.dailyProfit / maxProfit : 0;
            c.finalScore = (normEff * 0.3) + (normProfit * 0.7);
        });

        // 4. Adım: Hibrit puana göre sırala
        return candidates.sort((a, b) => b.finalScore - a.finalScore);
    }
};
