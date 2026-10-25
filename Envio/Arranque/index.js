const { createWhatsAppClient, getTimestamp } = require('./cliente');
const { esperarSincronizacionInicial } = require('../Sincronizacion/sincronizacion');
const { ejecutarCiclos } = require('../envio_a_grupos/ciclos');
const { registrarError } = require('../../documentacion_errores/logger');

console.log(`======================================================`);
console.log(`[${getTimestamp()}] [ARRANQUE] Inicializando Herramienta Whats2...`);
console.log(`[${getTimestamp()}] [INFO] Modo: Segundo plano (Headless) | Destino: Grupos masivos`);
console.log(`======================================================`);

// Instanciar cliente con sesión persistente en /Seccion compartida
const client = createWhatsAppClient({ clientId: 'whats2-session' });

// Bandera para evitar ejecuciones duplicadas del evento ready
let cicloIniciado = false;

client.on('ready', async () => {
    if (cicloIniciado) return;
    cicloIniciado = true;

    console.log(`\n[${getTimestamp()}] [CONECTADO] Sesión de WhatsApp Web iniciada correctamente.`);

    try {
        // Temporizador de 1 minuto (60,000 ms) antes de arrancar los envíos para sincronización
        await esperarSincronizacionInicial(60000);

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

// Manejo de errores no capturados
process.on('unhandledRejection', (reason) => {
    console.error(`[${getTimestamp()}] [UNHANDLED REJECTION]`, reason);
    registrarError(`Unhandled Rejection en index.js: ${reason}`, '', 'Verificar estado de conexión y módulos', 'Error');
});

process.on('uncaughtException', (err) => {
    console.error(`[${getTimestamp()}] [UNCAUGHT EXCEPTION]`, err.message);
    registrarError(`Uncaught Exception en index.js: ${err.message}`, err.stack, 'Revisar memoria o procesos Puppeteer', 'Crítico');
});

// Inicializar cliente
console.log(`[${getTimestamp()}] [INICIANDO NAVEGADOR] Cargando Chromium y WhatsApp Web...`);
client.initialize().catch(err => {
    console.error(`[${getTimestamp()}] [ERROR INICIALIZACIÓN CLIENTE]`, err.message);
    registrarError(`Fallo al inicializar cliente en index.js: ${err.message}`, err.stack, 'Verificar instalación de Puppeteer/Chromium', 'Crítico');
    process.exit(1);
});
