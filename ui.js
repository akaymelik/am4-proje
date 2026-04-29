/**
 * ui.js: AM4 Strateji Merkezi Arayüz Motoru.
 * GÜNCELLEME: 
 * - Kargo rotaları için Hafif (L) ve Ağır (H) yük önerileri arayüze eklendi.
 * - "Yükle" butonu kargo yapılandırmasını destekleyecek şekilde güncellendi.
 * - Splash Screen takılma sorunu için "Fail-safe" yapısı korundu.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     */
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
        } catch (error) {
            console.error("Sayfa geçişi sırasında hata:", error);
        }
    },

    /**
     * Mobil cihazlar için dropdown yönetimi.
     */
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

    /**
     * Oyun modunu (Easy/Realism) ayarlar.
     */
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

        // Mod değişince eski sonuçları temizle
        ['paxRouteResult', 'cargoRouteResult', 'paxPlaneResult', 'cargoPlaneResult'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
    },

    /**
     * Uçak seçim listelerini doldurur.
     */
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

    /**
     * Bütçeye göre en verimli uçakları listeler.
     */
    renderSuggestions: function(cat) {
        try {
            const budgetInput = document.getElementById(cat + 'BudgetInput');
            const mTripsInput = document.getElementById(cat + 'ManualTrips');
            const resultDiv = document.getElementById(cat + 'PlaneResult');
            
            if (!budgetInput || !budgetInput.value) return;

            const matches = Logic.getBestPlanesByType(Number(budgetInput.value), cat === 'pax' ? 'passenger' : 'cargo', Number(mTripsInput.value) || null);
            
            if (matches.length === 0) {
                resultDiv.innerHTML = `<p style="padding: 20px;">Bu bütçeye uygun uçak bulunamadı.</p>`;
                return;
            }

            resultDiv.innerHTML = matches.map((m, index) => `
                <div class="result-item" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--primary)'}">
                    <div style="flex: 2; text-align: left;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <strong style="font-size: 1.1rem;">${m.name}</strong>
                            <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">
                                Skor: %${(m.finalScore * 100).toFixed(0)}
                            </span>
                        </div>
                        <small style="color: var(--success); font-weight: 700;">${m.bestRouteOrigin} ➔ ${m.bestRouteName}</small>
                        <div style="font-size: 0.85rem; margin-top: 5px;">
                            Fiyat: <strong>${Utils.formatCurrency(m.price)}</strong> | 
                            Kâr: <strong style="color: var(--primary);">${Utils.formatCurrency(m.profitPerFlight)}</strong>
                        </div>
                        <small style="color: var(--text-muted); font-size: 0.75rem;">Operasyon: Günde <strong>${m.appliedTrips} Sefer</strong></small>
                    </div>
                    <div style="text-align: right; flex: 1; border-left: 1px solid var(--border); padding-left: 10px;">
                        <div style="color: var(--primary); font-weight: 800;">${Utils.formatPercent(m.efficiency)}</div>
                        <small style="color: var(--text-muted); font-weight: 600;">${m.roi} G. ROI</small>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error("Render hatası:", e);
        }
    },

    /**
     * Rota analizini render eder (Kargo L/H ve Yolcu Y/J/F destekli).
     */
    renderRouteAnalysis: function(cat) {
        try {
            const select = document.getElementById(cat + 'RouteSelect');
            const mTripsInput = document.getElementById(cat + 'RouteManualTrips');
            const resultDiv = document.getElementById(cat + 'RouteResult');
            
            const planeName = select.value;
            if (!planeName) return;
            
            const plane = aircraftData[planeName];
            const tripsValue = Number(mTripsInput.value) || null;
            
            // Konfigürasyonu o anki sayfadan çek
            const currentConfig = cat === 'pax' ? Configurator.getSeatConfig() : Configurator.getCargoConfig();

            const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, currentConfig, tripsValue);

            resultDiv.innerHTML = `<h3>En Karlı Rotalar</h3>` + topRoutes.map((r, i) => {
                const opt = (cat === 'pax') 
                    ? Configurator.calculateOptimalSeats(plane, r, tripsValue) 
                    : Configurator.calculateOptimalCargo(plane, r, tripsValue);
                
                return `
                <div class="route-card">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <strong style="font-size: 1rem;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                        <div style="text-align: right;">
                            <div style="color: var(--success); font-weight: 800;">${Utils.formatCurrency(r.dailyProfit)} / G.</div>
                            <div style="color: var(--text-muted); font-size: 0.8rem;">${Utils.formatCurrency(r.profitPerFlight)} / U.</div>
                        </div>
                    </div>

                    <!-- Öneri ve Yükleme Kutusu -->
                    <div style="background: var(--primary-light); padding: 10px; border-radius: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.1);">
                        <div style="text-align: left; font-size: 0.8rem;">
                            <span style="color: var(--primary); font-weight: 800;">ÖNERİLEN:</span> 
                            ${cat === 'pax' 
                                ? `<span class="suggest-badge">Y:${opt.y}</span> <span class="suggest-badge">J:${opt.j}</span> <span class="suggest-badge">F:${opt.f}</span>`
                                : `<span class="suggest-badge">L (Hafif): ${opt.l}</span> <span class="suggest-badge">H (Ağır): ${opt.h}</span>`
                            }
                        </div>
                        <button onclick="Configurator.applySuggestion(${cat === 'pax' ? `${opt.y}, ${opt.j}, ${opt.f}` : `${opt.l}, ${opt.h}`})" 
                                style="width: auto; padding: 4px 10px; margin: 0; font-size: 0.7rem; border-radius: 6px;">
                            Yükle
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
                        <span>Mesafe: ${r.distance}km</span>
                        <span>Uçuş: ${Utils.formatDuration(r.duration)}</span>
                        <span>Sefer: ${r.dailyTrips}x</span>
                        <span>Verim: ${Utils.formatPercent(r.efficiency)}</span>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            console.error("Analiz hatası:", e);
        }
    }
};

/**
 * Giriş Ekranı (Splash) Kaldırma Mantığı
 */
const hideSplash = () => {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        splash.classList.add('hidden');
    }
};

/**
 * Uygulama Başlatıcı
 */
const initMenoa = () => {
    try {
        UI.fillSelects(); 
        UI.setGameMode('realism'); 
        setTimeout(hideSplash, 1000);
    } catch (e) {
        console.error("Başlatma hatası:", e);
        hideSplash();
    }
};

// Sayfa hazır olduğunda çalıştır
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenoa);
} else {
    initMenoa();
}

// Güvenlik zamanlayıcısı
setTimeout(hideSplash, 3500);

// Dışarı tıklayınca dropdown kapat
document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});

// Global köprüler
window.updateCapacityCheck = () => Configurator.updateCapacityCheck();
