/**
 * utils.js: Uygulama genelinde kullanılan yardımcı formatlama fonksiyonları.
 * Bu modül, verilerin arayüzde (UI) standart ve okunabilir görünmesini sağlar.
 */

const Utils = {
    /**
     * Sayısal bir değeri para birimi formatına çevirir.
     * Örn: 1500000 -> "$1,500,000"
     * @param {number} value - Formatlanacak sayı
     * @returns {string} Formatlanmış para metni
     */
    formatCurrency: function(value) {
        if (isNaN(value)) return "$0";
        return "$" + Math.floor(value).toLocaleString('en-US');
    },

    /**
     * Sayısal bir değeri dört basamaklı yüzde formatına çevirir.
     * Örn: 0.04567 -> "%0.0457"
     * @param {number} value - Yüzdelik değer
     * @returns {string} Formatlanmış yüzde metni
     */
    formatPercent: function(value) {
        if (isNaN(value)) return "%0.0000";
        return "%" + parseFloat(value).toFixed(4);
    },

    /**
     * Ondalık saat değerini "Xsa Ydk" formatına çevirir.
     * AM4 uçuş planlaması için kritik bir yardımcı fonksiyondur.
     * Örn: 2.58 -> "2sa 35dk"
     * @param {number} decimalHours - Ondalık saat (Örn: 2.5)
     * @returns {string} Okunabilir süre metni
     */
    formatDuration: function(decimalHours) {
        if (isNaN(decimalHours) || decimalHours <= 0) return "0sa 0dk";
        
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        
        // Eğer dakika 60 olursa saate yuvarla
        if (minutes === 60) {
            return `${hours + 1}sa 0dk`;
        }
        
        return `${hours}sa ${minutes}dk`;
    }
};
