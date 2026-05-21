import { Router } from 'express';
import {
  listConversations,
  getConversationMessages,
  startConversation,
  sendNewMessage,
  markConversationRead,
  listEligibleRecipients,
} from '../../controllers/chatController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const startConversationSchema = {
  body: Joi.object({
    recipient_id: Joi.number().integer().positive().required(),
  }),
};

const sendMessageSchema = {
  body: Joi.object({
    message_text: Joi.string().min(1).max(5000).required(),
  }),
};

// All chat routes require at least school_admin role (students excluded)
router.get('/conversations', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), listConversations);
router.get('/conversations/:conversation_id/messages', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), getConversationMessages);
router.post('/conversations', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(startConversationSchema), startConversation);
router.post('/conversations/:conversation_id/messages', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(sendMessageSchema), sendNewMessage);
router.patch('/conversations/:conversation_id/read', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), markConversationRead);
router.get('/recipients', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), listEligibleRecipients);

export default router;
