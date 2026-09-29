/**
 * Report reason codes (API JSON = same string). Keep short & stable for App enums.
 */

const { httpError } = require('./httpError');

const REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'sexual',
  'illegal',
  'other',
]);

function assertReportReason(raw) {
  if (typeof raw !== 'string' || !REPORT_REASONS.has(raw)) {
    throw httpError(400, '举报理由无效', 'BAD_REASON');
  }
  return raw;
}

module.exports = {
  REPORT_REASONS,
  assertReportReason,
};
