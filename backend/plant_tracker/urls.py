from django.urls import path

from . import views

app_name = "api"

urlpatterns = [
    path('', views.overview, name='overview'),
    path('get_qr_codes', views.get_qr_codes, name='get_qr_codes'),
    path('register', views.register, name='register'),
    path('manage/<str:uuid>', views.manage, name='manage'),
    path('edit_plant', views.edit_plant_details, name='edit_plant_details'),
    path('edit_tray', views.edit_tray_details, name='edit_tray_details'),
    path('delete_plant', views.delete_plant, name='delete_plant'),
    path('delete_tray', views.delete_tray, name='delete_tray'),
    path('water_plant', views.water_plant, name='water_plant'),
    path('fertilize_plant', views.fertilize_plant, name='fertilize_plant'),
    path('water_tray', views.water_tray, name='water_tray'),
    path('fertilize_tray', views.fertilize_tray, name='fertilize_tray'),
    path('add_plant_to_tray', views.add_plant_to_tray, name='add_plant_to_tray'),
    path('remove_plant_from_tray', views.remove_plant_from_tray, name='remove_plant_from_tray'),
    path('bulk_add_plants_to_tray', views.bulk_add_plants_to_tray, name='bulk_add_plants_to_tray')
]
