/**
 * ui.js: Ekran geçişleri, mod yönetimi ve analiz sonuçlarının görselleştirilmesi.
 * Bu modül Logic, Utils ve Configurator modülleri ile tam entegre çalışır.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     * @param {string} pageId - Aktif edilecek sayfanın ID'si.
     */
    showPage: function(pageId) {
        // Tüm sayfaları gizle
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Hedef sayfayı göster
        const target = document.getElementById(pageId);
        if (target) {
            target.classList.add('active');
        }
        
        // Eğer bir analiz sayfasına geçildiyse seçim kutularını doldur
        if (pageId.includes('route')) {
            this.fillSelects();
        }
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
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Ana sayfadaki bilgi kutusunu ve mod metnini güncelle
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = mode === 'easy' 
                ? "Aktif Mod: Easy Mode (1.1x Bilet Çarpanı)" 
                : "Aktif Mod: Realism (1.0x Bilet Çarpanı)";
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }

        // Mod değiştiğinde eski analiz sonuçlarını temizle
        const results = ['paxRouteResult', 'cargoRouteResult', 'paxPlaneResult', 'cargoPlaneResult'];
        results.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
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
            if (plane.type === "passenger" && paxSelect) {
                paxSelect.add(option);
            } else if (plane.type === "cargo" && cargoSelect) {
                cargoSelect.add(option);
            }
        }
    },

    /**
     * Bütçeye göre en verimli uçakları listeler.
     * "Nereden Nereye" tam rota bilgisini içerir.
     */
    renderSuggestions: function(cat) {
        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const mTripsInput = document.getElementById(cat + 'ManualTrips');
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        
        if (!budgetInput || !budgetInput.value) return;

        const budget = Number(budgetInput.value);
        const mTrips = Number(mTripsInput.value) || null;
        const typeKey = cat === 'pax' ? 'passenger' : 'cargo';

        const matches = Logic.getBestPlanesByType(budget, typeKey, mTrips);
        
        if (matches.length === 0) {
            resultDiv.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Bu bütçeye uygun kârlı bir uçak bulunamadı.</p>`;
            return;
        }

        resultDiv.innerHTML = matches.map(m => `
            <div class="result-item">
                <div>
                    <strong>${m.name}</strong><br>
                    <small style="color: var(--success); font-weight: 600;">
                        En Karlı Rota: ${m.bestRouteOrigin} ➔ ${m.bestRouteName}
                    </small><br>
                    <small style="color: var(--text-muted)">Süre: ${Utils.formatDuration(m.duration)}</small>
                </div>
                <div style="text-align: right;">
                    <span style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">
                        ${Utils.formatPercent(m.efficiency)} Verim
                    </span><br>
                    <small style="color: var(--text-muted);">${m.roi} Gün ROI</small>
                </div>
            </div>
        `).join('');
    },

    /**
     * Seçilen uçak için rota analizini, talepleri ve ideal koltuk önerilerini listeler.
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
        
        if (topRoutes.length === 0) {
            resultDiv.innerHTML = `<p style="color: var(--danger); padding: 20px;">Uygun rota bulunamadı.</p>`;
            return;
        }

        const currentMode = window.gameMode || 'easy';

        resultDiv.innerHTML = `<h3>En Karlı Rotalar (${currentMode.toUpperCase()})</h3>` + topRoutes.map((r, i) => {
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
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; padding-left: 5px;">
                    <span style="font-weight: 700; color: var(--text);">Pazar Talebi:</span>
                    Y:${r.demand.y} | J:${r.demand.j} | F:${r.demand.f}
                </div>

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
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px; padding-left: 5px;">
                    <span style="font-weight: 700; color: var(--text);">Kargo Talebi:</span> ${r.demand.c || (r.demand.y * 500)} birim
                </div>
                `}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.85rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
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
 * Global başlatıcılar ve Pencere (Window) bağlantıları.
 */
window.updateCapacityCheck = function() { 
    if (typeof Configurator !== 'undefined') {
        Configurator.updateCapacityCheck(); 
    }
};

window.onload = function() { 
    UI.fillSelects(); 
    UI.setGameMode('easy'); // Uygulama varsayılan olarak Easy modda başlar.
};
