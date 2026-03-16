import { Server as HTTPServer } from 'http';

export class SocketService {
  private static instance: SocketService;

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public initialize(_server: HTTPServer) {}

  public emitToUser(_userId: string, _event: string, _data: unknown) {}

  public emitToAdvertiser(_advertiserId: string, _event: string, _data: unknown) {}

  public emitToConversation(_conversationId: string, _event: string, _data: unknown) {}

  public emitToAdmins(_event: string, _data: unknown) {}

  public broadcast(_event: string, _data: unknown) {}
}

export const socketService = SocketService.getInstance();
