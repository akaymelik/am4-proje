/**
 * logic.js: Uçak ve Rota Analiz Motoru.
 * GÜNCELLEME: Uçak önerilerinde 'bestRouteOrigin' desteği eklendi.
 */

const FUEL_PRICE = 950; // $/1000lbs, piyasa ortalaması
const COST_INDEX = 200; // varsayılan CI
const MAX_FLEET_SIZE = 30;
const DAILY_AVAILABLE_HOURS = 18; // kullanıcı uyku/iş için günde max 18 saat aktif olabilir (manuel kaldırma şart)

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
        const maxTrips = Math.floor(DAILY_AVAILABLE_HOURS / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0 };

        const prices = Configurator.getTicketMultipliers(route.distance);
        let grossRevenue = 0;

        if (plane.type === "cargo") {
            // Cargo demand var mı? Legacy (c) veya yeni (l/h) format
            const hasCargo = route.demand && (route.demand.c || route.demand.l || route.demand.h);
            if (!hasCargo) return { profitPerFlight: 0 };
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

    /**
     * Tek bir (hub, dest) çiftini calculateProfit'e geçirip results'a kârlıysa ekler.
     * analyzeTopRoutesForPlane'in iç döngüsü için yardımcı — code dup azaltır.
     */
    _evalRoute: function(plane, hub, dest, manualTrips, results) {
        const dl = window.dataLoader;
        const dist = dl.getDistance(hub.iata, dest.iata);
        if (dist == null || dist === 0 || dist > plane.range) return;
        const demand = dl.getDemand(hub.iata, dest.iata);
        if (!demand) return;
        if (plane.type === 'cargo' && !demand.l && !demand.h) return;

        const route = {
            origin: `${hub.name} (${hub.iata}), ${hub.country}`,
            destination: `${dest.name} (${dest.iata}), ${dest.country}`,
            distance: dist,
            demand: { y: demand.y, j: demand.j, f: demand.f, l: demand.l, h: demand.h }
        };

        const calc = this.calculateProfit(plane, route, null, manualTrips);
        if (calc.profitPerFlight <= 0 || !calc.appliedTrips) return;
        const dailyProfit = calc.profitPerFlight * calc.appliedTrips;
        results.push({
            ...route,
            dailyProfit,
            dailyTrips: calc.appliedTrips,
            duration: calc.duration,
            efficiency: (dailyProfit / plane.price) * 100
        });
    },

    /**
     * Unified rota analizi — tek kaynak: dataLoader.
     *  - hubIata varsa: o hub'tan tüm 3906 destinasyona scan (~30ms)
     *  - hubIata yoksa: top 5 hub × tüm destinasyonlar = ~20K iter/plane
     * Top 5 hub seçimi: getBestPlanesByType binlerce plane × global scan donduruyordu (32M iter).
     * 5 hub majör havalimanlarını kapsar, getBestPlanesByType için yeterli; rota analizi
     * sayfasında kullanıcı zaten hub seçiyor, hub'sız global mod nadir kullanım.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, manualTrips = null, hubIata = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];
        const dl = window.dataLoader;
        if (!dl || !dl.isReady()) return [];

        const results = [];

        if (hubIata) {
            const hub = dl.getAirport(hubIata);
            if (!hub) return [];
            for (const dest of dl.airports) {
                if (dest.iata === hubIata) continue;
                this._evalRoute(plane, hub, dest, manualTrips, results);
            }
        } else {
            const topHubs = dl.getTopHubs(5);
            for (const hubInfo of topHubs) {
                const hub = dl.airports[hubInfo.pos];
                for (const dest of dl.airports) {
                    if (dest.iata === hub.iata) continue;
                    this._evalRoute(plane, hub, dest, manualTrips, results);
                }
            }
        }

        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    getBestPlanesByType: function(budget, type, manualTrips = null, availableSlots = MAX_FLEET_SIZE) {
        let candidates = [];
        const budgetNum = Number(budget);
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= budgetNum && p.type === type) {
                const topRes = this.analyzeTopRoutesForPlane(name, 1, manualTrips);
                if (topRes.length > 0) {
                    const fleetSize = Math.min(Math.floor(budgetNum / p.price), MAX_FLEET_SIZE, availableSlots);
                    const fleetEfficiency = fleetSize <= 3 ? 1.0 : fleetSize <= 10 ? 0.8 : fleetSize <= 20 ? 0.6 : 0.4;
                    const totalDailyProfit = fleetSize * topRes[0].dailyProfit * fleetEfficiency;
                    candidates.push({
                        name: name,
                        efficiency: topRes[0].efficiency,
                        dailyProfit: topRes[0].dailyProfit,
                        dailyTrips: topRes[0].dailyTrips,
                        totalDailyProfit: totalDailyProfit,
                        fleetSize: fleetSize,
                        fleetEfficiency: fleetEfficiency,
                        bestRouteOrigin: topRes[0].origin,
                        bestRouteName: topRes[0].destination,
                        price: p.price
                    });
                }
            }
        }
        return candidates.sort((a, b) => b.totalDailyProfit - a.totalDailyProfit).slice(0, 10);
    }
};
