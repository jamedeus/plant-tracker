'''Map API endpoints to backend functions'''

from django.urls import path

from . import views, auth_views

app_name = "api"

# pylint: disable=line-too-long
urlpatterns = [
    path('', views.overview, name='overview'),
    path("accounts/login/", auth_views.LoginView.as_view(), name="login"),
    path("accounts/logout/", auth_views.logout_view, name="logout"),
    path("accounts/profile/", auth_views.user_profile_page, name="user_profile_page"),
    path("accounts/create_user/", auth_views.create_user, name="create_user"),
    path("accounts/edit_user_details/", auth_views.edit_user_details, name="edit_user_details"),
    path("accounts/change_password/", auth_views.PasswordChangeView.as_view(), name="change_password"),
    path('archived', views.archived_overview, name='archived'),
    path('get_overview_state', views.get_overview_page_state, name='get_overview_state'),
    path('get_qr_codes', views.get_qr_codes, name='get_qr_codes'),
    path('register_plant', views.register_plant, name='register_plant'),
    path('register_group', views.register_group, name='register_group'),
    path('manage/<str:uuid>', views.manage, name='manage'),
    path('get_group_state/<str:uuid>', views.get_group_state, name='get_group_state'),
    path('get_plant_state/<str:uuid>', views.get_plant_state, name='get_plant_state'),
    path('get_plant_options', views.get_plant_options, name='get_plant_options'),
    path('get_plant_species_options', views.get_plant_species_options, name='get_plant_species_options'),
    path('get_add_to_group_options', views.get_add_to_group_options, name='get_add_to_group_options'),
    path('edit_plant_details', views.edit_plant_details, name='edit_plant_details'),
    path('edit_group_details', views.edit_group_details, name='edit_group_details'),
    path('change_qr_code', views.change_qr_code, name='change_qr_code'),
    path('change_uuid', views.change_uuid, name='change_uuid'),
    path('bulk_delete_plants_and_groups', views.bulk_delete_plants_and_groups, name='bulk_delete_plants_and_groups'),
    path('bulk_archive_plants_and_groups', views.bulk_archive_plants_and_groups, name='bulk_archive_plants_and_groups'),
    path('add_plant_event', views.add_plant_event, name='add_plant_event'),
    path('bulk_add_plant_events', views.bulk_add_plant_events, name='bulk_add_plant_events'),
    path('bulk_delete_plant_events', views.bulk_delete_plant_events, name='bulk_delete_plant_events'),
    path('add_plant_note', views.add_plant_note, name='add_plant_note'),
    path('edit_plant_note', views.edit_plant_note, name='edit_plant_note'),
    path('delete_plant_notes', views.delete_plant_notes, name='delete_plant_notes'),
    path('add_plant_to_group', views.add_plant_to_group, name='add_plant_to_group'),
    path('remove_plant_from_group', views.remove_plant_from_group, name='remove_plant_from_group'),
    path('bulk_add_plants_to_group', views.bulk_add_plants_to_group, name='bulk_add_plants_to_group'),
    path('bulk_remove_plants_from_group', views.bulk_remove_plants_from_group, name='bulk_remove_plants_from_group'),
    path('repot_plant', views.repot_plant, name='repot_plant'),
    path('divide_plant', views.divide_plant, name='divide_plant'),
    path('add_plant_photos', views.add_plant_photos, name='add_plant_photos'),
    path('delete_plant_photos', views.delete_plant_photos, name='delete_plant_photos'),
    path('set_plant_default_photo', views.set_plant_default_photo, name='set_plant_default_photo')
]
