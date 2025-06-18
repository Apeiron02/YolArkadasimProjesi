# yolarkadasim/celery.py

from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# Django ayarlarını varsayılan Celery ayarları olarak ayarla
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'yolarkadasim.settings')

app = Celery('yolarkadasim')

# Celery ayarlarını Django settings'den yükle (CELERY ile başlayan ayarlar)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Django uygulamalarındaki task'ları otomatik olarak keşfet
app.autodiscover_tasks()
