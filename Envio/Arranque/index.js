const { createWhatsAppClient, getTimestamp } = require('./cliente');
const { esperarSincronizacionInicial } = require('../Sincronizacion/sincronizacion');
const { ejecutarCiclos } = require('../envio_a_grupos/ciclos');
const { registrarError } = require('../../documentacion_errores/logger');

// Manejo defensivo de errores no capturados
process.on('unhandledRejection', (reason) => {
    console.error(`[${getTimestamp()}] [UNHANDLED REJECTION]`, reason);
    registrarError(`Unhandled Rejection en index.js: ${reason}`, '', 'Verificar estado de conexión y módulos', 'Error');
});

process.on('uncaughtException', (err) => {
    console.error(`[${getTimestamp()}] [UNCAUGHT EXCEPTION]`, err.message);
    registrarError(`Uncaught Exception en index.js: ${err.message}`, err.stack, 'Revisar memoria o procesos Puppeteer', 'Crítico');
});

/**
 * Inicia el cliente de WhatsApp con sistema de auto-recuperación ante recargas de página
 */
async function iniciarSistema() {
    console.log(`======================================================`);
    console.log(`[${getTimestamp()}] [ARRANQUE] Inicializando Herramienta Whats2...`);
    console.log(`[${getTimestamp()}] [INFO] Modo: Segundo plano (Headless) | Destino: Grupos masivos`);
    console.log(`======================================================`);

    const maxIntentos = 3;

    for (let intento = 1; intento <= maxIntentos; intento++) {
        let client = null;
        let cicloIniciado = false;

        try {
            client = createWhatsAppClient({ clientId: 'whats2-session' });

            client.on('ready', async () => {
                if (cicloIniciado) return;
                cicloIniciado = true;

                console.log(`\n[${getTimestamp()}] [CONECTADO] Sesión de WhatsApp Web iniciada correctamente.`);

                try {
                    // Espera de sincronización de 20 segundos
                    await esperarSincronizacionInicial(20000);

                    // Iniciar los ciclos de envío
                    await ejecutarCiclos(client);

                } catch (error) {
                    console.error(`\n[${getTimestamp()}] [ERROR CRÍTICO EN CICLOS]`, error.message);
                    registrarError(`Fallo durante ejecución de ciclos: ${error.message}`, error.stack, 'Revisar grupos.txt, img/ y textos/', 'Crítico');
                    try {
                        await client.destroy();
                    } catch (e) {}
                    process.exit(1);
                }
            });

            console.log(`[${getTimestamp()}] [INICIANDO NAVEGADOR] Cargando Chromium y WhatsApp Web (Intento ${intento}/${maxIntentos})...`);
            await client.initialize();
            break; // Inicialización exitosa

        } catch (err) {
            console.warn(`\n[${getTimestamp()}] [AVISO ARRANQUE] ${err.message}`);
            if (client) {
                try { await client.destroy(); } catch (e) {}
            }

            if (intento < maxIntentos) {
                console.log(`[${getTimestamp()}] [RECUPERACIÓN] Reintentando arranque limpio de WhatsApp Web (Intento ${intento + 1}/${maxIntentos}) en 4 segundos...\n`);
                await new Promise(r => setTimeout(r, 4000));
                continue;
            }

            console.error(`\n[${getTimestamp()}] [ERROR INICIALIZACIÓN CLIENTE]`, err.message);
            registrarError(`Fallo al inicializar cliente en index.js: ${err.message}`, err.stack, 'Verificar instalación de Puppeteer/Chromium', 'Crítico');
            process.exit(1);
        }
    }
}

iniciarSistema();
