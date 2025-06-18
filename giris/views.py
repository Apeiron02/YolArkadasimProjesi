from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required

def giris_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        # Django'nun authenticate fonksiyonu ile kullanıcıyı doğrula
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # Kullanıcı doğrulandıysa oturum aç
            login(request, user)
            return redirect('harita:harita_view')  # Harita sayfasına yönlendir
        else:
            messages.error(request, "Geçersiz kullanıcı adı veya şifre.")

    return render(request, 'giris/giris.html')

@login_required(login_url='/giris/')
def anasayfa(request):
    return render(request, 'giris/index.html')
