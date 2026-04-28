/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Profesyonel Katsayılı Hesaplama Motoru.
 * Bu dosya Configurator ve popularRoutes (Excel verileri) ile tam uyumlu çalışır.
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
 * Bu fonksiyon uçağın kapasitesini, rotadaki günlük pazar talebiyle (Market Demand) kıyaslar.
 */
function calculateRouteProfit(plane, route, seats = null) {
    const dist = route.distance || route.dist;
    const flightTime = calculateFlightTime(dist, plane.cruise_speed);
    const dailyTrips = Math.floor(24 / flightTime);
    
    if (dailyTrips === 0) return -1; // Uçak bu mesafeyi 24 saatte tamamlayamaz

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
        
        // Tek seferlik ortalama geliri bulmak için günlük geliri sefer sayısına bölüyoruz
        grossRevenue = (actualDailyCarry * (dist * coef / 100)) / dailyTrips;
    } else {
        /**
         * Yolcu (PAX) Bilet Fiyatları (1.1x Easy Mode İdeal Fiyatlar)
         */
        const prices = {
            y: ((0.4 * dist) + 170) * 1.1,
            j: ((0.8 * dist) + 560) * 1.1,
            f: ((1.2 * dist) + 1200) * 1.1
        };

        // Eğer özel koltuk düzeni yoksa tam ekonomi varsayılır
        const activeSeats = seats || { y: plane.capacity, j: 0, f: 0 };

        // Günlük toplam talebi ve uçağın günlük kapasitesini sınıflara göre kıyaslıyoruz
        // Formül: min(Uçak Kapasitesi * Sefer Sayısı, Rota Günlük Talebi)
        const carryY = Math.min(activeSeats.y * dailyTrips, route.demand?.y || 0) / dailyTrips;
        const carryJ = Math.min(activeSeats.j * dailyTrips, route.demand?.j || 0) / dailyTrips;
        const carryF = Math.min(activeSeats.f * dailyTrips, route.demand?.f || 0) / dailyTrips;

        grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
    }

    // Giderler (Yakıt ve Personel)
    const fuelCost = dist * plane.fuel_consumption * 1.2; // Ortalama 1.2$ yakıt fiyatı
    const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2.5; 
    
    return grossRevenue - (fuelCost + staffCost);
}

/**
 * 3. Uçak İçin En Karlı 10 Rotayı Analiz Etme
 * routes.js'deki Excel verilerini tarar.
 */
function analyzeTopRoutesForPlane(planeName, limit = 10, customSeats = null) {
    const plane = aircraftData[planeName];
    if (!plane) return [];

    let results = [];
    popularRoutes.forEach(route => {
        // Uçağın menzili rotaya yetiyor mu?
        if (route.distance <= plane.range) {
            const profitPerFlight = calculateRouteProfit(plane, route, customSeats);
            const flightTime = calculateFlightTime(route.distance, plane.cruise_speed);
            const dailyTrips = Math.floor(24 / flightTime);
            
            if (dailyTrips > 0 && profitPerFlight > 0) {
                const dailyProfit = profitPerFlight * dailyTrips;
                results.push({
                    ...route,
                    dailyProfit: dailyProfit,
                    dailyTrips: dailyTrips,
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
 * 4. Bütçeye Göre En İyi Uçağı Bulma (UI Desteğiyle)
 */
function getBestPlanesByType(budget, type) {
    const numericBudget = Number(budget);
    let matches = [];
    
    for (let name in aircraftData) {
        const p = aircraftData[name];
        if (p.price <= numericBudget && p.type === type) {
            // Her uçağın en iyi rotasındaki verimliliğine bakılır
            const topRoutes = analyzeTopRoutesForPlane(name, 1);
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
    
    // Verimlilik (Yatırım Getirisi) sırasına göre sırala
    return matches.sort((a, b) => b.efficiency - a.efficiency);
}
