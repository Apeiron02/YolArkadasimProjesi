class ChargingStationManager {
  constructor(mapManager) {
    this.mapManager = mapManager
    this.chargingStationMarkers = []
    this.chargingStationsVisible = false
    this.stationMarkers = []
    this.restaurantMarkers = []
    this.MarkerFactory = window.MarkerFactory || undefined
    this.InfoWindowFactory = window.InfoWindowFactory || undefined
    this.google = window.google || undefined
  }

  /**
   * Belirli bir konumun çevresindeki şarj istasyonlarını arar (Mobil uyumlu)
   * @param {Object} location - Konum (lat, lng)
   * @returns {Promise<Array>} - Şarj istasyonları dizisi
   */
  async searchNearbyStations(location) {
    this.clearStationMarkers()

    try {
      // Hata ayıklama için log
      console.log(`Şarj istasyonları için API isteği yapılıyor: lat=${location.lat}, lng=${location.lng}`)

      // İki farklı endpoint dene - önce API, hata olursa doğrudan view'a git
      const apiUrl = `/api/v1/yakin-sarj-istasyonlari/?lat=${location.lat}&lng=${location.lng}`
      const fallbackUrl = `/harita/get-nearby-charging-stations/?lat=${location.lat}&lng=${location.lng}`
      console.log("Denenen API URL:", apiUrl)

      let data
      try {
        // İlk API çağrısı
        const response = await fetch(apiUrl)

        // Yanıtın JSON formatında olup olmadığını kontrol et
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(`API yanıtı JSON formatında değil: ${contentType}. Fallback URL deneniyor...`)
          throw new Error("API yanıtı JSON formatında değil")
        }

        if (!response.ok) {
          console.warn(`API endpoint'i yanıt vermedi (${response.status}), yedek endpoint deneniyor...`)
          throw new Error("API endpoint failed")
        }

        data = await response.json()
        console.log("API yanıtı başarılı:", data)
      } catch (apiError) {
        console.log("İlk API çağrısı başarısız oldu:", apiError.message)
        console.log("Yedek URL deneniyor:", fallbackUrl)

        try {
          const fallbackResponse = await fetch(fallbackUrl)

          // Fallback yanıtının da JSON olduğundan emin ol
          const contentType = fallbackResponse.headers.get("content-type")
          if (!contentType || !contentType.includes("application/json")) {
            console.error(`Fallback API yanıtı JSON formatında değil: ${contentType}`)
            throw new Error("Fallback API yanıtı JSON formatında değil")
          }

          if (!fallbackResponse.ok) {
            console.error(`Fallback endpoint başarısız oldu: ${fallbackResponse.status}`)
            throw new Error(`Fallback endpoint başarısız oldu: ${fallbackResponse.status}`)
          }

          data = await fallbackResponse.json()
          console.log("Fallback API yanıtı başarılı:", data)
        } catch (fallbackError) {
          console.error("Her iki API çağrısı da başarısız oldu:", fallbackError.message)
          throw new Error(`Şarj istasyonları alınamadı: ${fallbackError.message}`)
        }
      }

      // data undefined değilse devam et
      if (!data) {
        console.error("API yanıtında veri bulunamadı")
        return []
      }

      if (data.stations && Array.isArray(data.stations)) {
        data.stations.forEach((station) => {
          // MarkerFactory kullanılabilirse kullan, yoksa standart marker oluştur
          let marker
          if (this.MarkerFactory) {
            marker = this.MarkerFactory.createStationMarker(station, this.mapManager.map)
          } else {
            marker = this.mapManager.addMarker(
              {
                lat: Number.parseFloat(station.latitude),
                lng: Number.parseFloat(station.longitude),
              },
              station.name,
              {
                url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
              },
            )
          }

          // Rastgele istasyon doluluk durumu (0-5 arası)
          const occupancy = this.getRandomOccupancy()

          // InfoWindowFactory kullanılabilirse kullan, yoksa standart infoWindow oluştur
          let infoWindow
          if (this.InfoWindowFactory) {
            infoWindow = this.InfoWindowFactory.createStationInfoWindow(station)

            marker.addListener("click", () => {
              this.mapManager.openInfoWindow(infoWindow, marker)

              // Şarj istasyonunun adresini hedef olarak ayarla
              if (window.evMapApp && window.evMapApp.uiManager) {
                window.evMapApp.uiManager.setDestination(station.vicinity || station.name)
              }

              this.clearRestaurantMarkers()
            })
          } else {
            // Şarj istasyonu için info window içeriği
            const infoWindowContent = `
                            <div class="station-info-window">
                                <div class="info-header">
                                    <h3><i class="fas fa-charging-station"></i> ${station.name}</h3>
                                    <button class="close-btn"><i class="fas fa-times"></i></button>
                                </div>
                                <div class="info-content">
                                    <p class="info-address">${station.vicinity || ""}</p>
                                    <p class="info-coordinates">Konum: ${station.latitude}, ${station.longitude}</p>
                                    ${station.rating ? `<p class="info-rating">⭐ ${station.rating}</p>` : ""}
                                    
                                    ${this.getOccupancyHTML(occupancy)}
                                    
                                    <div class="info-buttons">
                                        <button class="action-btn" onclick="window.app.restaurantManager.showNearbyRestaurants(${station.latitude}, ${station.longitude}, '${station.place_id || ""}')">
                                            <i class="fas fa-utensils"></i> Restoranları Göster
                                        </button>
                                        <button class="action-btn" onclick="window.app.routeManager.addWaypoint({lat: ${station.latitude}, lng: ${station.longitude}}, '${station.name.replace(/'/g, "\\'")}').then(name => { alert(name + ' durağı rotanıza eklendi.'); }).catch(error => { alert('Durak eklenirken bir hata oluştu: ' + error.message); })">
                                            <i class="fas fa-plus"></i> Durak Ekle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `

            marker.addListener("click", () => {
              const infoWindow = this.mapManager.showInfoWindow(marker, infoWindowContent)

              // Google Maps'in varsayılan kapatma butonunu gizle
              setTimeout(() => {
                const closeButtons = document.querySelectorAll('.gm-ui-hover-effect, button[title="Close"]')
                closeButtons.forEach((btn) => {
                  btn.style.display = "none"
                  btn.style.visibility = "hidden"
                  btn.style.opacity = "0"
                  btn.style.pointerEvents = "none"
                })
              }, 10)

              // Kapatma butonunu işlevsel hale getir
              if (this.google && this.google.maps) {
                this.google.maps.event.addListenerOnce(infoWindow, "domready", () => {
                  // Google Maps'in varsayılan kapatma butonunu gizle
                  const closeButtons = document.querySelectorAll('.gm-ui-hover-effect, button[title="Close"]')
                  closeButtons.forEach((btn) => {
                    btn.style.display = "none"
                    btn.style.visibility = "hidden"
                    btn.style.opacity = "0"
                    btn.style.pointerEvents = "none"
                  })

                  // Bizim kapatma butonumuzu işlevsel hale getir
                  const closeBtn = document.querySelector(".station-info-window .close-btn")
                  if (closeBtn) {
                    closeBtn.addEventListener("click", () => {
                      infoWindow.close()
                    })
                  }
                })
              }

              // Şarj istasyonunun adresini searchBox2'ye ekle
              const searchBox = document.getElementById("searchBox2")
              if (searchBox) {
                searchBox.value = station.vicinity || station.name
              }
            })
          }

          this.stationMarkers.push(marker)
          this.chargingStationMarkers.push(marker)
        })

        console.log(`${data.stations.length} şarj istasyonu bulundu`)
        return data.stations
      } else {
        console.error("Şarj istasyonları bulunamadı veya geçersiz veri alındı:", data)
        return []
      }
    } catch (error) {
      console.error("Şarj istasyonları aranırken hata oluştu:", error)
      return []
    }
  }

  async searchNearbyChargingStations(location, radius = 50000) {
    try {
      // Mobil uyumlu fonksiyonu kullan
      return await this.searchNearbyStations(location)
    } catch (error) {
      console.error("Şarj istasyonları yüklenirken hata:", error)
      throw error
    }
  }

  clearStationMarkers() {
    // Tüm marker dizilerini temizle
    this.chargingStationMarkers.forEach((marker) => marker.setMap(null))
    this.chargingStationMarkers = []

    this.stationMarkers.forEach((marker) => marker.setMap(null))
    this.stationMarkers = []
  }

  clearRestaurantMarkers() {
    if (this.restaurantMarkers && this.restaurantMarkers.length > 0) {
      this.restaurantMarkers.forEach((marker) => marker.setMap(null))
      this.restaurantMarkers = []
    }
  }

  async findOptimalChargingStations(startLocation, endLocation, requiredStops) {
    try {
      const lat1 = startLocation.lat()
      const lng1 = startLocation.lng()
      const lat2 = endLocation.lat()
      const lng2 = endLocation.lng()

      // Kullanıcı şarj seviyesi ve araç bilgilerini al
      const batteryLevel = Number.parseInt(document.getElementById("batteryLevel").value) || 100
      const response = await fetch("/harita/user_car_info/")
      const carInfoResponse = await fetch("/harita/user_car_info/")
      const carInfo = await carInfoResponse.json()

      const maxRange = carInfo.average_range || 350
      const initialRange = (maxRange * batteryLevel) / 100
      const fullChargeRange = (maxRange * 80) / 100

      // Önce ana rotayı hesapla
      const directionsService = new this.google.maps.DirectionsService()
      const mainRoute = await new Promise((resolve, reject) => {
        directionsService.route(
          {
            origin: new this.google.maps.LatLng(lat1, lng1),
            destination: new this.google.maps.LatLng(lat2, lng2),
            travelMode: this.google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (status === this.google.maps.DirectionsStatus.OK) {
              resolve(response)
            } else {
              reject(status)
            }
          },
        )
      })

      const totalDistance = mainRoute.routes[0].legs[0].distance.value / 1000

      console.log(`Rota analizi başlıyor:
                - Araç: ${carInfo.car_name}
                - Maksimum menzil: ${maxRange} km
                - Mevcut şarj: %${batteryLevel}
                - Mevcut menzil: ${initialRange} km
                - Toplam mesafe: ${totalDistance} km`)

      // Eğer araç menzili tüm rotayı karşılıyorsa durak gerekmez
      if (initialRange >= totalDistance) {
        return []
      }

      // Rota noktalarını al
      const routePolyline = mainRoute.routes[0].overview_polyline
      const decodedPath = this.google.maps.geometry.encoding.decodePath(routePolyline)

      // Rotayı 1 km'lik segmentlere böl (daha hassas mesafe takibi için)
      const routeSegments = []
      let cumulativeDistance = 0

      for (let i = 1; i < decodedPath.length; i++) {
        const segmentDistance =
          this.google.maps.geometry.spherical.computeDistanceBetween(decodedPath[i - 1], decodedPath[i]) / 1000

        cumulativeDistance += segmentDistance
        routeSegments.push({
          point: decodedPath[i],
          cumulativeDistance: cumulativeDistance,
        })
      }

      const stations = []
      let currentRange = initialRange
      let currentPosition = new this.google.maps.LatLng(lat1, lng1)
      let totalTraveled = 0

      // Ana döngü: Tüm rota boyunca şarj istasyonlarını belirle
      while (totalTraveled < totalDistance) {
        // Güvenli sürüş mesafesi (menzili %20 kalana kadar kullan)
        const safeRange = currentRange * 0.8

        // Rotada gidilebilecek maksimum mesafeyi bul
        let targetSegment = null
        for (const segment of routeSegments) {
          // Henüz ulaşılmayan ve menzil içindeki segment mi?
          if (segment.cumulativeDistance > totalTraveled && segment.cumulativeDistance - totalTraveled <= safeRange) {
            targetSegment = segment
          } else if (segment.cumulativeDistance > totalTraveled + safeRange) {
            // Menzil dışına çıkıldı, önceki segmentte dur
            break
          }
        }

        if (!targetSegment) {
          // Varış noktasına erişilebildi
          break
        }

        const targetDistance = targetSegment.cumulativeDistance - totalTraveled
        const targetPoint = targetSegment.point

        console.log(`Şarj istasyonu arama:
                    - Kalan menzil: ${currentRange.toFixed(1)} km
                    - Güvenli mesafe: ${safeRange.toFixed(1)} km
                    - Hedef mesafe: ${targetDistance.toFixed(1)} km`)

        // Bu noktaya yakın şarj istasyonlarını ara
        const searchRadius = 30000 // 30 km yarıçap
        try {
          const apiUrl = `/api/v1/yakin-sarj-istasyonlari/?lat=${targetPoint.lat()}&lng=${targetPoint.lng()}&radius=${searchRadius}`
          const fallbackUrl = `/harita/get-nearby-charging-stations/?lat=${targetPoint.lat()}&lng=${targetPoint.lng()}&radius=${searchRadius}`

          console.log("Şarj istasyonu arama API URL:", apiUrl)

          let stationData

          try {
            // İlk API çağrısı
            const response = await fetch(apiUrl)

            // Yanıtın JSON formatında olup olmadığını kontrol et
            const contentType = response.headers.get("content-type")
            if (!contentType || !contentType.includes("application/json")) {
              console.warn(`API yanıtı JSON formatında değil: ${contentType}. Fallback URL deneniyor...`)
              throw new Error("API yanıtı JSON formatında değil")
            }

            if (!response.ok) {
              console.warn(`Şarj istasyonu API'si yanıt vermedi (${response.status}), yedek endpoint deneniyor...`)
              throw new Error("API endpoint failed")
            }

            stationData = await response.json()
            console.log("Şarj istasyonu API yanıtı başarılı:", stationData)
          } catch (apiError) {
            console.log("İlk şarj istasyonu API çağrısı başarısız oldu:", apiError.message)
            console.log("Yedek URL deneniyor:", fallbackUrl)

            // Fallback API'yi dene
            const fallbackResponse = await fetch(fallbackUrl)

            // Fallback yanıtının da JSON olduğundan emin ol
            const contentType = fallbackResponse.headers.get("content-type")
            if (!contentType || !contentType.includes("application/json")) {
              console.error(`Fallback API yanıtı JSON formatında değil: ${contentType}`)
              throw new Error("Hiçbir API şarj istasyonu bilgisi döndürmedi")
            }

            if (!fallbackResponse.ok) {
              console.error(`Fallback endpoint başarısız oldu: ${fallbackResponse.status}`)
              throw new Error("Hiçbir API şarj istasyonu bilgisi döndürmedi")
            }

            stationData = await fallbackResponse.json()
            console.log("Fallback şarj istasyonu API yanıtı:", stationData)
          }

          if (!stationData || !stationData.stations || stationData.stations.length === 0) {
            throw new Error("Bu bölgede şarj istasyonu bulunamadı!")
          }

          // Her şarj istasyonu için gerçek rota mesafesini hesapla
          const stationCandidates = []

          for (const station of stationData.stations) {
            // İstasyonun doluluk durumunu kontrol et - dolu olmayan istasyon garantisi için
            let occupancy = this.getRandomOccupancy()

            // Eğer istasyon tamamen doluysa, yeniden rastgele değer üret (en fazla 3 deneme)
            let attempts = 0
            while (occupancy === 5 && attempts < 3) {
              occupancy = this.getRandomOccupancy()
              attempts++
            }

            // Hala dolu ise bu istasyonu atla
            if (occupancy === 5) {
              console.log(`İstasyon "${station.name}" dolu olduğu için atlandı`)
              continue
            }

            const stationPoint = new this.google.maps.LatLng(
              Number.parseFloat(station.latitude),
              Number.parseFloat(station.longitude),
            )

            // Gerçek rota üzerinden mesafe hesapla
            try {
              const routeToStation = await new Promise((resolve, reject) => {
                directionsService.route(
                  {
                    origin: currentPosition,
                    destination: stationPoint,
                    travelMode: this.google.maps.TravelMode.DRIVING,
                  },
                  (response, status) => {
                    if (status === this.google.maps.DirectionsStatus.OK) {
                      resolve(response)
                    } else {
                      reject(status)
                    }
                  },
                )
              })

              const realDistance = routeToStation.routes[0].legs[0].distance.value / 1000

              // Menzil içinde ve en az 50 km mesafede
              if (realDistance <= currentRange && realDistance >= Math.min(50, currentRange * 0.2)) {
                stationCandidates.push({
                  ...station,
                  distance: realDistance,
                  point: stationPoint,
                  occupancy: occupancy, // Doluluk bilgisini de ekle
                })
              }
            } catch (error) {
              console.warn(`Rota hesaplama hatası: ${error}`)
              // Hata durumunda düz çizgi mesafesini kullan
              const directDistance =
                this.google.maps.geometry.spherical.computeDistanceBetween(currentPosition, stationPoint) / 1000

              if (directDistance <= currentRange * 0.7) {
                // Düz çizgi için güvenlik faktörü
                stationCandidates.push({
                  ...station,
                  distance: directDistance * 1.3, // Gerçek yol faktörü
                  point: stationPoint,
                  isEstimated: true,
                  occupancy: occupancy, // Doluluk bilgisini de ekle
                })
              }
            }
          }

          // Uygun istasyon bulunamadıysa hata döndür
          if (stationCandidates.length === 0) {
            throw new Error("Menzil içinde şarj istasyonu bulunamadı!")
          }

          // En optimal istasyonu seç: Optimizasyon kriteri olarak
          // ilerleme yüzdesi / mesafe oranını kullan (en verimli ilerleme)
          stationCandidates.sort((a, b) => {
            // İlerleme yüzdesi (toplam mesafeye göre)
            const progressA = (totalTraveled + a.distance) / totalDistance
            const progressB = (totalTraveled + b.distance) / totalDistance

            // Mesafe başına ilerleme
            const efficiencyA = progressA / a.distance
            const efficiencyB = progressB / b.distance

            return efficiencyB - efficiencyA
          })

          // En uygun istasyonu seç, ancak dolu olan istasyonları atla
          let selectedStationIndex = 0
          let selectedStation = stationCandidates[selectedStationIndex]

          // Eğer seçilen istasyon dolu ise (occupancy === 5), bir sonraki istasyonu dene
          while (
            selectedStation &&
            selectedStation.occupancy === 5 &&
            selectedStationIndex < stationCandidates.length - 1
          ) {
            console.log(`İstasyon "${selectedStation.name}" dolu olduğu için geçiliyor`)
            selectedStationIndex++
            selectedStation = stationCandidates[selectedStationIndex]
          }

          // Eğer tüm istasyonlar doluysa, hata ver
          if (selectedStation.occupancy === 5) {
            console.error("Tüm istasyonlar dolu, uygun istasyon bulunamadı")
            throw new Error("Bu bölgede uygun şarj istasyonu bulunamadı. Tüm istasyonlar dolu.")
          }

          // Seçilen istasyondan sonra varış noktasına kalan mesafeyi hesapla
          const remainingToDestination = totalDistance - (totalTraveled + selectedStation.distance)

          // Eğer kalan mesafe mevcut menzilin %30'undan azsa ve doğrudan varış noktasına gidilebiliyorsa
          // son şarj istasyonunu ekleme
          if (remainingToDestination <= currentRange * 0.3) {
            console.log(`Son şarj istasyonu atlanıyor:
                            - Seçilen istasyon: ${selectedStation.name}
                            - Varış noktasına kalan: ${remainingToDestination.toFixed(1)} km
                            - Mevcut menzil: ${currentRange} km
                            - Doğrudan varışa gidilebilir`)
            break
          }

          console.log(`Şarj istasyonu seçildi:
                        - İsim: ${selectedStation.name}
                        - Mesafe: ${selectedStation.distance.toFixed(1)} km
                        - ${selectedStation.isEstimated ? "(Tahmini mesafe)" : "(Gerçek rota mesafesi)"}`)

          stations.push(selectedStation)

          // Konum ve menzil bilgilerini güncelle
          currentPosition = selectedStation.point
          totalTraveled += selectedStation.distance
          currentRange = fullChargeRange

          console.log(`Durum güncellendi:
                        - Kat edilen toplam mesafe: ${totalTraveled.toFixed(1)} km
                        - Yeni şarj sonrası menzil: ${currentRange} km
                        - Varışa kalan mesafe: ${(totalDistance - totalTraveled).toFixed(1)} km`)

          // Eğer kalan mesafe mevcut menzilden azsa, döngüyü sonlandır
          if (totalDistance - totalTraveled <= currentRange) {
            console.log(`Hedef menzil içerisinde, başka şarj istasyonu gerekmez:
                            - Kalan mesafe: ${(totalDistance - totalTraveled).toFixed(1)} km
                            - Mevcut menzil: ${currentRange} km`)
            break
          }
        } catch (error) {
          console.error("Şarj istasyonu arama hatası:", error)
          throw error
        }
      }

      // Son bir kontrol daha yap - eğer son istasyon varışa çok yakınsa kaldır
      if (stations.length > 0) {
        const lastStation = stations[stations.length - 1]
        const finalDistance = totalDistance - totalTraveled

        if (finalDistance <= currentRange * 0.3) {
          // Son %30'luk mesafe içindeyse
          console.log(`Son istasyon kaldırılıyor:
                        - Kaldırılan istasyon: ${lastStation.name}
                        - Varışa kalan mesafe: ${finalDistance.toFixed(1)} km
                        - Mevcut menzil: ${currentRange} km`)
          stations.pop() // Son istasyonu kaldır
        }
      }

      console.log(`Rota planlaması tamamlandı:
                - Toplam şarj istasyonu sayısı: ${stations.length}
                - Toplam mesafe: ${totalDistance.toFixed(1)} km`)

      return stations
    } catch (error) {
      console.error("Şarj istasyonları hesaplanırken hata oluştu:", error)
      throw error
    }
  }

  async handleChargingStationSuggestion(route, requiredStops) {
    try {
      console.log("Şarj istasyonu önerisi oluşturuluyor...")
      if (!route || !route.routes || !route.routes[0] || !route.routes[0].legs || !route.routes[0].legs[0]) {
        console.error("Geçersiz rota nesnesi:", route)
        throw new Error("Geçersiz rota bilgisi. Lütfen rotayı tekrar oluşturun.")
      }

      const startLocation = route.routes[0].legs[0].start_location
      const endLocation = route.routes[0].legs[0].end_location

      if (!startLocation || !endLocation) {
        console.error("Başlangıç veya bitiş konumu bulunamadı")
        throw new Error("Rota konumları bulunamadı")
      }

      console.log(`Optimal şarj istasyonları hesaplanıyor:
                - Başlangıç: ${startLocation.lat()}, ${startLocation.lng()}
                - Bitiş: ${endLocation.lat()}, ${endLocation.lng()}
                - Gereken durak sayısı: ${requiredStops}`)

      const stations = await this.findOptimalChargingStations(startLocation, endLocation, requiredStops)

      // Mevcut dialog'ları temizle
      const existingDialog = document.querySelector(".custom-dialog-overlay")
      if (existingDialog) {
        existingDialog.remove()
      }

      console.log(`${stations.length} adet şarj istasyonu bulundu`)

      // Dialog HTML'i oluştur - Özel sınıf adlarını kullan, info-window sınıflarını kullanma
      const dialogHTML = `
              <div class="custom-dialog-overlay">
                  <div class="custom-dialog">
                      <div class="dialog-header">
                          <h3><i class="fas fa-bolt"></i> Şarj Durumu Uyarısı</h3>
                      </div>
                      <div class="dialog-content">
                          <p class="dialog-message">Mevcut şarj seviyesi ile hedefe ulaşmanız mümkün değil.</p>
                          <div class="stations-list">
                              <p class="list-title">Önerilen şarj istasyonu durakları:</p>
                              ${stations
                                .map(
                                  (station, index) => `
                                  <div class="station-item">
                                      <span class="station-number">${index + 1}.</span>
                                      <span class="station-name">${station.name}</span>
                                      <span class="station-distance">(${station.distance.toFixed(1)} km)</span>
                                      <div class="station-occupancy">
                                          ${this.getDialogOccupancyHTML(station.occupancy || 0)}
                                      </div>
                                  </div>
                              `,
                                )
                                .join("")}
                          </div>
                          <p class="dialog-question">Bu rotayı kullanmak ister misiniz?</p>
                          <div class="dialog-buttons">
                              <button class="dialog-button confirm-btn">Tamam</button>
                              <button class="dialog-button cancel-btn">İptal</button>
                          </div>
                      </div>
                  </div>
              </div>
          `

      // Dialog'u sayfaya ekle
      document.body.insertAdjacentHTML("beforeend", dialogHTML)

      // Kullanıcının seçimini bekle
      return new Promise((resolve) => {
        const dialog = document.querySelector(".custom-dialog-overlay")
        const confirmBtn = dialog.querySelector(".confirm-btn")
        const cancelBtn = dialog.querySelector(".cancel-btn")

        confirmBtn.addEventListener("click", () => {
          dialog.remove()

          // Şarj istasyonlarını waypoint olarak ekle
          const waypoints = stations.map((station) => ({
            location: new this.google.maps.LatLng(
              Number.parseFloat(station.latitude),
              Number.parseFloat(station.longitude),
            ),
            stopover: true,
          }))

          resolve({
            accepted: true,
            waypoints: waypoints,
            stations: stations,
          })
        })

        cancelBtn.addEventListener("click", () => {
          dialog.remove()
          resolve({
            accepted: false,
          })
        })
      })
    } catch (error) {
      console.error("Şarj istasyonu önerisi oluşturulamadı:", error)

      // Hata mesajını düzenle - HTML token hatası için özel mesaj
      let errorMessage = error.message
      if (error.message.includes("Unexpected token '<'")) {
        errorMessage = "API yanıtı beklenen formatta değil. Sunucu hatası oluştu."
      }

      // Hata durumunda özel hata dialog'u göster
      const errorDialogHTML = `
              <div class="custom-dialog-overlay">
                  <div class="custom-dialog error">
                      <div class="dialog-header">
                          <h3><i class="fas fa-exclamation-triangle"></i> Hata</h3>
                      </div>
                      <div class="dialog-content">
                          <p class="dialog-message">Şarj istasyonu bulunamadı: ${errorMessage}</p>
                          <div class="dialog-buttons">
                              <button class="dialog-button error-btn">Tamam</button>
                          </div>
                      </div>
                  </div>
              </div>
          `

      document.body.insertAdjacentHTML("beforeend", errorDialogHTML)

      // Hata dialog'unu kapat
      return new Promise((resolve) => {
        const errorDialog = document.querySelector(".custom-dialog-overlay")
        const errorBtn = errorDialog.querySelector(".error-btn")
        errorBtn.addEventListener("click", () => {
          errorDialog.remove()
          resolve({
            accepted: false,
            error: true,
          })
        })
      })
    }
  }

  async checkRouteViability(route) {
    try {
      // Araç bilgilerini ve şarj seviyesini al
      const carInfoResponse = await fetch("/harita/user_car_info/")
      const carInfo = await carInfoResponse.json()
      const batteryLevel = Number.parseInt(document.getElementById("batteryLevel").value) || 100

      const leg = route.routes[0].legs[0]
      const totalDistance = leg.distance.value / 1000 // metre -> km

      // Araç menzili hesapla
      const maxRange = carInfo.average_range || 350
      const actualRange = (maxRange * batteryLevel) / 100

      console.log(`Rota mesafesi: ${totalDistance}km, Araç menzili: ${actualRange}km`)

      if (totalDistance <= actualRange) {
        // Menzil yeterli, şarj istasyonu gerekmiyor
        return { viable: true, remainingRange: actualRange - totalDistance }
      } else {
        // Kaç şarj istasyonu gerekecek hesapla
        const remainingDistance = totalDistance - actualRange
        const fullChargeRange = (maxRange * 80) / 100 // %80 şarj ile menzil
        const requiredStops = Math.ceil(remainingDistance / fullChargeRange)

        console.log(`Yetersiz menzil. Gereken şarj durağı sayısı: ${requiredStops}`)
        return { viable: false, requiredStops }
      }
    } catch (error) {
      console.error("Rota kontrol hatası:", error)
      return { viable: false, error: "Rota kontrolü yapılamadı" }
    }
  }

  showChargingStationsOnRoute(route) {
    try {
      if (!route || !route.routes || route.routes.length === 0) {
        console.error("Geçerli bir rota bulunamadı")
        return false
      }

      // Haritada mevcut şarj istasyonu marker'larını temizle
      this.clearStationMarkers()

      // Rota yolunu kontrol et
      const waypoints = route.routes[0].overview_path
      if (!waypoints || waypoints.length === 0) {
        console.warn("Rota yolu bulunamadı, başlangıç ve bitiş noktalarını kullanıyorum")

        // Rotada bacaklar (legs) var mı kontrol et
        if (route.routes[0].legs && route.routes[0].legs.length > 0) {
          const leg = route.routes[0].legs[0]

          // Başlangıç ve bitiş noktalarını kullan
          if (leg.start_location) {
            this.searchNearbyStations({
              lat: leg.start_location.lat(),
              lng: leg.start_location.lng(),
            })
          }

          if (leg.end_location) {
            this.searchNearbyStations({
              lat: leg.end_location.lat(),
              lng: leg.end_location.lng(),
            })
          }

          this.chargingStationsVisible = true
          return true
        } else {
          console.error("Rotada geçerli bacak (leg) bulunamadı")
          return false
        }
      }

      const intervalCount = Math.min(5, waypoints.length)

      // Rotada belirli aralıklarla noktalar seç
      for (let i = 0; i < intervalCount; i++) {
        try {
          const index = Math.floor(waypoints.length * (i / Math.max(1, intervalCount - 1)))
          const point = waypoints[index]

          // Point'in geçerli olduğundan ve gerekli metodlara sahip olduğundan emin ol
          if (point && typeof point.lat === "function" && typeof point.lng === "function") {
            // Her nokta etrafında şarj istasyonlarını ara (mobil uyumlu fonksiyonu kullan)
            this.searchNearbyStations({
              lat: point.lat(),
              lng: point.lng(),
            })
          } else {
            console.warn(`Geçersiz waypoint noktası: index ${index}`)
          }
        } catch (pointError) {
          console.warn(`Waypoint noktası işlenirken hata: ${pointError.message}`)
          continue // Sorunlu noktayı atla ve bir sonrakine geç
        }
      }

      this.chargingStationsVisible = true
      return true
    } catch (error) {
      console.error("Şarj istasyonları gösterilirken hata oluştu:", error)
      return false
    }
  }

  toggleChargingStations(route) {
    try {
      if (this.chargingStationsVisible) {
        // Şarj istasyonlarını gizle
        this.clearStationMarkers()
        this.chargingStationsVisible = false
        return false
      } else {
        // Rota kontrolü
        if (!route || !route.routes || route.routes.length === 0) {
          alert("Önce bir rota oluşturmanız gerekmektedir.")
          return false
        }

        // Şarj istasyonlarını göster
        const success = this.showChargingStationsOnRoute(route)

        if (!success) {
          alert("Şarj istasyonları gösterilirken bir hata oluştu. Lütfen tekrar deneyin.")
        }

        return success
      }
    } catch (error) {
      console.error("Şarj istasyonları görünümü değiştirilirken hata:", error)
      alert("Şarj istasyonları görünümü değiştirilirken bir hata oluştu.")
      return false
    }
  }

  // Rastgele istasyon doluluk durumu (0-5 arası)
  getRandomOccupancy() {
    // 0-9 arası rastgele değer üret
    const randomValue = Math.floor(Math.random() * 10)

    // Eğer değer 9 ise, 5 döndür (doluluk %10 ihtimalle)
    if (randomValue === 9) {
      return 5 // Tamamen dolu
    }

    // Diğer durumlarda 0-4 arası değer döndür
    return Math.floor(randomValue / 2) // 0, 1, 2, 3, 4 değerlerini dağıt
  }

  // Doluluk durumu HTML'ini oluştur
  getOccupancyHTML(occupancy) {
    if (occupancy === 5) {
      return `
                <div class="occupancy-info">
                    <span class="occupancy-full">
                        <i class="fas fa-exclamation-circle"></i> Boş yer mevcut değil
                    </span>
                </div>
            `
    }

    // Doluluk göstergesi noktaları
    let dotsHTML = ""
    for (let i = 0; i < 5; i++) {
      dotsHTML += `<span class="occupancy-dot ${i < 5 - occupancy ? "active" : ""}"></span>`
    }

    return `
            <div class="occupancy-info">
                <span class="occupancy-text">Doluluk durumu</span>
                <div class="occupancy-status">
                    ${dotsHTML}
                </div>
            </div>
        `
  }

  // Dialog için özel doluluk durumu HTML'i oluştur
  getDialogOccupancyHTML(occupancy) {
    if (occupancy === 5) {
      return `<span class="occupancy-full"><i class="fas fa-exclamation-circle"></i> Dolu</span>`
    }

    // Doluluk göstergesi noktaları
    let dotsHTML = ""
    for (let i = 0; i < 5; i++) {
      dotsHTML += `<span class="occupancy-dot ${i < 5 - occupancy ? "active" : ""}"></span>`
    }

    return dotsHTML
  }
}
