from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class ZESFiyat(models.Model):
    sarj_tipi = models.CharField(max_length=100)
    fiyat_metni = models.CharField(max_length=50)
    fiyat_degeri = models.FloatField()
    eklenme_tarihi = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "ZES Fiyat"
        verbose_name_plural = "ZES Fiyatları"
        
    def __str__(self):
        return f"{self.sarj_tipi}: {self.fiyat_metni}"

class ZESFiyatGecmisi(models.Model):
    sarj_tipi = models.CharField(max_length=100)
    eski_fiyat = models.CharField(max_length=50)
    yeni_fiyat = models.CharField(max_length=50)
    eski_fiyat_degeri = models.FloatField()
    yeni_fiyat_degeri = models.FloatField()
    degisim_tarihi = models.DateField(auto_now_add=True)
    
    class Meta:
        verbose_name = "ZES Fiyat Geçmişi"
        verbose_name_plural = "ZES Fiyat Geçmişleri"
        
    def __str__(self):
        return f"{self.sarj_tipi}: {self.eski_fiyat} -> {self.yeni_fiyat}"

# Trugo için yeni modeller
class TrugoFiyat(models.Model):
    sarj_tipi = models.CharField(max_length=100)
    fiyat_metni = models.CharField(max_length=50)
    fiyat_degeri = models.FloatField()
    eklenme_tarihi = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "Trugo Fiyat"
        verbose_name_plural = "Trugo Fiyatları"
        
    def __str__(self):
        return f"{self.sarj_tipi}: {self.fiyat_metni}"

class TrugoFiyatGecmisi(models.Model):
    sarj_tipi = models.CharField(max_length=100)
    eski_fiyat = models.CharField(max_length=50)
    yeni_fiyat = models.CharField(max_length=50)
    eski_fiyat_degeri = models.FloatField()
    yeni_fiyat_degeri = models.FloatField()
    degisim_tarihi = models.DateField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Trugo Fiyat Geçmişi"
        verbose_name_plural = "Trugo Fiyat Geçmişleri"
        
    def __str__(self):
        return f"{self.sarj_tipi}: {self.eski_fiyat} -> {self.yeni_fiyat}"

# Voltrun için modeller
class VoltrunFiyat(models.Model):
    membership_type = models.CharField(max_length=100)
    sarj_tipi = models.CharField(max_length=100)
    fiyat_metni = models.CharField(max_length=50)
    fiyat_degeri = models.FloatField()
    eklenme_tarihi = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "Voltrun Fiyat"
        verbose_name_plural = "Voltrun Fiyatları"
        
    def __str__(self):
        return f"{self.membership_type} - {self.sarj_tipi}: {self.fiyat_metni}"

class VoltrunFiyatGecmisi(models.Model):
    membership_type = models.CharField(max_length=100)
    sarj_tipi = models.CharField(max_length=100)
    eski_fiyat = models.CharField(max_length=50)
    yeni_fiyat = models.CharField(max_length=50)
    eski_fiyat_degeri = models.FloatField()
    yeni_fiyat_degeri = models.FloatField()
    degisim_tarihi = models.DateField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Voltrun Fiyat Geçmişi"
        verbose_name_plural = "Voltrun Fiyat Geçmişleri"
        
    def __str__(self):
        return f"{self.membership_type} - {self.sarj_tipi}: {self.eski_fiyat} -> {self.yeni_fiyat}"

# Esarj için modeller
class EsarjFiyat(models.Model):
    sarj_tipi = models.CharField(max_length=100)
    fiyat_metni = models.CharField(max_length=50)
    fiyat_degeri = models.FloatField()
    eklenme_tarihi = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "Esarj Fiyat"
        verbose_name_plural = "Esarj Fiyatları"
        
    def __str__(self):
        return f"{self.sarj_tipi}: {self.fiyat_metni}"

class EsarjFiyatGecmisi(models.Model):
    sarj_tipi = models.CharField(max_length=100)
    eski_fiyat = models.CharField(max_length=50)
    yeni_fiyat = models.CharField(max_length=50)
    eski_fiyat_degeri = models.FloatField()
    yeni_fiyat_degeri = models.FloatField()
    degisim_tarihi = models.DateField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Esarj Fiyat Geçmişi"
        verbose_name_plural = "Esarj Fiyat Geçmişleri"
        
    def __str__(self):
        return f"{self.sarj_tipi}: {self.eski_fiyat} -> {self.yeni_fiyat}"

class SarjGecmisi(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    arac = models.CharField(max_length=150)
    arac_kwh = models.FloatField()
    firma = models.CharField(max_length=50)
    baslangic_sarj = models.PositiveSmallIntegerField()
    varis_sarj = models.PositiveSmallIntegerField()
    doldurulan_enerji = models.FloatField()
    toplam_ucret = models.FloatField()
    tarih = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Şarj Geçmişi"
        verbose_name_plural = "Şarj Geçmişleri"

    def __str__(self):
        return f"{self.user.username} - {self.firma} - {self.tarih.strftime('%Y-%m-%d %H:%M')}"
