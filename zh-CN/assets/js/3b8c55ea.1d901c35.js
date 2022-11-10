"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[217],{4852:function(e,n,t){t.d(n,{Zo:function(){return u},kt:function(){return p}});var o=t(9231);function r(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function s(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){r(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function l(e,n){if(null==e)return{};var t,o,r=function(e,n){if(null==e)return{};var t,o,r={},a=Object.keys(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var c=o.createContext({}),i=function(e){var n=o.useContext(c),t=n;return e&&(t="function"==typeof e?e(n):s(s({},n),e)),t},u=function(e){var n=i(e.components);return o.createElement(c.Provider,{value:n},e.children)},d={inlineCode:"code",wrapper:function(e){var n=e.children;return o.createElement(o.Fragment,{},n)}},m=o.forwardRef((function(e,n){var t=e.components,r=e.mdxType,a=e.originalType,c=e.parentName,u=l(e,["components","mdxType","originalType","parentName"]),m=i(t),p=r,f=m["".concat(c,".").concat(p)]||m[p]||d[p]||a;return t?o.createElement(f,s(s({ref:n},u),{},{components:t})):o.createElement(f,s({ref:n},u))}));function p(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var a=t.length,s=new Array(a);s[0]=m;var l={};for(var c in n)hasOwnProperty.call(n,c)&&(l[c]=n[c]);l.originalType=e,l.mdxType="string"==typeof e?e:r,s[1]=l;for(var i=2;i<a;i++)s[i]=t[i];return o.createElement.apply(null,s)}return o.createElement.apply(null,t)}m.displayName="MDXCreateElement"},1347:function(e,n,t){t.r(n),t.d(n,{assets:function(){return c},contentTitle:function(){return s},default:function(){return d},frontMatter:function(){return a},metadata:function(){return l},toc:function(){return i}});var o=t(9675),r=(t(9231),t(4852));const a={id:"installation",title:"Installation"},s=void 0,l={unversionedId:"installation",id:"installation",title:"Installation",description:"Install doura with your favorite package manager:",source:"@site/docs/installation.md",sourceDirName:".",slug:"/installation",permalink:"/doura/zh-CN/docs/installation",draft:!1,editUrl:"https://github.com/dourajs/doura/tree/main/docs/installation.md",tags:[],version:"current",frontMatter:{id:"installation",title:"Installation"},sidebar:"docs",previous:{title:"What is Doura?",permalink:"/doura/zh-CN/docs/"},next:{title:"Playground",permalink:"/doura/zh-CN/docs/playground"}},c={},i=[{value:"Usage",id:"usage",level:2},{value:"Define models",id:"define-models",level:3},{value:"Consume models",id:"consume-models",level:3}],u={toc:i};function d(e){let{components:n,...t}=e;return(0,r.kt)("wrapper",(0,o.Z)({},u,t,{components:n,mdxType:"MDXLayout"}),(0,r.kt)("p",null,"Install doura with your favorite package manager:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"yarn add doura\n# or with npm\nnpm install doura\n")),(0,r.kt)("h2",{id:"usage"},"Usage"),(0,r.kt)("h3",{id:"define-models"},"Define models"),(0,r.kt)("p",null,"A ",(0,r.kt)("strong",{parentName:"p"},"Model")," is an entity holding state and business logic that isn't bound to your Components. It's a bit like a component that is always there and that everybody can read off and write to. It has three concepts, the ",(0,r.kt)("a",{parentName:"p",href:"/doura/zh-CN/docs/core-concepts/state"},"state"),", ",(0,r.kt)("a",{parentName:"p",href:"/doura/zh-CN/docs/core-concepts/views"},"views")," and ",(0,r.kt)("a",{parentName:"p",href:"/doura/zh-CN/docs/core-concepts/actions"},"actions"),"."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts",metastring:'title="src/models/count.ts"',title:'"src/models/count.ts"'},"export const count = defineModel({\n  // initial state\n  state: {\n    count: 0,\n  },\n  actions: {\n    // handle state changes\n    increment(n: number) {\n      this.count += n\n    },\n    // use async/await for async actions\n    async incrementAsync(n: number) {\n      await new Promise((resolve) => setTimeout(resolve, 1000))\n      this.increment()\n    },\n  },\n  views: {\n    // derived value from state, value is cached and computed on-demand\n    isZero() {\n      return this.count === 0\n    },\n  },\n})\n")),(0,r.kt)("h3",{id:"consume-models"},"Consume models"),(0,r.kt)("p",null,"Store is used to init and persist the state of a model. We can have multiple stores at the same time. "),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts",metastring:'title="src/store.ts"',title:'"src/store.ts"'},"import { doura } from 'doura';\nimport { count } from './models/count';\n\nconst storeA = doura();\nconst storeB = doura();\n\nconst modelInstanceA = storeA.getModel(count)\n\n// model will only be inited once within a store\nconsole.log(storeA.getModel(count) === modelInstanceA) // true\n\nconst modelInstanceB = storeB.getModel(count)\n\nconsole.log(modelInstanceA.count) // 0\nconsole.log(modelInstanceA.isZero) // true\nconsole.log(modelInstanceB.count) // 0\n\nmodelInstanceA.increment();\nconsole.log(modelInstanceA.count) // 1\nconsole.log(modelInstanceA.isZero) // false\nconsole.log(modelInstanceB.count) // 0\n\nawait modelInstanceB.incrementAsync();\nconsole.log(modelInstanceB.count) // 1\nconsole.log(modelInstanceB.isZero) // false\n")))}d.isMDXComponent=!0}}]);