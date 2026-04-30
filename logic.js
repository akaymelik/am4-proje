/**
 * logic.js: AM4 Strateji Motoru.
 * GÜNCELLEME: Dinamik Talep Kilidi (Daily Demand Cap) eklendi.
 * Artık uçağın günlük taşıdığı yolcu sayısı, rotadaki toplam talebi asla aşamaz.
 */

const Logic = {
    calculateFlightTime: (distance, speed) => (!speed || speed <= 0) ? 0 : (distance / speed),

    calculateMaintenanceCost: (plane, airTime) => airTime * (plane.price * 0.00004),

    /**
     * Kâr Hesaplama: Talebe göre dinamik sınırlandırma.
     */
    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = window.gameMode || 'realism';
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // Turnaround (30dk) dahil
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profit: 0, trips: 0 };

        // Bilet fiyatlarını çarpanlarıyla al (Configurator'dan)
        const prices = Configurator.getTicketMultipliers(route.distance, currentMode);
        
        let dailyRevenue = 0;
        let totalDailySeatsUsed = 0;

        if (plane.type === "cargo") {
            const opt = config || Configurator.calculateOptimalCargo(plane, route, trips);
            // Master Kargo Kısıtı: Günlük toplam lbs, rotadaki 'c' talebini aşamaz.
            const totalDailyLbs = Math.min((opt.l + opt.h) * trips, route.demand.c || 0);
            dailyRevenue = (totalDailyLbs * (opt.l > opt.h ? prices.l : prices.h)) / 100;
            totalDailySeatsUsed = (totalDailyLbs / trips) / 1000; // Personel yükü tahmini
        } else {
            const opt = config || Configurator.calculateOptimalSeats(plane, route, trips);
            
            // KRİTİK DÜZELTME: Günlük taşınan yolcu sayısı talebi aşamaz (Ezbere değil, veriye göre).
            const dailyY = Math.min(opt.y * trips, route.demand.y || 0);
            const dailyJ = Math.min(opt.j * trips, route.demand.j || 0);
            const dailyF = Math.min(opt.f * trips, route.demand.f || 0);
            
            dailyRevenue = (dailyY * prices.y) + (dailyJ * prices.j) + (dailyF * prices.f);
            
            // Personel maliyeti uçağın fiziksel koltuk kapasitesi üzerinden hesaplanır.
            totalDailySeatsUsed = (Number(opt.y) + Number(opt.j) + Number(opt.f)) * trips;
        }

        // Giderler
        const fuelCostTotal = (route.distance * plane.fuel_consumption * 1.15) * trips;
        const staffCostTotal = (plane.type === "cargo" ? plane.capacity * 0.005 : (totalDailySeatsUsed / trips) * 2.5) * trips;
        const maintenanceTotal = this.calculateMaintenanceCost(plane, airTime) * trips;
        
        const totalNetProfit = dailyRevenue - (fuelCostTotal + staffCostTotal + maintenanceTotal);
        
        return { 
            profit: totalNetProfit > 0 ? totalNetProfit : 0, 
            trips: trips 
        };
    },

    getBestPlanesByType: function(budget, type) {
        let candidates = [];
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= Number(budget) && p.type === type) {
                const topRes = this.analyzeTopRoutesForPlane(name, 1)[0];
                if (topRes && topRes.dailyProfit > 0) {
                    candidates.push({
                        name, ...p,
                        roiDays: p.price / topRes.dailyProfit,
                        dailyProfit: topRes.dailyProfit,
                        bestRouteOrigin: topRes.origin,
                        bestRouteName: topRes.destination,
                        efficiency: (topRes.dailyProfit / p.price) * 100
                    });
                }
            }
        }
        return candidates.sort((a, b) => (a.roiDays - b.roiDays) || (b.cruise_speed - a.cruise_speed)).slice(0, 10);
    },

    analyzeTopRoutesForPlane: function(name, limit = 10, manualConfig = null) {
        const p = aircraftData[name];
        if (!p) return [];
        let results = [];
        popularRoutes.forEach(route => {
            if (route.distance <= p.range) {
                const calc = this.calculateProfit(p, route, manualConfig);
                if (calc.profit > 0) {
                    results.push({
                        ...route,
                        dailyProfit: calc.profit,
                        dailyTrips: calc.trips,
                        efficiency: (calc.profit / p.price) * 100
                    });
                }
            }
        });
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};

window.Logic = Logic;
