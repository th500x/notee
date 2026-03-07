/**
 * 管理员设置组件
 * 
 * @description 机器指纹管理工具（仅开发环境）
 */

import React, { useState, useEffect } from 'react';
import { isDevelopment, getCurrentFingerprint, getAdminConfig } from '@/utils/adminAuth';

const AdminSetup = () => {
  const [fingerprint, setFingerprint] = useState('');
  const [adminConfig, setAdminConfig] = useState({});
  const [message, setMessage] = useState('');
  const isDevEnv = isDevelopment();

  useEffect(() => {
    const currentFingerprint = getCurrentFingerprint();
    const config = getAdminConfig();
    setFingerprint(currentFingerprint);
    setAdminConfig(config);
  }, []);

  const copyFingerprint = () => {
    navigator.clipboard.writeText(fingerprint).then(() => {
      setMessage('✅ 机器指纹已复制到剪贴板！');
      setTimeout(() => setMessage(''), 3000);
    }).catch(() => {
      setMessage('❌ 复制失败，请手动复制');
    });
  };

  const addToAdminList = () => {
    setMessage(`
📝 请按以下步骤添加管理员权限：

1. 打开文件：src/utils/adminAuth.js
2. 找到 ADMIN_FINGERPRINTS 数组
3. 添加你的机器指纹：
   const ADMIN_FINGERPRINTS = [
     '${fingerprint}',  // 你的机器指纹
     // 可以添加更多管理员机器指纹
   ];
4. 保存文件并重新部署

⚠️ 注意：生产环境部署后，只有配置的机器指纹才能看到用户管理功能！
    `);
  };

  return (
    <div className={`border rounded-lg p-4 mb-6 ${isDevEnv ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${isDevEnv ? 'text-yellow-900' : 'text-blue-900'}`}>
        🔧 机器指纹信息 {isDevEnv && '（开发环境）'}
      </h3>
      
      <div className="space-y-4">
        {/* 当前机器指纹 */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDevEnv ? 'text-yellow-800' : 'text-blue-800'}`}>
            当前机器指纹
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fingerprint}
              readOnly
              className={`flex-1 px-3 py-2 border rounded-md font-mono text-sm ${
                isDevEnv 
                  ? 'border-yellow-300 bg-yellow-100' 
                  : 'border-blue-300 bg-blue-100'
              }`}
            />
            <button
              onClick={copyFingerprint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📋 复制
            </button>
          </div>
        </div>

        {/* 权限状态 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-sm text-gray-600">当前环境</div>
            <div className="font-bold text-blue-900">
              {adminConfig.isDev ? '开发环境' : '生产环境'}
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-sm text-gray-600">管理员权限</div>
            <div className={`font-bold ${adminConfig.hasAccess ? 'text-green-900' : 'text-red-900'}`}>
              {adminConfig.hasAccess ? '✅ 有权限' : '❌ 无权限'}
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-sm text-gray-600">机器认证</div>
            <div className={`font-bold ${adminConfig.isAdminMachine ? 'text-green-900' : 'text-gray-600'}`}>
              {adminConfig.isAdminMachine ? '✅ 已认证' : '⏳ 未配置'}
            </div>
          </div>
        </div>

        {/* 操作按钮 - 只在开发环境显示 */}
        {isDevEnv && (
          <div className="flex gap-2">
            <button
              onClick={addToAdminList}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              📋 获取配置说明
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🔄 刷新权限状态
            </button>
          </div>
        )}
        
        {message && (
          <div className="text-sm text-yellow-800 bg-yellow-100 p-3 rounded-md whitespace-pre-line">
            {message}
          </div>
        )}
        
        {/* 已配置的管理员指纹 */}
        {adminConfig.adminFingerprints && adminConfig.adminFingerprints.length > 0 && (
          <div>
            <h4 className={`text-sm font-medium mb-2 ${isDevEnv ? 'text-yellow-800' : 'text-blue-800'}`}>
              已配置的管理员机器指纹：
            </h4>
            <div className="space-y-1">
              {adminConfig.adminFingerprints.map((fp, index) => (
                <div key={index} className={`font-mono text-xs p-2 rounded border ${
                  isDevEnv ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  {fp} {fp === fingerprint && <span className="text-green-600">（当前机器）</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 工作原理说明 - 只在开发环境显示 */}
        {isDevEnv && (
          <div className="text-xs text-yellow-700 border-t border-yellow-200 pt-3">
            <p><strong>工作原理：</strong></p>
            <p>• 基于浏览器指纹识别管理员机器，无需登录</p>
            <p>• 开发环境：所有机器都有管理员权限（方便调试）</p>
            <p>• 生产环境：只有配置的机器指纹才有管理员权限</p>
            <p>• 机器指纹基于：用户代理、语言、屏幕分辨率、时区、Canvas指纹</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSetup;