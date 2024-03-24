from django.contrib import admin

from .models import (
    Plant,
    Tray,
    Photo,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
)

admin.site.register(Plant)
admin.site.register(Tray)
admin.site.register(Photo)
admin.site.register(WaterEvent)
admin.site.register(FertilizeEvent)
admin.site.register(PruneEvent)
admin.site.register(RepotEvent)
