/**
 * 功能卡片组件
 * 
 * @description 首页功能导航卡片
 */

import React from 'react';
import { Link } from 'react-router-dom';

function FeatureCard({ icon, title, description, link, className = "" }) {
  return (
    <Link to={link}>
      <div className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col ${className}`}>
        <div className="text-4xl mb-4 text-center">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">{title}</h3>
        <p className="text-sm text-gray-600 text-center">{description}</p>
      </div>
    </Link>
  );
}

export default FeatureCard;
