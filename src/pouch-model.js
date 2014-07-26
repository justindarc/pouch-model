/**
 * Object.keys polyfill
 * https://gist.github.com/atk/1034464
 */
Object.keys=Object.keys||function(o,k,r){r=[];for(k in o)r.hasOwnProperty.call(o,k)&&r.push(k);return r}

/**
 * Array.prototype.find polyfill
 * https://github.com/paulmillr/Array.prototype.find
 */
Array.prototype.find||function(){var a=function(a){var b=Object(this),c=b.length<0?0:b.length>>>0;if(0===c)return void 0;if('function'!==typeof a||'[object Function]'!==Object.prototype.toString.call(a))throw new TypeError('Array#find: predicate must be a function');for(var f,d=arguments[1],e=0;c>e;e++)if(f=b[e],a.call(d,f,e,b))return f;return void 0};if(Object.defineProperty)try{Object.defineProperty(Array.prototype,'find',{value:a,configurable:!0,enumerable:!1,writable:!0})}catch(b){}Array.prototype.find=Array.prototype.find||a}();

/**
 * Element.prototype.matchesSelector polyfill
 * https://gist.github.com/jonathantneal/3062955
 */
(function(E){E.matchesSelector=E.matchesSelector||E.mozMatchesSelector||E.msMatchesSelector||E.oMatchesSelector||E.webkitMatchesSelector||function(s){var n=this,ns=(n.parentNode||n.document).querySelectorAll(s),i=-1;while(ns[++i]&&ns[i]!==n);return !!ns[i];}})(Element.prototype);

/**
 * @ngdoc module
 * @name pouch-model
 * @description
 *
 * # pouch-model
 *
 * The `pouch-model` module provides PouchDB-based model "classes"
 * for Angular via the `$pouchModel` service.
 *
 * See {@link pouch-model.$pouchModel `$pouchModel`} for usage.
 */
angular.module('pouch-model', []);

var $pouchModelMinErr = angular.$$minErr('$pouchModel');
