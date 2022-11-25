"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[973],{4852:function(e,t,r){r.d(t,{Zo:function(){return s},kt:function(){return m}});var o=r(9231);function n(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function a(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);t&&(o=o.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,o)}return r}function c(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?a(Object(r),!0).forEach((function(t){n(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):a(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function l(e,t){if(null==e)return{};var r,o,n=function(e,t){if(null==e)return{};var r,o,n={},a=Object.keys(e);for(o=0;o<a.length;o++)r=a[o],t.indexOf(r)>=0||(n[r]=e[r]);return n}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(o=0;o<a.length;o++)r=a[o],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(n[r]=e[r])}return n}var i=o.createContext({}),u=function(e){var t=o.useContext(i),r=t;return e&&(r="function"==typeof e?e(t):c(c({},t),e)),r},s=function(e){var t=u(e.components);return o.createElement(i.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return o.createElement(o.Fragment,{},t)}},d=o.forwardRef((function(e,t){var r=e.components,n=e.mdxType,a=e.originalType,i=e.parentName,s=l(e,["components","mdxType","originalType","parentName"]),d=u(r),m=n,f=d["".concat(i,".").concat(m)]||d[m]||p[m]||a;return r?o.createElement(f,c(c({ref:t},s),{},{components:r})):o.createElement(f,c({ref:t},s))}));function m(e,t){var r=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var a=r.length,c=new Array(a);c[0]=d;var l={};for(var i in t)hasOwnProperty.call(t,i)&&(l[i]=t[i]);l.originalType=e,l.mdxType="string"==typeof e?e:n,c[1]=l;for(var u=2;u<a;u++)c[u]=r[u];return o.createElement.apply(null,c)}return o.createElement.apply(null,r)}d.displayName="MDXCreateElement"},121:function(e,t,r){r.r(t),r.d(t,{assets:function(){return i},contentTitle:function(){return c},default:function(){return p},frontMatter:function(){return a},metadata:function(){return l},toc:function(){return u}});var o=r(9675),n=(r(9231),r(4852));const a={id:"global-store",title:"Global Store"},c=void 0,l={unversionedId:"react/global-store",id:"react/global-store",title:"Global Store",description:"Create a Doura sotre",source:"@site/docs/react/global-store.md",sourceDirName:"react",slug:"/react/global-store",permalink:"/doura/zh-CN/docs/react/global-store",draft:!1,editUrl:"https://github.com/dourajs/doura/tree/main/docs/react/global-store.md",tags:[],version:"current",frontMatter:{id:"global-store",title:"Global Store"},sidebar:"docs",previous:{title:"Using at Component Level",permalink:"/doura/zh-CN/docs/react/component-state"},next:{title:"Multiple Stores",permalink:"/doura/zh-CN/docs/react/multiple-stores"}},i={},u=[{value:"Create a Doura sotre",id:"create-a-doura-sotre",level:2},{value:"Provide the Doura Store to React",id:"provide-the-doura-store-to-react",level:2},{value:"Create a model",id:"create-a-model",level:3},{value:"Bind your components",id:"bind-your-components",level:3}],s={toc:u};function p(e){let{components:t,...r}=e;return(0,n.kt)("wrapper",(0,o.Z)({},s,r,{components:t,mdxType:"MDXLayout"}),(0,n.kt)("h2",{id:"create-a-doura-sotre"},"Create a Doura sotre"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-tsx",metastring:'title="store.ts"',title:'"store.ts"'},"import { doura } from 'doura'\n\nexport default doura()\n")),(0,n.kt)("h2",{id:"provide-the-doura-store-to-react"},"Provide the Doura Store to React"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-tsx",metastring:'title="index.ts"',title:'"index.ts"'},"import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport store from './store'\nimport { DouraRoot } from 'react-doura'\n\n// As of React 18\nconst root = ReactDOM.createRoot(document.getElementById('root'))\n\nroot.render(\n  <DouraRoot store={store}>\n    <App />\n  </DouraRoot>\n)\n")),(0,n.kt)("h3",{id:"create-a-model"},"Create a model"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-tsx",metastring:'title="models/count"',title:'"models/count"'},"import { defineModel } from 'doura'\n\nexport const countModel = defineModel({\n  state: {\n    count: 0,\n  },\n  actions: {\n    inc() {\n      this.count += 1\n    },\n  },\n})\n")),(0,n.kt)("h3",{id:"bind-your-components"},"Bind your components"),(0,n.kt)("p",null,"Now we can use the React Doura hooks to let React components interact with the Doura store."),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-tsx",metastring:'title="componnets/Counter.tsx"',title:'"componnets/Counter.tsx"'},"import React from 'react'\nimport { useRootModel } from 'react-doura'\nimport { countModel } from './models/count'\n\nexport function Counter() {\n  const [state, actions] = useRootModel('count', countModel)\n\n  return (\n    <div>\n      <h1>Count: {state.count}</h1>\n      <button onClick={actions.inc}>inc</button>\n    </div>\n  )\n}\n")))}p.isMDXComponent=!0}}]);