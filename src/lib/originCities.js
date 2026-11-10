// Quick navigation suggestions; not a claim that a city has an active rail rate.
export const originAreas=[
 ['all','全部地区','All regions'],
 ['east','华东','East China'],
 ['south','华南','South China'],
 ['north','华北','North China'],
 ['central','华中','Central China'],
 ['southwest','西南','Southwest China'],
 ['northwest','西北','Northwest China'],
 ['northeast','东北','Northeast China']
];
const cities={
 east:['上海','宁波','杭州','义乌','温州','嘉兴','湖州','绍兴','金华','南京','苏州','太仓','昆山','无锡','常州','南通','镇江','扬州','徐州','合肥','芜湖','济南','青岛','烟台','临沂','潍坊','厦门','福州','泉州','南昌'],
 south:['深圳','广州','东莞','佛山','中山','珠海','惠州','汕头','南宁','柳州','桂林','海口','三亚'],
 north:['北京','天津','石家庄','唐山','保定','廊坊','太原','大同','呼和浩特','包头'],
 central:['郑州','洛阳','武汉','襄阳','长沙','株洲','岳阳'],
 southwest:['成都','重庆','贵阳','昆明','绵阳','德阳','宜宾','遵义','南充'],
 northwest:['西安','咸阳','宝鸡','兰州','银川','西宁','乌鲁木齐','霍尔果斯','阿拉山口'],
 northeast:['沈阳','大连','长春','哈尔滨','满洲里','齐齐哈尔']
};
export const originCitiesByArea=area=>area==='all'?[...new Set(Object.values(cities).flat())]:cities[area]||[];
