/**
 * 项目卡片组件
 */
export function ProjectCard({ project, onClick }) {
  const handleClick = () => {
    if (project.comingSoon) {
      onClick(project.name)
    } else if (project.path) {
      window.location.href = project.path
    }
  }
  
  return (
    <div 
      className={`card-hover bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer ${
        project.comingSoon ? 'opacity-50' : ''
      }`}
      onClick={handleClick}
    >
      <div 
        className="h-32 flex items-center justify-center"
        style={{ background: project.gradient }}
      >
        <div className="text-white text-center">
          <div className="text-4xl mb-2">{project.icon}</div>
          <h3 className="text-2xl font-bold">{project.name}</h3>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600 text-center whitespace-pre-line">
          {project.description}
        </p>
      </div>
    </div>
  )
}
