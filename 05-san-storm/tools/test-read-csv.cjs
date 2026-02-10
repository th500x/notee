const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'hero-template.csv');

console.log('测试读取CSV...\n');

const content = fs.readFileSync(CSV_PATH, 'utf-8');
console.log('文件大小:', content.length, '字节');

const lines = content.split(/\r?\n/);
console.log('总行数:', lines.length);
console.log('\n前5行:');
lines.slice(0, 5).forEach((line, i) => {
  console.log(`${i}: ${line.substring(0, 100)}...`);
});

console.log('\n检查第2行:');
const line2 = lines[1];
console.log('长度:', line2.length);
console.log('开头:', line2.substring(0, 20));
console.log('是否以char_开头:', line2.startsWith('char_'));

// 简单解析
const fields = line2.split(',');
console.log('\n字段数:', fields.length);
console.log('第1个字段 (id):', fields[0]);
console.log('第2个字段 (name):', fields[1]);
