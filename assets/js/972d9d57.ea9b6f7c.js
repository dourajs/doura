"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[937],{4852:function(e,t,n){n.d(t,{Zo:function(){return s},kt:function(){return m}});var r=n(9231);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function l(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var c=r.createContext({}),u=function(e){var t=r.useContext(c),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},s=function(e){var t=u(e.components);return r.createElement(c.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,i=e.originalType,c=e.parentName,s=l(e,["components","mdxType","originalType","parentName"]),d=u(n),m=o,f=d["".concat(c,".").concat(m)]||d[m]||p[m]||i;return n?r.createElement(f,a(a({ref:t},s),{},{components:n})):r.createElement(f,a({ref:t},s))}));function m(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=n.length,a=new Array(i);a[0]=d;var l={};for(var c in t)hasOwnProperty.call(t,c)&&(l[c]=t[c]);l.originalType=e,l.mdxType="string"==typeof e?e:o,a[1]=l;for(var u=2;u<i;u++)a[u]=n[u];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},2192:function(e,t,n){n.r(t),n.d(t,{assets:function(){return h},contentTitle:function(){return f},default:function(){return v},frontMatter:function(){return m},metadata:function(){return y},toc:function(){return g}});var r=n(9675),o=n(9231),i=n(4852),a=n(9841),l=n(4283),c="card_BAkA",u="cardTitle_Ozsg",s="cardDescription_OjFk";function p(e){let{title:t,url:n,description:r}=e;return o.createElement("div",{className:(0,a.Z)(c)},o.createElement(l.Z,{to:n},o.createElement("h2",{className:(0,a.Z)(u)},t),o.createElement("p",{className:(0,a.Z)(s)},r)))}function d(e){let{items:t,className:n}=e;return o.createElement("section",{className:(0,a.Z)("row",n)},t.map(((e,t)=>o.createElement("article",{key:t,className:"col col--6 margin-bottom--lg"},o.createElement(p,e)))))}const m={id:"introduction",title:"Introduction",slug:"/",pagination_next:null,hide_table_of_contents:!0,custom_edit_url:null},f=void 0,y={unversionedId:"introduction",id:"introduction",title:"Introduction",description:"Welcome to the Shuvi.js documentation!",source:"@site/docs/introduction.mdx",sourceDirName:".",slug:"/",permalink:"/doura/docs/",draft:!1,editUrl:null,tags:[],version:"current",frontMatter:{id:"introduction",title:"Introduction",slug:"/",pagination_next:null,hide_table_of_contents:!0,custom_edit_url:null},sidebar:"docs"},h={},g=[{value:"Getting Started",id:"getting-started",level:2}],b={toc:g};function v(e){let{components:t,...n}=e;return(0,i.kt)("wrapper",(0,r.Z)({},b,n,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("p",null,"Welcome to the Shuvi.js documentation!"),(0,i.kt)("p",null,"Shuvi.js is a meta framework that helps you build all kinds of application in a universal style."),(0,i.kt)("p",null,"It means to replace Next.js(for Server-Side Rendering Application), Create React App(for Client Application) and Nuxt.js(for Vue.js application)."),(0,i.kt)("p",null,"Hope you like Shuvi.js."),(0,i.kt)("admonition",{type:"info"},(0,i.kt)("p",{parentName:"admonition"},"Vue.js support is still in the plan.")),(0,i.kt)("h2",{id:"getting-started"},"Getting Started"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-sh"},"npm init shuvi@latest\n")),(0,i.kt)(d,{items:[{title:"\ud83d\udcc4\ufe0f Quick Start",url:"/docs/tutorials",description:"Spend your first few minutes with Shuvi.js here and let us introduce some of the core features as quickly as possible. After this you can go explore the docs or dive deeper with the other tutorials. We'll build a little markdown blog with data loading, actions, form validation, redirects, and more."},{title:"\ud83d\udcc4\ufe0f Guides",url:"/docs/guides",description:"Guides take you through the steps required to solve a specific problem. You'll learn how to solve most problems by a step-by-step guide."},{title:"\ud83d\udcc4\ufe0f Reference",url:"/docs/reference",description:"Shuvi.js has a handful of conventions to make web application development a breeze. You'll spend some time in this document when you're first learning Shuvi.js, but probably won't need it much after you get your feet wet."},{title:"\ud83d\udcc4\ufe0f API",url:"/docs/api",description:"This is probably the doc page you'll visit the most. It's got all of the API that you'll use day-to-day in your app."}],mdxType:"SimpleDocCardList"}))}v.isMDXComponent=!0}}]);