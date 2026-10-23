import {Link,useLocation} from 'react-router';
import {getRouteLandingPage,routeQuoteSearch} from '../data/routeLandingPages';
export default function PublicConversionBar({locale='en'}){
 const {pathname}=useLocation();
 if(pathname==='/'||pathname==='/quote'||pathname.startsWith('/order'))return null;
 const route=pathname.startsWith('/routes/')?getRouteLandingPage(pathname.split('/')[2]):null;
 return <aside className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6"><p className="text-sm text-slate-600">{locale==='zh'?'先查运费，缺价由人工跟进。':'Check rates first; our team handles unmatched routes.'}</p><Link className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white" to={'/quote'+(route?routeQuoteSearch(route):'')}>{locale==='zh'?'获取报价':'Get a quote'}</Link></aside>;
}
