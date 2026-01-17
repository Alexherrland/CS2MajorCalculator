# tournaments/management/commands/update_hltv_matches.py
import logging
from django.core.management.base import BaseCommand
from tournaments.hltv_service import bulk_update_matches_from_hltv

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Busca y actualiza los resultados de los partidos desde HLTV.org para los partidos configurados.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando el proceso de actualización de partidos desde HLTV...'))
        logger.info("Comando manage.py update_hltv_matches invocado.")
        try:
            bulk_update_matches_from_hltv() # Esta es tu función existente
            self.stdout.write(self.style.SUCCESS('Proceso de actualización de HLTV completado.'))
            logger.info("Comando manage.py update_hltv_matches completado exitosamente.")
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error durante la actualización de HLTV: {e}'))
            logger.error(f"Error en el comando update_hltv_matches: {e}", exc_info=True) 