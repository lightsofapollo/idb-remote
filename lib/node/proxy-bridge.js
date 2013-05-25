/**
 * WebSocket based proxy server.
 *
 * Proxy (Provider) Connection:
 *
 *  [
 *    'register proxy',
 *    {
 *      domain: 'http://domain.com',
 *      databases: [],
 *      objectStores: []
 *    }
 *  ]
 *
 * Client Sends:
 *
 *  [
 *    24 // opaque response id
 *    ['command', 'arg', 'arg']
 *  ]
 *
 * Commands:
 *
 *    all: ['domain', 'db', 'store']
 *    refresh: ['domain'] // refresh whole domain
 *    refresh: ['domain', 'db'] // refresh single db
 */
