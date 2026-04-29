/**
 * ui.js: AM4 Strateji Merkezi (MENOA) Arayüz ve AI Entegrasyon Motoru.
 * GÜNCELLEME: 
 * - Gemini 2.5 Flash API entegrasyonu sağlandı.
 * - Butonlar yan yana gelecek şekilde (Yükle + AI Analiz) düzenlendi.
 * - Melik Akay strateji kuralları sistem talimatına eklendi.
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

    /**
     * Mobil menü açılır listelerini yönetir.
     */
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
        const apiKey = ""; // API anahtarı sistem tarafından otomatik enjekte edilir.
        const resultArea = document.getElementById('aiResultArea');
        const loader = document.getElementById('aiLoader');

        if (loader) loader.style.display = 'block';
        if (resultArea) resultArea.innerHTML = '';
        
        // Kullanıcıyı rapor alanına yumuşakça kaydır
        if (resultArea) resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const systemPrompt = `Sen AM4 (Airline Manager 4) uzmanı profesyonel bir stratejistsin. 
        Melik Akay'ın geliştirdiği MENOA standartlarına göre analiz yap.
        Kriterlerin:
        1. Hibrit Skor: %30 ROI (Amorti süresi) + %70 Günlük Net Kâr gücü dengesini incele.
        2. Bakım Maliyeti: Uçuş saati başına uçağın liste fiyatının %0.00004'ü kadar gideri hesaba kat.
        3. Talep Senkronizasyonu: Kapasitenin rotadaki talebi aşıp aşmadığını kontrol et.
        4. "MENOA AI Skoru" hesapla (0-100 arası).
        
        Yorumun kısa, öz, teknik ve samimi olsun. En sonunda mutlaka skoru belirt ve "By Melik akay" imzalı strateji dilini kullan.`;

        const userQuery = `Uçak: ${planeName}. Rota: ${routeData.origin} to ${routeData.destination}. Günlük Kar: ${Utils.formatCurrency(routeData.dailyProfit)}. Mesafe: ${routeData.distance}km. Verimlilik: ${Utils.formatPercent(routeData.efficiency)}.`;

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

                if (!response.ok) throw new Error("API Limit");

                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

                if (loader) loader.style.display = 'none';
                if (resultArea) {
                    resultArea.innerHTML = `
                        <div class="ai-report-card">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                                <span style="font-size:1.2rem;">🤖</span>
                                <h4 style="margin:0; color:var(--primary); font-size:0.95rem;">MENOA AI STRATEJİ RAPORU</h4>
                            </div>
                            <div style="font-size:0.85rem; line-height:1.6; color:var(--text);">
                                ${text.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                if (retryCount < 5) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => callAPI(retryCount + 1), delay);
                } else {
                    if (loader) loader.style.display = 'none';
                    if (resultArea) resultArea.innerHTML = '<div class="status-box status-danger">Yapay zeka şu an çok yoğun, lütfen birazdan tekrar dene.</div>';
                }
            }
        };

        callAPI();
    },

    /**
     * Bütçeye göre en verimli uçakları listeler.
     */
    renderSuggestions: function(cat) {
        try {
            const budgetInput = document.getElementById(cat + 'BudgetInput');
            const resultDiv = document.getElementById(cat + 'PlaneResult');
            if (!budgetInput?.value) return;

            const matches = Logic.getBestPlanesByType(budgetInput.value, cat === 'pax' ? 'passenger' : 'cargo');
            
            resultDiv.innerHTML = matches.map((m, index) => `
                <div class="result-item" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--primary)'}">
                    <div style="flex: 2; text-align: left;">
                        <strong>${m.name}</strong> 
                        <span class="suggest-badge" style="font-size:0.6rem;">Skor: %${(m.finalScore * 100).toFixed(0)}</span>
                        <div style="font-size: 0.75rem; color: var(--success);">${m.bestRouteOrigin} ➔ ${m.bestRouteName}</div>
                    </div>
                    <div style="text-align: right; flex: 1; border-left: 1px solid var(--border); padding-left: 10px;">
                        <div style="color: var(--primary); font-weight: 800; font-size: 0.9rem;">${Utils.formatPercent(m.efficiency)}</div>
                        <small style="color: var(--text-muted); font-size: 0.7rem;">${m.roi} G. ROI</small>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error(e); }
    },

    /**
     * Rota analizini render eder (Butonlar yan yana).
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

            resultDiv.innerHTML = `
                <div id="aiResultArea"></div>
                <div id="aiLoader" style="display:none; text-align:center; padding:15px; font-size:0.8rem; color:var(--primary); font-weight:700;">
                    MENOA AI Analiz Ediyor...
                </div>
                <h3>En Karlı Rotalar</h3>
            ` + topRoutes.map((r, i) => {
                const opt = (cat === 'pax') 
                    ? Configurator.calculateOptimalSeats(plane, r, r.dailyTrips) 
                    : Configurator.calculateOptimalCargo(plane, r, r.dailyTrips);
                
                return `
                <div class="route-card" style="${r.demandWarning ? 'border-top: 4px solid var(--danger);' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <strong style="font-size: 0.95rem;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: var(--success); font-weight: 800; font-size: 1rem;">${Utils.formatCurrency(r.dailyProfit)} / G.</div>
                            <div style="color: var(--text-muted); font-size: 0.65rem;">Bakım: ${Utils.formatCurrency(r.maintenanceCost)}</div>
                        </div>
                    </div>

                    <div class="suggestion-box">
                        <div class="config-text">
                            <span style="color: var(--primary); font-weight: 800; font-size: 0.75rem;">İDEAL:</span> 
                            ${cat === 'pax' 
                                ? `<span class="suggest-badge">Y:${opt.y}</span> <span class="suggest-badge">J:${opt.j}</span> <span class="suggest-badge">F:${opt.f}</span>`
                                : `<span class="suggest-badge">L:${opt.l}</span> <span class="suggest-badge">H:${opt.h}</span>`
                            }
                        </div>
                        <div class="action-group">
                            <button onclick="Configurator.applySuggestion(${cat === 'pax' ? `${opt.y}, ${opt.j}, ${opt.f}` : `${opt.l}, ${opt.h}`})" 
                                    class="apply-btn-small">Yükle</button>
                            <button onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/"/g, '&quot;')})" 
                                    class="ai-btn-small">AI Analiz</button>
                        </div>
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
 * Başlatıcı ve Güvenlik Zamanlayıcısı
 */
const hideSplashScreen = () => { document.getElementById('splash-screen')?.classList.add('hidden'); };

const initMenoa = () => {
    try {
        UI.fillSelects(); 
        UI.setGameMode('realism'); 
        setTimeout(hideSplashScreen, 1200);
    } catch (e) { hideSplashScreen(); }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenoa);
} else {
    initMenoa();
}

// Fail-safe: 3.5 sn sonra her halükarda ekranı aç
setTimeout(hideSplashScreen, 3500);

document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});

window.updateCapacityCheck = () => Configurator.updateCapacityCheck();
