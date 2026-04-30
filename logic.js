/**
 * logic.js: AM4 Master Strateji ve Analiz Motoru.
 * GÜNCELLEME: 
 * - Günlük Talep Kilidi (Daily Demand Cap) eklendi (9km hatası giderildi).
 * - Personel maliyeti koltuk bazlı (slot değil) hale getirildi.
 * - ROI ve Hız öncelikli sıralama optimize edildi.
 */

const Logic = {
    /**
     * Uçuş süresini hesaplar (saat).
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
     * Günlük Net Kâr Hesaplama (Dinamik Talep Kontrolü ile).
     * @param {Object} config - Manuel {y, j, f} veya {l, h} konfigürasyonu.
     */
    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = window.gameMode || 'realism';
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // 30dk hazırlık payı
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profit: 0, trips: 0 };

        // Bilet fiyatlarını Configurator'daki Master çarpanlarla al (Çifte çarpan engellendi)
        const prices = Configurator.getTicketMultipliers(route.distance, currentMode);
        
        let dailyRevenue = 0;
        let totalPhysicalSeats = 0;

        if (plane.type === "cargo") {
            const opt = config || Configurator.calculateOptimalCargo(plane, route, trips);
            // Master Kargo Kısıtı: Toplam taşınan lbs, günlük rota talebini asla aşamaz.
            const totalDailyLbs = Math.min((opt.l + opt.h) * trips, route.demand.c || 0);
            dailyRevenue = (totalDailyLbs * (opt.l > opt.h ? prices.l : prices.h)) / 100;
            totalPhysicalSeats = (opt.l + opt.h) / 1000; // Sembolik personel yükü
        } else {
            const opt = config || Configurator.calculateOptimalSeats(plane, route, trips);
            
            // TALEP KİLİDİ (Demand Cap): Günlük taşınan yolcu sayısı talebi aşamaz.
            // Eğer uçak günde 5000 koltuk arz ediyorsa ama talep 200 ise, sadece 200 bilet satılır.
            const soldY = Math.min(opt.y * trips, route.demand.y || 0);
            const soldJ = Math.min(opt.j * trips, route.demand.j || 0);
            const soldF = Math.min(opt.f * trips, route.demand.f || 0);
            
            dailyRevenue = (soldY * prices.y) + (soldJ * prices.j) + (soldF * prices.f);
            totalPhysicalSeats = Number(opt.y) + Number(opt.j) + Number(opt.f);
        }

        // Giderler (Günlük)
        const dailyFuelCost = (route.distance * plane.fuel_consumption * 1.15) * trips;
        // DÜZELTME: Personel gideri uçağın toplam kapasitesi üzerinden değil, konfigüre edilmiş koltuk sayısı üzerinden.
        const dailyStaffCost = (plane.type === "cargo" ? plane.capacity * 0.005 : totalPhysicalSeats * 2.5) * trips;
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
                // Her uçak için en kârlı rotayı bul (Talep kısıtlı)
                const topRes = this.analyzeTopRoutesForPlane(name, 1)[0];
                if (topRes && topRes.dailyProfit > 0) {
                    const roiDays = p.price / topRes.dailyProfit;
                    candidates.push({
                        name: name,
                        efficiency: (topRes.dailyProfit / p.price) * 100,
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
        // Sıralama: En kısa sürede parasını çıkaran (Düşük ROI) ve en hızlı olan üste gelir.
        return candidates.sort((a, b) => (a.roiDays - b.roiDays) || (b.cruise_speed - a.cruise_speed)).slice(0, 10);
    },

    /**
     * Seçilen uçak için en kârlı 10 rotayı analiz eder.
     */
    analyzeTopRoutesForPlane: function(name, limit = 10, manualConfig = null) {
        const p = aircraftData[name];
        if (!p) return [];
        let results = [];
        
        popularRoutes.forEach(route => {
            if (route.distance <= p.range) {
                const calc = this.calculateProfit(p, route, manualConfig);
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
        
        // Günlük Net Kâra göre sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};

window.Logic = Logic;
