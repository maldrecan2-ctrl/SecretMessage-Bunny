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

        // Mesaj içeriğini şifreleyen yardımcı fonksiyon
        const processArgs = (args: any) => {
            for (let i = 0; i < args.length; i++) {
                let obj = args[i];
                if (obj && typeof obj.content === "string" && obj.content.startsWith("*")) {
                    obj.content = encryptMessage(obj.content.slice(1));
                    return;
                }
                if (typeof obj === "string" && obj.startsWith("*")) {
                    args[i] = encryptMessage(obj.slice(1));
                    return;
                }
            }
        };

        // 1. Standart Mesaj Gönderme Modülleri
        const msgModules = [
            metro.findByProps("sendMessage"),
            metro.findByProps("editMessage"),
            metro.findByProps("enqueue")
        ];

        msgModules.forEach(m => {
            if (!m) return;
            // Hem ana modülü hem de default exportu kontrol et
            const targets = [m, m.default].filter(t => t);
            
            targets.forEach(t => {
                if (t.sendMessage) patches.push(patcher.before("sendMessage", t, processArgs));
                if (t.editMessage) patches.push(patcher.before("editMessage", t, processArgs));
                if (t.enqueue) patches.push(patcher.before("enqueue", t, processArgs));
            });
        });

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
