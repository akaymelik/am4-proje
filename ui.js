/**
 * ui.js: AM4 Strateji Merkezi Arayüz Motoru.
 * GÜNCELLEME: 
 * - Splash Screen (Yükleme Ekranı) takılma sorunu giderildi.
 * - Hata yakalama (try-catch) eklenerek sistem kararlılığı artırıldı.
 */

const UI = {
    showPage: function(pageId) {
        try {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const target = document.getElementById(pageId);
            if (target) {
                target.classList.add('active');
            }
            this.closeAllDropdowns();
            window.scrollTo(0, 0);

            if (pageId.includes('route')) {
                this.fillSelects();
            }
        } catch (e) {
            console.error("Sayfa geçiş hatası:", e);
        }
    },

    toggleDropdown: function(id) {
        const drop = document.getElementById(id);
        if (!drop) return;
        const isOpen = drop.classList.contains('open');
        this.closeAllDropdowns();
        if (!isOpen) {
            drop.classList.add('open');
        }
    },

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    setGameMode: function(mode) {
        window.gameMode = mode; 
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const targetId = mode === 'easy' ? 'btn-easy' : 'id-real';
        const activeBtn = document.getElementById(targetId);
        if (activeBtn) activeBtn.classList.add('active');

        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = mode === 'easy' ? "Aktif Mod: Easy" : "Aktif Mod: Realism";
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }

        ['paxRouteResult', 'cargoRouteResult', 'paxPlaneResult', 'cargoPlaneResult'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
    },

    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');

        if (paxSelect) paxSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';
        if (cargoSelect) cargoSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';

        if (typeof aircraftData === 'undefined') return;

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

    renderSuggestions: function(cat) {
        try {
            const budgetInput = document.getElementById(cat + 'BudgetInput');
            const mTripsInput = document.getElementById(cat + 'ManualTrips');
            const resultDiv = document.getElementById(cat + 'PlaneResult');
            
            if (!budgetInput || !budgetInput.value) return;

            const budget = Number(budgetInput.value);
            const mTrips = Number(mTripsInput.value) || null;
            const typeKey = cat === 'pax' ? 'passenger' : 'cargo';

            const matches = Logic.getBestPlanesByType(budget, typeKey, mTrips);
            
            if (matches.length === 0) {
                resultDiv.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Uygun uçak bulunamadı.</p>`;
                return;
            }

            resultDiv.innerHTML = matches.map((m, index) => `
                <div class="result-item" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--primary)'}">
                    <div style="flex: 2; text-align: left;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <strong style="font-size: 1.15rem;">${m.name}</strong>
                            <span style="background: var(--primary); color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">
                                Skor: %${(m.finalScore * 100).toFixed(0)}
                            </span>
                        </div>
                        <small style="color: var(--success); font-weight: 700;">Rota: ${m.bestRouteOrigin} ➔ ${m.bestRouteName}</small><br>
                        <div style="font-size: 0.85rem; margin-top: 5px;">
                            Fiyat: <strong>${Utils.formatCurrency(m.price)}</strong> | 
                            Kâr: <strong style="color: var(--primary);">${Utils.formatCurrency(m.profitPerFlight)}</strong>
                        </div>
                        <small style="color: var(--text-muted); font-size: 0.75rem;">Günde ${m.appliedTrips} Sefer</small>
                    </div>
                    <div style="text-align: right; flex: 1; border-left: 1px solid var(--border); padding-left: 10px;">
                        <div style="color: var(--primary); font-weight: 800; font-size: 1.1rem;">${Utils.formatPercent(m.efficiency)}</div>
                        <small style="color: var(--text-muted); font-weight: 600;">${m.roi} G. ROI</small>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error("Öneri render hatası:", e);
        }
    },

    renderRouteAnalysis: function(cat) {
        try {
            const select = document.getElementById(cat + 'RouteSelect');
            const mTripsInput = document.getElementById(cat + (cat === 'pax' ? 'RouteManualTrips' : 'RouteManualTrips'));
            const resultDiv = document.getElementById(cat + 'RouteResult');
            
            const planeName = select.value;
            if (!planeName) return;
            
            const plane = aircraftData[planeName];
            const mTrips = Number(mTripsInput.value) || null;
            let seats = cat === 'pax' ? Configurator.getSeatConfig() : null;

            const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, seats, mTrips);
            const currentMode = window.gameMode || 'realism';

            resultDiv.innerHTML = `<h3 style="margin: 20px 0 15px 0;">En Karlı Rotalar (${currentMode.toUpperCase()})</h3>` + topRoutes.map((r, i) => {
                const opt = (cat === 'pax') ? Configurator.calculateOptimalSeats(plane, r, mTrips) : null;
                return `
                <div class="route-card">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <strong style="font-size: 1.05rem; flex: 1; text-align: left;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                        <div style="text-align: right;">
                            <div style="color: var(--success); font-weight: 800; font-size: 1.1rem;">${Utils.formatCurrency(r.dailyProfit)} / Gün</div>
                            <div style="color: var(--text-muted); font-size: 0.8rem;">${Utils.formatCurrency(r.profitPerFlight)} / Uçuş</div>
                        </div>
                    </div>
                    ${cat === 'pax' ? `
                    <div style="background: var(--primary-light); padding: 12px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="text-align: left;">
                            <span style="color: var(--primary); font-weight: 800; font-size: 0.8rem;">İDEAL:</span> 
                            <span class="suggest-badge">Y:${opt.y}</span> <span class="suggest-badge">J:${opt.j}</span> <span class="suggest-badge">F:${opt.f}</span>
                        </div>
                        <button onclick="Configurator.applySuggestion(${opt.y}, ${opt.j}, ${opt.f})" style="width: auto; padding: 6px 12px; margin: 0; font-size: 0.7rem; background: var(--success); border-radius: 8px;">Yükle</button>
                    </div>` : ''}
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
                        <span><strong>Mesafe:</strong> ${r.distance}km</span>
                        <span><strong>Uçuş:</strong> ${Utils.formatDuration(r.duration)}</span>
                        <span><strong>Sefer:</strong> ${r.dailyTrips}x</span>
                        <span><strong>Verim:</strong> ${Utils.formatPercent(r.efficiency)}</span>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            console.error("Rota analiz hatası:", e);
        }
    }
};

/**
 * Giriş Ekranı ve Global Olaylar
 */
const hideSplash = () => {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.classList.add('hidden');
};

// Sayfa yüklendiğinde çalışacaklar
window.addEventListener('load', () => {
    UI.fillSelects();
    UI.setGameMode('realism');
    setTimeout(hideSplash, 1500); // 2.5 saniyeden 1.5'e çektik (Daha hızlı hissettirir)
});

// Güvenlik önlemi: 4 saniye sonra hala kapanmadıysa zorla kapat
setTimeout(hideSplash, 4000);

document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});
