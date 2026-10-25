# Parches Personalizados para whatsapp-web.js

Estos archivos contienen las soluciones críticas aplicadas directamente a `whatsapp-web.js` para asegurar la estabilidad del bot:

1. **`src/util/Injected/Utils.js`**:
   - Corrección de colisión `__x_id` en el objeto de mensaje multimedia (`delete message.__x_id`).
   - Manejo defensivo en `mediaData.mediaBlob.autorelease()` y consolidación de objetos multimedia para evitar congelamientos en envíos consecutivos.
   - Soporte para validación de identidades LID/PN en grupos de WhatsApp.

2. **`src/Client.js`**:
   - Protección con `try/catch` al obtener `getMessageModel(msg)` tras el envío de mensajes, evitando caídas si WhatsApp Web no retorna el modelo completo inmediatamente.

3. **`src/util/Constants.js`**:
   - Parámetros de versión de WhatsApp Web y User-Agent alineados para compatibilidad con Chromium headless.

### Cómo restaurar los parches si se reinstala `node_modules`:
Si alguna vez ejecutas `npm install` o borras la carpeta `node_modules`, copia el contenido de esta carpeta dentro de:
`node_modules/whatsapp-web.js/`
sobrescribiendo los archivos correspondientes.
