/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Manuel Sefer Ayarlı Hesaplama Motoru.
 * Bu dosya Configurator ve routes.js (Excel verileri) ile tam uyumlu çalışır.
 */

/**
 * 1. Uçuş Süresi Hesaplama
 * AM4 Standart: (Mesafe / Hız) + 0.5 Saat Hazırlık Süresi.
 */
function calculateFlightTime(distance, speed) {
    if (!speed || speed <= 0) return 0;
    return (distance / speed) + 0.5;
}

/**
 * 2. Rota Bazlı Net Kâr Hesaplama
 * manualTrips: Kullanıcının belirlediği günlük sefer sayısı.
 */
function calculateRouteProfit(plane, route, seats = null, manualTrips = null) {
    const dist = route.distance || route.dist;
    const flightTime = calculateFlightTime(dist, plane.cruise_speed);
    
    // Maksimum sığabilecek sefer sayısı (24 saatlik döngüde)
    const maxTrips = Math.floor(24 / flightTime);
    
    // Kullanıcı manuel değer girdiyse onu kullan, girmediyse veya sınırları aşıyorsa maksimumu kullan
    let dailyTrips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
    
    if (dailyTrips <= 0) return { profitPerFlight: 0, appliedTrips: 0 };

    let grossRevenue = 0;

    if (plane.type === "cargo") {
        /**
         * Kargo Gelir Katsayıları (AM4-CC):
         * 0-2000 km: 0.56 | 2000-5000 km: 0.52 | 5000+ km: 0.47
         */
        let coef = dist > 5000 ? 0.47 : (dist > 2000 ? 0.52 : 0.56);
        const totalDailyCapacity = plane.capacity * dailyTrips;
        const totalDailyDemand = route.demand?.c || 0;
        
        // Pazardaki talepten fazlasını taşıyamayız (Market Bottleneck)
        const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
        
        // Günlük toplam geliri sefer sayısına bölerek sefer başı geliri buluyoruz
        grossRevenue = (actualDailyCarry * (dist * coef / 100)) / dailyTrips;
    } else {
        /**
         * Yolcu (PAX) Bilet Fiyatları (1.1x Easy Mode İdeal Fiyatlar)
         */
        const prices = Configurator.getTicketMultipliers(dist);
        
        // Eğer özel koltuk düzeni yoksa tam ekonomi varsayılır
        const activeSeats = seats || { y: plane.capacity, j: 0, f: 0 };

        // Günlük toplam talebi ve uçağın günlük kapasitesini sınıflara göre kıyaslıyoruz
        // Eğer uçağın toplam günlük kapasitesi (Koltuk * Sefer) talepten fazlaysa, kâr talep sınırına çekilir.
        const carryY = Math.min(activeSeats.y * dailyTrips, route.demand?.y || 0) / dailyTrips;
        const carryJ = Math.min(activeSeats.j * dailyTrips, route.demand?.j || 0) / dailyTrips;
        const carryF = Math.min(activeSeats.f * dailyTrips, route.demand?.f || 0) / dailyTrips;

        grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
    }

    // Operasyonel Giderler
    const fuelCost = dist * plane.fuel_consumption * 1.2; // Ortalama yakıt maliyeti
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2.5; 
    
    return {
        profitPerFlight: grossRevenue - (fuelCost + staffCost),
        appliedTrips: dailyTrips
    };
}

/**
 * 3. Uçak İçin En Karlı 10 Rotayı Analiz Etme
 */
function analyzeTopRoutesForPlane(planeName, limit = 10, customSeats = null, manualTrips = null) {
    const plane = aircraftData[planeName];
    if (!plane) return [];

    let results = [];
    popularRoutes.forEach(route => {
        if (route.distance <= plane.range) {
            const calculation = calculateRouteProfit(plane, route, customSeats, manualTrips);
            
            if (calculation.profitPerFlight > 0) {
                const dailyProfit = calculation.profitPerFlight * calculation.appliedTrips;
                results.push({
                    ...route,
                    dailyProfit: dailyProfit,
                    dailyTrips: calculation.appliedTrips,
                    // Efficiency: Yatırılan 1$ başına günlük kâr yüzdesi
                    efficiency: ((dailyProfit / plane.price) * 100).toFixed(4),
                    roiDays: (plane.price / dailyProfit).toFixed(1)
                });
            }
        }
    });

    // Günlük kâra göre en yüksekten düşüğe sırala
    return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
}

/**
 * 4. Bütçeye Göre En Verimli Uçağı Bulma
 */
function getBestPlanesByType(budget, type, manualTrips = null) {
    const numericBudget = Number(budget);
    let matches = [];
    
    for (let name in aircraftData) {
        const p = aircraftData[name];
        if (p.price <= numericBudget && p.type === type) {
            // Her uçağın en iyi rotasındaki verimliliğine bakılır
            const topRoutes = analyzeTopRoutesForPlane(name, 1, null, manualTrips);
            if (topRoutes.length > 0) {
                const best = topRoutes[0];
                matches.push({
                    name: name,
                    efficiency: parseFloat(best.efficiency),
                    roi: best.roiDays,
                    bestRouteOrigin: best.origin,
                    bestRouteName: best.destination,
                    price: p.price
                });
            }
        }
    }
    
    return matches.sort((a, b) => b.efficiency - a.efficiency);
}
