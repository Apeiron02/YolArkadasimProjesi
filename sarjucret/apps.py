from django.apps import AppConfig
import threading
import time
import logging

# Loglama yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('sarjucret')

class SarjucretConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sarjucret'
    
    def ready(self):
        import os
        # Sadece ana süreçte çalıştır (development sunucusu her değişiklikte iki kez başlatır)
        if os.environ.get('RUN_MAIN', None) != 'true':
            self.start_background_tasks()
    
    def start_background_tasks(self):
        thread = threading.Thread(target=self.update_prices_periodically)
        thread.daemon = True
        thread.start()
        logger.info("Fiyat güncelleme arka plan işlemi başlatıldı")
    
    def update_prices_periodically(self):
        # İlk başlangıçta biraz bekle - sunucunun tam olarak başlatılmasını sağla
        time.sleep(30)
        
        from .views import (
            scrape_zes_prices, scrape_trugo_prices,
            scrape_voltrun_prices, scrape_esarj_prices
        )
        
        try:
            logger.info("İlk fiyat güncellemeleri başlatılıyor...")
            
            try:
                logger.info("ZES fiyatları güncelleniyor...")
                scrape_zes_prices()
            except Exception as e:
                logger.error(f"ZES fiyat güncellemesinde hata: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
            
            try:
                logger.info("Trugo fiyatları güncelleniyor...")
                scrape_trugo_prices()
            except Exception as e:
                logger.error(f"Trugo fiyat güncellemesinde hata: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
            
            try:
                logger.info("Voltrun fiyatları güncelleniyor...")
                scrape_voltrun_prices()
            except Exception as e:
                logger.error(f"Voltrun fiyat güncellemesinde hata: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
            
            try:
                logger.info("Esarj fiyatları güncelleniyor...")
                success = scrape_esarj_prices()
                if success:
                    logger.info("Esarj fiyatları başarıyla güncellendi veya kontrol edildi")
                else:
                    logger.warning("Esarj fiyatları güncellenemedi, ancak mevcut fiyatlar kontrol edildi")
            except Exception as e:
                logger.error(f"Esarj fiyat güncellemesinde hata: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
                
            logger.info("İlk fiyat güncellemeleri tamamlandı")
        except Exception as e:
            logger.error(f"Fiyat güncelleme genel hatası: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        
        # Her 12 saatte bir fiyatları güncelle
        while True:
            try:
                time.sleep(12 * 60 * 60)  # 12 saat bekle
                logger.info("Periyodik fiyat güncellemeleri başlatılıyor...")
                
                try:
                    logger.info("ZES fiyatları periyodik olarak güncelleniyor...")
                    scrape_zes_prices()
                except Exception as e:
                    logger.error(f"ZES periyodik fiyat güncellemesinde hata: {str(e)}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                try:
                    logger.info("Trugo fiyatları periyodik olarak güncelleniyor...")
                    scrape_trugo_prices()
                except Exception as e:
                    logger.error(f"Trugo periyodik fiyat güncellemesinde hata: {str(e)}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                try:
                    logger.info("Voltrun fiyatları periyodik olarak güncelleniyor...")
                    scrape_voltrun_prices()
                except Exception as e:
                    logger.error(f"Voltrun periyodik fiyat güncellemesinde hata: {str(e)}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                try:
                    logger.info("Esarj fiyatları periyodik olarak güncelleniyor...")
                    success = scrape_esarj_prices()
                    if success:
                        logger.info("Esarj fiyatları başarıyla periyodik olarak güncellendi veya kontrol edildi")
                    else:
                        logger.warning("Esarj fiyatları periyodik olarak güncellenemedi, ancak mevcut fiyatlar kontrol edildi")
                except Exception as e:
                    logger.error(f"Esarj periyodik fiyat güncellemesinde hata: {str(e)}")
                    import traceback
                    logger.error(traceback.format_exc())
                    
                logger.info("Periyodik fiyat güncellemeleri tamamlandı")
            except Exception as e:
                logger.error(f"Periyodik fiyat güncelleme genel hatası: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
