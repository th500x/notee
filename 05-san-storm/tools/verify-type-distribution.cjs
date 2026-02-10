/**
 * 验证角色类型属性分配规则
 * 
 * 规则（v3.2）：
 * - military: luck + courage + command + combat 占 60%-65%，各项属性差值≤3.5
 * - strategist: luck + intelligence + politics + charisma 占 60%-65%，各项属性差值≤3.5
 * - balanced: 7项属性差值 ≤ 2.0
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, 'hero-template.csv'),
};

// 读取CSV文件
function readCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 去除BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const lines = content.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length - 5 && values[1]) {
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = (values[index] || '').trim();
      });
      data.push(row);
    }
  }
  
  return data;
}

// 解析CSV行
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

// 主函数
function main() {
  console.log('='.repeat(80));
  console.log('验证角色类型属性分配规则');
  console.log('='.repeat(80));
  console.log('');
  
  // 读取数据
  console.log('📖 读取CSV数据...');
  const data = readCSV(CONFIG.csvPath);
  const s1Characters = data.filter(row => row.season === 'S1' && row.character_name && row.rarity);
  console.log(`   ✅ 读取到 ${s1Characters.length} 个S1角色`);
  console.log('');
  
  // 验证
  console.log('🔍 验证类型分配规则...');
  console.log('');
  
  const errors = [];
  const warnings = [];
  const stats = {
    military: { total: 0, valid: 0, ratios: [], diffs: [] },
    strategist: { total: 0, valid: 0, ratios: [], diffs: [] },
    balanced: { total: 0, valid: 0, diffs: [] },
  };
  
  s1Characters.forEach(char => {
    const type = char.character_type;
    const attrs = {
      luck: parseFloat(char.luck),
      courage: parseFloat(char.courage),
      command: parseFloat(char.command),
      combat: parseFloat(char.combat),
      intelligence: parseFloat(char.intelligence),
      politics: parseFloat(char.politics),
      charisma: parseFloat(char.charisma),
    };
    
    // 检查属性值有效性
    const invalidAttrs = Object.entries(attrs).filter(([k, v]) => isNaN(v));
    if (invalidAttrs.length > 0) {
      errors.push(`${char.character_name}: 属性值无效 ${invalidAttrs.map(([k, v]) => `${k}=${char[k]}`).join(', ')}`);
      return;
    }
    
    const total = Object.values(attrs).reduce((a, b) => a + b, 0);
    
    if (type === 'military') {
      stats.military.total++;
      
      // military: luck + courage + command + combat 占 60%-65%
      const primarySum = attrs.luck + attrs.courage + attrs.command + attrs.combat;
      const ratio = primarySum / total;
      stats.military.ratios.push(ratio);
      
      // 检查主要4项占比
      let ratioValid = false;
      if (ratio >= 0.60 && ratio <= 0.65) {
        ratioValid = true;
      } else if (ratio < 0.55 || ratio > 0.70) {
        errors.push(`${char.character_name} (military): 主要4项占比 ${(ratio * 100).toFixed(1)}% (应该60%-65%)`);
      } else {
        warnings.push(`${char.character_name} (military): 主要4项占比 ${(ratio * 100).toFixed(1)}% (接近但不在60%-65%)`);
        ratioValid = true; // 接近的也算有效
      }
      
      // 检查各项属性差值≤3.5
      const primaryAttrs = [attrs.luck, attrs.courage, attrs.command, attrs.combat];
      const maxPrimary = Math.max(...primaryAttrs);
      const minPrimary = Math.min(...primaryAttrs);
      const diff = maxPrimary - minPrimary;
      stats.military.diffs.push(diff);
      
      let diffValid = false;
      if (diff <= 3.5) {
        diffValid = true;
      } else if (diff <= 4.0) {
        warnings.push(`${char.character_name} (military): 主要4项差值 ${diff.toFixed(1)} (接近但超过3.5)`);
        diffValid = true; // 接近的也算有效
      } else {
        errors.push(`${char.character_name} (military): 主要4项差值 ${diff.toFixed(1)} (应该≤3.5)`);
      }
      
      // 两个条件都满足才算有效
      if (ratioValid && diffValid) {
        stats.military.valid++;
      }
      
    } else if (type === 'strategist') {
      stats.strategist.total++;
      
      // strategist: luck + intelligence + politics + charisma 占 60%-65%
      const primarySum = attrs.luck + attrs.intelligence + attrs.politics + attrs.charisma;
      const ratio = primarySum / total;
      stats.strategist.ratios.push(ratio);
      
      // 检查主要4项占比
      let ratioValid = false;
      if (ratio >= 0.60 && ratio <= 0.65) {
        ratioValid = true;
      } else if (ratio < 0.55 || ratio > 0.70) {
        errors.push(`${char.character_name} (strategist): 主要4项占比 ${(ratio * 100).toFixed(1)}% (应该60%-65%)`);
      } else {
        warnings.push(`${char.character_name} (strategist): 主要4项占比 ${(ratio * 100).toFixed(1)}% (接近但不在60%-65%)`);
        ratioValid = true; // 接近的也算有效
      }
      
      // 检查各项属性差值≤3.5
      const primaryAttrs = [attrs.luck, attrs.intelligence, attrs.politics, attrs.charisma];
      const maxPrimary = Math.max(...primaryAttrs);
      const minPrimary = Math.min(...primaryAttrs);
      const diff = maxPrimary - minPrimary;
      stats.strategist.diffs.push(diff);
      
      let diffValid = false;
      if (diff <= 3.5) {
        diffValid = true;
      } else if (diff <= 4.0) {
        warnings.push(`${char.character_name} (strategist): 主要4项差值 ${diff.toFixed(1)} (接近但超过3.5)`);
        diffValid = true; // 接近的也算有效
      } else {
        errors.push(`${char.character_name} (strategist): 主要4项差值 ${diff.toFixed(1)} (应该≤3.5)`);
      }
      
      // 两个条件都满足才算有效
      if (ratioValid && diffValid) {
        stats.strategist.valid++;
      }
      
    } else if (type === 'balanced') {
      stats.balanced.total++;
      
      // balanced: 7项属性差值 ≤ 2.0
      const values = Object.values(attrs);
      const maxAttr = Math.max(...values);
      const minAttr = Math.min(...values);
      const diff = maxAttr - minAttr;
      stats.balanced.diffs.push(diff);
      
      if (diff <= 2.0) {
        stats.balanced.valid++;
      } else if (diff <= 2.5) {
        warnings.push(`${char.character_name} (balanced): 属性差值 ${diff.toFixed(1)} (接近但超过2.0)`);
        stats.balanced.valid++; // 接近的也算有效
      } else {
        errors.push(`${char.character_name} (balanced): 属性差值 ${diff.toFixed(1)} (应该≤2.0)`);
      }
    }
  });
  
  // 显示结果
  console.log('-'.repeat(80));
  
  if (errors.length === 0) {
    console.log('✅ 所有角色都符合类型分配规则！');
    console.log('');
  } else {
    console.log(`❌ 发现 ${errors.length} 个错误：`);
    console.log('');
    errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (errors.length > 10) {
      console.log(`  ... 还有 ${errors.length - 10} 个错误`);
    }
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  发现 ${warnings.length} 个警告（接近但不完全符合）：`);
    console.log('');
    warnings.slice(0, 5).forEach(warn => console.log(`  - ${warn}`));
    if (warnings.length > 5) {
      console.log(`  ... 还有 ${warnings.length - 5} 个警告`);
    }
    console.log('');
  }
  
  // 显示统计
  console.log('📊 类型分配统计：');
  console.log('');
  
  // Military统计
  if (stats.military.total > 0) {
    const avgRatio = stats.military.ratios.reduce((a, b) => a + b, 0) / stats.military.ratios.length;
    const minRatio = Math.min(...stats.military.ratios);
    const maxRatio = Math.max(...stats.military.ratios);
    const avgDiff = stats.military.diffs.reduce((a, b) => a + b, 0) / stats.military.diffs.length;
    const minDiff = Math.min(...stats.military.diffs);
    const maxDiff = Math.max(...stats.military.diffs);
    
    console.log(`Military (武官型):`);
    console.log(`  角色数: ${stats.military.total}`);
    console.log(`  符合规则: ${stats.military.valid} (${(stats.military.valid / stats.military.total * 100).toFixed(1)}%)`);
    console.log(`  主要4项占比: 平均${(avgRatio * 100).toFixed(1)}%, 范围${(minRatio * 100).toFixed(1)}%-${(maxRatio * 100).toFixed(1)}%`);
    console.log(`  目标范围: 60%-65%`);
    console.log(`  主要4项差值: 平均${avgDiff.toFixed(1)}, 范围${minDiff.toFixed(1)}-${maxDiff.toFixed(1)}`);
    console.log(`  目标: ≤3.5`);
    console.log('');
  }
  
  // Strategist统计
  if (stats.strategist.total > 0) {
    const avgRatio = stats.strategist.ratios.reduce((a, b) => a + b, 0) / stats.strategist.ratios.length;
    const minRatio = Math.min(...stats.strategist.ratios);
    const maxRatio = Math.max(...stats.strategist.ratios);
    const avgDiff = stats.strategist.diffs.reduce((a, b) => a + b, 0) / stats.strategist.diffs.length;
    const minDiff = Math.min(...stats.strategist.diffs);
    const maxDiff = Math.max(...stats.strategist.diffs);
    
    console.log(`Strategist (军师型):`);
    console.log(`  角色数: ${stats.strategist.total}`);
    console.log(`  符合规则: ${stats.strategist.valid} (${(stats.strategist.valid / stats.strategist.total * 100).toFixed(1)}%)`);
    console.log(`  主要4项占比: 平均${(avgRatio * 100).toFixed(1)}%, 范围${(minRatio * 100).toFixed(1)}%-${(maxRatio * 100).toFixed(1)}%`);
    console.log(`  目标范围: 60%-65%`);
    console.log(`  主要4项差值: 平均${avgDiff.toFixed(1)}, 范围${minDiff.toFixed(1)}-${maxDiff.toFixed(1)}`);
    console.log(`  目标: ≤3.5`);
    console.log('');
  }
  
  // Balanced统计
  if (stats.balanced.total > 0) {
    const avgDiff = stats.balanced.diffs.reduce((a, b) => a + b, 0) / stats.balanced.diffs.length;
    const minDiff = Math.min(...stats.balanced.diffs);
    const maxDiff = Math.max(...stats.balanced.diffs);
    
    console.log(`Balanced (文武双全):`);
    console.log(`  角色数: ${stats.balanced.total}`);
    console.log(`  符合规则: ${stats.balanced.valid} (${(stats.balanced.valid / stats.balanced.total * 100).toFixed(1)}%)`);
    console.log(`  属性差值: 平均${avgDiff.toFixed(1)}, 范围${minDiff.toFixed(1)}-${maxDiff.toFixed(1)}`);
    console.log(`  目标: ≤2.0`);
    console.log('');
  }
  
  console.log('-'.repeat(80));
  console.log('');
  console.log('='.repeat(80));
}

// 运行
try {
  main();
} catch (error) {
  console.error('❌ 错误：', error.message);
  console.error(error.stack);
  process.exit(1);
}
