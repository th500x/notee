/**
 * 测试新的角色创建进度API
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3005/api';
const TEST_PLAYER_ID = 'TEST';

async function testAPIs() {
  console.log('开始测试角色创建进度API...\n');
  
  try {
    // 1. 测试获取进度（应该返回null，因为还没有数据）
    console.log('1️⃣ 测试获取创建进度...');
    const getResponse = await fetch(`${BASE_URL}/players/${TEST_PLAYER_ID}/creation-progress`);
    const getData = await getResponse.json();
    console.log('   结果:', getData.success ? '✅ 成功' : '❌ 失败');
    console.log('   数据:', getData.data === null ? 'null (正确)' : getData.data);
    console.log('');
    
    // 2. 测试保存进度
    console.log('2️⃣ 测试保存创建进度...');
    const saveResponse = await fetch(`${BASE_URL}/players/${TEST_PLAYER_ID}/creation-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_step: 3,
        selected_faction_id: 'san_1_faction_1001',
        selected_faction_name: '刘备',
        character_name: '测试角色',
        remaining_silver: 40,
        random_cost: 10,
        current_batch: 1,
        random_batches: [
          {
            batch: 1,
            timestamp: new Date().toISOString(),
            cost: 0,
            options: [
              { attributes: { courage: 91 }, totalPoints: 565, type: 'Military' },
              { attributes: { courage: 85 }, totalPoints: 548, type: 'Balanced' },
              { attributes: { courage: 78 }, totalPoints: 572, type: 'Strategist' }
            ]
          }
        ],
        selected_option_batch: null,
        selected_option_index: null,
        selected_troops: []
      })
    });
    const saveData = await saveResponse.json();
    console.log('   结果:', saveData.success ? '✅ 成功' : '❌ 失败');
    console.log('   消息:', saveData.message);
    console.log('');
    
    // 3. 再次获取进度（应该返回刚才保存的数据）
    console.log('3️⃣ 再次获取创建进度...');
    const getResponse2 = await fetch(`${BASE_URL}/players/${TEST_PLAYER_ID}/creation-progress`);
    const getData2 = await getResponse2.json();
    console.log('   结果:', getData2.success ? '✅ 成功' : '❌ 失败');
    console.log('   当前步骤:', getData2.data?.current_step);
    console.log('   剩余银两:', getData2.data?.remaining_silver);
    console.log('   批次数量:', getData2.data?.random_batches?.length);
    console.log('');
    
    // 4. 测试删除进度
    console.log('4️⃣ 测试删除创建进度...');
    const deleteResponse = await fetch(`${BASE_URL}/players/${TEST_PLAYER_ID}/creation-progress`, {
      method: 'DELETE'
    });
    const deleteData = await deleteResponse.json();
    console.log('   结果:', deleteData.success ? '✅ 成功' : '❌ 失败');
    console.log('   消息:', deleteData.message);
    console.log('');
    
    // 5. 验证删除（应该返回null）
    console.log('5️⃣ 验证删除结果...');
    const getResponse3 = await fetch(`${BASE_URL}/players/${TEST_PLAYER_ID}/creation-progress`);
    const getData3 = await getResponse3.json();
    console.log('   结果:', getData3.success ? '✅ 成功' : '❌ 失败');
    console.log('   数据:', getData3.data === null ? 'null (正确)' : getData3.data);
    console.log('');
    
    console.log('✅ 所有API测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testAPIs();
