from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time
import datetime
from django.http import JsonResponse
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
import json
from django.contrib.auth.decorators import login_required
from .models import SarjGecmisi

from .models import (
    ZESFiyat, ZESFiyatGecmisi, 
    TrugoFiyat, TrugoFiyatGecmisi,
    VoltrunFiyat, VoltrunFiyatGecmisi,
    EsarjFiyat, EsarjFiyatGecmisi
)
from kullanicibilgileri.models import ElectricCar, UserCarPreference  # Import the ElectricCar model
import re

# Create your views here.
@login_required
def sarj_ucret(request):
    # Her şarj tipi için en son fiyatı al
    # ZES fiyatları
    sarj_tipleri = ZESFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
    zes_fiyatlari = []
    
    for sarj_tipi in sarj_tipleri:
        latest = ZESFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
        if latest:
            zes_fiyatlari.append(latest)
    
    # Trugo fiyatları
    trugo_sarj_tipleri = TrugoFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
    trugo_fiyatlari = []
    
    for sarj_tipi in trugo_sarj_tipleri:
        latest = TrugoFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
        if latest:
            trugo_fiyatlari.append(latest)
    
    # Get Voltrun prices
    voltrun_fiyatlari = []
    voltrun_membership_types = VoltrunFiyat.objects.values_list('membership_type', 'sarj_tipi').distinct()
    
    for membership_type, sarj_tipi in voltrun_membership_types:
        latest = VoltrunFiyat.objects.filter(
            membership_type=membership_type,
            sarj_tipi=sarj_tipi
        ).order_by('-eklenme_tarihi').first()
        if latest:
            voltrun_fiyatlari.append(latest)
    
    # Get Esarj prices
    esarj_sarj_tipleri = EsarjFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
    esarj_fiyatlari = []
    
    for sarj_tipi in esarj_sarj_tipleri:
        latest = EsarjFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
        if latest:
            esarj_fiyatlari.append(latest)
    
    # Get all electric cars
    electric_cars = ElectricCar.objects.all().order_by('car_name')
    
    # Get user's preferred car if user is authenticated
    user_car_preference = None
    if request.user.is_authenticated:
        user_car_preference = UserCarPreference.objects.filter(user=request.user).first()
    
    return render(request, 'sarjucret/sarj_ucret.html', {
        'zes_fiyatlari': zes_fiyatlari,
        'trugo_fiyatlari': trugo_fiyatlari,
        'voltrun_fiyatlari': voltrun_fiyatlari,
        'esarj_fiyatlari': esarj_fiyatlari,
        'electric_cars': electric_cars,
        'user_car_preference': user_car_preference  # Pass user's car preference to the template
    })

def extract_price_value(price_text):
    """Fiyat metninden sayısal değeri çıkarır"""
    try:
        # "X.XX TL / kWh" gibi bir metinden x.xx değerini çıkar
        cleaned = price_text.replace('TL', '').replace('/', '').replace('kWh', '').replace(',', '.').replace('₺', '').strip()
        return float(cleaned)
    except:
        return 0.0

# ZES fiyatları için fonksiyonlar
def scrape_zes_prices():
    """ZES web sitesinden fiyat bilgilerini çeker"""
    print("ZES fiyatları çekiliyor...")
    
    prices_dict = {}  # charger_type -> (fiyat metni, fiyat değeri) şeklinde sözlük
    scraping_success = False
    
    # Selenium ile deneyelim
    try:
        print("Selenium ile fiyatları çekmeye çalışıyorum...")
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(30)  # Sayfa yükleme zaman aşımını artır
        driver.implicitly_wait(10)  # Element bulma zaman aşımını artır
        
        print("Selenium tarayıcısı başlatıldı, sayfayı yüklüyorum...")
        driver.get("https://zes.net/fiyatlar-tr")
        print("Sayfa yüklendi, tam yüklenmesi için bekleniyor...")
        time.sleep(10)  # JavaScript'in tam yüklenmesi için daha uzun bekle
        
        # Sayfayı aşağı kaydır (scroll)
        print("Sayfa aşağı kaydırılıyor...")
        for i in range(3):  # Birkaç kez scroll yapalım
            driver.execute_script("window.scrollBy(0, 500);")  # 500 piksel aşağı kaydır
            time.sleep(1)  # Her scroll sonrası biraz bekle
        
        # Çerez popup'ını kabul et
        try:
            print("Çerez popup'ı aranıyor...")
            # XPath ile daha spesifik olarak okudum anladım butonunu bul
            cookie_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'Okudum') or contains(., 'Anladım') or contains(., 'Tamam')]")
            if cookie_buttons:
                print(f"Çerez butonu bulundu: {cookie_buttons[0].text}")
                cookie_buttons[0].click()
                time.sleep(2)
            else:
                # Buton bulunamadıysa, tüm butonları kontrol et
                buttons = driver.find_elements(By.TAG_NAME, "button")
                for button in buttons:
                    button_text = button.text.lower()
                    if "kabul" in button_text or "tamam" in button_text or "accept" in button_text or "cookie" in button_text or "okudum" in button_text or "anladım" in button_text:
                        print(f"Çerez butonu bulundu: {button_text}")
                        button.click()
                        time.sleep(2)
                        break
        except Exception as e:
            print(f"Çerez popup işleminde hata: {str(e)}")
        
        # Tekrar scroll yapalım
        print("Çerez popup'ı kapatıldıktan sonra tekrar scroll yapılıyor...")
        driver.execute_script("window.scrollBy(0, 700);")  # Biraz daha aşağı kaydır
        time.sleep(2)  # Fiyat tablolarının görünür olması için bekle
        
        # Daha spesifik fiyat tablo sorguları
        print("Fiyat tabloları için özel sorgular deneniyor...")
        
        # AC Soket Tarifesi
        ac_table_elements = driver.find_elements(By.XPATH, "//div[contains(text(), 'AC Soket Tarifesi') or contains(text(), 'AC Soket')]//following::table[1]//tr")
        for row in ac_table_elements:
            cells = row.find_elements(By.TAG_NAME, "td")
            if len(cells) >= 2:
                try:
                    power_type = cells[0].text.strip()
                    price_text = cells[1].text.strip()
                    if "TL" in price_text:
                        price_value = extract_price_value(price_text)
                        charger_type = f"AC Soket - {power_type}" if power_type else "AC Soket - 22 kW Soketler"
                        if price_value > 0:
                            prices_dict[charger_type] = (price_text, price_value)
                            print(f"AC Tarifesi bulundu: {charger_type}: {price_text} ({price_value})")
                            scraping_success = True
                except Exception as e:
                    print(f"AC tarife satırı okunurken hata: {str(e)}")
        
        # DC Soket Tarifesi
        dc_table_elements = driver.find_elements(By.XPATH, "//div[contains(text(), 'DC Soket Tarifesi') or contains(text(), 'DC Soket')]//following::table[1]//tr")
        for row in dc_table_elements:
            cells = row.find_elements(By.TAG_NAME, "td")
            if len(cells) >= 2:
                try:
                    power_type = cells[0].text.strip()
                    price_text = cells[1].text.strip()
                    if "TL" in price_text:
                        price_value = extract_price_value(price_text)
                        charger_type = f"DC Soket - {power_type}" if power_type else "DC Soket"
                        if price_value > 0:
                            prices_dict[charger_type] = (price_text, price_value)
                            print(f"DC Tarifesi bulundu: {charger_type}: {price_text} ({price_value})")
                            scraping_success = True
                except Exception as e:
                    print(f"DC tarife satırı okunurken hata: {str(e)}")
        
        # Eski yöntem - Eğer yeni yöntem başarısız olursa
        if not scraping_success:
            print("Tablo elemanlarını arıyorum (eski yöntem)...")
            
            # Tablo hücrelerini bul - daha kapsamlı XPath kullanımı
            cells = driver.find_elements(By.XPATH, "//*[contains(text(), 'TL') or contains(text(), '₺') or contains(text(), 'kWh')]")
            print(f"{len(cells)} adet tablo hücresi bulundu.")
            
            # Sabit şarj tipleri
            zes_charge_types = {
                "AC Soket - 22 kW Soketler": None,
                "DC Soket - 180 kW'ın altı": None,
                "DC Soket - 180 kW - 400 kW arası": None
            }
            
            for cell in cells:
                cell_text = cell.text.strip()
                if "TL / kWh" in cell_text or "TL/kWh" in cell_text or ("TL" in cell_text and "kWh" in cell_text):
                    price_text = cell_text
                    price_value = extract_price_value(price_text)
                    
                    if price_value > 0:
                        # Eğer hücrede AC Soket bilgisi varsa
                        if "AC" in cell_text or "ac" in cell_text.lower():
                            zes_charge_types["AC Soket - 22 kW Soketler"] = (price_text, price_value)
                            print(f"AC Soket fiyatı bulundu: {price_text} ({price_value})")
                            scraping_success = True
                        # Eğer hücrede DC Soket bilgisi ve 180 kW bilgisi varsa
                        elif ("DC" in cell_text or "dc" in cell_text.lower()) and "180" in cell_text:
                            if "altı" in cell_text.lower() or "alt" in cell_text.lower() or "below" in cell_text.lower():
                                zes_charge_types["DC Soket - 180 kW'ın altı"] = (price_text, price_value)
                                print(f"DC Soket - 180 kW'ın altı fiyatı bulundu: {price_text} ({price_value})")
                                scraping_success = True
                            elif "arası" in cell_text.lower() or "aras" in cell_text.lower() or "between" in cell_text.lower():
                                zes_charge_types["DC Soket - 180 kW - 400 kW arası"] = (price_text, price_value)
                                print(f"DC Soket - 180 kW - 400 kW arası fiyatı bulundu: {price_text} ({price_value})")
                                scraping_success = True
            
            # Fiyatları tablonun sırasına göre belirle (hangi fiyat henüz eşleşmedi ise)
            if len(zes_charge_types) != len([v for v in zes_charge_types.values() if v is not None]):
                # Fiyatları sırala
                sorted_prices = []
                for cell in cells:
                    cell_text = cell.text.strip()
                    if "TL / kWh" in cell_text or "TL/kWh" in cell_text or ("TL" in cell_text and "kWh" in cell_text):
                        price_value = extract_price_value(cell_text)
                        if price_value > 0:
                            sorted_prices.append((cell_text, price_value))
                
                # Fiyatları büyükten küçüğe sırala (DC yüksek fiyatlı, AC düşük fiyatlı)
                sorted_prices.sort(key=lambda x: x[1], reverse=True)
                
                # Sıralanmış fiyatları yerleştir
                if zes_charge_types["AC Soket - 22 kW Soketler"] is None and len(sorted_prices) >= 1:
                    zes_charge_types["AC Soket - 22 kW Soketler"] = sorted_prices[-1]  # En düşük fiyat genelde AC
                
                if zes_charge_types["DC Soket - 180 kW'ın altı"] is None and len(sorted_prices) >= 2:
                    zes_charge_types["DC Soket - 180 kW'ın altı"] = sorted_prices[1]  # Orta fiyat
                
                if zes_charge_types["DC Soket - 180 kW - 400 kW arası"] is None and len(sorted_prices) >= 1:
                    zes_charge_types["DC Soket - 180 kW - 400 kW arası"] = sorted_prices[0]  # En yüksek fiyat
            
            # None olmayan değerleri prices_dict'e ekle
            for charge_type, price_info in zes_charge_types.items():
                if price_info is not None:
                    prices_dict[charge_type] = price_info
        
        # Alternatif olarak doğrudan HTML içerik taraması yapalım
        if not scraping_success or "DC Soket - 180 kW'ın altı" not in prices_dict:
            print("HTML içerik taraması yapılıyor...")
            page_source = driver.page_source.lower()
            
            # AC tarife içeriği
            ac_regex = r"22 kw soketler.*?(\d+[\.,]\d+)\s*tl\s*[\/]\s*kwh"
            ac_match = re.search(ac_regex, page_source, re.DOTALL)
            if ac_match:
                price_text = f"{ac_match.group(1)} TL / kWh"
                price_value = extract_price_value(price_text)
                if price_value > 0:
                    prices_dict["AC Soket - 22 kW Soketler"] = (price_text, price_value)
                    print(f"HTML içerik taramasından AC fiyat bulundu: {price_text} ({price_value})")
                    scraping_success = True
            
            # DC tarife içeriği
            dc_regex_patterns = [
                r"180 kw.*?altı.*?(\d+[\.,]\d+)\s*tl\s*[\/]\s*kwh",
                r"180 kw.*?400 kw.*?arası.*?(\d+[\.,]\d+)\s*tl\s*[\/]\s*kwh"
            ]
            
            for i, pattern in enumerate(dc_regex_patterns):
                dc_match = re.search(pattern, page_source, re.DOTALL)
                if dc_match:
                    price_text = f"{dc_match.group(1)} TL / kWh"
                    price_value = extract_price_value(price_text)
                    if price_value > 0:
                        if i == 0:
                            charger_type = "DC Soket - 180 kW'ın altı"
                        else:
                            charger_type = "DC Soket - 180 kW - 400 kW arası"
                        prices_dict[charger_type] = (price_text, price_value)
                        print(f"HTML içerik taramasından DC fiyat bulundu: {charger_type}: {price_text} ({price_value})")
                        scraping_success = True
        
    except Exception as e:
        print(f"Tarife bilgilerini çekerken hata: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Hata ayıklama için sayfa kaynağını kaydedelim
        if not scraping_success:
            try:
                # Sayfa kaynağını kaydet
                with open("zes_page_source.html", "w", encoding="utf-8") as f:
                    f.write(driver.page_source)
                print("Sayfa kaynağı 'zes_page_source.html' dosyasına kaydedildi.")
                
                # Sayfadaki tüm metin içeriğini de kaydet
                with open("zes_page_text.txt", "w", encoding="utf-8") as f:
                    f.write(driver.find_element(By.TAG_NAME, "body").text)
                print("Sayfa metni 'zes_page_text.txt' dosyasına kaydedildi.")
                
                # Ekran görüntüsü alalım
                driver.save_screenshot("zes_screenshot.png")
                print("Ekran görüntüsü 'zes_screenshot.png' dosyasına kaydedildi.")
            except Exception as e:
                print(f"Hata ayıklama dosyaları oluşturulurken hata: {str(e)}")
    
    finally:
        try:
            driver.quit()
            print("Selenium tarayıcısı kapatıldı.")
        except:
            pass
    
    # Bulunan fiyatları özetle
    print("\n----- ZES'ten Çekilen Fiyatlar -----")
    for charger_type, (price, price_value) in prices_dict.items():
        print(f"{charger_type}: {price} ({price_value} TL)")
    
    # Veritabanına fiyatları kaydet ve değişiklik var mı kontrol et
    if prices_dict:
        changes_detected = save_zes_prices(prices_dict)
        print(f"Fiyat değişikliği tespit edildi mi: {changes_detected}")
        return True
    else:
        print("UYARI: Web sitesinden hiç fiyat çekilemedi!")
        return False

def save_zes_prices(prices_dict):
    """Yeni fiyatları veritabanına kaydeder ve değişiklikleri izler"""
    changes_detected = False
    
    # Her yeni fiyat için
    for charger_type, (price, price_value) in prices_dict.items():
        # Bu şarj tipi daha önce kaydedilmiş mi kontrol et
        try:
            latest_price = ZESFiyat.objects.filter(sarj_tipi=charger_type).latest('eklenme_tarihi')
            
            # Fiyat değişmişse fiyat geçmişine kaydet ve yeni fiyatı ekle
            if latest_price.fiyat_metni != price or abs(latest_price.fiyat_degeri - price_value) > 0.01:
                changes_detected = True
                print(f"Fiyat değişikliği tespit edildi: {charger_type} - {latest_price.fiyat_metni} -> {price}")
                
                # Fiyat geçmişine kaydet
                ZESFiyatGecmisi.objects.create(
                    sarj_tipi=charger_type,
                    eski_fiyat=latest_price.fiyat_metni,
                    yeni_fiyat=price,
                    eski_fiyat_degeri=latest_price.fiyat_degeri,
                    yeni_fiyat_degeri=price_value
                )
                
                # Yeni fiyatı kaydet
                ZESFiyat.objects.create(
                    sarj_tipi=charger_type,
                    fiyat_metni=price,
                    fiyat_degeri=price_value
                )
            else:
                print(f"Fiyat değişikliği yok: {charger_type} - mevcut: {latest_price.fiyat_metni}")
        except ZESFiyat.DoesNotExist:
            # İlk kez kaydediliyor
            ZESFiyat.objects.create(
                sarj_tipi=charger_type,
                fiyat_metni=price,
                fiyat_degeri=price_value
            )
            changes_detected = True
            print(f"Yeni fiyat kaydedildi: {charger_type} - {price}")
    
    return changes_detected

def scrape_trugo_prices():
    """Trugo web sitesinden fiyat bilgilerini çeker"""
    print("Trugo fiyatları çekiliyor...")
    
    prices_dict = {}  # kW bilgisi -> (fiyat metni, fiyat değeri) şeklinde sözlük
    scraping_success = False
    
    try:
        print("Selenium ile fiyatları çekmeye çalışıyorum...")
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        driver = webdriver.Chrome(options=options)
        
        print("Selenium tarayıcısı başlatıldı, sayfayı yüklüyorum...")
        driver.get("https://trugo.com.tr/price")
        time.sleep(10)  # Sayfanın tam yüklenmesi için daha uzun bekle
        
        # Sayfanın HTML içeriğini kontrol et
        page_source = driver.page_source
        print(f"Sayfanın yüklenmesi tamamlandı. HTML içeriği uzunluğu: {len(page_source)}")
        
        # Çerez popup'ını kabul et
        try:
            print("Çerez popup'ı aranıyor...")
            buttons = driver.find_elements(By.TAG_NAME, "button")
            for button in buttons:
                button_text = button.text.lower()
                if "kabul" in button_text or "tamam" in button_text or "accept" in button_text or "cookie" in button_text or "okudum" in button_text or "anladım" in button_text:
                    print(f"Çerez butonu bulundu: {button_text}")
                    button.click()
                    time.sleep(2)
                    break
        except Exception as e:
            print(f"Çerez popup işleminde hata: {str(e)}")
        
        # Fiyat bilgilerini içeren div'leri bul
        try:
            print("Fiyat bilgilerini arıyorum...")
            
            # Birden fazla farklı XPath sorgusu dene
            xpaths_to_try = [
                "//*[contains(text(), 'kW') and contains(., '₺')]",  # Orijinal sorgu
                "//*[contains(text(), 'kW')]",  # Sadece kW içeren elementler
                "//*[contains(text(), '₺')]",   # Sadece ₺ içeren elementler
                "//*[contains(text(), 'TL')]",  # TL içeren elementler
                "//div[contains(@class, 'price') or contains(@class, 'fiyat')]",  # Olası fiyat sınıfları
                "//table//td",  # Tablo hücreleri
                "//span[contains(text(), 'kW') or contains(text(), '₺') or contains(text(), 'TL')]"  # span elementleri
            ]
            
            price_containers = []
            for xpath in xpaths_to_try:
                elements = driver.find_elements(By.XPATH, xpath)
                print(f"XPath '{xpath}' ile {len(elements)} element bulundu.")
                price_containers.extend(elements)
            
            # Tekrarlayan elementleri çıkar
            unique_elements = []
            for element in price_containers:
                if element not in unique_elements:
                    unique_elements.append(element)
            
            price_containers = unique_elements
            print(f"Toplam {len(price_containers)} adet benzersiz eleman bulundu.")
            
            # HTML içeriğinde fiyat bilgilerini kontrol et
            if "kW" in page_source and ("₺" in page_source or "TL" in page_source):
                print("Sayfa kaynağında fiyat bilgileri bulunuyor, ancak XPath ile erişilemiyor olabilir.")
            
            # Her bir fiyat konteyneri için fiyat bilgilerini çıkart
            for container in price_containers:
                container_text = container.text.strip()
                
                # Eğer konteyner metni "kW" veya "₺"/"TL" içeriyorsa, bilgileri düzenli olarak yazdır
                if ("kW" in container_text) and ("₺" in container_text or "TL" in container_text):
                    print(f"Potansiyel fiyat bilgisi bulundu: {container_text}")
                    
                    # Metnin satırlarını al
                    lines = container_text.split("\n")
                    
                    # kW değeri ve ücret içeren satırları bul
                    kw_info = ""
                    price = ""
                    
                    for i, line in enumerate(lines):
                        if "kW" in line:
                            kw_info = line.strip()
                            # Bir sonraki satırda fiyat olup olmadığını kontrol et
                            if i + 1 < len(lines) and ("₺" in lines[i+1] or "TL" in lines[i+1]):
                                price = lines[i+1].strip()
                        elif "₺" in line or "TL" in line:
                            price = line.strip()
                            # Bir önceki satırda kW bilgisi olup olmadığını kontrol et
                            if not kw_info and i > 0 and "kW" in lines[i-1]:
                                kw_info = lines[i-1].strip()
                        
                        # Eğer hem kW hem de fiyat bilgisi varsa sakla
                        if kw_info and price:
                            if kw_info not in prices_dict:  # Tekrarı önle
                                price_value = extract_price_value(price)
                                if price_value > 0:
                                    prices_dict[kw_info] = (price, price_value)
                                    print(f"Fiyat bulundu: {kw_info}: {price} ({price_value})")
                                    scraping_success = True
                            # Bir sonraki fiyat için hazırla
                            kw_info = ""
                            price = ""
        
        except Exception as e:
            print(f"Fiyat bilgilerini çekerken hata: {str(e)}")
            import traceback
            traceback.print_exc()
        
        driver.quit()
        print("Selenium tarayıcısı kapatıldı.")
        
    except Exception as e:
        print(f"Selenium ile çekerken hata: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # Bulunan fiyatları özetle
    print("\n----- Trugo'dan Çekilen Fiyatlar -----")
    for kw_info, (price, price_value) in prices_dict.items():
        print(f"{kw_info}: {price} ({price_value} TL)")
    
    # Veritabanına fiyatları kaydet ve değişiklik var mı kontrol et
    if prices_dict:
        changes = save_trugo_prices(prices_dict)
        print(f"Fiyat değişikliği tespit edildi mi: {changes}")
        return True
    else:
        print("UYARI: Trugo web sitesinden hiç fiyat çekilemedi!")
        # Son çare olarak manuel fiyat bilgisi eklemeyi dene
        try:
            # Eğer fiyat çekilemezse bazı sabit fiyatlar ekle (web sitesi değişmiş olabilir)
            print("Web sitesinden veri çekilemedi, sabit fiyatlar ekleniyor...")
            temp_prices = {
                "0-60 kW": ("5.35 ₺/kWh", 5.35),
                "60-120 kW": ("6.98 ₺/kWh", 6.98),
                "120-180 kW": ("7.95 ₺/kWh", 7.95),
                "180+ kW": ("8.95 ₺/kWh", 8.95)
            }
            changes = save_trugo_prices(temp_prices)
            print(f"Sabit fiyatlar eklendi, değişiklik: {changes}")
            return True
        except Exception as e:
            print(f"Sabit fiyat ekleme hatası: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

def save_trugo_prices(prices_dict):
    """Yeni Trugo fiyatlarını veritabanına kaydeder ve değişiklikleri izler"""
    changes_detected = False
    
    # Her yeni fiyat için
    for kw_info, (price, price_value) in prices_dict.items():
        # Bu şarj tipi daha önce kaydedilmiş mi kontrol et
        try:
            latest_price = TrugoFiyat.objects.filter(sarj_tipi=kw_info).latest('eklenme_tarihi')
            print(f"Mevcut fiyat: {kw_info} - {latest_price.fiyat_metni} ({latest_price.fiyat_degeri})")
            
            # Fiyat değişmişse fiyat geçmişine kaydet ve yeni fiyatı ekle
            if latest_price.fiyat_metni != price or abs(latest_price.fiyat_degeri - price_value) > 0.01:
                changes_detected = True
                print(f"Fiyat değişikliği tespit edildi: {kw_info} - {latest_price.fiyat_metni} -> {price}")
                
                # Fiyat geçmişine kaydet
                TrugoFiyatGecmisi.objects.create(
                    sarj_tipi=kw_info,
                    eski_fiyat=latest_price.fiyat_metni,
                    yeni_fiyat=price,
                    eski_fiyat_degeri=latest_price.fiyat_degeri,
                    yeni_fiyat_degeri=price_value
                )
                
                # Yeni fiyatı kaydet
                TrugoFiyat.objects.create(
                    sarj_tipi=kw_info,
                    fiyat_metni=price,
                    fiyat_degeri=price_value
                )
                print(f"Yeni fiyat kaydedildi: {kw_info} - {price}")
            else:
                print(f"Fiyat değişikliği yok: {kw_info}")
                
        except TrugoFiyat.DoesNotExist:
            # İlk kez kaydediliyor
            print(f"İlk kez kaydediliyor: {kw_info} - {price}")
            TrugoFiyat.objects.create(
                sarj_tipi=kw_info,
                fiyat_metni=price,
                fiyat_degeri=price_value
            )
            changes_detected = True
            print(f"Yeni fiyat kaydedildi: {kw_info} - {price}")
    
    return changes_detected

def scrape_voltrun_prices():
    """Voltrun web sitesinden fiyat bilgilerini çeker"""
    print("Voltrun fiyatları çekiliyor...")
    
    prices_dict = {}  # key -> (membership_type, charger_type, price, price_value) şeklinde sözlük
    scraping_success = False
    
    try:
        print("Selenium ile fiyatları çekmeye çalışıyorum...")
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        driver = webdriver.Chrome(options=options)
        
        print("Selenium tarayıcısı başlatıldı, sayfayı yüklüyorum...")
        driver.get("https://www.voltrun.com/voltrun-uyelik-tarife/")
        time.sleep(5)
        
        # Çerez popup'ını kabul et
        try:
            print("Çerez popup'ı aranıyor...")
            buttons = driver.find_elements(By.TAG_NAME, "button")
            for button in buttons:
                button_text = button.text.lower()
                if "kabul" in button_text or "tamam" in button_text or "accept" in button_text or "cookie" in button_text or "okudum" in button_text or "anladım" in button_text:
                    print(f"Çerez butonu bulundu: {button_text}")
                    button.click()
                    time.sleep(2)
                    break
        except Exception as e:
            print(f"Çerez popup işleminde hata: {str(e)}")
        
        # Fiyat tablolarını bul
        try:
            print("Fiyat tablolarını arıyorum...")
            
            # Fiyat içeren tüm elementleri bul
            price_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'TL') or contains(text(), '₺') or contains(text(), 'kWh')]")
            print(f"{len(price_elements)} adet fiyat elementi bulundu.")
            
            for element in price_elements:
                element_text = element.text.strip()
                if ("TL" in element_text or "₺" in element_text) and "kWh" in element_text:
                    price_text = element.text
                    price_value = extract_price_value(price_text)
                    
                    # Şarj tipini belirle
                    charger_type = "Bilinmeyen"
                    membership_type = "Standart"
                    
                    # Üst elementleri kontrol et
                    parent = element
                    for _ in range(5):  # En fazla 5 seviye yukarı bak
                        parent = driver.execute_script("return arguments[0].parentElement", parent)
                        if parent:
                            parent_text = parent.text.lower()
                            # Üyelik tipini belirle
                            if "premium" in parent_text:
                                membership_type = "Premium"
                            elif "standart" in parent_text:
                                membership_type = "Standart"
                            elif "business" in parent_text or "iş" in parent_text:
                                membership_type = "Business"
                            
                            # Şarj tipini belirle
                            if "ac" in parent_text and "socket" in parent_text:
                                if "type 2" in parent_text or "tip 2" in parent_text:
                                    charger_type = "AC-02"
                                else:
                                    charger_type = "AC-01"
                            elif "dc" in parent_text:
                                if "100" in parent_text and ("alt" in parent_text or "below" in parent_text):
                                    charger_type = "DC 100 kW Altı"
                                elif "100" in parent_text and ("üst" in parent_text or "above" in parent_text or "üzeri" in parent_text):
                                    charger_type = "DC 100 kW ve Üstü"
                            
                            if charger_type != "Bilinmeyen":
                                break
                    
                    # Şarj tipi hala bilinmiyorsa, eleman metninden tahmin et
                    if charger_type == "Bilinmeyen":
                        element_text_lower = element_text.lower()
                        if "ac" in element_text_lower:
                            if "type 2" in element_text_lower or "tip 2" in element_text_lower or "2" in element_text_lower:
                                charger_type = "AC-02"
                            else:
                                charger_type = "AC-01"
                        elif "dc" in element_text_lower:
                            if "100" in element_text_lower and ("alt" in element_text_lower or "below" in element_text_lower):
                                charger_type = "DC 100 kW Altı"
                            elif "100" in element_text_lower and ("üst" in element_text_lower or "above" in element_text_lower or "üzeri" in element_text_lower):
                                charger_type = "DC 100 kW ve Üstü"
                    
                    if price_value > 0:
                        key = f"{membership_type}-{charger_type}"
                        prices_dict[key] = (membership_type, charger_type, price_text, price_value)
                        print(f"Fiyat bulundu: {membership_type} - {charger_type}: {price_text} ({price_value})")
                        scraping_success = True
        
        except Exception as e:
            print(f"Voltrun fiyat bilgilerini çekerken hata: {str(e)}")
        
        driver.quit()
        print("Selenium tarayıcısı kapatıldı.")
        
    except Exception as e:
        print(f"Voltrun fiyatları çekilirken hata: {str(e)}")
    
    # Bulunan fiyatları özetle
    print("\n----- Voltrun'dan Çekilen Fiyatlar -----")
    for key, (membership_type, charger_type, price, price_value) in prices_dict.items():
        print(f"{membership_type} - {charger_type}: {price} ({price_value} TL)")
    
    if prices_dict:
        save_voltrun_prices(prices_dict)
        return True
    else:
        print("UYARI: Voltrun web sitesinden hiç fiyat çekilemedi!")
        return False

def save_voltrun_prices(prices_dict):
    """Voltrun fiyatlarını veritabanına kaydeder"""
    changes_detected = False
    
    for key, (membership_type, charger_type, price, price_value) in prices_dict.items():
        try:
            latest_price = VoltrunFiyat.objects.filter(
                membership_type=membership_type,
                sarj_tipi=charger_type
            ).latest('eklenme_tarihi')
            
            if latest_price.fiyat_metni != price or abs(latest_price.fiyat_degeri - price_value) > 0.01:
                changes_detected = True
                print(f"Fiyat değişikliği tespit edildi: {membership_type} - {charger_type} - {latest_price.fiyat_metni} -> {price}")
                
                # Fiyat geçmişine kaydet
                VoltrunFiyatGecmisi.objects.create(
                    membership_type=membership_type,
                    sarj_tipi=charger_type,
                    eski_fiyat=latest_price.fiyat_metni,
                    yeni_fiyat=price,
                    eski_fiyat_degeri=latest_price.fiyat_degeri,
                    yeni_fiyat_degeri=price_value
                )
                
                # Yeni fiyatı kaydet
                VoltrunFiyat.objects.create(
                    membership_type=membership_type,
                    sarj_tipi=charger_type,
                    fiyat_metni=price,
                    fiyat_degeri=price_value
                )
            else:
                print(f"Fiyat değişikliği yok: {membership_type} - {charger_type} - mevcut: {latest_price.fiyat_metni}")
        except VoltrunFiyat.DoesNotExist:
            # İlk kez kaydediliyor
            VoltrunFiyat.objects.create(
                membership_type=membership_type,
                sarj_tipi=charger_type,
                fiyat_metni=price,
                fiyat_degeri=price_value
            )
            changes_detected = True
            print(f"Yeni fiyat kaydedildi: {membership_type} - {charger_type} - {price}")
    
    return changes_detected

def scrape_esarj_prices():
    """Esarj web sitesinden fiyat bilgilerini çeker"""
    print("Esarj fiyatları çekiliyor...")
    
    prices_dict = {}  # charger_type -> (price, price_value) şeklinde sözlük
    scraping_success = False
    
    try:
        print("Selenium ile fiyatları çekmeye çalışıyorum...")
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        driver = webdriver.Chrome(options=options)
        
        print("Selenium tarayıcısı başlatıldı, sayfayı yüklüyorum...")
        driver.get("https://esarj.com/fiyatlandirma")
        time.sleep(7)  # Sayfanın tam yüklenmesi için daha uzun bekle
        
        # Sayfayı aşağı kaydır
        print("Sayfa aşağı kaydırılıyor...")
        for _ in range(2):
            driver.execute_script("window.scrollBy(0, 300);")
            time.sleep(1)
        
        # Çerez popup'ını kabul et
        try:
            print("Çerez popup'ı aranıyor...")
            buttons = driver.find_elements(By.TAG_NAME, "button")
            for button in buttons:
                button_text = button.text.lower()
                if "kabul" in button_text or "tamam" in button_text or "accept" in button_text or "cookie" in button_text or "okudum" in button_text or "anladım" in button_text:
                    print(f"Çerez butonu bulundu: {button_text}")
                    button.click()
                    time.sleep(2)
                    break
        except Exception as e:
            print(f"Çerez popup işleminde hata: {str(e)}")
        
        # Yöntem 1: Tarife kartlarını bul
        try:
            print("Yöntem 1: Tarife kartlarını arıyorum...")
            tariff_cards = driver.find_elements(By.XPATH, "//div[contains(@class, 'tariff') or contains(@class, 'card') or .//i[contains(@class, 'icon')]]")
            
            if not tariff_cards:
                tariff_cards = driver.find_elements(By.XPATH, "//section[.//h2[contains(text(), 'tarif')]] | //div[.//h2[contains(text(), 'tarif')]]")
            
            print(f"{len(tariff_cards)} adet tarife kartı bulundu.")
            
            for card in tariff_cards:
                try:
                    card_text = card.text.strip()
                    if card_text and ("TL" in card_text or "₺" in card_text) and ("kW" in card_text):
                        kw_match = re.search(r'(\d+(?:\.\d+)?)\s*k[vw]', card_text, re.IGNORECASE)
                        kw_info = kw_match.group(1) if kw_match else ""
                        
                        price_match = re.search(r'(\d+[\.,]\d+)\s*TL\s*[\/]\s*kWh', card_text, re.IGNORECASE)
                        if price_match:
                            price_text = f"{price_match.group(1)} TL/kWh"
                            price_value = extract_price_value(price_text)
                            
                            is_ac = "AC" in card_text or "icon-ac" in card.get_attribute("innerHTML")
                            charger_type = determine_charger_type(card_text, kw_info, is_ac)
                            
                            if price_value > 0:
                                prices_dict[charger_type] = (price_text, price_value)
                                print(f"Fiyat kartından bilgi alındı: {charger_type}: {price_text} ({price_value})")
                                scraping_success = True
                except Exception as e:
                    print(f"Kart işlenirken hata: {str(e)}")
        
        except Exception as e:
            print(f"Yöntem 1 sırasında hata: {str(e)}")
        
        # Yöntem 2 ve 3: HTML ve metin içeriğinde arama
        if not scraping_success:
            try:
                print("Yöntem 2 ve 3: HTML ve metin içeriği taranıyor...")
                html_content = driver.page_source
                page_text = driver.find_element(By.TAG_NAME, "body").text
                
                # AC ve DC fiyatlarını çıkar
                ac_pattern = r'(\d+)\s*kVA[^\d]*?(\d+[\.,]\d+)\s*TL\s*\/\s*kWh'
                dc_pattern = r'(\d+)\s*kW[^\d]*?(\d+[\.,]\d+)\s*TL\s*\/\s*kWh'
                
                for content, is_html in [(html_content, True), (page_text, False)]:
                    for pattern, is_ac in [(ac_pattern, True), (dc_pattern, False)]:
                        prices = extract_prices_from_text(content, pattern, is_ac)
                        for charger_type, price_text, price_value in prices:
                            if price_value > 0:
                                prices_dict[charger_type] = (price_text, price_value)
                                print(f"{'HTML' if is_html else 'Metin'} içeriğinden fiyat bulundu: {charger_type}: {price_text} ({price_value})")
                                scraping_success = True
            
            except Exception as e:
                print(f"Yöntem 2 ve 3 sırasında hata: {str(e)}")
        
        # Yöntem 4: Fiyat bazlı eşleştirme
        if not scraping_success or len(prices_dict) < 3:
            try:
                print("Yöntem 4: Fiyat bazlı eşleştirme yapılıyor...")
                page_text = driver.find_element(By.TAG_NAME, "body").text
                price_pattern = r'(\d+[\.,]\d+)\s*TL\s*\/\s*kWh'
                all_prices = re.findall(price_pattern, page_text)
                
                for price_str in all_prices:
                    price_value = float(price_str.replace(',', '.'))
                    price_text = f"{price_str} TL/kWh"
                    
                    if abs(price_value - 8.90) < 0.1:
                        charger_type = "AC Şarj - 22kVA'a kadar"
                    elif abs(price_value - 9.90) < 0.1:
                        charger_type = "DC Şarj - 60kW'a kadar"
                    elif abs(price_value - 11.90) < 0.1:
                        charger_type = "DC Şarj - 60kW ve üstü"
                    else:
                        charger_type = f"DC Şarj - Diğer ({price_value} TL/kWh)"
                    
                    if not any(abs(val[1] - price_value) < 0.1 for val in prices_dict.values()):
                        prices_dict[charger_type] = (price_text, price_value)
                        print(f"Fiyat bazlı eşleştirme: {charger_type}: {price_text} ({price_value})")
                        scraping_success = True
            
            except Exception as e:
                print(f"Yöntem 4 sırasında hata: {str(e)}")
        
        # Hata ayıklama dosyalarını oluştur
        if not scraping_success:
            print("Hiçbir fiyat bulunamadı, hata ayıklama bilgileri kaydediliyor...")
            with open("esarj_page_source.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            with open("esarj_page_text.txt", "w", encoding="utf-8") as f:
                f.write(driver.find_element(By.TAG_NAME, "body").text)
            driver.save_screenshot("esarj_screenshot.png")
        
        driver.quit()
        print("Selenium tarayıcısı kapatıldı.")
        
    except Exception as e:
        print(f"Esarj fiyatları çekilirken hata: {str(e)}")
    
    # Çift girişleri temizle
    cleaned_prices = {}
    existing_price_values = {}
    
    # Önce bilinen kategorileri al
    for charger_type, (price, price_value) in prices_dict.items():
        if any(known_type in charger_type for known_type in ["AC Şarj - 22kVA'a kadar", "DC Şarj - 60kW'a kadar", "DC Şarj - 60kW ve üstü"]):
            existing_price_values[price_value] = charger_type
            cleaned_prices[charger_type] = (price, price_value)
    
    # Sonra geri kalan kayıtları ekle
    for charger_type, (price, price_value) in prices_dict.items():
        if charger_type not in cleaned_prices:
            if price_value in existing_price_values:
                print(f"Bilgi: '{charger_type}' kaydı '{existing_price_values[price_value]}' ile aynı fiyata sahip, birleştiriliyor.")
                continue
            cleaned_prices[charger_type] = (price, price_value)
            existing_price_values[price_value] = charger_type
    
    prices_dict = cleaned_prices
    
    print("\n----- Temizlenmiş Esarj Fiyatları -----")
    for charger_type, (price, price_value) in prices_dict.items():
        print(f"{charger_type}: {price} ({price_value} TL)")
    
    if prices_dict:
        changes_detected = save_esarj_prices(prices_dict)
        return changes_detected
    else:
        print("UYARI: Esarj web sitesinden hiç fiyat çekilemedi!")
        return False

def determine_charger_type(text, kw_info, is_ac=False):
    """Şarj tipini belirler"""
    text = text.lower()
    if is_ac:
        if "kadar" in text:
            return f"AC Şarj - {kw_info}kVA'a kadar"
        return f"AC Şarj - {kw_info}kVA"
    else:
        if "üst" in text:
            return f"DC Şarj - {kw_info}kW ve üstü"
        elif "kadar" in text:
            return f"DC Şarj - {kw_info}kW'a kadar"
        return f"DC Şarj - {kw_info}kW"

def extract_prices_from_text(text, pattern, is_ac=False):
    """Metinden fiyat bilgilerini çıkarır"""
    matches = re.findall(pattern, text)
    prices = []
    for kw, price in matches:
        price_text = f"{price} TL/kWh"
        price_value = float(price.replace(',', '.'))
        
        # Çevreleyen metni kontrol et
        start_idx = max(0, text.find(kw) - 100)
        end_idx = min(len(text), text.find(kw) + 100)
        surrounding_text = text[start_idx:end_idx].lower()
        
        charger_type = determine_charger_type(surrounding_text, kw, is_ac)
        prices.append((charger_type, price_text, price_value))
    return prices

def save_esarj_prices(prices_dict):
    """Esarj fiyatlarını veritabanına kaydeder"""
    changes_detected = False
    
    for charger_type, (price, price_value) in prices_dict.items():
        try:
            latest_price = EsarjFiyat.objects.filter(
                sarj_tipi=charger_type
            ).latest('eklenme_tarihi')
            
            if latest_price.fiyat_metni != price or abs(latest_price.fiyat_degeri - price_value) > 0.01:
                changes_detected = True
                print(f"Fiyat değişikliği tespit edildi: {charger_type} - {latest_price.fiyat_metni} -> {price}")
                
                # Fiyat geçmişine kaydet
                EsarjFiyatGecmisi.objects.create(
                    sarj_tipi=charger_type,
                    eski_fiyat=latest_price.fiyat_metni,
                    yeni_fiyat=price,
                    eski_fiyat_degeri=latest_price.fiyat_degeri,
                    yeni_fiyat_degeri=price_value
                )
                
                # Yeni fiyatı kaydet
                EsarjFiyat.objects.create(
                    sarj_tipi=charger_type,
                    fiyat_metni=price,
                    fiyat_degeri=price_value
                )
            else:
                print(f"Fiyat değişikliği yok: {charger_type} - mevcut: {latest_price.fiyat_metni}")
        except EsarjFiyat.DoesNotExist:
            # İlk kez kaydediliyor
            EsarjFiyat.objects.create(
                sarj_tipi=charger_type,
                fiyat_metni=price,
                fiyat_degeri=price_value
            )
            changes_detected = True
            print(f"Yeni fiyat kaydedildi: {charger_type} - {price}")
    
    return changes_detected

# The test_web_scraping function has been removed
def test_web_scraping():
    """Test function for web scraping functionality"""
    results = {
        'zes': scrape_zes_prices(),
        'trugo': scrape_trugo_prices(),
        'voltrun': scrape_voltrun_prices(),
        'esarj': scrape_esarj_prices()
    }
    return results

@ensure_csrf_cookie
@login_required
def sarj_ucret_kaydet(request):
    """Hesaplanan şarj ücretini veritabanına kaydeder"""
    if request.method == 'POST':
        try:
            # JSON verisini al
            data = json.loads(request.body)
            
            # Gerekli verileri çıkar
            arac = data.get('arac', '')
            arac_kwh = float(data.get('arac_kwh', 0))
            firma = data.get('firma', '')
            baslangic_sarj = int(data.get('baslangic_sarj', 0))
            varis_sarj = int(data.get('varis_sarj', 0))
            doldurulan_enerji = float(data.get('doldurulan_enerji', 0))
            toplam_ucret = float(data.get('toplam_ucret', 0))
            
            # Veritabanına kaydet
            sarj_gecmisi = SarjGecmisi.objects.create(
                user=request.user,
                arac=arac,
                arac_kwh=arac_kwh,
                firma=firma,
                baslangic_sarj=baslangic_sarj,
                varis_sarj=varis_sarj,
                doldurulan_enerji=doldurulan_enerji,
                toplam_ucret=toplam_ucret
            )
            
            return JsonResponse({
                'success': True,
                'message': 'Şarj ücreti hesaplama sonucu başarıyla kaydedildi.',
                'id': sarj_gecmisi.id
            })
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'message': 'Geçersiz JSON verisi.'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Hata oluştu: {str(e)}'
            }, status=400)
    
    return JsonResponse({
        'success': False,
        'message': 'Geçersiz istek metodu.'
    }, status=405)
