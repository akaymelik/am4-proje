/**
 * ui.js: Ekran geçişleri, mod yönetimi ve analiz sonuçlarının görselleştirilmesi.
 * Bu modül Logic, Utils ve Configurator ile entegre çalışır.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     * @param {string} pageId - Aktif edilecek sayfanın ID'si.
     */
    showPage: function(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) target.classList.add('active');
        
        // Rota sayfalarındaysak seçim kutularını tazele
        if (pageId.includes('route')) this.fillSelects();
    },

    /**
     * Oyun modunu (Easy/Realism) değiştirir ve tüm sistemi günceller.
     * @param {string} mode - 'easy' veya 'realism'
     */
    setGameMode: function(mode) {
        window.gameMode = mode; // Global değişkeni güncelle
        
        // Butonların görsel durumunu güncelle
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = mode === 'easy' ? document.getElementById('btn-easy') : document.getElementById('id-real');
        if (activeBtn) activeBtn.classList.add('active');

        // Ana sayfadaki bilgi kutusunu güncelle
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = mode === 'easy' 
                ? "Aktif Mod: Easy Mode (1.1x Bilet Çarpanı)" 
                : "Aktif Mod: Realism (1.0x Bilet Çarpanı)";
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }

        // Mod değiştiğinde eski analiz sonuçlarını temizle (Yanlış veriyi önlemek için)
        const paxRes = document.getElementById('paxRouteResult');
        const cargoRes = document.getElementById('cargoRouteResult');
        if (paxRes) paxRes.innerHTML = "";
        if (cargoRes) cargoRes.innerHTML = "";
    },

    /**
     * Uçak seçim listelerini planes.js verileriyle doldurur.
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
     * Bütçeye göre en verimli uçakları listeler.
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
     * Seçilen uçak için rota analizini ve ideal koltuk önerilerini basar.
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

        // Logic modülü üzerinden en iyi rotaları getir
        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, seats, mTrips);
        
        resultDiv.innerHTML = `<h3>En Karlı Rotalar (${gameMode.toUpperCase()})</h3>` + topRoutes.map((r, i) => {
            const opt = (cat === 'pax') ? Configurator.calculateOptimalSeats(plane, r, mTrips) : null;
            
            return `
            <div class="route-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <span style="color: var(--success); font-weight: 700;">${Utils.formatCurrency(r.dailyProfit)} / Gün</span>
                </div>
                
                ${cat === 'pax' ? `
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; padding-left: 5px;">
                    <span style="font-weight: 700; color: var(--text);">Pazar Talebi:</span>
                    Y:${r.demand.y} | J:${r.demand.j} | F:${r.demand.f}
                </div>

                <div style="background: var(--info-bg); padding: 12px; border-radius: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.2);">
                    <div>
                        <span style="color: var(--primary); font-weight: 800; font-size: 0.8rem;">İDEAL:</span> 
                        <span class="suggest-badge" style="border:none;">Y:${opt.y}</span>
                        <span class="suggest-badge" style="border:none;">J:${opt.j}</span>
                        <span class="suggest-badge" style="border:none;">F:${opt.f}</span>
                    </div>
                    <button onclick="Configurator.applySuggestion(${opt.y}, ${opt.j}, ${opt.f})" 
                            style="width: auto; padding: 6px 12px; margin: 0; font-size: 0.7rem; background: var(--success);">
                        Yükle
                    </button>
                </div>
                ` : `
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px; padding-left: 5px;">
                    <span style="font-weight: 700; color: var(--text);">Kargo Talebi:</span> ${r.demand.c || r.demand.y} birim
                </div>
                `}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
                    <span><strong>Mesafe:</strong> ${r.distance}km</span>
                    <span><strong>Süre:</strong> ${Utils.formatDuration(r.duration)}</span>
                    <span><strong>Sefer:</strong> ${r.dailyTrips}x</span>
                    <span><strong>Verim:</strong> ${Utils.formatPercent(r.efficiency)}</span>
                </div>
            </div>`;
        }).join('');
    }
};

/**
 * Global başlatıcılar.
 */
window.updateCapacityCheck = function() { Configurator.updateCapacityCheck(); };
window.onload = function() { 
    UI.fillSelects(); 
    UI.setGameMode('easy'); // Varsayılan mod
};
