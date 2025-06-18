from django.shortcuts import render, HttpResponse


# Create your views here.
def araclar_view(request):
    return HttpResponse('Aracların liste sayfası')

def arac_index(requests):
    return HttpResponse('Aracların index sayfası, listelendiği sayfa')


def arac_detail(requests):
    return HttpResponse('Aracların detay sayfası')
