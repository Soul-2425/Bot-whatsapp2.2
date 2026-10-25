const fs = require('fs');
const path = require('path');
const { createWhatsAppClient, getTimestamp } = require('../Envio/Arranque/cliente');
const { registrarError } = require('../documentacion_errores/logger');

const OUTPUT_FILE = path.resolve(__dirname, '../grupos.txt');

console.log(`======================================================`);
console.log(`[${getTimestamp()}] [EXTRACTOR] Iniciando módulo de extracción de grupos...`);
console.log(`======================================================`);

// Usar el mismo clientId para compartir la sesión con el módulo de envío
const client = createWhatsAppClient({ clientId: 'whats2-session' });

/**
 * Función auxiliar para pausar la ejecución
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extrae los grupos de manera ultra-resiliente directamente de la memoria de WhatsApp Web
 * evitando el error minificado 'r' de getChats().
 */
async function extraerGruposResiliente(client) {
    // 1. Intentar extracción directa desde la colección interna de chats (rápida y sin fallos de metadatos)
    try {
        const gruposDirectos = await client.pupPage.evaluate(() => {
            try {
                let chats = [];
                if (window.require) {
                    const Collections = window.require('WAWebCollections');
                    if (Collections && Collections.Chat) {
                        chats = Collections.Chat.getModelsArray() || [];
                    }
                }
                if ((!chats || chats.length === 0) && window.Store && window.Store.Chat) {
                    chats = window.Store.Chat.getModelsArray ? window.Store.Chat.getModelsArray() : (window.Store.Chat.models || []);
                }

                if (!chats || chats.length === 0) return null;

                return chats
                    .filter(chat => {
                        const idStr = chat.id && (chat.id._serialized || chat.id._serialized === 0 ? chat.id._serialized : String(chat.id));
                        return chat.isGroup || (typeof idStr === 'string' && idStr.endsWith('@g.us'));
                    })
                    .map(chat => {
                        const id = (chat.id && (chat.id._serialized || chat.id)) || '';
                        const nombre = chat.formattedTitle || chat.name || (chat.contact && chat.contact.name) || 'Sin Nombre';
                        return { id: String(id), nombre: String(nombre).trim() };
                    })
                    .filter(g => g.id.length > 0);
            } catch (e) {
                return null;
            }
        });

        if (gruposDirectos && Array.isArray(gruposDirectos) && gruposDirectos.length > 0) {
            return gruposDirectos;
        }
    } catch (err) {
        console.warn(`[${getTimestamp()}] [DEBUG] Extracción directa en memoria no disponible aún, intentando método de API...`);
    }

    // 2. Método alternativo mediante client.getChats() con protección
    try {
        const chats = await client.getChats();
        const groupChats = chats.filter(chat => chat.isGroup || (chat.id && chat.id._serialized && chat.id._serialized.endsWith('@g.us')));
        return groupChats.map(group => ({
            id: group.id._serialized || group.id,
            nombre: (group.name || group.formattedTitle || 'Sin Nombre').trim()
        }));
    } catch (apiErr) {
        throw new Error(`WhatsApp Web aún está sincronizando los chats: ${apiErr.message}`);
    }
}

client.on('ready', async () => {
    console.log(`\n[${getTimestamp()}] [CONECTADO] Sesión validada con éxito.`);
    console.log(`[${getTimestamp()}] [SINCRONIZANDO] Esperando 8 segundos para que WhatsApp termine de indexar la lista de chats...`);
    
    // Pausa indispensable para permitir que WhatsApp termine de cargar sus colecciones internas
    await sleep(8000);

    const maxIntentos = 4;
    let grupos = [];
    let obtenido = false;

    for (let intento = 1; intento <= maxIntentos; intento++) {
        console.log(`[${getTimestamp()}] [EXTRAYENDO] Intento ${intento} de ${maxIntentos}: Obteniendo lista de grupos...`);

        try {
            grupos = await extraerGruposResiliente(client);
            if (grupos && grupos.length > 0) {
                obtenido = true;
                break;
            } else {
                console.log(`[${getTimestamp()}] [ESPERANDO] Lista de chats vacía o en sincronización. Reintentando en 5 segundos...`);
                await sleep(5000);
            }
        } catch (error) {
            console.warn(`[${getTimestamp()}] [AVISO] Intento ${intento} no completado (${error.message}). Reintentando en 5s...`);
            if (intento < maxIntentos) {
                await sleep(5000);
            }
        }
    }

    try {
        if (!obtenido || grupos.length === 0) {
            console.warn(`\n[${getTimestamp()}] [AVISO] No se encontraron grupos asociados o la sincronización tardó demasiado.`);
            console.log(`[${getTimestamp()}] Puedes volver a ejecutar Extractor.bat o agregar tus grupos manualmente en grupos.txt.`);
        } else {
            console.log(`[${getTimestamp()}] [INFO] Grupos identificados con éxito: ${grupos.length}`);

            // Formatear líneas: [ID del Grupo] | [Nombre del Grupo]
            const lineas = grupos.map(g => `${g.id} | ${g.nombre}`);

            // Guardar o sobrescribir grupos.txt
            fs.writeFileSync(OUTPUT_FILE, lineas.join('\n'), 'utf8');

            console.log(`\n======================================================`);
            console.log(`[${getTimestamp()}] [ÉXITO] Se han extraído y guardado ${grupos.length} grupos en:`);
            console.log(`=> ${OUTPUT_FILE}`);
            console.log(`======================================================\n`);
        }
    } catch (writeErr) {
        console.error(`[${getTimestamp()}] [ERROR] Error al escribir grupos.txt:`, writeErr.message);
        registrarError(`Error al escribir grupos.txt: ${writeErr.message}`, writeErr.stack, 'Revisar permisos de disco', 'Error');
    } finally {
        console.log(`[${getTimestamp()}] [FINALIZANDO] Cerrando sesión del extractor...`);
        try {
            await client.destroy();
        } catch (e) {}
        console.log(`[${getTimestamp()}] Proceso completado. Cerrando.`);
        process.exit(0);
    }
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason) => {
    console.error(`[${getTimestamp()}] [ERROR NO CAPTURADO]`, reason);
    registrarError(`UnhandledRejection en Extractor: ${reason}`, '', 'Revisar conexión a WhatsApp', 'Error');
});

// Inicializar cliente
client.initialize().catch(err => {
    console.error(`[${getTimestamp()}] [ERROR INICIALIZACIÓN]`, err.message);
    registrarError(`Error al inicializar cliente en Extractor: ${err.message}`, err.stack, 'Verificar instalación de Puppeteer', 'Crítico');
    process.exit(1);
});
