const { getTimestamp } = require('../Arranque/cliente');

/**
 * Realiza una pausa asíncrona de tiempo determinado
 * @param {number} ms Milisegundos a esperar
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Espera de sincronización de 1 minuto tras el evento 'ready'
 * @param {number} duracionMs Duración en ms (por defecto 60,000 ms)
 */
async function esperarSincronizacionInicial(duracionMs = 60000) {
    console.log(`\n======================================================`);
    const segTotales = Math.round(duracionMs / 1000);
    console.log(`[${getTimestamp()}] [SINCRONIZACIÓN] Cliente listo. Iniciando tiempo de estabilización (${segTotales}s)...`);
    console.log(`======================================================`);

    const intervalMs = 15000;
    let restante = duracionMs;

    while (restante > 0) {
        console.log(`[${getTimestamp()}] [SINCRONIZACIÓN] Tiempo restante de espera inicial: ${Math.round(restante / 1000)}s...`);
        const paso = Math.min(intervalMs, restante);
        await sleep(paso);
        restante -= paso;
    }

    console.log(`[${getTimestamp()}] [SINCRONIZACIÓN] Sincronización completada. Se iniciará el ciclo de envíos.\n`);
}

/**
 * Pausa aleatoria entre 15 y 25 segundos entre cada mensaje individual
 * para mitigar detección por spam y proteger la cuenta.
 * @param {number} minMs Mínimo de milisegundos (default 15000)
 * @param {number} maxMs Máximo de milisegundos (default 25000)
 * @returns {Promise<number>} Tiempo esperado en milisegundos
 */
async function esperarEntreMensajes(minMs = 8000, maxMs = 13000) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    console.log(`[${getTimestamp()}] [PAUSA DE SEGURIDAD] Esperando ${Math.round(delay / 1000)}s antes del siguiente grupo...`);
    await sleep(delay);
    return delay;
}

/**
 * Espera de descanso programado entre ciclos consecutivos (por defecto 2 horas = 7,200,000 ms).
 * Informa el progreso activamente en la consola y envía pings ligeros de keep-alive para que Chromium
 * no suspenda el proceso ni pierda la conexión con WhatsApp Web.
 * @param {number} duracionMs Duración en ms (default: 2 horas = 7200000)
 * @param {Object|null} client Instancia del cliente para mantener el socket activo
 */
async function esperarEntreCiclos(duracionMs = 7200000, client = null) {
    const horasTotales = (duracionMs / (3600 * 1000)).toFixed(1);
    console.log(`\n======================================================`);
    console.log(`[${getTimestamp()}] [PAUSA ENTRE CICLOS] Pausa de descanso programada de ${horasTotales}h para proteger la cuenta.`);
    console.log(`[${getTimestamp()}] WhatsApp Web se mantendrá sincronizado y activo en segundo plano.`);
    console.log(`======================================================`);

    const intervalMs = 60 * 1000; // Paso de 1 minuto
    let restante = duracionMs;
    let ultimoReporteMinutos = -1;

    while (restante > 0) {
        const horas = Math.floor(restante / (3600 * 1000));
        const minutos = Math.floor((restante % (3600 * 1000)) / 60000);

        // Reportar en consola cada 5 minutos o cuando resten menos de 5 minutos
        if ((minutos % 5 === 0 && minutos !== ultimoReporteMinutos) || restante <= 300000) {
            console.log(`[${getTimestamp()}] [EN ESPERA] Tiempo restante para el próximo ciclo: ${horas}h ${minutos}m.`);
            ultimoReporteMinutos = minutos;
        }

        // Mantener viva la sesión en Chromium enviando un ping liviano cada minuto
        if (client && client.pupPage) {
            try {
                await Promise.race([
                    client.pupPage.evaluate(() => Boolean(window.WWebJS)),
                    new Promise(r => setTimeout(r, 2000))
                ]);
            } catch (ePing) {}
        }

        const paso = Math.min(intervalMs, restante);
        await sleep(paso);
        restante -= paso;
    }

    console.log(`\n[${getTimestamp()}] [REANUDANDO] Fin de la pausa de enfriamiento. Iniciando siguiente ciclo.\n`);
}

module.exports = {
    sleep,
    esperarSincronizacionInicial,
    esperarEntreMensajes,
    esperarEntreCiclos
};
