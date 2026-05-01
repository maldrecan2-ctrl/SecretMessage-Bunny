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

        // Mesaj gönderme ile ilgili tüm olası modülleri bul
        const modules = [
            metro.findByProps("sendMessage", "receiveMessage"),
            metro.findByProps("sendMessage", "sendBotMessage"),
            metro.findByProps("uploadFiles", "sendMessage")
        ];

        const doPatch = (m: any) => {
            if (!m || !m.sendMessage) return;
            
            patches.push(patcher.before("sendMessage", m, (args: any) => {
                // args[1] her zaman mesaj içeriğini barındıran yerdir
                let messageObj = args[1];
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
        };

        // Bulunan tüm modülleri aynı anda yamala
        modules.forEach(doPatch);

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
