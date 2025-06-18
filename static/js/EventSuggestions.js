// At the beginning of the file, add this line to ensure the class is defined before it's used
window.EventSuggestionsManager = class EventSuggestionsManager {
  constructor() {
    this.panel = null
    this.contentContainer = null
    this.suggestButton = null
    this.closeButton = null
    this.mapSection = null
    this.isOpen = false
    this.currentRoute = null
    this.currentSuggestions = []
    this.suggestionMarkers = []
    this.introText = "" // Store introductory text

    // Initialize after DOM is fully loaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.initialize())
    } else {
      // DOM already loaded, initialize immediately
      this.initialize()
    }
  }

  initialize() {
    this.initElements()
    this.initEventListeners()
    console.log("EventSuggestionsManager initialized successfully")
  }

  /**
   * DOM elementlerini initialize et
   */
  initElements() {
    // Panel yoksa oluştur
    if (!document.getElementById("eventSuggestionsPanel")) {
      this.createSuggestionsPanel()
    }

    this.panel = document.getElementById("eventSuggestionsPanel")
    this.contentContainer = document.getElementById("eventSuggestionsList")
    this.suggestButton = document.getElementById("suggestActivitiesButton")
    this.closeButton = document.getElementById("closeEventPanel")
    this.mapSection = document.getElementById("map-section")

    // Ensure the map section gets the proper class when panel is active
    if (this.mapSection) {
      this.mapSection.classList.add("map-with-panel")
    }

    // Sayfanın en altındaki etkinlik öner butonunu kaldır
    const bottomSuggestButton = document.querySelector(".container + div button")
    if (bottomSuggestButton && bottomSuggestButton.textContent.includes("Etkinlik Öner")) {
      const parentElement = bottomSuggestButton.closest("div")
      if (parentElement) {
        parentElement.remove()
      }
    }
  }

  /**
   * Etkinlik önerileri panelini oluştur
   */
  createSuggestionsPanel() {
    const panelHTML = `
      <div id="eventSuggestionsPanel" class="event-suggestions-panel">
        <div class="event-panel-header">
          <h3><i class="fas fa-lightbulb"></i> Etkinlik Önerileri</h3>
          <button id="closeEventPanel" class="event-panel-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="event-panel-content">
          <div id="eventSuggestionsList"></div>
        </div>
      </div>
    `

    // Paneli body'nin sonuna ekle
    document.body.insertAdjacentHTML("beforeend", panelHTML)

    // CSS'i ekle
    if (!document.getElementById("eventSuggestionsCss")) {
      const style = document.createElement("style")
      style.id = "eventSuggestionsCss"
      style.textContent = this.getStyles()
      document.head.appendChild(style)
    }
  }

  /**
   * Gerekli CSS stillerini döndürür
   */
  getStyles() {
    return `
      /* Event Suggestions Panel Styles */
      .event-suggestions-panel {
        position: fixed;
        top: 0;
        right: -400px;
        width: 400px;
        height: 100vh;
        background-color: #222831;
        box-shadow: -5px 0 15px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        transition: right 0.4s ease;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .event-suggestions-panel.active {
        right: 0;
      }

      .event-panel-header {
        background-color: #1e88e5;
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .event-panel-header h3 {
        color: #ffffff;
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .event-panel-close {
        background: rgba(0, 0, 0, 0.2);
        color: white;
        border: none;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        font-size: 14px;
        transition: all 0.3s ease;
        margin-left: 10px;
      }

      .event-panel-close:hover {
        background: rgba(0, 0, 0, 0.4);
        transform: rotate(90deg);
      }

      .event-panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
      }

      .event-panel-content::-webkit-scrollbar {
        width: 8px;
        background: transparent;
      }

      .event-panel-content::-webkit-scrollbar-track {
        background: #393e46;
        border-radius: 8px;
      }

      .event-panel-content::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #1e88e5, #0d47a1);
        border-radius: 8px;
        min-height: 40px;
        border: 2px solid #222831;
      }

      .intro-text-container {
        background-color: rgba(30, 136, 229, 0.1);
        border-left: 4px solid #1e88e5;
        border-radius: 8px;
        padding: 12px 15px;
        margin-bottom: 20px;
        color: #ffffff;
        font-size: 14px;
        line-height: 1.5;
      }

      .suggestions-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .event-item {
        background-color: #393e46;
        border-radius: 10px;
        padding: 15px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }

      .event-item:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
      }

      .event-title {
        color: #64b5f6;
        margin: 0 0 10px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .event-description {
        color: #ffffff;
        margin: 0 0 15px 0;
        font-size: 14px;
        line-height: 1.5;
      }

      .event-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 15px;
      }

      .event-location,
      .event-distance {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #eeeeee;
        font-size: 13px;
        background-color: rgba(0, 0, 0, 0.2);
        padding: 5px 10px;
        border-radius: 15px;
      }

      .event-actions {
        display: flex;
        gap: 10px;
      }

      .event-btn {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.3s ease;
      }

      .event-btn-primary {
        background-color: #1e88e5;
        color: #ffffff;
      }

      .event-btn-primary:hover {
        background-color: #0d47a1;
        transform: translateY(-2px);
      }

      .event-btn-secondary {
        background-color: #393e46;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .event-btn-secondary:hover {
        background-color: #4a4f57;
        transform: translateY(-2px);
      }

      .btn-click-effect {
        position: relative;
        overflow: hidden;
      }

      .btn-click-effect:after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 5px;
        height: 5px;
        background: rgba(255, 255, 255, 0.5);
        opacity: 0;
        border-radius: 100%;
        transform: scale(1, 1) translate(-50%, -50%);
        transform-origin: 50% 50%;
      }

      .btn-click-effect:focus:not(:active)::after {
        animation: ripple 0.6s ease-out;
      }

      @keyframes ripple {
        0% {
          transform: scale(0, 0);
          opacity: 0.5;
        }
        20% {
          transform: scale(25, 25);
          opacity: 0.3;
        }
        100% {
          opacity: 0;
          transform: scale(40, 40);
        }
      }

      /* Loading spinner */
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 30px;
        color: #ffffff;
      }

      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        border-top-color: #1e88e5;
        animation: spin 1s ease-in-out infinite;
        margin-bottom: 15px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Error message */
      .error-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        background-color: rgba(244, 67, 54, 0.1);
        border-left: 4px solid #f44336;
        border-radius: 8px;
        color: #ffffff;
      }

      .error-message i {
        font-size: 24px;
        color: #f44336;
        margin-bottom: 10px;
      }

      /* Success toast */
      .success-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background-color: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 2000;
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      .success-toast.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }

      .success-toast i {
        font-size: 18px;
      }

      /* Suggestion info window styles */
      .suggestion-info-window .info-header {
        background-color: #9c27b0; /* Purple for suggestion markers */
      }

      .suggestion-info-window .action-btn {
        background-color: #9c27b0;
      }

      .suggestion-info-window .action-btn:hover {
        background-color: #7b1fa2;
      }

      /* Animation keyframes */
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }

      @keyframes slideOutRight {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(100%);
        }
      }
      
      /* Fix for map layout when panel is open */
      #map-section {
        width: 100% !important;
        transition: none !important;
      }

      #map-section.panel-active {
        width: 100% !important;
      }

      #map {
        width: 100% !important;
        height: 100% !important;
      }
    `
  }

  /**
   * Olay dinleyicilerini başlatır
   */
  initEventListeners() {
    // Etkinlik öner butonuna tıklandığında
    if (this.suggestButton) {
      this.suggestButton.addEventListener("click", () => {
        this.togglePanel(true)
        this.generateSuggestions()
      })
    }

    // Kapat butonuna tıklandığında
    if (this.closeButton) {
      this.closeButton.addEventListener("click", () => {
        this.togglePanel(false)
      })
    }

    // Escape tuşuna basıldığında paneli kapat
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.togglePanel(false)
      }
    })
  }

  /**
   * Paneli açıp kapatır
   * @param {boolean} show - Panel gösterilsin mi?
   */
  togglePanel(show) {
    if (!this.panel) {
      console.error("Panel element not found!")
      // Try to get it again
      this.panel = document.getElementById("eventSuggestionsPanel")
      if (!this.panel) {
        console.error("Still can't find panel, creating it now")
        this.createSuggestionsPanel()
        this.panel = document.getElementById("eventSuggestionsPanel")
      }
    }

    console.log("Toggle panel called with show =", show, "panel =", this.panel)

    if (show) {
      this.panel.classList.add("active")
      this.isOpen = true

      // IMPORTANT: Don't add panel-active class to map section
      // This prevents the map from resizing

      // Force panel to be visible with inline style as a fallback
      this.panel.style.right = "0"
      this.panel.style.display = "flex"

      console.log("Panel should now be visible")
    } else {
      this.panel.classList.remove("active")
      this.isOpen = false

      // Remove any panel-active class from map section
      if (this.mapSection && this.mapSection.classList.contains("panel-active")) {
        this.mapSection.classList.remove("panel-active")
      }

      // Reset inline styles
      this.panel.style.right = ""

      // Clear suggestion markers when closing the panel
      this.clearSuggestionMarkers()

      console.log("Panel should now be hidden")
    }
  }

  /**
   * Mevcut rotayı ayarlar
   * @param {Object} route - Google Maps DirectionsResult nesnesi
   */
  setCurrentRoute(route) {
    this.currentRoute = route

    // Rota varsa etkinlik öner butonunu göster
    if (this.suggestButton) {
      if (route) {
        this.suggestButton.style.display = "flex"
      } else {
        this.suggestButton.style.display = "none"
      }
    }
  }

  /**
   * Etkinlik önerilerini oluşturur ve panele ekler
   */
  async generateSuggestions() {
    this.showLoading()
    this.togglePanel(true)

    try {
      // Rota üzerindeki şehirleri al
      const cities = window.app?.routeManager?.detectedCities || []
      if (!cities.length) {
        this.showError("Rota şehirleri tespit edilemedi.")
        return
      }

      // Gemini API'ye istek at
      const response = await fetch("/harita/get_stopover_suggestions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cities }),
      })

      if (!response.ok) {
        throw new Error(`API yanıt hatası: ${response.status}`)
      }

      const data = await response.json()

      if (data.suggestions) {
        this.renderGeminiSuggestions(data.suggestions)
      } else {
        this.showError(data.error || "Etkinlik önerileri alınamadı.")
      }
    } catch (error) {
      console.error("Etkinlik önerileri alınırken hata:", error)
      this.showError("Etkinlik önerileri alınamadı. Lütfen daha sonra tekrar deneyin.")
    }
  }

  /**
   * Yükleniyor mesajını gösterir
   */
  showLoading() {
    if (!this.contentContainer) return

    this.contentContainer.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Etkinlik önerileri yükleniyor...</p>
        <small>Rotanız üzerindeki şehirler analiz ediliyor</small>
      </div>
    `
  }

  /**
   * Hata mesajını gösterir
   * @param {string} message - Hata mesajı
   */
  showError(message) {
    if (!this.contentContainer) return

    this.contentContainer.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
        <small>Lütfen daha sonra tekrar deneyin</small>
      </div>
    `
  }

  /**
   * Başarı mesajını gösterir
   * @param {string} message - Başarı mesajı
   */
  showSuccess(message) {
    // Toast mesajı oluştur
    const toast = document.createElement("div")
    toast.className = "success-toast"
    toast.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    `

    // Sayfaya ekle
    document.body.appendChild(toast)

    // Animasyon için setTimeout
    setTimeout(() => {
      toast.classList.add("show")
    }, 10)

    // 3 saniye sonra kaldır
    setTimeout(() => {
      toast.classList.remove("show")
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast)
        }
      }, 400)
    }, 3000)
  }

  // Gemini'den dönen metni gösteren fonksiyon
  renderGeminiSuggestions(suggestionsText) {
    if (!this.contentContainer) return

    // Parse the suggestions to extract location information
    const { introText, suggestions } = this.parseGeminiSuggestions(suggestionsText)
    this.currentSuggestions = suggestions

    // Check if we have any valid suggestions
    if (suggestions.length === 0) {
      this.showError("Geçerli etkinlik önerisi bulunamadı.")
      return
    }

    // Build HTML content
    let htmlContent = ""

    // Add intro text if available
    if (introText) {
      htmlContent += `<div class="intro-text-container">${introText}</div>`
    }

    // Add suggestions list
    htmlContent += `
      <div class="suggestions-list">
        ${suggestions
          .map(
            (item, index) => `
            <div class="event-item">
              <h4 class="event-title">${item.title}</h4>
              <p class="event-description">${item.description}</p>
              <div class="event-meta">
                <span class="event-location"><i class="fas fa-map-marker-alt"></i> ${item.location}</span>
              </div>
              <div class="event-actions">
                <button class="event-btn event-btn-primary btn-click-effect" onclick="window.eventManager.showOnMap(${index})">
                  <i class="fas fa-map"></i> Haritada Göster
                </button>
                <button class="event-btn event-btn-secondary btn-click-effect" onclick="window.eventManager.addToRoute(${index})">
                  <i class="fas fa-plus-circle"></i> Rotaya Ekle
                </button>
              </div>
            </div>
          `,
          )
          .join("")}
      </div>
    `

    // Update the content container
    this.contentContainer.innerHTML = htmlContent

    // Display all suggestions on the map
    this.displaySuggestionsOnMap(suggestions)
  }

  parseGeminiSuggestions(suggestionsText) {
    const suggestions = []
    let introText = ""

    // First, check for and extract introductory text
    const introPatterns = [
      /^.*?için.*?alternatif.*?öneri/i,
      /^.*?için.*?kısa.*?mola/i,
      /^.*?şehir.*?için.*?öneri/i,
      /^işte.*?için.*?öneri/i,
    ]

    let processedText = suggestionsText

    // Check if the text starts with introductory content
    for (const pattern of introPatterns) {
      const match = suggestionsText.match(pattern)
      if (match) {
        // Extract the intro text
        const matchedText = match[0]
        introText = matchedText

        // Remove it from the text to be processed
        processedText = suggestionsText.replace(matchedText, "").trim()
        console.log("Found intro text:", introText)
        console.log("Remaining text:", processedText)
        break
      }
    }

    // Split the text by numbered lines (1., 2., etc.)
    const suggestionLines = processedText.split(/\d+\.\s/).filter((line) => line.trim().length > 0)

    suggestionLines.forEach((line, index) => {
      // Skip empty lines or lines that are too short
      if (line.trim().length < 10) return

      // Extract location name and description
      const parts = line.split(":")
      if (parts.length >= 2) {
        const locationPart = parts[0].trim()
        const descriptionPart = parts.slice(1).join(":").trim()

        // Skip if this looks like introductory text
        if (this.isIntroductoryText(locationPart)) {
          return
        }

        // Extract city and place name
        const locationMatch = locationPart.match(/([^–-]+)[–-]\s*(.+)/)
        let city = ""
        let place = ""

        if (locationMatch && locationMatch.length >= 3) {
          city = locationMatch[1].trim()
          place = locationMatch[2].trim()
        } else {
          // Fallback if the format doesn't match
          place = locationPart
        }

        // Only add if we have a valid place name
        if (place && place.length > 2) {
          suggestions.push({
            id: index,
            title: place,
            location: city ? `${place}, ${city}` : place,
            description: descriptionPart,
            city: city,
            // Use different marker colors based on index
            markerColor: this.getMarkerColor(index),
          })
        }
      }
    })

    return { introText, suggestions }
  }

  /**
   * Check if a text line is introductory content that shouldn't be processed as a location
   */
  isIntroductoryText(text) {
    const introKeywords = ["için", "alternatif", "öneri", "kısa mola", "işte", "şehir", "rotanız", "yolculuk"]

    const lowerText = text.toLowerCase()
    let keywordCount = 0

    for (const keyword of introKeywords) {
      if (lowerText.includes(keyword)) {
        keywordCount++
      }
    }

    // If it contains multiple intro keywords and is relatively short, it's likely intro text
    return keywordCount >= 2 && text.length < 100
  }

  getMarkerColor(index) {
    const colors = ["purple", "yellow", "green", "blue", "orange", "red"]
    return colors[index % colors.length]
  }

  displaySuggestionsOnMap(suggestions) {
    // Clear any existing suggestion markers
    this.clearSuggestionMarkers()

    // If no map manager is available, exit
    if (!window.app || !window.app.mapManager) return

    // Create markers for each suggestion
    suggestions.forEach((suggestion) => {
      this.geocodeAndAddMarker(suggestion)
    })
  }

  clearSuggestionMarkers() {
    if (this.suggestionMarkers && this.suggestionMarkers.length > 0) {
      this.suggestionMarkers.forEach((marker) => {
        if (marker) marker.setMap(null)
      })
    }
    this.suggestionMarkers = []
  }

  geocodeAndAddMarker(suggestion) {
    // If Google Maps is not available, exit
    if (!window.google || !window.google.maps) return

    const geocoder = new window.google.maps.Geocoder()
    const searchQuery = suggestion.city
      ? `${suggestion.title}, ${suggestion.city}, Türkiye`
      : `${suggestion.title}, Türkiye`

    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === "OK" && results && results.length > 0) {
        const location = results[0].geometry.location

        // Store the geocoded location in the suggestion object
        suggestion.geocodedLocation = {
          lat: location.lat(),
          lng: location.lng(),
        }

        // Create a marker for this suggestion
        const marker = window.app.mapManager.addMarker(
          {
            lat: location.lat(),
            lng: location.lng(),
          },
          suggestion.title,
          {
            url: `https://maps.google.com/mapfiles/ms/icons/${suggestion.markerColor}-dot.png`,
          },
        )

        // Add click event to the marker
        marker.addListener("click", () => {
          this.showSuggestionInfoWindow(marker, suggestion)
        })

        // Store the marker reference
        if (!this.suggestionMarkers) this.suggestionMarkers = []
        this.suggestionMarkers.push(marker)
      } else {
        console.warn(`Geocoding failed for "${searchQuery}": ${status}`)
      }
    })
  }

  /**
   * Etkinliği haritada gösterir
   * @param {number} id - Etkinlik ID'si
   */
  showOnMap(id) {
    const suggestion = this.currentSuggestions.find((s) => s.id === id)
    if (!suggestion) return

    // If we have a geocoded location, use it
    if (suggestion.geocodedLocation) {
      if (window.app && window.app.mapManager) {
        // Center the map on this location
        window.app.mapManager.setCenter(suggestion.geocodedLocation)
        window.app.mapManager.setZoom(15)

        // Find marker by suggestion ID instead of coordinates
        const markerIndex = this.currentSuggestions.findIndex(s => s.id === id)
        if (markerIndex >= 0 && this.suggestionMarkers[markerIndex]) {
          window.google.maps.event.trigger(this.suggestionMarkers[markerIndex], 'click')
        }
      }
    } else {
      // If no geocoded location yet, try to geocode it now
      this.geocodeAndShowLocation(suggestion)
    }
  }

  geocodeAndShowLocation(suggestion) {
    if (!window.google || !window.google.maps) return

    const geocoder = new window.google.maps.Geocoder()
    const searchQuery = suggestion.city
      ? `${suggestion.title}, ${suggestion.city}, Türkiye`
      : `${suggestion.title}, Türkiye`

    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === "OK" && results && results.length > 0) {
        const location = results[0].geometry.location

        // Store the geocoded location
        suggestion.geocodedLocation = {
          lat: location.lat(),
          lng: location.lng(),
        }

        // Show on map
        if (window.app && window.app.mapManager) {
          window.app.mapManager.setCenter(suggestion.geocodedLocation)
          window.app.mapManager.setZoom(15)

          // Create a marker if it doesn't exist
          if (!this.suggestionMarkers) this.suggestionMarkers = []

          const existingMarkerIndex = this.currentSuggestions.findIndex((s) => s.id === suggestion.id)
          if (existingMarkerIndex >= 0 && !this.suggestionMarkers[existingMarkerIndex]) {
            const marker = window.app.mapManager.addMarker(suggestion.geocodedLocation, suggestion.title, {
              url: `https://maps.google.com/mapfiles/ms/icons/${suggestion.markerColor}-dot.png`,
            })

            marker.addListener("click", () => {
              this.showSuggestionInfoWindow(marker, suggestion)
            })

            this.suggestionMarkers[existingMarkerIndex] = marker

            // Trigger click event to show info window
            window.google.maps.event.trigger(marker, "click")
          }
        }
      } else {
        console.warn(`Geocoding failed for "${searchQuery}": ${status}`)
        this.showError(`"${suggestion.title}" konumu bulunamadı.`)
      }
    })
  }

  /**
   * Etkinliği rotaya ekler
   * @param {number} id - Etkinlik ID'si
   */
  addToRoute(id) {
    const suggestion = this.currentSuggestions.find((s) => s.id === id)
    if (!suggestion) return

    // If we have a geocoded location, use it
    if (suggestion.geocodedLocation) {
      if (window.app && window.app.routeManager) {
        window.app.routeManager.addWaypoint(
          suggestion.geocodedLocation.lat,
          suggestion.geocodedLocation.lng,
          suggestion.title,
        )

        // Show success message
        this.showSuccess(`${suggestion.title} rotanıza eklendi.`)
      }
    } else {
      // If no geocoded location yet, try to geocode it now
      this.geocodeAndAddToRoute(suggestion)
    }
  }

  geocodeAndAddToRoute(suggestion) {
    if (!window.google || !window.google.maps) return

    const geocoder = new window.google.maps.Geocoder()
    const searchQuery = suggestion.city
      ? `${suggestion.title}, ${suggestion.city}, Türkiye`
      : `${suggestion.title}, Türkiye`

    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === "OK" && results && results.length > 0) {
        const location = results[0].geometry.location

        // Store the geocoded location
        suggestion.geocodedLocation = {
          lat: location.lat(),
          lng: location.lng(),
        }

        // Add to route
        if (window.app && window.app.routeManager) {
          window.app.routeManager.addWaypoint(
            suggestion.geocodedLocation.lat,
            suggestion.geocodedLocation.lng,
            suggestion.title,
          )

          // Show success message
          this.showSuccess(`${suggestion.title} rotanıza eklendi.`)
        }
      } else {
        console.warn(`Geocoding failed for "${searchQuery}": ${status}`)
        this.showError(`"${suggestion.title}" konumu bulunamadı.`)
      }
    })
  }

  showSuggestionInfoWindow(marker, suggestion) {
    if (!window.app || !window.app.mapManager) return

    // Create info window content with proper styling
    const content = `
      <div class="info-window-content suggestion-info-window">
        <div class="info-header">
          <h3>${suggestion.title}</h3>
          <button class="close-button" onclick="window.closeInfoWindow()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="info-content">
          <p><i class="fas fa-map-marker-alt"></i> ${suggestion.location}</p>
          <p>${suggestion.description}</p>
          <div class="info-buttons">
            <button class="action-btn" onclick="window.eventManager.addToRoute(${suggestion.id})">
              <i class="fas fa-plus-circle"></i> Rotaya Ekle
            </button>
          </div>
        </div>
      </div>
    `

    // Define closeInfoWindow function globally if it doesn't exist
    if (typeof window.closeInfoWindow !== "function") {
      window.closeInfoWindow = () => {
        if (window.app && window.app.mapManager && window.app.mapManager.currentInfoWindow) {
          window.app.mapManager.currentInfoWindow.close()
        }
      }
    }

    // Show the info window
    window.app.mapManager.showInfoWindow(marker, content)
  }
}

// Create a global instance that can be accessed by AppManager
document.addEventListener("DOMContentLoaded", () => {
  if (!window.eventManager) {
    window.eventManager = new window.EventSuggestionsManager()
    console.log("Global eventManager instance created")
  }
})
