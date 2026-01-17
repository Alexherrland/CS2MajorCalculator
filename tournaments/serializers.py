from rest_framework import serializers
from .models import (
    Tournament, Team, Stage, StageTeam, Match, HLTVUpdateSettings,
    UserProfile, FantasyPhasePick, FantasyPlayoffPick
)
from django.contrib.auth.models import User
from .fantasy_logic import get_low_seed_bonus_teams_ids # Importar para bonus

# Serializer para el modelo User de Django (simplificado)
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email'] # Puedes añadir más campos si los necesitas

# Serializer para UserProfile
class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    # Corrección: Acceder a los campos de UserProfile directamente, no a través de 'profile.algo'
    # ya que este es el serializer de UserProfile en sí.
    # twitch_username = serializers.CharField(source='profile.twitch_username', read_only=True) 
    # twitch_profile_image_url = serializers.URLField(source='profile.twitch_profile_image_url', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['user', 'twitch_id', 'twitch_username', 'twitch_profile_image_url', 'total_fantasy_points']
        read_only_fields = ['twitch_id', 'twitch_username', 'twitch_profile_image_url', 'total_fantasy_points']

# Serializer para mostrar información básica del torneo en contextos de Fantasy
class TournamentInfoForFantasySerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = ['id', 'name']

# Serializer para mostrar usuarios en el Leaderboard
class LeaderboardUserSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    # twitch_username y twitch_profile_image_url ya son campos directos del modelo UserProfile,
    # por lo que no necesitan 'source' si los nombres coinciden.

    class Meta:
        model = UserProfile
        fields = [
            'username',                 # De User (via UserProfile.user)
            'twitch_username',          # De UserProfile
            'twitch_profile_image_url', # De UserProfile
            'total_fantasy_points'      # De UserProfile
        ]

# Serializer DETALLADO para un equipo dentro de un pick de Fantasy (fase o playoffs)
class FantasyTeamDetailSerializer(serializers.ModelSerializer):
    seed = serializers.SerializerMethodField()
    points_earned = serializers.SerializerMethodField()
    current_wins = serializers.SerializerMethodField()
    current_losses = serializers.SerializerMethodField()
    is_role_impossible = serializers.SerializerMethodField()
    is_bonus_active = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'logo', 'seed', 'points_earned', 'current_wins', 'current_losses', 'is_role_impossible', 'is_bonus_active']

    def get_seed(self, obj: Team) -> int | None:
        stage = self.context.get('stage')
        if stage:
            try:
                stage_team = StageTeam.objects.get(team=obj, stage=stage)
                return stage_team.initial_seed
            except StageTeam.DoesNotExist:
                return None
        if hasattr(obj, 'initial_seed_annotation'):
            return obj.initial_seed_annotation
        return None

    def get_points_earned(self, obj: Team) -> int | None:
        parent_pick = self.context.get('parent_pick_instance')
        if parent_pick and parent_pick.is_finalized and hasattr(parent_pick, 'team_points_breakdown'):
            return parent_pick.team_points_breakdown.get(str(obj.id))
        return None

    def get_current_wins(self, obj: Team) -> int | None:
        stage = self.context.get('stage')
        if stage and stage.type == 'SWISS':
            try:
                stage_team = StageTeam.objects.get(team=obj, stage=stage)
                return stage_team.wins
            except StageTeam.DoesNotExist:
                return 0
        return None # No aplica o no disponible para playoffs en este campo

    def get_current_losses(self, obj: Team) -> int | None:
        stage = self.context.get('stage')
        if stage and stage.type == 'SWISS':
            try:
                stage_team = StageTeam.objects.get(team=obj, stage=stage)
                return stage_team.losses
            except StageTeam.DoesNotExist:
                return 0
        return None # No aplica o no disponible para playoffs en este campo

    def get_is_bonus_active(self, obj: Team) -> bool:
        stage = self.context.get('stage')
        role = self.context.get('role') # 'available', '3-0', '0-3', 'advance', 'playoff_participant', 'qf_winner', etc.

        if stage and stage.type == 'SWISS':
            bonus_ids = get_low_seed_bonus_teams_ids(stage)
            is_low_seed_team = obj.id in bonus_ids

            if not is_low_seed_team:
                return False # Si no es de bajo seed, nunca tiene bonus

            # Si es un equipo de bajo seed, el bonus se activa o no según el rol:
            if role in ['3-0', 'advance']: # Roles que SÍ activan bonus
                return True
            if role == 'available': # Para la lista de equipos disponibles, mostrar que TIENE potencial de bonus
                return True 
            # Para '0-3' y cualquier otro rol en SWISS (o si el rol no está definido aquí),
            # un equipo de bajo seed NO recibe bonus activo.
            return False
        
        # Lógica para playoffs (actualmente no hay bonus definido para playoffs)
        # if stage and stage.type == 'PLAYOFF':
        #     # Ejemplo: si los campeones de QF tuvieran bonus y el equipo es de bajo seed y es qf_winner
        #     if role == 'qf_winner':
        #         # Aquí necesitaríamos una forma de saber si los qf_winners tienen bonus y si este equipo es de bajo seed para el torneo
        #         # Esto es un placeholder, la lógica real de bonus de playoff necesitaría más definición.
        #         pass 

        return False # Por defecto, no hay bonus para otros tipos de fase o si no se cumplen condiciones SWISS

    def get_is_role_impossible(self, obj: Team) -> bool:
        role = self.context.get('role')
        stage = self.context.get('stage') # Para fases suizas y playoffs
        parent_pick = self.context.get('parent_pick_instance') # Para playoffs, para saber el torneo

        if not role or not stage:
             # Si es un pick de playoff, stage podría no ser el contexto directo, sino el playoff_stage del torneo.
            if role and parent_pick and isinstance(parent_pick, FantasyPlayoffPick):
                stage = parent_pick.tournament.stages.filter(type='PLAYOFF').order_by('-order').first()
                if not stage: return False # No se puede determinar
            else:
                return False # No se puede determinar sin rol o fase

        if stage.type == 'SWISS':
            try:
                stage_team = StageTeam.objects.get(team=obj, stage=stage)
                wins, losses = stage_team.wins, stage_team.losses
                # Asumimos reglas estándar de eliminación suiza (ej. a 3 derrotas)
                # Esto podría necesitar ser más configurable si las reglas de eliminación varían
                # Por ejemplo, si una fase tiene X rondas y se necesitan Y victorias para avanzar.
                # Basado en Major de CS: 3 victorias para avanzar, 3 derrotas para eliminar.
                if role == '3-0': return losses > 0 or wins == 3 # Si ya es 3-X (y no 3-0) también es "imposible" para este rol estricto.
                if role == '0-3': return wins > 0 or losses == 3
                if role == 'advance': return losses >= 3 # Si tiene 3 derrotas, no puede avanzar.
            except StageTeam.DoesNotExist:
                return True # Si no está en StageTeam, es imposible para cualquier rol de esa fase

        elif stage.type == 'PLAYOFF':
            # Para playoffs, necesitamos ver si el equipo ha sido eliminado antes de alcanzar el rol pickeado.
            # Esta lógica puede ser compleja y depende de cómo se estructuren las rondas de playoffs.
            # Ejemplo simplificado: si el equipo no está en la lista de ganadores de la ronda anterior (si aplica).
            
            # Primero, verificar si el equipo ha sido eliminado del torneo en esta fase de playoffs.
            # Esto se podría hacer viendo si tiene un partido perdido en esta fase de playoffs.
            # O si no está en la lista de equipos que aún compiten.
            lost_match_in_playoffs = Match.objects.filter(
                stage=stage, 
                winner__isnull=False
            ).filter(Q(team1=obj) | Q(team2=obj)).exclude(winner=obj).exists()

            if lost_match_in_playoffs: return True

            if role == 'qf_winner':
                # Si el equipo está en un partido de QF (round_number=1) y no ha perdido, es posible.
                # Si ya pasó QF, y el equipo no fue ganador, es imposible.
                qf_winners_ids = set(Match.objects.filter(stage=stage, round_number=1, winner__isnull=False).values_list('winner_id', flat=True))
                if Match.objects.filter(stage=stage, round_number=1, winner__isnull=True).exists(): # Si QF no han terminado
                    pass # Aún posible si el equipo está en QF y no ha perdido
                elif obj.id not in qf_winners_ids: # Si QF terminaron y no es ganador
                    return True
            
            elif role == 'sf_winner':
                sf_winners_ids = set(Match.objects.filter(stage=stage, round_number=2, winner__isnull=False).values_list('winner_id', flat=True))
                if Match.objects.filter(stage=stage, round_number__lt=2, winner__isnull=True).exists(): # Si QF no han terminado
                     pass # Aún posible si puede llegar a SF
                elif Match.objects.filter(stage=stage, round_number=2, winner__isnull=True).exists(): # Si SF no han terminado
                    pass # Aún posible si está en SF y no ha perdido
                elif obj.id not in sf_winners_ids: # Si SF terminaron y no es ganador
                    return True
            
            elif role == 'final_winner':
                final_winner_id = Match.objects.filter(stage=stage, round_number=3, winner__isnull=False).values_list('winner_id', flat=True).first()
                if Match.objects.filter(stage=stage, round_number__lt=3, winner__isnull=True).exists(): # Si rondas previas no han terminado
                    pass
                elif Match.objects.filter(stage=stage, round_number=3, winner__isnull=True).exists(): # Si la final no ha terminado
                    pass
                elif obj.id != final_winner_id:
                    return True
        return False

# Serializer para FantasyPhasePick (MODIFICADO PARA USAR FantasyTeamDetailSerializer)
class FantasyPhasePickSerializer(serializers.ModelSerializer):
    user_profile = UserProfileSerializer(read_only=True)
    stage_id = serializers.PrimaryKeyRelatedField(queryset=Stage.objects.all(), source='stage', write_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    
    teams_3_0_details = serializers.SerializerMethodField()
    teams_advance_details = serializers.SerializerMethodField()
    teams_0_3_details = serializers.SerializerMethodField()

    teams_3_0_ids = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='teams_3_0', many=True, write_only=True)
    teams_advance_ids = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='teams_advance', many=True, write_only=True)
    teams_0_3_ids = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='teams_0_3', many=True, write_only=True)

    class Meta:
        model = FantasyPhasePick
        fields = [
            'id', 'user_profile', 'stage_id', 'stage_name', 
            'teams_3_0_ids', 'teams_advance_ids', 'teams_0_3_ids',
            'teams_3_0_details', 'teams_advance_details', 'teams_0_3_details',
            'points_earned', 'is_locked', 'is_finalized', 'updated_at', 'team_points_breakdown' # Añadir team_points_breakdown
        ]
        read_only_fields = fields # Hacer todo read_only para el perfil, la edición de picks es por otro lado

    def _get_detailed_teams(self, teams_queryset, pick_instance, role, stage_instance):
        detailed_teams = []
        for team in teams_queryset:
            serializer_context = {
                'request': self.context.get('request'),
                'parent_pick_instance': pick_instance,
                'role': role,
                'stage': stage_instance
            }
            detailed_teams.append(FantasyTeamDetailSerializer(team, context=serializer_context).data)
        return detailed_teams

    def get_teams_3_0_details(self, obj: FantasyPhasePick):
        return self._get_detailed_teams(obj.teams_3_0.all(), obj, "3-0", obj.stage)

    def get_teams_advance_details(self, obj: FantasyPhasePick):
        return self._get_detailed_teams(obj.teams_advance.all(), obj, "advance", obj.stage)

    def get_teams_0_3_details(self, obj: FantasyPhasePick):
        return self._get_detailed_teams(obj.teams_0_3.all(), obj, "0-3", obj.stage)

# Serializer para FantasyPlayoffPick (MODIFICADO PARA USAR FantasyTeamDetailSerializer)
class FantasyPlayoffPickSerializer(serializers.ModelSerializer):
    user_profile = UserProfileSerializer(read_only=True)
    tournament_id = serializers.PrimaryKeyRelatedField(queryset=Tournament.objects.all(), source='tournament', write_only=True)
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)
    
    quarter_final_winners_details = serializers.SerializerMethodField()
    semi_final_winners_details = serializers.SerializerMethodField()
    final_winner_details = serializers.SerializerMethodField()

    quarter_final_winners_ids = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='quarter_final_winners', many=True, write_only=True, required=False)
    semi_final_winners_ids = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='semi_final_winners', many=True, write_only=True, required=False)
    final_winner_id = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='final_winner', write_only=True, allow_null=True, required=False)

    class Meta:
        model = FantasyPlayoffPick
        fields = [
            'id', 'user_profile', 'tournament_id', 'tournament_name',
            'quarter_final_winners_ids', 'semi_final_winners_ids', 'final_winner_id',
            'quarter_final_winners_details', 'semi_final_winners_details', 'final_winner_details',
            'points_earned', 'is_locked', 'is_finalized', 'updated_at', 'team_points_breakdown' # Añadir team_points_breakdown
        ]
        read_only_fields = fields # Hacer todo read_only para el perfil

    def _get_detailed_teams_playoffs(self, teams_queryset, pick_instance, role, playoff_stage):
        detailed_teams = []
        for team in teams_queryset:
            serializer_context = {
                'request': self.context.get('request'),
                'parent_pick_instance': pick_instance,
                'role': role,
                'stage': playoff_stage # Pasamos la fase de playoff
            }
            detailed_teams.append(FantasyTeamDetailSerializer(team, context=serializer_context).data)
        return detailed_teams

    def get_quarter_final_winners_details(self, obj: FantasyPlayoffPick):
        playoff_stage = obj.tournament.stages.filter(type='PLAYOFF').order_by('-order').first()
        return self._get_detailed_teams_playoffs(obj.quarter_final_winners.all(), obj, "qf_winner", playoff_stage)

    def get_semi_final_winners_details(self, obj: FantasyPlayoffPick):
        playoff_stage = obj.tournament.stages.filter(type='PLAYOFF').order_by('-order').first()
        return self._get_detailed_teams_playoffs(obj.semi_final_winners.all(), obj, "sf_winner", playoff_stage)

    def get_final_winner_details(self, obj: FantasyPlayoffPick):
        playoff_stage = obj.tournament.stages.filter(type='PLAYOFF').order_by('-order').first()
        if obj.final_winner:
            serializer_context = {
                'request': self.context.get('request'),
                'parent_pick_instance': obj,
                'role': "final_winner",
                'stage': playoff_stage
            }
            return FantasyTeamDetailSerializer(obj.final_winner, context=serializer_context).data
        return None

# Serializer para la información de la FASE (SWISS) de un Torneo para Fantasy
class StageFantasyInfoSerializer(serializers.ModelSerializer): 
    # tournament = TournamentInfoForFantasySerializer(read_only=True) # No, stage ya tiene tournament
    fantasy_status = serializers.CharField(read_only=True) 
    teams = serializers.SerializerMethodField() 
    rules = serializers.SerializerMethodField()
    user_pick = serializers.SerializerMethodField()
    underdog_bonus_team_ids = serializers.SerializerMethodField()

    class Meta:
        model = Stage
        fields = ['id', 'name', 'fantasy_status', 'teams', 'rules', 'user_pick', 'underdog_bonus_team_ids']

    def get_teams(self, obj: Stage):
        # Anotar initial_seed para que FantasyTeamDetailSerializer pueda accederlo fácilmente
        stage_teams = StageTeam.objects.filter(stage=obj).select_related('team')
        teams_with_seed = []
        for st in stage_teams:
            # Pasamos el stage en el contexto por si FantasyTeamDetailSerializer lo necesita para algo más que el seed directo
            serializer = FantasyTeamDetailSerializer(st.team, context={'stage': obj, 'role': 'available'}) # 'available' como rol genérico
            teams_with_seed.append(serializer.data)
        return sorted(teams_with_seed, key=lambda x: x.get('seed') or 999) # Ordenar por seed
    
    def get_rules(self, obj: Stage):
        # Estas reglas deberían ser más dinámicas o configurables por Stage
        return {
            'num_teams_3_0': 2,
            'num_teams_advance': obj.tournament.stages.get(name='Opening Stage').stage_teams.count() -4 if obj.name == 'Opening Stage' else 8-4, # Ejemplo placeholder, necesita lógica real
            'num_teams_0_3': 2,
        }

    def get_user_pick(self, obj: Stage):
        user = self.context['request'].user
        if user.is_authenticated:
            try:
                pick = FantasyPhasePick.objects.get(user_profile=user.profile, stage=obj)
                # Usar FantasyPhasePickSerializer que ahora usa FantasyTeamDetailSerializer
                return FantasyPhasePickSerializer(pick, context=self.context).data
            except (FantasyPhasePick.DoesNotExist, UserProfile.DoesNotExist):
                return None
        return None

    def get_underdog_bonus_team_ids(self, obj: Stage):
        return get_low_seed_bonus_teams_ids(obj)

# Serializer para la información de la fase de Playoffs de un Torneo para Fantasy
class TournamentFantasyPlayoffInfoSerializer(serializers.Serializer):
    tournament_id = serializers.IntegerField(source='tournament.id')
    tournament_name = serializers.CharField(source='tournament.name')
    fantasy_status = serializers.SerializerMethodField()
    teams = serializers.SerializerMethodField()
    rules = serializers.SerializerMethodField()
    user_pick = serializers.SerializerMethodField()

    def get_fantasy_status(self, obj) -> str:
        # obj es el torneo. Necesitamos encontrar su fase de playoff.
        playoff_stage = obj.stages.filter(type='PLAYOFF').order_by('-order').first()
        if playoff_stage:
            # Cambiar para devolver el valor clave en lugar del display name
            return playoff_stage.fantasy_status 
        return "No Configurado" # Considerar un estado por defecto más apropiado o lanzar error si no hay fase de playoff

    def get_teams(self, obj: Tournament):
        # Equipos para playoffs podrían ser todos los del torneo o un subconjunto específico
        # Aquí, por simplicidad, tomamos todos los equipos del torneo. Idealmente, serían los que avanzaron a playoffs.
        # O los equipos de la fase de PLAYOFF si ya está poblada.
        playoff_stage = obj.stages.filter(type='PLAYOFF').order_by('-order').first()
        if playoff_stage:
            stage_teams = StageTeam.objects.filter(stage=playoff_stage).select_related('team')
            teams_data = []
            for st in stage_teams:
                 # Usamos FantasyTeamDetailSerializer para consistencia, aunque algunos campos no apliquen (wins/losses)
                serializer = FantasyTeamDetailSerializer(st.team, context={'stage': playoff_stage, 'role': 'playoff_participant'})
                teams_data.append(serializer.data)
            return sorted(teams_data, key=lambda x: x.get('seed') or 999)
        return FantasyTeamDetailSerializer(Team.objects.filter(stageteam__stage__tournament=obj).distinct(), many=True, context={'stage': None}).data

    def get_rules(self, obj: Tournament):
        # Ejemplo, debería ser más dinámico
        return {
            'num_quarter_final_winners': 4,
            'num_semi_final_winners': 2,
            'num_final_winner': 1,
        }

    def get_user_pick(self, obj: Tournament):
        user = self.context['request'].user
        if user.is_authenticated:
            try:
                pick = FantasyPlayoffPick.objects.get(user_profile=user.profile, tournament=obj)
                # Usar FantasyPlayoffPickSerializer que ahora usa FantasyTeamDetailSerializer
                return FantasyPlayoffPickSerializer(pick, context=self.context).data
            except (FantasyPlayoffPick.DoesNotExist, UserProfile.DoesNotExist):
                return None
        return None

# Serializer para el Perfil Público de Fantasy de un Usuario
class PublicFantasyProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    phase_picks = serializers.SerializerMethodField()
    playoff_picks = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'user',
            'twitch_id',
            'twitch_username',
            'twitch_profile_image_url',
            'total_fantasy_points',
            'phase_picks',
            'playoff_picks'
        ]
        read_only_fields = fields

    def get_phase_picks(self, obj: UserProfile):
        picks = FantasyPhasePick.objects.filter(user_profile=obj).select_related('stage').order_by('stage__order')
        return FantasyPhasePickSerializer(picks, many=True, context=self.context).data

    def get_playoff_picks(self, obj: UserProfile):
        picks = FantasyPlayoffPick.objects.filter(user_profile=obj).select_related('tournament').order_by('tournament__start_date')
        return FantasyPlayoffPickSerializer(picks, many=True, context=self.context).data
