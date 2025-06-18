# harita/models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError



class RouteHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='routes')
    start_address = models.CharField(max_length=255, default='')
    end_address = models.CharField(max_length=255, default='')
    start_latitude = models.FloatField()
    start_longitude = models.FloatField()
    end_latitude = models.FloatField()
    end_longitude = models.FloatField()
    total_distance = models.FloatField(help_text="Mesafe (km cinsinden)")
    total_duration = models.FloatField(help_text="Süre (dakika cinsinden)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Rota Geçmişi"
        verbose_name_plural = "Rota Geçmişleri"
        
    def clean(self):
        if not all(-90 <= lat <= 90 for lat in [self.start_latitude, self.end_latitude]):
            raise ValidationError('Geçersiz enlem değeri')
        if not all(-180 <= lng <= 180 for lng in [self.start_longitude, self.end_longitude]):
            raise ValidationError('Geçersiz boylam değeri')
    
    def __str__(self):
        return f"Rota {self.created_at.strftime('%Y-%m-%d %H:%M')}"