from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("fees", "0002_instalment_balances")]

    operations = [
        migrations.RemoveConstraint(model_name="payment", name="payment_method_valid"),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=models.Q(method__in=["gateway", "cash", "cheque", "bank", "upi", "card", "netbanking"]),
                name="payment_method_valid",
            ),
        ),
        migrations.AlterField(
            model_name="payment",
            name="method",
            field=models.CharField(
                choices=[("gateway", "gateway"), ("cash", "cash"), ("cheque", "cheque"), ("bank", "bank"),
                         ("upi", "upi"), ("card", "card"), ("netbanking", "netbanking")],
                max_length=16,
            ),
        ),
    ]
