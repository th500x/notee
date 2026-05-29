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

const longTermProposalBody = {
  factionId: v.required(factionId),
  category: v.required(v.enum(POLICY_CATEGORIES)),
  config: v.required(v.plainObject()),
  proposalId: v.optional(v.idLike({ max: 128 })),
};

module.exports = {
  panelQuery,
  longTermProposalBody,
};
