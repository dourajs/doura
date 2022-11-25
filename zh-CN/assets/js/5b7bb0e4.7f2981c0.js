"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[590],{4852:function(e,n,t){t.d(n,{Zo:function(){return i},kt:function(){return m}});var o=t(9231);function r(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function c(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){r(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function u(e,n){if(null==e)return{};var t,o,r=function(e,n){if(null==e)return{};var t,o,r={},a=Object.keys(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var s=o.createContext({}),l=function(e){var n=o.useContext(s),t=n;return e&&(t="function"==typeof e?e(n):c(c({},n),e)),t},i=function(e){var n=l(e.components);return o.createElement(s.Provider,{value:n},e.children)},d={inlineCode:"code",wrapper:function(e){var n=e.children;return o.createElement(o.Fragment,{},n)}},p=o.forwardRef((function(e,n){var t=e.components,r=e.mdxType,a=e.originalType,s=e.parentName,i=u(e,["components","mdxType","originalType","parentName"]),p=l(t),m=r,f=p["".concat(s,".").concat(m)]||p[m]||d[m]||a;return t?o.createElement(f,c(c({ref:n},i),{},{components:t})):o.createElement(f,c({ref:n},i))}));function m(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var a=t.length,c=new Array(a);c[0]=p;var u={};for(var s in n)hasOwnProperty.call(n,s)&&(u[s]=n[s]);u.originalType=e,u.mdxType="string"==typeof e?e:r,c[1]=u;for(var l=2;l<a;l++)c[l]=t[l];return o.createElement.apply(null,c)}return o.createElement.apply(null,t)}p.displayName="MDXCreateElement"},9293:function(e,n,t){t.r(n),t.d(n,{assets:function(){return s},contentTitle:function(){return c},default:function(){return d},frontMatter:function(){return a},metadata:function(){return u},toc:function(){return l}});var o=t(9675),r=(t(9231),t(4852));const a={id:"compose-model",title:"Composing Models"},c=void 0,u={unversionedId:"guides/compose-model",id:"guides/compose-model",title:"Composing Models",description:"To use other models when define a model, we need to use function to define",source:"@site/docs/guides/compose-model.md",sourceDirName:"guides",slug:"/guides/compose-model",permalink:"/doura/zh-CN/docs/guides/compose-model",draft:!1,editUrl:"https://github.com/dourajs/doura/tree/main/docs/guides/compose-model.md",tags:[],version:"current",frontMatter:{id:"compose-model",title:"Composing Models"},sidebar:"docs",previous:{title:"Multiple Stores",permalink:"/doura/zh-CN/docs/react/multiple-stores"},next:{title:"Optimizing Views",permalink:"/doura/zh-CN/docs/guides/optimize-views"}},s={},l=[{value:"Local Model",id:"local-model",level:2},{value:"Named Model",id:"named-model",level:2}],i={toc:l};function d(e){let{components:n,...t}=e;return(0,r.kt)("wrapper",(0,o.Z)({},i,t,{components:n,mdxType:"MDXLayout"}),(0,r.kt)("p",null,"To use other models when define a model, we need to use ",(0,r.kt)("strong",{parentName:"p"},"function")," to define\nthe model."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const countModel = defineModel({\n  state: {\n    count: 0,\n  },\n})\n\nconst userModel = defineModel(({ use }) => {\n  const counter = use(countModel)\n\n  return {\n    state: {\n      name: 'alice',\n      isLogin: false,\n    },\n    actions: {\n      login() {\n        counter.count++\n        this.isLogin = true\n      },\n    },\n    views: {\n      loginCount() {\n        return counter.count\n      },\n    },\n  }\n})\n")),(0,r.kt)("admonition",{type:"caution"},(0,r.kt)("p",{parentName:"admonition"},"Note that if you destructure the ",(0,r.kt)("inlineCode",{parentName:"p"},"counter")," object, the destructured variables will lose reactivity. It is therefore recommended to always access props in the form of ",(0,r.kt)("inlineCode",{parentName:"p"},"counter.xxx"),".")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const userModel = defineModel(({ use }) => {\n  const counter = use(countModel)\n  const { count } = counter // \u274c don't destructure\n\n  return {\n    state: {},\n    views: {\n      countOne() {\n        return count; // \u26a0\ufe0f countOne won't update once count is changed\n      }\n      countTwo() {\n        return counter.count // \u2705 always access props by `someModel.xx` in a view function\n      },\n    },\n  }\n})\n")),(0,r.kt)("h2",{id:"local-model"},"Local Model"),(0,r.kt)("p",null,"when composing a model by ",(0,r.kt)("inlineCode",{parentName:"p"},"use(model)"),", if we don't provide a name, the model is isolated and can only get accessed in the current model."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const countModel = defineModel({\n  state: {\n    count: 0,\n  },\n})\n\nconst modelOne = defineModel(({ use }) => {\n  const counter1 = use(countModel)\n  const counter2 = use(countModel)\n\n  return {\n    state: {\n      value: 0,\n    },\n  }\n})\n\nconst modelTwo = defineModel(({ use }) => {\n  const counter3 = use(countModel)\n\n  return {\n    state: {\n      value: 0,\n    },\n  }\n})\n")),(0,r.kt)("p",null,(0,r.kt)("inlineCode",{parentName:"p"},"counter1"),", ",(0,r.kt)("inlineCode",{parentName:"p"},"counter2")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"counter3")," are three different instances. They are independent of each other and do not affect each other."),(0,r.kt)("h2",{id:"named-model"},"Named Model"),(0,r.kt)("p",null,"If you want to share a model's state among other models, you need use ",(0,r.kt)("strong",{parentName:"p"},"named model"),"."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-ts"},"const countModel = defineModel({\n  state: {\n    count: 0,\n  },\n})\n\nconst modelOne = defineModel(({ use }) => {\n  const counter1 = use('counter', countModel)\n\n  return {\n    state: {\n      value: 0,\n    },\n  }\n})\n\nconst modelTwo = defineModel(({ use }) => {\n  const counter2 = use('counter', countModel) // counter1 and counter2 point to a same instance as long as they have a same name.\n\n  return {\n    state: {\n      value: 0,\n    },\n  }\n})\n")))}d.isMDXComponent=!0}}]);