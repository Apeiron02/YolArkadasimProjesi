class RouteManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: mapManager.map
        });
    }

    async calculateRoute(origin, destination) {
        try {
            const response = await this.directionsService.route({
                origin,
                destination,
                travelMode: google.maps.TravelMode.DRIVING
            });
            
            this.directionsRenderer.setDirections(response);
            return response;
        } catch (error) {
            console.error('Rota hesaplama hatası:', error);
            throw error;
        }
    }

    async showWeatherDataAlongRoute(route) {
        try {
            const leg = route.routes[0].legs[0];
            
            // Trafik etkisini hesapla
            const trafficResult = this.mapManager.trafficCalculator.calculateTrafficImpact(leg);
            
            // Rota boyunca hava durumu etkisini hesapla
            const weatherResult = await this.mapManager.weatherCalculator.calculateWeatherImpactForRoute(route);
            
            // Toplam etki faktörünü hesapla
            const totalEffect = trafficResult.impact * weatherResult.impact;
            
            // Global değişken olarak sakla
            window.routeConditionsEffect = totalEffect;

            // Koşullar panelini oluştur
            const conditionsHTML = this.createConditionsPanel(weatherResult, trafficResult, totalEffect);
            
            // Mevcut içeriği koru ve yeni içeriği ekle
            const directionsPanel = document.getElementById('directionsPanel');
            if (directionsPanel) {
                const currentContent = directionsPanel.innerHTML;
                directionsPanel.innerHTML = currentContent + conditionsHTML;
            }

            return totalEffect;

        } catch (error) {
            console.error('Hava durumu ve trafik analizi yapılırken hata oluştu:', error);
            return 1.0;
        }
    }

    createConditionsPanel(weatherResult, trafficResult, totalEffect) {
        // Hava durumu detaylarını göster
        const weatherDetails = weatherResult.details.affectedLocations.length > 0 ?
            `<div class="weather-details">
                <p>Etkilenen Bölgeler:</p>
                <ul>
                    ${weatherResult.details.affectedLocations.map(desc => `<li>${desc}</li>`).join('')}
                </ul>
            </div>` : '';

        return `
            <div class="conditions-panel">
                <h4>Rota Koşulları</h4>
                <div class="conditions-content">
                    <div class="condition-row">
                        <span class="condition-label">Hava Durumu:</span>
                        <span class="condition-value ${weatherResult.impact < 0.9 ? 'warning' : ''}">${weatherResult.description}</span>
                        ${weatherResult.impact < 1.0 ? 
                            `<span class="condition-impact negative">-%${Math.round((1-weatherResult.impact)*100)}</span>` : 
                            '<span class="condition-impact neutral">Etki Yok</span>'}
                    </div>
                    ${weatherDetails}
                    <div class="condition-row">
                        <span class="condition-label">Trafik Durumu:</span>
                        <span class="condition-value ${trafficResult.impact < 0.9 ? 'warning' : ''}">${trafficResult.description}</span>
                        ${trafficResult.impact < 1.0 ? 
                            `<span class="condition-impact negative">-%${Math.round((1-trafficResult.impact)*100)}</span>` : 
                            '<span class="condition-impact neutral">Etki Yok</span>'}
                    </div>
                    <div class="condition-row total">
                        <span class="condition-label">Toplam Menzil Etkisi:</span>
                        <span class="condition-value ${totalEffect < 0.9 ? 'warning' : ''}">${totalEffect < 0.8 ? 'Önemli Azalma' : (totalEffect < 0.9 ? 'Orta Azalma' : 'Az Etki')}</span>
                        <span class="condition-impact negative">-%${Math.round((1-totalEffect)*100)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    async checkRouteViability(route) {
        try {
            const batteryLevel = await this.getBatteryLevel();
            const totalDistance = this.calculateTotalDistance(route);
            const maxRange = batteryLevel; // Tam şarjdaki maksimum menzil
            const actualRange = maxRange * 0.8; // Başlangıçtaki mevcut şarj ile menzil (%80)

            // Rota boyunca hava durumu etkisini hesapla
            const weatherResult = await this.mapManager.weatherCalculator.calculateWeatherImpactForRoute(route);
            
            // Trafik etkisini hesapla
            const trafficResult = this.mapManager.trafficCalculator.calculateTrafficImpact(route.routes[0].legs[0]);

            // Toplam etki faktörünü hesapla
            const totalEffect = weatherResult.impact * trafficResult.impact;
            
            // Etki faktörünü uygulayarak gerçek menzili hesapla
            const effectiveRange = actualRange * totalEffect;

            console.log('🔋 Menzil Analizi:', {
                toplamMesafe: `${totalDistance.toFixed(1)} km`,
                maksimumMenzil: `${maxRange.toFixed(1)} km`,
                başlangıçMenzili: `${actualRange.toFixed(1)} km`,
                havaDurumuEtkisi: `%${Math.round((1-weatherResult.impact)*100)} azalma`,
                trafikEtkisi: `%${Math.round((1-trafficResult.impact)*100)} azalma`,
                efektifMenzil: `${effectiveRange.toFixed(1)} km`
            });

            if (totalDistance <= effectiveRange) {
                return { viable: true, remainingRange: effectiveRange - totalDistance };
            } else {
                // Şarj istasyonlarında tam şarjın %80'i kadar şarj yapılacak
                const fullChargeBaseRange = maxRange * 0.8; // Şarj istasyonunda dolacak temel menzil
                // Şarj istasyonundaki hava durumu ve trafik etkisi daha sonra hesaplanacak
                // Bu nedenle burada sadece temel menzili kullanıyoruz
                const fullChargeEffectiveRange = fullChargeBaseRange; // Şarj istasyonundaki koşullar daha sonra uygulanacak
                
                // İlk şarjdan kalan mesafe
                let remainingDistance = totalDistance - effectiveRange;
                // Gereken şarj durağı sayısı (her durakta orijinal menzilin %80'i kadar şarj)
                const requiredStops = Math.ceil(remainingDistance / fullChargeEffectiveRange);

                console.log('⚡ Şarj İstasyonu Analizi:', {
                    kalanMesafe: `${remainingDistance.toFixed(1)} km`,
                    şarjİstasyonuMenzili: `${fullChargeBaseRange.toFixed(1)} km`,
                    efektifŞarjMenzili: `${fullChargeEffectiveRange.toFixed(1)} km`,
                    gerekenDurak: requiredStops
                });

                await this.handleChargingStationSuggestion(route, requiredStops);
                return { 
                    viable: false, 
                    requiredStops,
                    fullChargeRange: fullChargeBaseRange,
                    effectiveChargeRange: fullChargeEffectiveRange
                };
            }
        } catch (error) {
            console.error('Rota kontrol hatası:', error);
            throw error;
        }
    }

    // ... diğer metodlar
}