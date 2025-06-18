from rest_framework import serializers
from django.contrib.auth.models import User
from kullanicibilgileri.models import ElectricCar, UserCarPreference
from harita.models import RouteHistory
from sarjucret.models import ZESFiyat, TrugoFiyat, VoltrunFiyat, EsarjFiyat, SarjGecmisi

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']

class UserDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']

class RegisterUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password2 = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name']
        
    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password": "Şifreler eşleşmiyor"})
        return data
    
    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user

class ElectricCarSerializer(serializers.ModelSerializer):
    class Meta:
        model = ElectricCar
        fields = ['id', 'car_name', 'average_range', 'kwh']

class UserCarPreferenceSerializer(serializers.ModelSerializer):
    selected_car = ElectricCarSerializer(read_only=True)
    selected_car_id = serializers.PrimaryKeyRelatedField(
        queryset=ElectricCar.objects.all(),
        source='selected_car',
        write_only=True
    )
    
    class Meta:
        model = UserCarPreference
        fields = ['id', 'user', 'selected_car', 'selected_car_id', 'selected_at']
        read_only_fields = ['id', 'user', 'selected_at']
    
    def validate(self, attrs):
        # selected_car alanının doğruluğunu kontrol et
        if 'selected_car' not in attrs:
            raise serializers.ValidationError({"selected_car_id": "Araç tercihi zorunludur"})
        return attrs
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class RouteHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteHistory
        fields = [
            'id', 'user', 'start_address', 'end_address', 
            'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
            'total_distance', 'total_duration', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

# Şarj istasyonları için serializer
class ChargingStationSerializer(serializers.Serializer):
    place_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    vicinity = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    rating = serializers.FloatField(required=False, allow_null=True)
    distance = serializers.IntegerField(required=False)

# Kullanıcı konumu için serializer
class UserLocationSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    success = serializers.BooleanField(default=True)
    message = serializers.CharField(required=False, allow_null=True)

# Şarj İstasyonu Fiyatları İçin Serializer'lar
class ZESFiyatSerializer(serializers.ModelSerializer):
    class Meta:
        model = ZESFiyat
        fields = ['id', 'sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi']

class TrugoFiyatSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrugoFiyat
        fields = ['id', 'sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi']

class VoltrunFiyatSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoltrunFiyat
        fields = ['id', 'membership_type', 'sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi']

class EsarjFiyatSerializer(serializers.ModelSerializer):
    class Meta:
        model = EsarjFiyat
        fields = ['id', 'sarj_tipi', 'fiyat_metni', 'fiyat_degeri', 'eklenme_tarihi']

# Birleşik şarj istasyonu fiyat verisi için serializer
class SarjIstasyonlariFiyatSerializer(serializers.Serializer):
    zes = ZESFiyatSerializer(many=True, read_only=True)
    trugo = TrugoFiyatSerializer(many=True, read_only=True)
    voltrun = VoltrunFiyatSerializer(many=True, read_only=True)
    esarj = EsarjFiyatSerializer(many=True, read_only=True)
    son_guncelleme = serializers.DateTimeField(read_only=True)
    
# Rota oluşturma için istek serializer
class RouteRequestSerializer(serializers.Serializer):
    origin_lat = serializers.FloatField(required=False)
    origin_lng = serializers.FloatField(required=False)
    destination_lat = serializers.FloatField(required=False)
    destination_lng = serializers.FloatField(required=False)
    mode = serializers.CharField(default='driving')
    
    def validate_mode(self, value):
        valid_modes = ['driving', 'walking', 'bicycling', 'transit']
        if value not in valid_modes:
            raise serializers.ValidationError(f"Mode değeri {valid_modes} içinden biri olmalıdır.")
        return value
    
    def validate(self, data):
        # En azından koordinat bilgisi olmalı
        has_coords = all(key in data for key in ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'])
        if not has_coords:
            raise serializers.ValidationError("Koordinat bilgileri (origin_lat, origin_lng, destination_lat, destination_lng) gereklidir.")
        return data

# Adres bilgisi ile rota oluşturma için serializer
class RouteAddressRequestSerializer(serializers.Serializer):
    origin_address = serializers.CharField(max_length=255)
    destination_address = serializers.CharField(max_length=255)
    mode = serializers.CharField(default='driving')
    
    def validate_mode(self, value):
        valid_modes = ['driving', 'walking', 'bicycling', 'transit']
        if value not in valid_modes:
            raise serializers.ValidationError(f"Mode değeri {valid_modes} içinden biri olmalıdır.")
        return value

# Rota waypoint için serializer
class WaypointSerializer(serializers.Serializer):
    location_lat = serializers.FloatField()
    location_lng = serializers.FloatField()
    stopover = serializers.BooleanField(default=True)

# Waypoint'li rota oluşturma için serializer
class RouteWithWaypointsRequestSerializer(RouteRequestSerializer):
    waypoints = WaypointSerializer(many=True, required=False)
    optimize_waypoints = serializers.BooleanField(default=False)
    
    def validate(self, data):
        # En azından koordinat bilgisi olmalı, ancak adres bilgisi gelecekse validate_data
        # bu noktada koordinatları içermiyor olabilir, bu durumu create_route_with_waypoints
        # metodunda özel olarak ele alıyoruz
        has_coords = all(key in data for key in ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'])
        if not has_coords:
            # Burada hata vermiyoruz, çünkü adres bilgisi ile çalışıyor olabiliriz
            pass
        return data 

class SarjGecmisiSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = SarjGecmisi
        fields = [
            'id', 'user', 'arac', 'arac_kwh', 'firma', 'baslangic_sarj',
            'varis_sarj', 'doldurulan_enerji', 'toplam_ucret', 'tarih'
        ]
        read_only_fields = ['id', 'user', 'tarih'] 