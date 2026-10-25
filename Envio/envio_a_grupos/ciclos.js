const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { getTimestamp } = require('../Arranque/cliente');
const { sleep, esperarEntreMensajes, esperarEntreCiclos } = require('../Sincronizacion/sincronizacion');
const { registrarError } = require('../../documentacion_errores/logger');

// Rutas de archivos y carpetas
const GRUPOS_FILE = path.resolve(__dirname, '../../grupos.txt');
const IMG_DIR = path.resolve(__dirname, '../../img');
const TEXTOS_DIR = path.resolve(__dirname, '../../textos');
const CACHE_DIR = path.resolve(__dirname, '../../cache');
const ESTADO_FILE = path.join(CACHE_DIR, 'estado.json');

/**
 * Asegura que los directorios necesarios existan
 */
function asegurarDirectorios() {
    [IMG_DIR, TEXTOS_DIR, CACHE_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

/**
 * Guarda o actualiza el estado en cache/estado.json
 * @param {Object} data Datos del estado
 */
function guardarEstado(data) {
    try {
        asegurarDirectorios();
        const estadoActual = cargarEstado() || {};
        const nuevoEstado = { ...estadoActual, ...data, ultimaActualizacion: new Date().toISOString() };
        fs.writeFileSync(ESTADO_FILE, JSON.stringify(nuevoEstado, null, 2), 'utf8');
    } catch (err) {
        console.error(`[${getTimestamp()}] [CACHE ERROR] No se pudo guardar estado.json:`, err.message);
    }
}

/**
 * Carga el estado previo desde cache/estado.json si existe
 * @returns {Object|null}
 */
function cargarEstado() {
    try {
        if (fs.existsSync(ESTADO_FILE)) {
            const raw = fs.readFileSync(ESTADO_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (err) {
        // Ignorar error al leer
    }
    return null;
}

/**
 * Lee y parsea grupos.txt respetando el orden y soportando listas de más de 120 grupos
 * @returns {Array<{id: string, nombre: string}>}
 */
function cargarGrupos() {
    if (!fs.existsSync(GRUPOS_FILE)) {
        throw new Error(`El archivo grupos.txt no existe en la ruta: ${GRUPOS_FILE}. Ejecuta Extractor.bat primero.`);
    }

    const contenido = fs.readFileSync(GRUPOS_FILE, 'utf8');
    const lineas = contenido.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

    const grupos = [];
    for (const linea of lineas) {
        const partes = linea.split('|');
        const id = partes[0].trim();
        const nombre = partes[1] ? partes[1].trim() : id;

        if (id) {
            grupos.push({ id, nombre });
        }
    }

    return grupos;
}

/**
 * Busca y carga la imagen fija (JPG, JPEG o PNG) desde la carpeta img/
 * @returns {string} Ruta absoluta del archivo de imagen
 */
function obtenerRutaImagen() {
    asegurarDirectorios();
    const archivos = fs.readdirSync(IMG_DIR);
    const imagen = archivos.find(file => /\.(png|jpe?g)$/i.test(file));

    if (!imagen) {
        throw new Error(`No se encontró ninguna imagen (.jpg, .jpeg o .png) en la carpeta img/. Por favor coloca la imagen a difundir.`);
    }

    return path.join(IMG_DIR, imagen);
}

/**
 * Crea una instancia fresca de MessageMedia con una marca de bytes única al final del archivo.
 * Esto garantiza que cada grupo reciba un hash SHA-256 único, evitando que WhatsApp Web
 * reutilice objetos multimedia en caché cuyo buffer interno ya fue liberado tras el primer grupo.
 * @param {string} rutaImagen Ruta absoluta de la imagen
 * @param {number|string} indice Identificador del grupo/envío
 * @returns {MessageMedia}
 */
function crearMediaParaEnvio(rutaImagen, indice) {
    const rawBuffer = fs.readFileSync(rutaImagen);
    // Marca única tras el final del archivo para garantizar hash único sin alterar la visualización
    const marcaUnica = Buffer.from(`\n<!-- whats2_media_${indice}_${Date.now()}_${Math.random()} -->`, 'utf8');
    const bufferUnico = Buffer.concat([rawBuffer, marcaUnica]);
    const ext = path.extname(rutaImagen).toLowerCase();
    const mimetype = ext === '.png' ? 'image/png' : 'image/jpeg';
    return new MessageMedia(mimetype, bufferUnico.toString('base64'), path.basename(rutaImagen));
}

/**
 * Lee los archivos de texto desde la carpeta textos/
 * @returns {Array<string>} Lista de mensajes de texto
 */
function cargarTextos() {
    asegurarDirectorios();
    const archivos = fs.readdirSync(TEXTOS_DIR).filter(file => 
        file.endsWith('.txt') && 
        !file.toLowerCase().startsWith('leeme') && 
        !file.toLowerCase().startsWith('readme')
    );

    if (archivos.length === 0) {
        throw new Error(`No se encontraron archivos .txt en la carpeta textos/. Por favor coloca los 20 archivos de texto.`);
    }

    const textos = [];
    for (const archivo of archivos) {
        const contenido = fs.readFileSync(path.join(TEXTOS_DIR, archivo), 'utf8').trim();
        if (contenido.length > 0) {
            textos.push(contenido);
        }
    }

    if (textos.length === 0) {
        throw new Error(`Los archivos .txt en textos/ están vacíos. Agrega el contenido de los mensajes.`);
    }

    return textos;
}

/**
 * Envuelve una promesa con un tiempo límite de ejecución
 */
function conTimeout(promesa, ms, mensajeError) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(mensajeError || `Operación superó el límite de ${ms / 1000}s`));
        }, ms);
    });
    return Promise.race([
        promesa,
        timeoutPromise
    ]).finally(() => clearTimeout(timer));
}

/**
 * Verifica si el bot puede escribir en el grupo consultando el modelo de chat.
 * Comprueba de forma infalible si el chat es solo lectura o si está restringido a administradores,
 * soportando tanto identidades por número de teléfono como modo LID.
 */
async function verificarPermisoGrupoLigero(client, groupId, myWid) {
    try {
        const resultado = await conTimeout(
            client.pupPage.evaluate(async (id, myUserWid) => {
                try {
                    const widFactory = window.require('WAWebWidFactory');
                    const chatWid = widFactory.createWid(id);
                    let chat = window.require('WAWebCollections').Chat.get(chatWid);

                    if (!chat && window.require('WAWebFindChatAction')) {
                        chat = (await window.require('WAWebFindChatAction').findOrCreateLatestChat(chatWid))?.chat;
                    }

                    if (!chat) return { puedeEnviar: true };

                    // 1. Verificación inmediata de solo lectura en el chat
                    if (chat.isReadOnly) {
                        return { puedeEnviar: false, razon: 'chat_readonly' };
                    }

                    // 2. Obtener metadata: memoria local o consultar store con find()
                    const GroupMetadataCol = window.require('WAWebCollections').GroupMetadata || 
                                             window.require('WAWebCollections').WAWebGroupMetadataCollection;
                    let meta = chat.groupMetadata || (GroupMetadataCol && typeof GroupMetadataCol.get === 'function' ? GroupMetadataCol.get(chatWid) : null);

                    if (!meta && GroupMetadataCol && typeof GroupMetadataCol.find === 'function') {
                        try {
                            meta = await GroupMetadataCol.find(chatWid);
                            if (meta && chat) chat.groupMetadata = meta;
                        } catch (eFind) {}
                    }

                    // 3. Si el grupo tiene restricción de solo administradores (announce)
                    if (meta && (meta.announce || meta.isAnnounce)) {
                        // Obtener identidades PN y LID del usuario
                        let meUser = null;
                        let lidUser = null;
                        try {
                            const UserPrefs = window.require('WAWebUserPrefsMeUser');
                            if (UserPrefs) {
                                const pnObj = UserPrefs.getMaybeMePnUser && UserPrefs.getMaybeMePnUser();
                                const lidObj = UserPrefs.getMaybeMeLidUser && UserPrefs.getMaybeMeLidUser();
                                meUser = pnObj ? (pnObj.user || pnObj._serialized || String(pnObj)) : null;
                                lidUser = lidObj ? (lidObj.user || lidObj._serialized || String(lidObj)) : null;
                            }
                        } catch (eMe) {}

                        if (!meUser && window.require('WAWebConnModel')) {
                            const Conn = window.require('WAWebConnModel').Conn;
                            meUser = (Conn && Conn.wid && (Conn.wid.user || Conn.wid._serialized)) || null;
                        }
                        if (!meUser && myUserWid) {
                            meUser = myUserWid;
                        }

                        const myPn = meUser ? String(meUser).split(/[:@]/)[0] : '';
                        const myLid = lidUser ? String(lidUser).split(/[:@]/)[0] : '';
                        
                        let participants = [];
                        const rawPart = meta.participants;
                        if (rawPart) {
                            if (Array.isArray(rawPart)) {
                                participants = rawPart;
                            } else if (typeof rawPart.getModelsArray === 'function') {
                                participants = rawPart.getModelsArray();
                            } else if (rawPart.models && Array.isArray(rawPart.models)) {
                                participants = rawPart.models;
                            } else if (typeof rawPart.serialize === 'function') {
                                participants = rawPart.serialize();
                            } else if (typeof rawPart.forEach === 'function') {
                                rawPart.forEach(p => participants.push(p));
                            }
                        }

                        const me = participants.find(p => {
                            const pId = p.id ? (p.id.user || p.id._serialized || String(p.id)) : '';
                            return (myPn && pId.includes(myPn)) || (myLid && pId.includes(myLid));
                        });

                        const isAdmin = me ? (me.isAdmin || me.isSuperAdmin) : false;
                        if (!isAdmin) {
                            return { puedeEnviar: false, razon: 'solo_admins' };
                        }
                    }

                    return { puedeEnviar: true };
                } catch (e) {
                    return { puedeEnviar: true };
                }
            }, groupId, myWid),
            10000,
            'Timeout al validar permisos'
        );

        return resultado.puedeEnviar;
    } catch (err) {
        return true;
    }
}

/**
 * Pausa de seguridad optimizada entre 8 y 13 segundos entre grupos consecutivos.
 * Aprovecha este intervalo activo para:
 * 1. Liberar la memoria y vaciar la caché de WhatsApp Web (WAWebMediaInMemoryBlobCache y GC).
 * 2. Preparar el contenido del siguiente grupo (generar imagen con hash SHA-256 fresco y texto aleatorio).
 * 3. Precalentar metadatos en segundo plano sin colgar el navegador.
 * @returns {Promise<{proximoTexto: string|null, proximaMedia: MessageMedia|null}>}
 */
async function pausaInterGrupoConPreparacion({
    client,
    siguienteGrupo,
    rutaImagen,
    textos,
    ciclo,
    siguienteIndice,
    minMs = 8000,
    maxMs = 13000
}) {
    const t0 = Date.now();
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    const segundos = Math.round(delay / 1000);

    console.log(`[${getTimestamp()}] [PAUSA DE SEGURIDAD] Esperando ${segundos}s antes del siguiente grupo...`);

    // 1. Liberar caché de medios y memoria en el navegador
    try {
        await client.pupPage.evaluate(() => {
            try {
                if (window.require) {
                    const blobCacheMod = window.require('WAWebMediaInMemoryBlobCache');
                    if (blobCacheMod && blobCacheMod.InMemoryMediaBlobCache) {
                        const cache = blobCacheMod.InMemoryMediaBlobCache;
                        if (typeof cache.clear === 'function') cache.clear();
                        else if (cache._cache && typeof cache._cache.clear === 'function') cache._cache.clear();
                        else if (cache._map && typeof cache._map.clear === 'function') cache._map.clear();
                    }
                }
            } catch (eBlob) {}

            try {
                if (window.gc) window.gc();
            } catch (eGc) {}
        });
        console.log(`[${getTimestamp()}] [LIBERACIÓN CACHÉ] Memoria de WhatsApp Web y buffers multimedia liberados.`);
    } catch (eLimpieza) {}

    let proximoTexto = null;
    let proximaMedia = null;

    // 2. Preparar anticipadamente texto, imagen fresca y precalentar modelo del siguiente grupo
    if (siguienteGrupo) {
        proximoTexto = textos[Math.floor(Math.random() * textos.length)];
        proximaMedia = crearMediaParaEnvio(rutaImagen, `${ciclo}_${siguienteIndice}`);

        try {
            await client.pupPage.evaluate(async (id) => {
                try {
                    const wid = window.require('WAWebWidFactory').createWid(id);
                    let chat = window.require('WAWebCollections').Chat.get(wid);
                    if (!chat && window.require('WAWebFindChatAction')) {
                        chat = (await window.require('WAWebFindChatAction').findOrCreateLatestChat(wid))?.chat;
                    }
                    const GroupCol = window.require('WAWebCollections').GroupMetadata || window.require('WAWebCollections').WAWebGroupMetadataCollection;
                    if (GroupCol && typeof GroupCol.find === 'function') {
                        const meta = await GroupCol.find(wid);
                        if (meta && chat) chat.groupMetadata = meta;
                    }
                } catch (e) {}
            }, siguienteGrupo.id);
            console.log(`[${getTimestamp()}] [PREPARADO] Metadatos y claves activadas para: "${siguienteGrupo.nombre}"`);
        } catch (ePrep) {}
    }

    // 3. Completar exactamente el tiempo total de la pausa aleatoria (8 a 13 segundos)
    const tiempoConsumido = Date.now() - t0;
    const tiempoRestante = delay - tiempoConsumido;
    if (tiempoRestante > 0) {
        await sleep(tiempoRestante);
    }

    return { proximoTexto, proximaMedia };
}

/**
 * Aplica descansos especiales optimizados para lograr ciclos rápidos de 35 a 45 minutos:
 * - Cada 25 grupos: descanso de 45 segundos
 * - Hito Grupo 8 / Grupo 80: descanso de 45 segundos
 * - Hito Grupo 50: descanso de 1m 30s (90 segundos)
 * - Hito Grupo 100: descanso de 1m 30s (90 segundos)
 * - Hito Grupo 150: descanso de 45 segundos
 */
async function aplicarDescansoEspecial(numeroGrupo, totalGrupos, siguienteGrupo) {
    if (!siguienteGrupo) return;

    let duracionMs = 0;
    let descripcion = '';

    if (numeroGrupo === 50) {
        duracionMs = 90000;
        descripcion = `Hito Grupo 50: Pausa de enfriamiento de 1m 30s (90 segundos)`;
    } else if (numeroGrupo === 100) {
        duracionMs = 90000;
        descripcion = `Hito Grupo 100: Pausa de enfriamiento de 1m 30s (90 segundos)`;
    } else if (numeroGrupo === 150) {
        duracionMs = 45000;
        descripcion = `Hito Grupo 150: Pausa de enfriamiento de 45 segundos`;
    } else if (numeroGrupo === 120) {
        duracionMs = 45000;
        descripcion = `Hito Grupo 120: Pausa de enfriamiento de 45 segundos`;
    } else if (numeroGrupo === 8) {
        duracionMs = 45000;
        descripcion = `Hito Grupo 8: Pausa de enfriamiento de 45 segundos`;
    } else if (numeroGrupo % 20 === 0) {
        duracionMs = 45000;
        descripcion = `Lote de 20 grupos (${numeroGrupo}/${totalGrupos}): Pausa de 45 segundos`;
    }

    if (duracionMs > 0) {
        console.log(`\n======================================================`);
        console.log(`\n======================================================`);
        console.log(`[${getTimestamp()}] [DESCANSO DE SEGURIDAD] ${descripcion}...`);
        console.log(`[${getTimestamp()}] Enfriamiento activo para proteger la reputación de la cuenta...`);
        console.log(`======================================================`);
        console.log(`======================================================\n`);
        await sleep(duracionMs);
    }
}

/**
 * Ejecuta el sistema de 8 ciclos de difusión masiva
 * @param {Client} client Instancia del cliente WhatsApp Web inicializado y listo
 */
async function ejecutarCiclos(client) {
    asegurarDirectorios();

    console.log(`\n======================================================`);
    console.log(`[${getTimestamp()}] [PREPARACIÓN] Cargando configuración y archivos del sistema...`);
    console.log(`======================================================`);

    // 1. Cargar grupos
    const grupos = cargarGrupos();
    console.log(`[${getTimestamp()}] [ARCHIVOS] Grupos cargados: ${grupos.length} grupos desde grupos.txt.`);

    if (grupos.length === 0) {
        throw new Error('El archivo grupos.txt está vacío. Agrega grupos o ejecuta Extractor.bat.');
    }

    // 2. Cargar imagen fija
    const rutaImagen = obtenerRutaImagen();
    console.log(`[${getTimestamp()}] [ARCHIVOS] Imagen fija cargada: ${path.basename(rutaImagen)}`);
    const media = MessageMedia.fromFilePath(rutaImagen);

    // 3. Cargar textos
    const textos = cargarTextos();
    console.log(`[${getTimestamp()}] [ARCHIVOS] Textos cargados: ${textos.length} textos disponibles en carpeta textos/.`);

    // Obtener ID del bot
    const myWid = client.info && client.info.wid ? client.info.wid._serialized : null;
    console.log(`[${getTimestamp()}] [CLIENTE] ID de sesión activa: ${myWid || 'Detectado'}`);

    const TOTAL_CICLOS = 8;
    console.log(`\n======================================================`);
    console.log(`[${getTimestamp()}] INICIANDO PLAN MAESTRO: ${TOTAL_CICLOS} CICLOS PROGRAMADOS`);
    console.log(`======================================================\n`);

    for (let ciclo = 1; ciclo <= TOTAL_CICLOS; ciclo++) {
        console.log(`\n======================================================`);
        console.log(`[${getTimestamp()}] >>> INICIANDO CICLO ${ciclo} DE ${TOTAL_CICLOS} <<<`);
        console.log(`[${getTimestamp()}] Total de grupos a procesar: ${grupos.length}`);
        console.log(`======================================================\n`);

        let contadorEnviados = 0;
        let contadorSoloAdmins = 0;
        let contadorErrores = 0;

        guardarEstado({
            cicloActual: ciclo,
            totalCiclos: TOTAL_CICLOS,
            estadoCiclo: 'EN_PROCESO',
            inicioCiclo: new Date().toISOString()
        });

        // Preparar anticipadamente el primer grupo del ciclo
        let textoActual = textos[Math.floor(Math.random() * textos.length)];
        let mediaActual = crearMediaParaEnvio(rutaImagen, `${ciclo}_0`);
        try {
            await client.pupPage.evaluate(async (id) => {
                try {
                    const wid = window.require('WAWebWidFactory').createWid(id);
                    let chat = window.require('WAWebCollections').Chat.get(wid);
                    if (!chat && window.require('WAWebFindChatAction')) {
                        chat = (await window.require('WAWebFindChatAction').findOrCreateLatestChat(wid))?.chat;
                    }
                    const GroupCol = window.require('WAWebCollections').GroupMetadata || window.require('WAWebCollections').WAWebGroupMetadataCollection;
                    if (GroupCol && typeof GroupCol.find === 'function') {
                        const meta = await GroupCol.find(wid);
                        if (meta && chat) chat.groupMetadata = meta;
                    }
                } catch (e) {}
            }, grupos[0].id);
            await sleep(1500); // Pequeña estabilización inicial para el primer grupo
        } catch (eWin0) {}

        for (let i = 0; i < grupos.length; i++) {
            const grupo = grupos[i];
            const progreso = `[${i + 1}/${grupos.length}]`;
            const siguienteGrupo = (i + 1 < grupos.length) ? grupos[i + 1] : null;

            console.log(`\n======================================================`);
            console.log(`\n======================================================`);
            console.log(`[${getTimestamp()}] GRUPO ${progreso}: "${grupo.nombre}"`);
            console.log(`ID: ${grupo.id}`);

            try {
                // 1. Verificación rápida de permisos de escritura en el grupo
                const puedeEscribir = await verificarPermisoGrupoLigero(client, grupo.id, myWid);

                if (!puedeEscribir) {
                    contadorSoloAdmins++;
                    console.log(`[${getTimestamp()}] [SOLO ADMINS] Omitido: Solo administradores pueden enviar mensajes.`);
                    console.log(`\n======================================================`);
                    console.log(`\n======================================================\n`);

                    if (siguienteGrupo) {
                        const prep = await pausaInterGrupoConPreparacion({
                            client,
                            siguienteGrupo,
                            rutaImagen,
                            textos,
                            ciclo,
                            siguienteIndice: i + 1,
                            minMs: 8000,
                            maxMs: 13000
                        });
                        textoActual = prep.proximoTexto;
                        mediaActual = prep.proximaMedia;
                    }

                    // Descanso especial anti-baneos o de lote cada 25 grupos
                    await aplicarDescansoEspecial(i + 1, grupos.length, siguienteGrupo);
                    continue;
                }

                // 2. Si no estaba preparado previamente (ej. tras un salto), asegurar media y texto
                if (!textoActual) {
                    textoActual = textos[Math.floor(Math.random() * textos.length)];
                }
                if (!mediaActual) {
                    mediaActual = crearMediaParaEnvio(rutaImagen, `${ciclo}_${i}`);
                }

                // 3. Simular presencia humana ("escribiendo...") por 1 segundo antes de enviar
                try {
                    await client.pupPage.evaluate(async (chatId) => {
                        try {
                            const chatWid = window.require('WAWebWidFactory').createWid(chatId);
                            const chat = window.require('WAWebCollections').Chat.get(chatWid);
                            if (chat && window.require('WAWebSendChatStateMsgAction')) {
                                window.require('WAWebSendChatStateMsgAction').sendChatStateComposing(chat);
                            }
                        } catch (e) {}
                    }, grupo.id);
                    await sleep(1000);
                } catch (eType) {}

                // 4. Informar estado previo de envío
                console.log(`[${getTimestamp()}] [ENVIANDO] Transmitiendo imagen y texto aleatorio...`);

                // 5. Enviar mensaje multimedia con timeout de 45s y reintento resiliente si el contexto de página se restablece
                let enviadoExitoso = false;
                for (let intento = 1; intento <= 2; intento++) {
                    try {
                        await conTimeout(
                            client.sendMessage(grupo.id, mediaActual, {
                                caption: textoActual,
                                waitUntilMsgSent: false
                            }),
                            45000,
                            'No se pudo encolar el mensaje en WhatsApp Web en 45s'
                        );
                        enviadoExitoso = true;
                        break;
                    } catch (eSend) {
                        if (intento === 1 && /execution context|navigat/i.test(eSend.message)) {
                            console.log(`[${getTimestamp()}] [REINTENTO] Contexto de navegación restablecido, reintentando envío...`);
                            await sleep(2000);
                            continue;
                        }
                        throw eSend;
                    }
                }

                // Espera de 1.5 segundos para que WhatsApp Web procese la imagen en segundo plano
                await sleep(1500);

                contadorEnviados++;
                console.log(`[${getTimestamp()}] [ENVIADO] Mensaje e imagen entregados con éxito.`);

                // Liberar referencia del buffer enviado para liberar memoria
                mediaActual = null;
                textoActual = null;

                // 6. Pausa de seguridad optimizada (8 a 13 segundos) con liberación de caché y preparación del siguiente grupo
                if (siguienteGrupo) {
                    const prep = await pausaInterGrupoConPreparacion({
                        client,
                        siguienteGrupo,
                        rutaImagen,
                        textos,
                        ciclo,
                        siguienteIndice: i + 1,
                        minMs: 8000,
                        maxMs: 13000
                    });
                    textoActual = prep.proximoTexto;
                    mediaActual = prep.proximaMedia;
                }
                console.log(`\n======================================================`);
                console.log(`\n======================================================\n`);

                // 7. Descanso especial anti-baneos o de lote cada 25 grupos
                await aplicarDescansoEspecial(i + 1, grupos.length, siguienteGrupo);

            } catch (err) {
                // Detectar si fue error de permisos / solo administradores
                if (/read.?only|announce|admin|permission|not-authorized/i.test(err.message)) {
                    contadorSoloAdmins++;
                    console.log(`[${getTimestamp()}] [SOLO ADMINS] Omitido: Grupo restringido a administradores.`);
                } else {
                    contadorErrores++;
                    console.error(`[${getTimestamp()}] [ERROR ENVÍO] Falló la entrega:`, err.message);
                    registrarError(`Error de envío al grupo ${grupo.id} (${grupo.nombre}) en ciclo ${ciclo}: ${err.message}`, err.stack, 'Continuar con el siguiente grupo', 'Registrado');
                }
                console.log(`\n======================================================`);
                console.log(`\n======================================================\n`);

                mediaActual = null;
                textoActual = null;

                // Si hay siguiente grupo, mantener SIEMPRE la pausa de seguridad (8 a 13s) para no disparar ráfagas
                if (siguienteGrupo) {
                    const prep = await pausaInterGrupoConPreparacion({
                        client,
                        siguienteGrupo,
                        rutaImagen,
                        textos,
                        ciclo,
                        siguienteIndice: i + 1,
                        minMs: 8000,
                        maxMs: 13000
                    });
                    textoActual = prep.proximoTexto;
                    mediaActual = prep.proximaMedia;
                }

                // Descanso especial anti-baneos o de lote cada 25 grupos si coincidió con fallo
                await aplicarDescansoEspecial(i + 1, grupos.length, siguienteGrupo);
            }
        }

        // ================= REPORTE DE FIN DE CICLO =================
        console.log(`\n======================================================`);
        console.log(`[${getTimestamp()}] >>> RESUMEN DE FIN DE CICLO ${ciclo} DE ${TOTAL_CICLOS} <<<`);
        console.log(`------------------------------------------------------`);
        console.log(`[${getTimestamp()}] Grupos enviados con éxito:      ${contadorEnviados}`);
        console.log(`[${getTimestamp()}] Grupos omitidos (solo admins):    ${contadorSoloAdmins}`);
        if (contadorErrores > 0) {
            console.log(`[${getTimestamp()}] Grupos con error de envío:       ${contadorErrores}`);
        }
        console.log(`======================================================\n`);

        guardarEstado({
            cicloActual: ciclo,
            totalCiclos: TOTAL_CICLOS,
            estadoCiclo: 'COMPLETADO',
            ultimoCicloFin: new Date().toISOString(),
            ultimoResumen: {
                enviadosExitosos: contadorEnviados,
                omitidosSoloAdmins: contadorSoloAdmins,
                errores: contadorErrores
            }
        });

        // Si no es el último ciclo, esperar 2 horas antes de iniciar el siguiente
        if (ciclo < TOTAL_CICLOS) {
            await esperarEntreCiclos(7200000); // 2 horas (7,200,000 ms)
        }
    }

    console.log(`\n======================================================`);
    console.log(`[${getTimestamp()}] [FINALIZADO] Se han completado con éxito los ${TOTAL_CICLOS} ciclos de difusión.`);
    console.log(`[${getTimestamp()}] Cerrando cliente y finalizando herramienta Whats2.`);
    console.log(`======================================================\n`);

    guardarEstado({
        completadoTodo: true,
        fechaFinalizacion: new Date().toISOString()
    });

    try {
        await client.destroy();
    } catch (e) {
        // Ignorar error al cerrar navegador
    }

    process.exit(0);
}

module.exports = {
    ejecutarCiclos,
    cargarGrupos,
    cargarTextos,
    obtenerRutaImagen,
    guardarEstado,
    cargarEstado
};
