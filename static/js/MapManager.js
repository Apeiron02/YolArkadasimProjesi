class MapManager {
    constructor(mapElementId, options = {}) {
        this.map = null;
        this.markers = [];
        this.currentInfoWindow = null;
        this.directionsRenderer = null;
        this.trafficLayer = null;
        this.mapElementId = mapElementId;
        this.options = {
            center: { lat: 38.6748, lng: 39.2225 },
            zoom: 14,
            ...options
        };
        
        // Utility sınıflarını başlat
        this.trafficCalculator = new TrafficCalculator();
        this.weatherCalculator = new WeatherCalculator();
        this.uiHelper = new UIHelper();
        
        this.init();
    }

    init() {
        this.map = new google.maps.Map(
            document.getElementById(this.mapElementId), 
            this.options
        );
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.map.addListener('click', (event) => this.handleMapClick(event));
    }

    handleMapClick(event) {
        const clickedLocation = event.latLng;
        this.updateClickedLocationMarker(clickedLocation);
        this.searchNearbyChargingStations(clickedLocation);
    }

    // ... diğer metodlar
}

// Trafik hesaplamaları için utility sınıfı
class TrafficCalculator {
    calculateTrafficImpact(leg) {
        let trafficImpact = 1.0;
        
        if (leg.duration_in_traffic && leg.duration) {
            const trafficRatio = leg.duration_in_traffic.value / leg.duration.value;
            
            if (trafficRatio > 1.8) trafficImpact = 0.7;
            else if (trafficRatio > 1.5) trafficImpact = 0.8;
            else if (trafficRatio > 1.2) trafficImpact = 0.9;
            else if (trafficRatio > 1.0) trafficImpact = 0.95;
        }
        
        return {
            impact: trafficImpact,
            description: this.getTrafficDescription(trafficImpact)
        };
    }

    getTrafficDescription(impact) {
        if (impact <= 0.7) return "Çok Yoğun";
        if (impact <= 0.8) return "Yoğun";
        if (impact <= 0.9) return "Orta Yoğunlukta";
        if (impact < 1.0) return "Hafif";
        return "Normal";
    }

    getTrafficColor(congestion) {
        switch (congestion) {
            case 'low':
                return '#00ff00';  // Yeşil
            case 'medium':
                return '#ffff00';  // Sarı
            case 'high':
                return '#ff0000';  // Kırmızı
            default:
                return '#808080';  // Gri (varsayılan)
        }
    }

    async getTrafficInfo(step) {
        // Simüle edilmiş trafik verisi - gerçek uygulamada API'den alınacak
        const random = Math.random();
        let congestion;
        
        if (random < 0.3) congestion = 'low';
        else if (random < 0.7) congestion = 'medium';
        else congestion = 'high';
        
        return { congestion };
    }
}

// Hava durumu hesaplamaları için utility sınıfı
class WeatherCalculator {
    async calculateWeatherImpact(weatherData) {
        let weatherImpact = 1.0;
        let description = "Normal";
        
        if (weatherData && weatherData.weather && weatherData.weather[0]) {
            const temp = weatherData.main?.temp - 273.15;
            const weatherCondition = weatherData.weather[0].main.toLowerCase();
            
            // Sıcaklık etkisi
            if (temp < 0) {
                weatherImpact *= 0.8;
                description = "Soğuk";
            } else if (temp > 35) {
                weatherImpact *= 0.9;
                description = "Sıcak";
            }
            
            // Hava koşulları etkisi
            if (weatherCondition.includes('rain')) {
                weatherImpact *= 0.85;
                description = "Yağmurlu";
            } else if (weatherCondition.includes('snow')) {
                weatherImpact *= 0.6;
                description = "Karlı";
            } else if (weatherCondition.includes('wind')) {
                weatherImpact *= 0.80;
                description = "Rüzgarlı";
            } else if (weatherCondition.includes('fog')) {
                weatherImpact *= 0.8;
                description = "Sisli";
            } else if (weatherCondition.includes('storm')) {
                weatherImpact *= 0.4;
                description = "Fırtınalı";
            }
        }
        
        return {
            impact: weatherImpact,
            description: description
        };
    }

    async calculateWeatherImpactForRoute(route) {
        try {
            const leg = route.routes[0].legs[0];
            const steps = leg.steps;
            const totalDistance = leg.distance.value / 1000; // metre -> km
            
            // Başlangıç, bitiş ve ara noktalar için hava durumu bilgilerini al
            const weatherPoints = [
                { location: leg.start_location, distance: 0 },
                ...steps.map(step => ({
                    location: step.end_location,
                    distance: step.distance.value / 1000
                }))
            ];

            let totalWeatherImpact = 0;
            let affectedLocations = [];
            let cumulativeDistance = 0;

            // Her nokta için hava durumu etkisini hesapla
            for (let i = 0; i < weatherPoints.length; i++) {
                const point = weatherPoints[i];
                const weatherData = await this.getWeatherData(point.location);
                const weatherResult = await this.calculateWeatherImpact(weatherData);
                
                // Bu noktadaki sıcaklık ve hava durumu bilgisi
                const temp = weatherData?.main?.temp - 273.15;
                const condition = weatherData?.weather?.[0]?.main || 'Normal';
                
                // Bu segmentin mesafesi
                const segmentDistance = i < weatherPoints.length - 1 
                    ? weatherPoints[i + 1].distance - point.distance 
                    : totalDistance - point.distance;
                
                // Bu segmentin toplam mesafeye oranı
                const segmentRatio = segmentDistance / totalDistance;
                
                // Bu segmentin ağırlıklı etkisi
                totalWeatherImpact += weatherResult.impact * segmentRatio;
                
                // Eğer önemli bir hava durumu etkisi varsa kaydet
                if (weatherResult.impact < 0.9) {
                    const location = await this.getLocationName(point.location);
                    affectedLocations.push(
                        `${location || 'Belirtilmemiş Konum'}: ${weatherResult.description}, ` +
                        `${temp.toFixed(1)}°C (Etki: -%${Math.round((1-weatherResult.impact)*100)})`
                    );
                }

                cumulativeDistance = point.distance;
                
                console.log(`🌤️ Hava Durumu Analizi - ${location || 'Nokta ' + (i+1)}:`, {
                    konum: `${point.location.lat().toFixed(4)}, ${point.location.lng().toFixed(4)}`,
                    mesafe: `${cumulativeDistance.toFixed(1)} km`,
                    sıcaklık: `${temp.toFixed(1)}°C`,
                    havaDurumu: condition,
                    etki: `-%${Math.round((1-weatherResult.impact)*100)}`
                });
            }

            // Ortalama hava durumu etkisi
            const averageImpact = totalWeatherImpact;
            
            // Hava durumu açıklaması
            let description = "Normal";
            if (averageImpact <= 0.6) description = "Çok Kötü";
            else if (averageImpact <= 0.7) description = "Kötü";
            else if (averageImpact <= 0.8) description = "Orta";
            else if (averageImpact <= 0.9) description = "Hafif Etki";
            
            return {
                impact: averageImpact,
                description: description,
                details: {
                    affectedLocations: affectedLocations,
                    totalDistance: totalDistance
                }
            };
        } catch (error) {
            console.error('Rota hava durumu hesaplama hatası:', error);
            return { impact: 1.0, description: "Normal", details: { affectedLocations: [], totalDistance: 0 } };
        }
    }

    async getLocationName(location) {
        try {
            const response = await fetch(
                `/harita/get-location-name/?lat=${location.lat()}&lng=${location.lng()}`
            );
            if (!response.ok) throw new Error('Konum adı alınamadı');
            const data = await response.json();
            return data.name;
        } catch (error) {
            console.warn('Konum adı alınamadı:', error);
            return null;
        }
    }

    async getWeatherData(location) {
        try {
            const response = await fetch(`/harita/get-weather/?lat=${location.lat()}&lng=${location.lng()}`);
            if (!response.ok) {
                throw new Error('Weather API yanıtı başarısız');
            }
            return await response.json();
        } catch (error) {
            console.error('Hava durumu verisi alınamadı:', error);
            return null;
        }
    }
}

// UI yardımcı sınıfı
class UIHelper {
    createInfoWindow(content, styleOptions = {}) {
        const infoWindow = new google.maps.InfoWindow({ content });
        
        google.maps.event.addListener(infoWindow, 'domready', () => {
            const iwOuter = document.querySelector('.gm-style-iw');
            if (iwOuter) {
                iwOuter.parentElement.style.backgroundColor = 'transparent';
                iwOuter.style.padding = '0';
                
                const closeButton = iwOuter.nextElementSibling;
                if (closeButton) {
                    closeButton.style.opacity = '1';
                    closeButton.style.right = '5px';
                    closeButton.style.top = '5px';
                    closeButton.style.border = 'none';
                }
            }
        });
        
        return infoWindow;
    }

    createMarker(position, options = {}) {
        return new google.maps.Marker({
            position,
            map: options.map,
            title: options.title,
            icon: options.icon
        });
    }
} 