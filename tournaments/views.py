from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F, Q
from django.http import JsonResponse, HttpRequest
from django.views.decorators.http import require_http_methods
from .models import Tournament, Team, Stage, StageTeam, Match
import json

@require_http_methods(["GET"])
def get_major_data(request):
    tournament_slug = request.GET.get('slug')
    if tournament_slug:
        try:
            tournament = Tournament.objects.get(slug=tournament_slug)
        except Tournament.DoesNotExist:
            return JsonResponse({"error": "Tournament not found"}, status=404)
    else:
        tournament = Tournament.objects.filter(is_live=True).order_by('-created_at').first()
        if not tournament:
            return JsonResponse({"error": "No live tournament found"}, status=404)

    response_data = {
        "name": tournament.name,
        "tournamentType": tournament.tournament_type,
        "swissRulesType": tournament.swiss_rules_type,
        "isLive": tournament.is_live,
        "stages": {},
        # currentStage y currentRound se determinarán dinámicamente más abajo
    }

    stages_ordered = tournament.stages.all().order_by('order')
    for stage_order_idx, stage in enumerate(stages_ordered):
        stage_key = f"phase{stage.order}"
        
        stage_teams_queryset = StageTeam.objects.filter(stage=stage).select_related('team').order_by('initial_seed')
        teams_data_for_stage = []
        for st in stage_teams_queryset:
            teams_data_for_stage.append({
                "id": st.team.id,
                "name": st.team.name,
                "logo": st.team.logo,
                "seed": st.initial_seed,
                "region": st.team.region,
                "wins": st.wins,
                "losses": st.losses,
                "buchholzScore": st.buchholz_score,
            })

        stage_data = {
            "id": stage.id,
            "name": stage.name,
            "type": stage.type,
            "fantasyStatus": stage.fantasy_status,
            "teams": teams_data_for_stage,
            "rounds": [],
            "order": stage.order
        }

        # Procesar partidos de la etapa usando la lógica proporcionada por el usuario
        matches_in_stage = Match.objects.filter(stage=stage).select_related('team1', 'team2', 'winner').order_by('round_number', 'id')
        
        for match in matches_in_stage:
            round_number = match.round_number
            
            # Asegurarse de que existe el array para esta ronda
            while len(stage_data["rounds"]) < round_number:
                stage_data["rounds"].append({
                    "roundNumber": len(stage_data["rounds"]) + 1,
                    "matches": [],
                    "status": "pending" # Default status
                })
            
            # Construir match_data como lo especificó el usuario
            match_data = {
                "id": match.id, # Añadido el ID del partido, que es útil
                "team1Id": match.team1.id if match.team1 else 0, # Usar ID directamente
                "team2Id": match.team2.id if match.team2 else 0, # Usar ID directamente
                "winner": match.winner.id if match.winner else None,
                "team1Score": match.team1_score if match.team1_score is not None else 0,
                "team2Score": match.team2_score if match.team2_score is not None else 0,
                "format": match.format,
                "status": match.status,
                "map1_team1_score": match.map1_team1_score if match.map1_team1_score is not None else None,
                "map1_team2_score": match.map1_team2_score if match.map1_team2_score is not None else None,
                "map2_team1_score": match.map2_team1_score if match.map2_team1_score is not None else None,
                "map2_team2_score": match.map2_team2_score if match.map2_team2_score is not None else None,
                "map3_team1_score": match.map3_team1_score if match.map3_team1_score is not None else None,
                "map3_team2_score": match.map3_team2_score if match.map3_team2_score is not None else None,
                "hltvMatchId": match.hltv_match_id if match.hltv_match_id is not None else None,
                # Para mantener compatibilidad con la simulación que espera objetos team completos,
                # podríamos añadir aquí los datos completos de team1 y team2 si es necesario,
                # pero el tipo Match en hltvTypes.ts solo pide team1Id y team2Id.
                # Por ahora, seguimos la estructura del usuario y hltvTypes.ts.
                # Si la simulación falla, esto podría necesitar ajuste para incluir objetos team completos.
            }
            stage_data["rounds"][round_number - 1]["matches"].append(match_data)

        # Determinar el estado de la ronda (lógica del usuario adaptada)
        for rd_idx, round_detail in enumerate(stage_data["rounds"]):
            all_matches_in_round_finished = True
            any_match_live = False
            has_populated_matches = False

            if not round_detail["matches"]:
                all_matches_in_round_finished = False
            else:
                has_populated_matches = True
                for m_data in round_detail["matches"]:
                    if m_data['status'] != 'FINISHED':
                        all_matches_in_round_finished = False
                    if m_data['status'] == 'LIVE':
                        any_match_live = True
            
            if all_matches_in_round_finished and has_populated_matches:
                stage_data["rounds"][rd_idx]["status"] = 'completed'
            elif any_match_live:
                stage_data["rounds"][rd_idx]["status"] = 'active'
            else:
                # Si es la primera ronda con partidos y no está live/completed, debería ser active
                if rd_idx == 0 and has_populated_matches and not any_match_live and not all_matches_in_round_finished:
                     stage_data["rounds"][rd_idx]["status"] = 'active'
                # Si una ronda anterior no está completada, las siguientes deben ser pending
                elif rd_idx > 0 and stage_data["rounds"][rd_idx-1]["status"] != 'completed':
                     stage_data["rounds"][rd_idx]["status"] = 'pending'
                # Si tiene partidos y no cumple otra condición, por defecto active (si no es la primera)
                elif has_populated_matches and rd_idx > 0 :
                     stage_data["rounds"][rd_idx]["status"] = 'active'
                # Si no tiene partidos o es la primera ronda sin partidos, se mantiene 'pending' (default)
                else:
                     stage_data["rounds"][rd_idx]["status"] = 'pending'


        response_data["stages"][stage_key] = stage_data

    # Determinar currentStage y currentRound global para el torneo
    determined_current_stage_key = None
    determined_current_round_number = 1

    # Iterar sobre las fases en su orden numérico (phase1, phase2, ...)
    # Usamos stage_order_idx de la enumeración de stages_ordered
    sorted_stage_keys = [f"phase{s.order}" for s in stages_ordered]

    for stage_key_iter in sorted_stage_keys:
        if stage_key_iter not in response_data["stages"]: continue # Saltar si la fase no tiene datos (improbable aquí)
        
        stage_info_iter = response_data["stages"][stage_key_iter]
        is_stage_fully_completed = True # Asumir que sí hasta encontrar una ronda no completada
        
        found_active_round_in_this_stage = False
        for round_detail_iter in stage_info_iter["rounds"]:
            if round_detail_iter["status"] == 'active':
                determined_current_stage_key = stage_key_iter
                determined_current_round_number = round_detail_iter["roundNumber"]
                found_active_round_in_this_stage = True
                break
            if round_detail_iter["status"] != 'completed':
                is_stage_fully_completed = False
        
        if found_active_round_in_this_stage:
            break # Ya encontramos la fase y ronda activa global

        # Si no hay ronda activa pero la fase no está completa, esta es la fase actual
        if not is_stage_fully_completed and not determined_current_stage_key:
            determined_current_stage_key = stage_key_iter
            # Tomar la primera ronda de esta fase como la actual (o la primera no completada)
            first_round_in_stage_found = False
            for rd_detail_iter_for_num in stage_info_iter["rounds"]:
                if rd_detail_iter_for_num["status"] != 'completed':
                     determined_current_round_number = rd_detail_iter_for_num["roundNumber"]
                     first_round_in_stage_found = True
                     break
            if not first_round_in_stage_found and stage_info_iter["rounds"]: # Todos completados, tomar el último
                determined_current_round_number = stage_info_iter["rounds"][-1]["roundNumber"]
            elif not stage_info_iter["rounds"]: # Sin rondas, default a 1
                determined_current_round_number = 1


    if not determined_current_stage_key and sorted_stage_keys: # Si no se encontró activa, y hay fases
        determined_current_stage_key = sorted_stage_keys[0] # Tomar la primera fase
        if response_data["stages"][determined_current_stage_key]["rounds"]:
            determined_current_round_number = response_data["stages"][determined_current_stage_key]["rounds"][0]["roundNumber"]
        else: # Sin rondas en la primera fase
            determined_current_round_number = 1
    elif not sorted_stage_keys: # No hay fases en absoluto
        determined_current_stage_key = "phase1" # Fallback
        determined_current_round_number = 1


    response_data["currentStage"] = determined_current_stage_key
    response_data["currentRound"] = determined_current_round_number
    
    return JsonResponse(response_data)

@require_http_methods(["GET"])
def list_tournaments(request):
    try:
        tournaments = Tournament.objects.all().order_by('-start_date')
        response_data = []
        for t in tournaments:
            response_data.append({
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "startDate": t.start_date,
                "endDate": t.end_date,
                "location": t.location,
                "tournamentType": t.tournament_type,
                "swissRulesType": t.swiss_rules_type,
                "isLive": t.is_live
            })
        return JsonResponse(response_data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
def update_match_result(request):
    try:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        tournament_slug = data.get('tournamentSlug') # Puede ser null si es el torneo 'live'
        # El frontend envía currentStageId como "phase1", necesitamos el Stage.id o Stage.order
        stage_identifier_frontend = data.get('currentStageIdFromPage') # ej: "phase1", o el ID numérico de Stage
        round_index_frontend = data.get('roundIndex') # 0-indexed
        match_index_frontend = data.get('matchIndex') # 0-indexed en la lista de partidos de esa ronda en el frontend
        winner_team_id = data.get('winnerId') # ID del equipo ganador

        if winner_team_id is None or round_index_frontend is None or match_index_frontend is None or stage_identifier_frontend is None:
            return JsonResponse({"error": "Missing required fields"}, status=400)

        if tournament_slug:
            tournament = Tournament.objects.get(slug=tournament_slug)
        else:
            tournament = Tournament.objects.filter(is_live=True).order_by('-created_at').first()
        
        if not tournament:
            return JsonResponse({"error": "Tournament not found"}, status=404)

        try:
            # Intentar obtener la fase por ID si es numérico, o por orden si es "phaseX"
            if isinstance(stage_identifier_frontend, int) or stage_identifier_frontend.isdigit():
                stage = Stage.objects.get(tournament=tournament, id=int(stage_identifier_frontend))
            elif isinstance(stage_identifier_frontend, str) and stage_identifier_frontend.startswith('phase'):
                stage_order = int(stage_identifier_frontend.replace('phase', ''))
                stage = Stage.objects.get(tournament=tournament, order=stage_order)
            else:
                raise Stage.DoesNotExist
        except (ValueError, Stage.DoesNotExist):
            return JsonResponse({"error": f"Stage '{stage_identifier_frontend}' not found for tournament '{tournament.name}'"}, status=404)

        round_number_backend = round_index_frontend + 1
        
        # Replicar cómo el frontend ordena/lista los partidos para obtener el correcto por índice
        # Asumimos que get_major_data los devuelve ordenados por 'id' o un ordenamiento consistente.
        # Si hay un campo 'match_order_in_round' en el modelo Match, usarlo sería más robusto.
        matches_in_round_for_stage = Match.objects.filter(stage=stage, round_number=round_number_backend).order_by('id') 
        
        if match_index_frontend >= len(matches_in_round_for_stage):
            return JsonResponse({"error": f"Match index {match_index_frontend} out of bounds"}, status=404)
            
        match_to_update = matches_in_round_for_stage[match_index_frontend]
        
        # Verificar que el partido no esté ya finalizado con un ganador diferente (o el mismo)
        # if match_to_update.status == 'FINISHED' and match_to_update.winner_id != winner_team_id:
            # return JsonResponse({"error": "Match already finished with a different winner."}, status=409) # Conflict
        
        winner_team = Team.objects.get(id=winner_team_id)
        match_to_update.winner = winner_team
        match_to_update.status = 'FINISHED'
        
        # Actualizar scores (esto es opcional, el frontend podría no enviarlos)
        # Si el frontend envía scores, usarlos:
        # team1_score = data.get('team1Score') 
        # team2_score = data.get('team2Score')
        # if team1_score is not None: match_to_update.team1_score = team1_score
        # if team2_score is not None: match_to_update.team2_score = team2_score
        match_to_update.save()
        
        # Recalcular W/L para todos los StageTeam de esta fase
        all_stage_teams_in_stage = StageTeam.objects.filter(stage=stage)
        stage_teams_map = {st.team_id: st for st in all_stage_teams_in_stage}

        for st_team_obj in stage_teams_map.values(): # Resetear antes de recalcular
            st_team_obj.wins = 0
            st_team_obj.losses = 0

        for m_in_stage in Match.objects.filter(stage=stage, status='FINISHED'):
            if m_in_stage.winner_id:
                if m_in_stage.winner_id in stage_teams_map:
                    stage_teams_map[m_in_stage.winner_id].wins += 1
                
                loser_id = None
                if m_in_stage.team1_id == m_in_stage.winner_id:
                    loser_id = m_in_stage.team2_id
                elif m_in_stage.team2_id == m_in_stage.winner_id:
                    loser_id = m_in_stage.team1_id
                
                if loser_id and loser_id in stage_teams_map:
                    stage_teams_map[loser_id].losses += 1
        
        for st_team_obj_to_save in stage_teams_map.values():
            st_team_obj_to_save.save()

        # Opcional: recalcular Buchholz si es necesario y la lógica está disponible
        # from .utils import recalculate_buchholz_scores
        # if stage.type == 'SWISS':
        # recalculate_buchholz_scores(stage)

        # Devolver una respuesta. Es mejor que el frontend vuelva a llamar a get_major_data.
        # Devolver solo un OK o el partido actualizado.
        # Por ahora, para simplificar y evitar el problema del request POST a GET, devolvemos OK.
        return JsonResponse({"message": "Match updated successfully", "match_id": match_to_update.id})
        
    except Tournament.DoesNotExist:
        return JsonResponse({"error": "Tournament not found"}, status=404)
    except Stage.DoesNotExist:
        return JsonResponse({"error": "Stage not found"}, status=404)
    except Team.DoesNotExist:
        return JsonResponse({"error": "Winner team not found"}, status=404)
    except Exception as e:
        # import traceback
        # print(traceback.format_exc()) # Para depuración en desarrollo
        return JsonResponse({"error": str(e)}, status=500)
