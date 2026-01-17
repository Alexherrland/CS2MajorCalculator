from django.db import models
from django.utils.text import slugify
from django.contrib.auth.models import User

class Tournament(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    location = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    hltv_id = models.IntegerField(unique=True, null=True, blank=True)

    TOURNAMENT_TYPE_CHOICES = [
        ('MAJOR', 'Major'),
        ('PGL', 'PGL Tournament'),
        ('ESL', 'ESL Tournament'),
    ]
    tournament_type = models.CharField(
        max_length=10,
        choices=TOURNAMENT_TYPE_CHOICES,
        default='MAJOR',
        help_text="Tipo de torneo (e.g., Major, PGL, ESL)"
    )

    SWISS_RULES_CHOICES = [
        ('BUCHHOLZ', 'Buchholz System'),
        ('ESL', 'ESL System'), # Preparado para futura implementación
    ]
    swiss_rules_type = models.CharField(
        max_length=10,
        choices=SWISS_RULES_CHOICES,
        default='BUCHHOLZ',
        help_text="Sistema de reglas para emparejamientos en fases suizas"
    )

    is_live = models.BooleanField(
        default=False,
        help_text="Marca si este es el torneo activo principal que se muestra en Home."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Team(models.Model):
    REGION_CHOICES = [
        ('EU', 'Europe'),
        ('NA', 'North America'),
        ('SA', 'South America'),
        ('AS', 'Asia'),
        ('OC', 'Oceania'),
    ]

    name = models.CharField(max_length=200)
    hltv_team_id = models.IntegerField(unique=True, null=True, blank=True, help_text="ID único del equipo en HLTV.org, si está disponible.")
    region = models.CharField(max_length=2, choices=REGION_CHOICES)
    logo = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Stage(models.Model):
    STAGE_TYPES = [
        ('SWISS', 'Swiss Stage'),
        ('PLAYOFF', 'Playoff Stage'),
    ]

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='stages')
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=7, choices=STAGE_TYPES)
    order = models.IntegerField()
    
    FANTASY_STATUS_CHOICES = [
        ('OPEN', 'Open for Picks'),
        ('LOCKED', 'Picks Locked'),
        ('FINALIZED', 'Points Calculated'),
    ]
    fantasy_status = models.CharField(
        max_length=10,
        choices=FANTASY_STATUS_CHOICES,
        default='OPEN',
        help_text="Estado de la fase para las elecciones del Fantasy."
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.tournament.name} - {self.name}"

class StageTeam(models.Model):
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='stage_teams')
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    initial_seed = models.IntegerField()
    buchholz_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('stage', 'team')

    def __str__(self):
        return f"{self.team.name} in {self.stage.name}"

class Match(models.Model):
    MATCH_FORMATS = [
        ('BO1', 'Best of 1'),
        ('BO3', 'Best of 3'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('LIVE', 'En Vivo'),
        ('FINISHED', 'Finalizado'),
        ('CANCELED', 'Cancelado'),
    ]

    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='matches')
    round_number = models.IntegerField()
    team1 = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='team1_matches')
    team2 = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='team2_matches')
    team1_score = models.IntegerField(default=0)
    team2_score = models.IntegerField(default=0)
    map1_team1_score = models.IntegerField(null=True, blank=True, default=None)
    map1_team2_score = models.IntegerField(null=True, blank=True, default=None)
    map2_team1_score = models.IntegerField(null=True, blank=True, default=None)
    map2_team2_score = models.IntegerField(null=True, blank=True, default=None)
    map3_team1_score = models.IntegerField(null=True, blank=True, default=None)
    map3_team2_score = models.IntegerField(null=True, blank=True, default=None)
    winner = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches_won')
    format = models.CharField(max_length=3, choices=MATCH_FORMATS)
    is_elimination = models.BooleanField(default=False)
    is_advancement = models.BooleanField(default=False)
    hltv_match_id = models.IntegerField(null=True, blank=True, help_text="ID numérico del partido en HLTV.org")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING', help_text="Estado actual del partido")
    last_hltv_update = models.DateTimeField(null=True, blank=True, help_text="Última vez que se verificaron los datos con HLTV")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.team1.name} vs {self.team2.name} - Round {self.round_number} ({self.status})"

class HLTVUpdateSettings(models.Model):
    is_active = models.BooleanField(default=False, help_text="Activar la actualización automática de partidos desde HLTV.org")
    use_real_api = models.BooleanField(default=False, help_text="Utilizar la API real de HLTV en lugar de datos simulados. Requiere que la librería HLTV esté instalada y configurada.")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de Actualización HLTV"
        verbose_name_plural = "Configuraciones de Actualización HLTV"

    def __str__(self):
        return f"Actualización HLTV: {'Activada' if self.is_active else 'Desactivada'}"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

# --- Nuevos Modelos para Fantasy League ---

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    twitch_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    twitch_username = models.CharField(max_length=100, null=True, blank=True)
    twitch_profile_image_url = models.URLField(max_length=500, null=True, blank=True)
    total_fantasy_points = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username

class FantasyPhasePick(models.Model):
    user_profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='phase_picks')
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='fantasy_picks')
    
    # Elecciones del usuario
    teams_3_0 = models.ManyToManyField(Team, related_name='picked_as_3_0', blank=True) # Máximo 2
    teams_advance = models.ManyToManyField(Team, related_name='picked_to_advance', blank=True) # Máximo 6 (o los que queden para avanzar)
    teams_0_3 = models.ManyToManyField(Team, related_name='picked_as_0_3', blank=True) # Máximo 2

    points_earned = models.IntegerField(default=0)
    is_locked = models.BooleanField(default=False, help_text="Indica si las elecciones para esta fase están cerradas.")
    is_finalized = models.BooleanField(default=False, help_text="Indica si los puntos para esta fase ya han sido calculados.")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user_profile', 'stage') # Un usuario solo puede tener un conjunto de picks por fase
        ordering = ['stage__order', 'user_profile__user__username']

    team_points_breakdown = models.JSONField(
        default=dict, 
        blank=True, 
        help_text="Puntos otorgados por cada equipo en este pick. Ej: {'team_123': 15, 'team_456': 5}"
    )

    def __str__(self):
        return f"{self.user_profile.user.username}'s picks for {self.stage.name}"

class FantasyPlayoffPick(models.Model):
    user_profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='playoff_picks')
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='fantasy_playoff_picks') # O ForeignKey a la Stage de Playoffs

    # Elecciones del usuario para Playoffs
    quarter_final_winners = models.ManyToManyField(Team, related_name='picked_as_qf_winner', blank=True) # Máximo 4
    semi_final_winners = models.ManyToManyField(Team, related_name='picked_as_sf_winner', blank=True) # Máximo 2
    final_winner = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='picked_as_final_winner')

    points_earned = models.IntegerField(default=0)
    is_locked = models.BooleanField(default=False, help_text="Indica si las elecciones para playoffs están cerradas.")
    is_finalized = models.BooleanField(default=False, help_text="Indica si los puntos para playoffs ya han sido calculados.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user_profile', 'tournament') # Un usuario solo puede tener un conjunto de picks de playoffs por torneo
        ordering = ['tournament__name', 'user_profile__user__username']

    team_points_breakdown = models.JSONField(
        default=dict, 
        blank=True, 
        help_text="Puntos otorgados por cada equipo en este pick de playoffs. Ej: {'team_123': 20}"
    )

    def __str__(self):
        return f"{self.user_profile.user.username}'s playoff picks for {self.tournament.name}"
