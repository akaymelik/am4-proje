/**
 * 1. Uçuş Süresi Hesabı
 * Mesafeyi hıza böler ve üzerine 0.5 saat (30 dakika) operasyonel hazırlık süresi ekler.
 */
function calculateFlightTime(distance, speed) {
    return (distance / speed) + 0.5;
}

/**
 * 2. Rota Bazlı Net Kar Hesabı 
 * Belirli bir uçak ve rota kombinasyonu için tek seferlik net kârı hesaplar.
 */
function calculateRouteProfit(plane, route) {
    // AM4 yaklaşık bilet fiyatı formülü: (Mesafe * 0.4) + 150
    const ecoTicket = (route.distance * 0.4) + 150; 
    const grossRevenue = plane.capacity * ecoTicket;

    // Maliyetler: Yakıt ve Personel
    const fuelCost = route.distance * plane.fuel_consumption * 1.5; 
    const staffCost = plane.capacity * 2; 
    
    return grossRevenue - (fuelCost + staffCost);
}

/**
 * 3. En Karlı Rotayı ve ROI Süresini Bulma 
 * Verilen bir uçak için planes.js içindeki popularRoutes listesinden en karlı olanı seçer.
 */
function analyzeBestRouteForPlane(planeName) {
    const plane = aircraftData[planeName];
    if (!plane) return null;

    let bestRoute = null;
    let maxDailyProfit = 0;

    // planes.js içindeki popularRoutes listesini tara
    popularRoutes.forEach(route => {
        // Menzil kontrolü: Uçağın menzili bu rota için yeterli mi? 
        if (route.distance <= plane.range) {
            const profitPerFlight = calculateRouteProfit(plane, route);
            const flightTime = calculateFlightTime(route.distance, plane.cruise_speed);
            
            // 24 saatlik bir güne kaç sefer sığar?
            const dailyTrips = Math.floor(24 / flightTime);
            if (dailyTrips > 0) {
                const dailyProfit = profitPerFlight * dailyTrips;

                // Eğer bu rota şu ana kadarki en karlı rotaysa, kaydet
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
        }
    });
    return bestRoute;
}

/**
 * 4. Bütçeye Göre En Karlı Uçakları Bulma
 * Kullanıcının bütçesine uyan uçakları ve o uçakların en iyi rotalarını listeler.
 */
function findBestPlanes(budget) {
    let matches = [];
    for (let name in aircraftData) {
        const p = aircraftData[name];
        if (p.price <= budget) {
            const bestRouteInfo = analyzeBestRouteForPlane(name);
            if (bestRouteInfo) {
                matches.push({
                    name: name,
                    roi: parseFloat(bestRouteInfo.roiDays),
                    // UI'da "Nereden ➔ Nereye" göstermek için her iki bilgiyi de ekliyoruz
                    bestRouteOrigin: bestRouteInfo.origin, 
                    bestRouteDest: bestRouteInfo.destination,
                    price: p.price
                });
            }
        }
    }
    // En düşük ROI (en hızlı amorti olan) uçağı en başa getir
    return matches.sort((a, b) => a.roi - b.roi);
}
