from django.urls import path
from .views import giris_view,anasayfa


urlpatterns = [
    path('', giris_view, name='giris'),
    path('anasayfa/', anasayfa, name='anasayfa'),
]