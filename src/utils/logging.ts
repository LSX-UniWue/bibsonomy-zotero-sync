export { logInfo, logError, logProgress };

function logError(error: any, context: string = '') {
    ztoolkit.log(`Error ${context}: ${error}`);
    if (error.stack) ztoolkit.log(error.stack);
    throw new Error(`Error ${context}: ${error}`);
}

function logProgress(message: string, detail: string = '') {
    ztoolkit.log(`${message} ${detail}`);
}

function logInfo(message: string) {
    ztoolkit.log(message);
}