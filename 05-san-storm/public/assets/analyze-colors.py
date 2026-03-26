from PIL import Image
import os
from collections import Counter

# 图片路径
base_path = '.'
faction_ids = ['1001', '1101', '1201', '1301', '1401', '1501', '1601', '1701']

faction_names = {
    '1001': '通用势力',
    '1101': '刘备',
    '1201': '曹操',
    '1301': '孙坚',
    '1401': '袁绍',
    '1501': '董卓',
    '1601': '汉室',
    '1701': '黄巾'
}

print('势力图标色彩分析：')
print('=' * 80)

for fid in faction_ids:
    img_path = f'faction_{fid}.png'
    if os.path.exists(img_path):
        img = Image.open(img_path)
        img = img.convert('RGB')
        
        # 获取图片尺寸
        width, height = img.size
        
        # 采样整个图片，排除透明和黑色边框
        colors = []
        for y in range(height):
            for x in range(width):
                pixel = img.getpixel((x, y))
                r, g, b = pixel[0], pixel[1], pixel[2]
                
                # 排除黑色边框和过暗的颜色
                if r > 30 or g > 30 or b > 30:
                    # 排除接近白色的背景
                    if not (r > 240 and g > 240 and b > 240):
                        colors.append((r, g, b))
        
        if colors:
            # 计算平均颜色（排除极值）
            avg_r = sum(c[0] for c in colors) // len(colors)
            avg_g = sum(c[1] for c in colors) // len(colors)
            avg_b = sum(c[2] for c in colors) // len(colors)
            
            hex_color = f'#{avg_r:02X}{avg_g:02X}{avg_b:02X}'
            
            name = faction_names.get(fid, '未知')
            print(f'faction_{fid} ({name:8s}): {hex_color}  RGB({avg_r:3d}, {avg_g:3d}, {avg_b:3d})')
        else:
            print(f'faction_{fid}: 无法提取颜色')
    else:
        print(f'faction_{fid}: 文件不存在')

print('=' * 80)
