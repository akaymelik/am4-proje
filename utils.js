
const Utils = {
   
    formatCurrency: function(value) {
        return "$" + Math.floor(value).toLocaleString();
    },

   
    formatPercent: function(value) {
        return "%" + parseFloat(value).toFixed(4);
    },


    formatDuration: function(decimalHours) {
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        return `${hours}sa ${minutes}dk`;
    }
};
