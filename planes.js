/**
 * planes.js: AM4 Genişletilmiş Küresel Uçak ve Rota Veritabanı
 */
const aircraftData = {
    // --- YOLCU UÇAKLARI (PAX) ---
    "ATR-42": { type: "passenger", capacity: 50, fuel_consumption: 0.25, range: 1500, cruise_speed: 400, price: 1200000 },
    "ATR-72": { type: "passenger", capacity: 70, fuel_consumption: 0.35, range: 1500, cruise_speed: 510, price: 2100000 },
    "Bombardier CRJ-900": { type: "passenger", capacity: 85, fuel_consumption: 0.35, range: 3200, cruise_speed: 860, price: 2400000 },
    "Boeing 737-800": { type: "passenger", capacity: 184, fuel_consumption: 0.85, range: 5765, cruise_speed: 839, price: 4400000 },
    "Airbus A320neo": { type: "passenger", capacity: 195, fuel_consumption: 0.75, range: 6500, cruise_speed: 833, price: 8500000 },
    "Airbus A321neo": { type: "passenger", capacity: 240, fuel_consumption: 0.82, range: 7400, cruise_speed: 833, price: 12500000 },
    "MC-21-400": { type: "passenger", capacity: 230, fuel_consumption: 1.05, range: 5500, cruise_speed: 870, price: 33750000 },
    "Boeing 787-9": { type: "passenger", capacity: 406, fuel_consumption: 1.75, range: 14140, cruise_speed: 903, price: 125000000 },
    "Airbus A350-1000": { type: "passenger", capacity: 480, fuel_consumption: 2.10, range: 16100, cruise_speed: 903, price: 185000000 },
    "Boeing 747-8": { type: "passenger", capacity: 467, fuel_consumption: 11.2, range: 14310, cruise_speed: 917, price: 180000000 },
    "Airbus A380-800": { type: "passenger", capacity: 600, fuel_consumption: 12.0, range: 15000, cruise_speed: 903, price: 215000000 },

    // --- KARGO UÇAKLARI (Cargo) ---
    "Cessna 208B (C)": { type: "cargo", capacity: 8300, fuel_consumption: 0.15, range: 2000, cruise_speed: 340, price: 1500000 },
    "Boeing 737-700C": { type: "cargo", capacity: 41000, fuel_consumption: 0.75, range: 6000, cruise_speed: 839, price: 6500000 },
    "Boeing 757-200F": { type: "cargo", capacity: 88000, fuel_consumption: 1.10, range: 5800, cruise_speed: 850, price: 15000000 },
    "Airbus A300-600F": { type: "cargo", capacity: 106000, fuel_consumption: 1.80, range: 7500, cruise_speed: 830, price: 28000000 },
    "McDonnell Douglas MD-11F": { type: "cargo", capacity: 205000, fuel_consumption: 3.80, range: 7330, cruise_speed: 876, price: 42000000 },
    "Boeing 777F": { type: "cargo", capacity: 226000, fuel_consumption: 2.80, range: 9200, cruise_speed: 892, price: 145000000 },
    "Boeing 747-8F": { type: "cargo", capacity: 303000, fuel_consumption: 10.5, range: 8130, cruise_speed: 908, price: 185000000 },
    "Antonov An-225": { type: "cargo", capacity: 550000, fuel_consumption: 25.0, range: 15400, cruise_speed: 800, price: 450000000 }
};

const popularRoutes = [
    // --- AVRUPA VE TÜRKİYE ---
    { origin: "Istanbul (IST)", destination: "London (LHR)", distance: 2500, demand: 850 },
    { origin: "Istanbul (IST)", destination: "New York (JFK)", distance: 8000, demand: 1200 },
    { origin: "London (LHR)", destination: "Dubai (DXB)", distance: 5470, demand: 1800 },
    { origin: "Paris (CDG)", destination: "Singapore (SIN)", distance: 10700, demand: 950 },
    { origin: "Frankfurt (FRA)", destination: "Tokyo (NRT)", distance: 9300, demand: 880 },
    { origin: "Moscow (SVO)", destination: "Beijing (PEK)", distance: 5800, demand: 1100 },
    { origin: "Oslo (OSL)", destination: "Bangkok (BKK)", distance: 8600, demand: 700 },

    // --- KUZEY VE GÜNEY AMERİKA ---
    { origin: "New York (JFK)", destination: "Los Angeles (LAX)", distance: 3950, demand: 2500 },
    { origin: "Miami (MIA)", destination: "Buenos Aires (EZE)", distance: 7100, demand: 900 },
    { origin: "Sao Paulo (GRU)", destination: "Madrid (MAD)", distance: 8300, demand: 1100 },
    { origin: "Mexico City (MEX)", destination: "Chicago (ORD)", distance: 2700, demand: 1400 },
    { origin: "Bogota (BOG)", destination: "Miami (MIA)", distance: 2450, demand: 1600 },
    { origin: "Santiago (SCL)", destination: "Sydney (SYD)", distance: 11300, demand: 650 },

    // --- ASYA VE OKYANUSYA ---
    { origin: "Singapore (SIN)", destination: "Sydney (SYD)", distance: 6300, demand: 1200 },
    { origin: "Tokyo (NRT)", destination: "Honolulu (HNL)", distance: 6100, demand: 1400 },
    { origin: "Seoul (ICN)", destination: "San Francisco (SFO)", distance: 9000, demand: 950 },
    { origin: "Hong Kong (HKG)", destination: "Melbourne (MEL)", distance: 7400, demand: 1100 },
    { origin: "Mumbai (BOM)", destination: "Dubai (DXB)", distance: 1900, demand: 2400 },
    { origin: "Jakarta (CGK)", destination: "Amsterdam (AMS)", distance: 11300, demand: 750 },
    { origin: "Auckland (AKL)", destination: "Los Angeles (LAX)", distance: 10500, demand: 800 },

    // --- AFRİKA VE ORTA DOĞU ---
    { origin: "Cairo (CAI)", destination: "Jeddah (JED)", distance: 1200, demand: 2800 },
    { origin: "Johannesburg (JNB)", destination: "London (LHR)", distance: 9000, demand: 1300 },
    { origin: "Addis Ababa (ADD)", destination: "Guangzhou (CAN)", distance: 8000, demand: 1100 },
    { origin: "Nairobi (NBO)", destination: "Dubai (DXB)", distance: 3500, demand: 900 },
    { origin: "Casablanca (CMN)", destination: "Montreal (YUL)", distance: 5600, demand: 850 },
    { origin: "Doha (DOH)", destination: "Perth (PER)", distance: 9300, demand: 700 }
];
