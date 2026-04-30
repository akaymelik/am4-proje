/**
 * logic.js: AM4 Master Strateji ve Analiz Motoru.
 * DÜZELTME: Çifte çarpan hatası giderildi. Personel maliyeti koltuk bazlı yapıldı.
 * 9km gibi kısa mesafelerde gerçekçi kâr analizi için demand kontrolü optimize edildi.
 */

const Logic = {
    calculateFlightTime: (distance, speed) => (!speed || speed <= 0) ? 0 : (distance / speed),

    calculateMaintenanceCost: (plane, airTime) => airTime * (plane.price * 0.00004),

    /**
     * Kâr Hesaplama Motoru (Fixed)
     */
    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = window.gameMode || 'realism';
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // Hazırlık süresi dahil
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profit: 0, trips: trips };

        // Bilet fiyatlarını Configurator'dan al (Çarpanlar zaten orada uygulanıyor)
        const prices = Configurator.getTicketMultipliers(route.distance, currentMode);
        let revenuePerFlight = 0;
        let totalSeats = 0;

        if (plane.type === "cargo") {
            const opt = config || Configurator.calculateOptimalCargo(plane, route, trips);
            // Master Kargo Formülü: (lbs * mesafe * katsayı) / 100
            revenuePerFlight = ((opt.l * prices.l) + (opt.h * prices.h)) / 100;
            totalSeats = (opt.l + opt.h) / 1000; // Sembolik personel yükü
        } else {
            const opt = config || Configurator.calculateOptimalSeats(plane, route, trips);
            // DİKKAT: Burada multiplier ile tekrar çarpmıyoruz! Configurator zaten çarptı.
            revenuePerFlight = (opt.y * prices.y + opt.j * prices.j + opt.f * prices.f);
            totalSeats = Number(opt.y) + Number(opt.j) + Number(opt.f);
        }

        const fuelCost = route.distance * plane.fuel_consumption * 1.15; // Ortalama yakıt $1.15
        
        // DÜZELTME: Personel maliyeti slot kapasitesi üzerinden değil, gerçek koltuk sayısı üzerinden.
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : totalSeats * 2.5;
        const maintenance = this.calculateMaintenanceCost(plane, airTime);
        
        const netProfitPerFlight = revenuePerFlight - (fuelCost + staffCost + maintenance);
        
        // Master Kural: Negatif kâr varsa uçağı uçurma
        const finalProfit = netProfitPerFlight > 0 ? netProfitPerFlight * trips : 0;
        
        return { profit: finalProfit, trips: trips };
    },

    getBestPlanesByType: function(budget, type) {
        let candidates = [];
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= Number(budget) && p.type === type) {
                const topRes = this.analyzeTopRoutesForPlane(name, 1)[0];
                if (topRes && topRes.dailyProfit > 0) {
                    candidates.push({
                        name, ...p,
                        roiDays: p.price / topRes.dailyProfit,
                        dailyProfit: topRes.dailyProfit,
                        bestRouteOrigin: topRes.origin,
                        bestRouteName: topRes.destination,
                        efficiency: topRes.efficiency
                    });
                }
            }
        }
        // ROI (Geri Dönüş) en kısa olandan en uzuna sırala
        return candidates.sort((a, b) => a.roiDays - b.roiDays).slice(0, 10);
    },

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
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    }
};

window.Logic = Logic;
