from time import perf_counter

from django.core.management.base import BaseCommand

from fees.models import Student
from fees.seed import database_over60_metric, run_seed


class Command(BaseCommand):
    help = "Seed fictional demo data. --small inserts 200 fleet students plus the named examples."

    def add_arguments(self, parser):
        parser.add_argument("--small", action="store_true")

    def handle(self, *args, **options):
        start = perf_counter()
        inserted = run_seed(small=options["small"])
        metric = database_over60_metric()
        self.stdout.write(f"Seed complete: {Student.objects.count()} students, {inserted} inserted, "
                          f"over60Pct={metric.pct:.4f}%, {perf_counter() - start:.2f}s.")
