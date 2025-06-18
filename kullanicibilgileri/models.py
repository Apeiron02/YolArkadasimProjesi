from django.db import models
from django.contrib.auth.models import User

class ElectricCar(models.Model):
    car_name = models.CharField(max_length=100)
    average_range = models.FloatField()
    kwh = models.FloatField(null=True, blank=True)  # Aracın batarya kapasitesi (kWh)

    class Meta:
        db_table = 'electric_cars'
        managed = False

    def __str__(self):
        return self.car_name

class UserCarPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    selected_car = models.ForeignKey(ElectricCar, on_delete=models.SET_NULL, null=True)
    selected_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'in araç tercihi: {self.selected_car}"
