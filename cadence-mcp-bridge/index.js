#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");

// Set your production AWS EC2 URL here before publishing!
const PRODUCTION_URL = process.env.CADENCE_API_URL || "http://3.108.212.50:4000/api/mcp/sse";

async function main() {
    const API_KEY = process.env.CADENCE_API_KEY;
    if (!API_KEY) {
        console.error("Missing CADENCE_API_KEY environment variable in Claude Desktop config!");
        process.exit(1);
    }
    
    // Connect to remote Cadence backend
    const sseTransport = new sse_js_1.SSEClientTransport(new URL(PRODUCTION_URL), {
        eventSourceInit: {
            headers: { Authorization: `Bearer ${API_KEY}` },
        },
        requestInit: {
            headers: { Authorization: `Bearer ${API_KEY}` },
        },
    });
    
    const stdioTransport = new stdio_js_1.StdioServerTransport();
    
    // Bridge messages
    sseTransport.onmessage = async (message) => { await stdioTransport.send(message); };
    stdioTransport.onmessage = async (message) => { await sseTransport.send(message); };
    sseTransport.onerror = (error) => {
        console.error("SSE Error:", error);
        process.exit(1);
    };
    stdioTransport.onerror = (error) => {
        console.error("Stdio Error:", error);
        process.exit(1);
    };
    
    await sseTransport.start();
    try {
        if ('start' in stdioTransport) { await stdioTransport.start(); }
    } catch (e) { }
    
    console.error("✅ Bridge is running. Claude Desktop is now connected to Cadence SSE.");
}

main().catch((err) => {
    console.error("Bridge fatal error:", err);
    process.exit(1);
});
