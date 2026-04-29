/**
 * ui.js: AM4 Strateji Merkezi (MENOA) Arayüz ve AI Entegrasyon Motoru.
 * GÜNCELLEME: Gemini 2.5 Flash API entegrasyonu ve Melik Akay strateji seti eklendi.
 */

const UI = {
    /**
     * Sayfalar arası geçişi yönetir.
     */
    showPage: function(pageId) {
        try {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const target = document.getElementById(pageId);
            if (target) target.classList.add('active');
            
            this.closeAllDropdowns();
            window.scrollTo(0, 0);

            if (pageId.includes('route')) {
                this.fillSelects();
            }
        } catch (error) {
            console.error("Sayfa geçiş hatası:", error);
        }
    },

    toggleDropdown: function(id) {
        const drop = document.getElementById(id);
        if (!drop) return;
        const isOpen = drop.classList.contains('open');
        this.closeAllDropdowns();
        if (!isOpen) drop.classList.add('open');
    },

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    /**
     * Oyun modunu ve arayüzdeki durum kutusunu günceller.
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
    },

    /**
     * Uçak listelerini güncel verilerle doldurur.
     */
    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');
        if (paxSelect) paxSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';
        if (cargoSelect) cargoSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';

        if (typeof aircraftData === 'undefined') return;

        for (let name in aircraftData) {
            const p = aircraftData[name];
            const opt = new Option(name, name);
            if (p.type === "passenger" && paxSelect) paxSelect.add(opt);
            else if (p.type === "cargo" && cargoSelect) cargoSelect.add(opt);
        }
    },

    /**
     * YAPAY ZEKA: Gemini 2.5 Flash Analiz Motoru
     * Melik Akay strateji kurallarını kullanarak uçağı ve rotayı değerlendirir.
     */
    askGemini: async function(planeName, routeData) {
        const apiKey = ""; // API anahtarı çalışma ortamı tarafından sağlanır.
        const resultArea = document.getElementById('aiResultArea');
        const loader = document.getElementById('aiLoader');

        if (loader) loader.style.display = 'block';
        if (resultArea) resultArea.innerHTML = '';
        
        // Rapor alanına odaklan
        if (resultArea) resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const systemPrompt = `Sen AM4 (Airline Manager 4) uzmanı bir yapay zekasın. 
        Kullanıcının seçtiği uçak ve rota verilerini Melik Akay'ın MENOA strateji setine göre analiz et.
        Analiz kriterlerin:
        1. Hibrit Skor: %30 ROI (Amorti hızı) + %70 Günlük Net Kâr gücü dengesi.
        2. Bakım Maliyeti: Uçuş saati başına uçağın liste fiyatının %0.00004'ü kadar bir gider düşülmeli.
        3. Talep Senkronizasyonu: Uçak kapasitesi rotadaki günlük pazar talebini kesinlikle aşmamalı.
        4. "MENOA AI Skoru" hesapla (0-100 arası).
        
        Format: Profesyonel, samimi, kısa ve öz bir Türkçe uzman yorumu yap. 
        Sonuçta mutlaka 0-100 arası bir skor ver. "By Melik akay" imzalı strateji dilini kullan.`;

        const userQuery = `Analiz Talebi:
        Uçak: ${planeName}
        Rota: ${routeData.origin} ➔ ${routeData.destination}
        Mesafe: ${routeData.distance} km
        Günlük Net Kar: ${Utils.formatCurrency(routeData.dailyProfit)}
        Günlük Sefer: ${routeData.dailyTrips}
        Verimlilik: ${Utils.formatPercent(routeData.efficiency)}
        Bakım Gideri: ${Utils.formatCurrency(routeData.maintenanceCost)} / uçuş`;

        const callAPI = async (retryCount = 0) => {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: userQuery }] }],
                        systemInstruction: { parts: [{ text: systemPrompt }] }
                    })
                });

                if (!response.ok) throw new Error("API Connection Error");

                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

                if (loader) loader.style.display = 'none';
                if (resultArea) {
                    resultArea.innerHTML = `
                        <div class="ai-report-card">
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
                                <span style="font-size:1.5rem;">🤖</span>
                                <h4 style="margin:0; color:var(--primary); font-weight:800;">MENOA AI STRATEJİ RAPORU</h4>
                            </div>
                            <div style="font-size:0.95rem; line-height:1.6; color:var(--text);">
                                ${text.replace(/\n/g, '<br>')}
                            </div>
                            <div style="margin-top:15px; padding-top:12px; border-top:1px solid var(--border); font-size:0.75rem; color:var(--text-muted); font-style:italic;">
                                Veriler Gemini 2.5 Flash tarafından Melik Akay kriterleriyle işlenmiştir.
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                // Üstel geri çekilme (Exponential Backoff): 1s, 2s, 4s, 8s, 16s
                if (retryCount < 5) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => callAPI(retryCount + 1), delay);
                } else {
                    if (loader) loader.style.display = 'none';
                    if (resultArea) resultArea.innerHTML = '<div class="status-box status-danger">Yapay zeka analiz motoru şu an meşgul. Lütfen 30 saniye sonra tekrar deneyin.</div>';
                }
            }
        };

        callAPI();
    },

    /**
     * Bütçeye göre en iyi uçakları listeler.
     */
    renderSuggestions: function(cat) {
        try {
            const budgetInput = document.getElementById(cat + 'BudgetInput');
            const mTripsInput = document.getElementById(cat + 'ManualTrips');
            const resultDiv = document.getElementById(cat + 'PlaneResult');
            
            if (!budgetInput?.value) return;

            const matches = Logic.getBestPlanesByType(budgetInput.value, cat === 'pax' ? 'passenger' : 'cargo', Number(mTripsInput.value) || null);
            
            if (matches.length === 0) {
                resultDiv.innerHTML = `<p style="padding:20px;">Bu bütçeye uygun verimli uçak bulunamadı.</p>`;
                return;
            }

            resultDiv.innerHTML = matches.map((m, index) => `
                <div class="result-item" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--primary)'}">
                    <div style="flex: 2; text-align: left;">
                        <strong>${m.name}</strong> 
                        <span class="suggest-badge" style="font-size:0.65rem;">Skor: %${(m.finalScore * 100).toFixed(0)}</span>
                        <div style="font-size: 0.8rem; color: var(--success); margin: 3px 0;">${m.bestRouteOrigin} ➔ ${m.bestRouteName}</div>
                        <div style="font-size: 0.85rem;">Kar: <strong>${Utils.formatCurrency(m.profitPerFlight)}</strong></div>
                    </div>
                    <div style="text-align: right; flex: 1; border-left: 1px solid var(--border); padding-left: 10px;">
                        <div style="color: var(--primary); font-weight: 800;">${Utils.formatPercent(m.efficiency)}</div>
                        <small style="color: var(--text-muted);">${m.roi} G. ROI</small>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error(e); }
    },

    /**
     * Rota analizini AI butonu ile birlikte render eder.
     */
    renderRouteAnalysis: function(cat) {
        try {
            const select = document.getElementById(cat + 'RouteSelect');
            const mTripsInput = document.getElementById(cat + 'RouteManualTrips');
            const resultDiv = document.getElementById(cat + 'RouteResult');
            
            const planeName = select.value;
            if (!planeName) return;
            
            const plane = aircraftData[planeName];
            const config = cat === 'pax' ? Configurator.getSeatConfig() : Configurator.getCargoConfig();
            const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, config, Number(mTripsInput.value) || null);

            // AI Sonuç Alanı ve Loader
            resultDiv.innerHTML = `
                <div id="aiResultArea"></div>
                <div id="aiLoader" style="display:none; text-align:center; padding:20px;">
                    <div class="loader-spinner"></div>
                    <p style="margin-top:10px;">MENOA AI Verileri Analiz Ediyor...</p>
                </div>
                <h3>En Karlı Rotalar (Bakım & Talep Dahil)</h3>
            ` + topRoutes.map((r, i) => {
                const opt = (cat === 'pax') 
                    ? Configurator.calculateOptimalSeats(plane, r, r.dailyTrips) 
                    : Configurator.calculateOptimalCargo(plane, r, r.dailyTrips);
                
                return `
                <div class="route-card" style="${r.demandWarning ? 'border-top: 4px solid var(--danger);' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <strong style="font-size: 1rem;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                            <button onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/"/g, '&quot;')})" 
                                    class="ai-btn">
                                🤖 Gemini AI Strateji Analizi
                            </button>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: var(--success); font-weight: 800;">${Utils.formatCurrency(r.dailyProfit)} / G.</div>
                            <div style="color: var(--text-muted); font-size: 0.7rem;">Bakım: ${Utils.formatCurrency(r.maintenanceCost)}</div>
                        </div>
                    </div>

                    <div class="suggestion-box">
                        <div style="font-size: 0.8rem;">
                            <span style="color: var(--primary); font-weight: 800;">İDEAL:</span> 
                            ${cat === 'pax' 
                                ? `<span class="suggest-badge">Y:${opt.y}</span> <span class="suggest-badge">J:${opt.j}</span> <span class="suggest-badge">F:${opt.f}</span>`
                                : `<span class="suggest-badge">L:${opt.l}</span> <span class="suggest-badge">H:${opt.h}</span>`
                            }
                        </div>
                        <button onclick="Configurator.applySuggestion(${cat === 'pax' ? `${opt.y}, ${opt.j}, ${opt.f}` : `${opt.l}, ${opt.h}`})" 
                                class="apply-btn">
                            Yükle
                        </button>
                    </div>

                    <div class="route-footer">
                        <span>Mesafe: ${r.distance}km</span>
                        <span>Uçuş: ${Utils.formatDuration(r.duration)}</span>
                        <span>Sefer: ${r.dailyTrips}x</span>
                        <span>Verim: ${Utils.formatPercent(r.efficiency)}</span>
                    </div>
                </div>`;
            }).join('');
        } catch (e) { console.error(e); }
    }
};

/**
 * Başlatıcı ve Splash Kontrolü
 */
const hideSplash = () => {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.classList.add('hidden');
};

const initMenoa = () => {
    try {
        UI.fillSelects(); 
        UI.setGameMode('realism'); 
        setTimeout(hideSplash, 1500);
    } catch (e) { hideSplash(); }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenoa);
} else {
    initMenoa();
}

// Güvenlik zamanlayıcısı (Takılma önleyici)
setTimeout(hideSplash, 3500);

document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});

window.updateCapacityCheck = () => Configurator.updateCapacityCheck();
