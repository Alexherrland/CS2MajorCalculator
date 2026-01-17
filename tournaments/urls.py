from django.urls import path, include
# from rest_framework.routers import DefaultRouter # No se usa
from . import views
from .auth_views import twitch_login, twitch_callback
from .api_views import (
    ManageFantasyPhasePicksView, StageFantasyInfoView,
    ManageFantasyPlayoffPicksView, FantasyLeaderboardView,
    UserFantasyProfileView, CurrentUserProfileView, TournamentFantasyPlayoffInfoView
)

# router = DefaultRouter() # No se usa

urlpatterns = [
    # path('', include(router.urls)), # No se usa
    path('tournaments/', views.list_tournaments, name='list-tournaments'),
    path('tournament/data/', views.get_major_data, name='tournament-data'),
    path('tournament/update-match/', views.update_match_result, name='update-match'),
    
    path('auth/twitch/login/', twitch_login, name='twitch-login'),
    path('auth/twitch/callback/', twitch_callback, name='twitch-callback'),

    # Fantasy API
    path('stage/<int:stage_id>/fantasy-info/', StageFantasyInfoView.as_view(), name='stage-fantasy-info'),
    path('fantasy/stage/<int:stage_id>/picks/', ManageFantasyPhasePicksView.as_view(), name='manage-fantasy-phase-picks'),
    
    path('tournament/<int:tournament_id>/playoff-fantasy-info/', TournamentFantasyPlayoffInfoView.as_view(), name='tournament-playoff-fantasy-info'),
    path('fantasy/tournament/<int:tournament_id>/playoff-picks/', ManageFantasyPlayoffPicksView.as_view(), name='manage-fantasy-playoff-picks'),

    path('fantasy/leaderboard/', FantasyLeaderboardView.as_view(), name='fantasy-leaderboard'),
    path('fantasy/profile/<str:username>/', UserFantasyProfileView.as_view(), name='user-fantasy-profile'),
    path('me/', CurrentUserProfileView.as_view(), name='current-user-profile'),
] 