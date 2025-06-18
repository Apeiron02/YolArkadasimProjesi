from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from . import views
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from .views import StopoverSuggestionsAPIView, segment_energy

# ViewSet'ler için router oluşturma
router = DefaultRouter()
router.register(r'elektrikli-araclar', views.ElectricCarViewSet, basename='elektrikli_araclar')
router.register(r'kullanici-arac-tercihi', views.UserCarPreferenceViewSet, basename='kullanici_arac_tercihi')
router.register(r'rota-gecmisi', views.RouteHistoryViewSet, basename='rota_gecmisi')
# Şarj istasyonu fiyatları için ViewSet'ler
router.register(r'zes-fiyatlari', views.ZESFiyatViewSet, basename='zes_fiyatlari')
router.register(r'trugo-fiyatlari', views.TrugoFiyatViewSet, basename='trugo_fiyatlari')
router.register(r'voltrun-fiyatlari', views.VoltrunFiyatViewSet, basename='voltrun_fiyatlari')
router.register(r'esarj-fiyatlari', views.EsarjFiyatViewSet, basename='esarj_fiyatlari')
router.register(r'sarj-gecmisi', views.SarjGecmisiViewSet, basename='sarj_gecmisi')

app_name = 'api'

# API kök URL'si için view
@api_view(['GET'])
def api_root(request, format=None):
    return Response({
        'elektrikli-araclar': reverse('api:elektrikli_araclar-list', request=request, format=format),
        'kullanici-arac-tercihi': reverse('api:kullanici_arac_tercihi-list', request=request, format=format),
        'rota-gecmisi': reverse('api:rota_gecmisi-list', request=request, format=format),
        'kullanici-kayit': reverse('api:kullanici_kayit', request=request, format=format),
        'kullanici-profil': reverse('api:kullanici_profil', request=request, format=format),
        'kullanici-bilgilerim': reverse('api:kullanici_bilgilerim', request=request, format=format),
        'kullanicilar': reverse('api:kullanicilar_listesi', request=request, format=format),
        'token': reverse('api:token_obtain_pair', request=request, format=format),
        'token-refresh': reverse('api:token_refresh', request=request, format=format),
        'token-verify': reverse('api:token_verify', request=request, format=format),
        'yakin-sarj-istasyonlari': reverse('api:yakin_sarj_istasyonlari', request=request, format=format),
        'rota-sarj-istasyonlari': reverse('api:rota_sarj_istasyonlari', request=request, format=format),
        'rota-bilgisi': reverse('api:rota_bilgisi', request=request, format=format),
        'hava-durumu': reverse('api:hava_durumu', request=request, format=format),
        'kullanici-konumu': reverse('api:kullanici_konumu', request=request, format=format),
        # Şarj istasyonu fiyatlarını ekleyelim
        'sarj-istasyonlari-fiyatlari': reverse('api:sarj_istasyonlari_fiyatlari', request=request, format=format),
        'zes-fiyatlari': reverse('api:zes_fiyatlari-list', request=request, format=format),
        'trugo-fiyatlari': reverse('api:trugo_fiyatlari-list', request=request, format=format),
        'voltrun-fiyatlari': reverse('api:voltrun_fiyatlari-list', request=request, format=format),
        'esarj-fiyatlari': reverse('api:esarj_fiyatlari-list', request=request, format=format),
        'rota-mola-onerileri': reverse('api:rota_mola_onerileri', request=request, format=format),
        'sarj-gecmisi': reverse('api:sarj_gecmisi-list', request=request, format=format),
    })

# API endpoint'lerinin tanımlandığı liste
api_patterns = [
    # ViewSet URL'leri
    path('', include(router.urls)),
    
    # Kullanıcı işlemleri - URL yollarını düzeltme
    path('kullanici-kayit/', views.RegisterUserView.as_view(), name='kullanici_kayit'),
    path('kullanici-profil/', views.UserDetailView.as_view(), name='kullanici_profil'),
    path('kullanici-bilgilerim/', views.UserDetailView.as_view(), name='kullanici_bilgilerim'),
    path('kullanicilar/', views.UserListView.as_view(), name='kullanicilar_listesi'),
    
    # Kullanıcı işlemleri eski yollarını da tutalım (geriye uyumluluk için)
    path('kullanici/kayit/', views.RegisterUserView.as_view(), name='kullanici_kayit_alt'),
    path('kullanici/profil/', views.UserDetailView.as_view(), name='kullanici_profil_alt'),
    
    # JWT Auth endpoint'leri
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Özel API endpoint'leri
    path('yakin-sarj-istasyonlari/', views.NearbyChargingStationsView.as_view(), name='yakin_sarj_istasyonlari'),
    path('rota-sarj-istasyonlari/', views.RouteChargingStationsView.as_view(), name='rota_sarj_istasyonlari'),

    path('rota-bilgisi/', views.DirectionsView.as_view(), name='rota_bilgisi'),
    path('hava-durumu/', views.WeatherView.as_view(), name='hava_durumu'),
    path('kullanici-konumu/', views.UserLocationView.as_view(), name='kullanici_konumu'),
    
    # Şarj istasyonu fiyatları için endpoint
    path('sarj-istasyonlari-fiyatlari/', views.SarjIstasyonlariFiyatView.as_view(), name='sarj_istasyonlari_fiyatlari'),
    
    # DRF auth
    path('auth/', include('rest_framework.urls')),

    path('rota-mola-onerileri/', StopoverSuggestionsAPIView.as_view(), name='rota_mola_onerileri'),
]

# Ana URL yapılandırması
urlpatterns = [
    # Ana API kök URL'si
    path('', api_root, name='api-root'),
    
    # API endpoint'leri
    path('', include(api_patterns)),
    
    # API v1 URL'leri
    path('v1/', include((api_patterns, 'v1'))),
]

urlpatterns += [
    path('segment-energy/', segment_energy, name='segment_energy'),
]