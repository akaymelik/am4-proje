const UI = {
    showPage: (id) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(id)?.classList.add('active');
        if (id.includes('route')) UI.fillSelects();
    },
    toggleDropdown: (id) => {
        document.getElementById(id).classList.toggle('open');
    },
    fillSelects: () => {
        const ps = document.getElementById('paxRouteSelect'), cs = document.getElementById('cargoRouteSelect');
        if (ps) {
            ps.innerHTML = '<option value="">-- Seç --</option>';
            for (let n in aircraftData) if (aircraftData[n].type === 'passenger') ps.add(new Option(n, n));
        }
        if (cs) {
            cs.innerHTML = '<option value="">-- Seç --</option>';
            for (let n in aircraftData) if (aircraftData[n].type === 'cargo') cs.add(new Option(n, n));
        }
    },
    setGameMode: (m) => {
        window.gameMode = m;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(m === 'easy' ? 'btn-easy' : 'id-real').classList.add('active');
    },
    renderRouteAnalysis: (cat) => {
        const name = document.getElementById(cat === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect').value;
        const res = document.getElementById(cat + 'RouteResult');
        const trips = parseInt(document.getElementById(cat + 'TripsInput').value) || null;
        if (!name) return;
        res.innerHTML = '<div id="aiResultArea"></div>';
        Logic.analyzeTopRoutesForPlane(name, 10, null, trips).forEach(r => {
            res.innerHTML += `
                <div class="route-card">
                    <strong>${r.origin} ➔ ${r.destination}</strong> (${r.dailyTrips} Sefer)
                    <div class="profit-val">${Utils.formatCurrency(r.dailyProfit)}/GÜN</div>
                    <button onclick="UI.askGemini('${name}', '${r.origin}-${r.destination}', ${r.dailyProfit})">🤖 Analiz</button>
                </div>`;
        });
    },
    askGemini: async (p, r, pr) => {
        const area = document.getElementById('aiResultArea');
        area.innerHTML = "Analiz ediliyor...";
        const res = await fetch("https://ai.airm4.workers.dev/", {
            method: 'POST',
            body: JSON.stringify({ chatMessage: `${p} uçağı ile ${r} rotasında ${pr} kâr için strateji ver.` })
        });
        const d = await res.json();
        area.innerHTML = `<div class="ai-report-card">${d.text}</div>`;
    }
};

const Chat = {
    history: [],
    toggle: () => document.getElementById('chat-window').classList.toggle('chat-hidden'),
    send: async () => {
        const i = document.getElementById('chatInput'), b = document.getElementById('chat-body');
        const t = i.value; if(!t) return;
        b.innerHTML += `<div class="user-msg">${t}</div>`; i.value = "";
        const res = await fetch("https://ai.airm4.workers.dev/", {
            method: 'POST',
            body: JSON.stringify({ chatMessage: t, history: Chat.history })
        });
        const d = await res.json();
        b.innerHTML += `<div class="ai-msg">${d.text}</div>`;
        Chat.history.push({role:"user", parts:[{text:t}]}, {role:"model", parts:[{text:d.text}]});
        if(Chat.history.length > 10) Chat.history = Chat.history.slice(-10);
    }
};
window.UI = UI; window.Chat = Chat;
