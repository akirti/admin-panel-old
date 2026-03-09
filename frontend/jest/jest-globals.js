// Polyfill globals that jsdom does not provide but libraries (e.g. react-router v7) expect
const { TextEncoder, TextDecoder } = require('util');
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

// Use Node's native Blob which has .text() and .arrayBuffer()
// jsdom's Blob implementation lacks these methods
const { Blob: NodeBlob } = require('buffer');
if (NodeBlob) {
  globalThis.Blob = NodeBlob;
}
