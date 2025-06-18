from .repositories import RouteRepository
from django.core.exceptions import ValidationError

class RouteService:
    def __init__(self):
        self.repository = RouteRepository()
    
    def create_route(self, user, route_data):
        """Yeni bir rota oluşturur ve kaydeder"""
        try:
            # Koordinat doğrulaması
            if not (-90 <= route_data['start_latitude'] <= 90 and 
                   -90 <= route_data['end_latitude'] <= 90):
                raise ValidationError('Geçersiz enlem değeri')
                
            if not (-180 <= route_data['start_longitude'] <= 180 and 
                   -180 <= route_data['end_longitude'] <= 180):
                raise ValidationError('Geçersiz boylam değeri')
            
            return self.repository.save_route(user, route_data)
            
        except KeyError as e:
            raise ValidationError(f'Eksik veri: {str(e)}')
    
    def get_user_route_history(self, user, limit=None):
        """Kullanıcının rota geçmişini getirir"""
        if limit:
            return self.repository.get_recent_routes(user, limit)
        return self.repository.get_user_routes(user.id) 