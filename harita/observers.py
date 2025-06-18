from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import RouteHistory

class RouteObserver:
    def update(self, route):
        pass

class UserPreferenceUpdater(RouteObserver):
    def update(self, route):
        """Kullanıcının rota tercihlerini günceller"""
        # Kullanıcı tercihlerini güncelleme mantığı
        pass

class RouteNotifier(RouteObserver):
    def update(self, route):
        """Rota değişikliklerini bildirir"""
        # Bildirim gönderme mantığı
        pass

@receiver(post_save, sender=RouteHistory)
def route_saved_handler(sender, instance, created, **kwargs):
    """Rota kaydedildiğinde observers'ları bilgilendirir"""
    observers = [UserPreferenceUpdater(), RouteNotifier()]
    for observer in observers:
        observer.update(instance) 