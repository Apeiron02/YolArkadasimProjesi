from django.urls import path
from . import views

app_name = 'kullanicibilgileri'  # Namespace tanımı

urlpatterns = [
    path('', views.kullanici_bilgileri, name='kullanici_bilgileri'),
]