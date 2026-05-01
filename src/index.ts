import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";

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
        // Mesaj Gönderme Yaması
        const Messages = findByProps("sendMessage", "receiveMessage");
        if (Messages) {
            patches.push(before("sendMessage", Messages, (args) => {
                const content = args[1]?.content;
                if (typeof content === "string" && content.startsWith("*")) {
                    args[1].content = encryptMessage(content.slice(1));
                }
            }));
        }
    } catch (e) {
        console.error("[SecretMessage] onLoad Error:", e);
    }
};

export const onUnload = () => {
    try {
        for (const unpatch of patches) unpatch?.();
    } catch (e) {}
};
