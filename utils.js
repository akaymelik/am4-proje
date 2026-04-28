/**
 * utils.js: Uygulama genelinde kullanılan yardımcı formatlama fonksiyonları.
 * Güncelleme: Yüzdelik format 4 basamaktan 2 basamağa düşürüldü.
 */

const Utils = {
    /**
     * Sayısal bir değeri para birimi formatına çevirir.
     * @param {number} value - Formatlanacak sayı
     */
    formatCurrency: function(value) {
        if (isNaN(value)) return "$0";
        return "$" + Math.floor(value).toLocaleString('en-US');
    },

    /**
     * Sayısal bir değeri iki basamaklı yüzde formatına çevirir.
     * Örn: 10.2345 -> "%10.23"
     */
    formatPercent: function(value) {
        if (isNaN(value)) return "%0.00";
        // Kullanıcı isteği üzerine hassasiyet 2 basamağa (toFixed(2)) düşürüldü
        return "%" + parseFloat(value).toFixed(2);
    },

    /**
     * Ondalık saat değerini "Xsa Ydk" formatına çevirir.
     */
    formatDuration: function(decimalHours) {
        if (isNaN(decimalHours) || decimalHours <= 0) return "0sa 0dk";
        
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        
        if (minutes === 60) {
            return `${hours + 1}sa 0dk`;
        }
        
        return `${hours}sa ${minutes}dk`;
    }
};
