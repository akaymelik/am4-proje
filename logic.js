/**
 * logic.js: AM4 Master Strateji ve Analiz Motoru.
 * GÜNCELLEME: 
 * - Dinamik Talep Kilidi (Demand Cap) eklendi.
 * - Manuel Sefer Sayısı (Manual Trips) desteği entegre edildi.
 * - Personel maliyeti koltuk bazlı (slot değil) hale getirildi.
 */

const Logic = {
    /**
     * Uçuş süresini hesaplar (saat cinsinden).
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed);
    },

    /**
     * Uçağın bakım maliyetini (A-Check) hesaplar.
     */
    calculateMaintenanceCost: function(plane, airTime) {
        return airTime * (plane.price * 0.00004);
    },

    /**
     * Günlük Net Kâr Hesaplama.
     * @param {Object} plane - Uçak nesnesi.
     * @param {Object} route - Rota nesnesi (talep ve mesafe içerir).
     * @param {Object} config - Manuel {y, j, f} veya {l, h} konfigürasyonu.
     * @param {number} manualTrips - Kullanıcının girdiği sefer sayısı (opsiyonel).
     */
    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = window.gameMode || 'realism';
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        
        // AM4 Kuralı: Uçuş süresi + 30 dakika hazırlık (0.5 saat)
        const cycleTime = airTime + 0.5; 
        const maxPossibleTrips = Math.floor(24 / cycleTime);
        
        // Eğer kullanıcı manuel sefer girmişse, bunu uçağın fiziksel kapasitesiyle (maxPossibleTrips) sınırla.
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxPossibleTrips) : maxPossibleTrips;
        
        if (trips <= 0) return { profit: 0, trips: 0 };

        // Bilet fiyatlarını Configurator'daki Master çarpanlarla al
        const prices = Configurator.getTicketMultipliers(route.distance, currentMode);
        
        let dailyRevenue = 0;
        let totalPhysicalSeatsUsed = 0;

        if (plane.type === "cargo") {
            const opt = config || Configurator.calculateOptimalCargo(plane, route, trips);
            // Master Kargo Kısıtı: Toplam taşınan lbs, günlük rota talebini asla aşamaz.
            const totalDailyLbs = Math.min((opt.l + opt.h) * trips, route.demand.c || 0);
            dailyRevenue = (totalDailyLbs * (opt.l > opt.h ? prices.l : prices.h)) / 100;
            totalPhysicalSeatsUsed = (opt.l + opt.h) / 1000; // Personel yükü tahmini
        } else {
            const opt = config || Configurator.calculateOptimalSeats(plane, route, trips);
            
            // TALEP KİLİDİ (Demand Cap): Günlük taşınan yolcu sayısı talebi aşamaz.
            // Örn: 9km'de 48 sefer yapılsa bile sadece rotadaki talep (örn: 200) kadar bilet satılır.
            const soldY = Math.min(opt.y * trips, route.demand.y || 0);
            const soldJ = Math.min(opt.j * trips, route.demand.j || 0);
            const soldF = Math.min(opt.f * trips, route.demand.f || 0);
            
            dailyRevenue = (soldY * prices.y) + (soldJ * prices.j) + (soldF * prices.f);
            
            // Personel maliyeti uçağın fiziksel koltuk kapasitesi üzerinden hesaplanır.
            totalPhysicalSeatsUsed = Number(opt.y) + Number(opt.j) + Number(opt.f);
        }

        // Giderler (Günlük toplam)
        const dailyFuelCost = (route.distance * plane.fuel_consumption * 1.15) * trips;
        const dailyStaffCost = (plane.type === "cargo" ? plane.capacity * 0.005 : totalPhysicalSeatsUsed * 2.5) * trips;
        const dailyMaintenance = this.calculateMaintenanceCost(plane, airTime) * trips;
        
        const totalDailyNetProfit = dailyRevenue - (dailyFuelCost + dailyStaffCost + dailyMaintenance);
        
        return { 
            profit: totalDailyNetProfit > 0 ? totalDailyNetProfit : 0, 
            trips: trips 
        };
    },

    /**
     * Bütçeye göre en iyi uçakları ROI (Amorti) ve Hız odaklı bulur.
     */
    getBestPlanesByType: function(budget, type) {
        let candidates = [];
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= Number(budget) && p.type === type) {
                // Her uçak için veritabanındaki en kârlı rotayı bul
                const topRes = this.analyzeTopRoutesForPlane(name, 1)[0];
                if (topRes && topRes.dailyProfit > 0) {
                    const roiDays = p.price / topRes.dailyProfit;
                    candidates.push({
                        name: name,
                        dailyProfit: topRes.dailyProfit,
                        roiDays: roiDays,
                        bestRouteOrigin: topRes.origin,
                        bestRouteName: topRes.destination,
                        price: p.price,
                        cruise_speed: p.cruise_speed
                    });
                }
            }
        }
        // Sıralama: En hızlı amorti eden (ROI) ve hızı en yüksek olan üste gelir.
        return candidates.sort((a, b) => (a.roiDays - b.roiDays) || (b.cruise_speed - a.cruise_speed)).slice(0, 10);
    },

    /**
     * Seçilen uçak için en kârlı 10 rotayı analiz eder.
     * @param {string} name - Uçak adı.
     * @param {number} manualTrips - Manuel girilen sefer sayısı.
     */
    analyzeTopRoutesForPlane: function(name, limit = 10, manualConfig = null, manualTrips = null) {
        const p = aircraftData[name];
        if (!p) return [];
        let results = [];
        
        popularRoutes.forEach(route => {
            // Menzil uçağa uygun mu kontrol et
            if (route.distance <= p.range) {
                const calc = this.calculateProfit(p, route, manualConfig, manualTrips);
                if (calc.profit > 0) {
                    results.push({
                        ...route,
                        dailyProfit: calc.profit,
                        dailyTrips: calc.trips,
                        efficiency: (calc.profit / p.price) * 100
                    });
                }
            }
        });
        
        // Günlük Net Kâra göre büyükten küçüğe sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};

// Global erişim için bağla
window.Logic = Logic;
