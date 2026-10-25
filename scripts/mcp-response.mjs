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
