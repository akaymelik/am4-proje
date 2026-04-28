/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Mod Duyarlı Hesaplama Motoru.
 * Desteklenen Modlar: Easy Mode (1.1x) ve Realism (1.0x).
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
     * @param {Object} plane - Uçak verisi
     * @param {Object} route - Rota verisi
     * @param {Object} seats - Mevcut koltuk düzeni {y, j, f}
     * @param {number} manualTrips - Kullanıcı tarafından istenen günlük sefer
     * @returns {Object} Kâr, sefer sayısı ve süre bilgileri
     */
    calculateProfit: function(plane, route, seats = null, manualTrips = null) {
        // Global gameMode değişkenini kontrol et (Varsayılan: easy)
        const currentMode = typeof gameMode !== 'undefined' ? gameMode : 'easy';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        const flightTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const maxTrips = Math.floor(24 / flightTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: flightTime };

        let grossRevenue = 0;

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            // Mesafe dilimlerine göre kargo gelir katsayıları
            let coef = route.distance > 5000 ? 0.47 : (route.distance > 2000 ? 0.52 : 0.56);
            
            const totalDailyCapacity = plane.capacity * trips;
            const totalDailyDemand = route.demand.c || route.demand.y || 0;
            
            // Pazar darboğazı kontrolü
            const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
            
            // Kargo Geliri = (Taşınan * (Mesafe * Katsayı / 100)) * Mod Çarpanı
            grossRevenue = (actualDailyCarry * (route.distance * coef / 100) * multiplier) / trips;
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            // Configurator üzerinden mod duyarlı bilet fiyatlarını al
            const prices = Configurator.getTicketMultipliers(route.distance);
            
            // Eğer koltuklar 0 ise, uçağın tam kapasitesini (Economy) baz alarak potansiyel hesapla
            const activeSeats = (seats && (seats.y + seats.j + seats.f > 0)) 
                ? seats 
                : { y: plane.capacity, j: 0, f: 0 };

            const carryY = Math.min(activeSeats.y * trips, route.demand.y || 0) / trips;
            const carryJ = Math.min(activeSeats.j * trips, route.demand.j || 0) / trips;
            const carryF = Math.min(activeSeats.f * trips, route.demand.f || 0) / trips;

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        // --- GİDERLER (Maliyet Analizi) ---
        // Yakıt: Tüketim * Mesafe * $1.1 (Ortalama piyasa fiyatı)
        const fuelCost = route.distance * plane.fuel_consumption * 1.1;
        
        // Personel: PAX başı $2.5, Kargo birimi başı $0.01 (Eğitim seviyesi ortalaması)
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        
        const netProfitPerFlight = grossRevenue - (fuelCost + staffCost);

        return {
            profitPerFlight: netProfitPerFlight,
            appliedTrips: trips,
            duration: flightTime
        };
    },

    /**
     * Belirli bir uçak için en kârlı 10 rotayı analiz eder.
     * @param {string} planeName - Analiz edilecek uçak
     * @param {number} limit - Gösterilecek rota sayısı
     * @param {Object} customSeats - Kullanıcının girdiği özel koltuklar
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customSeats = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        // Koltuklar girilmemişse (0 ise) her rota için ideal olanı hesapla
        const isSeatsEmpty = !customSeats || (customSeats.y + customSeats.j + customSeats.f === 0);

        popularRoutes.forEach(route => {
            if (route.distance <= plane.range) {
                let seatsToUse = customSeats;
                
                // Akıllı Analiz: Koltuklar boşsa, rotanın talebine göre en iyi dizilimi simüle et
                if (plane.type === "passenger" && isSeatsEmpty) {
                    seatsToUse = Configurator.calculateOptimalSeats(plane, route, manualTrips);
                }

                const calculation = this.calculateProfit(plane, route, seatsToUse, manualTrips);
                
                if (calculation.profitPerFlight > 0) {
                    const dailyProfit = calculation.profitPerFlight * calculation.appliedTrips;
                    results.push({
                        ...route,
                        dailyProfit: dailyProfit,
                        dailyTrips: calculation.appliedTrips,
                        duration: calculation.duration,
                        // Verimlilik: Yatırılan $1 başına günlük kâr yüzdesi
                        efficiency: ((dailyProfit / plane.price) * 100).toFixed(4),
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        // En yüksek günlük kâra göre sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Verilen bütçeye göre en yüksek yatırım verimliliğine sahip uçakları bulur.
     */
    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let matches = [];
        
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= numericBudget && p.type === type) {
                // Uçak önerilerinde her zaman "İdeal Rota & İdeal Konfigürasyon" performansı baz alınır.
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
        return matches.sort((a, b) => b.efficiency - a.efficiency);
    }
};
