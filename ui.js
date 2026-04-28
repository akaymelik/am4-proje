/**
 * ui.js: Ekran geçişleri, mod yönetimi ve analiz sonuçlarının görselleştirilmesi.
 * Güncellemeler:
 * - Hibrit Puanlama (%30 Verim + %70 Kâr) arayüz desteği.
 * - Uçak fiyatı ve uçuş başı kâr bilgilerinin eklenmesi.
 * - "Nereden ➔ Nereye" rota gösterim formatı.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     * @param {string} pageId - Aktif edilecek sayfa ID'si.
     */
    showPage: function(pageId) {
        // Tüm sayfaları gizle
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Hedef sayfayı göster
        const target = document.getElementById(pageId);
        if (target) {
            target.classList.add('active');
        }
        
        // Rota sayfalarındaysak seçim kutularını tazele
        if (pageId.includes('route')) {
            this.fillSelects();
        }
    },

    /**
     * Oyun modunu (Easy/Realism) değiştirir ve tüm arayüzü günceller.
     * @param {string} mode - 'easy' veya 'realism'
     */
    setGameMode: function(mode) {
        window.gameMode = mode; // Global mod değişkeni
        
        // Butonların aktiflik durumunu güncelle
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = mode === 'easy' ? document.getElementById('btn-easy') : document.getElementById('id-real');
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Ana sayfadaki mod bilgisini güncelle
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = mode === 'easy' 
                ? "Aktif Mod: Easy Mode (1.1x Bilet Çarpanı)" 
                : "Aktif Mod: Realism (1.0x Bilet Çarpanı)";
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }

        // Mod değiştiğinde eski sonuçları temizle
        ['paxRouteResult', 'cargoRouteResult', 'paxPlaneResult', 'cargoPlaneResult'].forEach(id => {
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
     * Bütçeye göre en verimli uçakları Hibrit Skor ile listeler.
     * @param {string} cat - 'pax' veya 'cargo'
     */
    renderSuggestions: function(cat) {
        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const mTripsInput = document.getElementById(cat + 'ManualTrips');
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        
        if (!budgetInput || !budgetInput.value) return;

        const budget = Number(budgetInput.value);
        const mTrips = Number(mTripsInput.value) || null;
        const typeKey = cat === 'pax' ? 'passenger' : 'cargo';

        // Logic.js içindeki hibrit puanlamayı çağır
        const matches = Logic.getBestPlanesByType(budget, typeKey, mTrips);
        
        if (matches.length === 0) {
            resultDiv.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Bu bütçeye uygun uçak bulunamadı.</p>`;
            return;
        }

        resultDiv.innerHTML = matches.map((m, index) => `
            <div class="result-item" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--primary)'}">
                <div style="flex: 2;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <strong style="font-size: 1.1rem;">${m.name}</strong>
                        <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">
                            Skor: %${(m.finalScore * 100).toFixed(0)}
                        </span>
                    </div>
                    <small style="color: var(--success); font-weight: 700; display: block; margin-bottom: 5px;">
                        En Karlı Rota: ${m.bestRouteOrigin} ➔ ${m.bestRouteName}
                    </small>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        Fiyat: <strong>${Utils.formatCurrency(m.price)}</strong> | 
                        1 Uçuşta Kâr: <strong style="color: var(--primary);">${Utils.formatCurrency(m.profitPerFlight)}</strong>
                    </div>
                </div>
                <div style="text-align: right; flex: 1; border-left: 1px solid var(--border); padding-left: 15px;">
                    <div style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">
                        ${Utils.formatPercent(m.efficiency)}
                    </div>
                    <small style="color: var(--text-muted);">${m.roi} Gün ROI</small>
                </div>
            </div>
        `).join('');
    },

    /**
     * Rota analizini listeler ve Günlük Kârın altına Uçuş Başı Kârı ekler.
     * @param {string} cat - 'pax' veya 'cargo'
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
        const currentMode = window.gameMode || 'easy';

        resultDiv.innerHTML = `<h3 style="margin: 20px 0 15px 0;">En Karlı Rotalar (${currentMode.toUpperCase()})</h3>` + topRoutes.map((r, i) => {
            const opt = (cat === 'pax') ? Configurator.calculateOptimalSeats(plane, r, mTrips) : null;
            
            return `
            <div class="route-card">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <strong style="font-size: 1.1rem;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <div style="text-align: right;">
                        <div style="color: var(--success); font-weight: 800; font-size: 1.1rem;">
                            ${Utils.formatCurrency(r.dailyProfit)} / Gün
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">
                            ${Utils.formatCurrency(r.profitPerFlight)} / Uçuş
                        </div>
                    </div>
                </div>
                
                ${cat === 'pax' ? `
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
                    <span style="font-weight: 700; color: var(--text);">Talep:</span>
                    Y:${r.demand.y} | J:${r.demand.j} | F:${r.demand.f}
                </div>

                <div style="background: var(--info-bg); padding: 12px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.1);">
                    <div>
                        <span style="color: var(--primary); font-weight: 800; font-size: 0.8rem; margin-right: 8px;">İDEAL DİZİLİM:</span> 
                        <span class="suggest-badge">Y:${opt.y}</span>
                        <span class="suggest-badge">J:${opt.j}</span>
                        <span class="suggest-badge">F:${opt.f}</span>
                    </div>
                    <button onclick="Configurator.applySuggestion(${opt.y}, ${opt.j}, ${opt.f})" 
                            style="width: auto; padding: 6px 14px; margin: 0; font-size: 0.75rem; background: var(--success); border-radius: 8px;">
                        Yükle
                    </button>
                </div>
                ` : `
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">
                    <span style="font-weight: 700; color: var(--text);">Kargo Talebi:</span> ${r.demand.c || (r.demand.y * 500)} birim
                </div>
                `}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.85rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 12px;">
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
window.updateCapacityCheck = function() { 
    if (typeof Configurator !== 'undefined') Configurator.updateCapacityCheck(); 
};

window.onload = function() { 
    UI.fillSelects(); 
    UI.setGameMode('easy'); 
};
