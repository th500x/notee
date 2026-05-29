/**
 * `routes/adminConfigTexts.js` schema（O3-D1 · T-09 第五批）。
 *
 * @module middleware/validationSchemas/adminConfigTexts
 */

const { v } = require('../validation');
const { factionId, playerId } = require('./common');

const listQuery = {
  enabledOnly: v.optional(v.enum(['', '0', '1', 'true', 'false'])),
};

const templateIdParam = {
  templateId: v.required(v.idLike({ max: 128 })),
};

const createTemplateBody = {
  template_id: v.required(v.idLike({ max: 128 })),
  mail_type: v.required(v.enum(['system', 'reward'])),
  subject: v.required(v.string({ max: 256 })),
  body: v.required(v.string({ max: 16_384 })),
  attachments_json: v.optional(v.plainObject()),
  is_enabled: v.optional(v.boolean()),
  sort_order: v.optional(v.integer({ min: 0, max: 9999 })),
  remark: v.optional(v.string({ max: 512 })),
};

const updateTemplateBody = {
  mail_type: v.optional(v.enum(['system', 'reward'])),
  subject: v.optional(v.string({ max: 256 })),
  body: v.optional(v.string({ max: 16_384 })),
  attachments_json: v.optional(v.plainObject()),
  is_enabled: v.optional(v.boolean()),
  sort_order: v.optional(v.integer({ min: 0, max: 9999 })),
  remark: v.optional(v.string({ max: 512 })),
};

const trialSendBody = {
  template_id: v.required(v.idLike({ max: 128 })),
  target_type: v.optional(v.enum(['all', 'faction', 'user'])),
  faction_id: v.optional(factionId),
  receiver_id: v.optional(playerId),
  subject: v.optional(v.string({ max: 256 })),
  content: v.optional(v.string({ max: 16_384 })),
};

module.exports = {
  listQuery,
  templateIdParam,
  createTemplateBody,
  updateTemplateBody,
  trialSendBody,
};
