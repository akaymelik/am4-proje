const Logic = {
    calculateFlightTime: (distance, speed) => (!speed || speed <= 0) ? 0 : (distance / speed),
    calculateMaintenanceCost: (plane, airTime) => airTime * (plane.price * 0.00004),

    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = window.gameMode || 'realism';
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; 
        const maxPossibleTrips = Math.floor(24 / cycleTime);
        
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxPossibleTrips) : maxPossibleTrips;
        if (trips <= 0) return { profit: 0, trips: 0 };

        const prices = Configurator.getTicketMultipliers(route.distance, currentMode);
        let dailyRevenue = 0;
        let totalPhysicalSeats = 0;

        if (plane.type === "cargo") {
            const opt = config || Configurator.calculateOptimalCargo(plane, route, trips);
            const dailyCapacity = (opt.l + opt.h) * trips;
            const totalDailyLbs = Math.min(dailyCapacity, route.demand.c || 0);
            dailyRevenue = (totalDailyLbs * prices.l) / 100; // Large fiyatı baz alınır
            totalPhysicalSeats = (opt.l + opt.h) / 1000;
        } else {
            const opt = config || Configurator.calculateOptimalSeats(plane, route, trips);
            const soldY = Math.min(opt.y * trips, route.demand.y || 0);
            const soldJ = Math.min(opt.j * trips, route.demand.j || 0);
            const soldF = Math.min(opt.f * trips, route.demand.f || 0);
            dailyRevenue = (soldY * prices.y) + (soldJ * prices.j) + (soldF * prices.f);
            totalPhysicalSeats = Number(opt.y) + Number(opt.j) + Number(opt.f);
        }

        const dailyFuelCost = (route.distance * plane.fuel_consumption * 1.15) * trips;
        const dailyStaffCost = (plane.type === "cargo" ? plane.capacity * 0.005 : totalPhysicalSeats * 2.5) * trips;
        const dailyMaintenance = this.calculateMaintenanceCost(plane, airTime) * trips;
        
        return { profit: Math.max(0, dailyRevenue - (dailyFuelCost + dailyStaffCost + dailyMaintenance)), trips: trips };
    },

    analyzeTopRoutesForPlane: function(name, limit = 10, manualConfig = null, manualTrips = null) {
        const p = aircraftData[name];
        if (!p) return [];
        let results = [];
        popularRoutes.forEach(route => {
            if (route.distance <= p.range) {
                const calc = this.calculateProfit(p, route, manualConfig, manualTrips);
                if (calc.profit > 0) {
                    results.push({ ...route, dailyProfit: calc.profit, dailyTrips: calc.trips, efficiency: (calc.profit / p.price) * 100 });
                }
            }
        });
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};
window.Logic = Logic;
