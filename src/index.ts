import { findByProps } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

// ── Şifreleme Sabitleri (Vencord ile aynı) ──────────────────────────────────
const X1 = "krd";
const X2 = "1978";

function toBase64Url(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(str: string): string {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
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
        return xorEncryptDecrypt(fromBase64Url(text.slice(X1.length)), X2);
    } catch {
        return text;
    }
}

// ── Yama dizisi ─────────────────────────────────────────────────────────────
const patches: (() => void)[] = [];

// ── Gelen mesajları işle ────────────────────────────────────────────────────
function handleMessage(event: any) {
    if (!storage.autoDecrypt) return;
    const msg = event?.message;
    if (msg && typeof msg.content === "string") {
        if (!msg.content.includes("\n-# (")) {
            const decrypted = decryptMessage(msg.content);
            if (decrypted !== msg.content) {
                msg.content = `${msg.content}\n-# (${decrypted})`;
            }
        }
    }
}

function handleLoadMessages(event: any) {
    if (!storage.autoDecrypt) return;
    if (Array.isArray(event?.messages)) {
        event.messages.forEach((m: any) => {
            if (m && typeof m.content === "string") {
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

// ── Plugin giriş noktası ────────────────────────────────────────────────────
export default {
    onLoad() {
        // Varsayılan ayar
        if (storage.autoDecrypt === undefined) storage.autoDecrypt = true;

        // Gönderilen mesajlara şifreleme (başında * varsa)
        const Messages = findByProps("sendMessage", "receiveMessage");
        if (Messages) {
            patches.push(
                before("sendMessage", Messages, (args: any[]) => {
                    if (args[1] && typeof args[1].content === "string") {
                        if (args[1].content.startsWith("*")) {
                            args[1].content = encryptMessage(args[1].content.slice(1));
                        }
                    }
                })
            );
            patches.push(
                before("editMessage", Messages, (args: any[]) => {
                    if (args[2] && typeof args[2].content === "string") {
                        if (args[2].content.startsWith("*")) {
                            args[2].content = encryptMessage(args[2].content.slice(1));
                        }
                    }
                })
            );
        }

        // Gelen mesajları çözme (FluxDispatcher)
        FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessage);
        FluxDispatcher.subscribe("MESSAGE_UPDATE", handleMessage);
        FluxDispatcher.subscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
    },

    onUnload() {
        patches.forEach(p => p());
        patches.length = 0;
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessage);
        FluxDispatcher.unsubscribe("MESSAGE_UPDATE", handleMessage);
        FluxDispatcher.unsubscribe("LOAD_MESSAGES_SUCCESS", handleLoadMessages);
    },

    settings: {
        autoDecrypt: {
            label: "Gelen Mesajları Otomatik Çevir",
            description: 'Açık olduğunda "krd" ile başlayan mesajlar otomatik çevrilir.',
            type: "toggle",
            default: true,
        },
    },
};
