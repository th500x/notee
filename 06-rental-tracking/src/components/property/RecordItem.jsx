/**
 * 单条收支记录组件
 */
function RecordItem({ 
  record, 
  index,
  onEdit, 
  onDelete, 
  onPhotoClick,
  onUploadPhoto,
  isAdmin 
}) {
  return (
    <div className="bg-gray-50 p-3 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-700">{record.date}</span>
            {record.isPaid && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                已缴租
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">{record.note || '无备注'}</div>
        </div>
        <div className="text-right">
          {record.income > 0 && (
            <div className="text-green-600 font-medium">+¥{record.income.toLocaleString()}</div>
          )}
          {record.expenses > 0 && (
            <div className="text-red-600 font-medium">-¥{record.expenses.toLocaleString()}</div>
          )}
        </div>
      </div>
      
      {/* 照片显示 */}
      {record.photos && record.photos.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {record.photos.map((photo, photoIndex) => (
            <img
              key={photoIndex}
              src={photo}
              alt={`记录照片 ${photoIndex + 1}`}
              className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onPhotoClick(record.photos, photoIndex)}
            />
          ))}
        </div>
      )}
      
      {isAdmin && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onEdit(index)}
            className="flex-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
          >
            编辑
          </button>
          <button
            onClick={() => onUploadPhoto(index)}
            className="flex-1 px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200"
          >
            上传照片
          </button>
          <button
            onClick={() => onDelete(index)}
            className="flex-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}

export default RecordItem;
