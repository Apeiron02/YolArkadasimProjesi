from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, permissions, status, generics, mixins
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from kullanicibilgileri.models import ElectricCar, UserCarPreference
from harita.models import RouteHistory
from .serializers import (
    UserSerializer, UserDetailSerializer, RegisterUserSerializer, ElectricCarSerializer, 
    UserCarPreferenceSerializer, RouteHistorySerializer, ChargingStationSerializer,
    UserLocationSerializer, RouteRequestSerializer, RouteWithWaypointsRequestSerializer,
    ZESFiyatSerializer, TrugoFiyatSerializer, 
    VoltrunFiyatSerializer, EsarjFiyatSerializer,
    SarjIstasyonlariFiyatSerializer,
    SarjGecmisiSerializer
)
import json
import requests
from django.conf import settings
from sarjucret.models import ZESFiyat, TrugoFiyat, VoltrunFiyat, EsarjFiyat, SarjGecmisi
from datetime import datetime, date, time
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from harita.views import model

# Kullanıcı kaydı için view
class RegisterUserView(generics.CreateAPIView):
    """
    Yeni kullanıcı kaydetmek için API endpoint'i.
    """
    queryset = User.objects.all()
    serializer_class = RegisterUserSerializer
    permission_classes = [permissions.AllowAny]

# Tüm kullanıcıları listelemek için view
class UserListView(generics.ListAPIView):
    """
    Tüm kullanıcıları görüntülemek için API endpoint'i.
    """
    queryset = User.objects.all()
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı

# Kullanıcı detayları için view
class UserDetailView(generics.RetrieveUpdateAPIView):
    """
    Kullanıcı bilgilerini görüntülemek ve güncellemek için API endpoint'i.
    """
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    
    def get_object(self):
        if not self.request.user.is_authenticated:
            # Test için bir demo kullanıcı döndür
            return User.objects.first()
        return self.request.user

class ElectricCarViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Elektrikli araçları görüntülemek için API endpoint'i.
    """
    queryset = ElectricCar.objects.all()
    serializer_class = ElectricCarSerializer
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı

class UserCarPreferenceViewSet(viewsets.ModelViewSet):
    """
    Kullanıcı araç tercihlerini görüntülemek ve düzenlemek için API endpoint'i.
    """
    serializer_class = UserCarPreferenceSerializer
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            # Test için tüm tercihleri döndür (sıralı)
            return UserCarPreference.objects.all().order_by('-selected_at')
        return UserCarPreference.objects.filter(user=self.request.user).order_by('-selected_at')
    
    def create(self, request, *args, **kwargs):
        # Kullanıcının zaten bir tercihi var mı kontrol et
        if self.request.user.is_authenticated:
            existing_preference = UserCarPreference.objects.filter(user=self.request.user).first()
            if existing_preference:
                # Mevcut tercihi güncelle
                serializer = self.get_serializer(existing_preference, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                self.perform_update(serializer)
                return Response(serializer.data)
        
        # Yeni tercih oluştur
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Araç tercihi güncelleme
        if 'selected_car_id' in request.data:
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        
        return Response({"error": "selected_car_id parametresi gereklidir"}, status=status.HTTP_400_BAD_REQUEST)
    
    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(user=self.request.user)
        else:
            # Test için ilk kullanıcıyı kullan
            serializer.save(user=User.objects.first())

class RouteHistoryViewSet(viewsets.ModelViewSet):
    """
    Kullanıcı rota geçmişini görüntülemek ve yönetmek için API endpoint'i.
    """
    serializer_class = RouteHistorySerializer
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            # Test için tüm rotaları döndür
            return RouteHistory.objects.all()
        return RouteHistory.objects.filter(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """
        Rota geçmişi oluşturmak için API endpoint'i.
        """
        try:
            data = request.data
            
            # Kullanıcı doğrulama kontrolü
            if not request.user.is_authenticated:
                # Test için ilk kullanıcıyı kullan
                data['user'] = User.objects.first().id
            
            # Serializer kullanarak veriyi doğrula ve kaydet
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(user=self.request.user)
        else:
            # Test için ilk kullanıcıyı kullan
            serializer.save(user=User.objects.first())

class NearbyChargingStationsView(APIView):
    """
    Yakındaki şarj istasyonlarını bulmak için API endpoint'i.
    """
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    
    def get(self, request):
        # Gelen parametreleri ve URL'yi loglama
        print(f"API Endpoint çağrıldı: {request.path}")
        print(f"Sorgu parametreleri: {request.query_params}")
        
        # lat ve lng parametrelerini kontrol et
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        
        if not lat or not lng:
            return Response({
                'error': 'Gerekli parametreler eksik: lat ve lng parametreleri gereklidir',
                'received_params': dict(request.query_params)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            lat = float(lat)
            lng = float(lng)
        except (TypeError, ValueError):
            return Response({
                'error': 'Geçersiz koordinat değerleri: lat ve lng sayısal değerler olmalıdır',
                'received_params': {'lat': lat, 'lng': lng}
            }, status=status.HTTP_400_BAD_REQUEST)

        # İsteğe bağlı radius parametresi (metre cinsinden)
        search_radiuses = [5000, 10000, 50000]  # 5 km, 10 km, 50 km - Varsayılan değeri tanımla
        radius_param = request.query_params.get('radius')
        if radius_param:
            try:
                radius = int(radius_param)
                if radius <= 0:
                    raise ValueError("Yarıçap pozitif bir sayı olmalıdır")
                # Eğer tek bir radius değeri verilmişse, sadece o değeri içeren bir liste oluştur
                search_radiuses = [radius]
            except (TypeError, ValueError):
                return Response({
                    'error': 'Geçersiz yarıçap değeri: radius pozitif bir sayı olmalıdır',
                    'received_params': {'radius': radius_param}
                }, status=status.HTTP_400_BAD_REQUEST)

        try:
            nearby_stations = []
            
            # Kademeli arama: Önce 5 km, sonra 10 km, sonra 50 km
            for radius in search_radiuses:
                if nearby_stations and len(nearby_stations) >= 3:
                    # En az 3 istasyon bulunduğunda, daha fazla aramayı bırak
                    break
                
                print(f"{radius/1000} km yarıçapında şarj istasyonları aranıyor...")
                # Şarj istasyonları için Places API sorgusu
                url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius={radius}&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
                
                response = requests.get(url)
                response.raise_for_status()
                data = response.json()
                
                # Arama sonuçlarını filtrele ve listeye ekle
                for place in data.get('results', []):
                    # Eğer bu istasyon zaten bulunmuşsa atla
                    place_id = place.get('place_id')
                    if any(station['place_id'] == place_id for station in nearby_stations):
                        continue
                        
                    # Şarj istasyonu olma olasılığı olan yerleri filtrele
                    if any(keyword in place.get('name', '').lower() for keyword in ["şarj", "charge", "charging", "şarj istasyonu", "charging station"]):
                        station_info = {
                            'place_id': place_id,
                            'name': place.get('name'),
                            'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
                            'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
                            'vicinity': place.get('vicinity', ''),
                            'rating': place.get('rating', 0),
                            'distance': radius,  # Hangi yarıçapta bulunduğu
                        }
                        nearby_stations.append(station_info)
            
            
            print(f"Bulunan şarj istasyonu sayısı: {len(nearby_stations)}")
            
            # Serializer kullanarak istasyonları formatlama
            serializer = ChargingStationSerializer(nearby_stations, many=True)
            return Response({'stations': serializer.data})
        except requests.exceptions.RequestException as e:
            return Response({'error': f'API isteği başarısız oldu: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RouteBaseAPIView(APIView):
    """
    Rota ile ilgili API isteklerinin temel sınıfı.
    Temel rota bilgisi işleme, kaydetme ve yanıt oluşturma görevlerini sağlar.
    """
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    
    def save_route_history(self, user, response_data, request_data):
        # API yanıtından rota bilgilerini çıkart
        if 'routes' in response_data and len(response_data['routes']) > 0:
            route = response_data['routes'][0]
            if 'legs' in route and len(route['legs']) > 0:
                leg = route['legs'][0]
                
                # Başlangıç ve bitiş adresleri
                start_address = leg.get('start_address', '')
                end_address = leg.get('end_address', '')
                
                # Eğer kullanıcı tarafından adresler verilmişse, onları kullan
                if 'origin_address' in request_data:
                    start_address = request_data['origin_address']
                
                if 'destination_address' in request_data:
                    end_address = request_data['destination_address']
                
                # Toplam mesafe ve süre değerleri
                distance_value = leg.get('distance', {}).get('value', 0) / 1000  # m -> km
                duration_value = leg.get('duration', {}).get('value', 0) / 60  # sn -> dk
                
                # Rota verilerini oluşturup kaydet
                from harita.services import RouteService
                route_service = RouteService()
                
                # Koordinat bilgileri
                origin_lat = float(request_data['origin_lat'])
                origin_lng = float(request_data['origin_lng'])
                destination_lat = float(request_data['destination_lat'])
                destination_lng = float(request_data['destination_lng'])
                
                route_data = {
                    'start_address': start_address,
                    'end_address': end_address,
                    'start_latitude': origin_lat,
                    'start_longitude': origin_lng,
                    'end_latitude': destination_lat,
                    'end_longitude': destination_lng,
                    'total_distance': distance_value,
                    'total_duration': duration_value
                }
                
                return route_service.create_route(user, route_data)
        
        return None
    
    def process_route_request(self, origin, destination, mode='driving', alternatives='false'):
        """
        Verilen parametrelerle Google Maps Directions API'ye istek gönderir ve sonuçları döndürür.
        origin ve destination parametreleri hem koordinat hem de adres olabilir.
        """
        # API URL'i oluştur
        url = (
            f"https://maps.googleapis.com/maps/api/directions/json?"
            f"origin={origin}&"
            f"destination={destination}&"
            f"mode={mode}&alternatives={alternatives}&key={settings.GOOGLE_PLACES_API_KEY}"
        )
        
        # API'ye istek gönder
        response = requests.get(url)
        response.raise_for_status()
        
        # API yanıtını JSON olarak döndür
        return response.json()

class DirectionsView(RouteBaseAPIView):
    """
    Rota hesaplama için tüm API endpoint'lerini içeren sınıf.
    Bu endpoint aşağıdaki işlevleri destekler:
    - Basit rota hesaplama (GET/POST)
    - Ara noktalı (waypoints) rota hesaplama (POST)
    """
    
    def get(self, request):
        # Parametrelerin var olup olmadığını kontrol et
        if not request.query_params:
            # Parametre yoksa, kullanım talimatlarını içeren bir yanıt döndür
            return Response({
                'error': 'Gerekli parametreler eksik',
                'message': 'Rota bilgisi almak için POST metodunu kullanmanız önerilir. GET kullanmak isterseniz, aşağıdaki parametreleri eklemelisiniz.',
                'required_params': ['origin_lat ve origin_lng VEYA origin_address', 'destination_lat ve destination_lng VEYA destination_address'],
                'example_coords': '/api/v1/rota-bilgisi/?origin_lat=38.6748&origin_lng=39.2225&destination_lat=39.1&destination_lng=40.1',
                'example_address': '/api/v1/rota-bilgisi/?origin_address=İstanbul&destination_address=Ankara',
                'note': 'POST metodu kullanmak, daha güvenli ve kararlı bir yöntemdir.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Adres veya koordinat parametrelerini kontrol et
        has_coords = all(param in request.query_params for param in ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'])
        has_addresses = all(param in request.query_params for param in ['origin_address', 'destination_address'])
        
        if not (has_coords or has_addresses):
            return Response({
                'error': 'Gerekli parametreler eksik',
                'message': 'Koordinat (origin_lat, origin_lng, destination_lat, destination_lng) veya adres (origin_address, destination_address) parametrelerini sağlamalısınız.',
                'received_params': dict(request.query_params)
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # İsteğe bağlı parametreleri al
            mode = request.query_params.get('mode', 'driving')
            
            # Mode doğrulaması
            valid_modes = ['driving', 'walking', 'bicycling', 'transit']
            if mode not in valid_modes:
                return Response({'error': f'Geçersiz mod. Şunlardan biri olmalı: {valid_modes}'}, 
                                status=status.HTTP_400_BAD_REQUEST)
                                
            # Alternatif rotalar
            alternatives = request.query_params.get('alternatives', 'false')
            
            # Koordinat veya adres kullanarak rota bilgisini al
            if has_coords:
                # Parametre tipi kontrolü - sayısal değerler olmalı
                try:
                    origin_lat = float(request.query_params.get('origin_lat'))
                    origin_lng = float(request.query_params.get('origin_lng'))
                    destination_lat = float(request.query_params.get('destination_lat'))
                    destination_lng = float(request.query_params.get('destination_lng'))
                    origin = f"{origin_lat},{origin_lng}"
                    destination = f"{destination_lat},{destination_lng}"
                    
                    # Rota bilgisini kaydetmek için kullanılacak veriler
                    request_data = {
                        'origin_lat': origin_lat,
                        'origin_lng': origin_lng,
                        'destination_lat': destination_lat,
                        'destination_lng': destination_lng,
                        'mode': mode
                    }
                except (ValueError, TypeError):
                    return Response({
                        'error': 'Koordinat değerleri sayısal olmalıdır',
                        'received_params': {
                            'origin_lat': request.query_params.get('origin_lat'),
                            'origin_lng': request.query_params.get('origin_lng'),
                            'destination_lat': request.query_params.get('destination_lat'),
                            'destination_lng': request.query_params.get('destination_lng')
                        }
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Adres parametrelerini kullan
                origin_address = request.query_params.get('origin_address')
                destination_address = request.query_params.get('destination_address')
                origin = origin_address
                destination = destination_address
                
                # Adres bilgilerini kaydetmek için kullanılacak veriler
                # Not: Adres kullanıldığında, koordinatlar API yanıtından alınacak
                request_data = {
                    'origin_address': origin_address,
                    'destination_address': destination_address,
                    'mode': mode
                }
            
            # Rota bilgisini al
            result = self.process_route_request(origin, destination, mode, alternatives)
            
            # Eğer adres kullanıldıysa ve API yanıtı başarılıysa, koordinatları çıkart
            if has_addresses and result.get('status') == 'OK' and 'routes' in result and len(result['routes']) > 0:
                route = result['routes'][0]
                if 'legs' in route and len(route['legs']) > 0:
                    leg = route['legs'][0]
                    
                    # Başlangıç ve bitiş koordinatlarını al
                    if 'start_location' in leg:
                        request_data['origin_lat'] = leg['start_location'].get('lat')
                        request_data['origin_lng'] = leg['start_location'].get('lng')
                    
                    if 'end_location' in leg:
                        request_data['destination_lat'] = leg['end_location'].get('lat')
                        request_data['destination_lng'] = leg['end_location'].get('lng')
            
            # Eğer kullanıcı giriş yapmışsa rota bilgisini kaydet
            route_data = None
            if request.user.is_authenticated and all(key in request_data for key in ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng']):
                route_data = self.save_route_history(request.user, result, request_data)
            
            # Kullanıcı giriş yapmışsa ve rota kaydedildiyse, response içinde kayıt bilgisi de gönder
            if route_data:
                result['saved_route'] = {
                    'id': route_data.id,
                    'saved_at': route_data.created_at.isoformat()
                }
                
            return Response(result)
            
        except requests.exceptions.RequestException as e:
            return Response({'error': f'Rota bilgisi alınamadı: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': f'İşlem sırasında hata oluştu: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """
        İstek tipine göre uygun metodu çağıran post metodu.
        İstek içinde 'waypoints' bilgisi varsa, ara noktalı rota hesaplama yapar.
        """
        if 'waypoints' in request.data:
            return self.create_route_with_waypoints(request)
        else:
            return self.create_route(request)
    
    def create_route(self, request):
        """
        Basit rota oluşturma metodudur. Başlangıç ve bitiş noktalarına göre rota oluşturur.
        Koordinat veya adres kabul edebilir.
        """
        # Adres bilgilerinin olup olmadığını kontrol et
        has_coords = all(key in request.data for key in ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'])
        has_addresses = all(key in request.data for key in ['origin_address', 'destination_address'])
        
        if not (has_coords or has_addresses):
            return Response({
                'error': 'Gerekli parametreler eksik',
                'message': 'Koordinat (origin_lat, origin_lng, destination_lat, destination_lng) veya adres (origin_address, destination_address) parametrelerini sağlamalısınız.',
                'received_params': dict(request.data)
            }, status=status.HTTP_400_BAD_REQUEST)

        # Eğer adres bilgileri varsa, Google Geocoding API ile koordinatlara çevir
        if has_addresses and not has_coords:
            try:
                # Başlangıç adresini koordinatlara çevir
                origin_address = request.data.get('origin_address')
                geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={origin_address}&key={settings.GOOGLE_PLACES_API_KEY}"
                response = requests.get(geocode_url)
                response.raise_for_status()
                result = response.json()
                
                if result['status'] != 'OK' or not result.get('results'):
                    return Response({'error': f'Başlangıç adresi koordinatlara çevrilemedi: {result["status"]}'}, 
                                    status=status.HTTP_400_BAD_REQUEST)
                
                origin_location = result['results'][0]['geometry']['location']
                origin_lat = origin_location['lat']
                origin_lng = origin_location['lng']
                
                # Hedef adresini koordinatlara çevir
                destination_address = request.data.get('destination_address')
                geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={destination_address}&key={settings.GOOGLE_PLACES_API_KEY}"
                response = requests.get(geocode_url)
                response.raise_for_status()
                result = response.json()
                
                if result['status'] != 'OK' or not result.get('results'):
                    return Response({'error': f'Hedef adresi koordinatlara çevrilemedi: {result["status"]}'}, 
                                    status=status.HTTP_400_BAD_REQUEST)
                
                destination_location = result['results'][0]['geometry']['location']
                destination_lat = destination_location['lat']
                destination_lng = destination_location['lng']
                
                # Veriyi güncelle
                data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
                data.update({
                    'origin_lat': origin_lat,
                    'origin_lng': origin_lng,
                    'destination_lat': destination_lat,
                    'destination_lng': destination_lng
                })
                
                # RouteRequestSerializer'a geçerek devam et
                serializer = RouteRequestSerializer(data=data)
            except requests.exceptions.RequestException as e:
                return Response({'error': f'Geocoding hatası: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Koordinatlar doğrudan verilmişse
            serializer = RouteRequestSerializer(data=request.data)
            
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Serializer verileri alınıp Google Maps Directions API kullanılıyor
        try:
            validated_data = serializer.validated_data
            
            # Alternatif rotalar
            alternatives = request.data.get('alternatives', 'false')
            
            # Adres bilgileri varsa, origin ve destination olarak onları kullan
            if has_addresses:
                origin = request.data.get('origin_address')
                destination = request.data.get('destination_address')
                result = self.process_route_request(origin, destination, validated_data['mode'], alternatives)
            else:
                # Koordinatları kullan
                origin = f"{validated_data['origin_lat']},{validated_data['origin_lng']}"
                destination = f"{validated_data['destination_lat']},{validated_data['destination_lng']}"
                result = self.process_route_request(origin, destination, validated_data['mode'], alternatives)
            
            # Eğer kullanıcı giriş yapmışsa rota bilgisini kaydet
            route_data = None
            if request.user.is_authenticated:
                # Eğer adres bilgileri verilmişse, request_data'ya ekle
                if has_addresses:
                    validated_data = dict(validated_data)
                    validated_data['origin_address'] = request.data.get('origin_address')
                    validated_data['destination_address'] = request.data.get('destination_address')
                
                route_data = self.save_route_history(request.user, result, validated_data)
            
            # Kullanıcı giriş yapmışsa ve rota kaydedildiyse, response içinde kayıt bilgisi de gönder
            if route_data:
                result['saved_route'] = {
                    'id': route_data.id,
                    'saved_at': route_data.created_at.isoformat()
                }
                
            return Response(result)
            
        except requests.exceptions.RequestException as e:
            return Response({'error': f'Rota bilgisi alınamadı: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': f'İşlem sırasında hata oluştu: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def create_route_with_waypoints(self, request):
        """
        Ara noktalı (waypoints) rota oluşturma metodudur.
        Başlangıç, bitiş ve ara noktalara göre rota oluşturur.
        """
        # Adres bilgilerinin olup olmadığını kontrol et
        has_coords = all(key in request.data for key in ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'])
        has_addresses = all(key in request.data for key in ['origin_address', 'destination_address'])
        
        if not (has_coords or has_addresses):
            return Response({
                'error': 'Gerekli parametreler eksik',
                'message': 'Koordinat (origin_lat, origin_lng, destination_lat, destination_lng) veya adres (origin_address, destination_address) parametrelerini sağlamalısınız.',
                'received_params': dict(request.data)
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # Eğer adres bilgileri varsa, Google Geocoding API ile koordinatlara çevir
        if has_addresses and not has_coords:
            try:
                # Başlangıç adresini koordinatlara çevir
                origin_address = request.data.get('origin_address')
                geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={origin_address}&key={settings.GOOGLE_PLACES_API_KEY}"
                response = requests.get(geocode_url)
                response.raise_for_status()
                result = response.json()
                
                if result['status'] != 'OK' or not result.get('results'):
                    return Response({'error': f'Başlangıç adresi koordinatlara çevrilemedi: {result["status"]}'}, 
                                    status=status.HTTP_400_BAD_REQUEST)
                
                origin_location = result['results'][0]['geometry']['location']
                origin_lat = origin_location['lat']
                origin_lng = origin_location['lng']
                
                # Hedef adresini koordinatlara çevir
                destination_address = request.data.get('destination_address')
                geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={destination_address}&key={settings.GOOGLE_PLACES_API_KEY}"
                response = requests.get(geocode_url)
                response.raise_for_status()
                result = response.json()
                
                if result['status'] != 'OK' or not result.get('results'):
                    return Response({'error': f'Hedef adresi koordinatlara çevrilemedi: {result["status"]}'}, 
                                    status=status.HTTP_400_BAD_REQUEST)
                
                destination_location = result['results'][0]['geometry']['location']
                destination_lat = destination_location['lat']
                destination_lng = destination_location['lng']
                
                # Veriyi güncelle
                data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
                data.update({
                    'origin_lat': origin_lat,
                    'origin_lng': origin_lng,
                    'destination_lat': destination_lat,
                    'destination_lng': destination_lng
                })
                
                # RouteWithWaypointsRequestSerializer'a geçerek devam et
                serializer = RouteWithWaypointsRequestSerializer(data=data)
            except requests.exceptions.RequestException as e:
                return Response({'error': f'Geocoding hatası: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Koordinatlar doğrudan verilmişse
            serializer = RouteWithWaypointsRequestSerializer(data=request.data)
            
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Serializer verileri alınıp Google Maps Directions API kullanılıyor
        try:
            validated_data = serializer.validated_data
            
            # Waypoint verilerini formatla
            waypoints = ""
            if 'waypoints' in validated_data and validated_data['waypoints']:
                waypoint_list = []
                
                for wp in validated_data['waypoints']:
                    location = f"{wp['location_lat']},{wp['location_lng']}"
                    if wp['stopover']:
                        location = f"via:{location}"
                    waypoint_list.append(location)
                
                waypoints = "&waypoints="
                if validated_data.get('optimize_waypoints', False):
                    waypoints += "optimize:true|"
                
                waypoints += "|".join(waypoint_list)
            
            # Adres bilgileri varsa, origin ve destination olarak onları kullan
            if has_addresses:
                origin = request.data.get('origin_address')
                destination = request.data.get('destination_address')
            else:
                # Koordinatları kullan
                origin = f"{validated_data['origin_lat']},{validated_data['origin_lng']}"
                destination = f"{validated_data['destination_lat']},{validated_data['destination_lng']}"
            
            # Directions API'ye istek
            result = self.process_route_request(
                origin, 
                destination, 
                validated_data['mode'], 
                validated_data.get('alternatives', 'false')
            )
            
            # Eğer kullanıcı giriş yapmışsa rota bilgisini kaydet
            route_data = None
            if request.user.is_authenticated:
                # Eğer adres bilgileri verilmişse, request_data'ya ekle
                if has_addresses:
                    validated_data = dict(validated_data)
                    validated_data['origin_address'] = request.data.get('origin_address')
                    validated_data['destination_address'] = request.data.get('destination_address')
                
                route_data = self.save_route_history(request.user, result, validated_data)
            
            # Kullanıcı giriş yapmışsa ve rota kaydedildiyse, response içinde kayıt bilgisi de gönder
            if route_data:
                result['saved_route'] = {
                    'id': route_data.id,
                    'saved_at': route_data.created_at.isoformat()
                }
                
            return Response(result)
            
        except requests.exceptions.RequestException as e:
            return Response({'error': f'Rota bilgisi alınamadı: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': f'İşlem sırasında hata oluştu: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WeatherView(APIView):
    """
    Belirli bir konumdaki hava durumu bilgisini almak için API endpoint'i.
    """
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    
    def get(self, request):
        try:
            lat = request.query_params.get('lat')
            lng = request.query_params.get('lng')
            
            if not lat or not lng:
                return Response({'error': 'Koordinatlar gerekli'}, status=status.HTTP_400_BAD_REQUEST)
                
            weather_api_key = getattr(settings, 'OPENWEATHER_API_KEY', None)
            if not weather_api_key:
                # API anahtarı yoksa varsayılan hava durumu verisi döndür
                return Response({
                    'weather': [{'main': 'Clear', 'description': 'clear sky'}],
                    'main': {'temp': 293.15}  # 20°C
                })
                
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={weather_api_key}"
            
            response = requests.get(url, timeout=5)  # 5 saniyelik timeout ekle
            response.raise_for_status()
            
            weather_data = response.json()
            return Response(weather_data)
            
        except requests.RequestException as e:
            # API hatası durumunda varsayılan veri döndür
            return Response({
                'weather': [{'main': 'Clear', 'description': 'clear sky'}],
                'main': {'temp': 293.15}  # 20°C
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserLocationView(APIView):
    """
    Kullanıcının mevcut konumunu almak için API endpoint'i.
    Bu endpoint hem web hem mobil istemciler için kullanılabilir.
    """
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    authentication_classes = []  # CSRF kontrolünü devre dışı bırakmak için boş liste
    
    def get(self, request):
        # Mobil uygulamalar için GET isteğiyle de konum bilgisini işleyebiliriz
        # URL parametrelerinden enlem ve boylam bilgilerini al
        lat = request.query_params.get('latitude')
        lng = request.query_params.get('longitude')
        
        if lat and lng:
            try:
                lat = float(lat)
                lng = float(lng)
                
                # Konum bilgisini formatlayıp döndür
                location_data = {
                    'latitude': lat,
                    'longitude': lng,
                    'success': True,
                    'message': 'Konum başarıyla alındı'
                }
                
                serializer = UserLocationSerializer(data=location_data)
                if serializer.is_valid():
                    return Response(serializer.data)
                else:
                    return Response({
                        'success': False,
                        'message': 'Geçersiz konum bilgisi',
                        'errors': serializer.errors
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (TypeError, ValueError):
                return Response({
                    'success': False,
                    'message': 'Geçersiz koordinat değerleri',
                    'received_params': {'latitude': lat, 'longitude': lng}
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Mobil uygulama için kullanım talimatlarını içeren yanıt
            return Response({
                'success': False,
                'message': 'Mobil uygulama için konum bilgisi gerekli',
                'instructions': 'GET isteği için ?latitude=X&longitude=Y parametrelerini kullanın veya POST ile konum gönderin',
                'example': '/api/kullanici-konumu/?latitude=38.6748&longitude=39.2225'
            })
    
    def post(self, request):
        # İstemci tarafından gönderilen konum bilgisini işle
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        
        if not lat or not lng:
            return Response({
                'success': False,
                'message': 'Gerekli parametreler eksik: latitude ve longitude parametreleri gereklidir',
                'received_params': dict(request.data)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            lat = float(lat)
            lng = float(lng)
            
            # Serializer ile doğrulama ve formatlama
            location_data = {
                'latitude': lat,
                'longitude': lng,
                'success': True,
                'message': 'Konum başarıyla alındı'
            }
            
            serializer = UserLocationSerializer(data=location_data)
            if serializer.is_valid():
                # Burada isteğe bağlı olarak konum bilgisi veritabanına kaydedilebilir
                return Response(serializer.data)
            else:
                return Response({
                    'success': False,
                    'message': 'Geçersiz konum bilgisi',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'message': 'Geçersiz koordinat değerleri: latitude ve longitude sayısal değerler olmalıdır',
                'received_params': {'latitude': lat, 'longitude': lng}
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Sunucu hatası: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RouteChargingStationsView(APIView):
    """
    Rota üzerindeki şarj istasyonlarını bulmak için API endpoint'i.
    """
    permission_classes = [permissions.AllowAny]  # Test için AllowAny yapıldı
    
    def get(self, request):
        try:
            # Tek bir nokta için şarj istasyonu araması
            lat = request.query_params.get('lat')
            lng = request.query_params.get('lng')
            
            if not lat or not lng:
                return Response({
                    'error': 'Koordinatlar gerekli',
                    'received_params': dict(request.query_params)
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                lat = float(lat)
                lng = float(lng)
            except (TypeError, ValueError):
                return Response({
                    'error': 'Geçersiz koordinat değerleri',
                    'received_params': {'lat': lat, 'lng': lng}
                }, status=status.HTTP_400_BAD_REQUEST)

            # Şarj istasyonları için Places API sorgusu
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=5000&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
            
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

            # Serializer kullanarak istasyonları formatlama
            serializer = ChargingStationSerializer(nearby_stations, many=True)
            return Response({'stations': serializer.data})
            
        except requests.exceptions.RequestException as e:
            return Response({'error': f'API isteği başarısız oldu: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        try:
            # Gelen veriyi logla
            print("Gelen veri:", request.data)
            
            # Rota noktalarını al
            route_points = request.data.get('route_points', [])
            if not route_points:
                return Response({
                    'error': 'Rota noktaları gerekli',
                    'message': 'route_points parametresi boş veya eksik',
                    'received_data': request.data,
                    'expected_format': {
                        'route_points': [
                            {'lat': 41.0082, 'lng': 28.9784},
                            {'lat': 39.9334, 'lng': 32.8597}
                        ]
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            # Rota noktalarının formatını kontrol et
            for i, point in enumerate(route_points):
                if not isinstance(point, dict):
                    return Response({
                        'error': 'Geçersiz nokta formatı',
                        'message': f'{i}. nokta bir sözlük (dictionary) olmalıdır',
                        'received_point': point,
                        'expected_format': {'lat': 41.0082, 'lng': 28.9784}
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                lat = point.get('lat')
                lng = point.get('lng')
                
                if not lat or not lng:
                    return Response({
                        'error': 'Eksik koordinat bilgisi',
                        'message': f'{i}. noktada lat veya lng değeri eksik',
                        'received_point': point,
                        'expected_format': {'lat': 41.0082, 'lng': 28.9784}
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                try:
                    lat = float(lat)
                    lng = float(lng)
                except (TypeError, ValueError):
                    return Response({
                        'error': 'Geçersiz koordinat değerleri',
                        'message': f'{i}. noktadaki lat ve lng değerleri sayısal olmalıdır',
                        'received_point': point,
                        'expected_format': {'lat': 41.0082, 'lng': 28.9784}
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Başlangıç ve varış noktalarını hariç tut
            route_points = route_points[1:-1] if len(route_points) > 2 else []

            # Belirli aralıklarla noktaları seç (her 5 noktadan birini al)
            selected_points = route_points[::5] if len(route_points) > 5 else route_points

            nearby_stations = []
            processed_stations = set()  # Tekrar eden istasyonları önlemek için

            # Seçilen noktalar için şarj istasyonlarını ara
            for point in selected_points:
                lat = point.get('lat')
                lng = point.get('lng')
                
                if not lat or not lng:
                    continue

                # Şarj istasyonları için Places API sorgusu - arama yarıçapını 5km'ye düşür
                url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=5000&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
                
                response = requests.get(url)
                response.raise_for_status()
                data = response.json()
                
                # Arama sonuçlarını filtrele ve listeye ekle
                for place in data.get('results', []):
                    place_id = place.get('place_id')
                    
                    # Eğer bu istasyon zaten işlenmişse atla
                    if place_id in processed_stations:
                        continue
                    
                    processed_stations.add(place_id)
                    
                    # Şarj istasyonu olma olasılığı olan yerleri filtrele
                    if any(keyword in place.get('name', '').lower() for keyword in ["şarj", "charge", "charging", "şarj istasyonu", "charging station"]):
                        station_info = {
                            'place_id': place_id,
                            'name': place.get('name'),
                            'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
                            'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
                            'vicinity': place.get('vicinity', ''),
                            'rating': place.get('rating', 0),
                        }
                        nearby_stations.append(station_info)

            # Serializer kullanarak istasyonları formatlama
            serializer = ChargingStationSerializer(nearby_stations, many=True)
            return Response({'stations': serializer.data})
            
        except requests.exceptions.RequestException as e:
            return Response({
                'error': 'API isteği başarısız oldu',
                'message': str(e),
                'received_data': request.data
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({
                'error': 'İşlem sırasında hata oluştu',
                'message': str(e),
                'received_data': request.data
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Şarj İstasyonu Fiyatları API Endpointleri
class ZESFiyatViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ZES şarj istasyonu fiyatlarını görüntülemek için API endpoint'i.
    """
    queryset = ZESFiyat.objects.all().order_by('-eklenme_tarihi', 'sarj_tipi')
    serializer_class = ZESFiyatSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        # Her bir sarj_tipi için en son fiyatı al
        sarj_tipleri = ZESFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
        latest_prices = []
        
        for sarj_tipi in sarj_tipleri:
            latest = ZESFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
            if latest:
                latest_prices.append(latest.pk)
        
        return ZESFiyat.objects.filter(pk__in=latest_prices).order_by('sarj_tipi')

class TrugoFiyatViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Trugo şarj istasyonu fiyatlarını görüntülemek için API endpoint'i.
    """
    queryset = TrugoFiyat.objects.all().order_by('-eklenme_tarihi', 'sarj_tipi')
    serializer_class = TrugoFiyatSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        # Her bir sarj_tipi için en son fiyatı al
        sarj_tipleri = TrugoFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
        latest_prices = []
        
        for sarj_tipi in sarj_tipleri:
            latest = TrugoFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
            if latest:
                latest_prices.append(latest.pk)
        
        return TrugoFiyat.objects.filter(pk__in=latest_prices).order_by('sarj_tipi')

class VoltrunFiyatViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Voltrun şarj istasyonu fiyatlarını görüntülemek için API endpoint'i.
    """
    queryset = VoltrunFiyat.objects.all().order_by('-eklenme_tarihi', 'membership_type', 'sarj_tipi')
    serializer_class = VoltrunFiyatSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        # Her bir membership_type ve sarj_tipi kombinasyonu için en son fiyatı al
        membership_sarj_tipleri = VoltrunFiyat.objects.values_list('membership_type', 'sarj_tipi').distinct()
        latest_prices = []
        
        for membership_type, sarj_tipi in membership_sarj_tipleri:
            latest = VoltrunFiyat.objects.filter(
                membership_type=membership_type,
                sarj_tipi=sarj_tipi
            ).order_by('-eklenme_tarihi').first()
            
            if latest:
                latest_prices.append(latest.pk)
        
        return VoltrunFiyat.objects.filter(pk__in=latest_prices).order_by('membership_type', 'sarj_tipi')

class EsarjFiyatViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Esarj şarj istasyonu fiyatlarını görüntülemek için API endpoint'i.
    """
    queryset = EsarjFiyat.objects.all().order_by('-eklenme_tarihi', 'sarj_tipi')
    serializer_class = EsarjFiyatSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        # Her bir sarj_tipi için en son fiyatı al
        sarj_tipleri = EsarjFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
        latest_prices = []
        
        for sarj_tipi in sarj_tipleri:
            latest = EsarjFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
            if latest:
                latest_prices.append(latest.pk)
        
        return EsarjFiyat.objects.filter(pk__in=latest_prices).order_by('sarj_tipi')

class SarjIstasyonlariFiyatView(APIView):
    """
    Tüm şarj istasyonlarının en son fiyatlarını bir arada görüntülemek için API endpoint'i.
    """
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        # ZES fiyatları
        sarj_tipleri = ZESFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
        zes_fiyatlari = []
        
        for sarj_tipi in sarj_tipleri:
            latest = ZESFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
            if latest:
                zes_fiyatlari.append(latest)
        
        # Trugo fiyatları
        trugo_sarj_tipleri = TrugoFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
        trugo_fiyatlari = []
        
        for sarj_tipi in trugo_sarj_tipleri:
            latest = TrugoFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
            if latest:
                trugo_fiyatlari.append(latest)
        
        # Voltrun fiyatları
        voltrun_fiyatlari = []
        voltrun_membership_types = VoltrunFiyat.objects.values_list('membership_type', 'sarj_tipi').distinct()
        
        for membership_type, sarj_tipi in voltrun_membership_types:
            latest = VoltrunFiyat.objects.filter(
                membership_type=membership_type,
                sarj_tipi=sarj_tipi
            ).order_by('-eklenme_tarihi').first()
            if latest:
                voltrun_fiyatlari.append(latest)
        
        # Esarj fiyatları
        esarj_sarj_tipleri = EsarjFiyat.objects.values_list('sarj_tipi', flat=True).distinct()
        esarj_fiyatlari = []
        
        for sarj_tipi in esarj_sarj_tipleri:
            latest = EsarjFiyat.objects.filter(sarj_tipi=sarj_tipi).order_by('-eklenme_tarihi').first()
            if latest:
                esarj_fiyatlari.append(latest)
        
        # En son güncelleme tarihini bul
        son_guncelleme = datetime.now()
        try:
            eklenme_tarihleri = []
            if zes_fiyatlari:
                eklenme_tarihleri.append(max(f.eklenme_tarihi for f in zes_fiyatlari))
            if trugo_fiyatlari:
                eklenme_tarihleri.append(max(f.eklenme_tarihi for f in trugo_fiyatlari))
            if voltrun_fiyatlari:
                eklenme_tarihleri.append(max(f.eklenme_tarihi for f in voltrun_fiyatlari))
            if esarj_fiyatlari:
                eklenme_tarihleri.append(max(f.eklenme_tarihi for f in esarj_fiyatlari))
            
            if eklenme_tarihleri:
                # date objesini datetime objesine dönüştür
                en_son_tarih = max(eklenme_tarihleri)
                son_guncelleme = datetime.combine(en_son_tarih, datetime.min.time())
        except Exception as e:
            print(f"Son güncelleme tarihi hesaplanırken hata: {e}")
        
        # Tüm verileri bir araya getir
        veri = {
            'zes': zes_fiyatlari,
            'trugo': trugo_fiyatlari,
            'voltrun': voltrun_fiyatlari,
            'esarj': esarj_fiyatlari,
            'son_guncelleme': son_guncelleme
        }
        
        # Serialize et ve döndür
        serializer = SarjIstasyonlariFiyatSerializer(veri)
        return Response(serializer.data)
    

@method_decorator(csrf_exempt, name='dispatch')
class StopoverSuggestionsAPIView(APIView):
    """
    Rota üzerindeki şehirler için kısa mola önerileri sunan API endpoint'i.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # model nesnesinin tanımlı olduğundan emin olun
        if model is None:
            return Response({'error': 'API yapılandırılamadı.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        cities = request.data.get('cities', [])
        if not cities or not isinstance(cities, list):
            return Response({'error': 'Geçerli bir şehir listesi gönderilmedi.'}, status=status.HTTP_400_BAD_REQUEST)

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
- **Önerilen yerler, belirtilen şehirlerin ana güzergahı üzerinde veya çok yakınında olmalı, rotadan uzaklaşmamalıdır.**
- Her öneri için yerin **tam açık adresi ve enlem-boylam koordinatları (latitude, longitude)** mutlaka belirtilmelidir.
- Cevap şu formatta olmalı (her öneri yeni bir satırda numaralandırılmış olmalı):

1. [Şehir Adı – Yer Adı]: [Kısa açıklama, ardından kısa molada yapılabilecek şeyler. Adres: [Açık Adres]. Koordinatlar: [Enlem], [Boylam]]
2. [Şehir Adı – Yer Adı]: [Kısa açıklama, ardından kısa molada yapılabilecek şeyler. Adres: [Açık Adres]. Koordinatlar: [Enlem], [Boylam]]
...
"""

        generation_config = {
            "temperature": 0.9,
        }
        try:
            response = model.generate_content(prompt, generation_config=generation_config)
            if hasattr(response, 'text'):
                return Response({'suggestions': response.text})
            else:
                return Response({'error': 'Yanıt işlenirken hata oluştu'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SarjGecmisiViewSet(viewsets.ModelViewSet):
    """
    Kullanıcının şarj geçmişini listeleyen ve yeni kayıt eklemesini sağlayan API endpoint'i.
    Sadece giriş yapmış kullanıcı kendi geçmişini görebilir ve ekleyebilir.
    """
    serializer_class = SarjGecmisiSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SarjGecmisi.objects.filter(user=self.request.user).order_by('-tarih')
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    