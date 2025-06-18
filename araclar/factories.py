from .models import ElectricCar, UserCarPreference

class CarFactory:
    @staticmethod
    def create_car(car_type, **car_data):
        """Araç tipine göre yeni bir araç nesnesi oluşturur"""
        if car_type == "electric":
            return ElectricCar.objects.create(**car_data)
        # Gelecekte diğer araç tipleri eklenebilir
        raise ValueError(f"Desteklenmeyen araç tipi: {car_type}")
    
    @staticmethod
    def create_user_preference(user, **preference_data):
        """Kullanıcı araç tercihlerini oluşturur"""
        return UserCarPreference.objects.create(
            user=user,
            **preference_data
        ) 