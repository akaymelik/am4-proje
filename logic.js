/**
 * logic.js: AM4 Pazar Talebi (Demand) Kısıtlamalı ve Sefer Ayarlı Hesaplama Motoru.
 * Güncelleme: Koltuk sayıları 0 olsa bile potansiyel kârı hesaplama özelliği eklendi.
 */

const Logic = {
    /**
     * Uçuş süresini hesaplar (AM4 Standart: Mesafe / Hız + 0.5sa Hazırlık Süresi).
     */
    calculateFlightTime: function(distance, speed) {
        if (!speed || speed <= 0) return 0;
        return (distance / speed) + 0.5;
    },

    /**
     * Tek bir uçuşun net kârını, süresini ve uygulanabilir sefer sayısını hesaplar.
     */
    calculateProfit: function(plane, route, seats = null, manualTrips = null) {
        const flightTime = this.calculateFlightTime(route.distance, plane.cruise_speed);
        const maxTrips = Math.floor(24 / flightTime);
        let trips = (manualTrips && manualTrips > 0) ? Math.min(manualTrips, maxTrips) : maxTrips;
        
        if (trips <= 0) return { profitPerFlight: 0, appliedTrips: 0, duration: flightTime };

        let grossRevenue = 0;

        // --- KARGO GELİR HESABI ---
        if (plane.type === "cargo") {
            let coef = route.distance > 5000 ? 0.47 : (route.distance > 2000 ? 0.52 : 0.56);
            const totalDailyCapacity = plane.capacity * trips;
            const totalDailyDemand = route.demand.c || route.demand.y || 0;
            const actualDailyCarry = Math.min(totalDailyCapacity, totalDailyDemand);
            grossRevenue = (actualDailyCarry * (route.distance * coef / 100)) / trips;
        } 
        // --- YOLCU (PAX) GELİR HESABI ---
        else {
            const prices = Configurator.getTicketMultipliers(route.distance);
            // Eğer koltuklar 0 ise veya null ise, tam kapasite ekonomi üzerinden "baz" bir kâr hesapla
            // Ancak bu kâr sadece rotayı bulmak içindir, UI'da kullanıcı konfigi yükleyince netleşir.
            const activeSeats = (seats && (seats.y + seats.j + seats.f > 0)) 
                ? seats 
                : { y: plane.capacity, j: 0, f: 0 };

            const carryY = Math.min(activeSeats.y * trips, route.demand.y || 0) / trips;
            const carryJ = Math.min(activeSeats.j * trips, route.demand.j || 0) / trips;
            const carryF = Math.min(activeSeats.f * trips, route.demand.f || 0) / trips;

            grossRevenue = (carryY * prices.y) + (carryJ * prices.j) + (carryF * prices.f);
        }

        const fuelCost = route.distance * plane.fuel_consumption * 1.2;
        const staffCost = plane.type === "cargo" ? plane.capacity * 0.005 : plane.capacity * 2.5;
        
        return {
            profitPerFlight: grossRevenue - (fuelCost + staffCost),
            appliedTrips: trips,
            duration: flightTime
        };
    },

    /**
     * Belirli bir uçak için en kârlı 10 rotayı analiz eder.
     * Güncelleme: Eğer koltuk girilmediyse, her rotanın kendi ideal koltuğu üzerinden arama yapar.
     */
    analyzeTopRoutesForPlane: function(planeName, limit = 10, customSeats = null, manualTrips = null) {
        const plane = aircraftData[planeName];
        if (!plane) return [];

        let results = [];
        const isSeatsEmpty = !customSeats || (customSeats.y + customSeats.j + customSeats.f === 0);

        popularRoutes.forEach(route => {
            if (route.distance <= plane.range) {
                // Eğer koltuklar 0 ise, bu rota için önce en iyi koltukları hesapla, sonra kârı bul.
                let seatsToUse = customSeats;
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
                        efficiency: ((dailyProfit / plane.price) * 100).toFixed(4),
                        roiDays: (plane.price / dailyProfit).toFixed(1)
                    });
                }
            }
        });

        return results.sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit);
    },

    /**
     * Bütçeye göre en yüksek yatırım verimine sahip uçakları listeler.
     */
    getBestPlanesByType: function(budget, type, manualTrips = null) {
        const numericBudget = Number(budget);
        let matches = [];
        
        for (let name in aircraftData) {
            const p = aircraftData[name];
            if (p.price <= numericBudget && p.type === type) {
                // Uçak önerilerinde koltuk girilmediği için hep ideal konfigürasyon üzerinden tarar.
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
