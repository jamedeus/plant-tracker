"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve

urlpatterns = [
    path('', include('plant_tracker.urls')),
    path("admin/", admin.site.urls),
]

# Serve user-uploaded photos from local media root if enabled
if settings.LOCAL_MEDIA_ROOT:
    urlpatterns += [
        re_path(
            f'^{settings.MEDIA_URL.lstrip("/")}(?P<path>.*)$',
            serve,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]

# Add debug tools in debug mode
if settings.DEBUG:
    # Add django-debug-toolbar if env var set
    if settings.DEBUG_TOOL.lower() in ("toolbar", "debug_toolbar"):
        from debug_toolbar.toolbar import debug_toolbar_urls
        urlpatterns = [
            *urlpatterns,
        ] + debug_toolbar_urls()
    # Otherwise add django-silk
    else:
        urlpatterns += [path('silk/', include('silk.urls', namespace='silk'))]
