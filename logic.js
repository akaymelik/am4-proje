/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Hibrit Puanlama Destekli Hesaplama Motoru.
 * GÜNCELLEME: 
 * - Kargo kâr hesabı Hafif (Large) ve Ağır (Heavy) konfigürasyonuna göre revize edildi.
 * - Kargo için otomatik optimizasyon ve talep bölüştürme mantığı eklendi.
 * - ROI ve Verimlilik hesaplamaları kargo sınıfları için normalize edildi.
 */

const Logic = {
    /**
     * Sadece uçağın havada kaldığı süreyi hesaplar.
     * Formül: Mesafe / Hız
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed);
    },

    /**
     * Tek bir uçuşun net kârını ve operasyonel döngüsünü hesaplar.
     */
    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const currentMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'realism';
        const multiplier = currentMode === 'easy' ? 1.1 : 1.0;

        // 1. Süre Hesapları
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5; // AM4 Standart 30dk hazırlık
        
        // 2. Sefer Sayısı
        const maxTrips = Math.floor(24 / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: airTime };

        let grossRevenue = 0;
        const prices = Configurator.getTicketMultipliers(route.distance);

        // --- KARGO GELİR HESABI (L/H) ---
        if (plane.type === "cargo") {
            // Eğer manuel kargo konfigürasyonu girilmemişse, en ideal dağılımı bul (Ağır yük öncelikli)
            const activeCargo = (config && (config.l + config.h > 0)) 
                ? config 
                : Configurator.calculateOptimalCargo(plane, route, trips);

            // Talep Kontrolü (AM4 CC Standartlarına göre kargo talebi L:70% H:30% olarak dağılır)
            const totalDemand = route.demand.c || (route.demand.y * 500);
            const demandL = Math.floor((totalDemand * 0.7) / trips); 
            const demandH = Math.floor((totalDemand * 0.3) / trips);

            // Taşınan miktar talep ile kapasite arasındaki küçük olandır
            const carryL = Math.min(activeCargo.l, demandL);
            const carryH = Math.min(activeCargo.h, demandH);

            grossRevenue = (carryL * prices.l) + (carryH * prices.h);
        } 
        // --- YOLCU (PAX) GELİR HESABI (Y/J/F) ---
        else {
            const activeSeats = (config && (config.y + config.j + config.f > 0)) 
                ? config 
                : Configurator.calculateOptimalSeats(plane, route, trips);

            const carryY = Math.min(activeSeats.y, Math.floor((route.demand.y || 0) / trips));
            const carryJ = Math.min(activeSeats.j, Math.floor((route.demand.j || 0) / trips));
            const carryF = Math.min(activeSeats.f, Math.floor((route.demand.f || 0) / trips));

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        // --- GİDERLER ---
        // Yakıt: Mesafe * Tüketim * $1.1 (Ortalama birim fiyat)
        const fuelCost = route.distance * plane.fuel_consumption * 1.1;
        // Personel: Yolcu $2.5/koltuk, Kargo $0.01/birim
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.01 : plane.capacity * 2.5;
        
        const netProfitPerFlight = grossRevenue - (fuelCost + staffCost);

        return {
            profitPerFlight: netProfitPerFlight,
            appliedTrips: trips,
            duration: airTime
        };
    },

    /**
     * Belirli bir uçak için en kârlı rotaları analiz eder.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customConfig = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        popularRoutes.forEach(route => {
            // Menzil kontrolü
            if (route.distance <= plane.range) {
                const calculation = this.calculateProfit(plane, route, customConfig, manualTrips);
                
                if (calculation.profitPerFlight > 0) {
                    const dailyProfit = calculation.profitPerFlight * calculation.appliedTrips;
                    results.push({
                        ...route,
                        profitPerFlight: calculation.profitPerFlight,
                        dailyProfit: dailyProfit,
                        dailyTrips: calculation.appliedTrips,
                        duration: calculation.duration,
                        efficiency: (dailyProfit / plane.price) * 100,
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        // Günlük kâra göre sırala
        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Bütçeye göre en verimli uçakları listeler (%30 Verim + %70 Kâr).
     */
    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let candidates = [];
        
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= numericBudget && p.type === type) {
                // Her uçağı kendi en iyi rotasında optimize edilmiş yük ile test et
                const topResults = this.analyzeTopRoutesForPlane(name, 1, null, manualTrips);
                if (topResults.length > 0) {
                    const best = topResults[0];
                    candidates.push({
                        name: name,
                        efficiency: best.efficiency,
                        dailyProfit: best.dailyProfit,
                        profitPerFlight: best.profitPerFlight,
                        roi: best.roiDays,
                        duration: best.duration,
                        bestRouteOrigin: best.origin,
                        bestRouteName: best.destination,
                        price: p.price,
                        appliedTrips: best.dailyTrips
                    });
                }
            }
        }

        if (candidates.length === 0) return [];

        // Normalizasyon (Hibrit Skor için)
        const maxEff = Math.max(...candidates.map(c => c.efficiency)) || 1;
        const maxProfit = Math.max(...candidates.map(c => c.dailyProfit)) || 1;

        candidates.forEach(c => {
            const normEff = c.efficiency / maxEff;
            const normProfit = c.dailyProfit / maxProfit;
            c.finalScore = (normEff * 0.3) + (normProfit * 0.7);
        });

        return candidates.sort((a, b) => b.finalScore - a.finalScore);
    }
};
