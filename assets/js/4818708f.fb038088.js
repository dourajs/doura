"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[249],{4852:function(e,t,n){n.d(t,{Zo:function(){return l},kt:function(){return m}});var r=n(9231);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var u=r.createContext({}),c=function(e){var t=r.useContext(u),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},l=function(e){var t=c(e.components);return r.createElement(u.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,i=e.originalType,u=e.parentName,l=s(e,["components","mdxType","originalType","parentName"]),d=c(n),m=o,f=d["".concat(u,".").concat(m)]||d[m]||p[m]||i;return n?r.createElement(f,a(a({ref:t},l),{},{components:n})):r.createElement(f,a({ref:t},l))}));function m(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=n.length,a=new Array(i);a[0]=d;var s={};for(var u in t)hasOwnProperty.call(t,u)&&(s[u]=t[u]);s.originalType=e,s.mdxType="string"==typeof e?e:o,a[1]=s;for(var c=2;c<i;c++)a[c]=n[c];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},9929:function(e,t,n){n.r(t),n.d(t,{assets:function(){return u},contentTitle:function(){return a},default:function(){return p},frontMatter:function(){return i},metadata:function(){return s},toc:function(){return c}});var r=n(9675),o=(n(9231),n(4852));const i={id:"optimize-views",title:"Optimizing Views"},a=void 0,s={unversionedId:"guides/optimize-views",id:"guides/optimize-views",title:"Optimizing Views",description:"Doura has taken a very different way to do reactivity. Fortunately, We won't need to be aware of this most of time, excepting one case.",source:"@site/docs/guides/optimize-views.md",sourceDirName:"guides",slug:"/guides/optimize-views",permalink:"/doura/docs/guides/optimize-views",draft:!1,editUrl:"https://github.com/dourajs/doura/tree/main/docs/guides/optimize-views.md",tags:[],version:"current",frontMatter:{id:"optimize-views",title:"Optimizing Views"},sidebar:"docs",previous:{title:"Composing Models",permalink:"/doura/docs/guides/compose-model"},next:{title:"Hot Module Replacement",permalink:"/doura/docs/guides/hmr"}},u={},c=[],l={toc:c};function p(e){let{components:t,...n}=e;return(0,o.kt)("wrapper",(0,r.Z)({},l,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("p",null,"Doura has taken a very different way to do reactivity. Fortunately, We won't need to be aware of this most of time, excepting one case."),(0,o.kt)("p",null,"Considering the following example:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},"const user = defineModel({\n  state: {\n    count: 0,\n    user: {\n      name: 'alice',\n      age: 18,\n    },\n  },\n  views: {\n    userName() {\n      return this.user.name\n    },\n  },\n})\n")),(0,o.kt)("p",null,"Ideally, the ",(0,o.kt)("inlineCode",{parentName:"p"},"userName")," view should only re-evalute when ",(0,o.kt)("inlineCode",{parentName:"p"},"user.name")," is changed.\nBut that's not how Doura works. Internally, ",(0,o.kt)("inlineCode",{parentName:"p"},"userName")," will track the update of both ",(0,o.kt)("inlineCode",{parentName:"p"},"user")," and ",(0,o.kt)("inlineCode",{parentName:"p"},"user.name"),". When ",(0,o.kt)("inlineCode",{parentName:"p"},"user.age")," has changed, it will also trigger a change event of ",(0,o.kt)("inlineCode",{parentName:"p"},"user"),". So ",(0,o.kt)("inlineCode",{parentName:"p"},"userName")," view has to invalidate itself and re-evalute even only ",(0,o.kt)("inlineCode",{parentName:"p"},"user.age")," is changed."),(0,o.kt)("p",null,"For the sake of performance, we need to explicitly mark out the ",(0,o.kt)("inlineCode",{parentName:"p"},"user")," from the reactivity tracking system. Here is how you can do this:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},"const user = defineModel({\n  state: {\n    count: 0,\n    user: {\n      name: 'alice',\n      age: 18,\n    },\n  },\n  views: {\n    userName() {\n      const user = this.$isolate((state) => state.user)\n      return user.name\n    },\n  },\n})\n")),(0,o.kt)("admonition",{type:"info"},(0,o.kt)("p",{parentName:"admonition"},(0,o.kt)("inlineCode",{parentName:"p"},"$isolate()")," will executes the given function in a scope where reactive values can be read, but they cannot cause the reactive scope of the caller to be re-evaluated when they change.")))}p.isMDXComponent=!0}}]);