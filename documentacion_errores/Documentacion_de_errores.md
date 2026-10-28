# Registro y Documentación de Errores - Herramienta Whats2

Este documento contiene el historial técnico de incidencias resueltas y registro para auditoría de errores durante las difusiones.

### Notas de Soporte y Diagnóstico Rápido
1. **Error de Puppeteer / Chromium no inicia:**
   - Asegurarse de ejecutar en un entorno con permisos y que los flags de arranque (`--no-sandbox`, `--disable-setuid-sandbox`) estén presentes.
2. **Error de Desconexión de WhatsApp:**
   - Si la sesión se cierra desde el teléfono móvil, el cliente detectará el evento `auth_failure` o `disconnected` y solicitará un nuevo código QR.
3. **Grupos "Solo Administradores":**
   - El bot comprueba el parámetro `announce` y el rol del usuario antes de intentar el envío; si el usuario no es admin, se registra y se salta sin arrojar error crítico.

---

### Historial de Incidencias Técnicas y Soluciones del Motor

| Fecha y Hora | Error / Incidencia | Causa Raíz | Solución Implementada | Estado |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-22 23:00:00 | Inicialización del sistema | N/A - Configuración inicial | Creación de estructura modular con manejo de excepciones por grupo | Resuelto |
| 2026-10-23 03:27:52 | Fallo al extraer grupos: Evaluation failed: r | client.getChats() ejecutado mientras WhatsApp Web aún indexaba chats | Espera de estabilización y extracción resiliente directa desde WAWebCollections.Chat con reintentos | Resuelto |
| 2026-10-23 03:41:45 | Timeout de envío en Chromium Windows | Flag --single-process causando bloqueo entre procesos | Eliminado --single-process, validación ligera en memoria y timeout individual conTimeout | Resuelto |
| 2026-10-23 03:49:38 | Error en envío multimedia: Data passed to getter must include an id property | WhatsApp Web colisiona propiedad interna __x_id en mediaOptions | Parcheado Utils.js con delete message.__x_id y reasignación de message.id | Resuelto |
| 2026-10-23 04:19:36 | Timeout en grupos restringidos a administradores (announce: true) | Sin permisos de administrador, WhatsApp no emite ACK | Detección inmediata en memoria (chat.isReadOnly / announce) y descarte en menos de 1s | Resuelto |
| 2026-10-23 04:30:06 | Grupos modernos con LID Addressing Mode | El remitente se enviaba como PN en vez de identidad LID comunitaria | Inyectada resolución forzada de identidad LID (lidUser) en Utils.js | Resuelto |
| 2026-10-23 04:57:49 | Congelamiento de cola por reutilización de mediaObject | WhatsApp Web libera el buffer tras el primer grupo y reutiliza tokens vencidos | Implementada función crearMediaParaEnvio con hash SHA-256 único por grupo | Resuelto |
| 2026-10-23 05:05:50 | Latencia en grupos masivos (>500 miembros) | Precalentamiento Signal y contexto de cifrado en frío | Precalentamiento anticipado en pausa inter-grupo y liberación periódica de caché | Resuelto |
