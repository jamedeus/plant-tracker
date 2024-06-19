'''Map API endpoints to backend functions'''

from django.urls import path

from . import views

app_name = "api"

# pylint: disable=line-too-long
urlpatterns = [
    path('', views.overview, name='overview'),
    path('get_overview_state', views.update_overview_state, name='get_overview_state'),
    path('get_qr_codes', views.get_qr_codes, name='get_qr_codes'),
    path('register_plant', views.register_plant, name='register_plant'),
    path('register_group', views.register_group, name='register_group'),
    path('manage/<str:uuid>', views.manage, name='manage'),
    path('get_group_state/<str:uuid>', views.get_group_state, name='get_group_state'),
    path('edit_plant', views.edit_plant_details, name='edit_plant_details'),
    path('edit_group', views.edit_group_details, name='edit_group_details'),
    path('change_qr_code', views.change_qr_code, name='change_qr_code'),
    path('change_uuid', views.change_uuid, name='change_uuid'),
    path('delete_plant', views.delete_plant, name='delete_plant'),
    path('delete_group', views.delete_group, name='delete_group'),
    path('add_plant_event', views.add_plant_event, name='add_plant_event'),
    path('bulk_add_plant_events', views.bulk_add_plant_events, name='bulk_add_plant_events'),
    path('delete_plant_event', views.delete_plant_event, name='delete_plant_event'),
    path('bulk_delete_plant_events', views.bulk_delete_plant_events, name='bulk_delete_plant_events'),
    path('add_plant_note', views.add_plant_note, name='add_plant_note'),
    path('edit_plant_note', views.edit_plant_note, name='edit_plant_note'),
    path('delete_plant_note', views.delete_plant_note, name='delete_plant_note'),
    path('add_plant_to_group', views.add_plant_to_group, name='add_plant_to_group'),
    path('remove_plant_from_group', views.remove_plant_from_group, name='remove_plant_from_group'),
    path('bulk_add_plants_to_group', views.bulk_add_plants_to_group, name='bulk_add_plants_to_group'),
    path('bulk_remove_plants_from_group', views.bulk_remove_plants_from_group, name='bulk_remove_plants_from_group'),
    path('repot_plant', views.repot_plant, name='repot_plant'),
    path('add_plant_photos', views.add_plant_photos, name='add_plant_photos'),
    path('delete_plant_photos', views.delete_plant_photos, name='delete_plant_photos'),
    path('set_plant_default_photo', views.set_plant_default_photo, name='set_plant_default_photo')
]
