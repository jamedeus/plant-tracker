from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Create superuser from command line (email address optional)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            help="Username for the superuser",
            required=True
        )
        parser.add_argument(
            '--password',
            help="Password for the superuser",
            required=True
        )
        parser.add_argument(
            '--email',
            help="Email address for the superuser (optional)",
            required=False
        )

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        email = options.get('email', '')

        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username, email, password)
            self.stdout.write(f'Superuser {username} created successfully.')
        else:
            self.stdout.write(f'Superuser {username} already exists.')
