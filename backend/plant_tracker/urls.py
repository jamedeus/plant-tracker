from django.urls import path

from . import views

app_name = "api"

urlpatterns = [
    path('', views.overview, name='overview'),
    path('get_qr_codes', views.get_qr_codes, name='get_qr_codes'),
    path('register', views.register_plant, name='register_plant'),
    path('manage/<str:uuid>', views.manage_plant, name='manage_plant'),
    path('edit_plant', views.edit_plant_details, name='edit_plant_details'),
    path('water/<str:uuid>', views.water_plant, name='water_plant'),
    path('water/<str:uuid>/<str:timestamp>', views.water_plant, name='water_plant'),
    path('fertilize/<str:uuid>', views.fertilize_plant, name='fertilize_plant'),
    path('fertilize/<str:uuid>/<str:timestamp>', views.fertilize_plant, name='fertilize_plant'),
]
