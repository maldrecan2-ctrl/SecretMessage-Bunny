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
        if (!v) return;

        // Modülleri Bunny'nin içinden direkt al
        const { metro, patcher } = v;
        if (!metro || !patcher) return;

        const Messages = metro.findByProps("sendMessage", "receiveMessage");
        if (Messages) {
            patches.push(patcher.before("sendMessage", Messages, (args: any) => {
                const content = args[1]?.content || args[1];
                if (typeof content === "string" && content.startsWith("*")) {
                    if (typeof args[1] === "string") {
                        args[1] = encryptMessage(content.slice(1));
                    } else {
                        args[1].content = encryptMessage(content.slice(1));
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
        for (const unpatch of patches) unpatch();
        patches.length = 0;
    } catch (e) {}
};
