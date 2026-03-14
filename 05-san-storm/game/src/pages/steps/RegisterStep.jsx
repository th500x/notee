/**
 * 注册步骤
 */

import { useState, useEffect } from 'react';
import { gameUserAPI } from '@/services/api';
import { 
  generateIdOptions, 
  getMachineFingerprint, 
  getClientIPAndLocation 
} from '@/pages/steps/authUtils';
import UserAgreementModal from '@/components/auth/UserAgreementModal';

export function RegisterStep({ selectedServer, onRegisterSuccess, onBack }) {
  const [selectedId, setSelectedId] = useState('');
  const [availableIds, setAvailableIds] = useState([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const result = generateIdOptions();
    setAvailableIds(result.ids);
  }, []);

  const handleIdSelect = (id) => {
    setSelectedId(id);
    setError('');
  };

  const handleStartRegister = () => {
    setShowAgreementModal(true);
  };

  const handleAgreeAgreement = () => {
    setAgreedToTerms(true);
    setShowAgreementModal(false);
  };

  const handleCancelAgreement = () => {
    setShowAgreementModal(false);
  };

  const handleRegisterSubmit = async () => {
    if (!password || !confirmPassword) {
      setError('请输入密码');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!birthMonth) {
      setError('请选择生日月份');
      return;
    }

    if (!agreedToTerms) {
      setError('请先阅读并同意用户协议');
      return;
    }

    setLoading(true);
    
    try {
      const machineId = getMachineFingerprint();
      const locationData = await getClientIPAndLocation();
      
      const result = await gameUserAPI.register({
        id: selectedId,
        password: password,
        serverId: selectedServer.id,
        machineId: machineId,
        clientIP: locationData.ip,
        province: locationData.province,
        city: locationData.city,
        birthMonth: parseInt(birthMonth)
      });
      
      if (!result.success) {
        setError(result.error || '注册失败');
        setLoading(false);
        return;
      }

      const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
      registeredIds.push(selectedId);
      localStorage.setItem('registeredIds', JSON.stringify(registeredIds));

      const userData = {
        ...result.data,
        serverName: selectedServer.name
      };
      
      onRegisterSuccess(userData);
      setError('');
    } catch (err) {
      setError('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <UserAgreementModal
        isOpen={showAgreementModal}
        onAgree={handleAgreeAgreement}
        onCancel={handleCancelAgreement}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
          注册新账号
        </h2>
        
        {!selectedId ? (
          <div>
            {availableIds.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">😱</div>
                <h3 className="text-lg font-bold text-red-900 mb-2">所有ID已用完！</h3>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">请选择你的游戏ID：</p>
                <div className="space-y-2 mb-6">
                  {availableIds.map(id => (
                    <button
                      key={id}
                      onClick={() => handleIdSelect(id)}
                      className="w-full py-3 px-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left font-mono text-lg"
                    >
                      <span className="text-blue-600 font-bold">{id[0]}</span>
                      <span className="text-gray-800">{id.slice(1)}</span>
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => {
                    const result = generateIdOptions();
                    setAvailableIds(result.ids);
                  }}
                  className="w-full py-2 px-4 text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                >
                  🔄 刷新ID选项
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">已选择ID：</p>
              <p className="text-xl font-mono font-bold text-blue-900">{selectedId}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  设置密码（至少6位）
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入密码"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  确认密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请再次输入密码"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  生日月份 <span className="text-red-500">*</span>
                </label>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择生日月份</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {month}月
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">用于每月自动发放生日礼物</p>
              </div>
              
              {!agreedToTerms && (
                <button
                  onClick={handleStartRegister}
                  className="w-full py-2 px-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
                >
                  📜 阅读并同意用户协议
                </button>
              )}
              
              {agreedToTerms && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  ✅ 已同意用户协议
                </div>
              )}
              
              {error && <div className="text-red-600 text-sm">{error}</div>}
              
              <button
                onClick={handleRegisterSubmit}
                disabled={loading || !agreedToTerms}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {loading ? '注册中...' : '完成注册'}
              </button>
              
              <button
                onClick={() => setSelectedId('')}
                className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
              >
                 重新选择ID
              </button>
            </div>
          </div>
        )}
        
        <button
          onClick={onBack}
          className="w-full mt-4 py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
           返回
        </button>
      </div>
    </div>
  );
}
