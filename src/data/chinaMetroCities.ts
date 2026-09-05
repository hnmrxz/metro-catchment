/**
 * 中国已开通轨道交通（地铁/轻轨/单轨/APM）城市数据集。
 * - adcode：高德地铁图 / 高德城市编码（前 4 位，直辖市为 XX00）。
 * - center：市中心近似坐标（用于地图定位；真实模式下亦可用 Geocoder 精确定位）。
 * - en / provinceEn：拼音（小写），用于分组排序。
 */

export interface MetroCity {
  adcode: string
  /** 中文城市名 */
  name: string
  /** 城市拼音（小写，排序用） */
  en: string
  /** 省份中文名 */
  province: string
  /** 省份拼音（小写，排序用） */
  provinceEn: string
  /** 市中心坐标 [lng, lat] */
  center: [number, number]
  /** 默认缩放级别 */
  zoom: number
}

export const CHINA_METRO_CITIES: MetroCity[] = [
  // 直辖市
  { adcode: '1100', name: '北京', en: 'beijing', province: '北京', provinceEn: 'beijing', center: [116.407, 39.904], zoom: 11 },
  { adcode: '1200', name: '天津', en: 'tianjin', province: '天津', provinceEn: 'tianjin', center: [117.201, 39.084], zoom: 11 },
  { adcode: '3100', name: '上海', en: 'shanghai', province: '上海', provinceEn: 'shanghai', center: [121.474, 31.23], zoom: 11 },
  { adcode: '5000', name: '重庆', en: 'chongqing', province: '重庆', provinceEn: 'chongqing', center: [106.551, 29.563], zoom: 11 },

  // 河北
  { adcode: '1301', name: '石家庄', en: 'shijiazhuang', province: '河北', provinceEn: 'hebei', center: [114.515, 38.042], zoom: 12 },
  // 山西
  { adcode: '1401', name: '太原', en: 'taiyuan', province: '山西', provinceEn: 'shanxi', center: [112.549, 37.857], zoom: 12 },
  // 内蒙古
  { adcode: '1501', name: '呼和浩特', en: 'huhehaote', province: '内蒙古', provinceEn: 'neimenggu', center: [111.75, 40.842], zoom: 12 },
  // 辽宁
  { adcode: '2101', name: '沈阳', en: 'shenyang', province: '辽宁', provinceEn: 'liaoning', center: [123.431, 41.806], zoom: 11 },
  { adcode: '2102', name: '大连', en: 'dalian', province: '辽宁', provinceEn: 'liaoning', center: [121.615, 38.914], zoom: 12 },
  // 吉林
  { adcode: '2201', name: '长春', en: 'changchun', province: '吉林', provinceEn: 'jilin', center: [125.324, 43.817], zoom: 12 },
  // 黑龙江
  { adcode: '2301', name: '哈尔滨', en: 'haerbin', province: '黑龙江', provinceEn: 'heilongjiang', center: [126.535, 45.803], zoom: 11 },

  // 江苏
  { adcode: '3201', name: '南京', en: 'nanjing', province: '江苏', provinceEn: 'jiangsu', center: [118.797, 32.06], zoom: 11 },
  { adcode: '3202', name: '无锡', en: 'wuxi', province: '江苏', provinceEn: 'jiangsu', center: [120.312, 31.491], zoom: 12 },
  { adcode: '3203', name: '徐州', en: 'xuzhou', province: '江苏', provinceEn: 'jiangsu', center: [117.284, 34.205], zoom: 12 },
  { adcode: '3204', name: '常州', en: 'changzhou', province: '江苏', provinceEn: 'jiangsu', center: [119.947, 31.772], zoom: 12 },
  { adcode: '3205', name: '苏州', en: 'suzhou', province: '江苏', provinceEn: 'jiangsu', center: [120.585, 31.299], zoom: 11 },
  { adcode: '3206', name: '南通', en: 'nantong', province: '江苏', provinceEn: 'jiangsu', center: [120.894, 31.98], zoom: 12 },

  // 浙江
  { adcode: '3301', name: '杭州', en: 'hangzhou', province: '浙江', provinceEn: 'zhejiang', center: [120.15, 30.28], zoom: 12 },
  { adcode: '3302', name: '宁波', en: 'ningbo', province: '浙江', provinceEn: 'zhejiang', center: [121.55, 29.868], zoom: 12 },
  { adcode: '3303', name: '温州', en: 'wenzhou', province: '浙江', provinceEn: 'zhejiang', center: [120.672, 27.994], zoom: 12 },
  { adcode: '3306', name: '绍兴', en: 'shaoxing', province: '浙江', provinceEn: 'zhejiang', center: [120.582, 30.03], zoom: 12 },
  { adcode: '3307', name: '金华', en: 'jinhua', province: '浙江', provinceEn: 'zhejiang', center: [119.647, 29.079], zoom: 12 },
  { adcode: '3310', name: '台州', en: 'taizhou', province: '浙江', provinceEn: 'zhejiang', center: [121.42, 28.656], zoom: 12 },

  // 安徽
  { adcode: '3401', name: '合肥', en: 'hefei', province: '安徽', provinceEn: 'anhui', center: [117.283, 31.861], zoom: 12 },
  { adcode: '3402', name: '芜湖', en: 'wuhu', province: '安徽', provinceEn: 'anhui', center: [118.433, 31.352], zoom: 12 },
  // 福建
  { adcode: '3501', name: '福州', en: 'fuzhou', province: '福建', provinceEn: 'fujian', center: [119.296, 26.074], zoom: 12 },
  { adcode: '3502', name: '厦门', en: 'xiamen', province: '福建', provinceEn: 'fujian', center: [118.089, 24.48], zoom: 12 },
  // 江西
  { adcode: '3601', name: '南昌', en: 'nanchang', province: '江西', provinceEn: 'jiangxi', center: [115.858, 28.683], zoom: 12 },

  // 山东
  { adcode: '3701', name: '济南', en: 'jinan', province: '山东', provinceEn: 'shandong', center: [117.121, 36.652], zoom: 12 },
  { adcode: '3702', name: '青岛', en: 'qingdao', province: '山东', provinceEn: 'shandong', center: [120.383, 36.067], zoom: 11 },
  // 河南
  { adcode: '4101', name: '郑州', en: 'zhengzhou', province: '河南', provinceEn: 'henan', center: [113.625, 34.746], zoom: 11 },
  { adcode: '4103', name: '洛阳', en: 'luoyang', province: '河南', provinceEn: 'henan', center: [112.454, 34.619], zoom: 12 },
  // 湖北
  { adcode: '4201', name: '武汉', en: 'wuhan', province: '湖北', provinceEn: 'hubei', center: [114.305, 30.593], zoom: 11 },
  // 湖南
  { adcode: '4301', name: '长沙', en: 'changsha', province: '湖南', provinceEn: 'hunan', center: [112.938, 28.228], zoom: 11 },

  // 广东
  { adcode: '4401', name: '广州', en: 'guangzhou', province: '广东', provinceEn: 'guangdong', center: [113.264, 23.129], zoom: 11 },
  { adcode: '4403', name: '深圳', en: 'shenzhen', province: '广东', provinceEn: 'guangdong', center: [114.057, 22.543], zoom: 11 },
  { adcode: '4406', name: '佛山', en: 'foshan', province: '广东', provinceEn: 'guangdong', center: [113.122, 23.021], zoom: 11 },
  { adcode: '4419', name: '东莞', en: 'dongguan', province: '广东', provinceEn: 'guangdong', center: [113.752, 23.021], zoom: 11 },
  // 广西
  { adcode: '4501', name: '南宁', en: 'nanning', province: '广西', provinceEn: 'guangxi', center: [108.366, 22.817], zoom: 12 },

  // 四川
  { adcode: '5101', name: '成都', en: 'chengdu', province: '四川', provinceEn: 'sichuan', center: [104.066, 30.587], zoom: 11 },
  // 贵州
  { adcode: '5201', name: '贵阳', en: 'guiyang', province: '贵州', provinceEn: 'guizhou', center: [106.63, 26.647], zoom: 12 },
  // 云南
  { adcode: '5301', name: '昆明', en: 'kunming', province: '云南', provinceEn: 'yunnan', center: [102.833, 24.88], zoom: 12 },
  // 陕西
  { adcode: '6101', name: '西安', en: 'xian', province: '陕西', provinceEn: 'shaanxi', center: [108.94, 34.341], zoom: 11 },
  // 甘肃
  { adcode: '6201', name: '兰州', en: 'lanzhou', province: '甘肃', provinceEn: 'gansu', center: [103.834, 36.061], zoom: 12 },
  // 新疆
  { adcode: '6501', name: '乌鲁木齐', en: 'wulumuqi', province: '新疆', provinceEn: 'xinjiang', center: [87.617, 43.792], zoom: 12 },
]
