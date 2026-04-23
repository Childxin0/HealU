// 判断当前是否为开发环境
const isDev = process.env.NODE_ENV === 'development';

// 填写你微信云托管的域名（部署成功后在控制台拿，先占位）
const CLOUD_URL = 'https://healu-xxx.run.tcloudbase.com'; 

export const API_BASE_URL = isDev ? 'http://localhost:3000' : CLOUD_URL;

export const resolveApiUrl = (path) => {
  return `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
};