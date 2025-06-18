let markers = []; // Bunu tutuyoruz çünkü aktif kullanılıyor
let currentInfoWindow = null; // Bunu tutuyoruz çünkü info window yönetimi için gerekli
let map;
let directionsRenderer;
let searchBox1;
let searchBox2;
const elazigCenter = { lat: 38.6748, lng: 39.2225 };
let clickedLocationMarker = null;
let chargingStationsVisible = false;
let userLocationMarker = null;
let trafficVisible = false;
let trafficLayer = null;
let originalRoute = null;
let trafficPolylines = [];
let chargingStationMarkers = []; // Şarj istasyonu marker'larını takip etmek için

// Projede şu anda kullanılan fonksiyonlar
function initMap() {
    try {
        if (typeof google === 'undefined' || !google.maps) {
            console.error('Google Maps API yüklenemedi');
            return;
        }

        const mapOptions = {
            center: elazigCenter,
            zoom: 14,
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

        map = new google.maps.Map(document.getElementById('map'), mapOptions);

        searchBox1 = new google.maps.places.Autocomplete(
            document.getElementById('searchBox1'),
            { componentRestrictions: { country: 'tr' } }
        );

        searchBox2 = new google.maps.places.Autocomplete(
            document.getElementById('searchBox2'),
            { componentRestrictions: { country: 'tr' } }
        );

        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            panel: document.getElementById('directionsPanel')
        });

        // Event listener'ları güncelle - gereksiz olanları kaldır
        const routeButton = document.getElementById('routeButton');
        const clearButton = document.getElementById('clearButton');
        const trafficButton = document.getElementById('trafficButton');
        const toggleChargingStationsButton = document.getElementById('toggleChargingStationsButton');

        if (routeButton) routeButton.addEventListener('click', calculateRoute);
        if (clearButton) clearButton.addEventListener('click', clearMap);
        if (trafficButton) trafficButton.addEventListener('click', toggleTraffic);
        if (toggleChargingStationsButton) {
            toggleChargingStationsButton.addEventListener('click', showChargingStationsOnRoute);
        }

        // Harita tıklama olayını ekle
        google.maps.event.addListener(map, 'click', function(event) {
            const clickedLocation = event.latLng;
            
            if (clickedLocationMarker) {
                clickedLocationMarker.setMap(null);
            }
            
            clickedLocationMarker = new google.maps.Marker({
                position: clickedLocation,
                map: map,
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                }
            });

            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: clickedLocation }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    document.getElementById('searchBox1').value = results[0].formatted_address;
                }
            });

            searchNearbyChargingStations({
                lat: clickedLocation.lat(),
                lng: clickedLocation.lng()
            });
        });

        const getLocationButton = document.getElementById('getLocationButton');
        if (getLocationButton) {
            getLocationButton.addEventListener('click', getUserLocation);
        }

        console.log('Harita başarıyla başlatıldı ve event listener\'lar eklendi');
    } catch (error) {
        console.error('Harita başlatma hatası:', error);
    }
}

// searchNearbyChargingStations fonksiyonunda info window içeriğini güncelle
function searchNearbyChargingStations(location) {
    clearMarkers(); // Önceki marker'ları temizle

    fetch(`/harita/get-nearby-charging-stations/?lat=${location.lat}&lng=${location.lng}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.stations && Array.isArray(data.stations)) {
                data.stations.forEach(station => {
                    const marker = new google.maps.Marker({
                        position: { 
                            lat: parseFloat(station.latitude), 
                            lng: parseFloat(station.longitude) 
                        },
                        map: map,
                        title: station.name,
                        icon: {
                            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                        }
                    });

                    // Şarj istasyonu için güncellenmiş info window içeriği
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="station-info-window">
                                <div class="info-header">
                                    <h3>${station.name}</h3>
                                </div>
                                <div class="info-content">
                                    <p class="info-address">${station.vicinity || ''}</p>
                                    <p class="info-coordinates">Konum: ${station.latitude}, ${station.longitude}</p>
                                    ${station.rating ? `<p class="info-rating">⭐ ${station.rating}</p>` : ''}
                                    <div class="info-buttons">
                                        <button onclick="showNearbyRestaurants(${station.latitude}, ${station.longitude}, '${station.place_id}')">
                                            🍽️ Restoranları Göster
                                        </button>
                                        <button onclick="addWaypoint(${station.latitude}, ${station.longitude}, '${station.name}')">
                                            📍 Durak Ekle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `
                    });

                    // Info window stil ayarları
                    google.maps.event.addListener(infoWindow, 'domready', function() {
                        // Info window stil sınıflarını ekle
                        const iwOuter = document.querySelector('.gm-style-iw');
                        if (iwOuter) {
                            iwOuter.parentElement.style.backgroundColor = 'transparent';
                            iwOuter.style.padding = '0';
                            
                            // Kapatma butonunu özelleştir
                            const closeButton = iwOuter.nextElementSibling;
                            if (closeButton) {
                                closeButton.style.opacity = '1';
                                closeButton.style.right = '5px';
                                closeButton.style.top = '5px';
                                closeButton.style.border = 'none';
                            }
                        }
                    });

                    marker.addListener('click', () => {
                        if (currentInfoWindow) {
                            currentInfoWindow.close();
                        }
                        infoWindow.open(map, marker);
                        currentInfoWindow = infoWindow;
                        
                        // Şarj istasyonunun adresini searchBox2'ye ekle
                        document.getElementById('searchBox2').value = station.vicinity || station.name;
                        
                        clearRestaurantMarkers();
                    });

                    markers.push(marker);
                });
            } else {
                console.error('Şarj istasyonları bulunamadı veya geçersiz veri alındı:', data);
            }
        })
        .catch(error => {
            console.error('Şarj istasyonları yüklenirken hata:', error);
        });
}

// showNearbyRestaurants fonksiyonunda info window içeriğini güncelle
function showNearbyRestaurants(lat, lng, stationId) {
    // Önceki restoran marker'larını temizle
    clearRestaurantMarkers();

    // Info window'u kapat
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }

    fetch(`/harita/get-restaurants/?station_id=${stationId}`)
        .then(response => response.json())
        .then(data => {
            data.restaurants.forEach(restaurant => {
                const restaurantMarker = new google.maps.Marker({
                    position: { 
                        lat: restaurant.latitude, 
                        lng: restaurant.longitude 
                    },
                    map: map,
                    title: restaurant.name,
                    icon: {
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    }
                });

                // Restoran için güncellenmiş info window içeriği
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="restaurant-info-window">
                            <div class="info-header">
                                <h3>${restaurant.name}</h3>
                            </div>
                            <div class="info-content">
                                <p class="info-address">${restaurant.vicinity || ''}</p>
                                <div class="info-buttons">
                                    <button onclick="selectRestaurantAsDestination('${lat}, ${lng}', '${restaurant.name}, ${restaurant.vicinity}')">
                                        🚗 Rota Oluştur
                                    </button>
                                </div>
                            </div>
                        </div>
                    `
                });

                // Info window stil ayarları
                google.maps.event.addListener(infoWindow, 'domready', function() {
                    const iwOuter = document.querySelector('.gm-style-iw');
                    if (iwOuter) {
                        iwOuter.parentElement.style.backgroundColor = 'transparent';
                        iwOuter.style.padding = '0';
                    }
                });

                restaurantMarker.addListener('click', () => {
                    if (currentInfoWindow) {
                        currentInfoWindow.close();
                    }
                    infoWindow.open(map, restaurantMarker);
                    currentInfoWindow = infoWindow;
                });

                markers.push(restaurantMarker);
            });
        })
        .catch(error => {
            console.error('Restoranlar yüklenirken hata:', error);
            alert('Restoranlar yüklenirken bir hata oluştu');
        });
}

function selectRestaurantAsDestination(stationAddress, restaurantAddress) {
    // DirectionsPanel'i temizle
    document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
    
    // Şarj istasyonunu başlangıç noktası yap
    document.getElementById('searchBox1').value = stationAddress;
    // Restoranı varış noktası yap
    document.getElementById('searchBox2').value = restaurantAddress;
    
    // Info window'u kapat
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }
    
    // DirectionsRenderer'ı sıfırla
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
        directionsRenderer = null;
    }
    
    // Otomatik olarak rotayı hesapla
    calculateRoute();
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    if (currentInfoWindow) {
        currentInfoWindow.close();
        currentInfoWindow = null;
    }
}

function clearRestaurantMarkers() {
    markers = markers.filter(marker => {
        if (marker.icon.url.includes('blue-dot.png')) {
            marker.setMap(null);
            return false;
        }
        return true;
    });
}


function clearMap() {
    if (directionsRenderer) {
        const directions = directionsRenderer.getDirections();
        if (directions) {
            const route = directions.routes[0];
            const leg = route.legs[0];
            
            const routeData = {
                start_address: leg.start_address,
                end_address: leg.end_address,
                start_lat: leg.start_location.lat(),
                start_lng: leg.start_location.lng(),
                end_lat: leg.end_location.lat(),
                end_lng: leg.end_location.lng(),
                distance: leg.distance.value / 1000,
                duration: leg.duration.value / 60
            };

            fetch('/harita/save-route-history/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(routeData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Rota başarıyla kaydedildi:', data);
                // Başarılı kayıt sonrası temizleme işlemleri
                directionsRenderer.setMap(null);
                directionsRenderer = null;
                document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
                document.getElementById('searchBox1').value = '';
                document.getElementById('searchBox2').value = '';
            })
            .catch(error => {
                console.error('Rota kaydetme hatası:', error);
                alert('Rota kaydedilirken bir hata oluştu');
            });
        }
    }

    // Tüm marker'ları temizle
    clearMarkers(); // Mevcut marker'ları temizle

    // Tıklanan konum marker'ını temizle
    if (clickedLocationMarker) {
        clickedLocationMarker.setMap(null);
        clickedLocationMarker = null;
    }

    // Kullanıcı konum marker'ını temizle
    if (userLocationMarker) {
        userLocationMarker.setMap(null);
        userLocationMarker = null;
    }

    // Trafik ile ilgili değişkenleri sıfırla
    trafficPolylines.forEach(polyline => polyline.setMap(null));
    trafficPolylines = [];
    originalRoute = null;
    trafficVisible = false;
    document.getElementById('trafficButton').classList.remove('active');
}


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

function calculateRoute() {
    // Başlangıç ve hedef konumlarını al
    const startLocation = document.getElementById('searchBox1').value;
    const endLocation = document.getElementById('searchBox2').value;

    // Eğer başlangıç veya hedef konumları boşsa, uyarı ver ve çık
    if (!startLocation || !endLocation) {
        alert('Lütfen başlangıç ve hedef konumlarını seçin');
        return;
    }

    // Haritadaki tüm marker'ları kaldır
    clearMarkers();
    
    // Eğer tıklanan bir konum marker'ı varsa, onu kaldır
    if (clickedLocationMarker) {
        clickedLocationMarker.setMap(null);
        clickedLocationMarker = null;
    }

    // Eğer daha önce bir DirectionsRenderer varsa, onu kaldır ve yenisiyle değiştir
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
    }
    
    // Yeni bir DirectionsRenderer oluştur ve haritaya ek
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        panel: document.getElementById('directionsPanel'),
        draggable: true
    });

    // Rota hesaplaması için istek oluştur
    const request = {
        origin: startLocation,
        destination: endLocation,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS
        }
    };

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(request, async function(result, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            // Menzil kontrolü yap
            const isRouteValid = await checkRouteViability(result);
            
            if (isRouteValid.viable) {
                directionsRenderer.setDirections(result);
                originalRoute = result;
                document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
                document.getElementById('toggleChargingStationsButton').style.display = 'block';
                showWeatherDataAlongRoute(result);
            } else {
                // Şarj istasyonu önerisi
                handleChargingStationSuggestion(result, isRouteValid.requiredStops);
            }
        } else {
            alert('Rota hesaplanamadı: ' + status);
        }
    });
}

// Yeni fonksiyonlar ekle
async function checkRouteViability(route) {
    try {
        // Araç bilgilerini almak için URL
        const response = await fetch('/harita/user_car_info/');
        // Kullanıcının araç bilgilerini al
        const carInfoResponse = await fetch('/harita/user_car_info/');
        const carInfo = await carInfoResponse.json();
        const batteryLevel = parseInt(document.getElementById('batteryLevel').value) || 100;
        
        const leg = route.routes[0].legs[0];
        const totalDistance = leg.distance.value / 1000; // metre -> km
        
        // Araç menzili hesapla
        const maxRange = carInfo.average_range || 350;
        const actualRange = (maxRange * batteryLevel) / 100;
        
        console.log(`Rota mesafesi: ${totalDistance}km, Araç menzili: ${actualRange}km`);
        
        if (totalDistance <= actualRange) {
            // Menzil yeterli, şarj istasyonu gerekmiyor
            return { viable: true, remainingRange: actualRange - totalDistance };
        } else {
            // Kaç şarj istasyonu gerekecek hesapla
            let remainingDistance = totalDistance - actualRange;
            const fullChargeRange = (maxRange * 80) / 100; // %80 şarj ile menzil
            const requiredStops = Math.ceil(remainingDistance / fullChargeRange);
            
            console.log(`Yetersiz menzil. Gereken şarj durağı sayısı: ${requiredStops}`);
            return { viable: false, requiredStops };
        }
    } catch (error) {
        console.error('Rota kontrol hatası:', error);
        return { viable: false, error: 'Rota kontrolü yapılamadı' };
    }
}

async function calculateTrafficImpact(routeLeg) {
    let trafficImpact = 1.0;
    
    if (routeLeg.duration_in_traffic && routeLeg.duration) {
        const trafficRatio = routeLeg.duration_in_traffic.value / routeLeg.duration.value;
        
        // Trafik yoğunluğuna göre menzil etkisi:
        if (trafficRatio > 1.8) trafficImpact = 0.7;  // %30 azalma
        else if (trafficRatio > 1.5) trafficImpact = 0.8;  // %20 azalma
        else if (trafficRatio > 1.2) trafficImpact = 0.9;  // %10 azalma
        else if (trafficRatio > 1.0) trafficImpact = 0.95; // %5 azalma
    }
    
    return trafficImpact;
}

async function calculateWeatherImpact(routeLeg) {
    const weatherData = await getWeatherData(routeLeg.start_location);
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
}

async function handleChargingStationSuggestion(route, requiredStops) {
    try {
        const stations = await findOptimalChargingStations(
            route.routes[0].legs[0].start_location,
            route.routes[0].legs[0].end_location,
            requiredStops
        );

        // Mevcut dialog'ları temizle
        const existingDialog = document.querySelector('.custom-dialog-overlay');
        if (existingDialog) {
            existingDialog.remove();
        }

        // Dialog HTML'i oluştur
        const dialogHTML = `
            <div class="custom-dialog-overlay">
                <div class="custom-dialog">
                    <div class="dialog-header">
                        <i class="dialog-icon">⚡</i>
                        <h3>Şarj Durumu Uyarısı</h3>
                    </div>
                    <div class="dialog-content">
                        <p class="dialog-message">Mevcut şarj seviyesi ile hedefe ulaşmanız mümkün değil.</p>
                        <div class="stations-list">
                            <p class="list-title">Önerilen şarj istasyonu durakları:</p>
                            ${stations.map((station, index) => `
                                <div class="station-item">
                                    <span class="station-number">${index + 1}.</span>
                                    <span class="station-name">${station.name}</span>
                                    <span class="station-distance">(${station.distance.toFixed(1)} km)</span>
                                </div>
                            `).join('')}
                        </div>
                        <p class="dialog-question">Bu rotayı kullanmak ister misiniz?</p>
                        <div class="dialog-buttons">
                            <button class="dialog-button confirm-btn">Tamam</button>
                            <button class="dialog-button cancel-btn">İptal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Dialog'u sayfaya ekle
        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        // Kullanıcının seçimini bekle
        return new Promise((resolve) => {
            const dialog = document.querySelector('.custom-dialog-overlay');
            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            confirmBtn.addEventListener('click', () => {
                dialog.remove();
                
                // Şarj istasyonlarını waypoint olarak ekle
                const waypoints = stations.map(station => ({
                    location: new google.maps.LatLng(
                        parseFloat(station.latitude),
                        parseFloat(station.longitude)
                    ),
                    stopover: true
                }));

                // Rotayı yeniden hesapla
                recalculateRouteWithWaypoints(waypoints);

                // Şarj istasyonlarını haritada göster
                stations.forEach(station => {
                    const marker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            parseFloat(station.latitude),
                            parseFloat(station.longitude)
                        ),
                        map: map,
                        icon: {
                            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                        },
                        title: station.name
                    });
                    markers.push(marker);
                });
            });

            cancelBtn.addEventListener('click', () => {
                dialog.remove();
                // İptal edilirse orijinal rotayı göster
                directionsRenderer.setDirections(route);
                showWeatherDataAlongRoute(route);
                document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
                document.getElementById('toggleChargingStationsButton').style.display = 'block';
            });
        });

    } catch (error) {
        console.error('Şarj istasyonu önerisi oluşturulamadı:', error);
        
        // Hata durumunda özel hata dialog'u göster
        const errorDialogHTML = `
            <div class="custom-dialog-overlay">
                <div class="custom-dialog error">
                    <div class="dialog-header">
                        <i class="dialog-icon">⚠️</i>
                        <h3>Hata</h3>
                    </div>
                    <div class="dialog-content">
                        <p class="dialog-message">Uygun şarj istasyonu bulunamadı. Lütfen farklı bir rota deneyin.</p>
                        <div class="dialog-buttons">
                            <button class="dialog-button error-btn">Tamam</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', errorDialogHTML);
        
        // Hata dialog'unu kapat
        const errorDialog = document.querySelector('.custom-dialog-overlay');
        const errorBtn = errorDialog.querySelector('.error-btn');
        errorBtn.addEventListener('click', () => {
            errorDialog.remove();
        });
    }
}

// Yeni fonksiyon: Rota üzerindeki şarj istasyonlarını göster
function showChargingStationsOnRoute() {
    const directions = directionsRenderer.getDirections();
    if (directions && directions.routes.length > 0) {
        const route = directions.routes[0];
        const waypoints = route.overview_path;
        const searchPoints = [];
        const intervalCount = 5;
        
        for (let i = 0; i < intervalCount; i++) {
            const index = Math.floor(waypoints.length * (i / (intervalCount - 1)));
            const point = waypoints[index];
            searchPoints.push({
                lat: () => point.lat(),
                lng: () => point.lng()
            });
        }
        
        searchPoints.forEach(point => {
            fetch(`/harita/get-nearby-charging-stations/?lat=${point.lat()}&lng=${point.lng()}`)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => {
                    if (data.stations && Array.isArray(data.stations)) {
                        data.stations.forEach(station => {
                            const marker = new google.maps.Marker({
                                position: { 
                                    lat: parseFloat(station.latitude), 
                                    lng: parseFloat(station.longitude) 
                                },
                                map: map,
                                title: station.name,
                                icon: {
                                    url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                                }
                            });

                            // Şarj istasyonu için info window
                            const infoWindow = new google.maps.InfoWindow({
                                content: `
                                    <div class="station-info-window">
                                        <div class="info-header">
                                            <h3>${station.name}</h3>
                                        </div>
                                        <div class="info-content">
                                            <p class="info-address">${station.vicinity || ''}</p>
                                            <p class="info-coordinates">Konum: ${station.latitude}, ${station.longitude}</p>
                                            ${station.rating ? `<p class="info-rating">⭐ ${station.rating}</p>` : ''}
                                            <div class="info-buttons">
                                                <button onclick="showNearbyRestaurants(${station.latitude}, ${station.longitude}, '${station.place_id}')">
                                                    🍽️ Restoranları Göster
                                                </button>
                                                <button onclick="addWaypoint(${station.latitude}, ${station.longitude}, '${station.name}')">
                                                    📍 Durak Ekle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `
                            });

                            // Info window stil ayarları
                            google.maps.event.addListener(infoWindow, 'domready', function() {
                                const iwOuter = document.querySelector('.gm-style-iw');
                                if (iwOuter) {
                                    iwOuter.parentElement.style.backgroundColor = 'transparent';
                                    iwOuter.style.padding = '0';
                                    
                                    // Kapatma butonunu özelleştir
                                    const closeButton = iwOuter.nextElementSibling;
                                    if (closeButton) {
                                        closeButton.style.opacity = '1';
                                        closeButton.style.right = '5px';
                                        closeButton.style.top = '5px';
                                        closeButton.style.border = 'none';
                                    }
                                }
                            });

                            marker.addListener('click', () => {
                                if (currentInfoWindow) {
                                    currentInfoWindow.close();
                                }
                                infoWindow.open(map, marker);
                                currentInfoWindow = infoWindow;
                                
                                // Önceki restoran marker'larını temizle
                                clearRestaurantMarkers();
                            });

                            markers.push(marker);
                        });
                    }
                })
                .catch(error => {
                    console.error('Şarj istasyonları yüklenirken hata:', error);
                });
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleChargingStationsButton');
    toggleButton.addEventListener('click', function() {
        if (chargingStationsVisible) {
            // Tüm şarj istasyonu marker'larını temizle
            markers.forEach(marker => {
                if (marker.icon && marker.icon.url && marker.icon.url.includes('green-dot.png')) {
                    marker.setMap(null);
                }
            });
            // Yeşil marker'ları markers dizisinden kaldır
            markers = markers.filter(marker => 
                !(marker.icon && marker.icon.url && marker.icon.url.includes('green-dot.png'))
            );
            chargingStationsVisible = false;
        } else {
            showChargingStationsOnRoute();
            chargingStationsVisible = true;
        }
    });
});

function addWaypoint(lat, lng, name) {
    const directions = directionsRenderer.getDirections();
    if (!directions) {
        alert('Önce bir rota oluşturmanız gerekmektedir.');
        return;
    }

    // Mevcut rotadaki tüm durakları al
    const route = directions.routes[0];
    const legs = route.legs;
    const waypoints = [];
    const newPoint = new google.maps.LatLng(lat, lng);

    // En yakın durakları bul
    let minDistance = Infinity;
    let insertIndex = 0;

    // Başlangıç noktasını kontrol et
    const startPoint = legs[0].start_location;
    let distance = google.maps.geometry.spherical.computeDistanceBetween(startPoint, newPoint);
    if (distance < minDistance) {
        minDistance = distance;
        insertIndex = 0;
    }

    // Ara durakları kontrol et
    for (let i = 0; i < legs.length; i++) {
        const endPoint = legs[i].end_location;
        distance = google.maps.geometry.spherical.computeDistanceBetween(endPoint, newPoint);
        if (distance < minDistance) {
            minDistance = distance;
            insertIndex = i + 1;
        }
        
        if (i < legs.length - 1) {
            waypoints.push({
                location: endPoint,
                stopover: true
            });
        }
    }

    // Yeni durağı uygun konuma ekle
    waypoints.splice(insertIndex, 0, {
        location: newPoint,
        stopover: true
    });

    // Rotayı yeniden hesapla
    const request = {
        origin: document.getElementById('searchBox1').value,
        destination: document.getElementById('searchBox2').value,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
    };

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            
            // Info window'u kapat
            if (currentInfoWindow) {
                currentInfoWindow.close();
            }

            // Kullanıcıya bilgi ver
            alert(`${name} durağı rotanıza eklendi.`);
        } else {
            alert('Durak eklenirken bir hata oluştu: ' + status);
        }
    });
}

// Kullanıcı konumunu alma fonksiyonu
function getUserLocation() {
    if (!navigator.geolocation) {
        alert('Tarayıcınız konum servisini desteklemiyor.');
        return;
    }

    // Konum alınırken butonu devre dışı bırak
    const getLocationButton = document.getElementById('getLocationButton');
    if (getLocationButton) {
        getLocationButton.disabled = true;
        getLocationButton.textContent = 'Konum Alınıyor...';
    }

    navigator.geolocation.getCurrentPosition(
        // Başarılı olma durumu
        (position) => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Önceki kullanıcı konum marker'ını temizle
            if (userLocationMarker) {
                userLocationMarker.setMap(null);
            }

            // Yeni marker oluştur
            userLocationMarker = new google.maps.Marker({
                position: userLocation,
                map: map,
                title: 'Konumunuz',
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                }
            });
            // Haritayı kullanıcı konumuna merkezle
            map.setCenter(userLocation);
            map.setZoom(15);

            // Konum bilgisini arama kutusuna ekle
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: userLocation }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    document.getElementById('searchBox1').value = results[0].formatted_address;
                } else {
                    document.getElementById('searchBox1').value = `${userLocation.lat}, ${userLocation.lng}`;
                }
            });

            // Butonu normal haline getir
            if (getLocationButton) {
                getLocationButton.disabled = false;
                getLocationButton.textContent = 'Konumu Al';
            }
        },
        // Hata durumu
        (error) => {
            let errorMessage = 'Konum alınamadı: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Konum izni reddedildi.';
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
            alert(errorMessage);

            // Butonu normal haline getir
            if (getLocationButton) {
                getLocationButton.disabled = false;
                getLocationButton.textContent = 'Konumu Al';
            }
        },
        // Seçenekler
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

// Info window içeriği oluşturma fonksiyonu
function createStationInfoWindow(station) {
    const template = document.getElementById('station-info-template');
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.station-name').textContent = station.name;
    clone.querySelector('.station-vicinity').textContent = station.vicinity || '';
    clone.querySelector('.station-rating').textContent = `Rating: ${station.rating || 'N/A'}`;
    
    const addWaypointBtn = clone.querySelector('.add-waypoint-btn');
    addWaypointBtn.onclick = () => addWaypoint(station.latitude, station.longitude, station.name);
    
    const showRestaurantsBtn = clone.querySelector('.show-restaurants-btn');
    showRestaurantsBtn.onclick = () => showNearbyRestaurants(station.latitude, station.longitude, station.place_id);
    
    return clone;
}

function createRestaurantInfoWindow(restaurant, stationAddress) {
    const template = document.getElementById('restaurant-info-template');
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.restaurant-name').textContent = restaurant.name;
    clone.querySelector('.restaurant-vicinity').textContent = restaurant.vicinity || '';
    
    const createRouteBtn = clone.querySelector('.create-route-btn');
    createRouteBtn.onclick = () => selectRestaurantAsDestination(stationAddress, `${restaurant.name}, ${restaurant.vicinity}`);
    
    return clone;
}

// Buton loading durumu için yardımcı fonksiyon
function setButtonLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('button-disabled');
        button.textContent = 'Yükleniyor...';
    } else {
        button.disabled = false;
        button.classList.remove('button-disabled');
        button.textContent = originalText;
    }
}

function toggleTraffic() {
    if (!map || !directionsRenderer || !directionsRenderer.getDirections()) {
        alert('Önce bir rota oluşturunuz.');
        return;
    }

    try {
        // Eğer durak eklenmiş bir rota varsa, onu kullan
        const currentRoute = directionsRenderer.getDirections();
        if (currentRoute) {
            originalRoute = currentRoute; // Mevcut rotayı orijinal rota olarak ayarla
        }

        const routes = originalRoute.routes[0];
        
        if (trafficVisible) {
            // Trafik görünümünden normal görünüme geç
            trafficPolylines.forEach(polyline => polyline.setMap(null));
            trafficPolylines = [];
            directionsRenderer.setMap(map);
            directionsRenderer.setDirections(originalRoute);
            document.getElementById('trafficButton').classList.remove('active');
            document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
        } else {
            // Normal görünümden trafik görünümüne geç
            directionsRenderer.setMap(null);
            
            // Tüm rota bacakları için trafik bilgilerini topla
            let totalNormalDuration = 0;
            let totalTrafficDuration = 0;
            let trafficInfoHTML = '<div class="directions-panel-section"><h4>Trafik Bilgileri</h4><div class="panel-content">';
            
            // Her bir rota bacağı için trafik bilgilerini hesapla
            const processLegs = async () => {
                for (let i = 0; i < routes.legs.length; i++) {
                    const leg = routes.legs[i];
                    totalNormalDuration += leg.duration.value;
                    
                    // Her adım için trafik durumunu kontrol et
                    for (const step of leg.steps) {
                        const trafficInfo = await getTrafficInfo(step);
                        const color = getTrafficColor(trafficInfo.congestion);
                        
                        const polyline = new google.maps.Polyline({
                            path: step.path,
                            strokeColor: color,
                            strokeWeight: 6,
                            strokeOpacity: 0.8,
                            map: map,
                            zIndex: 1
                        });
                        
                        trafficPolylines.push(polyline);
                        
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
                </div></div>`;
                
                document.getElementById('directionsPanel').innerHTML = trafficInfoHTML;
            };
            
            processLegs();
            document.getElementById('trafficButton').classList.add('active');
        }

        trafficVisible = !trafficVisible;

    } catch (error) {
        console.error('Trafik katmanı değiştirme hatası:', error);
        alert('Trafik bilgisi gösterilirken bir hata oluştu.');
    }
}

// getTrafficInfo fonksiyonunu güncelle
async function getTrafficInfo(step) {
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

// Trafik yoğunluğuna göre renk belirleme
function getTrafficColor(congestion) {
    const colors = {
        very_heavy: '#8B0000', // Koyu kırmızı
        heavy: '#FF0000',      // Kırmızı
        medium: '#FFA500',     // Turuncu
        light: '#008000',      // Yeşil
        unknown: '#808080'     // Gri
    };
    return colors[congestion] || colors.unknown;
}
// Hava durumu verilerini gösteren fonksiyon
async function showWeatherDataAlongRoute(route) {
    try {
        const leg = route.routes[0].legs[0];
        let weatherEffect = 1.0;
        let trafficEffect = 1.0;

        // Rota üzerindeki hava durumu verilerini al
        const weatherData = await getWeatherData(leg.start_location);
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

        return totalEffect;

    } catch (error) {
        console.error('Hava durumu ve trafik analizi yapılırken hata oluştu:', error);
        return 1.0; // Hata durumunda etkiyi 1 (etkisiz) olarak döndür
    }
}

// Konuma yakınlaşma fonksiyonu
function zoomToLocation(lat, lng) {
    map.setCenter({ lat, lng });
    map.setZoom(16);
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }
}

// getBatteryLevel fonksiyonunu ekle
async function getBatteryLevel() {
    const batteryLevel = parseInt(document.getElementById('batteryLevel').value) || 100;
    return batteryLevel;
}

// calculateRequiredChargingStops fonksiyonunu ekle
function calculateRequiredChargingStops(totalDistance, actualRange) {
    const stops = Math.ceil(totalDistance / actualRange) - 1;
    return Math.max(0, stops);
}

// findOptimalChargingStations fonksiyonunda değişiklik yapalım
async function findOptimalChargingStations(startLocation, endLocation, requiredStops) {
    try {
        const lat1 = startLocation.lat();
        const lng1 = startLocation.lng();
        const lat2 = endLocation.lat();
        const lng2 = endLocation.lng();
        
        // Kullanıcı şarj seviyesi ve araç bilgilerini al
        const batteryLevel = parseInt(document.getElementById('batteryLevel').value) || 100;
        const response = await fetch('/harita/user_car_info/');
        const carInfo = await response.json();
        
        const maxRange = carInfo.average_range || 350;
        const initialRange = (maxRange * batteryLevel) / 100;
        const fullChargeRange = (maxRange * 80) / 100;

        // Önce ana rotayı hesapla
        const directionsService = new google.maps.DirectionsService();
        const mainRoute = await new Promise((resolve, reject) => {
            directionsService.route({
                origin: new google.maps.LatLng(lat1, lng1),
                destination: new google.maps.LatLng(lat2, lng2),
                travelMode: google.maps.TravelMode.DRIVING
            }, (response, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    resolve(response);
                } else {
                    reject(status);
                }
            });
        });

        const totalDistance = mainRoute.routes[0].legs[0].distance.value / 1000;
        
        console.log(`Rota analizi başlıyor:
            - Araç: ${carInfo.car_name}
            - Maksimum menzil: ${maxRange} km
            - Mevcut şarj: %${batteryLevel}
            - Mevcut menzil: ${initialRange} km
            - Toplam mesafe: ${totalDistance} km`);

        // Eğer araç menzili tüm rotayı karşılıyorsa durak gerekmez
        if (initialRange >= totalDistance) {
            return [];
        }

        // Rota noktalarını al
        const routePolyline = mainRoute.routes[0].overview_polyline;
        const decodedPath = google.maps.geometry.encoding.decodePath(routePolyline);
        
        // Rotayı 1 km'lik segmentlere böl (daha hassas mesafe takibi için)
        const routeSegments = [];
        let cumulativeDistance = 0;
        
        for (let i = 1; i < decodedPath.length; i++) {
            const segmentDistance = google.maps.geometry.spherical.computeDistanceBetween(
                decodedPath[i-1], decodedPath[i]) / 1000;
            
            cumulativeDistance += segmentDistance;
            routeSegments.push({
                point: decodedPath[i],
                cumulativeDistance: cumulativeDistance
            });
        }

        const stations = [];
        let currentRange = initialRange;
        let currentPosition = new google.maps.LatLng(lat1, lng1);
        let totalTraveled = 0;

        // Ana döngü: Tüm rota boyunca şarj istasyonlarını belirle
        while (totalTraveled < totalDistance) {
            // Güvenli sürüş mesafesi (menzili %20 kalana kadar kullan)
            const safeRange = currentRange * 0.8;
            
            // Rotada gidilebilecek maksimum mesafeyi bul
            let targetSegment = null;
            for (const segment of routeSegments) {
                // Henüz ulaşılmayan ve menzil içindeki segment mi?
                if (segment.cumulativeDistance > totalTraveled && 
                    segment.cumulativeDistance - totalTraveled <= safeRange) {
                    targetSegment = segment;
                } else if (segment.cumulativeDistance > totalTraveled + safeRange) {
                    // Menzil dışına çıkıldı, önceki segmentte dur
                    break;
                }
            }
            
            if (!targetSegment) {
                // Varış noktasına erişilebildi
                break;
            }
            
            const targetDistance = targetSegment.cumulativeDistance - totalTraveled;
            const targetPoint = targetSegment.point;
            
            console.log(`Şarj istasyonu arama:
                - Kalan menzil: ${currentRange.toFixed(1)} km
                - Güvenli mesafe: ${safeRange.toFixed(1)} km
                - Hedef mesafe: ${targetDistance.toFixed(1)} km`);
            
            // Bu noktaya yakın şarj istasyonlarını ara
            const searchRadius = 30000; // 30 km yarıçap
            const response = await fetch(
                `/harita/get-nearby-charging-stations/?lat=${targetPoint.lat()}&lng=${targetPoint.lng()}&radius=${searchRadius}`
            );
            const data = await response.json();
            
            if (!data.stations || data.stations.length === 0) {
                throw new Error("Bu bölgede şarj istasyonu bulunamadı!");
            }
            
            // Her şarj istasyonu için gerçek rota mesafesini hesapla
            const stationCandidates = [];
            
            for (const station of data.stations) {
                const stationPoint = new google.maps.LatLng(
                    parseFloat(station.latitude), 
                    parseFloat(station.longitude)
                );
                
                // Gerçek rota üzerinden mesafe hesapla
                try {
                    const routeToStation = await new Promise((resolve, reject) => {
                        directionsService.route({
                            origin: currentPosition,
                            destination: stationPoint,
                            travelMode: google.maps.TravelMode.DRIVING
                        }, (response, status) => {
                            if (status === google.maps.DirectionsStatus.OK) {
                                resolve(response);
                            } else {
                                reject(status);
                            }
                        });
                    });
                    
                    const realDistance = routeToStation.routes[0].legs[0].distance.value / 1000;
                    
                    // Menzil içinde ve en az 50 km mesafede
                    if (realDistance <= currentRange && realDistance >= Math.min(50, currentRange * 0.2)) {
                        stationCandidates.push({
                            ...station,
                            distance: realDistance,
                            point: stationPoint
                        });
                    }
                } catch (error) {
                    console.warn(`Rota hesaplama hatası: ${error}`);
                    // Hata durumunda düz çizgi mesafesini kullan
                    const directDistance = google.maps.geometry.spherical.computeDistanceBetween(
                        currentPosition, stationPoint) / 1000;
                    
                    if (directDistance <= currentRange * 0.7) { // Düz çizgi için güvenlik faktörü
                        stationCandidates.push({
                            ...station,
                            distance: directDistance * 1.3, // Gerçek yol faktörü
                            point: stationPoint,
                            isEstimated: true
                        });
                    }
                }
            }
            
            // Uygun istasyon bulunamadıysa hata döndür
            if (stationCandidates.length === 0) {
                throw new Error("Menzil içinde şarj istasyonu bulunamadı!");
            }
            
            // En optimal istasyonu seç: Optimizasyon kriteri olarak
            // ilerleme yüzdesi / mesafe oranını kullan (en verimli ilerleme)
            stationCandidates.sort((a, b) => {
                // İlerleme yüzdesi (toplam mesafeye göre)
                const progressA = (totalTraveled + a.distance) / totalDistance;
                const progressB = (totalTraveled + b.distance) / totalDistance;
                
                // Mesafe başına ilerleme
                const efficiencyA = progressA / a.distance;
                const efficiencyB = progressB / b.distance;
                
                return efficiencyB - efficiencyA;
            });
            
            const selectedStation = stationCandidates[0];
            
            // Seçilen istasyondan sonra varış noktasına kalan mesafeyi hesapla
            const remainingToDestination = totalDistance - (totalTraveled + selectedStation.distance);
            
            // Eğer kalan mesafe mevcut menzilin %30'undan azsa ve doğrudan varış noktasına gidilebiliyorsa
            // son şarj istasyonunu ekleme
            if (remainingToDestination <= currentRange * 0.3) {
                console.log(`Son şarj istasyonu atlanıyor:
                    - Seçilen istasyon: ${selectedStation.name}
                    - Varış noktasına kalan: ${remainingToDestination.toFixed(1)} km
                    - Mevcut menzil: ${currentRange} km
                    - Doğrudan varışa gidilebilir`);
                break;
            }

            console.log(`Şarj istasyonu seçildi:
                - İsim: ${selectedStation.name}
                - Mesafe: ${selectedStation.distance.toFixed(1)} km
                - ${selectedStation.isEstimated ? '(Tahmini mesafe)' : '(Gerçek rota mesafesi)'}`);
            
            stations.push(selectedStation);
            
            // Konum ve menzil bilgilerini güncelle
            currentPosition = selectedStation.point;
            totalTraveled += selectedStation.distance;
            currentRange = fullChargeRange;
            
            console.log(`Durum güncellendi:
                - Kat edilen toplam mesafe: ${totalTraveled.toFixed(1)} km
                - Yeni şarj sonrası menzil: ${currentRange} km
                - Varışa kalan mesafe: ${(totalDistance - totalTraveled).toFixed(1)} km`);

            // Eğer kalan mesafe mevcut menzilden azsa, döngüyü sonlandır
            if (totalDistance - totalTraveled <= currentRange) {
                console.log(`Hedef menzil içerisinde, başka şarj istasyonu gerekmez:
                    - Kalan mesafe: ${(totalDistance - totalTraveled).toFixed(1)} km
                    - Mevcut menzil: ${currentRange} km`);
                break;
            }
        }

        // Son bir kontrol daha yap - eğer son istasyon varışa çok yakınsa kaldır
        if (stations.length > 0) {
            const lastStation = stations[stations.length - 1];
            const finalDistance = totalDistance - totalTraveled;
            
            if (finalDistance <= currentRange * 0.3) { // Son %30'luk mesafe içindeyse
                console.log(`Son istasyon kaldırılıyor:
                    - Kaldırılan istasyon: ${lastStation.name}
                    - Varışa kalan mesafe: ${finalDistance.toFixed(1)} km
                    - Mevcut menzil: ${currentRange} km`);
                stations.pop(); // Son istasyonu kaldır
            }
        }

        console.log(`Rota planlaması tamamlandı:
            - Toplam şarj istasyonu sayısı: ${stations.length}
            - Toplam mesafe: ${totalDistance.toFixed(1)} km`);
        
        return stations;
        
    } catch (error) {
        console.error('Şarj istasyonları hesaplanırken hata oluştu:', error);
        throw error;
    }
}

// recalculateRouteWithWaypoints fonksiyonunu ekle
function recalculateRouteWithWaypoints(waypoints) {
    const request = {
        origin: document.getElementById('searchBox1').value,
        destination: document.getElementById('searchBox2').value,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
    };

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(request, function(result, status) {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            showWeatherDataAlongRoute(result);
        } else {
            alert('Rota hesaplanamadı: ' + status);
        }
    });
}

// getWeatherData fonksiyonunu ekle
async function getWeatherData(location) {
    const response = await fetch(`/harita/get-weather/?lat=${location.lat()}&lng=${location.lng()}`);
    if (!response.ok) {
        throw new Error('Hava durumu verisi alınamadı');
    }
    return response.json();
}


