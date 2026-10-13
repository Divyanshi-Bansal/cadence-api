"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");

const targetUrl = process.env.CADENCE_MCP_URL || "http://localhost:8080/api/mcp/sse";

async function main() {
    const API_KEY = process.env.CADENCE_API_KEY;
    if (!API_KEY) {
        console.error("Missing CADENCE_API_KEY environment variable");
        process.exit(1);
    }
    
    const stdioTransport = new stdio_js_1.StdioServerTransport();
    let currentSseTransport = null;
    let isConnecting = false;
    const messageQueue = [];

    async function connectSSE(retryCount = 0) {
        if (isConnecting) return;
        isConnecting = true;

        try {
            if (currentSseTransport) {
                try {
                    await currentSseTransport.close();
                } catch (_) {}
                currentSseTransport = null;
            }

            const sseTransport = new sse_js_1.SSEClientTransport(new URL(targetUrl), {
                eventSourceInit: {
                    headers: { Authorization: `Bearer ${API_KEY}` },
                },
                requestInit: {
                    headers: { Authorization: `Bearer ${API_KEY}` },
                },
            });

            sseTransport.onmessage = async (message) => {
                try {
                    await stdioTransport.send(message);
                } catch (err) {
                    console.error("[Bridge] Failed to forward message to stdio:", err);
                }
            };

            sseTransport.onerror = (error) => {
                console.error("[Bridge] SSE connection notice:", error?.message || error);
                // Do NOT call process.exit(1); auto-reconnect instead
                scheduleReconnect();
            };

            sseTransport.onclose = () => {
                console.error("[Bridge] SSE connection closed. Reconnecting...");
                scheduleReconnect();
            };

            await sseTransport.start();
            currentSseTransport = sseTransport;
            isConnecting = false;
            console.error("✅ Bridge is running. Claude Desktop is now connected to Cadence SSE at:", targetUrl);

            // Flush queued messages from stdio if any
            while (messageQueue.length > 0) {
                const msg = messageQueue.shift();
                if (currentSseTransport) {
                    await currentSseTransport.send(msg);
                }
            }
        } catch (err) {
            isConnecting = false;
            const delay = Math.min(1000 * Math.pow(1.5, retryCount), 15000);
            console.error(`[Bridge] Connection error (${err?.message || err}). Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
            setTimeout(() => connectSSE(retryCount + 1), delay);
        }
    }

    let reconnectTimer = null;
    function scheduleReconnect() {
        if (reconnectTimer || isConnecting) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectSSE();
        }, 3000);
    }

    // Bridge messages from stdio to SSE
    stdioTransport.onmessage = async (message) => {
        if (currentSseTransport) {
            try {
                await currentSseTransport.send(message);
            } catch (err) {
                console.error("[Bridge] Error forwarding to SSE, queueing message:", err);
                messageQueue.push(message);
                scheduleReconnect();
            }
        } else {
            messageQueue.push(message);
            scheduleReconnect();
        }
    };

    stdioTransport.onerror = (error) => {
        console.error("[Bridge] Stdio Error:", error);
    };

    try {
        if ('start' in stdioTransport) {
            await stdioTransport.start();
        }
    } catch (e) {}

    await connectSSE();
}

main().catch((err) => {
    console.error("Bridge fatal error:", err);
    process.exit(1);
});
