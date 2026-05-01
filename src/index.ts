// @ts-ignore
const v = (window as any).vendetta || (window as any).bunny;

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

// ── Mesaj Çözme Mantığı (Klonlama Yöntemi) ──────────────────────────────────
function processMessage(msg: any): any {
    if (msg && typeof msg.content === "string" && msg.content.startsWith(X1)) {
        if (!msg.content.includes("\n-# (")) {
            const decrypted = decryptMessage(msg.content);
            if (decrypted !== msg.content) {
                // Orijinal mesajı kopyala (klonla) ve içeriğini değiştir
                return Object.assign({}, msg, {
                    content: `${msg.content}\n-# (${decrypted})`
                });
            }
        }
    }
    return msg; // Değişiklik yoksa orijinali dön
}

const patches: any[] = [];

export default {
    onLoad: () => {
        try {
            if (!v || !v.metro || !v.patcher) return;
            const { metro, patcher } = v;

            // 1. YÖNTEM: Mesajlar cihaza inerken (receiveMessage) yakala
            const Messages = metro.findByProps("receiveMessage");
            if (Messages && Messages.receiveMessage) {
                patches.push(patcher.before("receiveMessage", Messages, (args: any) => {
                    // args[0] = channelId, args[1] = message object
                    if (args && args[1]) {
                        args[1] = processMessage(args[1]);
                    }
                }));
            }

            // 2. YÖNTEM: Dispatcher Yakalama (Garantici yöntem)
            const FluxDispatcher = metro.common?.FluxDispatcher || metro.findByProps("dispatch", "subscribe");
            if (FluxDispatcher && FluxDispatcher.dispatch) {
                // Dispatch fonksiyonunu yamala (tüm Discord olayları buradan geçer)
                patches.push(patcher.before("dispatch", FluxDispatcher, (args: any) => {
                    const event = args[0];
                    if (!event) return;

                    if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE") {
                        if (event.message) {
                            event.message = processMessage(event.message);
                        }
                    } else if (event.type === "LOAD_MESSAGES_SUCCESS") {
                        if (Array.isArray(event.messages)) {
                            for (let i = 0; i < event.messages.length; i++) {
                                event.messages[i] = processMessage(event.messages[i]);
                            }
                        }
                    }
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
    }
};
