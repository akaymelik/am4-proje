/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Sefer Ayarlı Hesaplama Motoru.
 * Bu modül; projenin en kârlı rotaları ve uçakları belirlemek için kullandığı çekirdek algoritmadır.
 */

const Logic = {
    /**
     * Uçuş süresini hesaplar (AM4 Standart: Mesafe / Hız + 0.5sa Hazırlık Süresi).
     * @param {number} distance - Rota mesafesi (km)
     * @param {number} speed - Uçağın seyir hızı (km/s)
     * @returns {number} Toplam uçuş süresi (ondalık saat)
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed) + 0.5;
    },

    /**
     * Tek bir uçuşun net kârını, süresini ve uygulanabilir sefer sayısını hesaplar.
     * Pazar talebi (Market Demand) darboğazını dikkate alır.
     * @param {Object} plane - Uçak objesi
     * @param {Object} route - Rota objesi
     * @param {Object} seats - Özel koltuk düzeni {y, j, f}
     * @param {number} manualTrips - Kullanıcının hedeflediği günlük sefer sayısı
     * @returns {Object} {profitPerFlight, appliedTrips, duration}
     */
    calculateProfit: function(plane, route, seats = null, manualTrips = null) {
        const flightTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        
        // 24 saatlik döngüde uçağın sığabileceği maksimum sefer sayısı
        const maxTrips = Math.floor(24 / flightTime);
        
        // Kullanıcı manuel değer girdiyse onu kullan, girmediyse veya sınırları aşıyorsa maksimumu kullan
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: flightTime };

        let grossRevenue = 0;

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            // Mesafe dilimlerine göre kargo gelir katsayıları (AM4-CC Standartları)
            let coef = route.distance > 5000 ? 0.47 : (route.distance > 2000 ? 0.52 : 0.56);
            
            const totalDailyCapacity = plane.capacity * trips;
            // Kargo rotalarında demand verisi 'c' anahtarı altında veya genel 'y' (Economy) olarak gelebilir
            const totalDailyDemand = route.demand.c || route.demand.y || 0;
            
            // Pazardaki talepten fazlasını taşıyamayız (Market Bottleneck)
            const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
            
            // Günlük toplam geliri sefer sayısına bölerek sefer başı geliri buluyoruz
            grossRevenue = (actualDailyCarry * (route.distance * coef / 100)) / trips;
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            const prices = Configurator.getTicketMultipliers(route.distance);
            const activeSeats = seats || { y: plane.capacity, j: 0, f: 0 };

            // Günlük talep kısıtlamasını her sınıf için ayrı ayrı kontrol et
            // Formül: min(Kapasite * Sefer, Rota Günlük Talebi) / Sefer
            const carryY = Math.min(activeSeats.y * trips, route.demand.y || 0) / trips;
            const carryJ = Math.min(activeSeats.j * trips, route.demand.j || 0) / trips;
            const carryF = Math.min(activeSeats.f * trips, route.demand.f || 0) / trips;

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        // --- GİDERLER ---
        // Yakıt Gideri: Tüketim * Mesafe * 1.2$ (Ortalama Yakıt Fiyatı)
        const fuelCost = route.distance * plane.fuel_consumption * 1.2;
        
        // Personel Gideri: PAX ise koltuk başı 2.5$, Kargo ise kapasite başı 0.005$
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2.5;
        
        return {
            profitPerFlight: grossRevenue - (fuelCost + staffCost),
            appliedTrips: trips,
            duration: flightTime
        };
    },

    /**
     * Belirli bir uçak için popüler rotalar içinden en kârlı 10 tanesini seçer.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customSeats = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        popularRoutes.forEach(route => {
            // Menzil kontrolü
            if (route.distance <= plane.range) {
                const calculation = this.calculateProfit(plane, route, customSeats, manualTrips);
                
                if (calculation.profitPerFlight > 0) {
                    const dailyProfit = calculation.profitPerFlight * calculation.appliedTrips;
                    results.push({
                        ...route,
                        dailyProfit: dailyProfit,
                        dailyTrips: calculation.appliedTrips,
                        duration: calculation.duration,
                        // Efficiency: Harcanan 1$ yatırım başına günlük kâr yüzdesi (En gerçekçi metrik)
                        efficiency: ((dailyProfit / plane.price) * 100).toFixed(4),
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        // Günlük toplam kâra göre azalan sırada sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Bütçeye göre en yüksek yatırım verimine (Efficiency) sahip uçakları listeler.
     */
    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let matches = [];
        
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= numericBudget && p.type === type) {
                // Her uçağın en iyi rotasındaki performansına bakılır
                const topResults = this.analyzeTopRoutesForPlane(name, 1, null, manualTrips);
                if (topResults.length > 0) {
                    const best = topResults[0];
                    matches.push({
                        name: name,
                        efficiency: parseFloat(best.efficiency),
                        roi: best.roiDays,
                        duration: best.duration,
                        bestRouteOrigin: best.origin,
                        bestRouteName: best.destination,
                        price: p.price
                    });
                }
            }
        }
        
        // Verimlilik yüzdesine göre sırala
        return matches.sort((a, b) => b.efficiency - a.efficiency);
    }
};
