/**
 * IP地址工具函数
 * 
 * @description 处理IPv4和IPv6地址的比较和验证
 */

/**
 * 提取IPv6前缀（前64位）
 * @param {string} ipv6 - 完整的IPv6地址
 * @returns {string} IPv6前缀（前4组，共64位）
 * 
 * @example
 * getIPv6Prefix('2403:6200:8892:87d7:5454:9a9c:9f68:cc61')
 * // 返回: '2403:6200:8892:87d7'
 */
function getIPv6Prefix(ipv6) {
  if (!ipv6) return null;
  
  // IPv6地址格式：8组，每组16位，共128位
  // 前缀是前64位（前4组）
  const parts = ipv6.split(':');
  
  if (parts.length < 4) {
    // 不是有效的IPv6地址
    return ipv6;
  }
  
  // 返回前4组（前64位）
  return parts.slice(0, 4).join(':');
}

/**
 * 检查是否为IPv6地址
 * @param {string} ip - IP地址
 * @returns {boolean} 是否为IPv6
 */
function isIPv6(ip) {
  return ip && ip.includes(':');
}

/**
 * 检查是否为IPv4地址
 * @param {string} ip - IP地址
 * @returns {boolean} 是否为IPv4
 */
function isIPv4(ip) {
  return ip && ip.includes('.') && !ip.includes(':');
}

/**
 * 比较两个IP地址是否来自同一网络
 * @param {string} ip1 - 第一个IP地址
 * @param {string} ip2 - 第二个IP地址
 * @returns {boolean} 是否来自同一网络
 * 
 * @description
 * - IPv4: 完全匹配
 * - IPv6: 只比较前缀（前64位），因为IPv6隐私扩展会改变后64位
 */
function isSameNetwork(ip1, ip2) {
  if (!ip1 || !ip2) return false;
  
  // 如果都是IPv4，完全匹配
  if (isIPv4(ip1) && isIPv4(ip2)) {
    return ip1 === ip2;
  }
  
  // 如果都是IPv6，比较前缀
  if (isIPv6(ip1) && isIPv6(ip2)) {
    const prefix1 = getIPv6Prefix(ip1);
    const prefix2 = getIPv6Prefix(ip2);
    return prefix1 === prefix2;
  }
  
  // 一个IPv4一个IPv6，不可能相同
  return false;
}

/**
 * 获取用于数据库查询的IP模式
 * @param {string} ip - IP地址
 * @returns {string} SQL LIKE模式
 * 
 * @example
 * getIPPattern('2403:6200:8892:87d7:5454:9a9c:9f68:cc61')
 * // 返回: '2403:6200:8892:87d7:%'
 * 
 * getIPPattern('192.168.1.1')
 * // 返回: '192.168.1.1'
 */
function getIPPattern(ip) {
  if (!ip) return null;
  
  // IPv4: 完全匹配
  if (isIPv4(ip)) {
    return ip;
  }
  
  // IPv6: 前缀匹配
  if (isIPv6(ip)) {
    const prefix = getIPv6Prefix(ip);
    return `${prefix}:%`;
  }
  
  return ip;
}

module.exports = {
  getIPv6Prefix,
  isIPv6,
  isIPv4,
  isSameNetwork,
  getIPPattern
};
