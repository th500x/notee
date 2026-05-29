/**
 * 游戏侧注入部队元数据目录，供 `@shared/utils/troopIconUrls` 战役地图等 lookup 使用。
 * shared 层不直接 import `public/data`。
 */
import troopsCatalog from '../../../public/data/shared/troops.json';
import { configureTroopIconMetaCatalog } from '@shared/utils/troopIconUrls';

configureTroopIconMetaCatalog(troopsCatalog);

export default troopsCatalog;
