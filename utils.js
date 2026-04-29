/**
 * utils.js: Uygulama genelinde kullanılan yardımcı formatlama fonksiyonları.
 * GÜNCELLEME: 
 * - Yüzdelik format 2 basamağa (toFixed(2)) sabitlendi.
 * - Süre formatı AM4 oyun içi arayüzüne ("Xsa Ydk") uygun hale getirildi.
 * - Negatif kar durumlarında görsel güvenlik eklendi.
 */

const Utils = {
    /**
     * Sayısal bir değeri para birimi formatına çevirir ($1,234,567).
     * @param {number} value - Formatlanacak sayı
     */
    formatCurrency: function(value) {
        if (isNaN(value)) return "$0";
        // Zarar durumunda (negatif) uçağı uçurmamak için 0 olarak gösterilir veya kırmızı vurgulanır.
        // Burada ham veriyi koruyup sadece görsel formatlama yapıyoruz.
        const val = value < 0 ? 0 : value;
        return "$" + Math.floor(val).toLocaleString('en-US');
    },

    /**
     * Sayısal bir değeri iki basamaklı yüzde formatına çevirir (%10.23).
     * @param {number} value - Yüzde değeri
     */
    formatPercent: function(value) {
        if (isNaN(value)) return "%0.00";
        // Verimlilik (Efficiency) oranlarını net göstermek için 2 basamak sabittir.
        return "%" + parseFloat(value).toFixed(2);
    },

    /**
     * Ondalık saat değerini (örn: 2.5) "Xsa Ydk" (örn: 2sa 30dk) formatına çevirir.
     * @param {number} decimalHours - Ondalık cinsinden saat
     */
    formatDuration: function(decimalHours) {
        if (isNaN(decimalHours) || decimalHours <= 0) return "0sa 0dk";
        
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        
        // Eğer yuvarlama sonucu 60 dakika çıkarsa, saati bir artırıp dakikayı sıfırla.
        if (minutes === 60) {
            return `${hours + 1}sa 0dk`;
        }
        
        return `${hours}sa ${minutes}dk`;
    }
};

// Global erişim için (Modüler yapı korunurken diğer scriptlerin hata almaması için)
window.Utils = Utils;
