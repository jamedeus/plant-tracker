from django.contrib import admin

from .models import (
    Plant,
    Group,
    Photo,
    WaterEvent,
    FertilizeEvent,
    PruneEvent,
    RepotEvent,
    NoteEvent,
)

admin.site.register(Plant)
admin.site.register(Group)
admin.site.register(Photo)
admin.site.register(WaterEvent)
admin.site.register(FertilizeEvent)
admin.site.register(PruneEvent)
admin.site.register(RepotEvent)
admin.site.register(NoteEvent)
