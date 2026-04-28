// 1. Uçuş Süresi Hesabı (Mesafe / Hız + 0.5 saat hazırlık süresi) [cite: 19, 21]
function calculateFlightTime(distance, speed) {
    return (distance / speed) + 0.5;
}

// 2. Rota Bazlı Net Kar Hesabı 
function calculateRouteProfit(plane, route) {
    // Gelir: Ortalama bilet fiyatı (Mesafe * 0.4 + 150) * Kapasite 
    const ecoTicket = (route.distance * 0.4) + 150; 
    const grossRevenue = plane.capacity * ecoTicket;

    // Giderler: Yakıt tüketimi ve Personel maliyeti 
    const fuelCost = route.distance * plane.fuel_consumption * 1.5; 
    const staffCost = plane.capacity * 2; 
    
    return grossRevenue - (fuelCost + staffCost);
}

// 3. En Karlı Rotayı ve ROI Süresini Bulma 
function analyzeBestRouteForPlane(planeName) {
    const plane = aircraftData[planeName];
    let bestRoute = null;
    let maxDailyProfit = 0;

    // popularRoutes listesini (planes.js'deki) tara
    popularRoutes.forEach(route => {
        // Menzil kontrolü: Uçak bu rotaya gidebilir mi? 
        if (route.distance <= plane.range) {
            const profitPerFlight = calculateRouteProfit(plane, route);
            const flightTime = calculateFlightTime(route.distance, plane.cruise_speed);
            
            // 24 saate kaç sefer sığar?
            const dailyTrips = Math.floor(24 / flightTime);
            const dailyProfit = profitPerFlight * dailyTrips;

            if (dailyProfit > maxDailyProfit) {
                maxDailyProfit = dailyProfit;
                bestRoute = {
                    ...route,
                    flightTime: flightTime.toFixed(1),
                    dailyTrips: dailyTrips,
                    dailyProfit: dailyProfit,
                    roiDays: (plane.price / dailyProfit).toFixed(1)
                };
            }
        }
    });
    return bestRoute;
}

// Bütçeye göre en karlı uçağı bulma fonksiyonunu da buna göre güncelliyoruz 
function findBestPlanes(budget) {
    let matches = [];
    for (let name in aircraftData) {
        const p = aircraftData[name];
        if (p.price <= budget) {
            const bestRouteInfo = analyzeBestRouteForPlane(name);
            if (bestRouteInfo) {
                matches.push({
                    name: name,
                    roi: bestRouteInfo.roiDays,
                    bestRouteName: bestRouteInfo.destination,
                    ...p
                });
            }
        }
    }
    return matches.sort((a, b) => a.roi - b.roi);
}
