/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Hibrit Puanlama Destekli Hesaplama Motoru.
 * GÜNCELLEME: 
 * - Kargo için yolcu talebinden kargo üretme (fallback) mantığı tamamen kaldırıldı.
 * - Sadece 'c' (Cargo) verisi olan rotalar kargo analizinde görünür.
 */

const Logic = {
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed);
    },

    calculateMaintenanceCost: function(plane, airTime) {
        const hourlyRate = (plane.price * 0.00004); 
        return airTime * hourlyRate;
    },

    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'realism';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; 
        
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: airTime, demandWarning: false };

        let grossRevenue = 0;
        let demandWarning = false;
        const prices = Configurator.getTicketMultipliers(route.distance);

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            // SADECE EĞER ROTA NESNESİNDE 'c' VERİSİ VARSA HESAPLA
            if (!route.demand.c) return { profitPerFlight: 0, appliedTrips: 0, duration: airTime, demandWarning: false };

            const activeCargo = (config && (config.l + config.h > 0)) 
                ? config 
                : Configurator.calculateOptimalCargo(plane, route, trips);

            const totalDemand = route.demand.c;
            const demandPerFlight = totalDemand / trips;

            if ((activeCargo.l + activeCargo.h) > demandPerFlight) demandWarning = true;

            const carryL = Math.min(activeCargo.l, demandPerFlight * 0.7);
            const carryH = Math.min(activeCargo.h, demandPerFlight * 0.3);
            grossRevenue = (carryL * prices.l) + (carryH * prices.h);
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            const activeSeats = (config && (config.y + config.j + config.f > 0)) 
                ? config 
                : Configurator.calculateOptimalSeats(plane, route, trips);

            const demandY = (route.demand.y || 0) / trips;
            const demandJ = (route.demand.j || 0) / trips;
            const demandF = (route.demand.f || 0) / trips;

            if (activeSeats.y > demandY || activeSeats.j > demandJ || activeSeats.f > demandF) {
                demandWarning = true;
            }

            const carryY = Math.min(activeSeats.y, demandY);
            const carryJ = Math.min(activeSeats.j, demandJ);
            const carryF = Math.min(activeSeats.f, demandF);

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        const fuelCost = route.distance * plane.fuel_consumption * 1.1;
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        const maintenanceCost = this.calculateMaintenanceCost(plane, airTime);
        
        const netProfitPerFlight = grossRevenue - (fuelCost + staffCost + maintenanceCost);

        return {
            profitPerFlight: netProfitPerFlight,
            appliedTrips: trips,
            duration: airTime,
            maintenanceCost: maintenanceCost,
            demandWarning: demandWarning
        };
    },

    analyzeTopRoutesForPlane: function(planeName, limit = 10, customConfig = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        popularRoutes.forEach(route => {
            // Eğer uçak kargo ise ve rotada kargo talebi yoksa, bu rotayı doğrudan atla
            if (plane.type === "cargo" && !route.demand.c) return;

            if (route.distance <= plane.range) {
                const calc = this.calculateProfit(plane, route, customConfig, manualTrips);
                if (calc.profitPerFlight > 0) {
                    const dailyProfit = calc.profitPerFlight * calc.appliedTrips;
                    results.push({
                        ...route,
                        profitPerFlight: calc.profitPerFlight,
                        dailyProfit: dailyProfit,
                        dailyTrips: calc.appliedTrips,
                        duration: calc.duration,
                        efficiency: (dailyProfit / plane.price) * 100,
                        roiDays: (plane.price / dailyProfit).toFixed(1),
                        demandWarning: calc.demandWarning,
                        maintenanceCost: calc.maintenanceCost
                    });
                }
            }
        });

        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    getBestPlanesByType: function(budget, type, manualTrips = null) {
        let candidates = [];
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= Number(budget) && p.type === type) {
                const topRes = this.analyzeTopRoutesForPlane(name, 1, null, manualTrips);
                if (topRes.length > 0) {
                    const best = topRes[0];
                    candidates.push({
                        name: name,
                        efficiency: best.efficiency,
                        dailyProfit: best.dailyProfit,
                        profitPerFlight: best.profitPerFlight,
                        roi: best.roiDays,
                        bestRouteOrigin: best.origin,
                        bestRouteName: best.destination,
                        price: p.price,
                        appliedTrips: best.dailyTrips,
                        finalScore: 0 
                    });
                }
            }
        }
        if (candidates.length === 0) return [];
        const maxEff = Math.max(...candidates.map(c => c.efficiency)) || 1;
        const maxProfit = Math.max(...candidates.map(c => c.dailyProfit)) || 1;
        candidates.forEach(c => {
            c.finalScore = ((c.efficiency / maxEff) * 0.3) + ((c.dailyProfit / maxProfit) * 0.7);
        });
        return candidates.sort((a, b) => b.finalScore - a.finalScore);
    }
};
