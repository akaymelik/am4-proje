/**
 * ui.js: Ekran geçişleri ve veri görselleştirme modülü.
 * Güncelleme: Rota kartlarına pazar talebi (Demand) bilgileri eklendi.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     */
    showPage: function(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) target.classList.add('active');
        if (pageId.includes('route')) this.fillSelects();
    },

    /**
     * Seçim kutularını uçak verileriyle doldurur.
     */
    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');
        if (paxSelect) paxSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';
        if (cargoSelect) cargoSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';

        for (let name in aircraftData) {
            const plane = aircraftData[name];
            const option = new Option(name, name);
            if (plane.type === "passenger" && paxSelect) paxSelect.add(option);
            else if (plane.type === "cargo" && cargoSelect) cargoSelect.add(option);
        }
    },

    /**
     * Bütçeye göre uçak önerilerini listeler.
     */
    renderSuggestions: function(cat) {
        const budget = Number(document.getElementById(cat + 'BudgetInput').value);
        const mTrips = Number(document.getElementById(cat + 'ManualTrips').value) || null;
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        if (!budget) return;

        const matches = Logic.getBestPlanesByType(budget, cat === 'pax' ? 'passenger' : 'cargo', mTrips);
        
        resultDiv.innerHTML = matches.map(m => `
            <div class="result-item">
                <div>
                    <strong>${m.name}</strong><br>
                    <small style="color: var(--success); font-weight: 600;">${m.bestRouteOrigin} ➔ ${m.bestRouteName}</small><br>
                    <small style="color: var(--text-muted)">Süre: ${Utils.formatDuration(m.duration)}</small>
                </div>
                <div style="text-align: right;">
                    <span style="color: var(--primary); font-weight: bold;">${Utils.formatPercent(m.efficiency)} Verim</span><br>
                    <small>${m.roi} Gün ROI</small>
                </div>
            </div>
        `).join('');
    },

    /**
     * Rota analiz sonuçlarını ve önerilen konfigürasyonları listeler.
     */
    renderRouteAnalysis: function(cat) {
        const select = document.getElementById(cat + 'RouteSelect');
        const mTripsInput = document.getElementById(cat + (cat === 'pax' ? 'RouteManualTrips' : 'RouteManualTrips'));
        const resultDiv = document.getElementById(cat + 'RouteResult');
        const planeName = select.value;
        if (!planeName) return;
        
        const plane = aircraftData[planeName];
        const mTrips = Number(mTripsInput.value) || null;
        let seats = cat === 'pax' ? Configurator.getSeatConfig() : null;

        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, seats, mTrips);
        
        resultDiv.innerHTML = `<h3>En Karlı Rotalar (Talep Odaklı Analiz)</h3>` + topRoutes.map((r, i) => {
            const opt = (cat === 'pax') ? Configurator.calculateOptimalSeats(plane, r, mTrips) : null;
            
            return `
            <div class="route-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <strong style="font-size: 1.1rem;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <span style="color: var(--success); font-weight: 700; font-size: 1.1rem;">
                        ${Utils.formatCurrency(r.dailyProfit)} / Gün
                    </span>
                </div>
                
                ${cat === 'pax' ? `
                <!-- Rota Talebi Gösterimi -->
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; padding-left: 5px; display: flex; gap: 10px;">
                    <span style="font-weight: 700; color: var(--text);">Pazar Talebi:</span>
                    <span>Eco: ${r.demand.y}</span>
                    <span>Bus: ${r.demand.j}</span>
                    <span>First: ${r.demand.f}</span>
                </div>

                <!-- İdeal Konfigürasyon ve Uygula Butonu -->
                <div style="background: var(--info-bg); padding: 12px 15px; border-radius: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.15);">
                    <div>
                        <span style="color: var(--primary); font-weight: 800; font-size: 0.85rem; margin-right: 8px;">İDEAL DİZİLİM:</span> 
                        <span class="suggest-badge" style="border:none; padding:0 5px; background:transparent;">Y:${opt.y}</span>
                        <span class="suggest-badge" style="border:none; padding:0 5px; background:transparent;">J:${opt.j}</span>
                        <span class="suggest-badge" style="border:none; padding:0 5px; background:transparent;">F:${opt.f}</span>
                    </div>
                    <button onclick="Configurator.applySuggestion(${opt.y}, ${opt.j}, ${opt.f})" 
                            style="width: auto; padding: 6px 14px; margin: 0; font-size: 0.75rem; background: var(--success); box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
                        Konfigi Yükle
                    </button>
                </div>
                ` : `
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px; padding-left: 5px;">
                    <span style="font-weight: 700; color: var(--text);">Kargo Talebi:</span> ${r.demand.c || r.demand.y} birim
                </div>
                `}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.85rem; color: var(--text-muted); border-top: 1px solid var(--border); pt-10px; margin-top: 5px; padding-top: 10px;">
                    <span><strong>Mesafe:</strong> ${r.distance}km</span>
                    <span><strong>Süre:</strong> ${Utils.formatDuration(r.duration)}</span>
                    <span><strong>Sefer:</strong> ${r.dailyTrips}x</span>
                    <span><strong>Verim:</strong> ${Utils.formatPercent(r.efficiency)}</span>
                </div>
            </div>`;
        }).join('');
    }
};

window.updateCapacityCheck = function() { Configurator.updateCapacityCheck(); };
window.onload = function() { UI.fillSelects(); };
