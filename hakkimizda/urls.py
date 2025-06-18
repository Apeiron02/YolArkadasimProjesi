from django.urls import path
from . import views

app_name = 'hakkimizda'

urlpatterns = [
    path('', views.hakkimizda_view, name='hakkimizda'),
] 