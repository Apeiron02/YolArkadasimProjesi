class WeatherManager {
    constructor() {
        this.weatherCache = new Map(); // Aynı konumlar için tekrar tekrar API isteği yapmamak için önbellek
        this.cacheExpiryTime = 30 * 60 * 1000; // 30 dakika (milisaniye cinsinden)
    }

    async getWeatherData(location) {
        try {
            const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
            const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
            
            // Önbellekte bu konum için veri var mı kontrol et
            const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
            const cachedData = this.weatherCache.get(cacheKey);
            
            // Eğer önbellekte güncel veri varsa, onu kullan
            if (cachedData && (Date.now() - cachedData.timestamp < this.cacheExpiryTime)) {
                return cachedData.data;
            }

            // Değilse, yeni veri al
            const response = await fetch(`/harita/get-weather/?lat=${lat}&lng=${lng}`);
            if (!response.ok) {
                throw new Error('Hava durumu verisi alınamadı');
            }
            
            const weatherData = await response.json();
            
            // Veriyi önbelleğe al
            this.weatherCache.set(cacheKey, {
                data: weatherData,
                timestamp: Date.now()
            });
            
            return weatherData;
        } catch (error) {
            console.error('Hava durumu verisi alınırken hata:', error);
            throw error;
        }
    }

    async showWeatherDataAlongRoute(route) {
        try {
            const leg = route.routes[0].legs[0];
            let weatherEffect = 1.0;
            let trafficEffect = 1.0;

            // Rota üzerindeki hava durumu verilerini al
            const weatherData = await this.getWeatherData(leg.start_location);
            if (weatherData && weatherData.weather && weatherData.weather[0]) {
                const weatherCondition = weatherData.weather[0].main.toLowerCase();
                const temp = weatherData.main.temp - 273.15; // Kelvin'den Celsius'a çevir

                // Hava durumu etkilerini hesapla
                if (weatherCondition.includes('rain')) {
                    weatherEffect = 0.90;
                    console.log('Yağmurlu hava nedeniyle menzil %10 azaltıldı');
                } else if (weatherCondition.includes('snow')) {
                    weatherEffect = 0.80;
                    console.log('Karlı hava nedeniyle menzil %20 azaltıldı');
                } else if (weatherCondition.includes('thunderstorm')) {
                    weatherEffect = 0.85;
                    console.log('Fırtınalı hava nedeniyle menzil %15 azaltıldı');
                } else if (weatherCondition.includes('fog') || weatherCondition.includes('mist')) {
                    weatherEffect = 0.95;
                    console.log('Sisli hava nedeniyle menzil %5 azaltıldı');
                }

                // Sıcaklık etkisi
                if (temp < 0) {
                    weatherEffect *= 0.90;
                    console.log('Düşük sıcaklık nedeniyle menzil %10 daha azaltıldı');
                } else if (temp > 35) {
                    weatherEffect *= 0.95;
                    console.log('Yüksek sıcaklık nedeniyle menzil %5 daha azaltıldı');
                }
            } else {
                console.warn('Hava durumu verisi alınamadı');
            }

            // Trafik durumunu kontrol et
            if (leg.duration_in_traffic && leg.duration) {
                const trafficRatio = leg.duration_in_traffic.value / leg.duration.value;
                
                if (trafficRatio > 1.8) {
                    trafficEffect = 0.75;
                    console.log('Çok yoğun trafik nedeniyle menzil %25 azaltıldı');
                } else if (trafficRatio > 1.5) {
                    trafficEffect = 0.85;
                    console.log('Yoğun trafik nedeniyle menzil %15 azaltıldı');
                } else if (trafficRatio > 1.2) {
                    trafficEffect = 0.90;
                    console.log('Orta yoğunlukta trafik nedeniyle menzil %10 azaltıldı');
                }
            } else {
                console.warn('Trafik verisi alınamadı');
            }

            // Toplam etki faktörünü hesapla
            const totalEffect = weatherEffect * trafficEffect;
            
            // Global değişken olarak sakla
            window.routeConditionsEffect = totalEffect;

            console.log(`Rota Koşulları Analizi:
                - Hava durumu etkisi: ${((1 - weatherEffect) * 100).toFixed(1)}% azalma
                - Trafik etkisi: ${((1 - trafficEffect) * 100).toFixed(1)}% azalma
                - Toplam etki: ${((1 - totalEffect) * 100).toFixed(1)}% azalma`);

            return {
                weatherEffect,
                trafficEffect,
                totalEffect,
                weatherData
            };
        } catch (error) {
            console.error('Hava durumu ve trafik analizi yapılırken hata oluştu:', error);
            return {
                weatherEffect: 1.0,
                trafficEffect: 1.0,
                totalEffect: 1.0,
                error
            };
        }
    }

    async calculateWeatherImpact(routeLeg) {
        try {
            const weatherData = await this.getWeatherData(routeLeg.start_location);
            let weatherImpact = 1.0;
            
            // Sıcaklık etkisi:
            const temp = weatherData.main?.temp - 273.15; // Kelvin'den Celsius'a
            if (temp < 0) weatherImpact *= 0.8;  // Soğuk havada %20 azalma
            else if (temp > 35) weatherImpact *= 0.9;  // Sıcak havada %10 azalma
            
            // Hava koşulları etkisi:
            const weatherCondition = weatherData.weather?.[0]?.main?.toLowerCase() || 'clear';
            if (weatherCondition.includes('rain')) weatherImpact *= 0.85;  // Yağmurda %15 azalma
            else if (weatherCondition.includes('snow')) weatherImpact *= 0.6;  // Karda %40 azalma
            else if (weatherCondition.includes('wind')) weatherImpact *= 0.80;  // Rüzgarda %20 azalma
            else if (weatherCondition.includes('fog')) weatherImpact *= 0.8;  // Sisli havada %20 azalma
            else if (weatherCondition.includes('storm')) weatherImpact *= 0.4;  // Fırtınada %40 azalma
            
            return weatherImpact;
        } catch (error) {
            console.error('Hava durumu etkisi hesaplanırken hata:', error);
            return 1.0; // Hata durumunda etkisiz
        }
    }

    // Hava durumu verilerini görsel olarak göster
    displayWeatherInfo(weatherData, elementId = 'weatherInfo') {
        const element = document.getElementById(elementId);
        if (!element || !weatherData || !weatherData.weather) {
            return;
        }

        const weather = weatherData.weather[0];
        const temp = Math.round(weatherData.main.temp - 273.15); // Kelvin'den Celsius'a
        const windSpeed = weatherData.wind?.speed || 0;
        const humidity = weatherData.main?.humidity || 0;
        const cityName = weatherData.name || 'Bilinmeyen Konum';
        
        const weatherIcon = this.getWeatherIcon(weather.main.toLowerCase());
        const weatherClass = this.getWeatherClass(weather.main.toLowerCase());
        
        element.innerHTML = `
            <div class="weather-card ${weatherClass}">
                <div class="weather-header">
                    <div class="weather-icon">${weatherIcon}</div>
                    <div class="weather-temp">${temp}°C</div>
                </div>
                <div class="weather-details">
                    <p><strong>Konum:</strong> ${cityName}</p>
                    <p><strong>Durum:</strong> ${this.translateWeatherCondition(weather.main)}</p>
                    <p><strong>Nem:</strong> ${humidity}%</p>
                    <p><strong>Rüzgar:</strong> ${windSpeed} m/s</p>
                </div>
            </div>
        `;
    }

    // Hava durumu durumlarına göre ikon belirle
    getWeatherIcon(condition) {
        const icons = {
            'clear': '☀️',
            'clouds': '☁️',
            'rain': '🌧️',
            'drizzle': '🌦️',
            'thunderstorm': '⛈️',
            'snow': '❄️',
            'mist': '🌫️',
            'fog': '🌫️',
            'haze': '🌫️',
            'dust': '💨',
            'sand': '💨',
            'ash': '💨',
            'squall': '💨',
            'tornado': '🌪️'
        };
        
        // Eğer koşul anahtarla tam eşleşmezse, içeriyorsa kontrol et
        for (const key in icons) {
            if (condition.includes(key)) {
                return icons[key];
            }
        }
        
        return '🌤️'; // Varsayılan
    }

    // Hava durumu durumlarına göre CSS sınıfı belirle
    getWeatherClass(condition) {
        if (condition.includes('clear')) return 'weather-clear';
        if (condition.includes('cloud')) return 'weather-cloudy';
        if (condition.includes('rain') || condition.includes('drizzle')) return 'weather-rainy';
        if (condition.includes('thunder')) return 'weather-stormy';
        if (condition.includes('snow')) return 'weather-snowy';
        if (condition.includes('mist') || condition.includes('fog') || condition.includes('haze')) return 'weather-foggy';
        
        return 'weather-default';
    }

    // Hava durumu terimlerini Türkçe'ye çevir
    translateWeatherCondition(condition) {
        const translations = {
            'Clear': 'Açık',
            'Clouds': 'Bulutlu',
            'Rain': 'Yağmurlu',
            'Drizzle': 'Çiseleyen Yağmur',
            'Thunderstorm': 'Fırtınalı',
            'Snow': 'Karlı',
            'Mist': 'Puslu',
            'Fog': 'Sisli',
            'Haze': 'Hafif Sisli',
            'Dust': 'Tozlu',
            'Sand': 'Kumlu',
            'Ash': 'Küllü',
            'Squall': 'Bora',
            'Tornado': 'Tornado'
        };
        
        return translations[condition] || condition;
    }
} 