from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("fees", "0001_initial")]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE VIEW instalment_balances AS
                SELECT i.id, i.created_at, i.plan_id, i.seq, i.due_date,
                       i.amount_paise, p.student_id, s.batch_id, b.centre_id,
                       COALESCE(SUM(a.amount_paise), 0)::bigint AS paid_paise,
                       (i.amount_paise - COALESCE(SUM(a.amount_paise), 0))::bigint AS balance_paise
                FROM instalments i
                JOIN fee_plans p ON p.id = i.plan_id
                JOIN students s ON s.id = p.student_id
                JOIN batches b ON b.id = s.batch_id
                LEFT JOIN allocations a ON a.instalment_id = i.id
                GROUP BY i.id, p.student_id, s.batch_id, b.centre_id
            """,
            reverse_sql="DROP VIEW instalment_balances",
        )
    ]
