/**
 * 阅读设置面板组件
 * 提供字体、字号、行高等阅读设置
 */

function ReadingSettingsPanel({
  fontSize,
  lineHeight,
  fontFamily,
  fontOptions,
  onFontSizeChange,
  onLineHeightChange,
  onFontFamilyChange
}) {
  return (
    <div className="fixed top-20 right-4 bg-white rounded-lg shadow-lg p-4 z-10 hidden lg:block">
      <h4 className="text-sm font-medium text-gray-700 mb-3">阅读设置</h4>
      
      {/* 字体选择 */}
      <div className="mb-3">
        <label htmlFor="font-family-select" className="text-xs text-gray-600 block mb-1">
          字体
        </label>
        <select
          id="font-family-select"
          value={fontFamily}
          onChange={(e) => onFontFamilyChange(e.target.value)}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-gold"
        >
          {fontOptions.map(font => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* 字体大小 */}
      <div className="mb-3">
        <div className="text-xs text-gray-600 block mb-1">字体大小</div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onFontSizeChange(Math.max(12, fontSize - 1))}
            className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300 transition-colors"
            aria-label="减小字号"
          >
            -
          </button>
          <span className="text-xs w-8 text-center">{fontSize}</span>
          <button
            onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
            className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300 transition-colors"
            aria-label="增大字号"
          >
            +
          </button>
        </div>
      </div>

      {/* 行高 */}
      <div className="mb-3">
        <div className="text-xs text-gray-600 block mb-1">行高</div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onLineHeightChange(Math.max(1.2, lineHeight - 0.1))}
            className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300 transition-colors"
            aria-label="减小行高"
          >
            -
          </button>
          <span className="text-xs w-8 text-center">{lineHeight.toFixed(1)}</span>
          <button
            onClick={() => onLineHeightChange(Math.min(2.5, lineHeight + 0.1))}
            className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300 transition-colors"
            aria-label="增大行高"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReadingSettingsPanel
