/**
 * `routes/factionPolicies.js` schema（O3-D1 · T-09 第五批）。
 *
 * @module middleware/validationSchemas/factionPolicies
 */

const { v } = require('../validation');
const { factionId } = require('./common');

const POLICY_CATEGORIES = ['ration_bonus', 'siege_reward', 'recruit', 'domestic_goal'];

const panelQuery = {
  factionId: v.required(factionId),
};

const tributeSilverField = v.optional(v.integer({ min: 0, max: 100000 }));

const longTermProposalBody = {
  factionId: v.required(factionId),
  category: v.required(v.enum(POLICY_CATEGORIES)),
  config: v.required(v.plainObject()),
  proposalId: v.optional(v.idLike({ max: 128 })),
  tributeSilver: tributeSilverField,
};

const previewApprovalBody = {
  factionId: v.required(factionId),
  category: v.required(v.enum(POLICY_CATEGORIES)),
  config: v.required(v.plainObject()),
  tributeSilver: tributeSilverField,
};

module.exports = {
  panelQuery,
  longTermProposalBody,
  previewApprovalBody,
};
