from django.contrib import admin
from .models import (
    ZESFiyat, ZESFiyatGecmisi, 
    TrugoFiyat, TrugoFiyatGecmisi,
    VoltrunFiyat, VoltrunFiyatGecmisi,
    EsarjFiyat, EsarjFiyatGecmisi
)

# Register your models here.
@admin.register(ZESFiyat)
class ZESFiyatAdmin(admin.ModelAdmin):
    list_display = ('sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi')
    search_fields = ('sarj_tipi', 'fiyat_metni')
    list_filter = ('eklenme_tarihi',)

@admin.register(ZESFiyatGecmisi)
class ZESFiyatGecmisiAdmin(admin.ModelAdmin):
    list_display = ('sarj_tipi', 'eski_fiyat', 'yeni_fiyat', 'degisim_tarihi')
    search_fields = ('sarj_tipi',)
    list_filter = ('degisim_tarihi',)

@admin.register(TrugoFiyat)
class TrugoFiyatAdmin(admin.ModelAdmin):
    list_display = ('sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi')
    search_fields = ('sarj_tipi', 'fiyat_metni')
    list_filter = ('eklenme_tarihi',)

@admin.register(TrugoFiyatGecmisi)
class TrugoFiyatGecmisiAdmin(admin.ModelAdmin):
    list_display = ('sarj_tipi', 'eski_fiyat', 'yeni_fiyat', 'degisim_tarihi')
    search_fields = ('sarj_tipi',)
    list_filter = ('degisim_tarihi',)

@admin.register(VoltrunFiyat)
class VoltrunFiyatAdmin(admin.ModelAdmin):
    list_display = ('membership_type', 'sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi')
    search_fields = ('membership_type', 'sarj_tipi', 'fiyat_metni')
    list_filter = ('eklenme_tarihi', 'membership_type')

@admin.register(VoltrunFiyatGecmisi)
class VoltrunFiyatGecmisiAdmin(admin.ModelAdmin):
    list_display = ('membership_type', 'sarj_tipi', 'eski_fiyat', 'yeni_fiyat', 'degisim_tarihi')
    search_fields = ('membership_type', 'sarj_tipi')
    list_filter = ('degisim_tarihi', 'membership_type')

@admin.register(EsarjFiyat)
class EsarjFiyatAdmin(admin.ModelAdmin):
    list_display = ('sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi')
    search_fields = ('sarj_tipi', 'fiyat_metni')
    list_filter = ('eklenme_tarihi',)

@admin.register(EsarjFiyatGecmisi)
class EsarjFiyatGecmisiAdmin(admin.ModelAdmin):
    list_display = ('sarj_tipi', 'eski_fiyat', 'yeni_fiyat', 'degisim_tarihi')
    search_fields = ('sarj_tipi',)
    list_filter = ('degisim_tarihi',)
