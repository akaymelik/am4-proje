const Logic = {
    calculateFlightTime: (dist, speed) => (!speed || speed <= 0) ? 0 : (dist / speed),
    
    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const mode = window.gameMode || 'realism';
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const maxTrips = Math.floor(24 / (airTime + 0.5));
        
        let trips = (manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        if (trips <= 0) return { profit: 0, trips: 0 };

        const prices = Configurator.getTicketMultipliers(route.distance, mode);
        let revenue = 0, totalSeats = 0;

        if (plane.type === "cargo") {
            const opt = config || Configurator.calculateOptimalCargo(plane, route, trips);
            const totalLbs = Math.min((opt.l + opt.h) * trips, route.demand.c || 0);
            revenue = (totalLbs * prices.l) / 100;
            totalSeats = (opt.l + opt.h) / 1000;
        } else {
            const opt = config || Configurator.calculateOptimalSeats(plane, route, trips);
            const soldY = Math.min(opt.y * trips, route.demand.y || 0);
            const soldJ = Math.min(opt.j * trips, route.demand.j || 0);
            const soldF = Math.min(opt.f * trips, route.demand.f || 0);
            revenue = (soldY * prices.y) + (soldJ * prices.j) + (soldF * prices.f);
            totalSeats = Number(opt.y) + Number(opt.j) + Number(opt.f);
        }

        const fuel = (route.distance * plane.fuel_consumption * 1.15) * trips;
        const staff = (plane.type === "cargo" ? plane.capacity * 0.005 : totalSeats * 2.5) * trips;
        const maint = (airTime * (plane.price * 0.00004)) * trips;
        
        return { profit: Math.max(0, revenue - (fuel + staff + maint)), trips: trips };
    },

    analyzeTopRoutesForPlane: function(name, limit = 10, config = null, manualTrips = null) {
        const p = aircraftData[name];
        if (!p) return [];
        let results = [];
        popularRoutes.forEach(r => {
            if (r.distance <= p.range) {
                const c = this.calculateProfit(p, r, config, manualTrips);
                if (c.profit > 0) results.push({ ...r, dailyProfit: c.profit, dailyTrips: c.trips, efficiency: (c.profit / p.price) * 100 });
            }
        });
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};
window.Logic = Logic;
