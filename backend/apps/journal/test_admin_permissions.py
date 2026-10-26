
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.journal.models import JournalEntry
from django.utils import timezone


User = get_user_model()


class JournalAdminPermissionTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="journal_regular_user",
            email="regular@example.com",
            password="TestPass123!"
        )

        self.admin = User.objects.create_user(
            username="journal_admin",
            email="admin@example.com",
            password="TestPass123!"
        )
        self.admin.role = "admin"
        self.admin.save(update_fields=["role"])

        self.entry = JournalEntry.objects.create(
    user=self.user,
    title="Private journal",
    content="Private journal content",
    date=timezone.localdate(),
    draft=True
)

        self.list_url = reverse("admin-journal-list")
        self.stats_url = reverse("admin-journal-stats")
        self.detail_url = reverse(
            "admin-journal-detail",
            kwargs={"pk": self.entry.pk}
        )

    def authenticate(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token}"
        )

    def test_anonymous_user_cannot_access_admin_endpoints(self):
        for url in [self.list_url, self.stats_url, self.detail_url]:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED
            )

    def test_regular_user_cannot_access_admin_endpoints(self):
        self.authenticate(self.user)

        for url in [self.list_url, self.stats_url, self.detail_url]:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN
            )

    def test_regular_user_cannot_delete_journal(self):
        self.authenticate(self.user)

        response = self.client.delete(self.detail_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN
        )
        self.assertTrue(
            JournalEntry.objects.filter(pk=self.entry.pk).exists()
        )

    def test_admin_can_access_admin_endpoints(self):
        self.authenticate(self.admin)

        for url in [self.list_url, self.stats_url, self.detail_url]:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK
            )

    def test_admin_can_delete_journal(self):
        self.authenticate(self.admin)

        response = self.client.delete(self.detail_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT
        )
        self.assertFalse(
            JournalEntry.objects.filter(pk=self.entry.pk).exists()
        )
