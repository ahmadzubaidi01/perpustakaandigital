import { Op } from 'sequelize';
import { ChatConversation, ChatMessage, User } from '../models';
import { UserRole, ROLE_HIERARCHY } from '../config/constants';
import logger from '../utils/logger';

/**
 * Chat service — handles admin-to-admin real-time messaging.
 * Enforces hierarchy-based communication permissions.
 */

/**
 * Validate that two users are allowed to chat based on the RBAC hierarchy.
 * Rules:
 * - Students cannot use chat
 * - Admins can contact admins in their hierarchy chain (up or down)
 * - No cross-region communication outside hierarchy
 */
const validateChatPermission = async (
  sender: Express.Request['user'],
  recipientId: number
): Promise<{ allowed: boolean; reason?: string }> => {
  if (!sender) return { allowed: false, reason: 'Authentication required' };

  const senderRole = sender.user_role as UserRole;
  if (senderRole === UserRole.STUDENT_MEMBER) {
    return { allowed: false, reason: 'Students cannot use the admin chat system' };
  }

  const recipient = await User.findByPk(recipientId);
  if (!recipient) return { allowed: false, reason: 'Recipient not found' };

  const recipientRole = recipient.user_role as UserRole;
  if (recipientRole === UserRole.STUDENT_MEMBER) {
    return { allowed: false, reason: 'Cannot send messages to students' };
  }

  // Super admin can message anyone
  if (senderRole === UserRole.SUPER_ADMIN) return { allowed: true };

  // Check regional scope based on roles
  if (senderRole === UserRole.REGENCY_ADMIN) {
    // Can contact super_admin, or district/school admins in their regency
    if (recipientRole === UserRole.SUPER_ADMIN) return { allowed: true };
    if (recipient.regency_id === sender.regency_id) return { allowed: true };
    return { allowed: false, reason: 'Cannot contact admins outside your regency' };
  }

  if (senderRole === UserRole.DISTRICT_ADMIN) {
    if (recipientRole === UserRole.SUPER_ADMIN) return { allowed: true };
    if (recipientRole === UserRole.REGENCY_ADMIN && recipient.regency_id === sender.regency_id) return { allowed: true };
    if (recipient.district_id === sender.district_id) return { allowed: true };
    return { allowed: false, reason: 'Cannot contact admins outside your district hierarchy' };
  }

  if (senderRole === UserRole.SCHOOL_ADMIN) {
    if (recipientRole === UserRole.SUPER_ADMIN) return { allowed: true };
    if (recipientRole === UserRole.REGENCY_ADMIN && recipient.regency_id === sender.regency_id) return { allowed: true };
    if (recipientRole === UserRole.DISTRICT_ADMIN && recipient.district_id === sender.district_id) return { allowed: true };
    if (recipientRole === UserRole.SCHOOL_ADMIN && recipient.school_id === sender.school_id) return { allowed: true };
    return { allowed: false, reason: 'Cannot contact admins outside your hierarchy chain' };
  }

  return { allowed: false, reason: 'Unauthorized' };
};

/**
 * Get or create a conversation between two users.
 * Always stores the lower user_id as participant_1 for uniqueness.
 */
const getOrCreateConversation = async (userId1: number, userId2: number): Promise<ChatConversation> => {
  const [p1, p2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

  const [conversation] = await ChatConversation.findOrCreate({
    where: { participant_1_id: p1, participant_2_id: p2 },
    defaults: { participant_1_id: p1, participant_2_id: p2 },
  });

  return conversation;
};

/**
 * Send a message in a conversation.
 */
const sendMessage = async (
  conversationId: number,
  senderId: number,
  messageText: string
): Promise<ChatMessage> => {
  const message = await ChatMessage.create({
    conversation_id: conversationId,
    sender_id: senderId,
    message_text: messageText,
    is_read: false,
  });

  // Update conversation's last message timestamp
  await ChatConversation.update(
    { last_message_at: new Date() },
    { where: { conversation_id: conversationId } }
  );

  return message;
};

/**
 * List conversations for a user with last message preview and unread count.
 */
const getConversations = async (userId: number): Promise<any[]> => {
  const conversations = await ChatConversation.findAll({
    where: {
      [Op.or]: [
        { participant_1_id: userId },
        { participant_2_id: userId },
      ],
    },
    include: [
      {
        association: 'participant_1',
        attributes: ['user_id', 'full_name', 'user_role', 'profile_photo_url', 'school_id', 'district_id', 'regency_id'],
      },
      {
        association: 'participant_2',
        attributes: ['user_id', 'full_name', 'user_role', 'profile_photo_url', 'school_id', 'district_id', 'regency_id'],
      },
    ],
    order: [['last_message_at', 'DESC']],
  });

  // Enrich with last message and unread count
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const lastMessage = await ChatMessage.findOne({
        where: { conversation_id: conv.conversation_id },
        order: [['created_at', 'DESC']],
        attributes: ['message_id', 'sender_id', 'message_text', 'created_at', 'is_read'],
      });

      const unreadCount = await ChatMessage.count({
        where: {
          conversation_id: conv.conversation_id,
          sender_id: { [Op.ne]: userId },
          is_read: false,
        },
      });

      const convJSON = conv.toJSON() as any;
      return {
        ...convJSON,
        last_message: lastMessage ? lastMessage.toJSON() : null,
        unread_count: unreadCount,
      };
    })
  );

  return enriched;
};

/**
 * Get paginated messages for a conversation.
 */
const getMessages = async (
  conversationId: number,
  page: number = 1,
  limit: number = 50
): Promise<{ messages: ChatMessage[]; total: number }> => {
  const offset = (page - 1) * limit;

  const { count, rows } = await ChatMessage.findAndCountAll({
    where: { conversation_id: conversationId },
    include: [
      {
        association: 'sender',
        attributes: ['user_id', 'full_name', 'user_role', 'profile_photo_url'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return { messages: rows, total: count };
};

/**
 * Mark all messages from the other participant as read.
 */
const markMessagesRead = async (conversationId: number, userId: number): Promise<number> => {
  const [affectedCount] = await ChatMessage.update(
    { is_read: true },
    {
      where: {
        conversation_id: conversationId,
        sender_id: { [Op.ne]: userId },
        is_read: false,
      },
    }
  );

  return affectedCount;
};

/**
 * Get total unread message count for a user across all conversations.
 */
const getTotalUnreadCount = async (userId: number): Promise<number> => {
  // Get all conversations the user is part of
  const conversations = await ChatConversation.findAll({
    where: {
      [Op.or]: [
        { participant_1_id: userId },
        { participant_2_id: userId },
      ],
    },
    attributes: ['conversation_id'],
  });

  const convIds = conversations.map((c) => c.conversation_id);
  if (convIds.length === 0) return 0;

  return ChatMessage.count({
    where: {
      conversation_id: { [Op.in]: convIds },
      sender_id: { [Op.ne]: userId },
      is_read: false,
    },
  });
};

/**
 * Get eligible chat recipients for a user based on hierarchy.
 */
const getEligibleRecipients = async (user: Express.Request['user']): Promise<any[]> => {
  if (!user) return [];

  const userRole = user.user_role as UserRole;
  const where: any = {
    user_id: { [Op.ne]: user.user_id },
    user_role: { [Op.ne]: UserRole.STUDENT_MEMBER },
    account_status: 'active',
  };

  // Filter based on role hierarchy and regional scope
  if (userRole === UserRole.SUPER_ADMIN) {
    // Can contact all admins
  } else if (userRole === UserRole.REGENCY_ADMIN) {
    where[Op.or] = [
      { user_role: UserRole.SUPER_ADMIN },
      { regency_id: user.regency_id },
    ];
  } else if (userRole === UserRole.DISTRICT_ADMIN) {
    where[Op.or] = [
      { user_role: UserRole.SUPER_ADMIN },
      { user_role: UserRole.REGENCY_ADMIN, regency_id: user.regency_id },
      { district_id: user.district_id },
    ];
  } else if (userRole === UserRole.SCHOOL_ADMIN) {
    where[Op.or] = [
      { user_role: UserRole.SUPER_ADMIN },
      { user_role: UserRole.REGENCY_ADMIN, regency_id: user.regency_id },
      { user_role: UserRole.DISTRICT_ADMIN, district_id: user.district_id },
      { user_role: UserRole.SCHOOL_ADMIN, school_id: user.school_id },
    ];
  }

  return User.findAll({
    where,
    attributes: ['user_id', 'full_name', 'user_role', 'profile_photo_url', 'school_id', 'district_id', 'regency_id'],
    order: [['full_name', 'ASC']],
  });
};

export {
  validateChatPermission,
  getOrCreateConversation,
  sendMessage,
  getConversations,
  getMessages,
  markMessagesRead,
  getTotalUnreadCount,
  getEligibleRecipients,
};
