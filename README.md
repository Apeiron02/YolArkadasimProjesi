# Yol Arkadaşım - Elektrikli Araç Rota Planlayıcı

## 📱 Proje Hakkında
Yol Arkadaşım, elektrikli araç kullanıcıları için özel olarak tasarlanmış, rota planlama ve şarj istasyonu bulma uygulamasıdır. Kullanıcıların elektrikli araçlarına özel rotalar oluşturmasına, şarj istasyonlarını görüntülemesine ve yolculuk planlamasına olanak sağlar.

## 🛠️ Kullanılan Teknolojiler
- **Backend Framework:** Django
- **Veritabanı:** SQLite
- **Frontend:** HTML, CSS, JavaScript
- **Harita Entegrasyonu:** Google Maps API
- **Kimlik Doğrulama:** Django Authentication System

## ✨ Temel Özellikler
- 🗺️ Elektrikli araçlara özel rota planlama
- 🔌 Şarj istasyonu konumları ve detayları
- 🚗 Araç bazlı menzil hesaplama
- 👤 Kullanıcı profil yönetimi
- 💰 Şarj ücreti hesaplama
- 📱 Responsive tasarım

## 🖼️ Ekran Görüntüleri

### Giriş Sayfası
![Giriş Sayfası](screens/GrisSayfası.png)
*Kullanıcı giriş ekranı*

### Harita Sayfası
![Harita Sayfası 1](screens/HaritaSayfası_1.png)
*Harita sayfasının açılış ekranı*

![Harita Sayfası 2](screens/HaritaSayfası_2.png)
*Oluşturulan rota sonucunda yetersiz menzil sonucu şarj istasyonu önerisi*

![Harita Sayfası 3](screens/HaritaSayfası_3.png)
*Oluşturulan rota üzerinde ki şehirlerde mola noktası önerileri*

![Harita Sayfası 4](screens/HaritaSayfası_4.png)
*Oluşturulan rotanın trafik durumu ile gösterimi*

![Harita Sayfası 5](screens/HaritaSayfası_5.png)
*Seçilen nokta etrafında ki şarj istasyonlarının gösterimi*

![Harita Sayfası 6](screens/HaritaSayfası_6.png)
*Seçilen şarj istasyonunun etrafında bulunan restorantların gösterimi*

### Şarj Maliyet Sayfası

![Şarj Ücreti](screens/SarjUcretiSayfası.png)
*Şarj ücreti hesaplama ve ödeme seçenekleri*


### Kullanıcı Arayüzü
![Kullanıcı Bilgileri](screens/KullanıcıBilgileriSayfası.png)
*Kullanıcı profil ve tercih yönetimi*



## 🚀 Kurulum

1. Projeyi klonlayın:
```bash
git clone https://github.com/kullaniciadi/yol-arkadasim.git
```

2. Sanal ortam oluşturun ve aktifleştirin:
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac için
.venv\Scripts\activate     # Windows için
```

3. Gerekli paketleri yükleyin:
```bash
pip install -r requirements.txt
```

4. Veritabanı migrasyonlarını yapın:
```bash
python manage.py migrate
```

5. Geliştirme sunucusunu başlatın:
```bash
python manage.py runserver
```

## 📝 Lisans
Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakınız.

## 👥 Katkıda Bulunma
1. Bu depoyu fork edin
2. Yeni bir branch oluşturun (`git checkout -b feature/yeniOzellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik: Açıklama'`)
4. Branch'inizi push edin (`git push origin feature/yeniOzellik`)
5. Pull Request oluşturun
