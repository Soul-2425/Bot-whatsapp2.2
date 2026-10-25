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
    console.log(`[${getTimestamp()}] [SINCRONIZACIÓN] Cliente listo. Iniciando tiempo de estabilización (1 minuto)...`);
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
 * Espera de 2 horas (7,200,000 ms) entre ciclos consecutivos
 * Informa el progreso periódicamente en la consola.
 * @param {number} duracionMs Duración en ms (default: 2 horas = 7200000)
 */
async function esperarEntreCiclos(duracionMs = 7200000) {
    console.log(`\n======================================================`);
    console.log(`[${getTimestamp()}] [PAUSA ENTRE CICLOS] Esperando 2 horas para el siguiente ciclo...`);
    console.log(`======================================================`);

    const intervalMs = 15 * 60 * 1000; // Informar cada 15 minutos
    let restante = duracionMs;

    while (restante > 0) {
        const horas = Math.floor(restante / (3600 * 1000));
        const minutos = Math.floor((restante % (3600 * 1000)) / 60000);
        console.log(`[${getTimestamp()}] [EN ESPERA] Tiempo restante para el próximo ciclo: ${horas}h ${minutos}m.`);
        const paso = Math.min(intervalMs, restante);
        await sleep(paso);
        restante -= paso;
    }

    console.log(`[${getTimestamp()}] [REANUDANDO] Fin de la pausa. Iniciando siguiente ciclo.\n`);
}

module.exports = {
    sleep,
    esperarSincronizacionInicial,
    esperarEntreMensajes,
    esperarEntreCiclos
};
