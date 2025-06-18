from django.urls import path
from . import views

urlpatterns = [
    path('harita/', views.harita_view, name='harita_view'),
    path('kullanici-bilgileri/', views.kullanici_bilgileri, name='kullanici_bilgileri'),
    path('hakkimizda/', views.hakkimizda, name='hakkimizda'),
    # Diğer yollar...
] 