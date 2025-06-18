from django.db import models


# Create your models here.
class hakkimizda(models.Model):
    baslik = models.CharField(max_length=120, null=True, blank=True)
    metin = models.TextField()
    tarih = models.DateTimeField()
