class RestaurantManager {
    constructor(mapManager) {
      this.mapManager = mapManager
      this.restaurantMarkers = []
    }
  
    async showNearbyRestaurants(lat, lng, stationId) {
      try {
        // Önceki restoran marker'larını temizle
        this.clearRestaurantMarkers()
  
        // Info window'u kapat
        if (this.mapManager.currentInfoWindow) {
          this.mapManager.currentInfoWindow.close()
        }
  
        const response = await fetch(`/harita/get-restaurants/?station_id=${stationId}`)
        if (!response.ok) {
          throw new Error("Restoran verileri alınamadı")
        }
  
        const data = await response.json()
  
        if (!data.restaurants || !Array.isArray(data.restaurants)) {
          console.warn("Restoran verisi bulunamadı veya geçersiz:", data)
          return []
        }
  
        data.restaurants.forEach((restaurant) => {
          const restaurantMarker = this.mapManager.addMarker(
            {
              lat: restaurant.latitude,
              lng: restaurant.longitude,
            },
            restaurant.name,
            {
              url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            },
          )
  
          // Restoran için info window içeriği
          const infoWindowContent = `
                      <div class="restaurant-info-window">
                          <div class="info-header">
                              <h3><i class="fas fa-utensils"></i> ${restaurant.name}</h3>
                              <button class="close-btn"><i class="fas fa-times"></i></button>
                          </div>
                          <div class="info-content">
                              <p class="info-address">${restaurant.vicinity || ""}</p>
                              <div class="info-buttons">
                                  <button class="action-btn" onclick="window.app.restaurantManager.selectRestaurantAsDestination('${lat}, ${lng}', '${restaurant.name.replace(/'/g, "\\'")}', '${restaurant.vicinity ? restaurant.vicinity.replace(/'/g, "\\'") : ""}')">
                                      <i class="fas fa-route"></i> Rota Oluştur
                                  </button>
                              </div>
                          </div>
                      </div>
                  `
  
          restaurantMarker.addListener("click", () => {
            const infoWindow = this.mapManager.showInfoWindow(restaurantMarker, infoWindowContent)
  
            // Kapatma butonunu işlevsel hale getir
            window.google.maps.event.addListenerOnce(infoWindow, "domready", () => {
              const closeBtn = document.querySelector(".restaurant-info-window .close-btn")
              if (closeBtn) {
                closeBtn.addEventListener("click", () => {
                  infoWindow.close()
                })
              }
            })
          })
  
          this.restaurantMarkers.push(restaurantMarker)
        })
  
        return data.restaurants
      } catch (error) {
        console.error("Restoranlar yüklenirken hata:", error)
        throw error
      }
    }
  
    clearRestaurantMarkers() {
      this.restaurantMarkers.forEach((marker) => {
        marker.setMap(null)
      })
      this.restaurantMarkers = []
    }
  
    selectRestaurantAsDestination(stationAddress, restaurantName, restaurantVicinity) {
      try {
        const restaurantAddress = `${restaurantName}${restaurantVicinity ? ", " + restaurantVicinity : ""}`
  
        // DirectionsPanel'i temizle
        document.getElementById("directionsPanel").innerHTML = "<h4>Rota Bilgileri</h4>"
  
        // Şarj istasyonunu başlangıç noktası yap
        document.getElementById("searchBox1").value = stationAddress
        // Restoranı varış noktası yap
        document.getElementById("searchBox2").value = restaurantAddress
  
        // Info window'u kapat
        if (this.mapManager.currentInfoWindow) {
          this.mapManager.currentInfoWindow.close()
        }
  
        // Rotayı hesapla
        if (window.app && window.app.routeManager) {
          window.app.routeManager.calculateRoute(stationAddress, restaurantAddress)
        }
  
        return true
      } catch (error) {
        console.error("Restoran hedef olarak seçilirken hata:", error)
        return false
      }
    }
  
    // Restoran bilgilerini görüntülemek için bir fonksiyon
    displayRestaurantInfo(restaurant, containerId) {
      const container = document.getElementById(containerId)
      if (!container) return
  
      let ratingStars = ""
      if (restaurant.rating) {
        const fullStars = Math.floor(restaurant.rating)
        const halfStar = restaurant.rating % 1 >= 0.5
  
        for (let i = 0; i < fullStars; i++) {
          ratingStars += "⭐"
        }
  
        if (halfStar) {
          ratingStars += "✩"
        }
      }
  
      const html = `
              <div class="restaurant-card">
                  <h3 class="restaurant-name">${restaurant.name}</h3>
                  <p class="restaurant-address">${restaurant.vicinity || "Adres bilgisi yok"}</p>
                  ${restaurant.rating ? `<p class="restaurant-rating">${ratingStars} (${restaurant.rating})</p>` : ""}
                  <button class="route-button" onclick="selectRestaurantAsDestination('Mevcut Konum', '${restaurant.name}, ${restaurant.vicinity}')">
                      Rota Oluştur
                  </button>
              </div>
          `
  
      container.innerHTML += html
    }
  }
  