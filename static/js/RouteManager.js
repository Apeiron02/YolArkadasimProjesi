class RouteManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: mapManager.map,
            panel: document.getElementById('directionsPanel'),
            draggable: true
        });
        this.originalRoute = null;
        this.trafficVisible = false;
        this.trafficPolylines = [];
        this.detectedCities = [];
    }

    async calculateRoute(origin, destination, options = {}) {
        try {
            // Başlangıç ve hedef noktaları kontrol et
            if (!origin || !destination) {
                throw new Error('Başlangıç ve hedef konumları belirtilmelidir');
            }

            // Haritadaki tüm marker'ları kaldır
            this.mapManager.clearMarkers();

            // Eğer origin ve destination string ise (adres), geocoding yap
            let originLocation = origin;
            let destinationLocation = destination;

            if (typeof origin === 'string') {
                const geocoder = new google.maps.Geocoder();
                const originResult = await new Promise((resolve, reject) => {
                    geocoder.geocode({ address: origin }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            resolve(results[0].geometry.location);
                        } else {
                            reject(new Error(`Başlangıç konumu bulunamadı: ${status}`));
                        }
                    });
                });
                originLocation = originResult;
            }

            if (typeof destination === 'string') {
                const geocoder = new google.maps.Geocoder();
                const destinationResult = await new Promise((resolve, reject) => {
                    geocoder.geocode({ address: destination }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            resolve(results[0].geometry.location);
                        } else {
                            reject(new Error(`Hedef konumu bulunamadı: ${status}`));
                        }
                    });
                });
                destinationLocation = destinationResult;
            }

            // Rota isteği oluştur
            const request = {
                origin: originLocation,
                destination: destinationLocation,
                travelMode: google.maps.TravelMode.DRIVING,
                drivingOptions: {
                    departureTime: new Date(),
                    trafficModel: google.maps.TrafficModel.BEST_GUESS
                },
                ...options
            };

            // Rota hesaplama isteği gönder
            const response = await new Promise((resolve, reject) => {
                this.directionsService.route(request, (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        resolve(result);
                    } else {
                        reject(new Error(`Rota hesaplanamadı: ${status}`));
                    }
                });
            });

            // Rota sonucunu göster
            this.directionsRenderer.setDirections(response);
            this.originalRoute = response;
            
            // Rota panelini güncelle
            document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
            
            return response;
        } catch (error) {
            console.error('Rota hesaplama hatası:', error);
            throw error;
        }
    }

    async calculateRouteWithWaypoints(origin, destination, waypoints, optimizeWaypoints = false) {
        try {
            const request = {
                origin: origin,
                destination: destination,
                waypoints: waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: optimizeWaypoints
            };

            const response = await new Promise((resolve, reject) => {
                this.directionsService.route(request, (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        resolve(result);
                    } else {
                        reject(new Error(`Rota hesaplanamadı: ${status}`));
                    }
                });
            });

            this.directionsRenderer.setDirections(response);
            this.originalRoute = response;
            return response;
        } catch (error) {
            console.error('Rota hesaplama hatası:', error);
            throw error;
        }
    }

    clearRoute() {
        if (this.directionsRenderer) {
            this.directionsRenderer.setMap(null);
            this.directionsRenderer = new google.maps.DirectionsRenderer({
                map: this.mapManager.map,
                panel: document.getElementById('directionsPanel'),
                draggable: true
            });
            
            // Rota panelini varsayılan haline getir
            const directionsPanel = document.getElementById('directionsPanel');
            directionsPanel.innerHTML = `
                <h3 class="section-title"><i class="fas fa-directions"></i> Rota Bilgileri</h3>
                <div class="directions-summary">
                    <!-- Rota özeti buraya gelecek -->
                </div>
                <div class="directions-content">
                    <!-- Rota bilgileri burada görüntülenecek -->
                </div>
                <div class="cities-info">
                    <h4><i class="fas fa-city"></i> Geçilen Şehirler</h4>
                    <div class="cities-list">
                        <!-- Geçilen şehirler listesi buraya gelecek -->
                    </div>
                </div>
            `;
        }
        this.originalRoute = null;
        this.detectedCities = [];
    }

    saveRoute() {
        if (!this.directionsRenderer || !this.directionsRenderer.getDirections()) {
            throw new Error('Kaydedilecek rota bulunamadı');
        }

        const directions = this.directionsRenderer.getDirections();
        const route = directions.routes[0];
        const leg = route.legs[0];
        
        const routeData = {
            start_address: leg.start_address,
            end_address: leg.end_address,
            start_latitude: leg.start_location.lat(),
            start_longitude: leg.start_location.lng(),
            end_latitude: leg.end_location.lat(),
            end_longitude: leg.end_location.lng(),
            total_distance: leg.distance.value / 1000,
            total_duration: leg.duration.value / 60
        };

        // API endpoint'ini kullanarak rota bilgisini kaydet
        return fetch('/harita/save-route-history/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCookie('csrftoken')
            },
            body: JSON.stringify(routeData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Rota kaydedilirken bir hata oluştu');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Rota başarıyla kaydedildi:', data);
            return data;
        });
    }

    async toggleTraffic() {
        if (!this.mapManager.map || !this.directionsRenderer || !this.directionsRenderer.getDirections()) {
            throw new Error('Önce bir rota oluşturunuz.');
        }

        try {
            // Eğer durak eklenmiş bir rota varsa, onu kullan
            const currentRoute = this.directionsRenderer.getDirections();
            if (currentRoute) {
                this.originalRoute = currentRoute;
            }

            const routes = this.originalRoute.routes[0];
            
            if (this.trafficVisible) {
                // Trafik görünümünden normal görünüme geç
                this.trafficPolylines.forEach(polyline => polyline.setMap(null));
                this.trafficPolylines = [];
                this.directionsRenderer.setMap(this.mapManager.map);
                this.directionsRenderer.setDirections(this.originalRoute);
                document.getElementById('trafficButton').classList.remove('active');
                
                // Rota panelini varsayılan haline getir
                const directionsPanel = document.getElementById('directionsPanel');
                directionsPanel.innerHTML = `
                    <h3 class="section-title"><i class="fas fa-directions"></i> Rota Bilgileri</h3>
                    <div class="directions-summary">
                        <!-- Rota özeti buraya gelecek -->
                    </div>
                    <div class="directions-content">
                        <!-- Rota bilgileri burada görüntülenecek -->
                    </div>
                    <div class="cities-info">
                        <h4><i class="fas fa-city"></i> Geçilen Şehirler</h4>
                        <div class="cities-list">
                            <!-- Geçilen şehirler listesi buraya gelecek -->
                        </div>
                    </div>
                `;
                
                // Geçilen şehirleri tekrar göster
                this.logCitiesAlongRoute();
            } else {
                // Normal görünümden trafik görünümüne geç
                this.directionsRenderer.setMap(null);
                
                // Tüm rota bacakları için trafik bilgilerini topla
                let totalNormalDuration = 0;
                let totalTrafficDuration = 0;
                let trafficInfoHTML = `
                    <h3 class="section-title"><i class="fas fa-directions"></i> Rota Bilgileri</h3>
                    <div class="directions-summary">
                        <!-- Rota özeti buraya gelecek -->
                    </div>
                    <div class="directions-panel-section">
                        <h4>Trafik Bilgileri</h4>
                        <div class="panel-content">
                `;
                
                // Her bir rota bacağı için trafik bilgilerini hesapla
                for (let i = 0; i < routes.legs.length; i++) {
                    const leg = routes.legs[i];
                    totalNormalDuration += leg.duration.value;
                    
                    // Her adım için trafik durumunu kontrol et
                    for (const step of leg.steps) {
                        const trafficInfo = await this.getTrafficInfo(step);
                        const color = this.getTrafficColor(trafficInfo.congestion);
                        
                        const polyline = new google.maps.Polyline({
                            path: step.path,
                            strokeColor: color,
                            strokeWeight: 6,
                            strokeOpacity: 0.8,
                            map: this.mapManager.map,
                            zIndex: 1
                        });
                        
                        this.trafficPolylines.push(polyline);
                        
                        // Trafik süresini topla
                        totalTrafficDuration += trafficInfo.trafficDuration;
                    }
                    
                    // Bacak bilgilerini HTML'e ekle
                    trafficInfoHTML += `
                        <div class="info-row">
                            <strong>Bölüm ${i + 1}:</strong> ${leg.start_address} → ${leg.end_address}
                        </div>
                        <div class="info-row">
                            <strong>Mesafe:</strong> ${leg.distance.text}
                        </div>
                    `;
                }
                
                // Toplam trafik gecikmesini hesapla
                const totalDelay = Math.round((totalTrafficDuration - totalNormalDuration) / 60);
                const trafficStatus = totalDelay > 0 ?
                    `<div class="traffic-status heavy">
                        <strong>⚠️ Toplam Trafik Gecikmesi:</strong> ${totalDelay} dakika
                    </div>` :
                    `<div class="traffic-status light">
                        <strong>✓ Normal Trafik Akışı</strong>
                    </div>`;
                
                trafficInfoHTML += `
                    <div class="info-row">
                        <strong>Normal Süre:</strong> ${Math.round(totalNormalDuration / 60)} dakika
                    </div>
                    <div class="info-row">
                        <strong>Trafikli Süre:</strong> ${Math.round(totalTrafficDuration / 60)} dakika
                    </div>
                    ${trafficStatus}
                </div></div>
                <div class="cities-info">
                    <h4><i class="fas fa-city"></i> Geçilen Şehirler</h4>
                    <div class="cities-list">
                        ${this.getCitiesAlongRoute().join(', ') || 'Tespit edilemedi'}
                    </div>
                </div>`;
                
                document.getElementById('directionsPanel').innerHTML = trafficInfoHTML;
                document.getElementById('trafficButton').classList.add('active');
            }

            this.trafficVisible = !this.trafficVisible;
            return this.trafficVisible;

        } catch (error) {
            console.error('Trafik katmanı değiştirme hatası:', error);
            throw new Error('Trafik bilgisi gösterilirken bir hata oluştu.');
        }
    }

    async getTrafficInfo(step) {
        const service = new google.maps.DistanceMatrixService();
        
        try {
            const result = await new Promise((resolve, reject) => {
                service.getDistanceMatrix({
                    origins: [step.start_location],
                    destinations: [step.end_location],
                    travelMode: google.maps.TravelMode.DRIVING,
                    drivingOptions: {
                        departureTime: new Date(),
                        trafficModel: google.maps.TrafficModel.BEST_GUESS
                    }
                }, (response, status) => {
                    if (status === 'OK') resolve(response);
                    else reject(status);
                });
            });

            const element = result.rows[0].elements[0];
            const normalDuration = element.duration.value;
            const trafficDuration = element.duration_in_traffic ? 
                element.duration_in_traffic.value : normalDuration;
            const ratio = trafficDuration / normalDuration;

            let congestion;
            if (ratio > 2.0) congestion = 'very_heavy';
            else if (ratio > 1.5) congestion = 'heavy';
            else if (ratio > 1.2) congestion = 'medium';
            else congestion = 'light';

            return {
                congestion,
                ratio,
                normalDuration,
                trafficDuration
            };
        } catch (error) {
            console.error('Trafik bilgisi alınamadı:', error);
            return { 
                congestion: 'unknown',
                trafficDuration: step.duration.value,
                normalDuration: step.duration.value,
                ratio: 1
            };
        }
    }

    getTrafficColor(congestion) {
        const colors = {
            very_heavy: '#8B0000', // Koyu kırmızı
            heavy: '#FF0000',      // Kırmızı
            medium: '#FFA500',     // Turuncu
            light: '#008000',      // Yeşil
            unknown: '#808080'     // Gri
        };
        return colors[congestion] || colors.unknown;
    }

    addWaypoint(location, name) {
        if (!this.directionsRenderer || !this.directionsRenderer.getDirections()) {
            alert('Önce bir rota oluşturmanız gerekmektedir.');
            throw new Error('Önce bir rota oluşturmanız gerekmektedir.');
        }

        // Mevcut rotayı al
        const currentRoute = this.directionsRenderer.getDirections();
        const route = currentRoute.routes[0];
        const legs = route.legs;
        
        // Başlangıç ve varış noktalarını koru
        const originalOrigin = legs[0].start_location;
        const originalDestination = legs[legs.length - 1].end_location;
        
        // Mevcut ara durakları al
        const waypoints = [];
        for (let i = 0; i < legs.length - 1; i++) {
            // Her bacağın son noktası bir ara duraktır (son bacak hariç)
            waypoints.push({
                location: legs[i].end_location,
                stopover: true
            });
        }
        
        // Yeni durak için LatLng nesnesi oluştur
        const newPoint = (location instanceof google.maps.LatLng) 
            ? location 
            : new google.maps.LatLng(location.lat, location.lng);

        // En yakın bacağı bul (iki nokta arasındaki segment)
        let closestLegIndex = 0;
        let minDistance = Infinity;
        
        for (let i = 0; i < legs.length; i++) {
            // Bacağın başlangıç ve bitiş noktaları
            const startPoint = legs[i].start_location;
            const endPoint = legs[i].end_location;
            
            // Noktadan çizgiye olan mesafeyi hesapla (yaklaşık hesaplama)
            const distanceToStart = google.maps.geometry.spherical.computeDistanceBetween(startPoint, newPoint);
            const distanceToEnd = google.maps.geometry.spherical.computeDistanceBetween(endPoint, newPoint);
            const legDistance = legs[i].distance.value;
            
            // Bu bacağa olan yaklaşık mesafe
            const distanceToLeg = Math.min(
                distanceToStart + distanceToEnd - legDistance,  // Üçgen eşitsizliği kullanarak yaklaşık mesafe
                distanceToStart,
                distanceToEnd
            );
            
            if (distanceToLeg < minDistance) {
                minDistance = distanceToLeg;
                closestLegIndex = i;
            }
        }
        
        // Yeni durağı uygun konuma ekle (tam olarak hangi bacak arasına)
        if (closestLegIndex < legs.length - 1) {
            // Ara bacaklara ekleme
            waypoints.splice(closestLegIndex, 0, {
                location: newPoint,
                stopover: true
            });
        } else {
            // Son bacağa ekleme (varış noktasından önce)
            waypoints.push({
                location: newPoint,
                stopover: true
            });
        }

        // Rotayı, orijinal başlangıç ve varış noktalarını kullanarak yeniden hesapla
        const request = {
            origin: originalOrigin,
            destination: originalDestination,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false,
            provideRouteAlternatives: false
        };

        return new Promise((resolve, reject) => {
            this.directionsService.route(request, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    this.directionsRenderer.setDirections(result);
                    
                    // Orijinal rotayı ve bu yeni durağı içeren sonuç olduğunu doğrula
                    const newRoute = result.routes[0];
                    const newLegs = newRoute.legs;
                    
                    // Varış noktasının değişmediğini kontrol et
                    const newDestination = newLegs[newLegs.length - 1].end_location;
                    const destDistance = google.maps.geometry.spherical.computeDistanceBetween(
                        originalDestination, 
                        newDestination
                    );
                    
                    if (destDistance > 100) { // 100 metre tolerans
                        console.warn('Varış noktası değişmiş olabilir, kontrol ediliyor...');
                    }
                    
                    resolve(name);
                } else {
                    reject(new Error('Durak eklenirken bir hata oluştu: ' + status));
                }
            });
        });
    }

    // Başlangıç noktasını al (searchBox1 veya mevcut rotadan)
    getOrigin() {
        const originInput = document.getElementById('searchBox1').value;
        if (originInput) {
            return originInput;
        }
        
        if (this.directionsRenderer && this.directionsRenderer.getDirections()) {
            const route = this.directionsRenderer.getDirections().routes[0];
            if (route && route.legs && route.legs.length > 0) {
                return route.legs[0].start_location;
            }
        }
        
        return null;
    }

    // Varış noktasını al (searchBox2 veya mevcut rotadan)
    getDestination() {
        const destInput = document.getElementById('searchBox2').value;
        if (destInput) {
            return destInput;
        }
        
        if (this.directionsRenderer && this.directionsRenderer.getDirections()) {
            const route = this.directionsRenderer.getDirections().routes[0];
            if (route && route.legs && route.legs.length > 0) {
                const lastLeg = route.legs[route.legs.length - 1];
                return lastLeg.end_location;
            }
        }
        
        return null;
    }

    getCitiesAlongRoute() {
        if (this.detectedCities && this.detectedCities.length > 0) {
            // Eğer zaten AppManager tarafından tespit edilmiş şehirler varsa, onları kullan
            return this.detectedCities;
        }
        
        // Aksi halde en azından başlangıç ve bitiş şehirlerini bulmaya çalış
        if (!this.directionsRenderer || !this.directionsRenderer.getDirections()) {
            console.error('Rota bulunamadı. Önce rota oluşturulmalı.');
            return [];
        }

        const directions = this.directionsRenderer.getDirections();
        const route = directions.routes[0];
        const cities = new Set();
        
        // Türkiye'deki şehir adları
        const turkishCities = [
            'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 
            'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 
            'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 
            'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 
            'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 
            'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 
            'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 
            'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 
            'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 
            'Kilis', 'Osmaniye', 'Düzce'
        ];
        
        // Basitleştirilmiş adres analizi (sadece başlangıç ve bitiş noktaları için)
        const extractCityFromAddress = (address) => {
            if (!address) return null;
            
            // Adres parçalarına ayır
            const parts = address.split(',').map(part => part.trim());
            
            // Doğrudan şehir ismi eşleşmesi ara
            for (const city of turkishCities) {
                if (address.includes(city)) {
                    return city;
                }
            }
            
            return null;
        };

        // Sadece başlangıç ve bitiş noktalarındaki şehirleri ekle
        for (const leg of route.legs) {
            const startCity = extractCityFromAddress(leg.start_address);
            if (startCity) cities.add(startCity);
            
            const endCity = extractCityFromAddress(leg.end_address);
            if (endCity) cities.add(endCity);
        }

        return Array.from(cities);
    }
    
    // Şehir listesini UI'da güncelle - AppManager tarafından da kullanılıyor
    updateCitiesList(cities) {
        if (!cities || cities.length === 0) {
            console.warn('Güncellenecek şehir listesi bulunamadı');
            return;
        }
        
        // Şehir listesini benzersiz hale getir
        const uniqueCities = [...new Set(cities)];
        this.detectedCities = uniqueCities; // Tespit edilen şehirleri sakla
        
        // UI'de göster
        const citiesList = document.querySelector('#directionsPanel .cities-list');
        if (citiesList) {
            citiesList.textContent = uniqueCities.join(', ');
            console.log('Şehir listesi güncellendi:', uniqueCities.join(', '));
        } else {
            // Şehir listesi elementi yoksa oluştur
            this.createCitiesInfoElement(uniqueCities);
        }
    }
    
    // Şehir bilgi elementini oluştur (DOM manipülasyonu)
    createCitiesInfoElement(cities) {
        const directionsPanel = document.getElementById('directionsPanel');
        if (!directionsPanel) return;
        
        // Varolan cities-info div'ini bul
        let citiesInfo = directionsPanel.querySelector('.cities-info');
        
        // Eğer yoksa oluştur
        if (!citiesInfo) {
            citiesInfo = document.createElement('div');
            citiesInfo.className = 'cities-info';
            citiesInfo.innerHTML = `
                <h4><i class="fas fa-city"></i> Geçilen Şehirler</h4>
                <div class="cities-list">${cities.join(', ')}</div>
            `;
            directionsPanel.appendChild(citiesInfo);
        } else {
            // Varsa sadece içeriğini güncelle
            let citiesListElement = citiesInfo.querySelector('.cities-list');
            if (!citiesListElement) {
                citiesListElement = document.createElement('div');
                citiesListElement.className = 'cities-list';
                citiesInfo.appendChild(citiesListElement);
            }
            citiesListElement.textContent = cities.join(', ');
        }
    }

    // Şehir listesini göster - hem eski hem yeni şehir tespiti için çalışacak şekilde
    logCitiesAlongRoute() {
        // Eğer AppManager tarafından tespit edilmiş şehirler varsa onları kullan
        if (this.detectedCities && this.detectedCities.length > 0) {
            console.log('Rotada Geçilen Şehirler:', this.detectedCities.join(', '));
            this.updateCitiesList(this.detectedCities);
            return this.detectedCities;
        }
        
        // Yoksa basit tespit algoritmasını çalıştır
        const cities = this.getCitiesAlongRoute();
        if (cities.length > 0) {
            console.log('Rotada Geçilen Şehirler (basit tespit):', cities.join(', '));
            this.updateCitiesList(cities);
            return cities;
        } else {
            console.log('Rotada geçilen şehirler tespit edilemedi.');
            
            // Şehir listesi elementini temizle
            const citiesList = document.querySelector('#directionsPanel .cities-list');
            if (citiesList) {
                citiesList.textContent = 'Tespit edilemedi';
            }
            
            return [];
        }
    }

    // Yeni eklenen metot: Tespit edilen şehirler için etkinlik önerileri al
    async getSuggestions() {
        try {
            // Eğer tespit edilmiş şehir yoksa hata döndür
            if (!this.detectedCities || this.detectedCities.length === 0) {
                throw new Error('Öneriler için şehir listesi bulunamadı. Lütfen önce bir rota oluşturun.');
            }

            console.log('Etkinlik önerileri alınıyor...', this.detectedCities);
            
            // Şehir listesini API'ye gönder
            const response = await fetch('/harita/stopover-suggestions/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                body: JSON.stringify({
                    cities: this.detectedCities
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Öneriler alınırken bir hata oluştu');
            }

            const data = await response.json();
            console.log('Etkinlik önerileri alındı:', data);
            
            return data.suggestions;
            
        } catch (error) {
            console.error('Etkinlik önerileri alınırken hata:', error);
            throw error;
        }
    }

    // Yeni eklenen metot: Önerileri modal/popup içinde göster
    showSuggestionsModal(suggestions) {
        // Modal container oluştur
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'custom-dialog-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'custom-dialog';
        
        // Modal başlık
        const header = document.createElement('div');
        header.className = 'dialog-header';
        header.innerHTML = `
            <div class="dialog-icon"><i class="fas fa-lightbulb"></i></div>
            <h3>Mola Noktası Önerileri</h3>
        `;
        
        // Modal içerik
        const content = document.createElement('div');
        content.className = 'dialog-content';
        content.innerHTML = `
            <div class="suggestions-text">
                <p>Rotanız üzerindeki şehirler için mola noktası önerileri:</p>
                <div class="suggestions-list">
                    ${suggestions}
                </div>
            </div>
        `;
        
        // Modal butonları
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.innerHTML = `
            <button class="dialog-button confirm-btn">Tamam</button>
        `;
        
        // DOM'a ekle
        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(buttons);
        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);
        
        // Modal kapatma işlemi
        const closeModal = () => {
            document.body.removeChild(modalOverlay);
        };
        
        // Tamam butonuna tıklama
        buttons.querySelector('.confirm-btn').addEventListener('click', closeModal);
        
        // Arka plana tıklama ile kapatma
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        // ESC tuşu ile kapatma
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.body.contains(modalOverlay)) {
                closeModal();
            }
        });
    }

    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
} 