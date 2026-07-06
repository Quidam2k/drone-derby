import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { websocketService } from '@/services/websocketService'

export const useWebSocket = (shouldConnect: boolean = true) => {
  const tokens = useSelector((state: RootState) => state.auth.tokens)
  const isConnected = useSelector((state: RootState) => state.game.isConnected)
  const connectionRef = useRef<boolean>(false)
  
  useEffect(() => {
    if (shouldConnect && tokens?.accessToken && !connectionRef.current) {
      websocketService.connect(tokens.accessToken)
      connectionRef.current = true
    }
    
    if (!shouldConnect && connectionRef.current) {
      websocketService.disconnect()
      connectionRef.current = false
    }
    
    // Cleanup on unmount
    return () => {
      if (connectionRef.current) {
        websocketService.disconnect()
        connectionRef.current = false
      }
    }
  }, [shouldConnect, tokens?.accessToken])
  
  // Reconnect when token changes
  useEffect(() => {
    if (connectionRef.current && tokens?.accessToken) {
      websocketService.disconnect()
      websocketService.connect(tokens.accessToken)
    }
  }, [tokens?.accessToken])
  
  return {
    isConnected,
    connect: () => websocketService.connect(tokens?.accessToken),
    disconnect: () => websocketService.disconnect(),
    joinGameRoom: (gameId: string) => websocketService.joinGameRoom(gameId),
    leaveGameRoom: (gameId: string) => websocketService.leaveGameRoom(gameId),
    sendChatMessage: (gameId: string, message: string) => websocketService.sendChatMessage(gameId, message),
    joinEditorRoom: (boardId: string) => websocketService.joinEditorRoom(boardId),
    leaveEditorRoom: (boardId: string) => websocketService.leaveEditorRoom(boardId),
    sendEditorUpdate: (boardId: string, update: unknown) => websocketService.sendEditorUpdate(boardId, update),
  }
}