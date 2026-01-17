from .models import FantasyPhasePick, Stage, StageTeam, Team, UserProfile, FantasyPlayoffPick, Tournament, Match
from django.db.models import F, Q
from django.db import transaction

# --- Constantes de Puntuación ---
# Fase de Grupos (Suiza)
POINTS_CORRECT_3_0 = 15
POINTS_CORRECT_0_3 = 10
POINTS_CORRECT_ADVANCE = 5
SEED_BONUS_MULTIPLIER = 1.5
NUM_WORST_SEEDING_TEAMS_FOR_BONUS = 8

# Playoffs
POINTS_CORRECT_QF_WINNER = 20
POINTS_CORRECT_SF_WINNER = 35
POINTS_CORRECT_FINAL_WINNER = 50
# --- Fin Constantes de Puntuación ---

def get_low_seed_bonus_teams_ids(stage: Stage) -> set[int]:
    """
    Identifica los IDs de los N equipos con el peor (más alto numéricamente) initial_seed 
    que son elegibles para el bonus de underdog.
    """
    stage_teams_for_bonus = StageTeam.objects.filter(stage=stage).order_by('-initial_seed')[:NUM_WORST_SEEDING_TEAMS_FOR_BONUS]
    return set(st.team_id for st in stage_teams_for_bonus)

def calculate_phase_pick_points(fantasy_pick_id: int) -> bool:
    try:
        fantasy_pick = FantasyPhasePick.objects.select_related('user_profile', 'stage')\
                                             .prefetch_related('teams_3_0', 'teams_advance', 'teams_0_3')\
                                             .get(pk=fantasy_pick_id)
    except FantasyPhasePick.DoesNotExist:
        print(f"Error: FantasyPhasePick con ID {fantasy_pick_id} no encontrado.")
        return False

    if fantasy_pick.is_finalized:
        print(f"Info: Los puntos para FantasyPhasePick ID {fantasy_pick.id} ya han sido calculados.")
        return True

    stage = fantasy_pick.stage
    user_profile = fantasy_pick.user_profile

    total_points_for_phase = 0

    # Obtener los resultados reales de la fase
    actual_teams_3_0_ids = set(StageTeam.objects.filter(stage=stage, wins=3, losses=0).values_list('team_id', flat=True))
    actual_teams_0_3_ids = set(StageTeam.objects.filter(stage=stage, wins=0, losses=3).values_list('team_id', flat=True))
       
    teams_with_3_wins_ids = set(StageTeam.objects.filter(stage=stage, wins=3).values_list('team_id', flat=True))
    
    actual_teams_advance_ids = teams_with_3_wins_ids - actual_teams_3_0_ids

    low_seed_bonus_ids = get_low_seed_bonus_teams_ids(stage)
    
    current_pick_team_points_breakdown = {} # Nuevo diccionario para el desglose

    # --- Calcular puntos para equipos 3-0 ---
    user_picked_3_0_ids = set(fantasy_pick.teams_3_0.values_list('id', flat=True))
    correct_3_0_picks = user_picked_3_0_ids.intersection(actual_teams_3_0_ids)
    for team_id in correct_3_0_picks:
        points = POINTS_CORRECT_3_0
        if team_id in low_seed_bonus_ids:
            points *= SEED_BONUS_MULTIPLIER
        total_points_for_phase += points
        current_pick_team_points_breakdown[str(team_id)] = round(current_pick_team_points_breakdown.get(str(team_id), 0) + points) # Acumular por si un equipo está en múltiples categorías (no debería pasar con buena lógica de pick)

    # --- Calcular puntos para equipos 0-3 ---
    user_picked_0_3_ids = set(fantasy_pick.teams_0_3.values_list('id', flat=True))
    correct_0_3_picks = user_picked_0_3_ids.intersection(actual_teams_0_3_ids)
    for team_id in correct_0_3_picks: # Iterar para guardar en breakdown
        points = POINTS_CORRECT_0_3
        total_points_for_phase += points
        current_pick_team_points_breakdown[str(team_id)] = round(current_pick_team_points_breakdown.get(str(team_id), 0) + points)

    # --- Calcular puntos para equipos que avanzan (que no fueron 3-0) ---
    user_picked_advance_ids = set(fantasy_pick.teams_advance.values_list('id', flat=True))
    correct_advance_picks = user_picked_advance_ids.intersection(actual_teams_advance_ids)
    for team_id in correct_advance_picks:
        points = POINTS_CORRECT_ADVANCE
        if team_id in low_seed_bonus_ids:
            points *= SEED_BONUS_MULTIPLIER
        total_points_for_phase += points
        current_pick_team_points_breakdown[str(team_id)] = round(current_pick_team_points_breakdown.get(str(team_id), 0) + points)
    
    total_points_for_phase = round(total_points_for_phase)

    fantasy_pick.points_earned = total_points_for_phase
    fantasy_pick.team_points_breakdown = current_pick_team_points_breakdown # Guardar el desglose
    fantasy_pick.is_finalized = True
    fantasy_pick.save()

    # Actualizar el total de puntos del usuario
    UserProfile.objects.filter(pk=user_profile.pk).update(total_fantasy_points=F('total_fantasy_points') + total_points_for_phase)
    
    print(f"Puntos calculados para FantasyPick ID {fantasy_pick.id} ({user_profile.user.username} - {stage.name}): {total_points_for_phase}")
    return True

def finalize_fantasy_stage_picks(stage_id: int) -> dict:
    """
    Finaliza todos los picks de una fase específica, calcula sus puntos,
    y marca la fase como con puntos calculados para el fantasy.
    """
    try:
        stage = Stage.objects.get(pk=stage_id)
    except Stage.DoesNotExist:
        print(f"Error: Fase con ID {stage_id} no encontrada para finalizar picks.")
        return {'success': False, 'message': f'Fase ID {stage_id} no encontrada.'}

    if stage.type == 'PLAYOFF': # Esta función es para fases suizas/de grupos
        print(f"Error: La fase {stage.name} es de tipo PLAYOFF. Usar finalize_fantasy_playoff_picks.")
        return {'success': False, 'message': f'La fase {stage.name} es de tipo PLAYOFF.'}


    # Verificar si ya se finalizaron los picks para esta fase (a nivel de Stage.fantasy_status)
    if stage.fantasy_status == 'FINALIZED':
        print(f"Info: Los picks para la fase {stage.name} ya fueron finalizados anteriormente.")
        pending_picks = FantasyPhasePick.objects.filter(stage=stage, is_finalized=False)
        if not pending_picks.exists():
            return {'success': True, 'message': f'No hay picks pendientes de finalizar para la fase {stage.name} (ya estaba FINALIZED).'}
    else:
        pending_picks = FantasyPhasePick.objects.filter(stage=stage, is_finalized=False)

    if not pending_picks.exists():
        # Si no hay picks pendientes y la fase no estaba FINALIZED, la marcamos ahora.
        if stage.fantasy_status != 'FINALIZED':
            stage.fantasy_status = 'FINALIZED'
            stage.save()
        print(f"No hay picks de fantasy pendientes de finalizar para la fase {stage.name}.")
        return {'success': True, 'message': f'No hay picks pendientes para la fase {stage.name}.'}

    print(f"Finalizando {pending_picks.count()} picks de fantasy para la fase {stage.name}...")
    successful_calculations = 0
    failed_calculations = 0

    with transaction.atomic(): # Para asegurar que o todos los picks se procesan o ninguno
        for pick in pending_picks:
            # Restar puntos previamente asignados si se está recalculando (si pick.points_earned > 0 y se fuerza recálculo)
            if pick.points_earned != 0: # Si ya tenía puntos, es un recálculo.
                 UserProfile.objects.filter(pk=pick.user_profile_id).update(total_fantasy_points=F('total_fantasy_points') - pick.points_earned)
                 pick.points_earned = 0 # Resetear antes de recalcular

            if calculate_phase_pick_points(pick.id):
                successful_calculations += 1
            else:
                failed_calculations += 1
                # Si un cálculo falla, la transacción se revertirá, así que los UserProfile.total_fantasy_points
    
    if failed_calculations > 0:
        message = f"Proceso de finalización para {stage.name} falló para {failed_calculations} picks. {successful_calculations} éxitos. La transacción fue revertida."
        print(message)
        return {'success': False, 'message': message, 'successful': successful_calculations, 'failed': failed_calculations}
    else:
        # Marcar la fase como finalizada en términos de fantasy si todos los cálculos fueron exitosos
        stage.fantasy_status = 'FINALIZED'
        stage.save()
        message = f"Proceso de finalización de picks para {stage.name} completado. Éxitos: {successful_calculations}."
        print(message)
        return {'success': True, 'message': message, 'successful': successful_calculations, 'failed': 0}


def calculate_playoff_pick_points(fantasy_playoff_pick_id: int):
    try:
        playoff_pick = FantasyPlayoffPick.objects.select_related(
            'user_profile', 'tournament', 'final_winner'
        ).prefetch_related(
            'quarter_final_winners', 'semi_final_winners'
        ).get(pk=fantasy_playoff_pick_id)
    except FantasyPlayoffPick.DoesNotExist:
        print(f"Error: FantasyPlayoffPick con ID {fantasy_playoff_pick_id} no encontrado.")
        return False

    if playoff_pick.is_finalized:
        print(f"Info: Los puntos para FantasyPlayoffPick ID {playoff_pick.id} ya han sido calculados.")
        return True # No recalcular si ya está finalizado y no se fuerza

    tournament = playoff_pick.tournament
    user_profile = playoff_pick.user_profile

    playoff_stage = Stage.objects.filter(tournament=tournament, type='PLAYOFF').order_by('-order').first()
    if not playoff_stage:
        print(f"Error: No se encontró una fase de PLAYOFF para el torneo {tournament.name}. No se pueden calcular puntos.")
        return False

    total_points_for_playoffs = 0
    
    actual_qf_winners_ids = set()
    actual_sf_winners_ids = set()
    actual_final_winner_id = None

    current_playoff_team_points_breakdown = {} # Nuevo diccionario para el desglose

    qf_matches = Match.objects.filter(stage=playoff_stage, round_number=1, winner__isnull=False)
    for match in qf_matches: actual_qf_winners_ids.add(match.winner_id)
    
    sf_matches = Match.objects.filter(stage=playoff_stage, round_number=2, winner__isnull=False)
    for match in sf_matches: actual_sf_winners_ids.add(match.winner_id)

    final_match = Match.objects.filter(stage=playoff_stage, round_number=3, winner__isnull=False).first()
    if final_match: actual_final_winner_id = final_match.winner_id

    # Elecciones del usuario
    user_picked_qf_ids = set(playoff_pick.quarter_final_winners.values_list('id', flat=True))
    user_picked_sf_ids = set(playoff_pick.semi_final_winners.values_list('id', flat=True))
    user_picked_final_id = playoff_pick.final_winner_id

    # Calcular puntos para QF
    correct_qf_picks = user_picked_qf_ids.intersection(actual_qf_winners_ids)
    for team_id in correct_qf_picks:
        points = POINTS_CORRECT_QF_WINNER
        total_points_for_playoffs += points
        current_playoff_team_points_breakdown[str(team_id)] = round(current_playoff_team_points_breakdown.get(str(team_id), 0) + points)

    # Calcular puntos para SF
    correct_sf_picks = user_picked_sf_ids.intersection(actual_sf_winners_ids)
    for team_id in correct_sf_picks:
        points = POINTS_CORRECT_SF_WINNER
        total_points_for_playoffs += points
        current_playoff_team_points_breakdown[str(team_id)] = round(current_playoff_team_points_breakdown.get(str(team_id), 0) + points)

    # Calcular puntos para la Final
    if user_picked_final_id and user_picked_final_id == actual_final_winner_id:
        points = POINTS_CORRECT_FINAL_WINNER
        total_points_for_playoffs += points
        current_playoff_team_points_breakdown[str(user_picked_final_id)] = round(current_playoff_team_points_breakdown.get(str(user_picked_final_id), 0) + points)
    
    total_points_for_playoffs = round(total_points_for_playoffs)

    playoff_pick.points_earned = total_points_for_playoffs
    playoff_pick.team_points_breakdown = current_playoff_team_points_breakdown # Guardar el desglose
    playoff_pick.is_finalized = True
    playoff_pick.save()

    UserProfile.objects.filter(pk=user_profile.pk).update(total_fantasy_points=F('total_fantasy_points') + total_points_for_playoffs)

    print(f"Puntos de Playoffs calculados para Pick ID {playoff_pick.id} ({user_profile.user.username} - {tournament.name}): {total_points_for_playoffs}")
    return True

def finalize_fantasy_playoff_picks(tournament_id: int):
    """
    Calcula los puntos para todas las elecciones de FantasyPlayoffPick asociadas a un Torneo.
    """
    try:
        tournament = Tournament.objects.get(pk=tournament_id)
    except Tournament.DoesNotExist:
        print(f"Error: Torneo con ID {tournament_id} no encontrado para finalizar picks de playoffs.")
        return {'success': False, 'message': f'Torneo ID {tournament_id} no encontrado.'}

    playoff_stage = tournament.stages.filter(type='PLAYOFF').order_by('-order').first()
    if not playoff_stage:
        message = f"No se encontró una fase de PLAYOFF para el torneo {tournament.name}."
        print(f"Error: {message}")
        return {'success': False, 'message': message}
        
    if playoff_stage.fantasy_status != 'FINALIZED':
        message = f'La fase de Playoffs ({playoff_stage.name}) para {tournament.name} no está marcada como FINALIZED. No se calcularán puntos de Fantasy Playoffs.'
        print(f"Info: {message}")
        return {'success': False, 'message': message}

    pending_playoff_picks = FantasyPlayoffPick.objects.filter(tournament=tournament, is_finalized=False)

    if not pending_playoff_picks.exists():
        print(f"No hay picks de playoffs pendientes de finalizar para el torneo {tournament.name}.")
        return {'success': True, 'message': f'No hay picks de playoffs pendientes para {tournament.name}.'}

    print(f"Finalizando {pending_playoff_picks.count()} picks de playoffs para el torneo {tournament.name}...")
    successful_calculations = 0
    failed_calculations = 0

    with transaction.atomic():
        for pick in pending_playoff_picks:
            if pick.points_earned != 0:
                 UserProfile.objects.filter(pk=pick.user_profile_id).update(total_fantasy_points=F('total_fantasy_points') - pick.points_earned)
                 pick.points_earned = 0 
                 # pick.is_finalized la maneja la función de cálculo

            if calculate_playoff_pick_points(pick.id): # Aquí se podría pasar force_recalculate=True
                successful_calculations += 1
            else:
                failed_calculations += 1
            
    if failed_calculations > 0:
        message = f"Proceso de finalización de picks de playoffs para {tournament.name} falló para {failed_calculations} picks. {successful_calculations} éxitos. La transacción fue revertida."
        print(message)
        return {'success': False, 'message': message, 'successful': successful_calculations, 'failed': failed_calculations}
    else:
        message = f"Proceso de finalización de picks de playoffs para {tournament.name} completado. Éxitos: {successful_calculations}."
        print(message)
        return {'success': True, 'message': message, 'successful': successful_calculations, 'failed': failed_calculations} 