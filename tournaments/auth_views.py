import requests
from django.shortcuts import redirect, render
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.http import JsonResponse
from urllib.parse import urlencode

from .models import UserProfile

def twitch_login(request):
    # Redirige al usuario a Twitch para la autorización
    auth_params = {
        'client_id': settings.TWITCH_CLIENT_ID,
        'redirect_uri': settings.TWITCH_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'user:read:email'  # Solicita permiso para leer el email del usuario
    }
    twitch_auth_url = f"https://id.twitch.tv/oauth2/authorize?{urlencode(auth_params)}"
    return redirect(twitch_auth_url)

def twitch_callback(request):
    code = request.GET.get('code')
    if not code:
        return JsonResponse({'error': 'No authorization code provided by Twitch.'}, status=400)

    # Intercambiar el código por un token de acceso
    token_params = {
        'client_id': settings.TWITCH_CLIENT_ID,
        'client_secret': settings.TWITCH_CLIENT_SECRET,
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': settings.TWITCH_REDIRECT_URI
    }
    try:
        token_response = requests.post('https://id.twitch.tv/oauth2/token', data=token_params)
        token_response.raise_for_status() # Lanza una excepción para errores HTTP (4xx o 5xx)
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        if not access_token:
            return JsonResponse({'error': 'Failed to obtain access token from Twitch.', 'details': token_data}, status=400)

    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': f'Error during token exchange: {str(e)}', 'details': token_response.text if 'token_response' in locals() else 'No response'}, status=500)
    except ValueError: # Si token_response.json() falla
        return JsonResponse({'error': 'Invalid JSON response from Twitch token endpoint.', 'details': token_response.text}, status=500)

    # Usar el token de acceso para obtener información del usuario de Twitch
    headers = {
        'Client-ID': settings.TWITCH_CLIENT_ID,
        'Authorization': f'Bearer {access_token}'
    }
    try:
        user_info_response = requests.get('https://api.twitch.tv/helix/users', headers=headers)
        user_info_response.raise_for_status()
        user_info_data = user_info_response.json()
        
        if not user_info_data.get('data') or len(user_info_data['data']) == 0:
            return JsonResponse({'error': 'Failed to retrieve user data from Twitch API.', 'details': user_info_data}, status=400)
        
        twitch_user_data = user_info_data['data'][0]
        twitch_id = twitch_user_data.get('id')
        twitch_username = twitch_user_data.get('login') # 'login' es el nombre de usuario
        twitch_display_name = twitch_user_data.get('display_name')
        twitch_profile_image_url = twitch_user_data.get('profile_image_url')
        twitch_email = twitch_user_data.get('email') # Asumiendo que el scope user:read:email fue concedido

    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': f'Error fetching user data from Twitch: {str(e)}'}, status=500)
    except (ValueError, IndexError):
        return JsonResponse({'error': 'Invalid JSON or data structure from Twitch user API.', 'details': user_info_response.text if 'user_info_response' in locals() else 'No response'}, status=500)

    # Buscar o crear el UserProfile y el User de Django
    try:
        user_profile = UserProfile.objects.get(twitch_id=twitch_id)
        user = user_profile.user
        # Actualizar datos si es necesario (ej. imagen de perfil)
        user_profile.twitch_username = twitch_username
        user_profile.twitch_profile_image_url = twitch_profile_image_url
        user_profile.save()
        if twitch_email and not user.email:
            user.email = twitch_email
            user.save()
            
    except UserProfile.DoesNotExist:
        # Crear nuevo usuario si no existe
        # Usar el email de Twitch si está disponible y es único, sino generar uno o dejarlo vacío
        # El username de Django debe ser único.
        django_username = twitch_username
        counter = 1
        while User.objects.filter(username=django_username).exists():
            django_username = f"{twitch_username}{counter}"
            counter += 1
        
        user_email_to_use = twitch_email if twitch_email else ''
        if User.objects.filter(email=user_email_to_use).exists() and user_email_to_use != '':
             # Si el email ya existe y no es vacío, no podemos usarlo para el nuevo usuario directamente
             # Podrías generar un email único o manejar esto de otra forma.
             # Por ahora, lo dejamos vacío si ya existe para evitar errores de unicidad.
            user_email_to_use = '' 

        user = User.objects.create_user(username=django_username, email=user_email_to_use)
        user_profile = UserProfile.objects.create(
            user=user,
            twitch_id=twitch_id,
            twitch_username=twitch_username,
            twitch_profile_image_url=twitch_profile_image_url
        )

    # Iniciar sesión para el usuario en Django
    login(request, user)

    # Redirigir al frontend (ej. a la página principal o al dashboard del fantasy)
    # Deberás cambiar '/' por la URL de tu frontend a la que quieres redirigir
    return redirect('http://localhost:3000/') # O la URL de tu página de Fantasy 