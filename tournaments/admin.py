from django.contrib import admin
from .models import (
    Tournament, Team, Stage, StageTeam, Match, HLTVUpdateSettings,
    UserProfile, FantasyPhasePick, FantasyPlayoffPick
)
from .fantasy_logic import finalize_fantasy_stage_picks, finalize_fantasy_playoff_picks # Importar ambas

@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'location', 'is_live')
    search_fields = ('name', 'location')
    prepopulated_fields = {'slug': ('name',)}
    list_filter = ('is_live', 'tournament_type')

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'region', 'hltv_team_id')
    list_filter = ('region',)
    search_fields = ('name', 'hltv_team_id')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        (None, {
            'fields': ('name', 'hltv_team_id', 'region', 'logo')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'stage', 'round_number', 'status', 'winner', 'hltv_match_id')
    list_filter = ('stage', 'status', 'round_number', 'format')
    search_fields = ('team1__name', 'team2__name', 'hltv_match_id')
    readonly_fields = ('created_at', 'updated_at', 'last_hltv_update')
    actions = ['mark_as_pending', 'mark_as_live', 'mark_as_finished', 'update_from_hltv_action']
    fieldsets = (
        (None, {
            'fields': ('stage', 'round_number', ('team1', 'team2'), 'winner')
        }),
        ('Detalles del Partido', {
            'fields': ('format', 'status', ('team1_score', 'team2_score'),
                       ('map1_team1_score', 'map1_team2_score'),
                       ('map2_team1_score', 'map2_team2_score'),
                       ('map3_team1_score', 'map3_team2_score'),
                       'is_elimination', 'is_advancement', 'hltv_match_id'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'last_hltv_update'),
            'classes': ('collapse',),
        }),
    )

    def mark_as_pending(self, request, queryset):
        updated_count = queryset.update(status='PENDING')
        self.message_user(request, f"{updated_count} partidos marcados como Pendientes.")
    mark_as_pending.short_description = "Marcar seleccionados como: Pendiente"

    def mark_as_live(self, request, queryset):
        updated_count = queryset.update(status='LIVE')
        self.message_user(request, f"{updated_count} partidos marcados como En Vivo.")
    mark_as_live.short_description = "Marcar seleccionados como: En Vivo"

    def mark_as_finished(self, request, queryset):
        for obj in queryset:
            if not obj.winner and obj.status != 'CANCELED': # Un partido finalizado (no cancelado) debería tener un ganador
                 self.message_user(request, f"Error: El partido {obj} no tiene un ganador asignado y no puede marcarse como FINALIZADO. Asigne un ganador o cancélelo.", level='error')
                 return
        updated_count = queryset.update(status='FINISHED')
        self.message_user(request, f"{updated_count} partidos marcados como Finalizados.")
    mark_as_finished.short_description = "Marcar seleccionados como: Finalizado"

    def update_from_hltv_action(self, request, queryset):
        from .hltv_service import update_single_match_from_hltv
        
        updated_matches_count = 0
        attempted_matches_count = 0
        
        for match_obj in queryset:
            attempted_matches_count += 1
            if match_obj.hltv_match_id:
                if match_obj.status == 'FINISHED':
                    self.message_user(request, f"Partido {match_obj} ya está FINALIZADO. Omitido.", level='info')
                    continue
                try:
                    if update_single_match_from_hltv(match_obj.id): # Pasar match_obj.id
                        updated_matches_count += 1
                except Exception as e:
                    self.message_user(request, f"Error actualizando {match_obj} desde HLTV: {e}", level='error')
            else:
                self.message_user(request, f"Partido {match_obj} no tiene HLTV Match ID. Omitido.", level='warning')
        
        if updated_matches_count > 0:
            self.message_user(request, f"{updated_matches_count} de {attempted_matches_count} partidos seleccionados fueron procesados/actualizados desde HLTV.")
        elif attempted_matches_count > 0:
            self.message_user(request, f"Ninguno de los {attempted_matches_count} partidos seleccionados pudo ser actualizado desde HLTV (verifique logs o si ya estaban finalizados).", level='warning')
        else:
            self.message_user(request, "No se seleccionaron partidos para actualizar.", level='info')
            
    update_from_hltv_action.short_description = "Actualizar seleccionados desde HLTV (individual)"

@admin.register(HLTVUpdateSettings)
class HLTVUpdateSettingsAdmin(admin.ModelAdmin):
    list_display = ('id', 'is_active', 'use_real_api', 'updated_at')
    readonly_fields = ('updated_at',)
    search_fields = ('team__name',)

    def has_add_permission(self, request):
        # Prevenir la creación de múltiples instancias desde el admin
        return not HLTVUpdateSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Prevenir la eliminación de la instancia única
        return False

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'twitch_username', 'total_fantasy_points', 'updated_at')
    search_fields = ('user__username', 'twitch_username')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(FantasyPhasePick)
class FantasyPhasePickAdmin(admin.ModelAdmin):
    list_display = ('user_profile', 'stage', 'points_earned', 'is_locked', 'is_finalized', 'updated_at')
    list_filter = ('stage', 'is_locked', 'is_finalized', 'user_profile__user__username')
    search_fields = ('user_profile__user__username', 'stage__name')
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('teams_3_0', 'teams_advance', 'teams_0_3')

@admin.register(FantasyPlayoffPick)
class FantasyPlayoffPickAdmin(admin.ModelAdmin):
    list_display = ('user_profile', 'tournament', 'points_earned', 'is_locked', 'is_finalized', 'updated_at')
    list_filter = ('tournament', 'is_locked', 'is_finalized', 'user_profile__user__username')
    search_fields = ('user_profile__user__username', 'tournament__name')
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('quarter_final_winners', 'semi_final_winners')

@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    list_display = ('name', 'tournament', 'type', 'order', 'fantasy_status')
    list_filter = ('tournament', 'type', 'fantasy_status')
    search_fields = ('name',)
    actions = ['set_fantasy_status_open','set_fantasy_status_locked', 'finalize_all_fantasy_picks_for_stage']

    def set_fantasy_status_open(self, request, queryset):
        updated_count = queryset.update(fantasy_status='OPEN')
        for stage_obj in queryset:
            FantasyPhasePick.objects.filter(stage=stage_obj, is_finalized=False).update(is_locked=False)
        self.message_user(request, f"{updated_count} fase(s) marcada(s) como 'Open for Picks' y elecciones desbloqueadas.")
    set_fantasy_status_open.short_description = "Fantasy: Marcar como ABIERTA para elecciones" 

    def set_fantasy_status_locked(self, request, queryset):
        updated_count = 0
        for stage_obj in queryset.filter(fantasy_status='OPEN'):
            stage_obj.fantasy_status = 'LOCKED'
            stage_obj.save()
            FantasyPhasePick.objects.filter(stage=stage_obj, is_finalized=False).update(is_locked=True)
            updated_count += 1
        if updated_count > 0:
            self.message_user(request, f"{updated_count} fase(s) marcada(s) como 'Picks Locked' y elecciones bloqueadas.")
        else:
            self.message_user(request, "No se bloquearon fases (podrían no estar en estado 'OPEN').", level='warning')
    set_fantasy_status_locked.short_description = "Fantasy: Marcar como BLOQUEADA para elecciones"

    def finalize_all_fantasy_picks_for_stage(self, request, queryset):
        processed_stages_phase = 0
        processed_tournaments_playoff = 0

        for stage_obj in queryset.filter(fantasy_status='LOCKED'):
            FantasyPhasePick.objects.filter(stage=stage_obj, is_finalized=False, is_locked=False).update(is_locked=True)
            
            if stage_obj.type == 'SWISS':
                result_phase = finalize_fantasy_stage_picks(stage_obj.id)
                if result_phase.get('success'):
                    stage_obj.fantasy_status = 'FINALIZED'
                    stage_obj.save()
                    self.message_user(request, f"Puntos Fantasy de FASE para '{stage_obj.name}' procesados y fase marcada como FINALIZED: {result_phase.get('message')}")
                    processed_stages_phase += 1
                else:
                    self.message_user(request, f"Error procesando puntos Fantasy de FASE para '{stage_obj.name}': {result_phase.get('message')}", level='error')
            elif stage_obj.type == 'PLAYOFF':
                stage_obj.fantasy_status = 'FINALIZED'
                stage_obj.save()
                self.message_user(request, f"Fase de PLAYOFF '{stage_obj.name}' marcada como FINALIZED.")
                
                result_playoff = finalize_fantasy_playoff_picks(stage_obj.tournament.id)
                if result_playoff.get('success'):
                    self.message_user(request, f"Puntos Fantasy de PLAYOFFS para el torneo '{stage_obj.tournament.name}' procesados: {result_playoff.get('message')}")
                    processed_tournaments_playoff +=1
                else:
                    self.message_user(request, f"Error procesando puntos Fantasy de PLAYOFFS para '{stage_obj.tournament.name}': {result_playoff.get('message')}", level='error')
            else:
                stage_obj.fantasy_status = 'FINALIZED'
                stage_obj.save()
                self.message_user(request, f"Fase '{stage_obj.name}' (tipo: {stage_obj.type}) marcada como FINALIZED (sin picks de fase/playoff asociados directamente a esta acción).", level='info')

        if processed_stages_phase == 0 and processed_tournaments_playoff == 0 and queryset.exists():
             self.message_user(request, "No se procesaron puntos para ninguna fase/playoff (verifique que estén en estado 'LOCKED' y errores previos).", level='warning')
        elif not queryset.exists():
            self.message_user(request, "No se seleccionaron fases para procesar.", level='info')
            
    finalize_all_fantasy_picks_for_stage.short_description = "Fantasy: FINALIZAR Fase y Calcular Puntos (Fase/Playoffs)"

@admin.register(StageTeam)
class StageTeamAdmin(admin.ModelAdmin):
    list_display = ('team', 'stage', 'wins', 'losses', 'initial_seed', 'buchholz_score')
    list_filter = ('stage',)
    search_fields = ('team__name',)
    readonly_fields = ('created_at', 'updated_at')
