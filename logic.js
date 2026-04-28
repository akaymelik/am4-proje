/**
 * logic.js: Karlılık oranı (Efficiency) odaklı hesaplama motoru.
 */

function calculateFlightTime(distance, speed) {
    return (distance / speed) + 0.5;
}

function calculateRouteProfit(plane, route) {
    let grossRevenue = 0;
    if (plane.type === "cargo") {
        const cargoRate = (route.distance * 0.0004) + 0.15;
        grossRevenue = plane.capacity * cargoRate;
    } else {
        const ecoTicket = (route.distance * 0.4) + 150; 
        grossRevenue = plane.capacity * ecoTicket;
    }
    const fuelCost = route.distance * plane.fuel_consumption * 1.5; 
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2; 
    return grossRevenue - (fuelCost + staffCost);
}

function analyzeBestRouteForPlane(planeName) {
    const plane = aircraftData[planeName];
    if (!plane) return null;
    let bestRoute = null;
    let maxDailyProfit = 0;

    popularRoutes.forEach(route => {
        if (route.distance <= plane.range) {
            const profitPerFlight = calculateRouteProfit(plane, route);
            const flightTime = calculateFlightTime(route.distance, plane.cruise_speed);
            const dailyTrips = Math.floor(24 / flightTime);
            if (dailyTrips > 0) {
                const dailyProfit = profitPerFlight * dailyTrips;
                if (dailyProfit > maxDailyProfit) {
                    maxDailyProfit = dailyProfit;
                    bestRoute = {
                        ...route,
                        flightTime: flightTime.toFixed(1),
                        dailyTrips: dailyTrips,
                        dailyProfit: dailyProfit,
                        // Verimlilik: (Günlük Kar / Alış Fiyatı) * 100
                        efficiency: ((dailyProfit / plane.price) * 100).toFixed(4),
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    };
                }
            }
        }
    });
    return bestRoute;
}

function getBestPlanesByType(budget, type) {
    const numericBudget = Number(budget);
    let matches = [];
    for (let name in aircraftData) {
        const p = aircraftData[name];
        if (p.price <= numericBudget && p.type === type) {
            const best = analyzeBestRouteForPlane(name);
            if (best) {
                matches.push({
                    name: name,
                    efficiency: parseFloat(best.efficiency),
                    roi: best.roiDays,
                    origin: best.origin,
                    destination: best.destination,
                    price: p.price
                });
            }
        }
    }
    // Verimlilik oranına göre YÜKSEKTEN DÜŞÜĞE sırala
    return matches.sort((a, b) => b.efficiency - a.efficiency);
}
