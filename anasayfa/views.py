from django.shortcuts import render
from django.shortcuts import render

def index_view(request):
    return render(request, 'anasayfa/index.html')