/**
 * logic.js: PAX ve Kargo uçuşları için matematiksel hesaplamalar ve analizler.
 */

/**
 * 1. Uçuş Süresi Hesabı
 * Mesafeyi uçağın hızına böler ve üzerine 30 dakika hazırlık süresi ekler.
 */
function calculateFlightTime(distance, speed) {
    return (distance / speed) + 0.5;
}

/**
 * 2. Rota Bazlı Net Kâr Hesabı
 * Uçak tipine (Yolcu/Kargo) göre farklı gelir modelleri kullanır.
 */
function calculateRouteProfit(plane, route) {
    let grossRevenue = 0;

    if (plane.type === "cargo") {
        // Kargo Gelir Formülü: (Mesafe tabanlı oran + sabit) * Lbs Kapasitesi
        const cargoRate = (route.distance * 0.0004) + 0.15;
        grossRevenue = plane.capacity * cargoRate;
    } else {
        // Yolcu Gelir Formülü: (Mesafe tabanlı bilet fiyatı) * Yolcu Kapasitesi
        const ecoTicket = (route.distance * 0.4) + 150; 
        grossRevenue = plane.capacity * ecoTicket;
    }

    // Giderler: Yakıt maliyeti (Mesafe * Tüketim * Yakıt Çarpanı)
    const fuelCost = route.distance * plane.fuel_consumption * 1.5; 
    
    // Personel Gideri: Yolcu uçağında kişi başı, kargo uçağında kapasiteye oranla küçük miktar
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2; 
    
    return grossRevenue - (fuelCost + staffCost);
}

/**
 * 3. Belirli Bir Uçak İçin En Karlı Rotayı Bulma
 * Veritabanındaki rotaları tarayarak uçağın menziline uyan en kârlı olanı seçer.
 */
function analyzeBestRouteForPlane(planeName) {
    const plane = aircraftData[planeName];
    if (!plane) return null;

    let bestRoute = null;
    let maxDailyProfit = 0;

    popularRoutes.forEach(route => {
        // Menzil kontrolü
        if (route.distance <= plane.range) {
            const profitPerFlight = calculateRouteProfit(plane, route);
            const flightTime = calculateFlightTime(route.distance, plane.cruise_speed);
            
            // 24 saatte kaç uçuş yapılabileceği
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
                        // ROI (Amorti Süresi) sayısal değer olarak saklanır
                        roiDays: parseFloat((plane.price / dailyProfit).toFixed(2))
                    };
                }
            }
        }
    });
    return bestRoute;
}

/**
 * 4. Bütçeye ve Uçuş Tipine Göre Uçak Önerileri
 * Kullanıcının girdiği bütçe ve seçtiği tipe (PAX/Kargo) göre listeleme yapar.
 */
function getBestPlanesByType(budget, type) {
    const numericBudget = Number(budget);
    let matches = [];
    
    for (let name in aircraftData) {
        const p = aircraftData[name];
        // Bütçe ve tip kontrolü
        if (p.price <= numericBudget && p.type === type) {
            const bestRouteInfo = analyzeBestRouteForPlane(name);
            if (bestRouteInfo) {
                matches.push({
                    name: name,
                    roi: bestRouteInfo.roiDays,
                    origin: bestRouteInfo.origin,
                    destination: bestRouteInfo.destination,
                    price: p.price
                });
            }
        }
    }
    // En düşük ROI (en hızlı kazanç) olanı başa getir
    return matches.sort((a, b) => a.roi - b.roi);
}
