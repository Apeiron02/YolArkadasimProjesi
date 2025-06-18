from django.urls import path
from . import views

app_name = 'sarjucret'

urlpatterns = [
    path('', views.sarj_ucret, name='sarj_ucret'),
    path('kaydet/', views.sarj_ucret_kaydet, name='sarj_ucret_kaydet'),
]
