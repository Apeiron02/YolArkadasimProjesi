from django.core.management.base import BaseCommand
from sarjucret.views import scrape_zes_prices

class Command(BaseCommand):
    help = 'ZES web sitesinden güncel fiyatları çeker ve veritabanına kaydeder'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('ZES fiyatları güncelleniyor...'))
        success = scrape_zes_prices()
        if success:
            self.stdout.write(self.style.SUCCESS('ZES fiyatları başarıyla güncellendi!'))
        else:
            self.stdout.write(self.style.ERROR('ZES fiyatları güncellenirken bir hata oluştu!'))