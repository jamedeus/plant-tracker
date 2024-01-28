from django.urls import path

from . import views

app_name = "api"

urlpatterns = [
    path('register', views.register_plant, name='register_plant'),
    path('manage/<str:uuid>', views.manage_plant, name='manage_plant'),
    path('water/<str:uuid>', views.water_plant, name='water_plant'),
    path('water/<str:uuid>/<str:timestamp>', views.water_plant, name='water_plant'),
    path('fertilize/<str:uuid>', views.fertilize_plant, name='fertilize_plant'),
    path('fertilize/<str:uuid>/<str:timestamp>', views.fertilize_plant, name='fertilize_plant'),
]
