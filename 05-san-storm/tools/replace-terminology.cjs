/**
 * 批量替换术语：人生阶段 → 生涯
 */

const fs = require('fs');
const path = require('path');

const files = [
  'src/components/character/LifeStageExample.jsx',
  'src/components/character/LifeStageDetail.jsx',
  'src/components/character/CharacterCard.jsx',
  'src/App.jsx',
  'src/hooks/useLifeStages.js',
];

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // 替换"人生阶段"为"生涯"
  content = content.replace(/人生阶段/g, '生涯');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已更新: ${file}`);
  } else {
    console.log(`⏭️  无需更新: ${file}`);
  }
});

console.log('\n✅ 术语替换完成！');
