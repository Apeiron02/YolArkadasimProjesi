from abc import ABC, abstractmethod
import math
import requests
from django.conf import settings

class RouteStrategy(ABC):
    @abstractmethod
    def calculate_route(self, start_lat, start_lng, end_lat, end_lng):
        """Rota hesaplama stratejisi"""
        pass

class CarRouteStrategy(RouteStrategy):
    def calculate_route(self, start_lat, start_lng, end_lat, end_lng):
        """Araç rotası hesaplama"""
        # Basit düz çizgi mesafe hesaplaması (örnek)
        R = 6371  # Dünya yarıçapı (km)
        dlat = math.radians(end_lat - start_lat)
        dlng = math.radians(end_lng - start_lng)
        
        a = (math.sin(dlat/2) * math.sin(dlat/2) +
             math.cos(math.radians(start_lat)) * math.cos(math.radians(end_lat)) *
             math.sin(dlng/2) * math.sin(dlng/2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        
        # Ortalama araç hızı 60 km/s varsayarak süre hesaplama
        duration = (distance / 60) * 60  # dakika cinsinden
        
        return {
            'distance': distance,
            'duration': duration
        }

class ElectricCarRouteStrategy(CarRouteStrategy):
    def find_charging_stations(self, lat, lng, radius=50000):
        """Belirli bir konumun çevresindeki şarj istasyonlarını bulur"""
        url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius={radius}&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            
            stations = []
            for place in data.get('results', []):
                if any(keyword in place.get('name', '').lower() for keyword in ["şarj", "charge", "charging", "şarj istasyonu", "charging station"]):
                    station = {
                        'name': place.get('name'),
                        'lat': place.get('geometry', {}).get('location', {}).get('lat'),
                        'lng': place.get('geometry', {}).get('location', {}).get('lng')
                    }
                    stations.append(station)
            return stations
        except:
            return []

    def calculate_route(self, start_lat, start_lng, end_lat, end_lng):
        """Elektrikli araç rotası hesaplama"""
        # Önce temel rota hesaplaması
        result = super().calculate_route(start_lat, start_lng, end_lat, end_lng)
        
        # Ortalama elektrikli araç menzili (km)
        AVERAGE_RANGE = 300
        
        # Eğer mesafe menzilden küçükse, şarj istasyonu aramaya gerek yok
        if result['distance'] <= AVERAGE_RANGE:
            return result
            
        # Rota üzerinde şarj istasyonu ara
        # Başlangıç noktasından AVERAGE_RANGE/2 km mesafede ara
        mid_lat = (start_lat + end_lat) / 2
        mid_lng = (start_lng + end_lng) / 2
        
        stations = self.find_charging_stations(mid_lat, mid_lng)
        
        if not stations:
            # Daha geniş bir alanda ara
            stations = self.find_charging_stations(mid_lat, mid_lng, radius=100000)
            
        if stations:
            # En yakın şarj istasyonunu bul
            closest_station = min(stations, key=lambda s: 
                self.calculate_distance(mid_lat, mid_lng, s['lat'], s['lng']))
                
            # Şarj molası için ek süre (30 dakika)
            result['duration'] += 30
            result['charging_station'] = closest_station
            
        return result
        
    def calculate_distance(self, lat1, lng1, lat2, lng2):
        """İki nokta arasındaki mesafeyi hesaplar"""
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        
        a = (math.sin(dlat/2) * math.sin(dlat/2) +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlng/2) * math.sin(dlng/2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c 