/**
 * 注册/登录选择步骤
 */

export function AuthChoiceStep({ onStartRegister, onStartLogin, onBack }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
          欢迎来到《真三风云》
        </h2>
        <p className="text-gray-600 mb-6 text-center">请选择注册或登录</p>

        <div className="space-y-4">
          <button
            type="button"
            onClick={onStartRegister}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🆕 新用户注册
          </button>

          <button
            type="button"
            onClick={onStartLogin}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            🔑 已有账号登录
          </button>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="w-full mt-4 py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← 返回服务器选择
        </button>
      </div>
    </div>
  );
}
