/**
 * configurator.js: Master Verilere göre koltuk ve kargo yük optimizasyonu.
 */

const Configurator = {
    updateCapacityCheck: function() {
        const isPax = document.getElementById('pax-route').classList.contains('active');
        const selectId = isPax ? 'paxRouteSelect' : 'cargoRouteSelect';
        const planeName = document.getElementById(selectId).value;
        if (!planeName) return;

        const p = aircraftData[planeName];
        let used = 0;
        if (isPax) {
            used = Number(document.getElementById('seatsY').value || 0) + 
                   (Number(document.getElementById('seatsJ').value || 0) * 2) + 
                   (Number(document.getElementById('seatsF').value || 0) * 3);
        } else {
            used = Number(document.getElementById('cargoL').value || 0) + 
                   Number(document.getElementById('cargoH').value || 0);
        }

        const info = document.getElementById(isPax ? 'capacityInfo' : 'cargoCapacityInfo');
        info.innerText = `Kapasite: ${used} / ${p.capacity} (${p.capacity - used} boş)`;
        info.className = "status-box " + (used > p.capacity ? "status-danger" : "status-success");
    },

    getTicketMultipliers: function(distance) {
        // Master Data Formülleri
        return {
            y: (0.4 * distance) + 170,
            j: (0.8 * distance) + 560,
            f: (1.2 * distance) + 1200,
            l: (distance < 2000 ? 0.56 : distance < 5000 ? 0.52 : 0.47) * distance, // Large
            h: (distance < 2000 ? 0.48 : distance < 5000 ? 0.44 : 0.40) * distance  // Heavy
        };
    },

    calculateOptimalSeats: function(plane, route, trips = 1) {
        let rem = plane.capacity;
        const f = Math.min(Math.floor((route.demand.f || 0) / trips), Math.floor(rem / 3)); rem -= f * 3;
        const j = Math.min(Math.floor((route.demand.j || 0) / trips), Math.floor(rem / 2)); rem -= j * 2;
        const y = Math.min(Math.floor((route.demand.y || 0) / trips), rem);
        return { y, j, f };
    },

    calculateOptimalCargo: function(plane, route, trips = 1) {
        // Master Data: %100 Large Load, kapasitenin %70'ini kullanır
        const effectiveCap = plane.capacity * 0.7;
        const perFlightDemand = Math.floor((route.demand.c || 0) / trips);
        const l = Math.min(perFlightDemand, Math.floor(effectiveCap));
        return { l: l, h: 0 };
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};
