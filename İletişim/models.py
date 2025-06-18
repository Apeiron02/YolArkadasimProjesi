from django.db import models

# Create your models here.
class İletişim(models.Model):

    telefon = models.CharField(max_length=14)
    mail = models.CharField(max_length=70)
    faks = models.CharField(max_length=20)
    adres = models.CharField(max_length=200)
