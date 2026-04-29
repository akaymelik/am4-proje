/**
 * logic.js: AM4 Master Strateji ve Analiz Motoru.
 * GÜNCELLEME: ROI (Amorti Süresi), Hız Önceliği ve Sınıf Bazlı Bilet Çarpanları eklendi.
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
     * Uçağın aşınma ve bakım (A-Check) maliyetini simüle eder.
     */
    calculateMaintenanceCost: function(plane, airTime) {
        // AM4 standart bakım maliyet katsayısı
        return airTime * (plane.price * 0.00004);
    },

    /**
     * Tek bir uçuşun ve toplam günün net kârını hesaplar.
     * Master Data: Easy modda Y:1.10, J:1.08, F:1.06 çarpanları kullanılır.
     */
    calculateProfit: function(plane, route, manualTrips = null) {
        const currentMode = window.gameMode || 'realism';
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // 30 dakikalık hazırlık/turnaround süresi dahil
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profit: 0, trips: 0 };

        // Bilet/Kargo fiyatlarını Configurator'daki Master çarpanlarla al
        const prices = Configurator.getTicketMultipliers(route.distance, currentMode);
        let revenuePerFlight = 0;

        if (plane.type === "cargo") {
            // Master Kural: Kargo rotasında 'c' talebi yoksa kâr 0'dır.
            if (!route.demand || !route.demand.c) return { profit: 0, trips: 0 };
            const opt = Configurator.calculateOptimalCargo(plane, route, trips);
            // Large 1.1x, Heavy 1.08x (Easy mod)
            revenuePerFlight = (opt.l * prices.l + opt.h * prices.h);
        } else {
            const opt = Configurator.calculateOptimalSeats(plane, route, trips);
            // PAX Hiyerarşisi: F > J > Y (Master Konfigürasyon)
            revenuePerFlight = (opt.y * prices.y + opt.j * prices.j + opt.f * prices.f);
        }

        // Giderler: Yakıt ($1.15 emniyet katsayısı), Personel ve Bakım
        const fuelCost = route.distance * plane.fuel_consumption * 1.15;
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        const maintenance = this.calculateMaintenanceCost(plane, airTime);
        
        const netProfitPerFlight = revenuePerFlight - (fuelCost + staffCost + maintenance);
        return { profit: netProfitPerFlight * trips, trips: trips };
    },

    /**
     * Bütçeye göre en mantıklı uçakları ROI ve Hız önceliğine göre sıralar.
     */
    getBestPlanesByType: function(budget, type) {
        let candidates = [];
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= Number(budget) && p.type === type) {
                // Her uçak için veritabanındaki en kârlı rotayı simüle et
                const topRes = this.analyzeTopRoutesForPlane(name, 1)[0];
                if (topRes) {
                    const dailyProfit = topRes.dailyProfit;
                    const roiDays = p.price / dailyProfit;
                    
                    candidates.push({
                        name: name,
                        efficiency: topRes.efficiency,
                        dailyProfit: dailyProfit,
                        roiDays: roiDays, // Amorti süresi (Gün)
                        bestRouteOrigin: topRes.origin, // Nereden bilgisi UI'ya taşınır
                        bestRouteName: topRes.destination, // Nereye
                        price: p.price,
                        speed: p.cruise_speed
                    });
                }
            }
        }
        
        // Master Sıralama Algoritması: 
        // 1. En düşük ROI (En hızlı amorti eden)
        // 2. ROI eşitse, en yüksek Hız (Hız > Yakıt kuralı)
        return candidates.sort((a, b) => (a.roiDays - b.roiDays) || (b.speed - a.speed)).slice(0, 10);
    },

    /**
     * Seçilen uçak için en yüksek kâr getiren rotaları listeler.
     */
    analyzeTopRoutesForPlane: function(name, limit = 10) {
        const p = aircraftData[name];
        if (!p) return [];

        let results = [];
        popularRoutes.forEach(route => {
            // Menzil uçağa uygun mu kontrol et
            if (route.distance <= p.range) {
                const calc = this.calculateProfit(p, route);
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

        // Günlük net kâra göre sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};

// Modüler yapı: Global pencereye bağla
window.Logic = Logic;
