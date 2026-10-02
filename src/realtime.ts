import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: { token: window.localStorage.getItem('trackline-token') || undefined },
    })
  }
  return socket
}

export function refreshRealtimeAuth() {
  if (!socket) return
  socket.auth = { token: window.localStorage.getItem('trackline-token') || undefined }
  if (socket.connected) socket.disconnect().connect()
}

export function closeRealtimeSocket() {
  socket?.disconnect()
  socket = null
}
