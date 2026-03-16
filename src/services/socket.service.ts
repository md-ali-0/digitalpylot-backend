/* eslint-disable @typescript-eslint/no-explicit-any */
import env from '@config/env';
import logger from '@config/winston';
import { verifyAccessToken } from '@utils/jwt.util';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/db';

export class SocketService {
  private static instance: SocketService;
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public initialize(server: HTTPServer) {
    // Configure CORS based on environment
    const corsOptions: any = {
      methods: ['GET', 'POST'],
    };

    if (env.NODE_ENV === 'production') {
      // For production, support multiple origins if specified, otherwise single origin
      const prodOrigins: string[] = [];
      if (env.CLIENT_URL_PROD) {
        if (env.CLIENT_URL_PROD.includes(',')) {
          prodOrigins.push(...env.CLIENT_URL_PROD.split(',').map((url) => url.trim()));
        } else {
          prodOrigins.push(env.CLIENT_URL_PROD);
        }
      }
      if (env.CORS_ORIGIN) {
        if (env.CORS_ORIGIN.includes(',')) {
          prodOrigins.push(...env.CORS_ORIGIN.split(',').map((url) => url.trim()));
        } else {
          prodOrigins.push(env.CORS_ORIGIN);
        }
      }

      if (prodOrigins.length > 0) {
        corsOptions.origin = function (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) {
          if (!origin) return callback(null, true);
          if (prodOrigins.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        };
      } else {
        corsOptions.origin = env.CLIENT_URL || '*';
      }
    } else {
      corsOptions.origin = function (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) {
        let allowedOrigins: string[] = [];
        if (env.CORS_ORIGIN) {
          allowedOrigins = env.CORS_ORIGIN.split(',').map((url) => url.trim());
        } else {
          allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3000',
            'https://zlivoo.com',
            'https://dashboard.zlivoo.com',
            'http://localhost:3002',
            'http://172.16.0.123:3001',
            'http://172.16.0.123:3002',
          ];
        }
        if (env.CLIENT_URL && !allowedOrigins.includes(env.CLIENT_URL)) {
          allowedOrigins.push(env.CLIENT_URL);
        }
        if (env.DASHBOARD_URL && !allowedOrigins.includes(env.DASHBOARD_URL)) {
          allowedOrigins.push(env.DASHBOARD_URL);
        }
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      };
    }

    this.io = new SocketIOServer(server, {
      cors: corsOptions,
      path: '/socket.io',
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = verifyAccessToken(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            name: true,
            userRoles: { include: { role: true } }, // Fetch roles
          },
        });

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        // Map roles to string array for easier usage
        const roles = user.userRoles.map((ur) => ur.role.name);
        (socket as any).user = { ...user, roles };

        next();
      } catch (err) {
        logger.error('Socket authentication error:', err);
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      const user = (socket as any).user;
      const userId = user.id;

      logger.info(`User connected to socket: ${userId} (${socket.id})`);

      const sockets = this.userSockets.get(userId) || [];
      sockets.push(socket.id);
      this.userSockets.set(userId, sockets);

      socket.join(`user:${userId}`);

      // Check roles array
      const isAdvertiser = user.roles.includes('ADVERTISER') || user.roles.includes('Advertiser');
      const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('Admin');

      if (isAdvertiser) {
        prisma.advertiser
          .findUnique({ where: { userId } })
          .then((advertiser) => {
            if (advertiser) {
              socket.join(`advertiser:${advertiser.id}`);
              logger.info(`Advertiser joined room: advertiser:${advertiser.id}`);
            }
          })
          .catch((error) => {
            logger.error('Error finding vendor for socket connection:', error);
          });
      }

      if (isAdmin) {
        socket.join('admin:all');
      }

      socket.on('join-conversation', (conversationId) => {
        socket.join(`conversation:${conversationId}`);
        logger.info(`User ${userId} joined conversation: ${conversationId}`);
      });

      socket.on('leave-conversation', (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
        logger.info(`User ${userId} left conversation: ${conversationId}`);
      });

      socket.on('typing', ({ conversationId, isTyping }) => {
        socket.to(`conversation:${conversationId}`).emit('typing', {
          conversationId,
          userId,
          name: user.name,
          isTyping,
        });
      });

      socket.on('disconnect', () => {
        logger.info(`User disconnected from socket: ${userId} (${socket.id})`);
        const sockets = this.userSockets.get(userId) || [];
        const filtered = sockets.filter((id: string) => id !== socket.id);
        if (filtered.length > 0) {
          this.userSockets.set(userId, filtered);
        } else {
          this.userSockets.delete(userId);
        }
      });
    });
  }

  public emitToUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  public emitToAdvertiser(advertiserId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`advertiser:${advertiserId}`).emit(event, data);
    }
  }

  public emitToConversation(conversationId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`conversation:${conversationId}`).emit(event, data);
    }
  }

  public emitToAdmins(event: string, data: any) {
    if (this.io) {
      this.io.to('admin:all').emit(event, data);
    }
  }

  public broadcast(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}

export const socketService = SocketService.getInstance();
