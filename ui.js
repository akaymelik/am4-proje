const UI = {
    showPage: (id) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
        if (id && id.includes('route')) UI.fillSelects();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    fillSelects: () => {
        const ps = document.getElementById('paxRouteSelect');
        const cs = document.getElementById('cargoRouteSelect');
        if (ps) {
            ps.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let n in aircraftData) if (aircraftData[n].type === 'passenger') ps.add(new Option(n, n));
        }
        if (cs) {
            cs.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let n in aircraftData) if (aircraftData[n].type === 'cargo') cs.add(new Option(n, n));
        }
    },
    renderRouteAnalysis: function(cat) {
        const planeName = document.getElementById(cat === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect')?.value;
        const resDiv = document.getElementById(cat + 'RouteResult');
        const manualTrips = parseInt(document.getElementById(cat === 'pax' ? 'paxTripsInput' : 'cargoTripsInput')?.value) || null;

        if (!planeName || !resDiv) return;
        resDiv.innerHTML = '<div id="aiResultArea"></div><h3 style="margin:20px 0;">Analiz Sonuçları</h3>';
        
        Logic.analyzeTopRoutesForPlane(planeName, 10, null, manualTrips).forEach(r => {
            const card = document.createElement('div');
            card.className = 'route-card';
            card.innerHTML = `
                <div class="route-header">
                    <div><strong>${r.origin} ➔ ${r.destination}</strong><br><small>${r.distance} km | ${r.dailyTrips} Sefer/Day</small></div>
                    <div class="profit-val">${Utils.formatCurrency(r.dailyProfit)}/Day</div>
                </div>
                <div class="suggestion-bar">
                    <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/\"/g, '&quot;')})">🤖 AI Analiz</button>
                </div>`;
            resDiv.appendChild(card);
        });
    },
    askGemini: async function(plane, route) {
        const area = document.getElementById('aiResultArea');
        area.innerHTML = '<div class="status-box status-neutral">🤖 Analiz Ediliyor...</div>';
        try {
            const res = await fetch("https://ai.airm4.workers.dev/", {
                method: 'POST',
                body: JSON.stringify({ chatMessage: `${plane} ile ${route.origin}-${route.destination} arası ${route.dailyProfit} kâr için strateji ver.` })
            });
            const d = await res.json();
            area.innerHTML = `<div class="ai-report-card"><h4>🤖 AI RAPORU</h4><p>${d.text}</p></div>`;
        } catch (e) { area.innerHTML = "Hata oluştu."; }
    }
};
window.UI = UI;
