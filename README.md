# Herramienta de Difusión WhatsApp (Whats2)

Herramienta de consola (CMD / PowerShell) optimizada para ejecutarse en segundo plano (modo *headless*) para el envío masivo de mensajes multimedia (imagen fija + texto aleatorio) a grandes volúmenes de grupos de WhatsApp (más de 120 grupos por ciclo).

---

## 📁 Estructura del Proyecto

```text
herramienta-whats2/
│
├── Seccion/                     # Almacena los datos de sesión de WhatsApp (LocalAuth)
├── Envio/                       # Lógica principal del bot
│   ├── Arranque/                # Scripts de inicio (index.js) y configuración del cliente (cliente.js)
│   ├── Sincronizacion/          # Verificación de conexión y temporizadores de espera
│   └── envio_a_grupos/          # Lógica de 8 ciclos, lectura de txt y envío imagen + caption
├── cache/                       # Persistencia de estado entre ejecuciones (estado.json)
├── img/                         # Carpeta donde se aloja la imagen fija (PNG o JPG)
├── textos/                      # Carpeta para los 20 archivos de texto (.txt) del usuario
├── extraccion_de_grupos/        # Módulo de extracción de grupos
│   └── extractor.js             # Script de Node para obtener IDs y nombres
│
├── documentacion_errores/       # Registro y auditoría de incidencias
│   ├── Documentacion_de_errores.md
│   └── logger.js
├── documentacion_cambios/       # Historial de versiones y mejoras
│   └── Documentacion_de_cambios.md
│
├── grupos.txt                   # Archivo de grupos (formato: [ID] | [Nombre])
├── Extractor.bat                # Acceso rápido para extraer los grupos
├── Iniciar.bat                  # Acceso rápido para iniciar los ciclos de difusión
├── package.json                 # Dependencias y scripts de Node
└── README.md                    # Esta guía
```

---

## 🚀 Flujo de Trabajo y Modo de Uso

### 1. Extracción de Grupos (`Extractor.bat`)
1. Haz doble clic en `Extractor.bat` (o ejecuta `node extraccion_de_grupos/extractor.js` en terminal).
2. Si es tu primera vez, aparecerá un código QR en la consola. Escanéalo con tu aplicación de WhatsApp en tu teléfono celular.
3. El módulo se conectará, extraerá todos los grupos a los que pertenece la cuenta y generará el archivo `grupos.txt` en la raíz con el formato:
   ```text
   120363028394829384@g.us | Nombre del Grupo
   ```
4. El proceso finalizará automáticamente.
5. Puedes abrir `grupos.txt` y editarlo: eliminar grupos a los que no deseas enviar, reordenarlos, etc. La herramienta respetará estrictamente el orden de las líneas y soporta sin problemas listas de más de 120 grupos.

### 2. Configurar Imagen y Textos
- **Imagen fija:** Coloca tu imagen (formato `.jpg`, `.jpeg` o `.png`) dentro de la carpeta `img/`.
- **Textos:** Coloca tus 20 archivos de texto con extensión `.txt` dentro de la carpeta `textos/`. En cada envío, el sistema elegirá al azar uno de estos 20 textos como pie de foto (*caption*) de la imagen.

### 3. Iniciar Difusión Masiva (`Iniciar.bat`)
1. Haz doble clic en `Iniciar.bat` (o ejecuta `node Envio/Arranque/index.js`).
2. El sistema iniciará WhatsApp en segundo plano utilizando la sesión guardada en `/Seccion` (sin abrir navegador visible).
3. **Sincronización inicial:** Al detectar el evento `READY`, se iniciará un temporizador de **1 minuto (60 segundos)** para permitir la sincronización completa de la red y chats antes de empezar.
4. **Ciclo de Envíos:**
   - Se ejecutarán **8 ciclos completos**.
   - Para cada grupo de la lista, se valida automáticamente si el grupo está configurado en *"solo los administradores pueden enviar mensajes"*. Si el bot no es administrador, se omite de inmediato sumando al contador `contadorSoloAdmins` sin bloquear el flujo.
   - Si tiene permisos, selecciona un texto aleatorio entre los 20 disponibles y envía la imagen con dicho texto.
   - Cada envío confirmado se imprime en consola con su **sello de tiempo exacto `[HH:MM:SS]`**.
   - Se aplica una pausa de seguridad de **3 a 5 segundos aleatorios** entre cada mensaje para evitar bloqueos por spam.
5. **Reporte por Ciclo:** Al finalizar cada ciclo, la consola muestra un resumen numérico:
   - Total de grupos enviados con éxito.
   - Total de grupos omitidos (solo administradores).
6. **Espera entre Ciclos:** Entre ciclo y ciclo, el sistema espera **2 horas (7,200,000 ms)** informando periódicamente el tiempo restante en pantalla.
7. Al completar los 8 ciclos, el sistema se cierra de forma ordenada y segura.

---

## 🛡️ Características de Seguridad y Escalabilidad
- **Manejo de Grupos "Solo Admins":** Detecta preventivamente los permisos mediante `chat.isReadOnly` y el parámetro `announce` del grupo para no forzar envíos prohibidos ni saturar la API.
- **Variabilidad de Contenido:** 20 variantes de texto aleatorias impiden que los algoritmos de detección clasifiquen los envíos como mensajes repetitivos idénticos.
- **Tolerancia a Fallos:** Cada grupo se procesa de forma aislada; si un chat individual genera un fallo de red o error de ID, se registra en `documentacion_errores/Documentacion_de_errores.md` y el proceso continúa sin interrumpir el resto de la lista.
- **Persistencia de Sesión:** Gracias a `LocalAuth` en la carpeta `/Seccion`, no es necesario volver a escanear el código QR en cada ejecución.
- **Persistencia de Caché:** El archivo `cache/estado.json` registra en tiempo real el ciclo activo, horas de inicio y fin, y estadísticas de envíos.
