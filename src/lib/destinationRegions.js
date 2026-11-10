// Destination region is a navigation aid only; unknown stops remain in "Other".
const groups=[
 ['europe',/德国|汉堡|杜伊斯堡|不来梅|慕尼黑|柏林|波兰|马拉舍维奇|华沙|罗兹|罗德兹|格但斯克|卡托维兹|捷克|布拉格|布尔诺|匈牙利|布达佩斯|意大利|米兰|维罗纳|法国|巴黎|里昂|荷兰|鹿特丹|阿姆斯特丹|比利时|列日|英国|伦敦|曼海姆|科隆|斯洛伐克|奥地利|维也纳|塞尔维亚|贝尔格莱德|hamburg|duisburg|bremen|munich|berlin|malaszewic|warsaw|lodz|gdansk|katowice|prague|brno|budapest|milan|verona|paris|lyon|rotterdam|amsterdam|liege|london|mannheim|cologne|vienna|belgrade|germany|poland|czech|hungary|italy|france|netherlands|belgium|austria|europe|tilbury/i],
 ['russia',/俄罗斯|莫斯科|圣彼得堡|叶卡捷琳堡|新西伯利亚|赤塔|伊尔库茨克|后贝加尔|克列西哈|moscow|petersburg|yekaterinburg|novosibirsk|chita|irkutsk|zabaikalsk|kleshchikha|russia/i],
 ['central',/哈萨克|阿拉木图|阿斯塔纳|阿腾科里|多斯特克|乌兹别克|塔什干|吉尔吉斯|比什凯克|塔吉克|杜尚别|土库曼|阿什哈巴德|马雷|almaty|astana|altynkol|dostyk|tashkent|bishkek|dushanbe|ashgabat|kazakhstan|uzbekistan|kyrgyzstan|tajikistan|turkmenistan/i],
 ['westasia',/伊朗|德黑兰|土耳其|伊斯坦布尔|巴库|阿塞拜疆|格鲁吉亚|阿富汗|喀布尔|tehran|iran|istanbul|turkey|baku|azerbaijan|georgia|afghanistan|kabul/i],
 ['china',/中国|宁波|上海|苏州|西安|郑州|义乌|成都|重庆|深圳|广州|南京|武汉|合肥|天津|青岛|满洲里|二连浩特|阿拉山口|霍尔果斯|ningbo|shanghai|suzhou|xian|zhengzhou|yiwu|chengdu|chongqing|shenzhen|guangzhou|nanjing|wuhan|hefei|tianjin|qingdao|manzhouli|erenhot|alashankou|khorgos|china/i]
];
export const destinationRegion=(name)=>groups.find(([,pattern])=>pattern.test(String(name||'')))?.[0]||'other';
export const destinationRegions=[
 ['all','全部区域','All regions'],['europe','欧洲','Europe'],['russia','俄罗斯','Russia'],['central','中亚','Central Asia'],['westasia','西亚及其他','West Asia'],['china','中国','China'],['other','其他站点','Other destinations']
];
