/**
 * 测试密码验证
 * 用于调试密码哈希验证问题
 */

const bcrypt = require('bcrypt');

const password = 'notee.vip.2026';
const hash = '$2b$10$NxPzCCsn7ELu81eHwTDJxuORI/W7ov65eS.hdjivWiieZFwWBkjhi';

async function testPassword() {
  console.log('🔍 测试密码验证...\n');
  console.log('密码:', password);
  console.log('哈希:', hash);
  console.log('');
  
  try {
    const isValid = await bcrypt.compare(password, hash);
    console.log('验证结果:', isValid ? '✅ 成功' : '❌ 失败');
    
    if (!isValid) {
      console.log('\n🔄 重新生成正确的哈希...');
      const newHash = await bcrypt.hash(password, 10);
      console.log('新哈希:', newHash);
      console.log('\n请更新 backend/.env 文件中的 GLOBAL_PASSWORD_HASH');
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testPassword();
