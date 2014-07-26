/*
angular.module('pouch-model')
  .factory('$pouchModel', ['$q', '$http', '$pouchModelDatabase',
    function($q, $http, $pouchModelDatabase) {
      ...
      (continued from src/factories/pouch-model/_1_intro.js)
*/

      /**
       * This method is intended for encoding *key* or *value* parts of query component. We need a
       * custom method because encodeURIComponent is too aggressive and encodes stuff that doesn't
       * have to be encoded per http://tools.ietf.org/html/rfc3986:
       *    query       = *( pchar / "/" / "?" )
       *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
       *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
       *    pct-encoded   = "%" HEXDIG HEXDIG
       *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
       *                     / "*" / "+" / "," / ";" / "="
       */
      var encodeUriQuery = function(val, pctEncodeSpaces) {
        return encodeURIComponent(val).
          replace(/%40/gi, '@').
          replace(/%3A/gi, ':').
          replace(/%24/g, '$').
          replace(/%2C/gi, ',').
          replace(/%20/g, (pctEncodeSpaces ? '%20' : '+'));
      };

      /**
       * We need our custom method because encodeURIComponent is too aggressive and doesn't follow
       * http://www.ietf.org/rfc/rfc3986.txt with regards to the character set (pchar) allowed in path
       * segments:
       *    segment       = *pchar
       *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
       *    pct-encoded   = "%" HEXDIG HEXDIG
       *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
       *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
       *                     / "*" / "+" / "," / ";" / "="
       */
      var encodeUriSegment = function(val) {
        return encodeUriQuery(val, true).
          replace(/%26/gi, '&').
          replace(/%3D/gi, '=').
          replace(/%2B/gi, '+');
      };

      var encodeRemoteQueryParams = function(params) {
        var encodedParams = {};
        var key, value;
        for (key in params) {
          value = params[key];
          encodedParams[key] = value === true ? 1 : value === false ? 0 : value;
        }
        return encodedParams;
      };

      function Route(template, defaults) {
        this.template = template;
        this.defaults = defaults || {};
      }

      Route.prototype.constructor = Route;

      /*
        config = { method: 'GET' } | { method: 'POST' } | { method: 'PUT' } | { method: 'DELETE' }
        params = { id: undefined } | { id: undefined, completed: true } | { id: '01234567-89ab-cdef-0123-456789abcdef' }
        actionUrl = undefined | '/api/todos/custom'
      */
      Route.prototype.createRequestConfig = function(method, params, url) {
        var config = {},
            urlParams = {},
            defaults = this.defaults,
            val,
            encodedVal;

        config.method = method;

        url = url || this.template;

        forEach(url.split(/\W/), function(param) {

          // See angular.js PR #3331: https://github.com/angular/angular.js/pull/3331
          if (param === 'hasOwnProperty') {
            throw $pouchModelMinErr('badname', "hasOwnProperty is not a valid parameter name.");
          }
          if (!(new RegExp("^\\d+$").test(param)) && param &&
               (new RegExp("(^|[^\\\\]):" + param + "(\\W|$)").test(url))) {
            urlParams[param] = true;
          }
        });
        url = url.replace(/\\:/g, ':');

        params = params || {};
        forEach(urlParams, function(_, urlParam){
          val = params.hasOwnProperty(urlParam) ? params[urlParam] : defaults[urlParam];
          if (angular.isDefined(val) && val !== null) {
            encodedVal = encodeUriSegment(val);
            url = url.replace(new RegExp(":" + urlParam + "(\\W|$)", "g"), function(match, p1) {
              return encodedVal + p1;
            });
          } else {
            url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W|$)", "g"), function(match,
                leadingSlashes, tail) {
              if (tail.charAt(0) == '/') {
                return tail;
              } else {
                return leadingSlashes + tail;
              }
            });
          }
        });

        // strip trailing slashes and set the url
        url = url.replace(/\/+$/, '') || '/';
        // then replace collapse `/.` if found in the last URL path segment before the query
        // E.g. `http://url.com/id./format?q=x` becomes `http://url.com/id.format?q=x`
        url = url.replace(/\/\.(?=\w+($|\?))/, '.');
        // replace escaped `/\.` with `/.`
        config.url = url.replace(/\/\\\./, '/.');

        // Append remaining params to URL if this is a 'GET' request.
        if (method === 'GET') {

          // set params - delegate param encoding to $http
          config.params = {};
          forEach(params, function(value, key) {
            if (!urlParams[key]) {
              config.params[key] = value;
            }
          });

          // Convert `true` and `false` boolean values to `1` and `0` if
          // they will be passed in the URL.
          config.params = encodeRemoteQueryParams(config.params);
        }

        return config;
      };

/*
      (continued in src/factories/pouch-model/_3_factory.js)
      ...
    }
  ]);
*/