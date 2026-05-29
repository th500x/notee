#!/usr/bin/env node
/**
 * 道路幂等键分域 smoke（O3-D4）：move / intercept 互不覆盖。
 * 用法：node backend/scripts/_dev_road_idempotency_scoped.cjs
 */
const {
  scopedRoadRequestId,
  matchesMoveRequestId,
  matchesInterceptRequestId,
  ROAD_REQ_SCOPE,
} = require('../services/road/roadShared');

const uuid = '550e8400-e29b-41d4-a716-446655440000';
let ok = true;

function assert(label, cond) {
  if (!cond) {
    console.error('FAIL:', label);
    ok = false;
  } else {
    console.log('PASS:', label);
  }
}

const moveScoped = scopedRoadRequestId(ROAD_REQ_SCOPE.MOVE, uuid);
const interceptScoped = scopedRoadRequestId(ROAD_REQ_SCOPE.INTERCEPT, uuid);

assert('move scoped prefix', moveScoped === `move:${uuid}`);
assert('intercept scoped prefix', interceptScoped === `intercept:${uuid}`);

assert('move matches scoped', matchesMoveRequestId(moveScoped, uuid));
assert('intercept matches scoped', matchesInterceptRequestId(interceptScoped, uuid));

assert('move retry after intercept stored', matchesMoveRequestId(moveScoped, uuid));
assert('intercept retry after move stored', matchesInterceptRequestId(interceptScoped, uuid));

assert('move does not match intercept scoped', !matchesMoveRequestId(interceptScoped, uuid));
assert('intercept does not match move scoped', !matchesInterceptRequestId(moveScoped, uuid));

assert('legacy bare uuid move', matchesMoveRequestId(uuid, uuid));
assert('legacy bare uuid intercept', matchesInterceptRequestId(uuid, uuid));

console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
process.exit(ok ? 0 : 1);
