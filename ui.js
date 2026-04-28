/**
 * ui.js: Ekran geçişleri, veri görselleştirme ve kullanıcı etkileşimlerini yöneten modül.
 * Rota bazlı koltuk önerilerini ve "Konfigi Yükle" butonlarını yönetir.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     * @param {string} pageId - Aktif edilecek sayfanın ID'si.
     */
    showPage: function(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        const target = document.getElementById(pageId);
        if (target) {
            target.classList.add('active');
        }
        
        // Rota sayfasına geçildiğinde uçak listesini yenile
        if (pageId.includes('route')) {
            this.fillSelects();
        }
    },

    /**
     * Uçak seçim kutularını veritabanındaki (planes.js) güncel uçaklarla doldurur.
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
     * Bütçeye göre en verimli uçakları ve en kârlı rotalarını listeler.
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
            resultDiv.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Bu bütçeye uygun uçak bulunamadı.</p>`;
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
     * Seçilen uçak için en kârlı 10 rotayı analiz eder.
     * Yolcu uçakları için her rotaya özel ideal koltuk dağılımını gösterir.
     */
    renderRouteAnalysis: function(cat) {
        const select = document.getElementById(cat + 'RouteSelect');
        const mTripsInput = document.getElementById(cat + (cat === 'pax' ? 'RouteManualTrips' : 'RouteManualTrips'));
        const resultDiv = document.getElementById(cat + 'RouteResult');
        
        const planeName = select.value;
        if (!planeName) return;
        
        const plane = aircraftData[planeName];
        const mTrips = Number(mTripsInput.value) || null;
        let currentSeats = cat === 'pax' ? Configurator.getSeatConfig() : null;

        // Mevcut koltuklara göre en iyi 10 rotayı getir
        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, currentSeats, mTrips);
        
        if (topRoutes.length === 0) {
            resultDiv.innerHTML = `<p style="color: var(--danger); padding: 20px;">Uygun rota bulunamadı.</p>`;
            return;
        }

        resultDiv.innerHTML = `<h3>En Karlı Rotalar (Rota Bazlı Optimizasyon)</h3>` + topRoutes.map((r, i) => {
            // Her rota için o rotaya özel ideal koltuk yapılandırmasını hesapla
            const opt = (cat === 'pax') ? Configurator.calculateOptimalSeats(plane, r, mTrips) : null;
            
            return `
            <div class="route-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="font-size: 1.05rem;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <span style="color: var(--success); font-weight: 700; font-size: 1.1rem;">
                        ${Utils.formatCurrency(r.dailyProfit)} / Gün
                    </span>
                </div>
                
                ${cat === 'pax' ? `
                <div style="background: var(--info-bg); padding: 10px 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.1);">
                    <div>
                        <span style="color: var(--primary); font-weight: 700; font-size: 0.85rem;">BU ROTA İÇİN İDEAL:</span> 
                        <span class="suggest-badge" style="border:none; padding:0 5px">Y:${opt.y}</span>
                        <span class="suggest-badge" style="border:none; padding:0 5px">J:${opt.j}</span>
                        <span class="suggest-badge" style="border:none; padding:0 5px">F:${opt.f}</span>
                    </div>
                    <button onclick="Configurator.applySuggestion(${opt.y}, ${opt.j}, ${opt.f})" 
                            style="width: auto; padding: 6px 14px; margin: 0; font-size: 0.75rem; background: var(--success);">
                        Konfigi Yükle
                    </button>
                </div>
                ` : ''}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.8rem; color: var(--text-muted);">
                    <span><strong>Mesafe:</strong> ${r.distance} km</span>
                    <span><strong>Süre:</strong> ${Utils.formatDuration(r.duration)}</span>
                    <span><strong>Sefer:</strong> ${r.dailyTrips}x</span>
                    <span><strong>Verim:</strong> ${Utils.formatPercent(r.efficiency)}</span>
                </div>
            </div>`;
        }).join('');
    }
};

/**
 * Kapasite kontrolünü global kapsamda (input tetiklemeleri) çalıştırmak için pencereye bağla.
 */
window.updateCapacityCheck = function() {
    Configurator.updateCapacityCheck();
};

/**
 * Uygulama başladığında uçak seçim listelerini hazırla.
 */
window.onload = function() {
    UI.fillSelects();
};
