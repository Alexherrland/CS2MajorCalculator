from django.core.management.base import BaseCommand, CommandError
from tournaments.models import Stage, Tournament
from tournaments.fantasy_logic import finalize_fantasy_stage_picks, finalize_fantasy_playoff_picks

class Command(BaseCommand):
    help = 'Finaliza los picks de fantasy y calcula los puntos para una fase o torneo.'

    def add_arguments(self, parser):
        parser.add_argument('--stage_id', type=int, help='ID de la fase (no playoff) a procesar.')
        parser.add_argument('--tournament_id', type=int, help='ID del torneo para procesar picks de playoffs.')

    def handle(self, *args, **options):
        stage_id = options['stage_id']
        tournament_id = options['tournament_id']

        if stage_id:
            self.stdout.write(f"Procesando picks para la fase ID: {stage_id}...")
            try:
                stage = Stage.objects.get(pk=stage_id)
                if stage.type == 'PLAYOFF':
                    self.stderr.write(self.style.ERROR(f"Error: La fase ID {stage_id} es de tipo PLAYOFF. Use --tournament_id para playoffs."))
                    return
                
                result = finalize_fantasy_stage_picks(stage_id)
                if result['success']:
                    self.stdout.write(self.style.SUCCESS(f"Resultado para fase ID {stage_id}: {result['message']}"))
                else:
                    self.stderr.write(self.style.ERROR(f"Resultado para fase ID {stage_id}: {result['message']}"))
            except Stage.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"Error: Fase con ID {stage_id} no encontrada."))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error inesperado procesando fase ID {stage_id}: {e}"))
                # traceback.print_exc() depuracion

        elif tournament_id:
            self.stdout.write(f"Procesando picks de playoffs para el torneo ID: {tournament_id}...")
            try:
                tournament = Tournament.objects.get(pk=tournament_id)
                playoff_stage = tournament.stages.filter(type='PLAYOFF').order_by('-order').first()
                
                if not playoff_stage:
                    self.stderr.write(self.style.ERROR(f"Error: No se encontró fase de PLAYOFF para el torneo ID {tournament_id}."))
                    return

                result = finalize_fantasy_playoff_picks(tournament_id)
                if result['success']:
                    self.stdout.write(self.style.SUCCESS(f"Resultado para playoffs del torneo ID {tournament_id}: {result['message']}"))
                else:
                    self.stderr.write(self.style.ERROR(f"Resultado para playoffs del torneo ID {tournament_id}: {result['message']}"))
            except Tournament.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"Error: Torneo con ID {tournament_id} no encontrado."))
            except Exception as e:
                 self.stderr.write(self.style.ERROR(f"Error inesperado procesando torneo ID {tournament_id}: {e}"))

        else:
            self.stdout.write(self.style.NOTICE("Debe especificar --stage_id o --tournament_id.")) 