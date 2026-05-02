/**
 * ui.js: MENOA AI Arayüz, Sohbet ve Analiz Yönetimi.
 * Özellikler: Daktilo efekti, Premium UI Kartları, Konfigürasyon Aktarımı.
 * GÜNCELLEME: Chat geçmişi sessionStorage'da tutulur (sekme kapanınca sıfırlanır).
 * Bağlantı: https://ai.airm4.workers.dev/
 */

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

const UI = {
    /**
     * Sayfa değiştirme ve navigasyon yönetimi.
     */
    showPage: function(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(id);
        if (targetPage) targetPage.classList.add('active');
        
        UI.closeAllDropdowns();
        
        // Rota sayfaları açıldığında listeleri tazele
        if (id && id.includes('route')) {
            UI.fillSelects();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Açılır menü (Dropdown) kontrolü.
     */
    toggleDropdown: function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const isOpen = el.classList.contains('open');
        UI.closeAllDropdowns();
        if (!isOpen) el.classList.add('open');
    },

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    /**
     * Oyun modunu (Easy/Realism) ayarlar.
     */
    setGameMode: function(mode) {
        window.gameMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        
        const activeBtnId = mode === 'easy' ? 'btn-easy' : 'id-real';
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) activeBtn.classList.add('active');
        
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = "Aktif Mod: " + (mode === 'easy' ? "Easy (4x hız)" : "Realism (Standart)");
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }
    },

    /**
     * Uçak seçim kutularını verilerle doldurur.
     */
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

    /**
     * Daktilo (Typewriter) Efekti: Metni karakter karakter ekrana basar.
     */
    typeEffect: function(element, text, speed = 10) {
        if (!element) return;
        let i = 0;
        element.innerHTML = "";
        const timer = setInterval(() => {
            if (i < text.length) {
                element.innerHTML += text.charAt(i) === "\n" ? "<br>" : text.charAt(i);
                i++;
                // Chat penceresi için otomatik aşağı kaydırma
                const chatBody = document.getElementById('chat-body');
                if (chatBody && element.closest('#chat-body')) {
                    chatBody.scrollTop = chatBody.scrollHeight;
                }
            } else {
                clearInterval(timer);
            }
        }, speed);
    },

    /**
     * Gemini AI'dan rota analizi talep eder.
     * Rota analizi geçmişe eklenmez (tek seferlik teknik sorgu).
     */
    askGemini: async function(planeName, routeData) {
        const workerUrl = "https://ai.airm4.workers.dev/";
        const resultArea = document.getElementById('aiResultArea');
        if (!resultArea) return;

        resultArea.innerHTML = '<div id="aiLoader">🤖 MENOA Stratejileri Analiz Ediyor...</div>';

        const plane = aircraftData[planeName];
        const planeData = plane ? [{
            name: planeName,
            type: plane.type,
            capacity: plane.capacity,
            cruise_speed: plane.cruise_speed,
            fuel_consumption: plane.fuel_consumption,
            range: plane.range,
            price: plane.price
        }] : [];

        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plane: planeName,
                    route: `${routeData.origin} ➔ ${routeData.destination}`,
                    profit: Utils.formatCurrency(routeData.dailyProfit),
                    distance: routeData.distance,
                    efficiency: Utils.formatPercent(routeData.efficiency),
                    context: {
                        gameMode: window.gameMode || 'realism',
                        fuelPrice: 950,
                        costIndex: 200,
                        planes: planeData
                    }
                })
            });
            const data = await response.json();
            
            resultArea.innerHTML = `
                <div class="ai-report-card">
                    <h4 style="color:var(--primary); margin-bottom:10px;">🤖 MENOA AI ANALİZİ</h4>
                    <div id="typingArea" style="font-size:0.9rem; line-height:1.6;"></div>
                </div>`;
            
            this.typeEffect(document.getElementById('typingArea'), data.text);
            resultArea.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            resultArea.innerHTML = `<div class="status-box status-danger">Hata: ${error.message}</div>`;
        }
    },

    /**
     * Bütçeye göre en iyi uçakları ve tam rotalarını listeler.
     */
    renderSuggestions: function(cat) {
        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const tripsInput = document.getElementById(cat + 'TripsInput');
        const budget = Number(budgetInput?.value);
        const manualTrips = tripsInput?.value ? Number(tripsInput.value) : null;
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        if (!budget || budget <= 0) {
            if (resultDiv) resultDiv.innerHTML = '<div class="status-box status-danger">Lütfen geçerli bir bütçe giriniz.</div>';
            return;
        }

        const bestPlanes = Logic.getBestPlanesByType(budget, cat === 'pax' ? 'passenger' : 'cargo', manualTrips);

        if (bestPlanes.length === 0) {
            resultDiv.innerHTML = '<div class="status-box status-neutral">Bu bütçeye uygun uçak bulunamadı.</div>';
            return;
        }

        const top = bestPlanes[0];
        const efficiencyLabels = {
            1.0: 'Tam verim — 1-3 uçak, talep dolmuyor',
            0.8: '0.8x — 4-10 uçak, talep biraz paylaşılıyor',
            0.6: '0.6x — 11-20 uçak, birden fazla rota gerekebilir',
            0.4: '0.4x — 21-30 uçak, talep tamamen doluyor'
        };

        const summaryCard = `
            <div class="plane-item" style="border-left:3px solid var(--primary); margin-bottom:12px;">
                <div style="color:var(--primary); font-weight:800; margin-bottom:8px;">💡 AI ÖNERİSİ</div>
                <div style="font-size:0.95rem;">${top.fleetSize} adet <strong>${top.name}</strong> al →
                    <strong>${top.bestRouteOrigin} ➔ ${top.bestRouteName}</strong> rotasında uçur.</div>
                <div style="margin-top:6px; color:var(--text-muted); font-size:0.85rem;">
                    Günlük <strong style="color:var(--success);">${Utils.formatCurrency(Math.round(top.totalDailyProfit))}</strong> kazanırsın.
                    Bu uçak hem fiyatına göre verimli hem de bu rota filo büyüklüğünde optimal.
                </div>
            </div>`;

        const planeCards = bestPlanes.map(p => `
            <div class="plane-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.name}</strong>
                    <span style="color:var(--primary); font-weight:800;">${Utils.formatPercent(p.efficiency)} Verim</span>
                </div>
                <div style="font-size:0.8rem; margin-top:5px; color:var(--text-muted);">
                    Fiyat: ${Utils.formatCurrency(p.price)} | Tek uçak günlük kâr: ${Utils.formatCurrency(Math.round(p.dailyProfit))}
                </div>
                <div style="font-size:0.88rem; margin-top:6px; color:var(--success); font-weight:700;">
                    Önerilen: ${p.fleetSize} tane satın al → Toplam günlük kâr: ${Utils.formatCurrency(Math.round(p.totalDailyProfit))}
                </div>
                <div style="font-size:0.78rem; margin-top:4px; color:var(--text-muted);">
                    Filo verimi: ${efficiencyLabels[p.fleetEfficiency]}
                </div>
                <small style="color:var(--success); font-weight:600; display:block; margin-top:5px;">
                    En Karlı Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}
                </small>
            </div>
        `).join('');

        resultDiv.innerHTML = summaryCard + planeCards;
    },

    /**
     * Seçilen uçak için rota seçeneklerini listeler.
     */
    renderRouteAnalysis: function(cat) {
        const selectId = cat === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
        const resultId = cat === 'pax' ? 'paxRouteResult' : 'cargoRouteResult';
        const tripsInputId = cat === 'pax' ? 'paxRouteTripsInput' : 'cargoRouteTripsInput';
        const planeName = document.getElementById(selectId)?.value;
        const resultDiv = document.getElementById(resultId);
        const tripsInput = document.getElementById(tripsInputId);
        const manualTrips = tripsInput?.value ? Number(tripsInput.value) : null;

        if (!planeName) return;

        resultDiv.innerHTML = `<div id="aiResultArea"></div><h3 style="margin: 20px 0 15px 0;">Kârlı Rota Seçenekleri</h3>`;
        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, manualTrips);
        
        topRoutes.forEach((r, i) => {
            const card = document.createElement('div');
            card.className = 'route-card';
            
            const plane = aircraftData[planeName];
            const opt = plane.type === 'passenger' 
                ? Configurator.calculateOptimalSeats(plane, r)
                : Configurator.calculateOptimalCargo(plane, r);

            card.innerHTML = `
                <div class="route-header">
                    <div class="route-info">
                        <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                        <small style="color:var(--secondary);">${r.distance} km | ${r.dailyTrips} Sefer / Gün</small>
                    </div>
                    <div class="route-stats">
                        <div class="profit-val">${Utils.formatCurrency(r.dailyProfit)}/G</div>
                        <div class="efficiency-tag">Yatırım Verimi: ${Utils.formatPercent(r.efficiency)}</div>
                    </div>
                </div>
                <div class="suggestion-bar">
                    <div class="ideal-config">
                        İDEAL: ${cat === 'pax' ? `Y:${opt.y} J:${opt.j} F:${opt.f}` : `L:${opt.l} H:${opt.h}`}
                    </div>
                    <div class="action-buttons">
                        <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/\"/g, '&quot;')})">🤖 AI</button>
                        <button class="apply-btn-small" onclick="Configurator.applySuggestion(${opt.y || opt.l}, ${opt.j || opt.h}, ${opt.f || 'null'})">Yükle</button>
                    </div>
                </div>
            `;
            resultDiv.appendChild(card);
        });
    }
};

/** --- AI SOHBET MODÜLÜ (CHAT) --- */
const Chat = {
    /** sessionStorage anahtarı */
    STORAGE_KEY: "menoa_chat_history",

    /**
     * Sohbet geçmişini sessionStorage'dan yükler.
     * Gemini API formatında [{role, parts:[{text}]}] dizisi döner.
     */
    loadHistory: function() {
        try {
            const raw = sessionStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Güncellenmiş geçmişi sessionStorage'a kaydeder.
     */
    saveHistory: function(history) {
        try {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            // Storage dolu olabilir, sessizce geç
        }
    },

    /**
     * Sayfa yüklendiğinde önceki oturumun mesajlarını ekrana basar.
     * (Aynı sekmede sayfa yenilenirse geçmiş görünür, sekme kapanırsa sıfırlanır.)
     */
    restoreMessages: function() {
        const history = this.loadHistory();
        if (history.length === 0) return;

        history.forEach(turn => {
            const sender = turn.role === "model" ? "ai" : "user";
            const text = turn.parts?.[0]?.text || "";
            this._appendMessage(text, sender, false); // typeEffect olmadan hızlı yükle
        });
    },

    toggle: function() {
        const win = document.getElementById('chat-window');
        if (win) {
            win.classList.toggle('chat-hidden');
            if (!win.classList.contains('chat-hidden')) {
                document.getElementById('chatInput')?.focus();
                // Scroll en alta
                const chatBody = document.getElementById('chat-body');
                if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
            }
        }
    },

    /**
     * Mesajı DOM'a ekler.
     * @param {string} text - Mesaj metni
     * @param {string} sender - 'ai' veya 'user'
     * @param {boolean} animate - AI mesajı için daktilo efekti kullanılsın mı
     */
    _appendMessage: function(text, sender, animate = true) {
        const body = document.getElementById('chat-body');
        if (!body) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}-msg`;
        body.appendChild(msgDiv);

        if (sender === 'ai' && animate) {
            UI.typeEffect(msgDiv, text, 12);
        } else {
            msgDiv.innerText = text;
            body.scrollTop = body.scrollHeight;
        }
    },

    /** Dışarıdan çağrılabilen addMessage (splash mesajı için) */
    addMessage: function(text, sender) {
        this._appendMessage(text, sender, sender === 'ai');
    },

    send: async function() {
        const input = document.getElementById('chatInput');
        const text = input?.value.trim();
        if (!text) return;

        // Mesajda geçen uçakları tespit et (yazım toleranslı)
        const mentionedPlanes = [];
        const textNormalized = text.toLowerCase().replace(/[\s\-_]/g, '');

        // Kandidatları çıkar: boşluktan böl, bireysel tokenlar + bitişik ikili birleşimler (bigram)
        // Bigram sayesinde "B373 100" → "b373100" kandidatı oluşur, boşluklu yazım da yakalanır
        const rawParts = text.toLowerCase().split(/\s+/).map(t => t.replace(/[\-_]/g, ''));
        const candidateSet = new Set();
        for (let i = 0; i < rawParts.length; i++) {
            const t = rawParts[i];
            if (t.length >= 3 && /[a-z]/.test(t) && /[0-9]/.test(t)) candidateSet.add(t);
            if (i + 1 < rawParts.length) {
                const bigram = t + rawParts[i + 1];
                if (bigram.length >= 4 && bigram.length <= 10 && /[a-z]/.test(bigram) && /[0-9]/.test(bigram)) candidateSet.add(bigram);
            }
        }
        const candidates = Array.from(candidateSet);

        // Harf/rakam pozisyon kalıbı eşleşme kontrolü: "a320" vs "an10" yanlış eşleşmesini önler
        function sameLetterDigitPattern(a, b) {
            const len = Math.min(a.length, b.length);
            for (let i = 0; i < len; i++) {
                if ((/[a-z]/.test(a[i])) !== (/[a-z]/.test(b[i]))) return false;
            }
            return true;
        }

        if (typeof aircraftData !== 'undefined') {
            // 1. Aşama: tam eşleşmeler (saf rakam isimler atlanır)
            const exactMatchedCandidates = new Set();
            for (let name in aircraftData) {
                const nameNorm = name.toLowerCase().replace(/[\s\-_]/g, '');
                if (!/[a-z]/.test(nameNorm)) continue;
                if (!textNormalized.includes(nameNorm)) continue;
                const p = aircraftData[name];
                mentionedPlanes.push({ name, type: p.type, capacity: p.capacity, cruise_speed: p.cruise_speed, fuel_consumption: p.fuel_consumption, range: p.range, price: p.price });
                for (const c of candidates) { if (c === nameNorm) exactMatchedCandidates.add(c); }
            }

            // 2. Aşama: Levenshtein fuzzy — exact match üretmeyen kandidatlar için en iyi eşleşme
            const fuzzyCandidates = candidates.filter(c => !exactMatchedCandidates.has(c));
            for (const cand of fuzzyCandidates) {
                let bestName = null, bestDist = Infinity;
                for (let name in aircraftData) {
                    const nameNorm = name.toLowerCase().replace(/[\s\-_]/g, '');
                    if (nameNorm.length < 4 || nameNorm.length > 10) continue;
                    if (mentionedPlanes.find(mp => mp.name === name)) continue;
                    if (cand[0] !== nameNorm[0]) continue;
                    if (Math.abs(cand.length - nameNorm.length) > 2) continue;
                    if (!sameLetterDigitPattern(cand, nameNorm)) continue;
                    const dist = levenshtein(cand, nameNorm);
                    if (dist <= 2 && dist > 0 && dist < bestDist) { bestDist = dist; bestName = name; }
                }
                if (bestName) {
                    const p = aircraftData[bestName];
                    mentionedPlanes.push({ name: bestName + ' (yazım düzeltildi)', type: p.type, capacity: p.capacity, cruise_speed: p.cruise_speed, fuel_consumption: p.fuel_consumption, range: p.range, price: p.price, typoCorrection: true, originalQuery: cand });
                }
            }
        }

        // Kullanıcı mesajını ekrana bas
        this._appendMessage(text, 'user', false);
        input.value = '';

        // Mevcut geçmişi al
        const history = this.loadHistory();

        try {
            const response = await fetch("https://ai.airm4.workers.dev/", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatMessage: text,
                    history: history,
                    context: {
                        gameMode: window.gameMode || 'realism',
                        fuelPrice: 950,
                        costIndex: 200,
                        planes: mentionedPlanes
                    }
                })
            });
            const data = await response.json();
            const aiText = data.text || "Yanıt alınamadı.";

            // AI mesajını ekrana bas
            this._appendMessage(aiText, 'ai', true);

            // Güncellenmiş geçmişi kaydet
            // Worker updatedHistory döndürüyorsa onu kullan, yoksa manuel ekle
            if (data.updatedHistory && Array.isArray(data.updatedHistory)) {
                this.saveHistory(data.updatedHistory);
            } else {
                const updated = [
                    ...history,
                    { role: "user",  parts: [{ text: text }] },
                    { role: "model", parts: [{ text: aiText }] }
                ];
                this.saveHistory(updated);
            }

        } catch (e) {
            this._appendMessage("⚠️ Hata: Motor yanıt vermiyor.", 'ai', false);
        }
    }
};

// MODÜLLERİ GLOBALE BAĞLA (ReferenceError Fix)
window.UI = UI;
window.Chat = Chat;

window.gameMode = window.gameMode || 'realism';

// Global tıklama dinleyicisi: Menü dışına tıklandığında dropdownları kapatır.
document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});
