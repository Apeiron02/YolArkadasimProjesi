from django.contrib import admin
from .models import RouteHistory

@admin.register(RouteHistory)
class RouteHistoryAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'total_distance', 'total_duration', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('start_latitude', 'start_longitude', 'end_latitude', 'end_longitude')
    readonly_fields = ('created_at',)