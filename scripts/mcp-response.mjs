// Fail closed if a public MCP endpoint returns a mismatched or malformed JSON-RPC reply.
export function requireMcpResult(data, requestId, method) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.jsonrpc !== '2.0' || data.id !== requestId ||
      !Object.prototype.hasOwnProperty.call(data, 'result') ||
      Object.prototype.hasOwnProperty.call(data, 'error')) {
    throw Error(method + ' returned an invalid JSON-RPC 2.0 envelope or request ID');
  }
  return data.result;
}

// The external smoke test must reject incompatible MCP handshakes, not only a wrong server name.
export function requireMcpInitialize(info) {
  if (!info || typeof info !== 'object' || Array.isArray(info) ||
      info.serverInfo?.name !== 'advisor-ai-shared-tools' ||
      info.protocolVersion !== '2025-06-18' ||
      !info.capabilities || typeof info.capabilities !== 'object' ||
      !info.capabilities.tools || typeof info.capabilities.tools !== 'object' ||
      Array.isArray(info.capabilities.tools)) {
    throw Error('MCP initialize returned an incompatible protocol or missing tools capability');
  }
  return info;
}
