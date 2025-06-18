class AppManager {
  constructor() {
    this.mapManager = null
    this.routeManager = null
    this.chargingStationManager = null
    this.weatherManager = null
    this.restaurantManager = null
    this.eventManager = null

    // Her modülü başlat
    this.init()
  }

  init() {
    // Harita yöneticisini başlat
    this.mapManager = new MapManager("map")

    // Diğer yöneticileri başlat
    this.routeManager = new RouteManager(this.mapManager)
    this.chargingStationManager = new ChargingStationManager(this.mapManager)
    this.weatherManager = new WeatherManager()
    this.restaurantManager = new RestaurantManager(this.mapManager)
    this.eventManager = new EventSuggestionsManager()

    // Arama kutuları
    this.searchBox1 = this.mapManager.createSearchBox("searchBox1")
    this.searchBox2 = this.mapManager.createSearchBox("searchBox2")

    // Harita tıklama olayı için bağlantı oluştur
    this.mapManager.setMapClickCallback((location) => {
      this.chargingStationManager.searchNearbyChargingStations(location)
    })

    // Olay dinleyicilerini ekle
    this.setupEventListeners()
  }

  setupEventListeners() {
    // Butonlar için olay dinleyicileri
    const routeButton = document.getElementById("routeButton")
    const clearButton = document.getElementById("clearButton")
    const trafficButton = document.getElementById("trafficButton")
    const toggleChargingStationsButton = document.getElementById("toggleChargingStationsButton")
    const getLocationButton = document.getElementById("getLocationButton")
    const suggestActivitiesButton = document.getElementById("suggestActivitiesButton")

    if (routeButton) {
      routeButton.addEventListener("click", () => this.calculateRoute())
    }

    if (clearButton) {
      clearButton.addEventListener("click", () => this.clearMap())
    }

    if (trafficButton) {
      trafficButton.addEventListener("click", () => this.toggleTraffic())
    }

    if (toggleChargingStationsButton) {
      toggleChargingStationsButton.addEventListener("click", () => this.toggleChargingStations())
    }

    if (getLocationButton) {
      getLocationButton.addEventListener("click", () => this.getUserLocation())
    }

    // Etkinlik Önerisi butonu
    if (suggestActivitiesButton) {
      suggestActivitiesButton.style.display = "none" // Başlangıçta gizle
      suggestActivitiesButton.addEventListener("click", () => this.getSuggestedActivities())
    }

    // Global fonksiyonlar için bağlantılar
    window.showNearbyRestaurants = (lat, lng, stationId) => {
      this.restaurantManager.showNearbyRestaurants(lat, lng, stationId)
    }

    window.addWaypoint = (lat, lng, name) => {
      this.routeManager
        .addWaypoint({ lat, lng }, name)
        .then((stationName) => {
          alert(`${stationName} durağı rotanıza eklendi.`)
        })
        .catch((error) => {
          alert("Durak eklenirken bir hata oluştu: " + error.message)
        })
    }

    window.selectRestaurantAsDestination = (stationAddress, restaurantAddress) => {
      this.restaurantManager.selectRestaurantAsDestination(stationAddress, restaurantAddress, this.routeManager)
    }
  }

  // Yardımcı metod: Buton durumunu güncelle
  updateButtonState(buttonId, isLoading, loadingText, defaultText) {
    const button = document.getElementById(buttonId)
    if (button) {
      button.disabled = isLoading
      button.innerHTML = isLoading ? loadingText : defaultText
    }
  }

  // Yardımcı metod: Hata mesajı göster
  showError(message) {
    console.error(message)
    alert(message)
  }

  // Yardımcı metod: Başarı mesajı göster
  showSuccess(message) {
    console.log(message)
    alert(message)
  }

  // Yardımcı metod: Rota sonuçlarını işle
  async processRouteResults(result) {
    try {
      // Menzil kontrolü yap
      const isRouteValid = await this.chargingStationManager.checkRouteViability(result)

      if (isRouteValid.viable) {
        // Menzil yeterli, normal rotayı göster
        document.getElementById("toggleChargingStationsButton").style.display = "block"
        // Hava durumu verilerini göster
        const weatherData = await this.weatherManager.showWeatherDataAlongRoute(result)
        this.weatherManager.displayWeatherInfo(weatherData.weatherData)

        // Geçilen şehirleri konsola yazdır ve UI'de göster
        this.routeManager.logCitiesAlongRoute()

        // Etkinlik önerisi butonunu göster
        const suggestButton = document.getElementById("suggestActivitiesButton")
        if (suggestButton) {
          suggestButton.style.display = "block"
        }
      } else {
        // Şarj istasyonu önerisi
        const suggestion = await this.chargingStationManager.handleChargingStationSuggestion(
          result,
          isRouteValid.requiredStops,
        )

        if (suggestion.accepted) {
          // Kullanıcı öneriyi kabul etti, şarj istasyonlarını ekleyerek rotayı yeniden hesapla
          const startLocation = document.getElementById("searchBox1").value
          const endLocation = document.getElementById("searchBox2").value

          const newResult = await this.routeManager.calculateRouteWithWaypoints(
            startLocation,
            endLocation,
            suggestion.waypoints,
          )

          // Yeni rotayı da analiz et
          await this.detectCitiesOnRoute(newResult)

          // Şarj istasyonlarını haritada göster
          suggestion.stations.forEach((station) => {
            this.mapManager.addMarker(
              {
                lat: Number.parseFloat(station.latitude),
                lng: Number.parseFloat(station.longitude),
              },
              station.name,
              {
                url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
              },
            )
          })

          const weatherData = await this.weatherManager.showWeatherDataAlongRoute(result)
          this.weatherManager.displayWeatherInfo(weatherData.weatherData)

          // Geçilen şehirleri konsola yazdır
          this.routeManager.logCitiesAlongRoute()

          // Etkinlik önerisi butonunu göster
          const suggestButton = document.getElementById("suggestActivitiesButton")
          if (suggestButton) {
            suggestButton.style.display = "block"
          }
        } else {
          // Kullanıcı öneriyi reddetti, orijinal rotayı göster
          document.getElementById("toggleChargingStationsButton").style.display = "block"
          const weatherData = await this.weatherManager.showWeatherDataAlongRoute(result)
          this.weatherManager.displayWeatherInfo(weatherData.weatherData)

          // Geçilen şehirleri konsola yazdır
          this.routeManager.logCitiesAlongRoute()

          // Etkinlik önerisi butonunu göster
          const suggestButton = document.getElementById("suggestActivitiesButton")
          if (suggestButton) {
            suggestButton.style.display = "block"
          }
        }
      }
    } catch (error) {
      this.showError("Rota işlenirken hata oluştu: " + error.message)
    }
  }

  async calculateRoute() {
    try {
      // Başlangıç ve hedef konumlarını al
      const startLocation = document.getElementById("searchBox1").value
      const endLocation = document.getElementById("searchBox2").value

      // Eğer başlangıç veya hedef konumları boşsa, uyarı ver ve çık
      if (!startLocation || !endLocation) {
        this.showError("Lütfen başlangıç ve hedef konumlarını seçin")
        return
      }

      // Rotayı hesapla
      const result = await this.routeManager.calculateRoute(startLocation, endLocation)

      // Rota sonucunu doğrudan analiz et ve geçilen şehirleri belirle
      await this.detectCitiesOnRoute(result)

      // Rota sonuçlarını işle
      await this.processRouteResults(result)
    } catch (error) {
      this.showError("Rota hesaplanamadı: " + error.message)
    }
  }

  async clearMap() {
    try {
      // Mevcut bir rota varsa kaydet
      if (this.routeManager.directionsRenderer && this.routeManager.directionsRenderer.getDirections()) {
        await this.routeManager
          .saveRoute()
          .then((data) => {
            console.log("Rota başarıyla kaydedildi:", data)
          })
          .catch((error) => {
            console.error("Rota kaydedilemedi:", error)
          })
      }

      // Haritadaki tüm işaretçileri temizle
      this.mapManager.clearMarkers()

      // Şarj istasyonu işaretçilerini temizle
      this.chargingStationManager.clearStationMarkers()

      // Restoran işaretçilerini temizle
      this.restaurantManager.clearRestaurantMarkers()

      // Rotayı temizle
      this.routeManager.clearRoute()

      // Arama kutularını temizle
      document.getElementById("searchBox1").value = ""
      document.getElementById("searchBox2").value = ""

      // Tıklanan konum işaretçisini temizle
      if (this.mapManager.clickedLocationMarker) {
        this.mapManager.clickedLocationMarker.setMap(null)
        this.mapManager.clickedLocationMarker = null
      }

      // Kullanıcı konum işaretçisini temizle
      if (this.mapManager.userLocationMarker) {
        this.mapManager.userLocationMarker.setMap(null)
        this.mapManager.userLocationMarker = null
      }

      // Trafik ile ilgili değişkenleri sıfırla
      this.routeManager.trafficPolylines.forEach((polyline) => polyline.setMap(null))
      this.routeManager.trafficPolylines = []
      this.routeManager.originalRoute = null
      this.routeManager.trafficVisible = false

      if (document.getElementById("trafficButton")) {
        document.getElementById("trafficButton").classList.remove("active")
      }

      // Etkinlik önerisi butonunu gizle
      if (document.getElementById("suggestActivitiesButton")) {
        document.getElementById("suggestActivitiesButton").style.display = "none"
      }

      // Hava durumu panelini temizle
      document.getElementById("weatherInfo").innerHTML = ""

      return true
    } catch (error) {
      console.error("Harita temizlenirken hata:", error)
      alert("Harita temizlenirken bir hata oluştu: " + error.message)
      return false
    }
  }

  async toggleTraffic() {
    try {
      await this.routeManager.toggleTraffic()
    } catch (error) {
      console.error("Trafik görünümü değiştirilirken hata:", error)
      alert("Trafik görünümü değiştirilirken bir hata oluştu: " + error.message)
    }
  }

  async toggleChargingStations() {
    try {
      const toggleBtn = document.getElementById("toggleChargingStationsButton")
      if (toggleBtn) toggleBtn.disabled = true

      // Rota kontrolü
      if (!this.routeManager.directionsRenderer || !this.routeManager.directionsRenderer.getDirections()) {
        alert("Önce bir rota oluşturmanız gerekmektedir.")
        if (toggleBtn) toggleBtn.disabled = false
        return
      }

      const route = this.routeManager.directionsRenderer.getDirections()

      // Route nesnesi güvenlik kontrolü
      if (
        !route ||
        !route.routes ||
        route.routes.length === 0 ||
        !route.routes[0].legs ||
        route.routes[0].legs.length === 0
      ) {
        alert("Geçerli bir rota bulunamadı. Lütfen yeni bir rota oluşturun.")
        if (toggleBtn) toggleBtn.disabled = false
        return
      }

      const result = this.chargingStationManager.toggleChargingStations(route)

      if (toggleBtn) {
        toggleBtn.disabled = false

        // Buton durumuna göre metin değiştirme
        if (this.chargingStationManager.chargingStationsVisible) {
          toggleBtn.textContent = "Şarj İstasyonlarını Gizle"
          toggleBtn.classList.add("active")
        } else {
          toggleBtn.textContent = "Şarj İstasyonlarını Göster"
          toggleBtn.classList.remove("active")
        }
      }

      return result
    } catch (error) {
      console.error("Şarj istasyonları görünümü değiştirilirken hata:", error)
      alert("Şarj istasyonları görünümü değiştirilirken bir hata oluştu.")

      // Hata durumunda butonu tekrar etkinleştir
      const toggleBtn = document.getElementById("toggleChargingStationsButton")
      if (toggleBtn) toggleBtn.disabled = false

      return false
    }
  }

  async getUserLocation() {
    try {
      const getLocationButton = document.getElementById("getLocationButton")
      if (getLocationButton) {
        getLocationButton.disabled = true
        getLocationButton.textContent = "Konum Alınıyor..."
      }

      const userLocation = await this.mapManager.getUserLocation()

      // Konum bilgisini arama kutusuna ekle
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: userLocation }, (results, status) => {
        if (status === "OK" && results[0]) {
          document.getElementById("searchBox1").value = results[0].formatted_address
        } else {
          document.getElementById("searchBox1").value = `${userLocation.lat}, ${userLocation.lng}`
        }
      })

      // Kullanıcı konumunun çevresindeki şarj istasyonlarını ara
      this.chargingStationManager.searchNearbyChargingStations(userLocation)

      if (getLocationButton) {
        getLocationButton.disabled = false
        getLocationButton.textContent = "Konumu Al"
      }

      return userLocation
    } catch (error) {
      console.error("Konum alınırken hata:", error)
      alert("Konum alınamadı: " + error.message)

      const getLocationButton = document.getElementById("getLocationButton")
      if (getLocationButton) {
        getLocationButton.disabled = false
        getLocationButton.textContent = "Konumu Al"
      }

      return null
    }
  }

  // Yeni eklenen fonksiyon: Rotada geçilen şehirleri tespit et
  async detectCitiesOnRoute(directionsResult) {
    try {
      if (!directionsResult || !directionsResult.routes || directionsResult.routes.length === 0) {
        console.error("Geçerli bir rota sonucu bulunamadı")
        return []
      }

      // RouteManager nesnesinin var olduğundan emin ol
      if (!this.routeManager) {
        console.error("RouteManager bulunamadı")
        return []
      }

      const route = directionsResult.routes[0]
      const cities = new Set()
      const debugInfo = []

      // Türkiye'deki şehir adları
      const turkishCities = [
        "Adana",
        "Adıyaman",
        "Afyonkarahisar",
        "Ağrı",
        "Amasya",
        "Ankara",
        "Antalya",
        "Artvin",
        "Aydın",
        "Balıkesir",
        "Bilecik",
        "Bingöl",
        "Bitlis",
        "Bolu",
        "Burdur",
        "Bursa",
        "Çanakkale",
        "Çankırı",
        "Çorum",
        "Denizli",
        "Diyarbakır",
        "Edirne",
        "Elazığ",
        "Erzincan",
        "Erzurum",
        "Eskişehir",
        "Gaziantep",
        "Giresun",
        "Gümüşhane",
        "Hakkari",
        "Hatay",
        "Isparta",
        "Mersin",
        "İstanbul",
        "İzmir",
        "Kars",
        "Kastamonu",
        "Kayseri",
        "Kırklareli",
        "Kırşehir",
        "Kocaeli",
        "Konya",
        "Kütahya",
        "Malatya",
        "Manisa",
        "Kahramanmaraş",
        "Mardin",
        "Muğla",
        "Muş",
        "Nevşehir",
        "Niğde",
        "Ordu",
        "Rize",
        "Sakarya",
        "Samsun",
        "Siirt",
        "Sinop",
        "Sivas",
        "Tekirdağ",
        "Tokat",
        "Trabzon",
        "Tunceli",
        "Şanlıurfa",
        "Uşak",
        "Van",
        "Yozgat",
        "Zonguldak",
        "Aksaray",
        "Bayburt",
        "Karaman",
        "Kırıkkale",
        "Batman",
        "Şırnak",
        "Bartın",
        "Ardahan",
        "Iğdır",
        "Yalova",
        "Karabük",
        "Kilis",
        "Osmaniye",
        "Düzce",
      ]

      // GEO KODLAMA İLE ŞEHİR TESPİTİ
      const geocoder = new window.google.maps.Geocoder()

      // Analiz edilecek noktalar için bir array oluştur
      const pointsToCheck = []

      console.log("[detectCitiesOnRoute] Rota analizi başlıyor...")

      // **********************
      // 1. Başlangıç ve bitiş noktalarını ekle
      // **********************
      for (const leg of route.legs) {
        pointsToCheck.push({
          location: leg.start_location,
          type: "waypoint",
          info: "Başlangıç: " + leg.start_address,
        })

        pointsToCheck.push({
          location: leg.end_location,
          type: "waypoint",
          info: "Varış: " + leg.end_address,
        })
      }

      // **********************
      // 2. Rota üzerinde düzenli aralıklarla noktalar al
      // **********************
      if (route.overview_path && route.overview_path.length > 0) {
        const path = route.overview_path
        const totalPathLength = path.length

        // Rotanın toplam uzunluğunu bulmak için her bir segmenti ölç
        let totalDistanceMeters = 0
        for (let i = 1; i < path.length; i++) {
          totalDistanceMeters += window.google.maps.geometry.spherical.computeDistanceBetween(path[i - 1], path[i])
        }

        console.log(`[detectCitiesOnRoute] Toplam rota uzunluğu: ${(totalDistanceMeters / 1000).toFixed(1)} km`)

        // Toplam rota mesafesine göre örnekleme aralığını belirle
        // Daha uzun rotalar için daha seyrek örnekleme yap
        let sampleIntervalKm
        if (totalDistanceMeters < 100000) {
          // 100 km'den kısa rotalar
          sampleIntervalKm = 25 // Her 25 km'de bir
        } else if (totalDistanceMeters < 300000) {
          // 100-300 km arası rotalar
          sampleIntervalKm = 40 // Her 40 km'de bir
        } else {
          // 300 km'den uzun rotalar
          sampleIntervalKm = 50 // Her 50 km'de bir
        }

        // Her segment için mesafeyi hesaplayıp belirli aralıklarla örnek al
        let accumulatedDistance = 0
        let lastSampleIndex = 0

        for (let i = 1; i < path.length; i++) {
          const segmentDistance =
            window.google.maps.geometry.spherical.computeDistanceBetween(path[i - 1], path[i]) / 1000 // km cinsinden

          accumulatedDistance += segmentDistance

          // Örnekleme aralığına ulaşıldığında bir nokta al
          if (accumulatedDistance >= sampleIntervalKm) {
            pointsToCheck.push({
              location: path[i],
              type: "path_sample",
              info: `Rota üzerinde örnek nokta (${i}/${totalPathLength})`,
            })

            accumulatedDistance = 0 // Mesafe sayacını sıfırla
            lastSampleIndex = i
          }
        }

        // Son nokta eklenmemişse ve yeterince uzaksa, onu da ekle
        const lastPointIndex = path.length - 1
        if (lastSampleIndex !== lastPointIndex) {
          const distanceToLast =
            window.google.maps.geometry.spherical.computeDistanceBetween(path[lastSampleIndex], path[lastPointIndex]) /
            1000

          if (distanceToLast > sampleIntervalKm * 0.5) {
            // En az aralığın yarısı kadar uzaksa
            pointsToCheck.push({
              location: path[lastPointIndex],
              type: "path_sample",
              info: `Rota sonu örnek noktası (${lastPointIndex}/${totalPathLength})`,
            })
          }
        }
      }

      // **********************
      // 3. Önemli kavşak noktalarını da ekle
      // **********************
      for (const leg of route.legs) {
        for (const step of leg.steps) {
          if (step.maneuver) {
            pointsToCheck.push({
              location: step.start_location,
              type: "maneuver",
              info: `Manevra: ${step.maneuver}`,
            })
          }
        }
      }

      // **********************
      // 4. Tüm noktaları geocode et ve şehir bilgilerini çıkar
      // **********************
      console.log(`[detectCitiesOnRoute] Rotada toplam ${pointsToCheck.length} nokta analiz edilecek`)

      // Fazla istek yapmamak için ve API limitlerini aşmamak için
      // istekleri gruplar halinde yap (aynı anda en fazla 3 istek)
      const chunkSize = 3
      const delay = 1000 // Gruplar arası 1 saniye bekle

      for (let i = 0; i < pointsToCheck.length; i += chunkSize) {
        const chunk = pointsToCheck.slice(i, i + chunkSize)
        const geocodingPromises = chunk.map((point) => this.geocodePoint(point, geocoder, turkishCities))

        try {
          // Bu gruptaki tüm istekleri paralel olarak yap
          const results = await Promise.all(geocodingPromises)

          // Sonuçları işle
          for (const result of results) {
            if (result && result.city) {
              cities.add(result.city)
              debugInfo.push(result)
            }
          }
        } catch (error) {
          console.warn("[detectCitiesOnRoute] Geocoding hatası, devam ediyor:", error)
        }

        // Google API limitini aşmamak için gecikmeli çalış
        if (i + chunkSize < pointsToCheck.length) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      // **********************
      // 5. Sonuçları kaydet ve görüntüle
      // **********************
      const citiesArray = Array.from(cities)
      if (this.routeManager && typeof this.routeManager.updateCitiesList === "function") {
        this.routeManager.detectedCities = citiesArray
        this.routeManager.updateCitiesList(citiesArray)
      }

      // Debug bilgisi
      console.log("[detectCitiesOnRoute] Tespit edilen şehirler:", citiesArray.join(", "))
      console.log("[detectCitiesOnRoute] Tespit detayları:", debugInfo)

      return citiesArray
    } catch (error) {
      console.error("[detectCitiesOnRoute] Rota şehirleri tespit edilirken hata oluştu:", error)
      return []
    }
  }

  // Bir noktanın hangi şehirde olduğunu tespit et
  async geocodePoint(point, geocoder, turkishCities) {
    return new Promise((resolve) => {
      if (!point || !point.location) {
        resolve(null)
        return
      }

      try {
        geocoder.geocode({ location: point.location }, (results, status) => {
          if (status === "OK" && results && results.length > 0) {
            // Adres bileşenlerinden il bilgisini al
            const city = this.getCityFromGeocodingResult(results[0], turkishCities)

            if (city) {
              resolve({
                city: city,
                point_type: point.type,
                info: point.info,
                location: `${point.location.lat().toFixed(4)}, ${point.location.lng().toFixed(4)}`,
                address: results[0].formatted_address,
              })
              return
            }
          }

          if (status !== "OK") {
            console.warn(`[geocodePoint] Geocoding hatası: ${status} (${point.info || "Bilinmeyen Nokta"})`)
          }
          resolve(null)
        })
      } catch (error) {
        console.warn("[geocodePoint] Geocoding sırasında hata:", error)
        resolve(null)
      }
    })
  }

  // Geocoding sonucundan şehir adını çıkar
  getCityFromGeocodingResult(result, turkishCities) {
    // Önce administrative_area_level_1 tipindeki bileşenlere bak (il düzeyi)
    for (const component of result.address_components) {
      if (component.types.includes("administrative_area_level_1")) {
        return component.long_name
      }
    }

    // Eğer il bilgisi bulunamazsa, tüm adreste Türkiye şehirlerini ara
    const fullAddress = result.formatted_address

    for (const city of turkishCities) {
      if (fullAddress.includes(city)) {
        return city
      }
    }

    return null
  }

  // Yeni metot: Etkinlik önerileri al ve göster
  async getSuggestedActivities() {
    try {
      // Buton durumunu güncelle
      const suggestButton = document.getElementById("suggestActivitiesButton")
      if (suggestButton) {
        suggestButton.disabled = true
        suggestButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Öneriler Alınıyor...'
      }

      // Check if eventManager exists
      if (!this.eventManager) {
        console.error("EventSuggestionsManager not found! Creating a new instance...")
        this.eventManager = new EventSuggestionsManager()
      }

      // EventSuggestionsManager üzerinden önerileri al
      if (this.eventManager) {
        console.log("Calling generateSuggestions on eventManager")
        await this.eventManager.generateSuggestions()

        // Make sure the panel is visible
        this.eventManager.togglePanel(true)
      } else {
        console.error("EventSuggestionsManager still not available!")
        alert("Etkinlik önerileri yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.")
      }

      // Buton durumunu eski haline getir
      if (suggestButton) {
        suggestButton.disabled = false
        suggestButton.innerHTML = '<i class="fas fa-lightbulb"></i> Etkinlik Öner'
      }
    } catch (error) {
      console.error("Etkinlik önerileri alınırken hata:", error)
      alert("Etkinlik önerileri alınamadı: " + error.message)

      // Hata durumunda butonu sıfırla
      const suggestButton = document.getElementById("suggestActivitiesButton")
      if (suggestButton) {
        suggestButton.disabled = false
        suggestButton.innerHTML = '<i class="fas fa-lightbulb"></i> Etkinlik Öner'
      }
    }
  }
}

// Sayfa yüklendiğinde uygulamayı başlat
/*
document.addEventListener("DOMContentLoaded", () => {
  window.app = new AppManager()
})
*/
