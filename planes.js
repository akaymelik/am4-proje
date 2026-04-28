const aircraftData = {
    "ATR-42": {
        capacity: 50,
        fuel_consumption: 0.25,
        range: 1500,
        cruise_speed: 400,
        price: 1200000,
        check_cost: 500,
        description: "Küçük bölgesel uçak"
    },
    "Boeing 737-800": {
        capacity: 184,
        fuel_consumption: 0.85,
        range: 5765,
        cruise_speed: 839,
        price: 4400000,
        check_cost: 1200,
        description: "Orta mesafe dar gövdeli jet"
    },
    "Airbus A380-800": {
        capacity: 600,
        fuel_consumption: 12.0,
        range: 15000,
        cruise_speed: 903,
        price: 215000000,
        check_cost: 2500,
        description: "Dünyanın en büyük yolcu uçağı"
    },
    "MC-21-400": {
        capacity: 230,
        fuel_consumption: 10.5,
        range: 5500,
        cruise_speed: 870,
        price: 33750000,
        check_cost: 800,
        description: "Yeni nesil yüksek verimli Rus jeti"
    },
    "Airbus A320neo": {
        capacity: 195,
        fuel_consumption: 0.75,
        range: 6500,
        cruise_speed: 833,
        price: 8500000,
        check_cost: 1100,
        description: "Yüksek verimlilik, düşük yakıt tüketimi"
    },
    "Bombardier CRJ-900": {
        capacity: 85,
        fuel_consumption: 0.35,
        range: 3200,
        cruise_speed: 860,
        price: 2400000,
        check_cost: 650,
        description: "Hızlı bölgesel jet"
    },
    "Boeing 747-8": {
        capacity: 467,
        fuel_consumption: 11.2,
        range: 14310,
        cruise_speed: 917,
        price: 180000000,
        check_cost: 2200,
        description: "Gökyüzünün Kraliçesi"
    }
};

// Bu kısım Excel'deki "En Karlı Rotalar" sekmesinden gelen hazır verilerdir
const popularRoutes = [
    { origin: "Istanbul (IST)", destination: "London (LHR)", distance: 2500, demand: 850 },
    { origin: "New York (JFK)", destination: "London (LHR)", distance: 5570, demand: 2100 },
    { origin: "London (LHR)", destination: "Dubai (DXB)", distance: 5470, demand: 1800 },
    { origin: "London (LHR)", destination: "Singapore (SIN)", distance: 10880, demand: 1400 },
    { origin: "Paris (CDG)", destination: "London (LHR)", distance: 350, demand: 950 },
    { origin: "Tokyo (NRT)", destination: "London (LHR)", distance: 9550, demand: 1100 }
];

