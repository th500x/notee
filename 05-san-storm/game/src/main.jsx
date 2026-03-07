/**
 * 应用入口文件
 * 
 * @description React应用的入口点，负责渲染根组件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// 渲染应用
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
