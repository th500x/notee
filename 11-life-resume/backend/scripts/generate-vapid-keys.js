/**
 * 生成 Web Push VAPID 密钥对。把输出写入 backend/.env，勿提交私钥。
 * Usage: node scripts/generate-vapid-keys.js
 */

const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
console.log('# 写入 11-life-resume/backend/.env（勿提交仓库）');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=https://notee.vip');
