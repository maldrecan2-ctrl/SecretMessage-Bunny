import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";

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
        // En yaygın mesaj gönderme modülleri
        const Messages = findByProps("sendMessage", "receiveMessage");
        const MessageActions = findByProps("sendBotMessage", "sendMessage");
        
        const patchSendMessage = (module: any) => {
            if (module) {
                patches.push(before("sendMessage", module, (args) => {
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
        };

        patchSendMessage(Messages);
        patchSendMessage(MessageActions);

    } catch (e) {
        console.error("[SecretMessage] onLoad Error:", e);
    }
};

export const onUnload = () => {
    try {
        for (const unpatch of patches) unpatch?.();
        patches.length = 0;
    } catch (e) {}
};
