/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Hibrit Puanlama Destekli Hesaplama Motoru.
 * GÜNCELLEME: 
 * - Kargo kâr hesabı Hafif (Large) ve Ağır (Heavy) konfigürasyonuna göre revize edildi.
 * - Kargo için Configurator.calculateOptimalCargo entegrasyonu sağlandı.
 */

const Logic = {
    /**
     * Sadece uçağın havada kaldığı süreyi hesaplar (Arayüzde gösterilir).
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed);
    },

    /**
     * Tek bir uçuşun net kârını, süresini ve günlük sefer limitlerini hesaplar.
     */
    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'realism';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // 30dk hazırlık
        
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: airTime };

        let grossRevenue = 0;
        const prices = Configurator.getTicketMultipliers(route.distance);

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            // Eğer manuel kargo konfigürasyonu girilmemişse, en ideal dağılımı bul
            const activeCargo = (config && (config.l + config.h > 0)) 
                ? config 
                : Configurator.calculateOptimalCargo(plane, route, trips);

            // Talep Kontrolü (L ve H için pazar talebi sınırlandırması)
            const totalDemand = route.demand.c || (route.demand.y * 500);
            const demandL = (totalDemand * 0.7) / trips; // Tahmini L talebi
            const demandH = (totalDemand * 0.3) / trips; // Tahmini H talebi

            const carryL = Math.min(activeCargo.l, demandL);
            const carryH = Math.min(activeCargo.h, demandH);

            grossRevenue = (carryL * prices.l) + (carryH * prices.h);
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            const activeSeats = (config && (config.y + config.j + config.f > 0)) 
                ? config 
                : Configurator.calculateOptimalSeats(plane, route, trips);

            const carryY = Math.min(activeSeats.y * trips, route.demand.y || 0) / trips;
            const carryJ = Math.min(activeSeats.j * trips, route.demand.j || 0) / trips;
            const carryF = Math.min(activeSeats.f * trips, route.demand.f || 0) / trips;

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        // --- GİDERLER ---
        const fuelCost = route.distance * plane.fuel_consumption * 1.1;
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        
        const netProfitPerFlight = grossRevenue - (fuelCost + staffCost);

        return {
            profitPerFlight: netProfitPerFlight,
            appliedTrips: trips,
            duration: airTime
        };
    },

    /**
     * Belirli bir uçak için en kârlı 10 rotayı analiz eder.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customConfig = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        popularRoutes.forEach(route => {
            if (route.distance <= plane.range) {
                const calculation = this.calculateProfit(plane, route, customConfig, manualTrips);
                
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

        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Bütçeye göre en verimli uçakları listeler (%30 Verim + %70 Kâr).
     */
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
