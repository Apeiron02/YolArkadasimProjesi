/**
 * Şarj Ücreti Hesaplama Modülü
 * Elektrikli araç şarj maliyeti hesaplama işlemlerini yönetir
 */
class SarjUcretHesaplayici {
    constructor() {
      // DOMContentLoaded içinde tüm başlatmaları yapalım
      document.addEventListener("DOMContentLoaded", () => {
        this.initEventListeners()
      })
    }
  
    /**
     * Olay dinleyicilerini başlatır
     */
    initEventListeners() {
      console.log("Olay dinleyicileri başlatılıyor...")
  
      // Hesaplama butonu olayını dinle
      const hesaplaButton = document.getElementById("hesaplaButton")
      if (hesaplaButton) {
        console.log("Hesapla butonu bulundu, olay dinleyici ekleniyor")
        hesaplaButton.addEventListener("click", () => this.hesaplamaYap())
      } else {
        console.error("'hesaplaButton' ID'li element bulunamadı!")
      }
  
      // Tüm başlatma fonksiyonlarını çağır
      this.initRangeInputs()
      this.initSarjIstasyonuSecim()
      this.initAracModeliSecim()
    }
  
    /**
     * Araç modeli seçim işlevselliğini başlatır
     */
    initAracModeliSecim() {
      const aracModeliSelect = document.getElementById("aracmodeli")
      const bataryaKapasitesiElement = document.getElementById("bataryakapasitesi")
  
      if (!aracModeliSelect || !bataryaKapasitesiElement) {
        console.error("Araç modeli veya batarya kapasitesi elementi bulunamadı")
        return
      }
  
      console.log("Araç modeli seçim işlevselliği başlatılıyor")
  
      // Sayfa ilk yüklendiğinde seçili araç varsa batarya değerini kontrol et
      if (aracModeliSelect.selectedIndex > 0) {
        const selectedOption = aracModeliSelect.options[aracModeliSelect.selectedIndex]
        const kwhValue = selectedOption.getAttribute("data-kwh")
  
        // Eğer batarya kapasitesi zaten gösterilmiyorsa güncelle
        if (bataryaKapasitesiElement.querySelector(".placeholder-text")) {
          if (kwhValue && kwhValue !== "None" && kwhValue !== "") {
            bataryaKapasitesiElement.innerHTML = `${kwhValue} kWh`
          }
        }
      }
  
      aracModeliSelect.addEventListener("change", () => {
        const selectedOption = aracModeliSelect.options[aracModeliSelect.selectedIndex]
        const kwhValue = selectedOption.getAttribute("data-kwh")
  
        // Batarya kapasitesi span içeriğini güncelle
        if (kwhValue && kwhValue !== "None" && kwhValue !== "") {
          bataryaKapasitesiElement.innerHTML = `${kwhValue} kWh`
        } else {
          bataryaKapasitesiElement.innerHTML = '<span class="placeholder-text">Araç seçildiğinde görüntülenecek</span>'
        }
      })
    }
  
    /**
     * Range input işlevselliğini başlatır
     */
    initRangeInputs() {
      console.log("Range input işlevselliği başlatılıyor")
  
      // Range input'ları bir döngüde işleyelim
      const rangeInputs = [
        { input: "mevcutsarj", value: "mevcutsarjValue" },
        { input: "hedefsarj", value: "hedefsarjValue" },
      ]
  
      rangeInputs.forEach((item) => {
        const input = document.getElementById(item.input)
        const valueDisplay = document.getElementById(item.value)
  
        if (!input || !valueDisplay) {
          console.error(`Range input veya değer göstergesi bulunamadı: ${item.input}`)
          return
        }
  
        // İlk değeri ayarla
        valueDisplay.textContent = `${input.value}%`
  
        // Değişiklik olayını dinle
        input.addEventListener("input", () => {
          valueDisplay.textContent = `${input.value}%`
        })
      })
    }
  
    /**
     * Şarj istasyonu seçim işlevselliğini başlatır
     */
    initSarjIstasyonuSecim() {
      console.log("Şarj istasyonu seçim işlevselliği başlatılıyor")
  
      const providerTabs = document.querySelectorAll(".provider-tab")
      const providerPanels = document.querySelectorAll(".provider-panel")
      const fiyatItems = document.querySelectorAll(".fiyat-item")
      const elektrikFiyatiInput = document.getElementById("elektrikfiyati")
  
      if (!providerTabs.length) {
        console.error("Şarj istasyonu sekmeleri bulunamadı")
        return
      }
  
      if (!elektrikFiyatiInput) {
        console.error("Elektrik fiyatı input elementi bulunamadı")
        return
      }
  
      // Tab değiştirme işlevi
      providerTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          // Aktif tab'ı değiştir
          providerTabs.forEach((t) => t.classList.remove("active"))
          tab.classList.add("active")
  
          // İlgili paneli göster
          const provider = tab.getAttribute("data-provider")
  
          // Tüm panelleri gizle
          providerPanels.forEach((panel) => panel.classList.remove("active"))
  
          // Seçilen paneli göster
          const selectedPanel = document.getElementById(`${provider}FiyatPanel`)
          if (selectedPanel) {
            selectedPanel.classList.add("active")
  
            // Seçilen paneldeki ilk fiyat öğesini seç
            const firstOption = selectedPanel.querySelector(".fiyat-item")
            if (firstOption) {
              this.selectFiyatItem(firstOption, fiyatItems, elektrikFiyatiInput)
            }
          }
        })
      })
  
      // Fiyat seçimi
      fiyatItems.forEach((item) => {
        item.addEventListener("click", () => {
          this.selectFiyatItem(item, fiyatItems, elektrikFiyatiInput)
        })
      })
  
      // İlk fiyat öğesini seç (varsayılan olarak)
      if (fiyatItems.length > 0) {
        this.selectFiyatItem(fiyatItems[0], fiyatItems, elektrikFiyatiInput)
      }
    }
  
    /**
     * Fiyat öğesi seçimi için yardımcı fonksiyon
     */
    selectFiyatItem(item, allItems, fiyatInput) {
      // Seçilen fiyatı vurgula
      allItems.forEach((i) => i.classList.remove("selected"))
      item.classList.add("selected")
  
      // Fiyatı güncelle
      const fiyatDegeri = item.getAttribute("data-value")
  
      if (fiyatInput) {
        fiyatInput.value = fiyatDegeri
      }
    }
  
    /**
     * Şarj ücreti hesaplamasını yapar
     */
    hesaplamaYap() {
      console.log("Hesaplama yapılıyor...")
  
      // Batarya kapasitesini span içeriğinden al
      const bataryaKapasitesiElement = document.getElementById("bataryakapasitesi")
      let bataryaKapasite = 0
  
      if (bataryaKapasitesiElement) {
        // Span içeriğinden kWh kısmını temizleyerek sayısal değeri al
        const kapasiteText = bataryaKapasitesiElement.textContent.trim()
  
        // Placeholder değil, gerçek bir değer var mı kontrol et
        if (!kapasiteText.includes("görüntülenecek")) {
          bataryaKapasite = Number.parseFloat(kapasiteText.replace(" kWh", ""))
        } else {
          // Seçili aracın data-kwh özelliğini kontrol et
          const aracModeliSelect = document.getElementById("aracmodeli")
          if (aracModeliSelect && aracModeliSelect.selectedIndex > 0) {
            const selectedOption = aracModeliSelect.options[aracModeliSelect.selectedIndex]
            const kwhValue = selectedOption.getAttribute("data-kwh")
            if (kwhValue && kwhValue !== "None" && kwhValue !== "") {
              bataryaKapasite = Number.parseFloat(kwhValue)
            }
          }
        }
      }
  
      const mevcutSarj = Number.parseFloat(document.getElementById("mevcutsarj").value)
      const hedefSarj = Number.parseFloat(document.getElementById("hedefsarj").value)
      const elektrikFiyati = Number.parseFloat(document.getElementById("elektrikfiyati").value)
  
      console.log(
        `Hesaplama değerleri: Batarya: ${bataryaKapasite}, Mevcut: ${mevcutSarj}, Hedef: ${hedefSarj}, Fiyat: ${elektrikFiyati}`,
      )
  
      // Değerlerin geçerli olup olmadığını kontrol et
      if (isNaN(bataryaKapasite) || bataryaKapasite <= 0) {
        alert("Lütfen geçerli bir batarya kapasitesi giriniz.")
        return
      }
  
      if (hedefSarj <= mevcutSarj) {
        alert("Hedef şarj seviyesi mevcut şarj seviyesinden büyük olmalıdır.")
        return
      }
  
      if (isNaN(elektrikFiyati) || elektrikFiyati <= 0) {
        alert("Lütfen bir şarj istasyonu ve soket tipi seçiniz.")
        return
      }
  
      // Hesaplama
      const sarjEnerji = (bataryaKapasite * (hedefSarj - mevcutSarj)) / 100
      const toplamUcret = sarjEnerji * elektrikFiyati
      const kmMaliyet = (elektrikFiyati * 15) / 100 // 15 kWh/100km tüketim varsayımı
  
      console.log(`Hesaplama sonuçları: Enerji: ${sarjEnerji}, Ücret: ${toplamUcret}, km Maliyet: ${kmMaliyet}`)
  
      // Sonuçları göster
      const sonucElements = {
        sarjenerji: sarjEnerji.toFixed(2),
        sonuc: toplamUcret.toFixed(2),
        birimfiyat: elektrikFiyati.toFixed(2),
        kmmaliyet: kmMaliyet.toFixed(2),
      }
  
      // Tüm sonuç elementlerini güncelle
      Object.entries(sonucElements).forEach(([id, value]) => {
        const element = document.getElementById(id)
        if (element) element.textContent = value
      })
  
      // Sonuç bölümünü göster
      const resultSection = document.querySelector(".result-section")
      if (resultSection) {
        resultSection.classList.add("active")
        // Sayfayı sonuç bölümüne kaydır
        resultSection.scrollIntoView({ behavior: "smooth" })
      }
  
      // Hesaplama sonuçlarını veritabanına kaydet
      this.kaydetHesaplamaSonucu(bataryaKapasite, mevcutSarj, hedefSarj, elektrikFiyati, sarjEnerji, toplamUcret)
    }
  
    /**
     * Hesaplama sonuçlarını veritabanına kaydeder
     */
    kaydetHesaplamaSonucu(bataryaKapasite, mevcutSarj, hedefSarj, elektrikFiyati, sarjEnerji, toplamUcret) {
      console.log("Hesaplama sonuçları veritabanına kaydediliyor...")
  
      // Seçili aracın adını al
      const aracModeliSelect = document.getElementById("aracmodeli")
      let aracAdi = "Bilinmeyen Araç"
  
      if (aracModeliSelect && aracModeliSelect.selectedIndex > 0) {
        aracAdi = aracModeliSelect.options[aracModeliSelect.selectedIndex].text
      }
  
      // Seçili şarj istasyonunu al
      const activeTab = document.querySelector(".provider-tab.active")
      let firma = "Bilinmeyen"
  
      if (activeTab) {
        firma = activeTab.textContent.trim()
      }
  
      // CSRF token'ı al
      const csrfTokenElement = document.querySelector('input[name="csrfmiddlewaretoken"]')
      if (!csrfTokenElement) {
        console.error("CSRF token bulunamadı!")
        return
      }
  
      const csrfToken = csrfTokenElement.value
  
      // Verileri hazırla
      const hesaplamaVerileri = {
        arac: aracAdi,
        arac_kwh: bataryaKapasite,
        firma: firma,
        baslangic_sarj: mevcutSarj,
        varis_sarj: hedefSarj,
        doldurulan_enerji: sarjEnerji,
        toplam_ucret: toplamUcret,
      }
  
      console.log("Gönderilecek veriler:", hesaplamaVerileri)
  
      // Sunucuya gönder
      fetch("/sarj-ucreti/kaydet/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify(hesaplamaVerileri),
      })
        .then((response) => {
          console.log("Sunucu yanıtı:", response)
          if (!response.ok) {
            throw new Error(`HTTP hata! Durum: ${response.status}`)
          }
          return response.json()
        })
        .then((data) => {
          console.log("Sunucudan gelen veri:", data)
          if (data.success) {
            console.log("Hesaplama sonucu başarıyla kaydedildi:", data)
  
            // Kullanıcıya bildirim göster
            const bildirimElement = document.createElement("div")
            bildirimElement.className = "alert alert-success mt-3"
            bildirimElement.textContent = "Hesaplama sonucu başarıyla kaydedildi."
  
            const resultSection = document.querySelector(".result-section")
            if (resultSection) {
              resultSection.appendChild(bildirimElement)
  
              // 5 saniye sonra bildirimi kaldır
              setTimeout(() => {
                bildirimElement.remove()
              }, 5000)
            }
          } else {
            console.error("Hesaplama sonucu kaydedilemedi:", data.message)
            alert("Hesaplama sonucu kaydedilemedi: " + data.message)
          }
        })
        .catch((error) => {
          console.error("Hesaplama sonucu gönderilirken hata oluştu:", error)
          alert("Hesaplama sonucu gönderilirken hata oluştu. Lütfen tekrar deneyin.")
        })
    }
  }
  
  // Sayfa yüklendiğinde hesaplayıcıyı başlat
  const sarjUcretHesaplayici = new SarjUcretHesaplayici()
  