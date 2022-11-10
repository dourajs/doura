"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[869],{4852:function(e,t,n){n.d(t,{Zo:function(){return l},kt:function(){return f}});var r=n(9231);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function c(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?c(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):c(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function a(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},c=Object.keys(e);for(r=0;r<c.length;r++)n=c[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var c=Object.getOwnPropertySymbols(e);for(r=0;r<c.length;r++)n=c[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var u=r.createContext({}),s=function(e){var t=r.useContext(u),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},l=function(e){var t=s(e.components);return r.createElement(u.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,c=e.originalType,u=e.parentName,l=a(e,["components","mdxType","originalType","parentName"]),d=s(n),f=o,m=d["".concat(u,".").concat(f)]||d[f]||p[f]||c;return n?r.createElement(m,i(i({ref:t},l),{},{components:n})):r.createElement(m,i({ref:t},l))}));function f(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var c=n.length,i=new Array(c);i[0]=d;var a={};for(var u in t)hasOwnProperty.call(t,u)&&(a[u]=t[u]);a.originalType=e,a.mdxType="string"==typeof e?e:o,i[1]=a;for(var s=2;s<c;s++)i[s]=n[s];return r.createElement.apply(null,i)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},6622:function(e,t,n){n.r(t),n.d(t,{assets:function(){return u},contentTitle:function(){return i},default:function(){return p},frontMatter:function(){return c},metadata:function(){return a},toc:function(){return s}});var r=n(9675),o=(n(9231),n(4852));const c={id:"views",title:"Views"},i=void 0,a={unversionedId:"core-concepts/views",id:"core-concepts/views",title:"Views",description:"Views are used for computing derived state of a model. They can be defined with the views property in defineModel().",source:"@site/docs/core-concepts/views.md",sourceDirName:"core-concepts",slug:"/core-concepts/views",permalink:"/doura/docs/core-concepts/views",draft:!1,editUrl:"https://github.com/dourajs/doura/tree/main/docs/core-concepts/views.md",tags:[],version:"current",frontMatter:{id:"views",title:"Views"},sidebar:"docs",previous:{title:"Actions",permalink:"/doura/docs/core-concepts/actions"},next:{title:"Plugins",permalink:"/doura/docs/core-concepts/plugins"}},u={},s=[],l={toc:s};function p(e){let{components:t,...n}=e;return(0,o.kt)("wrapper",(0,r.Z)({},l,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("p",null,"Views are used for computing derived state of a model. They can be defined with the ",(0,o.kt)("inlineCode",{parentName:"p"},"views")," property in ",(0,o.kt)("inlineCode",{parentName:"p"},"defineModel()"),"."),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-js"},"export const counterModel = defineModel('counter', {\n  name: 'counter',\n  state: {\n    count: 0,\n  },\n  views: {\n    doubleCount() {\n      return this.count * 2,\n    }\n  },\n})\n")),(0,o.kt)("p",null,"Most of the time, views will only rely on the state, however, they might need to use other views. Because of this, we can get access to the ",(0,o.kt)("em",{parentName:"p"},"whole model instance")," through ",(0,o.kt)("inlineCode",{parentName:"p"},"this")," when defining a regular function:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},"export const counterModel = defineModel('counter', {\n  state: {\n    count: 0,\n  },\n  getters: {\n    // automatically infers the return type as a number\n    doubleCount() {\n      return this.count * 2\n    },\n    // automatically infers the return type as a number\n    doublePlusOne() {\n      return this.doubleCount + 1\n    },\n  },\n})\n")),(0,o.kt)("p",null,"Then you can access the view directly on the model instance:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-js"},"const counter = store.getModel(counterModel)\n\nconsole.log(counter.doubleCount)\n")))}p.isMDXComponent=!0}}]);