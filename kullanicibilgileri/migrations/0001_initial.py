# Generated by Django 5.1.2 on 2024-12-27 15:26

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ElectricCar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('car_name', models.CharField(max_length=100)),
                ('average_range', models.FloatField()),
            ],
            options={
                'db_table': 'electric_cars',
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='UserCarPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('selected_at', models.DateTimeField(auto_now=True)),
                ('selected_car', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='kullanicibilgileri.electriccar')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
