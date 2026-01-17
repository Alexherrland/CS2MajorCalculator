from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class TournamentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tournaments'

    def ready(self):
        # La lógica de programación de tareas de django-q2 se ha eliminado.
        # Si necesitas alguna inicialización al arrancar la app (que no sea de tareas programadas),
        # puedes ponerla aquí.
        logger.debug("TournamentsConfig.ready() llamada.")
        pass
