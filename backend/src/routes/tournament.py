from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from ..models import Tournament, Team, Stage, StageTeam, Match

@require_http_methods(["GET"])
def get_major_data(request):
    try:
        # Obtener el torneo más reciente
        tournament = Tournament.objects.latest('created_at')
        
        # Preparar la respuesta
        response_data = {
            "name": tournament.name,
            "stages": {},
            "currentStage": "phase1",
            "currentRound": 1
        }
        
        # Procesar cada etapa
        for stage in tournament.stages.all().order_by('order'):
            stage_key = f"phase{stage.order}"
            stage_data = {
                "name": stage.name,
                "teams": [],
                "rounds": [],
                "qualifiedTeams": []
            }
            
            # Procesar equipos de la etapa
            for stage_team in stage.stage_teams.all():
                team_data = {
                    "id": stage_team.team.id,
                    "name": stage_team.team.name,
                    "buchholzScore": stage_team.buchholz_score,
                    "wins": stage_team.wins,
                    "losses": stage_team.losses,
                    "seed": stage_team.initial_seed
                }
                stage_data["teams"].append(team_data)
            
            # Procesar partidos de la etapa
            for match in stage.matches.all():
                round_number = match.round_number
                
                # Asegurarse de que existe el array para esta ronda
                while len(stage_data["rounds"]) < round_number:
                    stage_data["rounds"].append({
                        "roundNumber": len(stage_data["rounds"]) + 1,
                        "matches": [],
                        "status": "pending"
                    })
                
                match_data = {
                    "team1Id": match.team1.id,
                    "team2Id": match.team2.id,
                    "winner": match.winner.id if match.winner else None,
                    "score": f"{match.team1_score}-{match.team2_score}" if match.team1_score is not None else None
                }
                
                stage_data["rounds"][round_number - 1]["matches"].append(match_data)
            
            response_data["stages"][stage_key] = stage_data
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500) 