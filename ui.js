/**
 * Sayfa geçişlerini yönetir
 * @param {string} pageId - Görüntülenecek sayfanın ID'si
 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Rota sayfasına geçildiğinde uçak listesini kontrol et ve doldur
    if (pageId === 'karlı-rota') {
        fillRoutePlaneSelect();
    }
}

/**
 * Rota sayfasındaki seçim kutusunu (select) uçak verileriyle doldurur
 */
function fillRoutePlaneSelect() {
    const select = document.getElementById('rotaUcaks');
    if (!select) return;

    // Eğer liste boşsa (sadece varsayılan seçenek varsa) uçakları ekle
    if (select.options.length <= 1) {
        for (let name in aircraftData) {
            let opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            select.appendChild(opt);
        }
    }
}

/**
 * Bütçeye göre en iyi uçakları ve o uçak için en karlı rotayı listeler
 */
function renderPlaneSuggestions() {
    const budgetInput = document.getElementById('budgetInput');
    const container = document.getElementById('ucakSonuc');
    
    if (!budgetInput || !budgetInput.value) return alert("Lütfen bütçenizi girin!");
    
    const budget = parseFloat(budgetInput.value);
    const results = findBestPlanes(budget);
    
    if (results.length === 0) {
        container.innerHTML = "<p style='color: #64748b; margin-top: 15px;'>Bu bütçeye uygun uçak veya bu uçaklar için menzili yeten bir rota bulunamadı.</p>";
        return;
    }

    // Uçak listesini oluştururken "Kalkış ➔ Varış" bilgisini ekliyoruz
    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem; color: #1e293b;">${p.name}</strong><br>
                <small style="color: #059669; font-weight: 600;">
                    En Karlı Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteDest}
                </small>
            </div>
            <div style="text-align: right;">
                <span style="color: #2563eb; font-weight: bold; font-size: 1.1rem;">${p.roi} Gün</span><br>
                <small style="color: #64748b;">Maliyet: $${p.price.toLocaleString()}</small>
            </div>
        </div>
    `).join('');
}

/**
 * Seçilen belirli bir uçak için en karlı rota detaylarını detaylıca gösterir
 */
function renderBestRoute() {
    const planeName = document.getElementById('rotaUcaks').value;
    const container = document.getElementById('rotaSonuc');
    
    if (!planeName) return alert("Lütfen bir uçak seçin!");
    
    // logic.js üzerinden uçağın en iyi rota verisini çek
    const best = analyzeBestRouteForPlane(planeName);
    
    if (best) {
        container.innerHTML = `
            <div class="result-item" style="display: block; border-left-color: #059669; margin-top: 20px;">
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0; color: #1e293b;">Analiz Sonucu: ${best.origin} ➔ ${best.destination}</h4>
                    <small style="color: #64748b;">Veritabanındaki en karlı rota eşleşmesi:</small>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.95rem;">
                    <span><strong>Mesafe:</strong> ${best.distance} km</span>
                    <span><strong>Uçuş Süresi:</strong> ${best.flightTime} Saat</span>
                    <span><strong>Günlük Sefer:</strong> ${best.dailyTrips} Uçuş</span>
                    <span><strong>Günlük Kâr:</strong> <span style="color: #059669; font-weight: bold;">$${parseInt(best.dailyProfit).toLocaleString()}</span></span>
                </div>

                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <small style="display: block; color: #64748b;">Yıllık Tahmini Kâr</small>
                        <strong style="color: #059669; font-size: 1.1rem;">$${(parseInt(best.dailyProfit) * 365).toLocaleString()}</strong>
                    </div>
                    <div style="text-align: right;">
                        <small style="display: block; color: #64748b;">Amorti Süresi (ROI)</small>
                        <strong style="color: #2563eb; font-size: 1.2rem;">${best.roiDays} Gün</strong>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = "<p style='color: #ef4444; margin-top: 15px;'>Bu uçak için uygun rota bulunamadı. Menzili popüler rotalarımızdan daha kısa olabilir.</p>";
    }
}
