from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from harita.models import RouteHistory
from .models import ElectricCar, UserCarPreference
from sarjucret.models import SarjGecmisi

@login_required
def kullanici_bilgileri(request):
    if request.method == 'POST':
        car_id = request.POST.get('selected_car')
        if car_id:
            car = ElectricCar.objects.get(id=car_id)
            UserCarPreference.objects.update_or_create(
                user=request.user,
                defaults={'selected_car': car}
            )
        return redirect('kullanicibilgileri:kullanici_bilgileri')

    user_routes = RouteHistory.objects.filter(user=request.user).order_by('-created_at')
    electric_cars = ElectricCar.objects.all().order_by('car_name')
    user_car_preference = UserCarPreference.objects.filter(user=request.user).first()
    
    # Şarj geçmişini al
    charging_history = SarjGecmisi.objects.filter(user=request.user).order_by('-tarih')
    
    print("Aktif kullanıcı id:", request.user.id)
    
    return render(request, 'kullanicibilgileri/kullanici_bilgileri.html', {
        'user': request.user,
        'routes': user_routes,
        'electric_cars': electric_cars,
        'user_car_preference': user_car_preference,
        'charging_history': charging_history
    })