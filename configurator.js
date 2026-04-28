/**
 * configurator.js: Koltuk yapılandırması ve akıllı öneri motoru.
 * AM4 Kuralları: Economy (Y) = 1, Business (J) = 2, First (F) = 3 birim yer kaplar.
 */

const Configurator = {
    /**
     * Kullanıcının girdiği mevcut koltuk değerlerini alır.
     */
    getSeatConfig: function() {
        return {
            y: parseInt(document.getElementById('seatsY')?.value) || 0,
            j: parseInt(document.getElementById('seatsJ')?.value) || 0,
            f: parseInt(document.getElementById('seatsF')?.value) || 0
        };
    },

    /**
     * Kapasite kontrolü yapar ve arayüzü günceller.
     * Aynı zamanda akıllı öneri motorunu tetikler.
     */
    updateCapacityCheck: function() {
        const planeName = document.getElementById('paxRouteSelect')?.value;
        const infoDiv = document.getElementById('capacityInfo');
        
        if (!planeName || !aircraftData[planeName]) {
            if (infoDiv) {
                infoDiv.className = "status-box status-neutral";
                infoDiv.innerText = "Lütfen bir uçak seçin.";
            }
            this.hideSuggestion();
            return false;
        }

        const plane = aircraftData[planeName];
        const config = this.getSeatConfig();
        const used = config.y + (config.j * 2) + (config.f * 3);
        const remaining = plane.capacity - used;
        
        if (infoDiv) {
            if (remaining < 0) {
                infoDiv.className = "status-box status-danger";
                infoDiv.innerText = `Kapasite Aşıldı: ${used} / ${plane.capacity}`;
            } else {
                infoDiv.className = "status-box status-success";
                infoDiv.innerText = `Kapasite Uygun: ${used} / ${plane.capacity} (Kalan: ${remaining})`;
            }
        }

        // Akıllı öneriyi göster/güncelle
        this.showOptimalSuggestion(planeName);

        return used <= plane.capacity;
    },

    /**
     * Uçağın en kârlı rotasındaki talebe göre ideal koltuk dağılımını hesaplar.
     */
    showOptimalSuggestion: function(planeName) {
        const suggestDiv = document.getElementById('optimalConfigSuggest');
        if (!suggestDiv) return;

        const plane = aircraftData[planeName];
        // En kârlı ilk rotayı baz alıyoruz (Genel bir öneri için en mantıklı olanıdır)
        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 1);
        
        if (topRoutes.length === 0) {
            this.hideSuggestion();
            return;
        }

        const bestRoute = topRoutes[0];
        const trips = bestRoute.dailyTrips;
        const demand = bestRoute.demand;

        // Sefer başına düşen talep (Sınırlayıcı faktör)
        const dY = demand.y / trips;
        const dJ = demand.j / trips;
        const dF = demand.f / trips;

        // Ağırlıklı talep toplamı (Kapasite birimi cinsinden)
        const totalWeightedDemand = dY + (dJ * 2) + (dF * 3);
        
        let sY, sJ, sF;

        if (totalWeightedDemand <= plane.capacity) {
            // Eğer uçağın kapasitesi toplam talepten fazlaysa, tam talebi koy
            sY = Math.floor(dY);
            sJ = Math.floor(dJ);
            sF = Math.floor(dF);
        } else {
            // Talep kapasiteden fazlaysa, oranla (Proportional Scaling)
            const scale = plane.capacity / totalWeightedDemand;
            sY = Math.floor(dY * scale);
            sJ = Math.floor(dJ * scale);
            sF = Math.floor(dF * scale);
        }

        // Kalan kapasiteyi en pahalı sınıfa (F) veya E'ye ekleyerek optimize et
        let currentUsed = sY + (sJ * 2) + (sF * 3);
        while (currentUsed < plane.capacity) {
            if (sF < dF) { sF++; }
            else if (sJ < dJ) { sJ++; }
            else { sY++; }
            currentUsed = sY + (sJ * 2) + (sF * 3);
            if (currentUsed > plane.capacity) break; // Güvenlik kısıtı
        }

        suggestDiv.style.display = "block";
        suggestDiv.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px; text-transform: uppercase; font-weight: 700;">
                Talebe Göre Önerilen Yapılandırma
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <div class="suggest-badge">Y: ${sY}</div>
                <div class="suggest-badge">J: ${sJ}</div>
                <div class="suggest-badge">F: ${sF}</div>
                <button onclick="Configurator.applySuggestion(${sY}, ${sJ}, ${sF})" style="padding: 4px 10px; font-size: 0.75rem; width: auto; margin: 0; background: var(--success);">Uygula</button>
            </div>
        `;
    },

    /**
     * Önerilen değerleri inputlara yazar.
     */
    applySuggestion: function(y, j, f) {
        document.getElementById('seatsY').value = y;
        document.getElementById('seatsJ').value = j;
        document.getElementById('seatsF').value = f;
        this.updateCapacityCheck();
    },

    hideSuggestion: function() {
        const suggestDiv = document.getElementById('optimalConfigSuggest');
        if (suggestDiv) suggestDiv.style.display = "none";
    },

    /**
     * AM4 Standart Fiyat Motoru
     */
    getTicketMultipliers: function(distance) {
        return {
            y: ((0.4 * distance) + 170) * 1.1,
            j: ((0.8 * distance) + 560) * 1.1,
            f: ((1.2 * distance) + 1200) * 1.1
        };
    }
};
