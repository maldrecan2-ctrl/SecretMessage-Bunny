// @ts-ignore
const v = (window as any).vendetta;

// ── Şifreleme Sabitleri ─────────────────────────────────────────────────────
const X1 = "krd";
const X2 = "1978";

function fromBase64Url(str: string): string {
    try {
        let s = str.replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        const binary = atob(s);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    } catch (e) { return ""; }
}

function xorEncryptDecrypt(text: string, key: string): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

function decryptMessage(text: string): string {
    if (!text || typeof text !== "string" || !text.startsWith(X1)) return text;
    try {
        const encryptedPart = text.slice(X1.length);
        return xorEncryptDecrypt(fromBase64Url(encryptedPart), X2);
    } catch { return text; }
}

// ── Mesaj Çözme Mantığı ─────────────────────────────────────────────────────
function processMessage(msg: any) {
    if (msg && typeof msg.content === "string" && msg.content.startsWith(X1)) {
        if (!msg.content.includes("\n-# (")) {
            const decrypted = decryptMessage(msg.content);
            if (decrypted !== msg.content) {
                msg.content = `${msg.content}\n-# (${decrypted})`;
            }
        }
    }
}

function handleMessageEvent(event: any) {
    const msg = event?.message || event?.msg;
    processMessage(msg);
}

function handleLoadMessages(event: any) {
    if (Array.isArray(event?.messages)) {
        event.messages.forEach(processMessage);
    }
}

const patches: any[] = [];

export default {
    onLoad: () => {
        try {
            if (!v || !v.metro) return;
            const { metro, plugin } = v;

            // Varsayılan ayar
            if (plugin.storage.autoDecrypt === undefined) plugin.storage.autoDecrypt = true;

            // 1. Yöntem: FluxDispatcher (Gelen mesaj anında)
            const FluxDispatcher = metro.common?.FluxDispatcher || metro.findByProps("dispatch", "subscribe");
            if (FluxDispatcher) {
                FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessageEvent);
                FluxDispatcher.subscribe("MESSAGE_UPDATE", handleMessageEvent);
                FluxDispatcher.subscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
                
                patches.push(() => {
                    FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessageEvent);
                    FluxDispatcher.unsubscribe("MESSAGE_UPDATE", handleMessageEvent);
                    FluxDispatcher.unsubscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
                });
            }

            // 2. Yöntem: MessageStore Yaması (Garantici yöntem)
            const MessageStore = metro.findByProps("getMessage", "getMessages");
            if (MessageStore && v.patcher) {
                patches.push(v.patcher.after("getMessage", MessageStore, (args: any, res: any) => {
                    if (res) processMessage(res);
                }));
            }
        } catch (e) {
            console.error("[SecretMessage] onLoad Error:", e);
        }
    },

    onUnload: () => {
        try {
            for (const unpatch of patches) {
                if (typeof unpatch === "function") unpatch();
            }
            patches.length = 0;
        } catch (e) {}
    },

    // Bunny ayarlar menüsü için toggle ekle
    settings: () => {
        return {
            autoDecrypt: {
                label: "Otomatik Çeviri",
                type: "toggle",
                default: true
            }
        };
    }
};
