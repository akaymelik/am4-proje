/**
 * logic.js: PAX ve Kargo uçuşları için matematiksel hesaplamalar.
 */

// 1. Uçuş Süresi Hesabı (Mesafe / Hız + 0.5 saat hazırlık süresi)
function calculateFlightTime(distance, speed) {
    return (distance / speed) + 0.5;
}

/**
 * 2. Rota Bazlı Net Kar Hesabı
 * Yolcu uçakları için bilet, Kargo uçakları için lbs bazlı gelir hesaplar.
 */
function calculateRouteProfit(plane, route) {
    let grossRevenue = 0;

    if (plane.type === "cargo") {
        // Kargo Gelir Formülü: (Mesafe * katsayı + taban fiyat) * Lbs Kapasitesi
        const cargoRate = (route.distance * 0.0004) + 0.15;
        grossRevenue = plane.capacity * cargoRate;
    } else {
        // Yolcu Gelir Formülü: (Mesafe * 0.4 + 150) * Yolcu Kapasitesi
        const ecoTicket = (route.distance * 0.4) + 150; 
        grossRevenue = plane.capacity * ecoTicket;
    }

    // Giderler: Yakıt maliyeti (Mesafe * Tüketim * Yakıt Fiyatı Çarpanı)
    const fuelCost = route.distance * plane.fuel_consumption * 1.5; 
    
    // Personel Gideri: Yolcuda kişi başı, Kargoda lbs başı (küçük oran)
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2; 
    
    return grossRevenue - (fuelCost + staffCost);
}

/**
 * 3. En Karlı Rotayı ve ROI Süresini Bulma
 * Belirli bir uçak için planes.js içindeki en karlı rotayı tespit eder.
 */
function analyzeBestRouteForPlane(planeName) {
    const plane = aircraftData[planeName];
    if (!plane) return null;

    let bestRoute = null;
    let maxDailyProfit = 0;

    popularRoutes.forEach(route => {
        // Menzil kontrolü: Uçak bu rotaya ulaşabilir mi?
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
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    };
                }
            }
        }
    });
    return bestRoute;
}

/**
 * 4. Bütçeye ve Tipe Göre En İyi Uçakları Bulma
 * @param {number} budget - Kullanıcının bütçesi
 * @param {string} type - 'passenger' veya 'cargo'
 */
function getBestPlanesByType(budget, type) {
    let matches = [];
    for (let name in aircraftData) {
        const p = aircraftData[name];
        // Hem bütçeye uymalı hem de istenen tipte olmalı
        if (p.price <= budget && p.type === type) {
            const bestRouteInfo = analyzeBestRouteForPlane(name);
            if (bestRouteInfo) {
                matches.push({
                    name: name,
                    roi: parseFloat(bestRouteInfo.roiDays),
                    origin: bestRouteInfo.origin,
                    destination: bestRouteInfo.destination,
                    price: p.price
                });
            }
        }
    }
    // En kısa sürede kendini amorti eden uçağı başa al
    return matches.sort((a, b) => a.roi - b.roi);
}
