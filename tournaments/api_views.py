from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import F # Para LeaderboardUserSerializer si es necesario ordenar por campos de User
from django.contrib.auth.models import User # Para buscar por username

from .models import UserProfile, Stage, FantasyPhasePick, Team, StageTeam, Tournament, FantasyPlayoffPick
from .serializers import (
    FantasyPhasePickSerializer, FantasyPlayoffPickSerializer,
    LeaderboardUserSerializer, PublicFantasyProfileSerializer, UserProfileSerializer,
    TournamentFantasyPlayoffInfoSerializer, StageFantasyInfoSerializer
)

class ManageFantasyPhasePicksView(APIView):
    permission_classes = [IsAuthenticated]

    def get_stage_and_profile(self, request, stage_id):
        user_profile = get_object_or_404(UserProfile, user=request.user)
        stage = get_object_or_404(Stage, pk=stage_id)
        return user_profile, stage

    def get(self, request, stage_id, format=None):
        try:
            user_profile, stage = self.get_stage_and_profile(request, stage_id)
            # GET siempre debe devolver las elecciones si existen, o una estructura para crear nuevas.
            # El frontend decidirá si son editables basándose en stage.fantasy_status o pick.is_locked
            picks, created = FantasyPhasePick.objects.get_or_create(
                user_profile=user_profile,
                stage=stage,
                defaults={'is_locked': stage.fantasy_status == 'LOCKED'} # Poner is_locked según el estado de la fase al crear
            )
            # Si la fase está bloqueada y las elecciones se acaban de crear, también deberían estarlo.
            # Si las elecciones ya existían, su estado de is_locked se mantiene a menos que el admin lo cambie.
            if stage.fantasy_status == 'LOCKED' and not picks.is_locked:
                 picks.is_locked = True
                 picks.save()
            elif stage.fantasy_status == 'OPEN' and picks.is_locked:
                 # Si la fase se reabrió, desbloquear el pick individual si no está finalizado
                 if not picks.is_finalized:
                     picks.is_locked = False
                     picks.save()
            
            serializer = FantasyPhasePickSerializer(picks, context={'request': request, 'stage': stage})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (UserProfile.DoesNotExist, Stage.DoesNotExist):
            return Response({"error": "Perfil de usuario o fase no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, stage_id, format=None):
        try:
            user_profile, stage = self.get_stage_and_profile(request, stage_id)

            # Comprobar el estado de la fase actual
            if stage.fantasy_status == 'LOCKED':
                return Response({"error": "Las elecciones para esta fase están cerradas (LOCKED) y no pueden modificarse."}, status=status.HTTP_403_FORBIDDEN)
            if stage.fantasy_status == 'FINALIZED':
                return Response({"error": "Esta fase ya ha sido finalizada y los puntos calculados. No se pueden modificar las elecciones."}, status=status.HTTP_403_FORBIDDEN)
            
            # Comprobar el estado de la fase anterior (si existe)
            if stage.order > 1:
                try:
                    previous_stage = Stage.objects.get(tournament=stage.tournament, order=stage.order - 1)
                    if previous_stage.fantasy_status != 'FINALIZED':
                        return Response({
                            "error": f"No puedes hacer elecciones para '{stage.name}' hasta que la fase anterior '{previous_stage.name}' haya sido FINALIZED."
                        }, status=status.HTTP_403_FORBIDDEN)
                except Stage.DoesNotExist:
                    # Esto no debería ocurrir en un torneo bien configurado, pero por si acaso.
                    return Response({"error": "No se encontró la fase anterior para validar el estado."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Obtener o crear la instancia de FantasyPhasePick
            # El estado is_locked del pick individual se sincronizará con el de la fase al hacer GET o por acciones del admin
            picks_instance, created = FantasyPhasePick.objects.get_or_create(
                user_profile=user_profile,
                stage=stage
            )
            
            # Si el pick individual está bloqueado (quizás por una acción previa del admin), no permitir POST
            if picks_instance.is_locked and not created: # Si fue recién creado, is_locked se manejará por el estado de la stage
                 return Response({"error": "Tus elecciones para esta fase están actualmente bloqueadas y no pueden modificarse."}, status=status.HTTP_403_FORBIDDEN)

            serializer = FantasyPhasePickSerializer(
                picks_instance, 
                data=request.data, 
                partial=True, 
                context={'request': request, 'stage': stage}
            )

            if serializer.is_valid():
                stage_team_ids = set(stage.stage_teams.values_list('team__id', flat=True))
                teams_3_0_ids = set(serializer.validated_data.get('teams_3_0', []))
                teams_advance_ids = set(serializer.validated_data.get('teams_advance', []))
                teams_0_3_ids = set(serializer.validated_data.get('teams_0_3', []))
                
                all_picked_ids = teams_3_0_ids.union(teams_advance_ids).union(teams_0_3_ids)

                for team_id_obj in all_picked_ids: # serializer.validated_data devuelve objetos Team
                    team_id = team_id_obj.id
                    if team_id not in stage_team_ids:
                        team_obj = get_object_or_404(Team, pk=team_id)
                        return Response({"error": f"El equipo '{team_obj.name}' (ID: {team_id}) no pertenece a la fase actual '{stage.name}'."}, status=status.HTTP_400_BAD_REQUEST)
                
                # Guardar y asegurar que user_profile y stage están correctamente asignados
                # serializer.save() ya se encarga de esto si el objeto es nuevo o si se pasan en el save()
                saved_pick = serializer.save(user_profile=user_profile, stage=stage)
                return Response(FantasyPhasePickSerializer(saved_pick, context={'request': request, 'stage': stage}).data, 
                                status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except (UserProfile.DoesNotExist, Stage.DoesNotExist):
            return Response({"error": "Perfil de usuario o fase no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except Team.DoesNotExist as e:
             return Response({"error": f"Un equipo seleccionado no existe: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Loggear el error en el servidor para depuración
            print(f"Error inesperado en ManageFantasyPhasePicksView POST: {type(e).__name__} - {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": "Ocurrió un error inesperado en el servidor."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StageFantasyInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, stage_id, format=None):
        stage = get_object_or_404(Stage, pk=stage_id)
        serializer = StageFantasyInfoSerializer(stage, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class ManageFantasyPlayoffPicksView(APIView):
    permission_classes = [IsAuthenticated]

    def get_tournament_and_profile(self, request, tournament_id):
        user_profile = get_object_or_404(UserProfile, user=request.user)
        tournament = get_object_or_404(Tournament, pk=tournament_id)
        return user_profile, tournament

    def get(self, request, tournament_id, format=None):
        try:
            user_profile, tournament = self.get_tournament_and_profile(request, tournament_id)
            
            # Similar a las fases, el frontend determinará la editabilidad.
            # Aquí necesitamos un análogo a 'fantasy_status' para el torneo o para la fase de playoffs.
            # Por ahora, asumimos que el torneo tiene un estado general o que la fase de playoffs se maneja de forma similar.
            playoff_stage = tournament.stages.filter(type='PLAYOFF').order_by('-order').first() # Obtener la última fase de playoff
            locked_for_picks = False
            if playoff_stage and playoff_stage.fantasy_status == 'LOCKED':
                locked_for_picks = True
            # También se podría tener un estado a nivel de Tournament para los picks de playoffs.

            picks, created = FantasyPlayoffPick.objects.get_or_create(
                user_profile=user_profile,
                tournament=tournament,
                defaults={'is_locked': locked_for_picks} 
            )

            if locked_for_picks and not picks.is_locked:
                picks.is_locked = True
                picks.save()
            elif playoff_stage and playoff_stage.fantasy_status == 'OPEN' and picks.is_locked:
                if not picks.is_finalized:
                    picks.is_locked = False
                    picks.save()

            serializer = FantasyPlayoffPickSerializer(picks, context={'request': request, 'tournament': tournament})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (UserProfile.DoesNotExist, Tournament.DoesNotExist):
            return Response({"error": "Perfil de usuario o torneo no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, tournament_id, format=None):
        try:
            user_profile, tournament = self.get_tournament_and_profile(request, tournament_id)

            playoff_stage = tournament.stages.filter(type='PLAYOFF').order_by('-order').first()
            if not playoff_stage:
                 return Response({"error": "No se encontró una fase de Playoffs para este torneo."}, status=status.HTTP_404_NOT_FOUND)

            if playoff_stage.fantasy_status == 'LOCKED':
                return Response({"error": "Las elecciones para los Playoffs están cerradas (LOCKED) y no pueden modificarse."}, status=status.HTTP_403_FORBIDDEN)
            if playoff_stage.fantasy_status == 'FINALIZED':
                return Response({"error": "Los Playoffs ya han sido finalizados y los puntos calculados."}, status=status.HTTP_403_FORBIDDEN)
            
            # Validación de fases previas (todas las fases suizas deben estar FINALIZED)
            swiss_stages = tournament.stages.filter(type='SWISS')
            for swiss_stage in swiss_stages:
                if swiss_stage.fantasy_status != 'FINALIZED':
                    return Response({
                        "error": f"No puedes hacer elecciones para Playoffs hasta que todas las fases suizas (ej: '{swiss_stage.name}') hayan sido FINALIZED."
                    }, status=status.HTTP_403_FORBIDDEN)

            picks_instance, created = FantasyPlayoffPick.objects.get_or_create(
                user_profile=user_profile,
                tournament=tournament
            )
            
            if picks_instance.is_locked and not created:
                 return Response({"error": "Tus elecciones para Playoffs están actualmente bloqueadas."}, status=status.HTTP_403_FORBIDDEN)

            serializer = FantasyPlayoffPickSerializer(
                picks_instance, 
                data=request.data, 
                partial=True, 
                context={'request': request, 'tournament': tournament}
            )

            if serializer.is_valid():
                # Validación adicional: Los equipos elegidos para QF deben estar en la fase de playoffs.
                # Los de SF deben estar entre los elegidos de QF, y el de la Final entre los de SF.
                # Esta validación puede ser compleja y la omitimos por brevedad aquí, pero es importante.
                playoff_stage_team_ids = set(playoff_stage.stage_teams.values_list('team__id', flat=True))

                # Ejemplo de validación simple para QF:
                qf_winner_ids_data = serializer.validated_data.get('quarter_final_winners', [])
                for team_obj in qf_winner_ids_data:
                    if team_obj.id not in playoff_stage_team_ids:
                         return Response({"error": f"El equipo de QF '{team_obj.name}' no participa en los playoffs de este torneo."}, status=status.HTTP_400_BAD_REQUEST)

                saved_pick = serializer.save(user_profile=user_profile, tournament=tournament)
                return Response(FantasyPlayoffPickSerializer(saved_pick, context={'request': request, 'tournament': tournament}).data, 
                                status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except (UserProfile.DoesNotExist, Tournament.DoesNotExist):
            return Response({"error": "Perfil de usuario o torneo no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except Team.DoesNotExist as e:
             return Response({"error": f"Un equipo seleccionado no existe: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error inesperado en ManageFantasyPlayoffPicksView POST: {type(e).__name__} - {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": "Ocurrió un error inesperado en el servidor."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FantasyLeaderboardView(APIView):
    permission_classes = [AllowAny] # El leaderboard es público

    def get(self, request, format=None):
        # Obtener todos los UserProfile, ordenados por total_fantasy_points descendente
        # y luego por el username del usuario ascendente como desempate.
        leaderboard_users = UserProfile.objects.select_related('user').order_by('-total_fantasy_points', 'user__username')
        
        # Podríamos paginar aquí si esperamos muchos usuarios
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 25 # o el tamaño que desees
        result_page = paginator.paginate_queryset(leaderboard_users, request)
        serializer = LeaderboardUserSerializer(result_page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
class UserFantasyProfileView(APIView):
    permission_classes = [AllowAny] # Perfil público

    def get(self, request, username, format=None):
        # Encontrar el User por username, luego el UserProfile
        target_user = get_object_or_404(User, username=username)
        user_profile = get_object_or_404(UserProfile, user=target_user)

        serializer = PublicFantasyProfileSerializer(user_profile, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class CurrentUserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        user_profile = get_object_or_404(UserProfile, user=request.user)
        serializer = UserProfileSerializer(user_profile)
        return Response(serializer.data)

class TournamentFantasyPlayoffInfoView(APIView):
    permission_classes = [AllowAny] # Información pública

    def get(self, request, tournament_id, format=None):
        tournament = get_object_or_404(Tournament, pk=tournament_id)
        playoff_stage = tournament.stages.filter(type='PLAYOFF').order_by('-order').first()

        if not playoff_stage:
            return Response({"error": "No se encontró una fase de Playoffs activa para este torneo."}, status=status.HTTP_404_NOT_FOUND)

        # Equipos que participan en los playoffs (desde StageTeam de la fase de playoff)
        playoff_teams_data = StageTeam.objects.filter(stage=playoff_stage).select_related('team').order_by('team__name')
        
        # La interfaz TournamentFantasyPlayoffInfo en el frontend espera una lista de objetos Team.
        # El tipo Team (de hltvTypes) incluye id, name, logo.
        final_teams_info = []
        for st_team in playoff_teams_data:
            final_teams_info.append({
                "id": st_team.team.id,
                "name": st_team.team.name,
                "logo": st_team.team.logo,
                # "seed": st_team.initial_seed, # Opcional, si se necesita en el frontend
            })

        # Obtener el user_pick si el usuario está autenticado
        user_pick_data = None
        if request.user.is_authenticated:
            try:
                user_profile = UserProfile.objects.get(user=request.user)
                user_fantasy_playoff_pick = FantasyPlayoffPick.objects.filter(user_profile=user_profile, tournament=tournament).first()
                if user_fantasy_playoff_pick:
                    user_pick_data = FantasyPlayoffPickSerializer(user_fantasy_playoff_pick, context={'request': request, 'tournament': tournament}).data
            except UserProfile.DoesNotExist:
                pass # El usuario no tiene perfil, no hay picks

        # Definir las reglas para los picks de playoffs
        rules = {
            "num_quarter_final_winners": 4, # Ajustar según las reglas reales del torneo
            "num_semi_final_winners": 2,
            "num_final_winner": 1
        }

        response_payload = {
            'tournament_id': tournament.id,
            'tournament_name': tournament.name,
            'fantasy_status': playoff_stage.fantasy_status,
            'teams': final_teams_info,
            'rules': rules,
            'user_pick': user_pick_data
        }
        
        return Response(response_payload, status=status.HTTP_200_OK)

# Próximas vistas:
# - Vistas administrativas para cerrar fases y calcular puntos. 