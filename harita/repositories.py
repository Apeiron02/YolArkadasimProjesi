from .models import RouteHistory

class RouteRepository:
    @staticmethod
    def get_user_routes(user_id):
        """Kullanıcının tüm rotalarını getirir"""
        return RouteHistory.objects.filter(user_id=user_id)
    
    @staticmethod
    def save_route(user, route_data):
        """Yeni bir rota kaydeder"""
        route = RouteHistory(
            user=user,
            start_address=route_data.get('start_address', ''),
            end_address=route_data.get('end_address', ''),
            start_latitude=route_data['start_latitude'],
            start_longitude=route_data['start_longitude'],
            end_latitude=route_data['end_latitude'],
            end_longitude=route_data['end_longitude'],
            total_distance=route_data['total_distance'],
            total_duration=route_data['total_duration']
        )
        route.save()
        return route
    
    @staticmethod
    def get_recent_routes(user, limit=10):
        """Kullanıcının son rotalarını getirir"""
        return RouteHistory.objects.filter(user=user).order_by('-created_at')[:limit] 