/**
 * logic.js: AM4 Command Center katsayıları ve verimlilik odaklı hesaplama motoru.
 */

/**
 * 1. Uçuş Süresi Hesabı
 */
function calculateFlightTime(distance, speed) {
    // AM4'te uçuş süresi: (Mesafe / Hız) + 0.5 saat (A-Check ve yer hizmetleri hazırlığı)
    return (distance / speed) + 0.5;
}

/**
 * 2. Gelişmiş Rota Bazlı Net Kâr Hesabı
 * AM4 topluluğunun kabul ettiği 1.1x bilet çarpanı ve mesafe dilimli kargo oranları kullanılmıştır.
 */
function calculateRouteProfit(plane, route) {
    let grossRevenue = 0;
    const dist = route.distance;

    if (plane.type === "cargo") {
        /**
         * Kargo Gelir Katsayıları (Mesafe Dilimli):
         * 0-2000 km: 0.56 | 2000-5000 km: 0.52 | 5000+ km: 0.47
         */
        let cargoCoefficient = 0.56;
        if (dist > 5000) cargoCoefficient = 0.47;
        else if (dist > 2000) cargoCoefficient = 0.52;

        // Kargo Geliri: Kapasite * Katsayı * Mesafe (Basitleştirilmiş AM4 Formülü)
        grossRevenue = plane.capacity * (dist * cargoCoefficient / 100);
    } else {
        /**
         * Yolcu (PAX) Gelir Formülü (Easy Mode + 1.1x Multiplier):
         * İdeal Fiyat = ((0.4 * Mesafe) + 170) * 1.1
         */
        const idealPrice = ((0.4 * dist) + 170) * 1.1; 
        grossRevenue = plane.capacity * idealPrice;
    }

    // Giderler: Yakıt ve Personel (AM4 Standart Gider Tahmini)
    // Yakıt: Mesafe * Tüketim * $1.2 (Ortalama yakıt fiyatı varsayımı)
    const fuelCost = dist * plane.fuel_consumption * 1.2; 
    
    // Personel: Kapasite bazlı maaş ve servis giderleri
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2.5; 
    
    return grossRevenue - (fuelCost + staffCost);
}

/**
 * 3. En Karlı Rotayı ve Verimlilik Analizini Yapma
 */
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
                        // Verimlilik: Günlük Kâr / Uçak Maliyeti (Yatırım Getirisi Oranı)
                        efficiency: ((dailyProfit / plane.price) * 100).toFixed(4),
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    };
                }
            }
        }
    });
    return bestRoute;
}

/**
 * 4. Bütçeye ve Tipe Göre En Verimli Uçakları Listeleme
 */
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
    
    // Verimlilik oranına (Efficiency) göre yüksekten düşüğe sırala
    return matches.sort((a, b) => b.efficiency - a.efficiency);
}
