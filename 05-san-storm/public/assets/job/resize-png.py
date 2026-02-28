#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PNG图片批量缩放脚本
功能：
1. 将当前目录（仅本目录，不包括子文件夹）中的所有PNG图片缩放到指定分辨率
2. 保持透明背景
3. 直接覆盖原文件

使用方法：
1. 安装PIL库：pip install Pillow
2. 将此脚本放在需要处理的文件夹中
3. 双击运行或在命令行执行：python resize-png.py
"""

import os
from pathlib import Path
from PIL import Image

# 分辨率选项
RESOLUTION_OPTIONS = {
    "1": (64, 64, "64x64 - 瓦片/小图标"),
    "2": (256, 256, "256x256 - 中等图片"),
    "3": (384, 384, "384x384 - 大图片"),
    "4": (512, 512, "512x512 - 超大图片"),
    "5": (128, 64, "128x64 - 功能图片"),
    "6": (256, 128, "256x128 - 功能图片"),
    "7": (36, 36, "36x36 - 功能图片"),
    "8": (48, 48, "48x48 - 功能图片"),
}

def main():
    print("=" * 50)
    print("PNG图片批量缩放工具")
    print("=" * 50)
    print()
    
    # 获取当前目录
    current_path = Path.cwd()
    print(f"当前工作目录: {current_path}")
    print()
    
    # 获取当前目录下的所有PNG文件（不包括子文件夹）
    png_files = list(current_path.glob("*.png"))
    
    # 排除脚本自身所在目录的特殊文件
    png_files = [f for f in png_files if f.name not in ['resize-png.py']]
    
    if not png_files:
        print("当前目录未找到PNG文件！")
        input("\n按回车键退出...")
        return
    
    print(f"找到 {len(png_files)} 个PNG文件")
    print()
    
    # 显示将要处理的文件
    print("将要处理的文件：")
    for i, file_path in enumerate(png_files, 1):
        print(f"  {i}. {file_path.name}")
    print()
    
    # 选择分辨率
    print("请选择目标分辨率：")
    for key, (width, height, desc) in RESOLUTION_OPTIONS.items():
        print(f"  {key}. {desc}")
    print()
    
    while True:
        choice = input("请输入选项 (1/2/3/4/5/6/7/8): ").strip()
        if choice in RESOLUTION_OPTIONS:
            target_width, target_height, desc = RESOLUTION_OPTIONS[choice]
            break
        else:
            print("无效选项，请重新输入！")
    
    print()
    print(f"已选择: {desc}")
    print()
    




    print()
    print("开始处理...")
    print()
    
    # 计数器
    success_count = 0
    skip_count = 0
    error_count = 0
    
    # 处理每个PNG文件
    for file_path in png_files:
        try:
            print(f"处理: {file_path.name}")
            
            # 打开原图片
            with Image.open(file_path) as img:
                # 获取原图尺寸
                original_size = img.size
                print(f"  原始尺寸: {original_size[0]}x{original_size[1]}")
                
                # 如果已经是目标尺寸，跳过
                if original_size == (target_width, target_height):
                    print(f"  -> 跳过（已经是{target_width}x{target_height}）")
                    skip_count += 1
                    continue
                
                # 保持透明通道（如果有的话）
                if img.mode in ('RGBA', 'LA', 'P'):
                    # 转换为RGBA以保持透明度
                    if img.mode != 'RGBA':
                        img = img.convert('RGBA')
                    
                    # 缩放到目标尺寸（使用高质量重采样）
                    resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    
                    # 保存为PNG，保持透明度
                    resized_img.save(file_path, "PNG", optimize=True)
                else:
                    # 没有透明通道的图片
                    resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    resized_img.save(file_path, "PNG", optimize=True)
            
            print(f"  -> 成功: 已缩放到 {target_width}x{target_height}")
            success_count += 1
            
        except Exception as e:
            print(f"  -> 错误: {str(e)}")
            error_count += 1
    
    print()
    print("=" * 50)
    print("处理完成！")
    print("=" * 50)
    print(f"成功: {success_count} 个文件")
    print(f"跳过: {skip_count} 个文件")
    print(f"错误: {error_count} 个文件")
    print()
    input("按回车键退出...")

if __name__ == "__main__":
    main()
