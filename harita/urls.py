from django.urls import path
from . import views

app_name = 'harita'

urlpatterns = [
    path('', views.harita_view, name='harita_view'),
    path('get-nearby-charging-stations/', views.get_nearby_charging_stations, name='get_nearby_charging_stations'),
    path('get-restaurants/', views.get_restaurants, name='get_restaurants'),
    path('save-route-history/', views.save_route_history, name='save_route_history'),
    path('user_car_info/', views.get_user_car_info, name='user_car_info'),
    path('get-weather/', views.get_weather, name='get_weather'),
    path('kullanici-bilgileri/', views.kullanici_bilgileri, name='kullanici_bilgileri'),
    path('get_stopover_suggestions/', views.get_stopover_suggestions, name='get_stopover_suggestions'),
]
