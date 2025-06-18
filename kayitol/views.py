from django.shortcuts import render, redirect
from django.contrib import messages
from django.db import IntegrityError
from .factories import UserFactory
from .validators import EmailValidator, PasswordValidator, ValidationContext

def register_view(request):
    if request.method == 'POST':
        try:
            # Validation
            email_validator = ValidationContext(EmailValidator())
            password_validator = ValidationContext(PasswordValidator())
            
            username = request.POST.get('username')
            email = request.POST.get('email')
            password = request.POST.get('password')
            
            # Doğrulama işlemleri
            email_validator.validate(email)
            password_validator.validate(password)
            
            # Factory kullanarak kullanıcı oluşturma
            user_creator = UserFactory.get_creator()
            user = user_creator.create_user(
                username=username,
                email=email,
                password=password
            )
            
            messages.success(request, 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.')
            return redirect('/giris/')
            
        except IntegrityError:
            messages.error(request, 'Bu kullanıcı adı veya e-posta zaten kullanımda!')
        except ValueError as e:
            messages.error(request, str(e))
        except Exception as e:
            messages.error(request, 'Kayıt sırasında bir hata oluştu!')
            
    return render(request, 'kayitol/kayitol.html')

