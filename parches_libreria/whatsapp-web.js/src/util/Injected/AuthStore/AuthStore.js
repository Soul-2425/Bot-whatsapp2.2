'use strict';

exports.ExposeAuthStore = async () => {
    window.AuthStore = {};
    for (let i = 0; i < 40; i++) {
        try {
            if (window.require && window.require('WAWebSocketModel')?.Socket && window.require('WAWebConnModel')?.Conn) {
                break;
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 250));
    }

    const safeRequire = (name) => {
        try {
            return window.require ? window.require(name) : null;
        } catch (e) {
            return null;
        }
    };

    window.AuthStore.AppState = safeRequire('WAWebSocketModel')?.Socket;
    window.AuthStore.Cmd = safeRequire('WAWebCmd')?.Cmd;
    window.AuthStore.Conn = safeRequire('WAWebConnModel')?.Conn;
    window.AuthStore.OfflineMessageHandler = safeRequire('WAWebOfflineHandler')?.OfflineMessageHandler;
    window.AuthStore.PairingCodeLinkUtils = safeRequire('WAWebAltDeviceLinkingApi');
    window.AuthStore.Base64Tools = safeRequire('WABase64');
    window.AuthStore.RegistrationUtils = {
        ...(safeRequire('WAWebCompanionRegClientUtils') || {}),
        ...(safeRequire('WAWebAdvSignatureApi') || {}),
        ...(safeRequire('WAWebUserPrefsInfoStore') || {}),
        ...(safeRequire('WAWebSignalStoreApi') || {}),
    };
};
