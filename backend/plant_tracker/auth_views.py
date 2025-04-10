import json
from django.contrib.auth import views
from django.http import JsonResponse


class LoginView(views.LoginView):
    '''LoginView subclass that returns JSON responses instead of redirects.'''

    def form_valid(self, form):
        '''Returns JSON success message instead of redirect.'''
        super().form_valid(form)
        return JsonResponse({"success": "logged in"})

    def form_invalid(self, form):
        '''Returns errors as JSON instead of redirect with error context.'''
        return JsonResponse({"errors": form.errors}, status=400)
