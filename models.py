from django.db import models
from django.contrib.auth.models import User

class ElectricCar(models.Model):
    car_name = models.CharField(max_length=100)
    average_range = models.IntegerField()
    battery_capacity = models.IntegerField()
    charging_time = models.FloatField()
    
    def __str__(self):
        return self.car_name

class UserCarPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    selected_car = models.ForeignKey(ElectricCar, on_delete=models.SET_NULL, null=True)
    
    def __str__(self):
        return f"{self.user.username}'s car preference"

class Route(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    start_address = models.CharField(max_length=255)
    end_address = models.CharField(max_length=255)
    total_distance = models.FloatField()
    total_duration = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Route from {self.start_address} to {self.end_address}" 