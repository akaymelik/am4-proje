/**
 * logic.js: Mesafe bazlı bilet fiyatlandırması ve verimlilik odaklı hesaplama motoru.
 */

/**
 * 1. Uçuş Süresi Hesabı
 * AM4 mantığında hazırlık süresi mesafeye göre değişebilir ancak 0.5 saat standart bir yaklaşımdır.
 */
function calculateFlightTime(distance, speed) {
    return (distance / speed) + 0.5;
}

/**
 * 2. Gelişmiş Rota Bazlı Net Kâr Hesabı
 * Uzun mesafeli uçuşlarda bilet fiyatlarının daha yüksek getiri sağlamasını hesaplar.
 */
function calculateRouteProfit(plane, route) {
    let grossRevenue = 0;
    const dist = route.distance;

    if (plane.type === "cargo") {
        /**
         * Kargo Gelir Formülü (AM4 Yaklaşık):
         * Uzak rotalarda lbs başına gelir çarpanı artar.
         */
        const cargoRate = (dist * 0.00045) + 0.25; 
        grossRevenue = plane.capacity * cargoRate;
    } else {
        /**
         * Yolcu Gelir Formülü (AM4 Yaklaşık):
         * Mesafe çarpanı uzak rotalarda bilet fiyatını ciddi oranda etkiler.
         * Formül: (Mesafe * 0.4) + 175 (Ekonomi sınıfı için taban fiyat)
         */
        const ecoTicket = Math.floor(dist * 0.42) + 175; 
        grossRevenue = plane.capacity * ecoTicket;
    }

    // Giderler: Yakıt maliyeti (Tüketim * Mesafe * Fiyat Çarpanı)
    const fuelCost = dist * plane.fuel_consumption * 1.5; 
    
    // Personel Gideri (Mesafe arttıkça personel maliyeti uçuş başına optimize olur)
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.004 : plane.capacity * 2.2; 
    
    return grossRevenue - (fuelCost + staffCost);
}

/**
 * 3. En Karlı Rotayı ve Verimlilik (Efficiency) Analizini Yapma
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
            
            // 24 saatlik bir güne sığan sefer sayısı
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
                        // Verimlilik: Günlük Karın, Uçağın Alış Fiyatına Oranı (Yatırımın Geri Dönüş Gücü)
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
    
    // En yüksek verimlilik oranına (Harcanan 1$ başına en çok kâr) göre sırala
    return matches.sort((a, b) => b.efficiency - a.efficiency);
}
