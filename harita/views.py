from django.shortcuts import render
from django.http import JsonResponse
from .models import RouteHistory
import json
import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from kullanicibilgileri.models import UserCarPreference
from django.contrib.auth.decorators import login_required
from .services import RouteService
from .strategies import CarRouteStrategy, ElectricCarRouteStrategy
from .repositories import RouteRepository
import os
import logging
import google.generativeai as genai
from dotenv import load_dotenv

# .env dosyasından API anahtarını yükle
load_dotenv()
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# API anahtarının yüklendiğini kontrol et
if not GEMINI_API_KEY:
    logging.error("GEMINI_API_KEY bulunamadı. .env dosyanızı kontrol edin.")
    # Settings'deki anahtar ile geri dönüş (fallback) mekanizması
    GEMINI_API_KEY = getattr(settings, 'GEMINI_API_KEY', None)

# Gemini API'yi yapılandır
try:
    genai.configure(api_key=GEMINI_API_KEY)
    # Modeli oluştur - Gemini 2.0 Flash modeli kullanılıyor
    model = genai.GenerativeModel('gemini-2.0-flash')
except Exception as e:
    logging.error(f"Gemini API yapılandırma hatası: {e}")
    model = None # Modelin kullanılamaz olduğunu işaretle

route_service = RouteService()

def harita_view(request):
    context = {
        'GOOGLE_PLACES_API_KEY': settings.GOOGLE_PLACES_API_KEY,
    }
    return render(request, 'harita/harita.html', context)


def get_nearby_charging_stations(request):
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return JsonResponse({
            'error': 'Geçersiz koordinat değerleri'
        }, status=400)

    # Şarj istasyonları için Places API sorgusu
    url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=50000&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        nearby_stations = []
        for place in data.get('results', []):
            # Şarj istasyonu olma olasılığı olan yerleri filtrele
            if any(keyword in place.get('name', '').lower() for keyword in ["şarj", "charge", "charging", "şarj istasyonu", "charging station"]):
                station_info = {
                    'place_id': place.get('place_id'),
                    'name': place.get('name'),
                    'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
                    'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
                    'vicinity': place.get('vicinity', ''),
                    'rating': place.get('rating', 0),
                }
                nearby_stations.append(station_info)

        if not nearby_stations:
            # Eğer şarj istasyonu bulunamazsa daha geniş bir arama yap
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=100000&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            
            for place in data.get('results', []):
                if any(keyword in place.get('name', '').lower() for keyword in ["şarj", "charge", "charging", "electric", "elektrik"]):
                    station_info = {
                        'place_id': place.get('place_id'),
                        'name': place.get('name'),
                        'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
                        'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
                        'vicinity': place.get('vicinity', ''),
                        'rating': place.get('rating', 0),
                    }
                    nearby_stations.append(station_info)
        
        return JsonResponse({'stations': nearby_stations})
    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': f'API isteği başarısız oldu: {str(e)}'}, status=500)


def get_restaurants(request):
    place_id = request.GET.get('station_id')
    if not place_id:
        return JsonResponse({'error': 'Şarj istasyonu ID\'si gerekli'}, status=400)

    try:
        # Şarj istasyonu detaylarını al
        details_url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&key={settings.GOOGLE_PLACES_API_KEY}"
        details_response = requests.get(details_url)
        details_response.raise_for_status()
        station_details = details_response.json()

        if 'result' not in station_details:
            return JsonResponse({'error': 'Şarj istasyonu bulunamadı'}, status=404)

        # Yakındaki restoranları al
        lat = station_details['result']['geometry']['location']['lat']
        lng = station_details['result']['geometry']['location']['lng']
        restaurants_url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=2000&type=restaurant&key={settings.GOOGLE_PLACES_API_KEY}"
        
        restaurants_response = requests.get(restaurants_url)
        restaurants_response.raise_for_status()
        results = restaurants_response.json().get('results', [])

        nearby_restaurants = [{
            'place_id': result.get('place_id'),
            'name': result.get('name'),
            'latitude': result['geometry']['location']['lat'],
            'longitude': result['geometry']['location']['lng'],
            'vicinity': result.get('vicinity'),
        } for result in results]

        return JsonResponse({'restaurants': nearby_restaurants})
    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': 'API isteği başarısız oldu'}, status=500)


def get_directions(request):
    required_params = ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng']
    if not all(request.GET.get(param) for param in required_params):
        return JsonResponse({'error': 'Eksik parametreler'}, status=400)

    try:
        url = (
            f"https://maps.googleapis.com/maps/api/directions/json?"
            f"origin={request.GET['origin_lat']},{request.GET['origin_lng']}&"
            f"destination={request.GET['destination_lat']},{request.GET['destination_lng']}&"
            f"mode=driving&key={settings.GOOGLE_PLACES_API_KEY}"
        )
        
        response = requests.get(url)
        response.raise_for_status()
        return JsonResponse(response.json())
    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': 'Rota bilgisi alınamadı'}, status=500)


@csrf_exempt
def save_route_history(request):
    if request.method == 'POST' and request.user.is_authenticated:
        try:
            data = json.loads(request.body)
            
            # Eski format (start_lat, start_lng) -> yeni format (start_latitude, start_longitude) dönüşümü
            route_data = {
                'start_address': data.get('start_address', ''),
                'end_address': data.get('end_address', ''),
                'start_latitude': float(data.get('start_lat', data.get('start_latitude', 0))),
                'start_longitude': float(data.get('start_lng', data.get('start_longitude', 0))),
                'end_latitude': float(data.get('end_lat', data.get('end_latitude', 0))),
                'end_longitude': float(data.get('end_lng', data.get('end_longitude', 0))),
                'total_distance': float(data.get('distance', data.get('total_distance', 0))),
                'total_duration': float(data.get('duration', data.get('total_duration', 0)))
            }
            
            # API endpoint üzerinden rota kaydetme servisi 
            route_history = route_service.create_route(request.user, route_data)
            
            try:
                route_history.full_clean()
                route_history.save()
                print("Rota başarıyla kaydedildi")  # Hata ayıklama için
                return JsonResponse({'status': 'success', 'id': route_history.id})
            except ValidationError as e:
                print("Doğrulama hatası:", str(e))  # Hata ayıklama için
                return JsonResponse({'error': str(e)}, status=400)
            
        except json.JSONDecodeError as e:
            print("JSON çözümleme hatası:", str(e))  # Hata ayıklama için
            return JsonResponse({'error': 'Geçersiz JSON verisi'}, status=400)
        except Exception as e:
            print("Beklenmeyen hata:", str(e))  # Hata ayıklama için
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Geçersiz istek veya kullanıcı girişi yapılmamış'}, status=405)


def get_user_car_info(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Kullanıcı girişi yapılmamış'}, status=401)
    
    try:
        user_car = UserCarPreference.objects.get(user=request.user)
        car_info = {
            'car_name': user_car.selected_car.car_name,
            'average_range': user_car.selected_car.average_range
        }
        return JsonResponse(car_info)
    except UserCarPreference.DoesNotExist:
        return JsonResponse({'error': 'Araç seçimi yapılmamış'}, status=404)


def get_weather(request):
    try:
        lat = request.GET.get('lat')
        lng = request.GET.get('lng')
        
        if not lat or not lng:
            return JsonResponse({'error': 'Koordinatlar gerekli'}, status=400)
            
        weather_api_key = getattr(settings, 'OPENWEATHER_API_KEY', None)
        if not weather_api_key:
            # API anahtarı yoksa varsayılan hava durumu verisi döndür
            return JsonResponse({
                'weather': [{'main': 'Clear', 'description': 'clear sky'}],
                'main': {'temp': 293.15}  # 20°C
            })
            
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={weather_api_key}"
        
        response = requests.get(url, timeout=5)  # 5 saniyelik timeout ekle
        response.raise_for_status()
        
        weather_data = response.json()
        return JsonResponse(weather_data)
        
    except requests.RequestException as e:
        # API hatası durumunda varsayılan veri döndür
        return JsonResponse({
            'weather': [{'main': 'Clear', 'description': 'clear sky'}],
            'main': {'temp': 293.15}  # 20°C
        })
    except Exception as e:
        print(f"Hava durumu hatası: {str(e)}")  # Hata ayıklama için
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def calculate_route(request):
    if request.method == 'POST':
        try:
            # POST verilerini al
            start_lat = float(request.POST.get('start_lat'))
            start_lng = float(request.POST.get('start_lng'))
            end_lat = float(request.POST.get('end_lat'))
            end_lng = float(request.POST.get('end_lng'))
            start_address = request.POST.get('start_address', '')
            end_address = request.POST.get('end_address', '')
            
            # Araç tipine göre strateji seç
            strategy = ElectricCarRouteStrategy() if request.user.usercarpreference.car_type == 'electric' else CarRouteStrategy()
            
            # Rotayı hesapla
            route_details = strategy.calculate_route(start_lat, start_lng, end_lat, end_lng)
            
            # Elektrikli araç için şarj istasyonu kontrolü
            if (request.user.usercarpreference.car_type == 'electric' and 
                route_details.get('distance', 0) > 300 and 
                'charging_station' not in route_details):
                return JsonResponse({
                    'status': 'error',
                    'message': 'Uygun şarj istasyonu bulunamadı. Lütfen farklı bir rota deneyin.'
                }, status=400)
            
            # Rotayı kaydet
            route_data = {
                'start_latitude': start_lat,
                'start_longitude': start_lng,
                'end_latitude': end_lat,
                'end_longitude': end_lng,
                'start_address': start_address,
                'end_address': end_address,
                'total_distance': route_details['distance'],
                'total_duration': route_details['duration']
            }
            
            route = route_service.create_route(request.user, route_data)
            
            response_data = {
                'status': 'success',
                'route': {
                    'distance': route.total_distance,
                    'duration': route.total_duration
                }
            }
            
            # Şarj istasyonu bilgisini ekle
            if 'charging_station' in route_details:
                response_data['route']['charging_station'] = route_details['charging_station']
            
            return JsonResponse(response_data)
            
        except Exception as e:
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=500)
        
    return render(request, 'harita/calculate_route.html')


@login_required
def route_history(request):
    routes = route_service.get_user_route_history(request.user, limit=10)
    return render(request, 'harita/route_history.html', {'routes': routes})


def kullanici_bilgileri(request):
    # Kullanıcı bilgilerini işleyen kod
    return render(request, 'kullanici_bilgileri.html')  # Örnek bir şablon


@csrf_exempt
def get_stopover_suggestions(request):
    if request.method == 'POST':
        if model is None:
            return JsonResponse({'error': 'API yapılandırılamadı.'}, status=500)

        try:
            data = json.loads(request.body)
            cities = data.get('cities', [])

            if not cities or not isinstance(cities, list):
                return JsonResponse({'error': 'Geçerli bir şehir listesi gönderilmedi.'}, status=400)

            prompt_cities_list = "\n".join([f"- {city}" for city in cities])

            prompt = f"""
Kullanıcının oluşturduğu rota boyunca geçtiği şehirler aşağıda listelenmiştir:

{prompt_cities_list}

Kullanıcı, bu yolculuk sırasında bu şehirlerde kısa süreli molalar vermek istemektedir.

Lütfen aşağıdaki yönergelere göre 6 şehir için birer öneri üretin:

- Her şehir için **daha az bilinen, özgün veya alternatif bir öneri** yapmaya çalışın.
- Her şehir için sadece bir öneri yapın.
- Daha önce verilen yanıtları tekrar etmemek için, her çalıştırmada **farklı yerler ve açıklamalar** sunun.
- Önerilen yerler 30-60 dakikalık kısa molalar için uygun olmalı.
- Eğer mümkünse, önerilen yerin **yerel halk tarafından tercih edilen** bir yer olduğuna da değinin.
- Doğal, kültürel veya yöresel yemek mekânı olabilir.
- Cevap şu formatta olmalı (her öneri yeni bir satırda numaralandırılmış olmalı):

1. [Şehir Adı – Yer Adı]: [Kısa açıklama, ardından kısa molada yapılabilecek şeyler.]
2. [Şehir Adı – Yer Adı]: [Kısa açıklama, ardından kısa molada yapılabilecek şeyler.]
...
"""

            generation_config = {
                "temperature": 0.9,
            }
            response = model.generate_content(prompt, generation_config=generation_config)
            
            if hasattr(response, 'text'):
                return JsonResponse({'suggestions': response.text})
            else:
                return JsonResponse({'error': 'Yanıt işlenirken hata oluştu'}, status=500)
                    
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Geçersiz JSON formatı.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Sadece POST istekleri kabul edilir.'}, status=405)


