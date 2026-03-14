/**
 * IP工具函数测试
 */

const { getIPv6Prefix, isSameNetwork, getIPPattern } = require('./ipUtils');

console.log('========== IPv6前缀提取测试 ==========');
console.log('测试1:', getIPv6Prefix('2403:6200:8892:87d7:5454:9a9c:9f68:cc61'));
console.log('预期: 2403:6200:8892:87d7');
console.log('');

console.log('测试2:', getIPv6Prefix('2403:6200:8892:87d7:3c17:8f69:a8a4:7813'));
console.log('预期: 2403:6200:8892:87d7');
console.log('');

console.log('========== 同一网络检测测试 ==========');
const ip1 = '2403:6200:8892:87d7:5454:9a9c:9f68:cc61';
const ip2 = '2403:6200:8892:87d7:3c17:8f69:a8a4:7813';
console.log('IP1:', ip1);
console.log('IP2:', ip2);
console.log('是否同一网络:', isSameNetwork(ip1, ip2));
console.log('预期: true');
console.log('');

console.log('========== IP模式生成测试 ==========');
console.log('IPv6:', getIPPattern('2403:6200:8892:87d7:5454:9a9c:9f68:cc61'));
console.log('预期: 2403:6200:8892:87d7:%');
console.log('');

console.log('IPv4:', getIPPattern('192.168.1.1'));
console.log('预期: 192.168.1.1');
console.log('');

console.log('========== SQL查询示例 ==========');
const testIP = '2403:6200:8892:87d7:5454:9a9c:9f68:cc61';
const pattern = getIPPattern(testIP);
console.log(`SELECT * FROM accounts WHERE clientIP LIKE '${pattern}'`);
console.log('这将匹配所有前缀为 2403:6200:8892:87d7 的IPv6地址');
