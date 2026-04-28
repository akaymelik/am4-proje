/**
 * logic.js: AM4 kâr hesaplama, rota analizi ve verimlilik sıralama motoru.
 */

/**
 * 1. Uçuş Süresi Hesabı
 * AM4 standartlarına göre (Mesafe / Hız) + 30 dakika hazırlık süresi.
 */
function calculateFlightTime(distance, speed) {
    return (distance / speed) + 0.5;
}

/**
 * 2. Rota Bazlı Net Kâr Hesabı
 * Koltuk yapılandırması (PAX) veya mesafe dilimli katsayıları (Kargo) kullanır.
 */
function calculateRouteProfit(plane, route, seats = null) {
    let grossRevenue = 0;
    const dist = route.distance || route.dist;

    if (plane.type === "cargo") {
        /**
         * Kargo Gelir Katsayıları (AM4-CC Standartları):
         * 0-2000 km: 0.56 | 2000-5000 km: 0.52 | 5000+ km: 0.47
         */
        let cargoCoefficient = 0.56;
        if (dist > 5000) cargoCoefficient = 0.47;
        else if (dist > 2000) cargoCoefficient = 0.52;

        grossRevenue = plane.capacity * (dist * cargoCoefficient / 100);
    } else {
        /**
         * Yolcu (PAX) Gelir Hesabı:
         * Eğer özel koltuk düzeni (seats) gelmemişse tam ekonomi varsayılır.
         */
        const activeSeats = seats || { y: plane.capacity, j: 0, f: 0 };
        const prices = Configurator.getTicketMultipliers(dist);
        
        grossRevenue = (activeSeats.y * prices.y) + 
                       (activeSeats.j * prices.j) + 
                       (activeSeats.f * prices.f);
    }

    // Giderler: Yakıt ve Personel maliyetleri
    const fuelCost = dist * plane.fuel_consumption * 1.2; 
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2.5; 
    
    return grossRevenue - (fuelCost + staffCost);
}

/**
 * 3. Uçak İçin En Karlı 10 Rotayı Analiz Etme
 */
function analyzeTopRoutesForPlane(planeName, limit = 10, customSeats = null) {
    const plane = aircraftData[planeName];
    if (!plane) return [];

    let routeResults = [];

    // routes.js içindeki popularRoutes listesini tarıyoruz
    popularRoutes.forEach(route => {
        if (route.distance <= plane.range) {
            const profitPerFlight = calculateRouteProfit(plane, route, customSeats);
            const flightTime = calculateFlightTime(route.distance, plane.cruise_speed);
            
            // 24 saatlik süreye sığan sefer sayısı
            const dailyTrips = Math.floor(24 / flightTime);
            
            if (dailyTrips > 0) {
                const dailyProfit = profitPerFlight * dailyTrips;
                routeResults.push({
                    ...route,
                    flightTime: flightTime.toFixed(1),
                    dailyTrips: dailyTrips,
                    dailyProfit: dailyProfit,
                    // Efficiency: Yatırılan 1$ başına günlük kâr yüzdesi
                    efficiency: ((dailyProfit / plane.price) * 100).toFixed(4),
                    roiDays: (plane.price / dailyProfit).toFixed(1)
                });
            }
        }
    });

    // Günlük kâra göre büyükten küçüğe sırala ve limiti uygula
    return routeResults
        .sort((a, b) => b.dailyProfit - a.dailyProfit)
        .slice(0, limit);
}

/**
 * 4. Bütçeye Göre En Yüksek Verimli Uçakları Bulma
 */
function getBestPlanesByType(budget, type) {
    const numericBudget = Number(budget);
    let matches = [];
    
    for (let name in aircraftData) {
        const p = aircraftData[name];
        // Bütçe ve tip kontrolü
        if (p.price <= numericBudget && p.type === type) {
            // Uçağın en iyi rotasındaki verimliliğine bakıyoruz
            const topRoutes = analyzeTopRoutesForPlane(name, 1);
            if (topRoutes.length > 0) {
                const best = topRoutes[0];
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
    
    // Verimlilik oranına göre sırala
    return matches.sort((a, b) => b.efficiency - a.efficiency);
}
