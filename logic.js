/**
 * logic.js: Uçak ve Rota Analiz Motoru.
 * GÜNCELLEME: Uçak önerilerinde 'bestRouteOrigin' desteği eklendi.
 */

// FUEL_PRICE ve COST_INDEX runtime'da window globalinden okunur (UI.applyEconomySettings güncelliyor).
// Default: $950/1000lbs ve CI 200. Kullanıcı anasayfadan değiştirir → localStorage'a yazılır → her hesapta etkili.
const MAX_FLEET_SIZE = 30;
function getFuelPrice() { return (typeof window !== 'undefined' && window.FUEL_PRICE) || 950; }
function getCostIndex() { return (typeof window !== 'undefined' && window.COST_INDEX != null) ? window.COST_INDEX : 200; }
const DAILY_AVAILABLE_HOURS = 18; // kullanıcı uyku/iş için günde max 18 saat aktif olabilir (manuel kaldırma şart)

const Logic = {
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        const effectiveSpeed = (window.gameMode === 'easy') ? speed * 4 : speed;
        return (distance / effectiveSpeed);
    },

    /**
     * Kanonik A-check formülü (abc8747/am4 route.cpp:321-322).
     *   acheck_cost = check_cost × modeMult × ceil(realismFlightTime) / maint
     *
     * realismFlightTime = distance / cruise_speed (mod-bağımsız, base speed).
     * Cpp'deki matematik hilesi: ceil(flight_time × game_mode_speed_multiplier)
     * her iki modda da ceil(distance/baseSpeed) verir — Easy mode'un hız avantajı
     * maintenance'a yansımaz (wear gerçek mesafeye dayalı). Bizim calculateFlightTime
     * Easy'de speed×4 kullandığı için A-check için ayrı realismFlightTime hesaplıyoruz;
     * aksi halde ceil() içinde double-discount olurdu.
     *
     * modeMult: Easy=1, Realism=2 (cpp route.cpp:321 — Realism A-check 2× pahalı).
     *
     * repair_cost komponenti DAHİL DEĞİL: cpp formülü `0.001 × price × E[wear]`
     * per-flight repair maliyetini ekonomik simülasyon olarak amortize ediyor;
     * gerçek AM4 mekaniğinde wear A-check'te tek seferde temizlenir, per-flight
     * repair gideri yok. formulae.md de "Untested on realism" notuyla bu hipotezi
     * destekliyor (kullanıcı kararı: Fix #3 brainstorm).
     *
     * Eşleşmeyen uçaklar için legacy lineer fallback (geçici güvenlik ağı, normalde
     * tetiklenmez — tüm 329 uçak aircrafts.csv ile eşleşti).
     */
    calculateMaintenanceCost: function(plane, distance) {
        if (plane.check_cost == null || plane.maint == null) {
            const airTime = (plane.cruise_speed > 0) ? (distance / plane.cruise_speed) : 0;
            return airTime * (plane.price * 0.00006) + (plane.price * 0.00001);
        }
        const realismFlightTime = distance / plane.cruise_speed;
        const modeMult = (window.gameMode === 'easy') ? 1.0 : 2.0;
        return plane.check_cost * modeMult * Math.ceil(realismFlightTime) / plane.maint;
    },

    calculateProfit: function(plane, route, config = null, manualTrips = null) {
        const airTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(DAILY_AVAILABLE_HOURS / cycleTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0 };

        const prices = Configurator.getTicketMultipliers(route.distance);
        let grossRevenue = 0;

        if (plane.type === "cargo") {
            const hasCargo = route.demand && (route.demand.l || route.demand.h);
            if (!hasCargo) return { profitPerFlight: 0 };
            let opt;
            // Manuel config geçilmişse onu kullan (talep ile sınırlı: talep dolmazsa boş kalır).
            // Geriye dönük: config=null/undefined ise mevcut optimal allocation davranışı korunur.
            // NOT: Manuel cargo config'te kapasite kontrolü YAPILMAZ — kullanıcının verdiği değerler
            // talep ile sınırlı, kapasite aşımı kullanıcının sorumluluğu (UI'daki
            // Configurator.updateCapacityCheck zaten kapasite uyarısı gösterir).
            if (config && (config.l !== undefined || config.h !== undefined)) {
                const demand = route.demand || {};
                opt = {
                    l: Math.min(config.l || 0, Math.floor((demand.l || 0) / trips)),
                    h: Math.min(config.h || 0, Math.floor((demand.h || 0) / trips))
                };
            } else {
                opt = Configurator.calculateOptimalCargo(plane, route, trips);
            }
            grossRevenue = (opt.l * prices.l) + (opt.h * prices.h);
        } else {
            let opt;
            // Manuel config geçilmişse onu kullan (talep ile sınırlı).
            // Geriye dönük: config=null/undefined ise optimal F-first allocation.
            if (config && (config.y !== undefined || config.j !== undefined || config.f !== undefined)) {
                const demand = route.demand || {};
                opt = {
                    y: Math.min(config.y || 0, Math.floor((demand.y || 0) / trips)),
                    j: Math.min(config.j || 0, Math.floor((demand.j || 0) / trips)),
                    f: Math.min(config.f || 0, Math.floor((demand.f || 0) / trips))
                };
            } else {
                opt = Configurator.calculateOptimalSeats(plane, route, trips);
            }
            grossRevenue = (opt.y * prices.y) + (opt.j * prices.j) + (opt.f * prices.f);
        }

        // Kanonik fuel ceil (abc8747 route.cpp:463 + formulae.md:479): ceil(d × 100) / 100,
        // yani 0.01 km hassasiyetinde yukarı yuvarlama. Tam-sayı km girdilerinde (distances.bin
        // Uint16Array) etkisiz no-op; fraksiyonel distance'larda 0.01 km'ye yuvarlar.
        // Eski ceil(d/2)*2 kanonik kaynakta dayanaksızdı; tek-km distance'lerde fuel'i
        // ~%0.05 abartıyordu (Fix #6, Tier 1+2 kanıtla düzeltildi).
        const ceilDist = Math.ceil(route.distance * 100) / 100;
        const fuelCost = ceilDist * getFuelPrice() * (getCostIndex() / 500 + 0.6) * plane.fuel_consumption / 1000;
        // Per-flight staff cost YOK (Fix #5):
        //  - AM4 oyun gider raporunda uçak/sefer başına staff salary satırı yok (kullanıcı gözlemi).
        //  - Kanonik kaynaklar (am4-cc, abc8747) staff'ı route profit zincirinde modellemiyor.
        //  - Şirket geneli personel maaşları (CEO, mekanik, yer hizmetleri, kabin) ayrı konu —
        //    UI'a açılmıyor (kullanıcı kararı: input yorgunluğu, değişken maliyet, ileride üyelik ile).
        const maintenanceCost = this.calculateMaintenanceCost(plane, route.distance);
        const totalCosts = fuelCost + maintenanceCost;

        return {
            profitPerFlight: grossRevenue - totalCosts,
            grossRevenue: grossRevenue,   // sefer başı gelir (UI parçalanması için)
            totalCosts: totalCosts,       // sefer başı gider (fuel + maintenance)
            appliedTrips: trips,
            duration: airTime
        };
    },

    /**
     * Tek bir (hub, dest) çiftini calculateProfit'e geçirip results'a kârlıysa ekler.
     * analyzeTopRoutesForPlane'in iç döngüsü için yardımcı — code dup azaltır.
     */
    _evalRoute: function(plane, hub, dest, manualTrips, results) {
        const dl = window.dataLoader;
        const dist = dl.getDistance(hub.iata, dest.iata);
        if (dist == null || dist === 0 || dist > plane.range) return;
        // AM4 community standardı: 100km altı feeder rotalar (Wiesbaden 17km, Rotterdam 45km gibi)
        // hub-spoke içi transfer — küçük uçak + yüksek talep durumunda doluluk %30+ olsa bile saçma.
        if (dist < 100) return;
        const demand = dl.getDemand(hub.iata, dest.iata);
        if (!demand) return;
        if (plane.type === 'cargo' && !demand.l && !demand.h) return;

        const route = {
            origin: Utils.formatAirportLabel(hub),
            destination: Utils.formatAirportLabel(dest),
            distance: dist,
            demand: { y: demand.y, j: demand.j, f: demand.f, l: demand.l, h: demand.h }
        };

        // DOLULUK FİLTRESİ: %30 altında kapasite kullanımı = boş uçuş, anlamsız.
        // Kısa rotalarda (FRA→WIE 17km) çok sefer yapılır ama her sefer az talep paylaşır → uçak %10 dolu uçar.
        // Configurator çağrıları aşağıdaki calculateProfit ile duplicate ama doluluk eşiği erken eleme yapar
        // (boş rotalarda calculateProfit hiç koşmaz) → genel performans nötr/pozitif.
        const airTime = this.calculateFlightTime(dist, plane.cruise_speed);
        const cycleTime = airTime + 0.5;
        const maxTrips = Math.floor(DAILY_AVAILABLE_HOURS / cycleTime);
        const trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        if (trips <= 0) return;

        let totalLoad;
        if (plane.type === 'cargo') {
            const opt = Configurator.calculateOptimalCargo(plane, route, trips);
            totalLoad = opt.l + opt.h;
        } else {
            const opt = Configurator.calculateOptimalSeats(plane, route, trips);
            // F=3, J=2, Y=1 kapasite birimi (Configurator capacity kontrolü ile aynı)
            totalLoad = opt.y + (opt.j * 2) + (opt.f * 3);
        }
        const fillRatio = totalLoad / plane.capacity;
        if (fillRatio < 0.3) return;

        const calc = this.calculateProfit(plane, route, null, manualTrips);
        if (calc.profitPerFlight <= 0 || !calc.appliedTrips) return;
        const dailyProfit = calc.profitPerFlight * calc.appliedTrips;
        results.push({
            ...route,
            dailyProfit,
            revenuePerFlight: calc.grossRevenue,
            costPerFlight: calc.totalCosts,
            dailyRevenue: calc.grossRevenue * calc.appliedTrips,
            dailyCost: calc.totalCosts * calc.appliedTrips,
            dailyTrips: calc.appliedTrips,
            duration: calc.duration,
            efficiency: (dailyProfit / plane.price) * 100
        });
    },

    /**
     * Unified rota analizi — tek kaynak: dataLoader.
     *  - hubIata varsa: o hub'tan tüm 3906 destinasyona scan (~30ms)
     *  - hubIata yoksa: top 5 hub × tüm destinasyonlar = ~20K iter/plane
     * Top 5 hub seçimi: getBestPlanesByType binlerce plane × global scan donduruyordu (32M iter).
     * 5 hub majör havalimanlarını kapsar, getBestPlanesByType için yeterli; rota analizi
     * sayfasında kullanıcı zaten hub seçiyor, hub'sız global mod nadir kullanım.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, manualTrips = null, hubIata = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];
        const dl = window.dataLoader;
        if (!dl || !dl.isReady()) return [];

        const results = [];

        if (hubIata) {
            const hub = dl.getAirport(hubIata);
            if (!hub) return [];
            for (const dest of dl.airports) {
                if (dest.iata === hubIata) continue;
                this._evalRoute(plane, hub, dest, manualTrips, results);
            }
        } else {
            const topHubs = dl.getTopHubs(5);
            for (const hubInfo of topHubs) {
                const hub = dl.airports[hubInfo.pos];
                for (const dest of dl.airports) {
                    if (dest.iata === hub.iata) continue;
                    this._evalRoute(plane, hub, dest, manualTrips, results);
                }
            }
        }

        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    getBestPlanesByType: function(budget, type, manualTrips = null, availableSlots = MAX_FLEET_SIZE) {
        let candidates = [];
        const budgetNum = Number(budget);
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= budgetNum && p.type === type) {
                const topRes = this.analyzeTopRoutesForPlane(name, 1, manualTrips);
                if (topRes.length > 0) {
                    const fleetSize = Math.min(Math.floor(budgetNum / p.price), MAX_FLEET_SIZE, availableSlots);
                    const fleetEfficiency = fleetSize <= 3 ? 1.0 : fleetSize <= 10 ? 0.8 : fleetSize <= 20 ? 0.6 : 0.4;
                    const totalDailyProfit = fleetSize * topRes[0].dailyProfit * fleetEfficiency;
                    candidates.push({
                        name: name,
                        efficiency: topRes[0].efficiency,
                        dailyProfit: topRes[0].dailyProfit,
                        dailyTrips: topRes[0].dailyTrips,
                        totalDailyProfit: totalDailyProfit,
                        fleetSize: fleetSize,
                        fleetEfficiency: fleetEfficiency,
                        bestRouteOrigin: topRes[0].origin,
                        bestRouteName: topRes[0].destination,
                        price: p.price
                    });
                }
            }
        }
        return candidates.sort((a, b) => b.totalDailyProfit - a.totalDailyProfit).slice(0, 10);
    }
};
