Nota: Por seguridad, se tuvo que borrar todos los anteriores commits ya que dejan datos expuestos

Esta herramienta está diseñada para calcular resultados y probabilidades relacionados con los torneos Major de Counter-Strike 2. Permite procesar datos de los torneos para ofrecer proyecciones o cálculos específicos sobre el desempeño de los equipos y el desarrollo de la competición.

Las funciones principales están terminadas, faltaría un mejor diseño de interfaz sobretodo en móvil, la función mas interesante es la que calcula los emparejamientos mediante el sistema buchholz

Estructura del Proyecto
El repositorio está organizado de la siguiente manera:

backend/: Contiene la lógica del servidor, gestión de datos y la configuración principal de la aplicación.

frontend/: Directorio con la interfaz de usuario y los componentes visuales de la herramienta.

tournaments/: Módulo dedicado al procesamiento y almacenamiento de la información específica de los torneos.

public/: Archivos estáticos de acceso público.

staticfiles/: Archivos necesarios para el despliegue de elementos visuales estáticos.

manage.py: Script de gestión para la ejecución de comandos del backend.

Tecnologías Utilizadas
El proyecto emplea las siguientes tecnologías y lenguajes:

Backend: Django (Python).

Frontend: TypeScript, JavaScript, CSS y HTML.

Gestión de Entorno: Git para el control de versiones.
