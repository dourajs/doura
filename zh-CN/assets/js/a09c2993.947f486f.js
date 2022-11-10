"use strict";(self.webpackChunkdoura_docs=self.webpackChunkdoura_docs||[]).push([[128],{4852:function(e,t,n){n.d(t,{Zo:function(){return c},kt:function(){return f}});var r=n(9231);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var l=r.createContext({}),u=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},c=function(e){var t=u(e.components);return r.createElement(l.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},p=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,i=e.originalType,l=e.parentName,c=s(e,["components","mdxType","originalType","parentName"]),p=u(n),f=o,m=p["".concat(l,".").concat(f)]||p[f]||d[f]||i;return n?r.createElement(m,a(a({ref:t},c),{},{components:n})):r.createElement(m,a({ref:t},c))}));function f(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=n.length,a=new Array(i);a[0]=p;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s.mdxType="string"==typeof e?e:o,a[1]=s;for(var u=2;u<i;u++)a[u]=n[u];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}p.displayName="MDXCreateElement"},3806:function(e,t,n){n.r(t),n.d(t,{assets:function(){return l},contentTitle:function(){return a},default:function(){return d},frontMatter:function(){return i},metadata:function(){return s},toc:function(){return u}});var r=n(9675),o=(n(9231),n(4852));const i={id:"introduction",title:"What is Doura?",slug:"/",pagination_next:null,hide_table_of_contents:!0,custom_edit_url:null},a=void 0,s={unversionedId:"introduction",id:"introduction",title:"What is Doura?",description:"Doura brings the reactivity to React. It's provided an intuitive and simple way to manage state. It has a powerful type system which all types can be inferred. Doura also splits the model from store, which means you can write your models and share it arcoss projects easily. Doura can be used as a global store(redux), shared stores(React Context) or local store(useReducer).",source:"@site/docs/introduction.md",sourceDirName:".",slug:"/",permalink:"/doura/zh-CN/docs/",draft:!1,editUrl:null,tags:[],version:"current",frontMatter:{id:"introduction",title:"What is Doura?",slug:"/",pagination_next:null,hide_table_of_contents:!0,custom_edit_url:null},sidebar:"docs"},l={},u=[{value:"React Example",id:"react-example",level:2}],c={toc:u};function d(e){let{components:t,...n}=e;return(0,o.kt)("wrapper",(0,r.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("p",null,"Doura brings the reactivity to React. It's provided an intuitive and simple way to manage state. It has a powerful type system which all types can be inferred. Doura also splits the ",(0,o.kt)("inlineCode",{parentName:"p"},"model")," from ",(0,o.kt)("inlineCode",{parentName:"p"},"store"),", which means you can write your ",(0,o.kt)("inlineCode",{parentName:"p"},"models")," and share it arcoss projects easily. Doura can be used as a global store(redux), shared stores(React Context) or local store(useReducer)."),(0,o.kt)("admonition",{type:"info"},(0,o.kt)("p",{parentName:"admonition"},"Doura is greatly inspired by ",(0,o.kt)("a",{parentName:"p",href:"https://github.com/immerjs/immer"},"immer")," and ",(0,o.kt)("a",{parentName:"p",href:"https://github.com/vuejs/pinia"},"Pinia"),". Thanks for their excellent work.")),(0,o.kt)("h2",{id:"react-example"},"React Example"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-tsx"},"import { defineModel } from 'doura'\nimport { useModel } from 'doura-react'\n\nconst todoModel = defineModel({\n  name: 'todo',\n  state: {\n    todos: [\n      {\n        id: 0,\n        text: 'read books',\n        isFinished: true,\n      },\n      {\n        id: 1,\n        text: 'play games',\n        isFinished: false,\n      },\n    ],\n    /** @type {'all' | 'unfinished'} */\n    filter: 'all',\n  },\n  views: {\n    unfinishedTodos() {\n      // autocompletion! \u2728\n      return this.todos.filter((todo) => !todo.isFinished)\n    },\n    filteredTodos() {\n      if (this.filter === 'unfinished') {\n        return this.unfinishedTodos\n      }\n      return this.todos\n    },\n  },\n  actions: {\n    // any amount of arguments, return a promise or not\n    setFilter(filter) {\n      // you can directly mutate the state\n      this.filter = filter\n    },\n  },\n})\n\nexport function TodoApp() {\n  const [state, actions] = useModel(todoModel)\n\n  return (\n    <div>\n      <div>\n        <input\n          type=\"checkbox\"\n          id=\"filter\"\n          onClick={(event) =>\n            actions.setFilter(event.target.checked ? 'unfinished' : 'all')\n          }\n        />\n        <label htmlFor=\"filter\">Only show unfinished</label>\n      </div>\n      <ul>\n        {/* type of `filteredTodos` are inferred */}\n        {state.filteredTodos.map((todo) => (\n          <li key={todo.id}>\n            <input type=\"checkbox\" checked={todo.isFinished} />\n            {todo.text}\n          </li>\n        ))}\n      </ul>\n    </div>\n  )\n}\n")))}d.isMDXComponent=!0}}]);