import { Request, Response } from 'express';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, buildPaginationResult } from '../utils/pagination';
import { AuditActionType, TABLE_NAMES } from '../config/constants';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import {
  validateChatPermission,
  getOrCreateConversation,
  sendMessage,
  getConversations,
  getMessages,
  markMessagesRead,
  getEligibleRecipients,
} from '../services/chatService';
import { emitChatMessage } from '../services/socketService';

/**
 * GET /api/v1/chat/conversations
 * List all conversations for the authenticated user.
 */
const listConversations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.user_id;
  const conversations = await getConversations(userId);
  apiResponse.success(res, 'Conversations retrieved', conversations);
});

/**
 * GET /api/v1/chat/conversations/:conversation_id/messages
 * Get paginated messages for a conversation.
 */
const getConversationMessages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conversationId = parseInt(req.params.conversation_id as string, 10);
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;

  const { messages, total } = await getMessages(conversationId, page, limit);

  apiResponse.paginated(res, 'Messages retrieved', messages, {
    current_page: page,
    per_page: limit,
    total_items: total,
    total_pages: Math.ceil(total / limit),
    has_next_page: page * limit < total,
    has_prev_page: page > 1,
  });
});

/**
 * POST /api/v1/chat/conversations
 * Start a new conversation with a recipient (or return existing).
 */
const startConversation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { recipient_id } = req.body;
  const userId = req.user!.user_id;

  if (recipient_id === userId) {
    apiResponse.badRequest(res, 'Cannot start a conversation with yourself');
    return;
  }

  // Validate permission
  const permission = await validateChatPermission(req.user, recipient_id);
  if (!permission.allowed) {
    apiResponse.forbidden(res, permission.reason || 'Not allowed to contact this user');
    return;
  }

  const conversation = await getOrCreateConversation(userId, recipient_id);
  apiResponse.success(res, 'Conversation ready', conversation);
});

/**
 * POST /api/v1/chat/conversations/:conversation_id/messages
 * Send a message in a conversation.
 */
const sendNewMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conversationId = parseInt(req.params.conversation_id as string, 10);
  const { message_text } = req.body;
  const senderId = req.user!.user_id;

  if (!message_text || !message_text.trim()) {
    apiResponse.badRequest(res, 'Message text is required');
    return;
  }

  const message = await sendMessage(conversationId, senderId, message_text.trim());

  // Load sender info for the response
  const messageWithSender = await message.reload({
    include: [{ association: 'sender', attributes: ['user_id', 'full_name', 'user_role', 'profile_photo_url'] }],
  });

  // Determine recipient from the conversation
  const { ChatConversation } = require('../models');
  const conv = await ChatConversation.findByPk(conversationId);
  if (conv) {
    const recipientId = conv.participant_1_id === senderId ? conv.participant_2_id : conv.participant_1_id;
    emitChatMessage(conversationId, recipientId, messageWithSender.toJSON());

    // Generate in-app database notification and emit global Socket notification
    try {
      const { sendChatMessageNotification } = require('../services/notificationService');
      await sendChatMessageNotification(recipientId, (messageWithSender as any).sender.full_name, message_text.trim());
    } catch (err: any) {
      console.error('Failed to trigger chat notification:', err.message);
    }
  }

  apiResponse.created(res, 'Message sent', messageWithSender);
});

/**
 * PATCH /api/v1/chat/conversations/:conversation_id/read
 * Mark all messages in a conversation as read.
 */
const markConversationRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conversationId = parseInt(req.params.conversation_id as string, 10);
  const userId = req.user!.user_id;

  const count = await markMessagesRead(conversationId, userId);
  apiResponse.success(res, 'Messages marked as read', { marked_count: count });
});

/**
 * GET /api/v1/chat/recipients
 * Get list of eligible chat recipients based on hierarchy.
 */
const listEligibleRecipients = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const recipients = await getEligibleRecipients(req.user);
  apiResponse.success(res, 'Eligible recipients retrieved', recipients);
});

export {
  listConversations,
  getConversationMessages,
  startConversation,
  sendNewMessage,
  markConversationRead,
  listEligibleRecipients,
};
