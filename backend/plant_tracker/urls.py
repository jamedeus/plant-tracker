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
    path('change_plant_uuid', views.change_plant_uuid, name='change_plant_uuid'),
    path('change_tray_uuid', views.change_tray_uuid, name='change_tray_uuid'),
    path('delete_plant', views.delete_plant, name='delete_plant'),
    path('delete_tray', views.delete_tray, name='delete_tray'),
    path('add_plant_event', views.add_plant_event, name='add_plant_event'),
    path('bulk_add_plant_events', views.bulk_add_plant_events, name='bulk_add_plant_events'),
    path('delete_plant_event', views.delete_plant_event, name='delete_plant_event'),
    path('add_plant_to_tray', views.add_plant_to_tray, name='add_plant_to_tray'),
    path('remove_plant_from_tray', views.remove_plant_from_tray, name='remove_plant_from_tray'),
    path('bulk_add_plants_to_tray', views.bulk_add_plants_to_tray, name='bulk_add_plants_to_tray'),
    path('bulk_remove_plants_from_tray', views.bulk_remove_plants_from_tray, name='bulk_remove_plants_from_tray'),
    path('repot_plant', views.repot_plant, name='repot_plant')
]
