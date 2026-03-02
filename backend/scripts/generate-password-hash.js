/**
 * 生成密码哈希工具
 * 用于生成bcrypt密码哈希，存储到环境变量中
 * 
 * 使用方法：
 * node scripts/generate-password-hash.js your-password
 */

const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('❌ 请提供密码作为参数');
  console.log('使用方法: node scripts/generate-password-hash.js your-password');
  process.exit(1);
}

async function generateHash() {
  try {
    const hash = await bcrypt.hash(password, 10);
    console.log('\n✅ 密码哈希生成成功！\n');
    console.log('请将以下内容添加到 backend/.env 文件中：\n');
    console.log(`GLOBAL_PASSWORD_HASH=${hash}`);
    console.log(`JWT_SECRET=${generateRandomSecret()}`);
    console.log('\n⚠️  注意：请妥善保管这些密钥，不要提交到Git仓库！\n');
  } catch (error) {
    console.error('❌ 生成哈希失败:', error);
    process.exit(1);
  }
}

function generateRandomSecret() {
  return require('crypto').randomBytes(32).toString('hex');
}

generateHash();
