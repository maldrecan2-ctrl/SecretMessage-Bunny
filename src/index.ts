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

const patches: any[] = [];

function mutateRawMessage(payload: any) {
    if (payload && typeof payload.content === "string" && payload.content.startsWith(X1)) {
        if (!payload.content.includes("\n-# (")) {
            const decrypted = decryptMessage(payload.content);
            if (decrypted !== payload.content) {
                // Burada payload henüz kilitli değildir, güvenle değiştirebiliriz
                payload.content = `${payload.content}\n-# (${decrypted})`;
            }
        }
    }
}

export default {
    onLoad: () => {
        try {
            if (!v || !v.metro || !v.patcher) return;
            const { metro, patcher } = v;

            // 1. YÖNTEM: Mesajın ilk yaratılış anı (MessageRecord Creation)
            const MessageRecordUtils = metro.findByProps("updateMessageRecord", "createMessageRecord");
            if (MessageRecordUtils) {
                if (MessageRecordUtils.createMessageRecord) {
                    patches.push(patcher.before("createMessageRecord", MessageRecordUtils, (args: any) => {
                        // args[0] mesajın ham JSON (API) verisidir
                        if (args && args[0]) mutateRawMessage(args[0]);
                    }));
                }
                
                if (MessageRecordUtils.updateMessageRecord) {
                    patches.push(patcher.before("updateMessageRecord", MessageRecordUtils, (args: any) => {
                        // args[1] genelde yeni payload objesidir
                        if (args && args[1]) mutateRawMessage(args[1]);
                        if (args && args[0]) mutateRawMessage(args[0]);
                    }));
                }
            }

            // 2. YÖNTEM: Store'dan direkt çekilirken (getMessage) kilitli olsa bile klonlayarak aşma
            const MessageStore = metro.findByProps("getMessage", "getMessages");
            if (MessageStore) {
                patches.push(patcher.after("getMessage", MessageStore, (args: any, res: any) => {
                    if (res && typeof res.content === "string" && res.content.startsWith(X1)) {
                        if (!res.content.includes("\n-# (")) {
                            const decrypted = decryptMessage(res.content);
                            if (decrypted !== res.content) {
                                // Objeyi klonla ki "kilitli (frozen)" hatasına takılmayalım
                                return Object.assign({}, res, {
                                    content: `${res.content}\n-# (${decrypted})`
                                });
                            }
                        }
                    }
                    return res;
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
