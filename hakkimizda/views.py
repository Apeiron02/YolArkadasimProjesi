from django.shortcuts import render

def hakkimizda_view(request):
    return render(request, 'hakkimizda/hakkimizda.html')