// @ts-ignore
const v = (window as any).vendetta;

// ── Şifreleme Sabitleri ─────────────────────────────────────────────────────
const X1 = "krd";
const X2 = "1978";

function toBase64Url(str: string): string {
    try {
        const bytes = new TextEncoder().encode(str);
        let binary = "";
        bytes.forEach(b => (binary += String.fromCharCode(b)));
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    } catch (e) { return ""; }
}

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

function encryptMessage(text: string): string {
    return X1 + toBase64Url(xorEncryptDecrypt(text, X2));
}

function decryptMessage(text: string): string {
    if (!text || typeof text !== "string" || !text.startsWith(X1)) return text;
    try {
        const encryptedPart = text.slice(X1.length);
        return xorEncryptDecrypt(fromBase64Url(encryptedPart), X2);
    } catch { return text; }
}

const patches: any[] = [];

// ── Mesaj Çözme Mantığı ─────────────────────────────────────────────────────
function handleMessage(event: any) {
    const msg = event?.message;
    if (msg && typeof msg.content === "string" && msg.content.startsWith(X1)) {
        if (!msg.content.includes("\n-# (")) {
            const decrypted = decryptMessage(msg.content);
            if (decrypted !== msg.content) {
                msg.content = `${msg.content}\n-# (${decrypted})`;
            }
        }
    }
}

function handleLoadMessages(event: any) {
    if (Array.isArray(event?.messages)) {
        event.messages.forEach((m: any) => {
            if (m && typeof m.content === "string" && m.content.startsWith(X1)) {
                if (!m.content.includes("\n-# (")) {
                    const decrypted = decryptMessage(m.content);
                    if (decrypted !== m.content) {
                        m.content = `${m.content}\n-# (${decrypted})`;
                    }
                }
            }
        });
    }
}

export const onLoad = () => {
    try {
        if (!v) return;
        const { metro, patcher } = v;
        if (!metro || !patcher) return;

        // ── MESAJ GÖNDERME YAMALARI (AĞ ATMA) ──
        const sendMessageProps = ["sendMessage", "receiveMessage", "sendBotMessage", "sendClydeError"];
        
        // Olası tüm mesaj modüllerini bul ve yamala
        const modules = [
            metro.findByProps("sendMessage", "receiveMessage"),
            metro.findByProps("sendMessage", "sendBotMessage"),
            metro.findByProps("sendMessage", "editMessage")
        ];

        modules.forEach(m => {
            if (m && m.sendMessage) {
                patches.push(patcher.before("sendMessage", m, (args: any) => {
                    const messageObj = args[1];
                    if (!messageObj) return;

                    const content = typeof messageObj === "string" ? messageObj : messageObj.content;
                    if (typeof content === "string" && content.startsWith("*")) {
                        const encrypted = encryptMessage(content.slice(1));
                        if (typeof messageObj === "string") {
                            args[1] = encrypted;
                        } else {
                            messageObj.content = encrypted;
                        }
                    }
                }));
            }
        });

        // ── MESAJ ÇÖZME YAMALARI ──
        const FluxDispatcher = metro.findByProps("dispatch", "subscribe");
        if (FluxDispatcher) {
            FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessage);
            FluxDispatcher.subscribe("MESSAGE_UPDATE", handleMessage);
            FluxDispatcher.subscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
            
            patches.push(() => {
                FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessage);
                FluxDispatcher.unsubscribe("MESSAGE_UPDATE", handleMessage);
                FluxDispatcher.unsubscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
            });
        }

    } catch (e) {
        console.error("[SecretMessage] Error:", e);
    }
};

export const onUnload = () => {
    try {
        for (const unpatch of patches) {
            if (typeof unpatch === "function") unpatch();
        }
        patches.length = 0;
    } catch (e) {}
};
