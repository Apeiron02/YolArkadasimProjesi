from django.db import models


# Create your models here.
class araclar(models.Model):
    arac_adi = models.CharField(max_length=100)
    ortalama_menzil = models.IntegerField()
    max_menzil = models.IntegerField()
    min_menzil = models.IntegerField()
