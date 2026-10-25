# Documentación de Cambios (Changelog) - Herramienta Whats2

Todas las modificaciones, optimizaciones y versiones notables de este proyecto están registradas en este documento.

---

## [Versión 1.0.8] - 2026-10-23

### Pausa Inter-Grupo con Liberación de Caché, Preparación Anticipada y Precalentamiento de Ventana
- **Pausa Inter-Grupo Optimizada (`pausaInterGrupoConPreparacion`):** Se mantienen estrictamente los 15 a 25 segundos aleatorios entre mensajes. Durante este intervalo de espera, el sistema ejecuta de forma sincronizada:
  1. **Liberación de Memoria:** Limpieza de la caché en memoria de WhatsApp Web (`WAWebMediaInMemoryBlobCache`) y recolección de basura para evitar saturación de RAM por acumulación de blobs.
  2. **Preparación Anticipada:** Selección del siguiente texto y generación de la nueva instancia multimedia con hash SHA-256 único antes de que comience el envío.
  3. **Precalentamiento de Ventana (`openChatWindow`):** Apertura en segundo plano del siguiente grupo mientras transcurre la pausa de seguridad, permitiendo que WhatsApp Web cargue las claves de cifrado (Signal Protocol) y el socket de transmisión en caliente sin añadir ningún segundo extra fuera de la pausa de 15 a 25s.
- **Corrección de Validación de Permisos y Modo LID en `Utils.js`:** Se corrigió el orden de ejecución en `Utils.js`, moviendo la validación de grupos solo para administradores (`announce: true`) para que se ejecute después de la sincronización de `chat.groupMetadata`, evaluando la identidad tanto por número telefónico (`meUser`) como por identidad LID (`lidUser`). Esto previene que el servidor descarte mensajes silenciosamente sin emitir ACK.
- **Validación Robusta en `verificarPermisoGrupoLigero`:** Se integró la comprobación de `chat.isReadOnly` y resolución cruzada de identidades LID/PN para descartar grupos restringidos en menos de 1 segundo como `[SOLO ADMINS]`.
- **Ampliación de Timeout de Confirmación a 35s:** Se ajustó el límite de espera en `conTimeout` a 35 segundos para admitir con seguridad la confirmación de servidores en grupos masivos con cientos de participantes.

---

## [Versión 1.0.7] - 2026-10-23

### Generación Dinámica de Media y Eliminación de Colisión en Caché MMS
- **Generación de Media con Hash Único (`crearMediaParaEnvio`):** En WhatsApp Web, enviar la misma instancia multimedia o el mismo archivo genera exactamente el mismo `filehash`. WhatsApp Web almacena el objeto en `WAWebMediaStorage` y libera el buffer con `mediaBlob.autorelease()`. Al intentar enviar al 2do grupo, `getOrCreateMediaObject` reutiliza el objeto con el buffer ya liberado e intenta reenviarlo con tokens de subida inválidos, causando que el servidor de WhatsApp no confirme el mensaje. Se implementó una función que añade una marca única de bytes imperceptible al archivo en cada iteración, garantizando un hash SHA-256 limpio e independiente por cada grupo.
- **Protección de Caché en `Utils.js`:** Se añadieron bloques defensivos de `try/catch` en `mediaObject.consolidate` y `mediaData.mediaBlob.autorelease()` para prevenir estados corruptos en la memoria del navegador.
- **Eliminación de Latencia Innecesaria:** Se retiró la llamada a `openChatWindow`, reduciendo el tiempo de preparación por grupo de 10 segundos a menos de 1 segundo.

---

## [Versión 1.0.6] - 2026-10-23

### Activación Automática de Ventana de Chat y Corrección de Modo LID
- **Activación de Ventana de Chat (`client.interface.openChatWindow`):** En WhatsApp Web, los grupos inactivos no tienen cargada la sesión de cifrado de participantes ni el socket de transmisión en caliente. Se implementó la apertura automática de la ventana de chat para cada grupo antes de enviar, poniendo al grupo en el mismo estado activo que tenía el primer grupo.
- **Corrección de Identidad LID en Grupos:** Los grupos modernos de WhatsApp utilizan identidades LID (Linked Device / Privacidad de número). Si `groupMetadata` no estaba en memoria, la librería enviaba el mensaje con el número de teléfono tradicional (`meUser`) en vez de la identidad LID (`lidUser`), causando el rechazo silencioso del servidor. Se forzó la resolución correcta del remitente LID en `Utils.js`.

---

## [Versión 1.0.5] - 2026-10-23

### Detección Instantánea de Permisos y Prevención de Timeouts en Grupos Restringidos
- **Actualización Forzada de Metadata (`GroupMetadata.update`):** Al verificar permisos de cada grupo, se fuerza la descarga en caliente de la metadata del chat desde WhatsApp Web. Esto asegura que la propiedad `announce: true` (Solo Administradores) y la lista de participantes se conozcan antes de iniciar el envío.
- **Detección sin esperas:** Si el grupo es restringido a administradores y el usuario es participante normal, se descarta en menos de 1 segundo como `[SOLO ADMINS]`, evitando la espera de 40 segundos por la confirmación de un servidor que no aceptará el mensaje.
- **Reducción de Timeout de Confirmación (20s):** Se ajustó el límite máximo de confirmación por el servidor de WhatsApp de 40 a 20 segundos.
- **Formato Visual Mejorado:** Incorporación de tarjetas con líneas delimitadoras y formato estructurado por cada grupo procesado.

---

## [Versión 1.0.4] - 2026-10-23

### Ajuste de Tiempos y Estado de Envío Multimedia
- **Retardo inter-grupo incrementado (15s - 25s):** Se modificó la pausa de seguridad aleatoria entre mensajes a un rango de 15 a 25 segundos para maximizar la protección anti-spam.
- **Estado extendido de transmisión (5 segundos):** Se incorporó un estado explícito `[ENVIANDO]` con una pausa de 5 segundos antes de emitir la confirmación `[ENVIADO]`, garantizando el tiempo suficiente para el procesamiento y subida de la imagen fija.

---

## [Versión 1.0.3] - 2026-10-23

### Parche de Envío Multimedia y Memoización en WhatsApp Web
- **Corrección de colisión `__x_id`:** Al procesar imágenes adjuntas, el modelo multimedia de WhatsApp Web generaba una propiedad privada `__x_id` que colisionaba con la estructura del mensaje (`newMsgKey`), provocando el error `Data passed to getter must include an id property (it's how we memoize)`. Se eliminó explícitamente `message.__x_id` y se aseguró la integridad de `message.id = newMsgKey`.
- **Protección de serialización:** Se encapsuló la llamada a `window.WWebJS.getMessageModel(msg)` en `Client.js` con manejo de excepciones para evitar que el getter interno de WhatsApp Web interfiera con la confirmación del envío.

---

## [Versión 1.0.2] - 2026-10-23

### Optimización del Motor de Envíos y Eliminación de Deadlocks
- **Eliminación de flag `--single-process`:** Se removió esta directiva de Puppeteer ya que en entornos Windows causaba bloqueo mutuo (deadlock) entre el proceso de renderizado y el protocolo DevTools.
- **Configuración de `protocolTimeout`:** Se amplió a 90,000 ms para evitar que llamadas asíncronas se corten prematuramente.
- **Verificación ultraligera de permisos (`verificarPermisoGrupoLigero`):** Se eliminó la llamada pesada a `client.getChatById()` (que forzaba peticiones de red y causaba congelamientos de 3 minutos) y se sustituyó por una lectura instantánea de memoria (<5ms).
- **Timeout individual por grupo (`conTimeout`):** Cada envío ahora tiene un límite estricto de 35 segundos; si un grupo se retrasa, el bot lo salta de forma segura sin congelar la cola de 164 grupos.

---

## [Versión 1.0.1] - 2026-10-23

### Optimización y Resiliencia del Extractor
- **Corrección de Evaluación 'r':** Reemplazo de la llamada síncrona a `client.getChats()` por un método resiliente que accede directamente a la colección de chats en memoria (`WAWebCollections.Chat`).
- **Espera de estabilización inicial:** Se agregó una pausa de 8 segundos tras el evento `ready` para permitir que WhatsApp termine la indexación de conversaciones.
- **Sistema de Reintentos:** Implementación de hasta 4 intentos automáticos con pausas de 5 segundos en caso de lentitud en la sincronización de la cuenta.
- **Unificación de Sesión:** Sincronización del `clientId` (`whats2-session`) entre el extractor y el módulo de envío para compartir exactamente la misma sesión de `/Seccion`.

---

## [Versión 1.0.0] - 2026-10-22

### Inicialización y Arquitectura Base
- **Estructura modular:** Separación clara entre Arranque, Sincronización, Envío a Grupos y Extracción.
- **Segundo plano:** Configuración de Puppeteer en modo `headless: true` con flags de rendimiento para ejecución en CMD/PowerShell sin ventanas emergentes.
- **Persistencia de sesión:** Implementación de estrategia `LocalAuth` guardando credenciales en la carpeta `/Seccion` para evitar escaneo repetitivo del código QR.
- **Extractor de Grupos:** Creación del módulo `extractor.js` y ejecutable `Extractor.bat` para generar automáticamente la lista `grupos.txt` con formato `[ID] | [Nombre]`.
- **Módulo de Envío de Alto Volumen (>120 grupos):**
  - Sistema de 8 ciclos continuos con pausas interciclo de 2 horas.
  - Sincronización previa con espera de seguridad de 1 minuto tras el evento `READY`.
  - Verificación estricta de permisos de grupo: Detección automática de grupos donde solo los administradores pueden enviar mensajes.
  - Selección aleatoria de 20 textos distintos por cada envío para prevenir patrones de spam.
  - Envío multimedia consistente (imagen fija + texto como caption).
  - Retardo aleatorio de 3 a 5 segundos entre envíos individuales.
  - Reporte de fin de ciclo con contadores exactos de envíos exitosos y grupos restringidos.
  - Persistencia de estado en `cache/estado.json`.
  - Ejecutable `Iniciar.bat` para fácil lanzamiento por el usuario.
