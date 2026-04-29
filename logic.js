/**
 * logic.js: Uçak ve Rota Analiz Motoru.
 * GÜNCELLEME: Master Eğitim Verileri (Hız > Yakıt kuralı, bilet çarpanları) eklendi.
 */

const Logic = {
    calculateFlightTime: (distance, speed) => distance / speed,

    calculateMaintenanceCost: (plane, airTime) => airTime * (plane.price * 0.00004),

    calculateProfit: function(plane, route, manualTrips = null) {
        const currentMode = window.gameMode || 'realism';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; 
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profit: 0, trips: 0 };

        let revenue = 0;
        if (plane.type === "cargo") {
            const opt = Configurator.calculateOptimalCargo(plane, route, trips);
            // Kargo Gelir Formülü (Master Data: Large 1.1x, Heavy 1.08x)
            const prices = Configurator.getTicketMultipliers(route.distance);
            revenue = (opt.l * prices.l + opt.h * prices.h) * multiplier;
        } else {
            const opt = Configurator.calculateOptimalSeats(plane, route, trips);
            // Yolcu Gelir Formülü (Master Data: 1.1x, 1.08x, 1.06x)
            const prices = Configurator.getTicketMultipliers(route.distance);
            revenue = (opt.y * prices.y + opt.j * prices.j + opt.f * prices.f) * multiplier;
        }

        const fuelCost = route.distance * plane.fuel_consumption * 1.15; // Ortalama pazar fiyatı emniyeti
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        const maintenance = this.calculateMaintenanceCost(plane, airTime);
        
        const totalNetProfit = (revenue - (fuelCost + staffCost + maintenance)) * trips;
        return { profit: totalNetProfit, trips: trips };
    },

    getBestPlanesByType: function(budget, type) {
        let results = [];
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= budget && p.type === type) {
                // Her uçak için en kârlı rotayı bul
                const topRes = this.analyzeTopRoutesForPlane(name, 1)[0];
                if (topRes) {
                    results.push({
                        name: name,
                        efficiency: topRes.efficiency,
                        dailyProfit: topRes.dailyProfit,
                        bestRouteOrigin: topRes.origin,
                        bestRouteName: topRes.destination,
                        price: p.price
                    });
                }
            }
        }
        // ROI/Efficiency'e göre sırala (Yatırım verimliliği)
        return results.sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);
    },

    analyzeTopRoutesForPlane: function(name, limit = 10) {
        const p = aircraftData[name];
        return popularRoutes.filter(r => r.distance <= p.range).map(r => {
            const calc = this.calculateProfit(p, r);
            return {
                ...r,
                dailyProfit: calc.profit,
                dailyTrips: calc.trips,
                efficiency: (calc.profit / p.price) * 100
            };
        }).sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};
