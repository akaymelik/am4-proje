/**
 * planes.js: Airline Manager 4 Uçak Veritabanı
 * Bu dosya Yolcu (PAX) ve Kargo uçaklarının teknik özelliklerini içerir.
 */

const aircraftData = {
    // --- BÖLGESEL VE KISA MESAFE YOLCU UÇAKLARI ---
    "ATR-42": { type: "passenger", capacity: 50, fuel_consumption: 0.25, range: 1500, cruise_speed: 400, price: 1200000 },
    "ATR-72": { type: "passenger", capacity: 70, fuel_consumption: 0.35, range: 1500, cruise_speed: 510, price: 2100000 },
    "Dash 8-Q400": { type: "passenger", capacity: 78, fuel_consumption: 0.45, range: 2500, cruise_speed: 667, price: 3500000 },
    "Bombardier CRJ-900": { type: "passenger", capacity: 85, fuel_consumption: 0.35, range: 3200, cruise_speed: 860, price: 2400000 },
    "Embraer 190": { type: "passenger", capacity: 114, fuel_consumption: 0.55, range: 4500, cruise_speed: 830, price: 3800000 },

    // --- ORTA MESAFE YOLCU UÇAKLARI (Dar Gövde) ---
    "Boeing 737-700": { type: "passenger", capacity: 149, fuel_consumption: 0.75, range: 6200, cruise_speed: 839, price: 4100000 },
    "Boeing 737-800": { type: "passenger", capacity: 184, fuel_consumption: 0.85, range: 5765, cruise_speed: 839, price: 4400000 },
    "Boeing 737 MAX 8": { type: "passenger", capacity: 200, fuel_consumption: 0.72, range: 6570, cruise_speed: 839, price: 9200000 },
    "Airbus A320neo": { type: "passenger", capacity: 195, fuel_consumption: 0.75, range: 6500, cruise_speed: 833, price: 8500000 },
    "Airbus A321neo": { type: "passenger", capacity: 240, fuel_consumption: 0.82, range: 7400, cruise_speed: 833, price: 12500000 },
    "Airbus A321XLR": { type: "passenger", capacity: 240, fuel_consumption: 0.78, range: 8700, cruise_speed: 833, price: 15000000 },
    "MC-21-400": { type: "passenger", capacity: 230, fuel_consumption: 1.05, range: 5500, cruise_speed: 870, price: 33750000 },

    // --- UZUN MESAFE YOLCU UÇAKLARI (Geniş Gövde) ---
    "Boeing 787-8": { type: "passenger", capacity: 359, fuel_consumption: 1.65, range: 13620, cruise_speed: 903, price: 95000000 },
    "Boeing 787-9": { type: "passenger", capacity: 406, fuel_consumption: 1.75, range: 14140, cruise_speed: 903, price: 125000000 },
    "Airbus A330-900neo": { type: "passenger", capacity: 440, fuel_consumption: 1.95, range: 13334, cruise_speed: 880, price: 110000000 },
    "Airbus A350-900": { type: "passenger", capacity: 440, fuel_consumption: 1.90, range: 15000, cruise_speed: 903, price: 155000000 },
    "Airbus A350-1000": { type: "passenger", capacity: 480, fuel_consumption: 2.10, range: 16100, cruise_speed: 903, price: 185000000 },
    "Boeing 777-300ER": { type: "passenger", capacity: 550, fuel_consumption: 3.50, range: 13650, cruise_speed: 892, price: 165000000 },
    "Boeing 747-8": { type: "passenger", capacity: 467, fuel_consumption: 11.2, range: 14310, cruise_speed: 917, price: 180000000 },
    "Airbus A380-800": { type: "passenger", capacity: 600, fuel_consumption: 12.0, range: 15000, cruise_speed: 903, price: 215000000 },

    // --- KARGO UÇAKLARI ---
    // Kapasiteler Libre (Lbs) cinsindendir.
    "Cessna 208B (C)": { type: "cargo", capacity: 8300, fuel_consumption: 0.15, range: 2000, cruise_speed: 340, price: 1500000 },
    "Boeing 737-700C": { type: "cargo", capacity: 41000, fuel_consumption: 0.75, range: 6000, cruise_speed: 839, price: 6500000 },
    "Boeing 757-200F": { type: "cargo", capacity: 88000, fuel_consumption: 1.10, range: 5800, cruise_speed: 850, price: 15000000 },
    "Airbus A300-600F": { type: "cargo", capacity: 106000, fuel_consumption: 1.80, range: 7500, cruise_speed: 830, price: 28000000 },
    "McDonnell Douglas MD-11F": { type: "cargo", capacity: 205000, fuel_consumption: 3.80, range: 7330, cruise_speed: 876, price: 42000000 },
    "Boeing 777F": { type: "cargo", capacity: 226000, fuel_consumption: 2.80, range: 9200, cruise_speed: 892, price: 145000000 },
    "Boeing 747-8F": { type: "cargo", capacity: 303000, fuel_consumption: 10.5, range: 8130, cruise_speed: 908, price: 185000000 },
    "Antonov An-225": { type: "cargo", capacity: 550000, fuel_consumption: 25.0, range: 15400, cruise_speed: 800, price: 450000000 }
};
