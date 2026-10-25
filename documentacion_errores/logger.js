const fs = require('fs');
const path = require('path');

const LOG_FILE = path.resolve(__dirname, 'Documentacion_de_errores.md');

/**
 * Registra un error de manera formateada en Documentacion_de_errores.md
 * @param {string} errorDescripcion Descripción del error
 * @param {string} causa Causa probable
 * @param {string} solucion Solución o acción tomada
 * @param {string} estado Estado de la resolución (e.g., "Registrado", "Mitigado", "Resuelto")
 */
function registrarError(errorDescripcion, causa = 'Inesperada', solucion = 'Manejado por try/catch', estado = 'Mitigado') {
    const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sanitizedError = String(errorDescripcion).replace(/\|/g, '-').replace(/\r?\n|\r/g, ' ');
    const sanitizedCausa = String(causa).replace(/\|/g, '-').replace(/\r?\n|\r/g, ' ');
    const sanitizedSolucion = String(solucion).replace(/\|/g, '-').replace(/\r?\n|\r/g, ' ');

    const row = `| ${fechaHora} | ${sanitizedError} | ${sanitizedCausa} | ${sanitizedSolucion} | ${estado} |\n`;

    try {
        fs.appendFileSync(LOG_FILE, row, 'utf8');
    } catch (err) {
        console.error(`[${fechaHora}] [ERROR LOGGER] No se pudo escribir en Documentacion_de_errores.md:`, err.message);
    }
}

module.exports = {
    registrarError
};
