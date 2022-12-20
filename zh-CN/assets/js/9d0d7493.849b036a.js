"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[285],{4852:(e,t,r)=>{r.d(t,{Zo:()=>s,kt:()=>f});var n=r(9231);function l(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function a(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function o(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?a(Object(r),!0).forEach((function(t){l(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):a(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function i(e,t){if(null==e)return{};var r,n,l=function(e,t){if(null==e)return{};var r,n,l={},a=Object.keys(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||(l[r]=e[r]);return l}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(l[r]=e[r])}return l}var c=n.createContext({}),u=function(e){var t=n.useContext(c),r=t;return e&&(r="function"==typeof e?e(t):o(o({},t),e)),r},s=function(e){var t=u(e.components);return n.createElement(c.Provider,{value:t},e.children)},p="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var r=e.components,l=e.mdxType,a=e.originalType,c=e.parentName,s=i(e,["components","mdxType","originalType","parentName"]),p=u(r),m=l,f=p["".concat(c,".").concat(m)]||p[m]||d[m]||a;return r?n.createElement(f,o(o({ref:t},s),{},{components:r})):n.createElement(f,o({ref:t},s))}));function f(e,t){var r=arguments,l=t&&t.mdxType;if("string"==typeof e||l){var a=r.length,o=new Array(a);o[0]=m;var i={};for(var c in t)hasOwnProperty.call(t,c)&&(i[c]=t[c]);i.originalType=e,i[p]="string"==typeof e?e:l,o[1]=i;for(var u=2;u<a;u++)o[u]=r[u];return n.createElement.apply(null,o)}return n.createElement.apply(null,r)}m.displayName="MDXCreateElement"},4723:(e,t,r)=>{r.d(t,{E:()=>i,q:()=>o});var n=r(9231),l=r(526);const a=n.createContext(null);function o(e){let{children:t,version:r}=e;return n.createElement(a.Provider,{value:r},t)}function i(){const e=(0,n.useContext)(a);if(null===e)throw new l.i6("DocsVersionProvider");return e}},2378:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>g,contentTitle:()=>b,default:()=>O,frontMatter:()=>y,metadata:()=>h,toc:()=>E});var n=r(8041),l=r(9231),a=r(4852),o=r(4723),i=r(3860);const c="root_WC3K",u="header_xtnn",s="filter_lA_C",p="section_s46D",d="group_Vf89",m="noMatch_WkAG",f="groups_u0wv";function v(e){let{title:t,sections:r}=e;const[n,a]=(0,l.useState)(""),o=e=>e?.toLowerCase().replace(/-/g," "),v=e=>o(e)?.includes(n),y=(0,l.useMemo)((()=>r.map((e=>{if(v(e.label))return e;const t=e.items.map((e=>{if(v(e.label))return e;const t=e.customProps.headers.filter((e=>{let{value:t}=e;return v(t)}));return t.length?{label:e.label,link:e.href,customProps:{headers:t}}:null})).filter((e=>e));return t.length?{label:e.label,items:t}:null})).filter((e=>e))),[r,n]);return l.createElement("div",{className:c},l.createElement("div",{className:u},l.createElement("h1",null,t),l.createElement("div",{className:s},l.createElement("label",{htmlFor:"filter-bar"},"Filter"),l.createElement("input",{id:"filter-bar",type:"search",placeholder:"Enter keyword",value:n,onChange:e=>{a(o(e.target.value))}}))),y.length?y.map((e=>{let{label:t,items:r}=e;return l.createElement("div",{className:p,key:t},l.createElement("h2",null,t),l.createElement("div",{className:f},r.map((e=>{let{label:t,customProps:{headers:r},href:n}=e;return l.createElement("div",{className:d,key:t},l.createElement(i.Z,{to:n},l.createElement("h3",null,t)),l.createElement("ul",null,r.map((e=>{let{anchor:t,value:r}=e;return l.createElement("li",{key:t},l.createElement(i.Z,{to:`${n}#${t}`},r))}))))}))))})):l.createElement("div",{className:m},'No API matching "',n,'" found.'))}const y={id:"index",title:"API",hide_title:!0,hide_table_of_contents:!0,displayed_sidebar:null,pagination_next:null,pagination_prev:null,custom_edit_url:null},b=void 0,h={unversionedId:"api/index",id:"api/index",title:"API",description:"",source:"@site/docs/api/index.mdx",sourceDirName:"api",slug:"/api/",permalink:"/doura/zh-CN/docs/api/",draft:!1,editUrl:null,tags:[],version:"current",frontMatter:{id:"index",title:"API",hide_title:!0,hide_table_of_contents:!0,displayed_sidebar:null,pagination_next:null,pagination_prev:null,custom_edit_url:null}},g={},E=[],_={toc:E};function O(e){let{components:t,...r}=e;return(0,a.kt)("wrapper",(0,n.Z)({},_,r,{components:t,mdxType:"MDXLayout"}),(0,a.kt)(v,{title:"API Reference",sections:(0,o.E)().docsSidebars.api,mdxType:"DocCardList"}))}O.isMDXComponent=!0}}]);