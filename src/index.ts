// @ts-ignore
const v = (window as any).vendetta;

// ── Şifreleme Fonksiyonları ────────────────────────────────────────────────
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

const patches: any[] = [];

export const onLoad = () => {
    try {
        if (!v || !v.metro || !v.patcher) return;
        const { metro, patcher } = v;

        // Mesaj gönderme fonksiyonlarını bul
        const Messages = metro.findByProps("sendMessage", "receiveMessage");
        
        if (Messages && Messages.sendMessage) {
            patches.push(patcher.before("sendMessage", Messages, (args: any) => {
                // args[1] genellikle mesaj objesidir
                if (args[1] && typeof args[1].content === "string") {
                    if (args[1].content.startsWith("*")) {
                        args[1].content = encryptMessage(args[1].content.slice(1));
                    }
                } else if (typeof args[1] === "string") {
                    // Bazı sürümlerde direkt string olarak gelebilir
                    if (args[1].startsWith("*")) {
                        args[1] = encryptMessage(args[1].slice(1));
                    }
                }
            }));
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
