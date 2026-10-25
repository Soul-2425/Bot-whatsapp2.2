const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Ruta fija para almacenar los datos de sesión
const SESSION_PATH = path.resolve(__dirname, '../../Seccion');

/**
 * Función para obtener la marca de tiempo formateada [HH:MM:SS]
 */
function getTimestamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * Crea y configura la instancia del cliente WhatsApp
 * @param {Object} options Opciones adicionales
 * @returns {Client} Instancia del cliente WhatsApp Web
 */
function createWhatsAppClient(options = {}) {
    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_PATH,
            clientId: options.clientId || 'whats2-session'
        }),
        userAgent: USER_AGENT,
        puppeteer: {
            headless: true, // Ejecución en segundo plano sin ventana gráfica
            protocolTimeout: 0, // Deshabilita el timeout de protocolo para evitar cortes prematuros
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                `--user-agent=${USER_AGENT}`
            ]
        },
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0
    });

    // Evento de generación de código QR
    client.on('qr', (qr) => {
        console.log(`\n======================================================`);
        console.log(`[${getTimestamp()}] [AUTENTICACIÓN] Por favor escanea el siguiente código QR con tu WhatsApp:`);
        console.log(`======================================================\n`);
        qrcode.generate(qr, { small: true });
        console.log(`\n[${getTimestamp()}] Esperando escaneo desde tu dispositivo...\n`);
    });

    // Evento de autenticación exitosa
    client.on('authenticated', () => {
        console.log(`[${getTimestamp()}] [SESIÓN] Autenticación validada con éxito. Sesión guardada en /Seccion.`);
    });

    // Evento de fallo en autenticación
    client.on('auth_failure', (msg) => {
        console.error(`[${getTimestamp()}] [ERROR] Fallo de autenticación:`, msg);
    });

    // Evento de desconexión
    client.on('disconnected', (reason) => {
        console.warn(`[${getTimestamp()}] [DESCONECTADO] El cliente de WhatsApp se desconectó:`, reason);
    });

    return client;
}

module.exports = {
    createWhatsAppClient,
    SESSION_PATH,
    getTimestamp
};
