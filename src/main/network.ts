
import { NetworkRequest } from 'types/index'
import { BrowserWindow } from 'electron'
import { debugWindow } from './windows/debug'
import { HttpServer } from './http_server'

const TTL = (process.env.DEBUG ? 10 : 3) * 60 * 1000

const requests = new Map<string, NetworkRequest>()
const trackedWindows = new Set<BrowserWindow>()
const handlerRegistered = new WeakSet<BrowserWindow>()

export const getNetworkHistory = (): NetworkRequest[] => Array.from(requests.values())

export const clearNetworkHistory = () => requests.clear()

// Register a window for potential network interception.
// Only attaches the CDP debugger if the debug window is already open.
export const registerWindow = (window: BrowserWindow) => {
  trackedWindows.add(window)
  window.on('closed', () => {
    trackedWindows.delete(window)
    try { window.webContents.debugger.detach() } catch { /* empty */ }
  })
  if (debugWindow && !debugWindow.isDestroyed?.()) {
    attachDebugger(window)
  }
}

// Attach CDP debugger to all tracked windows (call when debug window opens)
export const enableNetworkInterception = () => {
  for (const window of trackedWindows) {
    if (!window.isDestroyed()) {
      attachDebugger(window)
    }
  }
}

// Detach CDP debugger from all tracked windows (call when debug window closes)
export const disableNetworkInterception = () => {
  for (const window of trackedWindows) {
    if (!window.isDestroyed?.()) {
      try { window.webContents.debugger.detach() } catch { /* empty */ }
    }
  }
}

const attachDebugger = (window: BrowserWindow) => {
  try {
    window.webContents.debugger.attach('1.3')
    window.webContents.debugger.sendCommand('Network.enable')

    // Only register handler once per window (listeners survive detach/reattach)
    if (!handlerRegistered.has(window)) {
      handlerRegistered.add(window)
      window.webContents.debugger.on('message', createMessageHandler(window))
    }
  } catch (error) {
    console.error('Error attaching network debugger', error)
  }
}

// Default export: unconditional attachment (backwards-compatible, used by tests)
export default (window: BrowserWindow) => {
  try {
    window.webContents.debugger.attach('1.3')
    window.webContents.debugger.sendCommand('Network.enable')
    window.webContents.debugger.on('message', createMessageHandler(window))
    window.on('closed', () => {
      try { window.webContents.debugger.detach() } catch { /* empty */ }
    })
  } catch (error) {
    console.error('Error attaching network debugger', error)
  }
}

function createMessageHandler(window: BrowserWindow) {
  return async (_: Event, method: string, params: any) => {
    if (method === 'Network.requestWillBeSent') {
      handleHttpRequest(params)
    } else if (method === 'Network.webSocketCreated') {
      handleWebSocketCreated(params)
    } else if (method === 'Network.webSocketHandshakeResponseReceived') {
      handleWebSocketHandshake(params)
    } else if (method === 'Network.webSocketFrameSent') {
      handleWebSocketFrameSent(params)
    } else if (method === 'Network.webSocketFrameReceived') {
      handleWebSocketFrameReceived(params)
    } else if (method === 'Network.webSocketClosed') {
      handleWebSocketClosed(params)
    } else if (method === 'Network.webSocketFrameError') {
      handleWebSocketError(params)
    } else if (method === 'Network.responseReceived') {
      handleHttpResponse(params)
    } else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
      await handleHttpLoadingComplete(params, method, window)
    }
  }
}

function handleHttpRequest(params: any) {
  const url = params.request.url

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
    return
  }

  if (
    url.includes(`localhost:${(HttpServer.getInstance().getPort())}`) ||
    url.includes('googlefonts') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('gstatic.com')
  ) {
    return
  }

  const { requestId, request } = params
  const networkRequest: NetworkRequest = {
    id: requestId,
    startTime: Date.now(),
    type: 'http',
    url: request.url,
    method: request.method,
    headers: { ...request.headers },
    postData: request.postData,
  }

  hideApiKeys(networkRequest.headers)

  requests.set(requestId, networkRequest)
  debugWindow?.webContents?.send('network', networkRequest)
}

function handleWebSocketCreated(params: any) {
  const { requestId, url } = params
  
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL.replace('http', 'ws'))) {
    return
  }

  const networkRequest: NetworkRequest = {
    id: requestId,
    startTime: Date.now(),
    type: 'websocket',
    url: url,
    method: 'OPEN',
    headers: {},
    postData: '',
    frames: [],
  }

  requests.set(requestId, networkRequest)
  debugWindow?.webContents?.send('network', networkRequest)
}

function handleWebSocketHandshake(params: any) {
  const { requestId, response } = params
  const request = requests.get(requestId)
  if (!request) return

  request.statusCode = response.status
  request.statusText = response.statusText
  request.responseHeaders = { ...response.headers }

  hideApiKeys(request.responseHeaders)

  debugWindow?.webContents?.send('network', request)
}

function handleWebSocketFrameSent(params: any) {
  const { requestId, timestamp, response } = params
  const request = requests.get(requestId)
  if (!request) return

  request.frames.push({
    type: 'sent',
    timestamp: timestamp,
    opcode: response.opcode,
    mask: response.mask,
    payloadData: response.payloadData,
    payloadLength: response.payloadData?.length || 0
  })

  if (request.frames.length > 200) {
    request.frames = request.frames.slice(-100)
  }

  if (debugWindow && !debugWindow.isDestroyed?.()) {
    debugWindow.webContents.send('network', request)
  }
}

function handleWebSocketFrameReceived(params: any) {
  const { requestId, timestamp, response } = params
  const request = requests.get(requestId)
  if (!request) return

  request.frames.push({
    type: 'received',
    timestamp: timestamp,
    opcode: response.opcode,
    mask: response.mask,
    payloadData: response.payloadData,
    payloadLength: response.payloadData?.length || 0
  })

  if (request.frames.length > 200) {
    request.frames = request.frames.slice(-100)
  }

  if (debugWindow && !debugWindow.isDestroyed?.()) {
    debugWindow.webContents.send('network', request)
  }
}

function handleWebSocketClosed(params: any) {
  const { requestId } = params
  const request = requests.get(requestId)
  if (!request) return

  request.endTime = Date.now()
  debugWindow?.webContents?.send('network', request)

  setTimeout(() => {
    requests.delete(requestId)
  }, TTL)
}

function handleWebSocketError(params: any) {
  const { requestId, errorMessage } = params
  const request = requests.get(requestId)
  if (!request) return

  request.errorMessage = errorMessage
  request.endTime = Date.now()
  debugWindow?.webContents?.send('network', request)
}

function handleHttpResponse(params: any) {
  const { requestId } = params
  if (!requests.has(requestId)) return

  const { response } = params
  const request = requests.get(requestId)
  if (!request) return
  
  request.statusCode = response.status
  request.statusText = response.statusText
  request.responseHeaders = response.headers
  request.mimeType = response.mimeType
}

async function handleHttpLoadingComplete(params: any, method: string, window: BrowserWindow) {
  const { requestId } = params
  if (!requests.has(requestId)) return

  const request = requests.get(requestId)
  if (!request) return

  if (method === 'Network.loadingFailed') {
    request.errorMessage = params.errorText
    request.endTime = Date.now()
    if (request.statusCode == null) {
      request.statusCode = 0
    }
    debugWindow?.webContents?.send('network', request)
  }

  if (method === 'Network.loadingFinished') {
    try {
      const { body, base64Encoded } = await window.webContents.debugger.sendCommand(
        'Network.getResponseBody', { requestId }
      )
      if (body.length < 256 * 1024) {
        request.responseBody = base64Encoded ? Buffer.from(body, 'base64').toString() : body
      } else {
        request.responseBody = 'Response body too large to display'
      }
    } catch (error) {
      request.responseBody = `Unable to get response body. ${error.message}`
      console.log(`Couldn't get response body for request ${requestId} ${request.url}: ${error.message}`)
    }
    request.endTime = Date.now()
    debugWindow?.webContents?.send('network', request)
  }

  setTimeout(() => {
    requests.delete(requestId)
  }, TTL)
}

function hideApiKeys(headers: Record<string, string>) {
  for (const key of ['x-api-key', 'x-goog-api-key', 'authorization']) {
    Object.keys(headers).filter((k) => k.toLowerCase() === key).forEach(k => {
      headers[k] = '*** hidden ***'
    })
  }
}

