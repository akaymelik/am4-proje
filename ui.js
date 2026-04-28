function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function renderPlaneSuggestions() {
    const budget = document.getElementById('budgetInput').value;
    const results = findBestPlanes(budget);
    const container = document.getElementById('ucakSonuc');
    
    container.innerHTML = results.map(p => `
        <div class="result-item">
            <strong>${p.name}</strong><br>
            Fiyat: $${p.price.toLocaleString()} | 
            Tahmini Amorti: ${p.roi} Gün
        </div>
    `).join('');
}
