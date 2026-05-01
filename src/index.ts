import { findByProps } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

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
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) str += "=";
        const binary = atob(str);
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
    if (!text.startsWith(X1)) return text;
    try {
        const encryptedPart = text.slice(X1.length);
        if (!encryptedPart) return text;
        return xorEncryptDecrypt(fromBase64Url(encryptedPart), X2);
    } catch {
        return text;
    }
}

const patches: any[] = [];

function handleMessage(event: any) {
    if (storage.autoDecrypt === false) return;
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
    if (storage.autoDecrypt === false) return;
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

export default {
    onLoad: () => {
        if (storage.autoDecrypt === undefined) storage.autoDecrypt = true;

        try {
            const Messages = findByProps("sendMessage", "receiveMessage");
            if (Messages) {
                patches.push(before("sendMessage", Messages, (args) => {
                    const content = args[1]?.content;
                    if (typeof content === "string" && content.startsWith("*")) {
                        args[1].content = encryptMessage(content.slice(1));
                    }
                }));
                patches.push(before("editMessage", Messages, (args) => {
                    const content = args[2]?.content;
                    if (typeof content === "string" && content.startsWith("*")) {
                        args[2].content = encryptMessage(content.slice(1));
                    }
                }));
            }

            FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessage);
            FluxDispatcher.subscribe("MESSAGE_UPDATE", handleMessage);
            FluxDispatcher.subscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
        } catch (e) {
            console.error("[SecretMessage] Error during onLoad:", e);
        }
    },

    onUnload: () => {
        for (const unpatch of patches) unpatch?.();
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessage);
        FluxDispatcher.unsubscribe("MESSAGE_UPDATE", handleMessage);
        FluxDispatcher.unsubscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
    }
};

