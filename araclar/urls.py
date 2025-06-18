from django.urls import path
from .views import arac_index, arac_detail

urlpatterns = [
    path('/index/', arac_detail, name='index'),
    path('/detail/', arac_index, name='detail'),

]
