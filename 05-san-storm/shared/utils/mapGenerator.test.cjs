/**
 * mapGenerator 快速验证脚本（CommonJS，直接 node 运行）
 * node shared/utils/mapGenerator.test.cjs
 */

// 内联核心逻辑（避免 ESM import 问题）
const MAP_WIDTH  = 8;
const MAP_HEIGHT = 10;
const ZONE = { deployA:[0,1,2], combat:[3,4,5,6], deployB:[7,8,9] };
const TERRAIN = { PLAIN:'plain', FOREST:'forest', HILL:'hill', WASTE:'waste' };

class SeededRandom {
  constructor(seed) {
    this.seed = seed != null ? seed : Math.floor(Math.random() * 2147483647);
    this._state = this.seed;
  }
  next() { this._state = (this._state * 1664525 + 1013904223) & 0xffffffff; return (this._state >>> 0) / 0x100000000; }
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  weighted(items) { const t = items.reduce((s,i)=>s+i.weight,0); let r=this.next()*t; for(const i of items){r-=i.weight;if(r<=0)return i;} return items[items.length-1]; }
  pick(arr) { return arr[Math.floor(this.next()*arr.length)]; }
  chance(p) { return this.next() < p; }
}

// 简化版生成（直接 require 不支持 ESM，复制核心逻辑）
const { generateSmallMap, getTileLayers, getObjectImage } = (() => {
  // 粘贴核心函数（测试用）
  const CLUSTER_SIZE_WEIGHTS = [{size:2,weight:40},{size:3,weight:35},{size:4,weight:25}];
  const CLUSTER_SHAPES = {
    2:[[[0,0],[0,1]],[[0,0],[1,0]],[[0,0],[1,1]],[[0,1],[1,0]]],
    3:[[[0,0],[0,1],[0,2]],[[0,0],[1,0],[2,0]],[[0,0],[1,1],[2,2]],[[0,2],[1,1],[2,0]],[[0,0],[0,1],[1,0]],[[0,0],[0,1],[1,1]],[[0,0],[1,0],[1,1]],[[0,1],[1,0],[1,1]]],
    4:[[[0,0],[0,1],[1,0],[1,1]],[[0,0],[0,1],[0,2],[0,3]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[0,1],[0,2],[1,2]],[[0,0],[1,0],[1,1],[1,2]],[[0,0],[0,1],[1,1],[1,2]],[[0,1],[0,2],[1,0],[1,1]],[[0,0],[1,1],[2,2],[3,3]]],
  };
  const COMBAT_W = [{type:'forest',weight:40},{type:'hill',weight:35},{type:'waste',weight:25}];
  const DEPLOY_W = [{type:'forest',weight:50},{type:'hill',weight:50}];
  const OBJECT_TYPES = {
    rock: {isPassable:false,isDestructible:false,hp:null,trapDamage:null},
    fence:{isPassable:false,isDestructible:true, hp:500, trapDamage:null},
    trap: {isPassable:true, isDestructible:false,hp:null,trapDamage:50},
    chest:{isPassable:true, isDestructible:false,hp:null,trapDamage:null,isInteractable:true},
  };

  function inBounds(y,x){return y>=0&&y<MAP_HEIGHT&&x>=0&&x<MAP_WIDTH;}
  function applyShape(shape,sy,sx){return shape.map(([dy,dx])=>[sy+dy,sx+dx]);}
  function cellsInRows(cells,rows){return cells.every(([y,x])=>inBounds(y,x)&&rows.includes(y));}
  function hasConflict(nc,ec,gap=1){for(const[ny,nx]of nc)for(const[ey,ex]of ec)if(Math.abs(ny-ey)<=gap&&Math.abs(nx-ex)<=gap)return true;return false;}

  function generateCluster(rng,rows,cols,maxSize,weights,occupied,retries=15){
    const sw=CLUSTER_SIZE_WEIGHTS.filter(s=>s.size<=maxSize);
    for(let a=0;a<retries;a++){
      const size=rng.weighted(sw).size;
      const shape=rng.pick(CLUSTER_SHAPES[size]);
      const sy=rng.pick(rows),sx=rng.pick(cols);
      const cells=applyShape(shape,sy,sx);
      if(!cellsInRows(cells,rows))continue;
      if(hasConflict(cells,occupied,1))continue;
      return{type:rng.weighted(weights).type,cells};
    }
    return null;
  }

  function generateSmallMap({seed=null,battleRarity='common',bgTheme=null}={}){
    const rng=new SeededRandom(seed);
    const theme=bgTheme||(rng.chance(0.5)?'grassland':'wasteland');
    const bgV=rng.int(1,5),fV=rng.int(1,5),hV=rng.int(1,5);
    const variants={bgTheme:theme,bgVariant:String(bgV).padStart(2,'0'),forest:String(fV).padStart(2,'0'),hill:String(hV).padStart(2,'0')};
    const cx=rng.next();
    const complexity=cx<0.4?'simple':cx<0.8?'standard':'complex';

    const grid=Array.from({length:MAP_HEIGHT},()=>Array(MAP_WIDTH).fill('plain'));
    const occupied=[];
    const combatN={simple:3,standard:4,complex:5}[complexity];
    const allCols=[0,1,2,3,4,5,6,7];
    for(let i=0;i<combatN;i++){
      const c=generateCluster(rng,ZONE.combat,allCols,4,COMBAT_W,occupied);
      if(!c)continue;
      for(const[y,x]of c.cells){grid[y][x]=c.type;occupied.push([y,x]);}
    }
    const deployN={simple:1,standard:2,complex:3}[complexity];
    const edgeCols=[0,1,6,7];
    const occA=[];
    for(let i=0;i<deployN;i++){
      const c=generateCluster(rng,ZONE.deployA,edgeCols,3,DEPLOY_W,[...occupied,...occA]);
      if(!c)continue;
      for(const[y,x]of c.cells){grid[y][x]=c.type;occA.push([y,x]);}
    }
    const occB=[];
    for(let i=0;i<deployN;i++){
      const c=generateCluster(rng,ZONE.deployB,edgeCols,3,DEPLOY_W,[...occupied,...occB]);
      if(!c)continue;
      for(const[y,x]of c.cells){grid[y][x]=c.type;occB.push([y,x]);}
    }

    const objects=[];
    const objPos=[];
    const oRange={simple:[0,1],standard:[1,2],complex:[2,3]}[complexity];
    const oCount=rng.int(oRange[0],oRange[1]);
    const cands=[];
    for(const y of ZONE.combat)for(let x=1;x<=6;x++)if(grid[y][x]==='plain')cands.push([y,x]);
    const oTypes=['rock','fence','trap'];
    for(let i=0;i<oCount&&cands.length>0;i++){
      const idx=rng.int(0,cands.length-1);
      const[y,x]=cands.splice(idx,1)[0];
      if(objPos.some(([oy,ox])=>oy===y&&ox===x))continue;
      const type=rng.pick(oTypes);
      objects.push({type,x,y,...OBJECT_TYPES[type]});
      objPos.push([y,x]);
      if(!OBJECT_TYPES[type].isPassable)for(let di=cands.length-1;di>=0;di--){const[cy,cx]=cands[di];if(Math.abs(cy-y)<=1&&Math.abs(cx-x)<=1)cands.splice(di,1);}
    }
    if(rng.chance(0.20)){
      const cc=[];
      for(const y of[4,5])for(let x=2;x<=5;x++)if(grid[y][x]==='plain'&&!objPos.some(([oy,ox])=>oy===y&&ox===x))cc.push([y,x]);
      if(cc.length>0){const[cy,cx]=rng.pick(cc);objects.push({type:'chest',x:cx,y:cy,isOpen:false,rewardRarity:battleRarity,...OBJECT_TYPES.chest});}
    }
    let cnp=0;
    for(const y of ZONE.combat)for(let x=0;x<MAP_WIDTH;x++)if(grid[y][x]!=='plain')cnp++;
    return{terrain:grid,variants,objects,meta:{seed:rng.seed,complexity,bgTheme:theme,combatNonPlain:cnp,combatNonPlainRatio:+(cnp/(ZONE.combat.length*MAP_WIDTH)).toFixed(2),hasChest:objects.some(o=>o.type==='chest'),obstacleCount:objects.filter(o=>o.type!=='chest').length}};
  }

  return { generateSmallMap };
})();

// ── 测试 ──────────────────────────────────────────────────────────────────────

const ICONS = { plain:'·', forest:'🌲', hill:'⛰️', waste:'🏜️' };
const OBJ_ICONS = { rock:'🪨', fence:'🚧', trap:'⚠️', chest:'📦' };

function printMap(result) {
  const { terrain, objects, variants, meta } = result;
  const objMap = {};
  for (const o of objects) objMap[`${o.y},${o.x}`] = o;

  console.log(`\n主题: ${variants.bgTheme} | 底色变体: ${variants.bgVariant} | 树林: forest_${variants.forest} | 丘陵: hill_${variants.hill}`);
  console.log(`复杂度: ${meta.complexity} | 种子: ${meta.seed} | 非平原占比: ${(meta.combatNonPlainRatio*100).toFixed(0)}% | 宝箱: ${meta.hasChest?'✅':'❌'} | 障碍物: ${meta.obstacleCount}`);
  console.log('');
  console.log('     0  1  2  3  4  5  6  7');

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const zone = ZONE.deployA.includes(y) ? 'A' : ZONE.deployB.includes(y) ? 'B' : '⚔';
    let row = `${zone} ${y} `;
    for (let x = 0; x < MAP_WIDTH; x++) {
      const key = `${y},${x}`;
      if (objMap[key]) {
        row += (OBJ_ICONS[objMap[key].type] || '?') + ' ';
      } else {
        const t = terrain[y][x];
        row += (ICONS[t] || t[0]) + '  ';
      }
    }
    console.log(row);
  }
}

// 运行3个测试
console.log('═══════════════════════════════════════');
console.log('  mapGenerator 验证');
console.log('═══════════════════════════════════════');

for (let i = 0; i < 3; i++) {
  const result = generateSmallMap({ battleRarity: 'epic' });
  printMap(result);
}

// 种子复现测试
console.log('\n── 种子复现测试（seed=42，两次应完全相同）──');
const r1 = generateSmallMap({ seed: 42 });
const r2 = generateSmallMap({ seed: 42 });
const same = JSON.stringify(r1.terrain) === JSON.stringify(r2.terrain) &&
             JSON.stringify(r1.objects) === JSON.stringify(r2.objects);
console.log(same ? '✅ 种子复现正常' : '❌ 种子复现失败');
printMap(r1);
