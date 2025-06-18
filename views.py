from django.views.generic import TemplateView, ListView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from .models import Route, ElectricCar

class MapView(LoginRequiredMixin, TemplateView):
    template_name = 'harita/harita.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['user_car'] = self.request.user.usercarpreference.selected_car
        return context

class UserProfileView(LoginRequiredMixin, DetailView):
    template_name = 'kullanicibilgileri/kullanici_bilgileri.html'
    model = User
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['routes'] = Route.objects.filter(user=self.request.user)
        context['electric_cars'] = ElectricCar.objects.all()
        return context 