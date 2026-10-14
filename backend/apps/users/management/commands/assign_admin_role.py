from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Assign the admin role to an existing user by email or username'

    def add_arguments(self, parser):
        parser.add_argument(
            'identifier',
            type=str,
            help='Email or username of the user to promote to admin'
        )
        parser.add_argument(
            '--remove',
            action='store_true',
            help='Remove admin role instead of assigning it'
        )

    def handle(self, *args, **options):
        identifier = options['identifier'].strip()
        remove_role = options.get('remove', False)

        # Try to find user by email first, then username
        try:
            user = User.objects.get(email=identifier.lower())
        except User.DoesNotExist:
            try:
                user = User.objects.get(username=identifier)
            except User.DoesNotExist:
                raise CommandError(f'User with email or username "{identifier}" not found.')

        if remove_role:
            if user.role == 'admin':
                user.role = 'user'
                user.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully removed admin role from user "{user.username}" ({user.email})'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'User "{user.username}" does not have admin role.')
                )
        else:
            if user.role == 'admin':
                self.stdout.write(
                    self.style.WARNING(f'User "{user.username}" already has admin role.')
                )
            else:
                user.role = 'admin'
                user.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully assigned admin role to user "{user.username}" ({user.email})'
                    )
                )

        # Display updated user info
        self.stdout.write(f'\nUser Details:')
        self.stdout.write(f'  Username: {user.username}')
        self.stdout.write(f'  Email: {user.email}')
        self.stdout.write(f'  Role: {user.get_role_display()}')
        self.stdout.write(f'  Active: {user.is_active}')
        self.stdout.write(f'  Date Joined: {user.date_joined}')
