/**
 * ui.js: AM4 Strateji Merkezi Arayüz ve AI Motoru Bağlantısı.
 * Önemli: worker.airm4.workers.dev adresine bağlanır.
 */

const UI = {
    showPage: function(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(id);
        if (targetPage) targetPage.classList.add('active');
        UI.closeAllDropdowns();
        if (id.includes('route')) UI.fillSelects();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    toggleDropdown: function(id) {
        const el = document.getElementById(id);
        const isOpen = el.classList.contains('open');
        UI.closeAllDropdowns();
        if (!isOpen) el.classList.add('open');
    },

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    setGameMode: function(mode) {
        window.gameMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = mode === 'easy' ? document.getElementById('btn-easy') : document.getElementById('id-real');
        if (activeBtn) activeBtn.classList.add('active');
        
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = "Aktif Mod: " + (mode === 'easy' ? "Easy (1.1x)" : "Realism (1.0x)");
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }
    },

    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');
        if (paxSelect) {
            paxSelect.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let name in aircraftData) {
                if (aircraftData[name].type === "passenger") paxSelect.add(new Option(name, name));
            }
        }
        if (cargoSelect) {
            cargoSelect.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let name in aircraftData) {
                if (aircraftData[name].type === "cargo") cargoSelect.add(new Option(name, name));
            }
        }
    },

    // --- KRİTİK AI FONKSİYONU ---
    askGemini: async function(planeName, routeData) {
        const workerUrl = "https://worker.airm4.workers.dev/"; // Senin Worker URL'in
        
        const resultArea = document.getElementById('aiResultArea');
        const loader = document.getElementById('aiLoader');

        if (loader) loader.style.display = 'block';
        if (resultArea) resultArea.innerHTML = '';

        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plane: planeName,
                    route: `${routeData.origin} ➔ ${routeData.destination}`,
                    profit: Utils.formatCurrency(routeData.dailyProfit),
                    distance: routeData.distance,
                    efficiency: Utils.formatPercent(routeData.efficiency)
                })
            });

            const data = await response.json();
            
            if (loader) loader.style.display = 'none';
            if (resultArea) {
                resultArea.innerHTML = `
                    <div class="ai-report-card">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                            <span style="font-size:1.4rem;">🤖</span>
                            <h4 style="margin:0; color:var(--primary); font-weight:800;">MENOA AI ANALİZ RAPORU</h4>
                        </div>
                        <div style="font-size:0.9rem; line-height:1.7; color:var(--text);">
                            ${data.text.replace(/\n/g, '<br>')}
                        </div>
                    </div>`;
                resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            if (loader) loader.style.display = 'none';
            if (resultArea) resultArea.innerHTML = '<div class="status-box status-danger">AI Motoru şu an meşgul. Lütfen 10 saniye bekleyip tekrar deneyin.</div>';
        }
    },

    renderSuggestions: function(cat) {
        const budget = Number(document.getElementById(cat + 'BudgetInput').value);
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        if (!budget) return;

        const bestPlanes = Logic.getBestPlanesByType(budget, cat === 'pax' ? 'passenger' : 'cargo');
        resultDiv.innerHTML = bestPlanes.map(p => `
            <div class="plane-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.name}</strong>
                    <span style="color:var(--primary); font-weight:800;">${Utils.formatPercent(p.efficiency)} Verim</span>
                </div>
                <div style="font-size:0.8rem; margin-top:5px; color:var(--text-muted);">
                    Fiyat: ${Utils.formatCurrency(p.price)} | Günlük Kâr: ${Utils.formatCurrency(p.dailyProfit)}
                </div>
                <small style="color:var(--success); font-weight:600;">En İyi Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}</small>
            </div>
        `).join('');
    },

    renderRouteAnalysis: function(cat) {
        const select = document.getElementById(cat + 'RouteSelect');
        const resultDiv = document.getElementById(cat + 'RouteResult');
        const planeName = select.value;
        if (!planeName) return;

        resultDiv.innerHTML = `
            <div id="aiResultArea"></div>
            <div id="aiLoader" style="display:none; text-align:center; padding:15px; font-weight:800; color:var(--primary);">🤖 MENOA Analiz Ediyor...</div>
            <h3>En Karlı Rotalar</h3>
        `;

        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 12);
        topRoutes.forEach((r, i) => {
            const card = document.createElement('div');
            card.className = 'route-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <div style="color:var(--success); font-weight:800;">${Utils.formatCurrency(r.dailyProfit)}/G.</div>
                </div>
                <div class="action-group" style="margin-top:10px; display:flex; gap:10px;">
                    <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/"/g, '&quot;')})">🤖 AI Analiz Et</button>
                </div>
                <div style="margin-top:8px; font-size:0.7rem; color:var(--text-muted);">
                    Mesafe: ${r.distance}km | Verim: ${Utils.formatPercent(r.efficiency)}
                </div>
            `;
            resultDiv.appendChild(card);
        });
    }
};
