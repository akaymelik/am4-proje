/**
 * utils.js: Uygulama genelinde kullanılan yardımcı fonksiyonlar.
 */
const Utils = {
    /**
     * Para birimini yerel formatta gösterir.
     */
    formatCurrency: function(value) {
        return "$" + Math.floor(value).toLocaleString();
    },

    /**
     * Yüzdelik değerleri formatlar.
     */
    formatPercent: function(value) {
        return "%" + parseFloat(value).toFixed(4);
    }
};
