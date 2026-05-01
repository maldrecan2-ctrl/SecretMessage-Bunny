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
                try {
                    // Mesaj kilitli (frozen) ise hata fırlatabilir, try-catch içinde yapıyoruz
                    msg.content = `${msg.content}\n-# (${decrypted})`;
                } catch (e) {
                    // Eğer kilitliyse yeni bir içerik objesi atamaya çalış (nadiren çalışır ama güvenlidir)
                    console.error("[SecretMessage] Mesaj kilitli, çözülemedi:", e);
                }
            }
        }
    }
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
                    // args[0] channelId, args[1] message object
                    if (args && args[1]) {
                        processMessage(args[1]);
                    }
                }));
            }

            // 2. YÖNTEM: FluxDispatcher (Geçmiş mesajlar ve alternatif yakalama)
            const FluxDispatcher = metro.common?.FluxDispatcher || metro.findByProps("dispatch", "subscribe");
            if (FluxDispatcher) {
                const handleMessage = (event: any) => processMessage(event?.message || event?.msg);
                const handleLoad = (event: any) => {
                    if (Array.isArray(event?.messages)) event.messages.forEach(processMessage);
                };

                FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessage);
                FluxDispatcher.subscribe("MESSAGE_UPDATE", handleMessage);
                FluxDispatcher.subscribe("LOAD_MESSAGES_SUCCESS", handleLoad);
                
                patches.push(() => {
                    FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessage);
                    FluxDispatcher.unsubscribe("MESSAGE_UPDATE", handleMessage);
                    FluxDispatcher.unsubscribe("LOAD_MESSAGES_SUCCESS", handleLoad);
                });
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
