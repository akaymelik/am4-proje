/**
 * configurator.js: Rota talebine göre koltuk optimizasyonu.
 */

const Configurator = {
    getTicketMultipliers: function(distance, mode = window.gameMode) {
        const isEasy = (mode === 'easy');
        const yBase = (0.4 * distance) + 170;
        const jBase = (0.8 * distance) + 560;
        const fBase = (1.2 * distance) + 1200;

        const cargoRate = (distance < 2000 ? 0.56 : distance < 5000 ? 0.52 : 0.47);

        return {
            y: Math.floor(yBase * (isEasy ? 1.10 : 1.0)),
            j: Math.floor(jBase * (isEasy ? 1.08 : 1.0)),
            f: Math.floor(fBase * (isEasy ? 1.06 : 1.0)),
            l: cargoRate * (isEasy ? 1.10 : 1.0) * distance,
            h: (cargoRate - 0.08) * (isEasy ? 1.08 : 1.0) * distance
        };
    },

    calculateOptimalSeats: function(plane, route, trips = 1) {
        let rem = plane.capacity;
        // Uçuş başına düşen gerçek talep
        const fReq = Math.floor((route.demand.f || 0) / trips);
        const jReq = Math.floor((route.demand.j || 0) / trips);
        const yReq = Math.floor((route.demand.y || 0) / trips);

        const f = Math.min(fReq, Math.floor(rem / 3)); rem -= f * 3;
        const j = Math.min(jReq, Math.floor(rem / 2)); rem -= j * 2;
        const y = Math.min(yReq, rem);
        
        return { y, j, f };
    },

    calculateOptimalCargo: function(plane, route, trips = 1) {
        const effectiveCap = plane.capacity * 0.7; 
        const demandPerFlight = (route.demand.c || 0) / trips;
        return { l: Math.floor(Math.min(demandPerFlight, effectiveCap)), h: 0 };
    },

    updateCapacityCheck: function() {
        const isPax = document.getElementById('pax-route').classList.contains('active');
        const planeName = document.getElementById(isPax ? 'paxRouteSelect' : 'cargoRouteSelect').value;
        if (!planeName) return;

        const p = aircraftData[planeName];
        let used = 0;
        if (isPax) {
            used = (Number(document.getElementById('seatsY').value) || 0) + 
                   (Number(document.getElementById('seatsJ').value) * 2 || 0) + 
                   (Number(document.getElementById('seatsF').value) * 3 || 0);
        } else {
            used = (Number(document.getElementById('cargoL').value) || 0) + 
                   (Number(document.getElementById('cargoH').value) || 0);
        }

        const info = document.getElementById(isPax ? 'capacityInfo' : 'cargoCapacityInfo');
        const maxCap = p.type === "cargo" ? p.capacity * 0.7 : p.capacity;
        const rem = Math.floor(maxCap - used);
        
        info.innerText = `Kullanılan: ${used} / Limit: ${Math.floor(maxCap)} (${rem >= 0 ? rem + ' boş' : 'LİMİT AŞILDI!'})`;
        info.className = "status-box " + (used > maxCap ? "status-danger" : "status-success");
    },

    applySuggestion: function(v1, v2, v3 = null) {
        if (v3 !== null) {
            document.getElementById('seatsY').value = v1;
            document.getElementById('seatsJ').value = v2;
            document.getElementById('seatsF').value = v3;
        } else {
            document.getElementById('cargoL').value = v1;
            document.getElementById('cargoH').value = v2;
        }
        this.updateCapacityCheck();
        const targetId = v3 !== null ? 'paxRouteSelect' : 'cargoRouteSelect';
        window.scrollTo({ top: document.getElementById(targetId).offsetTop - 100, behavior: 'smooth' });
    }
};

window.Configurator = Configurator;
