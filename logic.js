/**
 * logic.js: Uçak ve Rota Analiz Motoru.
 * GÜNCELLEME: Uçak önerilerinde 'bestRouteOrigin' desteği eklendi.
 */

const FUEL_PRICE = 950; // $/1000lbs, piyasa ortalaması
const COST_INDEX = 200; // varsayılan CI

const Logic = {
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        const effectiveSpeed = (window.gameMode === 'easy') ? speed * 4 : speed;
        return (distance / effectiveSpeed);
    },

    calculateMaintenanceCost: function(plane, airTime) {
        return airTime * (plane.price * 0.00006) + (plane.price * 0.00001);
    },

    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; 
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0 };

        const prices = Configurator.getTicketMultipliers(route.distance);
        let grossRevenue = 0;

        if (plane.type === "cargo") {
            if (!route.demand.c) return { profitPerFlight: 0 };
            const opt = Configurator.calculateOptimalCargo(plane, route, trips);
            grossRevenue = (opt.l * prices.l) + (opt.h * prices.h);
        } else {
            const opt = Configurator.calculateOptimalSeats(plane, route, trips);
            grossRevenue = (opt.y * prices.y) + (opt.j * prices.j) + (opt.f * prices.f);
        }

        const ceilDist = Math.ceil(route.distance / 2) * 2;
        const fuelCost = ceilDist * FUEL_PRICE * (COST_INDEX / 500 + 0.6) * plane.fuel_consumption / 1000;
        const staffCost = plane.type === "cargo"
            ? (plane.capacity * 0.012 + 250) / trips
            : (plane.capacity * 8 + 250) / trips;
        const maintenanceCost = this.calculateMaintenanceCost(plane, airTime);
        
        return {
            profitPerFlight: grossRevenue - (fuelCost + staffCost + maintenanceCost),
            appliedTrips: trips,
            duration: airTime
        };
    },

    analyzeTopRoutesForPlane: function(planeName, limit = 10) {
        const plane = aircraftData[planeName];
        if (!plane) return [];
        let results = [];

        popularRoutes.forEach(route => {
            // Kargo uçağı ama rotada kargo talebi yoksa atla
            if (plane.type === "cargo" && !route.demand.c) return;
            
            if (route.distance <= plane.range) {
                const calc = this.calculateProfit(plane, route);
                if (calc.profitPerFlight > 0 && calc.appliedTrips > 0) {
                    const dailyProfit = calc.profitPerFlight * calc.appliedTrips;
                    results.push({
                        ...route,
                        dailyProfit: dailyProfit,
                        dailyTrips: calc.appliedTrips,   // ← eksik olan buydu, ui.js bunu kullanıyor
                        duration: calc.duration,
                        efficiency: (dailyProfit / plane.price) * 100
                    });
                }
            }
        });
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    getBestPlanesByType: function(budget, type) {
        let candidates = [];
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= Number(budget) && p.type === type) {
                const topRes = this.analyzeTopRoutesForPlane(name, 1);
                if (topRes.length > 0) {
                    candidates.push({
                        name: name,
                        efficiency: topRes[0].efficiency,
                        dailyProfit: topRes[0].dailyProfit,
                        bestRouteOrigin: topRes[0].origin, // Nereden
                        bestRouteName: topRes[0].destination, // Nereye
                        price: p.price
                    });
                }
            }
        }
        return candidates.sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);
    }
};
