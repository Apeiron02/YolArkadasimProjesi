class MapManager {
    constructor(mapElementId, options = {}) {
        this.map = null;
        this.markers = [];
        this.currentInfoWindow = null;
        this.directionsRenderer = null;
        this.trafficLayer = null;
        this.clickedLocationMarker = null;
        this.userLocationMarker = null;
        this.mapElementId = mapElementId;
        this.elazigCenter = { lat: 38.6748, lng: 39.2225 };
        this.options = {
            center: this.elazigCenter,
            zoom: 14,
            ...options
        };
        this.onMapClick = null; // Tıklama için callback fonksiyonu
        
        this.init();
    }

    init() {
        // Google Maps API'nin yüklü olduğundan emin olun
        if (typeof google === 'undefined' || !google.maps) {
            console.error('Google Maps API yüklenemedi');
            // Maksimum 10 saniye bekle
            if (!this.retryCount) this.retryCount = 0;
            if (this.retryCount < 100) {
                this.retryCount++;
                setTimeout(() => this.init(), 100);
                return;
            } else {
                console.error('Google Maps API yüklenemedi - maksimum deneme sayısına ulaşıldı');
                return;
            }
        }

        // Google Maps API kontrollerinin mevcut olduğundan emin olun
        if (!google.maps.MapTypeControlStyle || !google.maps.ControlPosition) {
            console.error('Google Maps API kontrolleri henüz yüklenmedi');
            setTimeout(() => this.init(), 100);
            return;
        }

        const mapOptions = {
            center: this.options.center,
            zoom: this.options.zoom,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            scaleControl: true,
            streetViewControl: true,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            fullscreenControl: true
        };

        this.map = new google.maps.Map(
            document.getElementById(this.mapElementId), 
            mapOptions
        );

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Harita tıklama olayını ekle
        this.map.addListener('click', (event) => this.handleMapClick(event));
    }

    handleMapClick(event) {
        const clickedLocation = event.latLng;
        this.updateClickedLocationMarker(clickedLocation);
        
        // Tıklanan konumu arama kutusuna ekle
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: clickedLocation }, (results, status) => {
            if (status === 'OK' && results[0]) {
                document.getElementById('searchBox1').value = results[0].formatted_address;
            }
        });
        
        // Kullanıcı tanımlı callback fonksiyonunu çağır
        if (this.onMapClick && typeof this.onMapClick === 'function') {
            this.onMapClick({
                lat: clickedLocation.lat(),
                lng: clickedLocation.lng()
            });
        }
    }

    // Harita tıklama olayı için callback fonksiyonu tanımla
    setMapClickCallback(callback) {
        this.onMapClick = callback;
    }

    updateClickedLocationMarker(location) {
        if (this.clickedLocationMarker) {
            this.clickedLocationMarker.setMap(null);
        }
        
        this.clickedLocationMarker = new google.maps.Marker({
            position: location,
            map: this.map,
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
            }
        });
    }

    addMarker(position, title, icon) {
        const marker = new google.maps.Marker({
            position: position,
            map: this.map,
            title: title,
            icon: icon
        });
        
        this.markers.push(marker);
        return marker;
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
        
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
            this.currentInfoWindow = null;
        }
    }

    showInfoWindow(marker, content) {
        if (this.currentInfoWindow) {
            this.currentInfoWindow.close();
        }
        
        // Yeni info window oluştur
        const infoWindow = new google.maps.InfoWindow({
            content: content,
            maxWidth: 300,
            disableAutoPan: false,
        })

        // Info window'u aç
        infoWindow.open(this.map, marker)
        this.currentInfoWindow = infoWindow

        // Google Maps'in varsayılan kapatma butonunu gizle
        google.maps.event.addListenerOnce(infoWindow, "domready", () => {
            // Tüm olası kapatma butonlarını seç ve gizle
            const closeButtons = document.querySelectorAll('.gm-ui-hover-effect, button[title="Close"]')
            closeButtons.forEach((btn) => {
            btn.style.display = "none"
            btn.style.visibility = "hidden"
            btn.style.opacity = "0"
            btn.style.pointerEvents = "none"
            })
        })
        
        infoWindow.open(this.map, marker);
        this.currentInfoWindow = infoWindow;
        
        return infoWindow;
    }

    getUserLocation(centerMap = true) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Tarayıcınız konum servisini desteklemiyor.'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                // Başarılı olma durumu
                (position) => {
                    const userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    this.displayUserLocation(userLocation, centerMap);
                    
                    // Konum bilgisini API'ye kaydet
                    this.saveUserLocationToAPI(userLocation);
                    
                    resolve(userLocation);
                },
                // Hata durumu
                (error) => {
                    let errorMessage = 'Konum alınamadı: ';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Konum izni reddedildi.';
                            
                            // Kullanıcıya varsayılan konum kullanmayı teklif et
                            const useDefaultLocation = confirm('Konum izni reddedildi. Varsayılan bir konum kullanmak ister misiniz?');
                            
                            if (useDefaultLocation) {
                                // Varsayılan konum (Türkiye'nin orta noktası)
                                const defaultLocation = { lat: 39.9208, lng: 32.8541 };
                                this.displayUserLocation(defaultLocation, centerMap);
                                
                                try {
                                    // Varsayılan konumu API'ye kaydet
                                    this.saveUserLocationToAPI(defaultLocation);
                                } catch (error) {
                                    console.error('Varsayılan konum API kaydı hatası:', error);
                                }
                                
                                resolve(defaultLocation);
                                return;
                            }
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Konum bilgisi mevcut değil.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Konum alma isteği zaman aşımına uğradı.';
                            break;
                        default:
                            errorMessage += 'Bilinmeyen bir hata oluştu.';
                    }
                    reject(new Error(errorMessage));
                },
                // Seçenekler
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        });
    }

    /**
     * Kullanıcı konumunu göster
     * @param {Object} location - {lat, lng} formatında konum nesnesi
     * @param {Boolean} centerMap - Haritayı konum üzerine merkezle
     */
    displayUserLocation(location, centerMap = true) {
        // Önceki kullanıcı konum marker'ını temizle
        if (this.userLocationMarker) {
            this.userLocationMarker.setMap(null);
        }
        
        // Yeni marker oluştur
        this.userLocationMarker = new google.maps.Marker({
            position: location,
            map: this.map,
            title: 'Konumunuz',
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            }
        });
        
        // Haritayı kullanıcı konumuna merkezle (istenirse)
        if (centerMap) {
            this.map.setCenter(location);
            this.map.setZoom(15);
        }
        
        return location;
    }

    /**
     * Kullanıcı konumunu API'ye kaydet
     * @param {Object} location - {lat, lng} formatında konum nesnesi
     * @returns {Promise} - API yanıtı ile çözülen promise
     */
    async saveUserLocationToAPI(location) {
        try {
            // CSRF token'ı al
            function getCookie(name) {
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
            
            const csrftoken = getCookie('csrftoken');
            
            const response = await fetch('/api/v1/kullanici-konumu/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                    // Eğer doğrulama gerektiren bir API ise:
                    // 'Authorization': 'Bearer ' + jwtToken,
                },
                body: JSON.stringify({
                    latitude: location.lat,
                    longitude: location.lng
                })
            });

            if (!response.ok) {
                throw new Error(`API hatası: ${response.status}`);
            }

            const data = await response.json();
            console.log('Konum API yanıtı:', data);
            return data;

        } catch (error) {
            console.error('Konum API kaydı hatası:', error);
            // API kaydetme hatası kullanıcı deneyimini etkilememelidir
            // Bu nedenle hatayı yakala ama kullanıcıya gösterme
            return null;
        }
    }

    /**
     * Kullanıcı konumunu API'den al
     * Mobil uygulama veya tarayıcı için uygun yöntemi kullanır
     * @param {Object} params - Opsiyonel parametreler: {latitude, longitude} değerleri içerebilir
     */
    async getUserLocationFromAPI(params = {}) {
        try {
            // CSRF token'ı al
            function getCookie(name) {
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
            
            const csrftoken = getCookie('csrftoken');
            
            // Eğer koordinatlar verilmişse, URL'ye ekle
            let url = '/api/v1/kullanici-konumu/';
            if (params.latitude && params.longitude) {
                url += `?latitude=${params.latitude}&longitude=${params.longitude}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'X-CSRFToken': csrftoken,
                }
            });
            
            if (!response.ok) {
                throw new Error(`API hatası: ${response.status}`);
            }
            
            const data = await response.json();
            
            // API başarıyla konum döndürdüyse
            if (data.success && data.latitude && data.longitude) {
                const location = {
                    lat: data.latitude,
                    lng: data.longitude
                };
                this.displayUserLocation(location, false);
                return location;
            }
            
            // API başarısız olduysa veya yönlendirme mesajı döndürdüyse
            console.log('API yanıtı:', data);
            
            // Tarayıcı konum API'sini dene
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                return this.getUserLocation(false);
            } else {
                // Varsayılan konum kullan
                const defaultLocation = { lat: 38.6748, lng: 39.2225 };
                this.displayUserLocation(defaultLocation, false);
                return defaultLocation;
            }
            
        } catch (error) {
            console.error('Konum API hatası:', error);
            
            // Hata durumunda tarayıcı konum API'sine geri dön ya da varsayılan konum kullan
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                return this.getUserLocation(false);
            } else {
                // Varsayılan konum kullan
                const defaultLocation = { lat: 38.6748, lng: 39.2225 };
                this.displayUserLocation(defaultLocation, false);
                return defaultLocation;
            }
        }
    }

    setCenter(location) {
        this.map.setCenter(location);
    }

    setZoom(level) {
        this.map.setZoom(level);
    }

    createSearchBox(elementId, options = {}) {
        return new google.maps.places.Autocomplete(
            document.getElementById(elementId),
            { componentRestrictions: { country: 'tr' }, ...options }
        );
    }
}