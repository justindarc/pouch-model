;(function(window, angular, undefined) {'use strict';

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

/**
 * @ngdoc provider
 * @name $pouchModelDatabaseProvider
 * @kind function
 *
 * @description
 * Used for configuring a local PouchDB database for persisting
 * models locally.
 */
angular.module('pouch-model')
  .provider('$pouchModelDatabase', function() {
    var config = {
      name: 'pouch-model',
      options: {}
    };
   
    return {
      setup: function(name, options) {
        config.name = name || config.name;
        config.options = options || config.options;
      },

      $get: [function() {
        var db = null;

        // Return the service instance.
        return {
          get: function() {
            if (db) { return db; }

            var name = config.name || config.options.name;

            // If an adapter was explicity specified, simply create
            // the database with the specified options.
            if (config.options.adapter) {
              return (db = new PouchDB(name, config.options));
            }

            // Attempt to use Web SQL adapter first for performance.
            if (PouchDB.adapters.websql) {
              config.options.adapter = 'websql';

              return (db = new PouchDB(name, config.options));
            }

            // Fallback to to default adapter (IndexedDB) if Web SQL
            // is unavailable.
            return (db = new PouchDB(name, config.options));
          },

          destroy: function() {
            PouchDB.destroy(config.name || config.options.name);

            db = null;
          }
        };
      }]
    };
  });

/**
 * @ngdoc provider
 * @name $pouchModelSyncProvider
 * @kind function
 *
 * @description
 * Used for configuring a queue for syncing local models to a
 * remote web service.
 */
angular.module('pouch-model')
  .provider('$pouchModelSync', function() {
    var config = {
      concurrent: {
        local: 10,
        remote: 2
      },
      maxRetries: 10
    };

    var forEach = angular.forEach,
        isFunction = angular.isFunction;

    var OperationQueue = (function() {
      var sortComparator = function(a, b) {
        var aUpdatedAt = a.model.updated_at;
        var bUpdatedAt = b.model.updated_at;
        if (aUpdatedAt > bUpdatedAt) { return  1; }
        if (aUpdatedAt < bUpdatedAt) { return -1; }
        return 0;
      };

      function OperationQueue(adapterType, concurrent) {
        this.operations = [];
        this.processing = [];
        this.failures = [];

        this.adapterType = adapterType;
        this.concurrent = concurrent || 1;
        
        var isPaused = false;
        this.isPaused = function() {
          return isPaused;
        };

        this.pause = function() {
          isPaused = true;
        };

        this.start = function() {
          isPaused = false;
          this.process();
        }
      }

      OperationQueue.prototype.constructor = OperationQueue;

      OperationQueue.prototype.process = function() {
        var processing = this.processing;
        if (this.isPaused() || processing.length >= this.concurrent) {
          return;
        }

        // Get the next operation in the queue to process. If no operations
        // remain, add all failed operations back in the queue to re-process.
        // If there are no remaining operations and no failed operations to
        // re-process, then stop processing.
        var operation = this.operations.shift();
        if (!operation) {
          this.operations = this.operations.concat(this.failures);
          if (!(operation = this.operations.shift())) {
            return;
          }
        }

        processing.push(operation);

        var self = this;
        var type = operation.type;
        var source = operation.source;
        var model = operation.model;
        var adapter = model.constructor.adapters[operation.targetAdapter];
        var operator = adapter[type];
        
        var doneProcessing = function() {
          for (var i = 0, length = processing.length; i < length; i++) {
            if (processing[i] === operation) {
              processing.splice(i, 1);
              return;
            }
          }
        };

        // Trigger callbacks.
        model.trigger('before', 'sync');

        operator(model.getEscapedProperties())
          .then(function(result) {

            // Trigger callbacks.
            model.trigger('after', 'sync');

            if (isFunction(operation.success)) {
              operation.success.call(operation, result);
            }

            // Finish processing.
            doneProcessing();

            // Process next operation.
            self.process();
          })
          .catch(function(exception) {
            exception = exception || {};

            // Trigger callbacks.
            model.trigger('failed', 'sync');

            if (isFunction(operation.error)) {
              operation.error.call(operation, exception);
            }

            // Finish processing.
            doneProcessing();

            // Handle case where operation cannot be completed
            // because the model has already been deleted from
            // the target adapter datastore.
            if (exception.deleted) {

              // Enqueue a delete operation for the source
              // adapter for this model.
              self.enqueue({
                type: 'delete',
                sourceAdapter: operation.targetAdapter,
                targetAdapter: operation.sourceAdapter,
                model: model
              }, operation.success, operation.error);
            }

            // If this failure was unexpected, move the operation
            // to the `failures` queue for retrying later.
            else {

              // Increment the `fail` count for the operation.
              operation.fail = (operation.fail || 0) + 1;
              
              // Add operation to failed queue if the maximum
              // failure retries has not yet been exceeded.
              if (config.maxRetries > operation.fail) {
                self.failures.push(operation);
              }
            }

            // Process next operation.
            self.process();
          });
      };

      OperationQueue.prototype.enqueue = function(operation, success, error) {
        if (this.isQueued(operation)) {
          //
          // TODO: Maybe *append* callbacks to existing operation?
          //
          return;
        }

        // Assign callbacks to the operation.
        operation.success = success;
        operation.error = error;

        var operations = this.operations;
        operations.push(operation);

        // Always keep "queue" sorted by when the models are updated.
        operations.sort(sortComparator);

        this.process();
      };

      OperationQueue.prototype.isQueued = function(operation) {
        var type = operation.type;
        var model = operation.model;

        var iterator = function(existingOperation) {
          if (existingOperation.type !== type) { return false; }

          var existingModel = existingOperation.model;
          return existingModel.id === model.id &&
            existingModel.updated_at === model.updated_at;
        };

        return !!this.operations.find(iterator) ||
               !!this.processing.find(iterator) ||
               !!this.failures.find(iterator);
      };

      return OperationQueue;
    })();

    return {
      setup: function(options) {
        angular.extend(config, options);
      },

      $get: ['$http', function($http) {
        var queues = {
          local: new OperationQueue('local', config.concurrent.local),
          remote: new OperationQueue('remote', config.concurrent.remote)
        };

        // Return the service instance.
        return {

          /**
           *
           */
          getLocalQueue: function() {
            return queues.local;
          },

          /**
           *
           */
          getRemoteQueue: function() {
            return queues.remote;
          },

          /**
           *
           */
          addToLocalQueue: function(operation, success, error) {
            this.getLocalQueue().enqueue(operation, success, error);
          },

          /**
           *
           */
          addToRemoteQueue: function(operation, success, error) {
            this.getRemoteQueue().enqueue(operation, success, error);
          },

          /**
           *
           */
          //
          // XXX: If a `queryResult` was passed, `refresh` it when
          //      `operations` have been synced.
          //
          sync: function(operations, success, error) {
            var self = this;

            forEach(operations.local, function(operation) {
              self.addToLocalQueue(operation, success, error);
            });

            forEach(operations.remote, function(operation) {
              self.addToRemoteQueue(operation, success, error);
            });

            //
            // XXX: Uncomment for debugging sync queues
            //
            // console.log('$pouchModelSync::sync()#getLocalQueue()', this.getLocalQueue());
            // console.log('$pouchModelSync::sync()#getRemoteQueue()', this.getRemoteQueue());
          }
        };
      }]
    };
  });

/**
 * @ngdoc service
 * @name $pouchModel
 *
 * @requires $q
 * @requires $timeout
 * @requires $http
 * @requires $pouchModelDatabase
 * @requires $pouchModelSync
 *
 * @description
 * A factory which creates a `PouchModel` "class" that lets you define
 * a data model based on a JSON schema.
 *
 * Requires the {@link https://github.com/geraintluff/tv4 `tv4`} module to be installed.
 */
angular.module('pouch-model')
  .factory('$pouchModel', ['$q', '$timeout', '$http', '$pouchModelDatabase', '$pouchModelSync',
    function($q, $timeout, $http, $pouchModelDatabase, $pouchModelSync) {
      var PRIVATE_PREFIX = '\u0000';
      var DESIGN_DOC_PREFIX = '_pouch_model_';
      var UNESCAPED_PRIVATE_KEYS = ['_id', '_rev', '_attachments'];

      // ISO 8601 Date Validation That Doesn't Suck
      // http://www.pelagodesign.com/blog/2009/05/20/iso-8601-date-validation-that-doesnt-suck/
      var ISO_DATE_REGEX = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;

      var noop = angular.noop,
          forEach = angular.forEach,
          equals = angular.equals,
          extend = angular.extend,
          copy = angular.copy,
          isDate = angular.isDate,
          isFunction = angular.isFunction,
          isNumber = angular.isNumber,
          isObject = angular.isObject,
          isString = angular.isString,
          toJson = angular.toJson,
          fromJson = angular.fromJson;

      var MD5 = PouchDB.utils.MD5;

      var isArray = function(o) {
        return o instanceof Array;
      };

      var UUID = function(len, radix) {
        return PouchDB.utils.uuid(len, radix).toLowerCase();
      };

      var db = $pouchModelDatabase.get();

      var createDesignDoc = function(id, map) {
        var designDoc = {
          _id: '_design/' + id,
          views: {}
        };

        var mapString = map.toString();
        designDoc.views[id] = { map: mapString };

        // Attempt to save the design document.
        db.put(designDoc).then(function(result) {

          // Update the index.
          db.query(id, { stale: 'update_after' }).then(function(result) {

            // Clean up orphaned indexes.
            db.viewCleanup();
          });
        }).catch(function(error) {

          // If the design document already exists, fetch it to
          // check if it needs updated.
          db.get('_design/' + id).then(function(result) {
            var view = (result.views || {})[id] || {};
            if (view.map === mapString) return;
            
            // If the design document needs updated, remove the
            // existing one.
            db.remove(result._id, result._rev).then(function(result) {

              // Attempt to save the design document again.
              db.put(designDoc).then(function(result) {

                // Update the index.
                db.query(id, { stale: 'update_after' }).then(function(result) {

                  // Clean up orphaned indexes.
                  db.viewCleanup();
                });
              }).catch(function(error) {

                // If the design document still cannot be saved,
                // throw an error.
                throw $pouchModelMinErr('design', 'Unable to save design document');
              });
            });
          });
        });
      };

      var escapePrivateKey = function(properties, key) {
        if (UNESCAPED_PRIVATE_KEYS.indexOf(key) !== -1 || key.charAt(0) !== '_') {
          return key;
        }

        var escapedKey = PRIVATE_PREFIX + key;
        properties[escapedKey] = properties[key];
        delete properties[key];
        return escapedKey;
      };

      var unescapePrivateKey = function(properties, key) {
        if (key.charAt(0) !== PRIVATE_PREFIX) {
          return key;
        }

        var unescapedKey = key.substring(1);
        properties[unescapedKey] = properties[key];
        delete properties[key];
        return unescapedKey;
      };

      var escapeProperties = function(properties) {
        if (!isObject(properties)) {
          return null;
        }
        
        var keys = Object.keys(properties);
        forEach(keys, function(key) {
          key = escapePrivateKey(properties, key);

          if (isDate(properties[key])) {
            properties[key] = properties[key].toISOString();
          }
        });

        return properties;
      };

      var unescapeProperties = function(properties) {
        if (!isObject(properties)) {
          return null;
        }

        var keys = Object.keys(properties);
        forEach(keys, function(key) {
          key = unescapePrivateKey(properties, key);

          if (isString(properties[key]) && ISO_DATE_REGEX.test(properties[key])) {
            properties[key] = new Date(properties[key]);
          }
        });

        return properties;
      };

      var cast = function(type, value) {
        switch (type) {
        case 'boolean':
          if (value === true || value === false) {
            return value;
          }

          return value ? !!value : null;
        case 'date':
          if (isDate(value)) {
            return value;
          }

          return value ? new Date(value) : null;
        case 'number':
          if (isNumber(value)) {
            return value;
          }

          return value ? parseFloat(value) : null;
        case 'string':
          if (isString(value)) {
            return value;
          }

          return value ? '' + value : null;
        }

        return value;
      };

      var diff = function(fromValues, toValues) {
        var result = null;

        forEach(toValues, function(value, key) {
          var fromValue = fromValues[key];
          var toValue = value;

          if (isObject(toValue) || isObject(fromValue)) {
            if (isDate(toValue) && isDate(fromValue)) {
              if (fromValue.getTime() !== toValue.getTime()) {
                (result || (result = {}))[key] = {
                  from: fromValue,
                  to: toValue
                };
              }
            }

            return;
          }

          if (fromValue !== toValue) {
            (result || (result = {}))[key] = {
              from: fromValue,
              to: toValue
            };
          }
        });

        return result;
      };

/*
      (continued in src/factories/pouch-model/_2_route.js)
      ...
    }
  ]);
*/

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
/*
angular.module('pouch-model')
  .factory('$pouchModel', ['$q', '$http', '$pouchModelDatabase',
    function($q, $http, $pouchModelDatabase) {
      ...
      (continued from src/factories/pouch-model/_2_route.js)
*/

      var pouchModelFactory = function(schema, options) {
        options = options || {};

        // Allow flexibility in naming the JSON schema by allowing
        // either the standard `title` property or the non-standard
        // `type` property.
        var type = schema.title = schema.title || schema.type;
        delete schema.type;

        if (!type) {
          throw $pouchModelMinErr('PouchModel', 'The `schema` must define a `type` or `title` attribute');
        }

        // Set up the schema properties.
        schema.properties = schema.properties || {};

        // Set up the adapters.
        var adapterOptions = options.adapters || {};

        // Default to `local` for the primary adapter.
        var primaryAdapter = adapterOptions.primary = adapterOptions.primary || 'local';

        // Default to `remote` for the secondary adapter.
        var secondaryAdapter = adapterOptions.secondary = adapterOptions.secondary || 'remote';

        // Set up the current adapter to default to the primary adapter.
        var currentAdapter = adapterOptions.primary;

        // Set `sync` flag if `{ sync: true, url: 'http://example.com' }`
        // options are specified.
        var sync = !!(options.sync && options.url);

        // Set `singular` flag if `{ singular: true }` option is specified.
        var singular = !!options.singular;

        // Set up the current scope.
        var currentScope = options.scope;

        // Fill in any properties with a blank `type` to default to a
        // `string` type.
        forEach(schema.properties, function(property, key) {
          property.type = property.type || 'string';
        });

        // Indexes for optimizing queries.
        var indexes = {};

        var getIndexViewId = function(keys) {
          var id = DESIGN_DOC_PREFIX + type;
          return keys ? id + '_' + keys.sort().join(',') : id;
        };

        var createMapFunction = function(keys, stringify) {
          var keyParts = ['doc[\'' + PRIVATE_PREFIX + '_scope\']'];

          if (isArray(keys)) {
            forEach(keys, function(key) {
              keyParts.push('doc[\'' + key + '\']');
            });
          } else {
            stringify = !!keys;
          }

          var fn = new Function('return function(doc) {' +
            'if (doc[\'' + PRIVATE_PREFIX + '_type\'] === \'' + type + '\') {' +
              'emit(' +
                'pouchCollate.toIndexableString([' +
                  keyParts.join(',') +
                '])' +
              ');' +
            '}' +
          '}')();
          return stringify ? fn.toString() : fn;
        };

        var createIndexView = function(keys) {
          if (hasIndexView(keys)) {
            return;
          }

          var id = indexes[keys.sort().join(',')] = getIndexViewId(keys);
          createDesignDoc(id, createMapFunction(keys, true));
        };

        var hasIndexView = function(keys) {
          return !!indexes[keys.sort().join(',')];
        };

        // Create a default design document for querying this model.
        createDesignDoc(getIndexViewId(), createMapFunction(true));

        // Create "index" design documents for querying this model by
        // `created_at`, `updated_at` and `deleted_at`.
        forEach(['created_at', 'updated_at', 'deleted_at'], function(key) {
          createIndexView([key]);
        });

        // Create "index" design documents for indexed properties for
        // querying this model.
        forEach(schema.properties, function(property, key) {
          if (property.indexed) { createIndexView([key]); }
        });

        // Create "index" design documents for additional indexes defined
        // in this model's options.
        forEach(options.indexes || [], function(index) {
          if (!isArray(index)) {
            index = [index];  
          }

          createIndexView(index);
        });

        // Set up URL routes for remote model.
        var route = options.url ? new Route(options.url) : null;

        var prepareSyncOperations = function(primaryModels, secondaryModels) {
          var primaryOperations = [];
          var secondaryOperations = [];

          if (!isArray(primaryModels)) {
            primaryModels = !!primaryModels ? [primaryModels] : [];
          }

          if (!isArray(secondaryModels)) {
            secondaryModels = !!secondaryModels ? [secondaryModels] : [];
          }

          forEach(secondaryModels, function(secondaryModel) {
            var primaryModel = primaryModels.find(function(primaryModel) {
              return singular || (primaryModel.id === secondaryModel.id);
            });

            // If a primary model does not exist for this secondary model,
            // it needs to be created.
            if (!primaryModel && !secondaryModel.deleted_at) {
              if (singular) {
                secondaryModel.id = primaryModel.id;
              }

              return primaryOperations.push({
                type: 'create',
                sourceAdapter: secondaryAdapter,
                targetAdapter: primaryAdapter,
                model: secondaryModel
              });
            }

            if (!primaryModel) {
              return;
            }

            // If this secondary model has been deleted, there shouldn't
            // be a matching primary model and it needs to be removed.
            if (secondaryModel.deleted_at) {
              if (singular) {
                secondaryModel.id = primaryModel.id;
              }

              return primaryOperations.push({
                type: 'delete',
                sourceAdapter: secondaryAdapter,
                targetAdapter: primaryAdapter,
                model: secondaryModel
              });
            }

            // If this secondary model is newer than the matching primary
            // model, it needs to be updated.
            if (secondaryModel.updated_at && primaryModel.updated_at &&
                secondaryModel.updated_at.getTime() > primaryModel.updated_at.getTime()) {
              if (singular) {
                secondaryModel.id = primaryModel.id;
              }

              return primaryOperations.push({
                type: 'update',
                sourceAdapter: secondaryAdapter,
                targetAdapter: primaryAdapter,
                model: secondaryModel
              });
            }
          });

          forEach(primaryModels, function(primaryModel) {
            var secondaryModel = secondaryModels.find(function(secondaryModel) {
              return singular || (secondaryModel.id === primaryModel.id);
            });

            // If a secondary model does not exist for this primary model,
            // it needs to be created.
            if (!secondaryModel && !primaryModel.deleted_at) {
              if (singular) {
                primaryModel.id = secondaryModel.id;
              }

              return secondaryOperations.push({
                type: 'create',
                sourceAdapter: primaryAdapter,
                targetAdapter: secondaryAdapter,
                model: primaryModel
              });
            }

            if (!secondaryModel) {
              return;
            }

            // If this primary model has been deleted, there shouldn't
            // be a matching secondary model and it needs to be removed.
            if (primaryModel.deleted_at) {
              if (singular) {
                primaryModel.id = secondaryModel.id;
              }

              return secondaryOperations.push({
                type: 'delete',
                sourceAdapter: primaryAdapter,
                targetAdapter: secondaryAdapter,
                model: primaryModel
              });
            }

            // If this primary model is newer than the matching secondary
            // model, it needs to be updated.
            if (primaryModel.updated_at && secondaryModel.updated_at &&
                primaryModel.updated_at.getTime() > secondaryModel.updated_at.getTime()) {
              if (singular) {
                primaryModel.id = secondaryModel.id;
              }

              return secondaryOperations.push({
                type: 'update',
                sourceAdapter: primaryAdapter,
                targetAdapter: secondaryAdapter,
                model: primaryModel
              });
            }
          });

          var operations = {};
          operations[primaryAdapter] = primaryOperations;
          operations[secondaryAdapter] = secondaryOperations;

          return operations;
        };

        function PouchModelQueryResult(models, params) {
          this.push.apply(this, models);
          this.params = params;
        }

        PouchModelQueryResult.prototype = Object.create(Array.prototype);

        PouchModelQueryResult.prototype.constructor = PouchModelQueryResult;

        PouchModelQueryResult.prototype.refresh = function(success, error) {
          var self = this;
          var deferred = $q.defer();

          PouchModel.query(this.params, function(models) {
            while (self.length > 0) {
              self.pop();
            }

            self.push.apply(self, models);

            if (isFunction(success)) {
              success.call(PouchModel, self);
            }

            deferred.resolve(self);
          }, function(exception) {
            if (isFunction(error)) {
              error.call(PouchModel, exception);
            }
            
            deferred.reject(exception);
            throw $pouchModelMinErr('refresh', 'Unable to complete operation');
          });

          return deferred.promise;
        };

/*
        (continued in src/factories/pouch-model/_4_class.js)
        ...
      };

      return pouchModelFactory;
    }
  ]);
*/

/*
angular.module('pouch-model')
  .factory('$pouchModel', ['$q', '$http', '$pouchModelDatabase',
    function($q, $http, $pouchModelDatabase) {
      var pouchModelFactory = function(schema, options) {
        ...
        (continued from src/factories/pouch-model/_3_factory.js)
*/

        /**
         * @constructor
         * @name PouchModel
         *
         * @param {Object=} properties Optional properties to copy to
         *   this model instance.
         * @param {Boolean=} remote Optional `Boolean` flag indicating if the
         *   instance of this model should be exclusively stored remotely.
         */
        function PouchModel(properties, remote) {
          var self = this;

          // Set up default values as defined in the schema.
          forEach(schema.properties, function(property, key) {
            var defaultValue = property['default'];
            self[key] = isFunction(defaultValue) ?
              defaultValue.call(self) : defaultValue;
          });

          // Set up private `_type` property.
          this._type = type;

          // Set up private `_scope` property.
          this._scope = currentScope;

          // Set up private `_attachments` property.
          this._attachments = {};

          // Copy properties passed into constructor to this instance.
          if (isObject(properties)) {
            extend(this, properties);

            // Set flag indicating if this instance is remote.
            remote = !!remote;
          }

          // If no properties were passed in, use the first argument
          // to check if this instance is remote.
          else {
            remote = !!properties;
          }

          // Set up internal object for storing the last-persisted
          // or initialized state of the properties of this instance.
          var previousProperties = this.getProperties();

          // Trigger callbacks.
          this.trigger('after', 'initialize');

          /**
           * @ngdoc method
           * @name PouchModel#isRemote
           *
           * @returns {Boolean}
           *
           * @description
           * Returns a `Boolean` flag indicating if this instance is
           * stored remotely.
           */
          this.isRemote = function() {
            return remote;
          };

          /**
           * @ngdoc method
           * @name PouchModel#getPreviousProperties
           *
           * @returns {Object}
           *
           * @description
           * Returns the last-persisted or initialized state of the
           * properties of this instance.
           */
          this.getPreviousProperties = function() {
            return previousProperties;
          };
        }

        PouchModel.prototype.constructor = PouchModel;

        // Callbacks for adding hooks when changing this model.
        PouchModel.callbacks = {
          before: { change: [], save: [], create: [], update: [], delete: [], sync: [] },
          failed: { change: [], save: [], create: [], update: [], delete: [], sync: [] },
          after:  { change: [], save: [], create: [], update: [], delete: [], sync: [], initialize: [] }
        };

        /**
         * @ngdoc method
         * @name PouchModel.on
         *
         * @param {String} type Specifies if the `callback` should be
         *   called 'before' or 'after' the `action` or if the `action`
         *   has 'failed'.
         * @param {String} action Specifies the name of the action that
         *   this `callback` should be registered for.
         * @param {Function} callback Function to be called for the
         *   specified `type` and `action`.
         *
         * @description
         * Registers a callback to be triggered for a specific `action`
         * and `type`.
         *
         * Valid 'before' and 'failed' actions:
         *   'change', 'save', 'create', 'update', 'delete', 'sync'
         *
         * Valid 'after' actions:
         *   'change', 'save', 'create', 'update', 'delete', 'sync', 'initialize'
         *
         * ```js
         * MyModel.on('before', 'save', function() {
         *   ...
         * });
         * ```
         */
        PouchModel.on = function(type, action, callback) {
          var actions = PouchModel.callbacks[type];
          if (isFunction(callback) && actions && actions[action]) {
            actions[action].push(callback);
          }

          return PouchModel;
        };

        /**
         * @ngdoc method
         * @name PouchModel.off
         *
         * @param {String} type Specifies if the callback should be removed
         *   for the 'before', 'after' or 'failed' `action`.
         * @param {String} action Specifies the name of the callback action
         *   to stop listening to.
         * @param {Function=} callback Optional callback function to remove.
         *   If one is not specified, all callbacks are removed for the
         *   specified `type` and `action`.
         *
         * @description
         * Unregisters one or more callbacks for a specific `action` and
         * `type`.
         *
         * Valid 'before' and 'failed' actions:
         *   'change', 'save', 'create', 'update', 'delete', 'sync'
         *
         * Valid 'after' actions:
         *   'change', 'save', 'create', 'update', 'delete', 'sync', 'initialize'
         *
         * ```js
         * // Remove a specific 'before' callback for the 'save' action
         * MyModel.off('before', 'save', function() {
         *   ...
         * });
         *
         * // Remove all 'after' callbacks for the 'update' action
         * MyModel.off('after', 'update');
         * ```
         */
        PouchModel.off = function(type, action, callback) {
          var actions = PouchModel.callbacks[type];
          if (!actions) {
            return;
          }

          var callbacks = actions[action];
          if (!callbacks) {
            return;
          }

          if (!isFunction(callback)) {
            while (callbacks.length > 0) {
              callbacks.pop();
            }

            return;
          }

          for (var i = 0, length = callbacks.length; i < length; i++) {
            if (callbacks[i] === callback) {
              callbacks.splice(i, 1);
              return;
            }
          }
        };

        /**
         * @ngdoc method
         * @name PouchModel.wrap
         *
         * @param {Object|Array} data Raw data as an `Object` or `Array` of raw
         *   data to wrap as a `PouchModel` instance or an `Array` of instances.
         * @param {Boolean=} remote Optional `Boolean` flag indicating if the
         *   `PouchModel` instance(s) returned should be stored remotely.
         *
         * @returns {Object|Array}
         *
         * @description
         * Wraps the raw data passed in as instance(s) of this `PouchModel`. If
         * an `Array` of raw data is passed, a new `Array` will be returned
         * with each `Object` wrapped as an instance of this `PouchModel`. If a
         * `null` or `undefined` value is passed, a `null` will be returned.
         */
        PouchModel.wrap = function(data, remote) {
          if (!data) {
            return null;
          }

          if (!isArray(data)) {
            return new PouchModel(data, remote);
          }

          var models = [];
          for (var i = 0, length = data.length; i < length; i++) {
            models.push(PouchModel.wrap(data[i], remote));
          }

          return models;
        };

        /**
         * @ngdoc method
         * @name PouchModel.isSingular
         *
         * @returns {Boolean}
         *
         * @description
         * Returns a flag indicating whether or not this model is treated
         * as a singular model. Singular models are useful when there will
         * only ever be *one* and only *one* record for a given model.
         */
        PouchModel.isSingular = function() {
          return singular;
        };

        /**
         * @ngdoc method
         * @name PouchModel.getSchema
         *
         * @returns {Object}
         *
         * @description
         * Retrieves the JSON schema used to define this model.
         */
        PouchModel.getSchema = function() {
          return schema;
        };

        /**
         * @ngdoc method
         * @name PouchModel.getIndexes
         *
         * @returns {Object}
         *
         * @description
         * Returns an `Object` with keys representing the indexes of this
         * model where the values are the corresponding index IDs.
         */
        PouchModel.getIndexes = function() {
          return indexes;
        };

        /**
         * @ngdoc method
         * @name PouchModel.getAdapter
         *
         * @returns {String}
         *
         * @description
         * Returns the name of the current adapter for accessing the
         * datastore.
         */
        PouchModel.getAdapter = function() {
          return currentAdapter;
        };

        /**
         * @ngdoc method
         * @name PouchModel.setAdapter
         *
         * @param {String} newAdapter The name of the adapter to use
         *   for accessing the datastore.
         *
         * @description
         * Changes the adapter to be used for accessing the datastore.
         */
        PouchModel.setAdapter = function(newAdapter) {
          currentAdapter = newAdapter;
        };

        /**
         * @ngdoc method
         * @name PouchModel.useAdapter
         *
         * @param {String} newAdapter The name of the adapter to use
         *   for accessing the datastore.
         * @param {Function} callback The function to execute while using
         *   this adapter to access the datastore.
         *
         * @returns {*}
         *
         * @description
         * Temporarily changes the adapter to be used for the duration of
         * the specified `callback` function.
         */
        PouchModel.useAdapter = function(newAdapter, callback) {
          var oldAdapter = currentAdapter;
          var result;

          currentAdapter = newAdapter;

          if (isFunction(callback)) {
            result = callback.call(PouchModel);
          }

          currentAdapter = oldAdapter;
          return result;
        };

        /**
         * @ngdoc method
         * @name PouchModel.getScope
         *
         * @returns {String}
         *
         * @description
         * Returns the current scope used by this model for accessing the
         * datastore. This is useful for sandboxing the local datastore in
         * cases where multiple users may be sharing the same device.
         */
        PouchModel.getScope = function() {
          return currentScope;
        };

        /**
         * @ngdoc method
         * @name PouchModel.setScope
         *
         * @param {String} newScope The scope to use for accessing the
         *   datastore.
         *
         * @description
         * Changes the current scope to be used for accessing the datastore.
         * This is useful for sandboxing the local datastore in cases where
         * multiple users may be sharing the same device.
         */
        PouchModel.setScope = function(newScope) {
          currentScope = newScope;
        };

        /**
         * @ngdoc method
         * @name PouchModel.useScope
         *
         * @param {String} newScope The scope to use for accessing the
         *   datastore.
         * @param {Function} callback The function to execute while using
         *   this scope to access the datastore.
         *
         * @returns {*}
         *
         * @description
         * Temporarily changes the current scope to be used for the duration
         * of the specified `callback` function.
         */
        PouchModel.useScope = function(newScope, callback) {
          var oldScope = currentScope;
          var result;

          currentScope = newScope;

          if (isFunction(callback)) {
            result = callback.call(PouchModel);
          }

          currentScope = oldScope;
          return result;
        };

        /**
         * @ngdoc method
         * @name PouchModel.query
         *
         * @param {Object=} params Optional `Object` containing key/value
         *   pairs to use as criteria for querying the database.
         * @param {Function=} success Optional callback for handling the
         *   condition where the database operation was successful.
         * @param {Function=} error Optional callback for handling the
         *   condition where the database operation failed.
         *
         * @returns {Promise}
         *
         * @description
         * Queries the adapter and returns a `Promise` that will resolve
         * to an `Array` of results wrapped up as instances of this model.
         */
        PouchModel.query = function(params, success, error) {
          if (singular) {
            throw $pouchModelMinErr('query', 'Cannot query singular models');
          }

          var deferred = $q.defer();

          var adapter = PouchModel.adapters[currentAdapter];
          var primary = currentAdapter === primaryAdapter;
          var remote = currentAdapter === 'remote';
          var operator = adapter.query;

          params = params || {};

          if (isFunction(params)) {
            error = success;
            success = params;
            params = {};
          }

          operator(params)
            .then(function(result) {
              var models = PouchModel.wrap(result.map(function(properties) {
                return unescapeProperties(properties);
              }), remote);

              var queryResult = new PouchModelQueryResult(models.filter(function(model) {
                return !model.isDeleted();
              }), params);

              if (isFunction(success)) {
                success.call(PouchModel, queryResult);
              }

              deferred.resolve(queryResult);

              // Query the secondary adapter using the same params if
              // this model is to be synced and the query was successful
              // from the primary adapter.
              if (sync && primary) {
                $timeout(function() {
                  PouchModel.useAdapter(secondaryAdapter, function() {
                    PouchModel.query(params, function(remoteModels) {
                      var operations = prepareSyncOperations(models, remoteModels);
                      $pouchModelSync.sync(operations, function() {
                        queryResult.refresh();
                      });
                    });
                  });
                });
              }
            })
            .catch(function(exception) {
              if (isFunction(error)) {
                error.call(PouchModel, exception);
              }

              deferred.reject(exception);
            });

          return deferred.promise;
        };

        /**
         * @ngdoc method
         * @name PouchModel.get
         *
         * @param {Object=} params Object containing key/value pairs to
         *   use as criteria for querying the database.
         * @param {Function=} success Optional callback for handling the
         *   condition where the database operation was successful.
         * @param {Function=} error Optional callback for handling the
         *   condition where the database operation failed.
         *
         * @returns {Promise}
         *
         * @description
         * Queries the adapter and returns a `Promise` that will resolve
         * to the _first_ result matching the specified criteria wrapped
         * up as an instance of this model.
         */
        PouchModel.get = function(params, success, error) {
          var deferred = $q.defer();

          var adapter = PouchModel.adapters[currentAdapter];
          var primary = currentAdapter === primaryAdapter;
          var remote = currentAdapter === 'remote';
          var operator = adapter.get;

          if (singular) {
            if (params && !isFunction(params)) {
              throw $pouchModelMinErr('get', 'Cannot specify params for singular models');
            }

            error = success;
            success = params;
            params = {};
          }

          else if (!params || isFunction(params)) {
            throw $pouchModelMinErr('get', 'No params specified');
          }

          operator(params)
            .then(function(result) {

              // Always ensure a result for singular models.
              if (singular && !result) {
                return (function() {
                  var model = new PouchModel();
                  model.$create()
                    .then(function(model) {
                      if (isFunction(success)) {
                        success.call(PouchModel, model);
                      }

                      deferred.resolve(model);
                    })
                    .catch(function(exception) {
                      if (isFunction(error)) {
                        error.call(PouchModel, exception);
                      }

                      deferred.reject(exception);
                    });
                })();
              }

              var properties = unescapeProperties(result);
              var model = PouchModel.wrap(properties, remote);

              if (isFunction(success)) {
                success.call(PouchModel, model);
              }

              deferred.resolve(model);

              // Query the secondary adapter using the same params if
              // this model is to be synced and the query was successful
              // from the primary adapter.
              if (sync && primary) {
                $timeout(function() {
                  PouchModel.useAdapter(secondaryAdapter, function() {
                    var rehydrateModel = function(syncedModel) {
                      extend(model, syncedModel.getProperties());
                    };

                    if (singular) {
                      PouchModel.get(function(remoteModel) {
                        var operations = prepareSyncOperations(model, remoteModel);
                        $pouchModelSync.sync(operations, function() {
                          PouchModel.get(rehydrateModel);
                        });
                      });
                    }

                    else {
                      PouchModel.get(params, function(remoteModel) {
                        var operations = prepareSyncOperations(model, remoteModel);
                        $pouchModelSync.sync(operations, function() {
                          PouchModel.get(params, rehydrateModel);
                        });
                      });
                    }
                  });
                });
              }
            })
            .catch(function(exception) {
              if (isFunction(error)) {
                error.call(PouchModel, exception);
              }

              deferred.reject(exception);
            });

          return deferred.promise;
        };

/*
        (continued in src/factories/pouch-model/_5_adapters.js)
        ...
        return PouchModel;
      };

      return pouchModelFactory;
    }
  ]);
*/

/*
angular.module('pouch-model')
  .factory('$pouchModel', ['$q', '$http', '$pouchModelDatabase',
    function($q, $http, $pouchModelDatabase) {
      var pouchModelFactory = function(schema, options) {
        function PouchModel(properties, remote) {}
        ...
        (continued from src/factories/pouch-model/_4_class.js)
*/

        PouchModel.adapters = {
          local: {
            query: function(params) {
              var deferred = $q.defer();
              var keys = Object.keys(params).sort();

              // Handle special case where we are querying all records. (FAST)
              if (keys.length === 0) {
                db.query(getIndexViewId(), {
                  include_docs: true,
                  key: pouchCollate.toIndexableString([currentScope])
                }).then(function(result) {
                  deferred.resolve(result.rows.map(function(row) { return row.doc; }));
                }).catch(deferred.reject);

                return deferred.promise;
              }

              // Map values for keys to an indexable string for querying.
              var value = pouchCollate.toIndexableString([currentScope].concat(keys.map(function(key) {
                return params[key];
              })));

              // Use an index view for querying if the key(s) specified in the
              // params are indexed. (FAST)
              if (hasIndexView(keys)) {
                db.query(getIndexViewId(keys), {
                  include_docs: true,
                  key: value
                }).then(function(result) {
                  deferred.resolve(result.rows.map(function(row) { return row.doc; }));
                }).catch(deferred.reject);

                return deferred.promise;
              }

              // Otherwise, build a view for querying on-demand. (SLOW)
              console.warn('Non-indexed queries can result in poor performance', params);

              db.query(createMapFunction(keys), {
                include_docs: true,
                key: value
              }).then(function(result) {
                deferred.resolve(result.rows.map(function(row) { return row.doc; }));
              }).catch(deferred.reject);

              return deferred.promise;
            },
            
            get: function(params) {
              var deferred = $q.defer();
              var keys = Object.keys(params).sort();

              // Handle special case where we are retrieving a singular model. (FAST)
              if (keys.length === 0) {
                db.query(getIndexViewId(), {
                  include_docs: true,
                  limit: 1,
                  key: pouchCollate.toIndexableString([currentScope])
                }).then(function(result) {
                  deferred.resolve(result.rows[0] && result.rows[0].doc);
                }).catch(deferred.reject);

                return deferred.promise;
              }

              // Handle special cases where we are simply retrieving a document
              // by its local `_id`. (FASTEST)
              if (keys.length === 1) {
                if (keys[0] === '_id') {
                  db.get(params._id)
                    .then(deferred.resolve)
                    .catch(deferred.reject);

                  return deferred.promise;
                } else if (keys[0] === 'id') {
                  db.get([type, currentScope, params.id].join(PRIVATE_PREFIX))
                    .then(deferred.resolve)
                    .catch(deferred.reject);

                  return deferred.promise;
                }
              }

              // Map values for keys to an indexable string for querying.
              var value = pouchCollate.toIndexableString([currentScope].concat(keys.map(function(key) {
                return params[key];
              })));

              // Unless we are retrieving by the local `_id`, use an index view
              // for querying if the key(s) specified in the params are indexed
              // and return the first result of the query. (FAST)
              if (hasIndexView(keys)) {
                db.query(getIndexViewId(keys), {
                  include_docs: true,
                  limit: 1,
                  key: value
                }).then(function(result) {
                  deferred.resolve(result.rows[0] && result.rows[0].doc);
                }).catch(deferred.reject);

                return deferred.promise;
              }

              // Otherwise, build a view for querying on-demand and return the
              // first result of the query. (SLOW)
              console.warn('Non-indexed queries can result in poor performance', params);

              db.query(createMapFunction(keys), {
                include_docs: true,
                limit: 1,
                key: value
              }).then(function(result) {
                deferred.resolve(result.rows[0] && result.rows[0].doc);
              }).catch(deferred.reject);
              
              return deferred.promise;
            },

            getAttachment: function(properties, property) {
              var deferred = $q.defer();

              db.getAttachment(properties._id, property)
                .then(deferred.resolve)
                .catch(deferred.reject);

              return deferred.promise;
            },

            create: function(properties) {
              var deferred = $q.defer();

              var type  = properties[PRIVATE_PREFIX + '_type'];
              var scope = properties[PRIVATE_PREFIX + '_scope'];

              // Strip attachments from properties to save separately.
              var attachments = properties._attachments;
              delete properties._attachments;

              // Assign a global identifier if one has not been defined.
              var id  = properties.id  = properties.id  || UUID();

              // Assign a local identifier if one has not been defined.
              var _id = properties._id = properties._id || [type, scope, id].join(PRIVATE_PREFIX);

              // Store the properties to the local database.
              db.put(properties)
                .then(function(result) {

                  // Update the current `_rev` from the local database.
                  properties._rev = result.rev;
                  
                  deferred.resolve(properties);
                })
                .catch(deferred.reject);

              return deferred.promise;
            },

            update: function(properties) {
              var deferred = $q.defer();

              var type  = properties[PRIVATE_PREFIX + '_type'];
              var scope = properties[PRIVATE_PREFIX + '_scope'];

              // Strip attachments from properties to save separately.
              var attachments = properties._attachments;
              delete properties._attachments;

              // Determine the local identifier.
              var _id = properties._id || [type, scope, properties.id].join(PRIVATE_PREFIX);

              // Get the document from the local database.
              db.get(_id)
                .then(function(result) {

                  // Get the `_id` and current `_rev` from the local database.
                  properties._id = result._id;
                  properties._rev = result._rev;

                  // Store the properties to the local database.
                  db.put(properties)
                    .then(function(result) {

                      // Update the current `_rev` from the local database.
                      properties._rev = result.rev;
                      
                      deferred.resolve(properties);
                    })
                    .catch(deferred.reject);
                })
                .catch(deferred.reject);

              return deferred.promise;
            },

            updateAttachment: function(properties, property, blob, name, type) {
              var deferred = $q.defer();

              db.putAttachment(properties._id, property, properties._rev, blob, type)
                .then(deferred.resolve)
                .catch(deferred.reject);

              return deferred.promise;
            },

            delete: function(properties) {
              var deferred = $q.defer();

              var type  = properties[PRIVATE_PREFIX + '_type'];
              var scope = properties[PRIVATE_PREFIX + '_scope'];

              // Strip attachments from properties to save separately.
              var attachments = properties._attachments;
              delete properties._attachments;

              // Determine the local identifier.
              var _id = properties._id || [type, scope, properties.id].join(PRIVATE_PREFIX);

              // Get the document from the local database.
              db.get(_id)
                .then(function(result) {

                  // Get the `_id` and current `_rev` from the local database.
                  properties._id = result._id;
                  properties._rev = result._rev;

                  // Set `deleted_at` flag.
                  properties.deleted_at = new Date();

                  // Store the properties to the local database.
                  db.put(properties)
                    .then(function(result) {

                      // Update the current `_rev` from the local database.
                      properties._rev = result.rev;
                      
                      deferred.resolve(properties);
                    })
                    .catch(deferred.reject);
                })
                .catch(deferred.reject);

              return deferred.promise;
            },

            deleteAttachment: function(properties, property) {
              var deferred = $q.defer();

              db.removeAttachment(properties._id, property, properties._rev)
                .then(deferred.resolve)
                .catch(deferred.reject);

              return deferred.promise;
            }
          },

          remote: {
            query: function(params) {
              var deferred = $q.defer();
              var config = route.createRequestConfig('GET', params);

              $http(config)
                .success(function(data, status, headers, config) {
                  deferred.resolve(data);
                })
                .error(function(data, status, headers, config) {
                  deferred.reject({
                    data: data,
                    status: status,
                    headers: headers,
                    config: config
                  });
                });
              
              return deferred.promise;
            },

            get: function(params) {
              var deferred = $q.defer();
              var config = route.createRequestConfig('GET', params);

              $http(config)
                .success(function(data, status, headers, config) {
                  deferred.resolve(data);
                })
                .error(function(data, status, headers, config) {
                  deferred.reject({
                    data: data,
                    status: status,
                    headers: headers,
                    config: config
                  });
                });
              
              return deferred.promise;
            },

            getAttachment: function(properties, property) {
              var deferred = $q.defer();
              var propertyOptions = schema.properties[property];
              var propertyRoute = propertyOptions.url ? new Route(propertyOptions.url) : null;
              
              // If a specific URL template is not defined for the specified
              // `property`, attempt to use the model's `url` with '/:property'
              // appended to the end.
              //
              // For example, a model with `options.url` set to '/api/pictures/:id'
              // and a property named 'photo' with a `type` of 'file' would result
              // in '/api/pictures/:id/photo'.
              //
              // If both the property and the model fail to specify a URL template,
              // the promise will be rejected with a `null`.
              if (!propertyRoute) {
                propertyRoute = options.url ? new Route(options.url + '/' + property) : null;
              }
              
              if (!propertyRoute) {
                $timeout(function() {
                  deferred.reject(null);
                });

                return deferred.promise;
              }
              
              var config = propertyRoute.createRequestConfig('GET', properties);

              $timeout(function() {
                deferred.resolve(config.url);
              });

              return deferred.promise;
            },

            create: function(properties) {
              var deferred = $q.defer();

              // Assign a global identifier if one has not been defined.
              properties.id  = properties.id  || UUID();

              // Send the properties to the remote service.
              var config = route.createRequestConfig('PUT', properties);
              config.data = properties;
              
              $http(config)
                .success(deferred.resolve)
                .error(function(data, status, headers, config) {

                  // Handle case where model cannot be created
                  // because it has already been deleted.
                  if (status === 410) {
                    deferred.reject({ deleted: true });
                    return;
                  }

                  deferred.reject(data, status, headers, config);
                });

              return deferred.promise;
            },

            update: function(properties) {
              var deferred = $q.defer();

              // Send the properties to the remote service.
              var config = route.createRequestConfig('PUT', properties);
              config.data = properties;

              $http(config)
                .success(deferred.resolve)
                .error(deferred.reject);

              return deferred.promise;
            },

            updateAttachment: function(properties, property, blob, name, type) {
              var deferred = $q.defer();

              // Append the `Blob` to a new `FormData` object.
              var formData = new FormData();
              formData.append(property, blob, name);

              // Send the `FormData` to the remote service.
              var config = route.createRequestConfig('PUT', properties);
              config.data = formData;
              config.headers = { 'Content-Type': undefined };
              config.transformRequest = angular.identity;

              $http(config)
                .success(deferred.resolve)
                .error(deferred.reject);

              return deferred.promise;
            },

            delete: function(properties) {
              var deferred = $q.defer();

              // Send the properties to the remote service.
              var config = route.createRequestConfig('DELETE', properties);
              $http(config)
                .success(deferred.resolve)
                .error(function(data, status, headers, config) {

                  // Fail silently if operation could not complete
                  // because the model to be deleted is not found.
                  if (status === 404) {
                    deferred.resolve(data, status, headers, config);
                    return;
                  }

                  deferred.reject(data, status, headers, config);
                });

              return deferred.promise;
            },

            deleteAttachment: function(properties, property) {
              var deferred = $q.defer();

              //
              // TODO: Implement
              //
              console.warn('[PouchModel.adapters.remote.deleteAttachment]', 'not implemented');

              return deferred.promise;
            }
          }
        };

/*
        (continued in src/factories/pouch-model/_6_instance.js)
        ...
        return PouchModel;
      };

      return pouchModelFactory;
    }
  ]);
*/

/*
angular.module('pouch-model')
  .factory('$pouchModel', ['$q', '$http', '$pouchModelDatabase',
    function($q, $http, $pouchModelDatabase) {
      var pouchModelFactory = function(schema, options) {
        function PouchModel(properties, remote) {}
        ...
        (continued from src/factories/pouch-model/_5_adapters.js)
*/

        var executeOperation = function(model, type, success, error, before, after, undo) {
          var deferred = $q.defer();

          // Execute the 'before' callback(s).
          before.call(model);

          var adapter = model.isRemote() ?
            PouchModel.adapters.remote :
            PouchModel.adapters.local;
          var operator = adapter[type];
          var properties = model.getEscapedProperties();

          // Strip attachments to save separately.
          var attachments = properties._attachments;
          delete properties._attachments;

          operator(properties)
            .then(function(result) {

              // Execute the 'after' callback(s).
              after.call(model, result);

              // Update the last-persisted state of the properties for this model.
              copy(model.getProperties(), model.getPreviousProperties());

              // Execute the 'success' callback (if provided).
              if (isFunction(success)) {
                success.call(model, result);
              }

              // Resolve the promise.
              deferred.resolve(result);

              //
              // TODO: Postpone resolving promise until attachments are updated.
              //
              // Update attachments if this is not a 'delete' operation.
              if (type !== 'delete') {
                forEach(attachments, function(attachment, property) {
                  if (!attachment || !attachment.isNew) {
                    return;
                  }

                  var blob = attachment.blob;
                  var name = attachment.name;
                  var type = attachment.type;

                  adapter.updateAttachment(result, property, blob, name, type)
                    .then(function(result) {
                      console.log(result);
                    })
                    .catch(function(exception) {
                      console.warn(exception);
                    });
                });
              }
            })
            .catch(function(exception) {

              // Perform any necessary 'undo' operations to rollback the
              // operation.
              undo.call(model, exception);

              // Execute the 'error' callback (if provided).
              if (isFunction(error)) {
                error.call(model, exception);
              }

              // Reject the promise and throw an error
              deferred.reject(exception);
              throw $pouchModelMinErr(type, 'Unable to complete operation');
            });

          return deferred.promise;
        };

        /**
         * @ngdoc method
         * @name PouchModel#$save
         *
         * @param {Function=} success Optional callback for handling the
         *   condition where the database operation was successful.
         * @param {Function=} error Optional callback for handling the
         *   condition where the database operation failed.
         *
         * @returns {Promise}
         *
         * @description
         * Creates or updates the record for this model instance.
         */
        PouchModel.prototype.$save = function(success, error) {
          var method = this.isNew() ? this.$create : this.$update;
          return method.apply(this, arguments);
        };

        /**
         * @ngdoc method
         * @name PouchModel#$create
         *
         * @param {Function=} success Optional callback for handling the
         *   condition where the create operation was successful.
         * @param {Function=} error Optional callback for handling the
         *   condition where the create operation failed.
         *
         * @returns {Promise}
         *
         * @description
         * Creates the record for this model instance.
         */
        PouchModel.prototype.$create = function(success, error) {
          if (!this.isNew()) {
            throw $pouchModelMinErr('create', 'Model has already been created');
          }

          var before = function() {
            this.trigger('before', 'change');
            this.trigger('before', 'create');
            this.trigger('before', 'save');

            // Update timestamp properties.
            var timestamp = new Date();
            this.created_at = timestamp;
            this.updated_at = timestamp;
            this.deleted_at = null;
          };

          var after = function(result) {
            this.trigger('after', 'change');
            this.trigger('after', 'create');
            this.trigger('after', 'save');
          };

          var undo = function(exception) {
            delete this.created_at;
            delete this.updated_at;
            delete this.deleted_at;

            this.trigger('failed', 'change');
            this.trigger('failed', 'create');
            this.trigger('failed', 'save');
          };

          return executeOperation(this, 'create', success, error, before, after, undo);
        };

        /**
         * @ngdoc method
         * @name PouchModel#$update
         *
         * @param {Function=} success Optional callback for handling the
         *   condition where the update operation was successful.
         * @param {Function=} error Optional callback for handling the
         *   condition where the update operation failed.
         *
         * @returns {Promise}
         *
         * @description
         * Updates the record for this model instance.
         */
        PouchModel.prototype.$update = function(success, error) {
          if (this.isNew()) {
            throw $pouchModelMinErr('update', 'Model has not been created');
          }

          var lastUpdatedAt = this.updated_at;

          var before = function() {
            this.trigger('before', 'change');
            this.trigger('before', 'update');
            this.trigger('before', 'save');

            // Update timestamp properties.
            var timestamp = new Date();
            this.updated_at = timestamp;
          };

          var after = function(result) {
            this.trigger('after', 'change');
            this.trigger('after', 'update');
            this.trigger('after', 'save');
          };

          var undo = function(exception) {
            this.updated_at = lastUpdatedAt;

            this.trigger('failed', 'change');
            this.trigger('failed', 'update');
            this.trigger('failed', 'save');
          };

          return executeOperation(this, 'update', success, error, before, after, undo);
        };

        /**
         * @ngdoc method
         * @name PouchModel#$delete
         *
         * @param {Function=} success Optional callback for handling the
         *   condition where the delete operation was successful.
         * @param {Function=} error Optional callback for handling the
         *   condition where the delete operation failed.
         *
         * @returns {Promise}
         *
         * @description
         * Deletes the record for this model instance.
         */
        PouchModel.prototype.$delete = function(success, error) {
          if (this.isNew()) {
            throw $pouchModelMinErr('delete', 'Model has not been created');
          }

          var lastUpdatedAt = this.updated_at;

          var before = function() {
            this.trigger('before', 'change');
            this.trigger('before', 'delete');

            // Update timestamp properties.
            var timestamp = new Date();
            this.updated_at = timestamp;
            this.deleted_at = timestamp;
          };

          var after = function(result) {
            this.trigger('after', 'change');
            this.trigger('after', 'delete');
          };

          var undo = function(exception) {
            this.updated_at = lastUpdatedAt;
            this.deleted_at = null;

            this.trigger('failed', 'change');
            this.trigger('failed', 'delete');
          };

          return executeOperation(this, 'delete', success, error, before, after, undo);
        };

        /**
         * @ngdoc method
         * @name PouchModel#$remove
         *
         * @param {Function=} success Optional callback for handling the
         *   condition where the delete operation was successful.
         * @param {Function=} error Optional callback for handling the
         *   condition where the delete operation failed.
         *
         * @returns {Promise}
         *
         * @description
         * Removes the record for this model instance from the database
         * or the remote service.
         */
        PouchModel.prototype.$remove = PouchModel.prototype.$delete;

        /**
         * @ngdoc method
         * @name PouchModel#getType
         *
         * @returns {String}
         *
         * @description
         * Retrieves the `type` (or `title`) of the model as defined
         * by the JSON schema.
         */        
        PouchModel.prototype.getType = function() { return type; };

        /**
         * @ngdoc method
         * @name PouchModel#trigger
         *
         * @param {String} type Specifies if the 'before', 'after' or
         *   'failed' callbacks should be triggered for the specified
         *   `action`.
         * @param {String} action Specifies the name of the action the
         *   callbacks are being triggered for.
         *
         * @description
         * Triggers the registered callbacks for a this model's `action`
         * and `type`.
         *
         * Valid 'before' and 'failed' actions:
         *   'save', 'create', 'update', 'delete' 'sync'
         *
         * Valid 'after' actions:
         *   'save', 'create', 'update', 'delete', 'sync', 'initialize'
         */
        PouchModel.prototype.trigger = function(type, action) {
          var self = this;
          forEach(PouchModel.callbacks[type][action], function(callback) {
            callback.call(self, self, type, action);
          });
        };

        /**
         * @ngdoc method
         * @name PouchModel#getProperties
         *
         * @returns {Object}
         *
         * @description
         * Retrieves the schema-defined properties of this model
         * instance along with the timestamp properties (e.g.:
         * `created_at`, `updated_at` and `deleted_at`), the `id`
         * identifier and all private properties (un-escaped).
         * All schema-defined properties and timestamp properties
         * returned are properly casted to their respective types.
         */        
        PouchModel.prototype.getProperties = function() {
          var properties = {};
          var model = this;

          // Get identifier (`id`) and private properties from
          // model.
          forEach(model, function(value, key) {
            if (key === 'id' || key.charAt(0) === '_') {
              properties[key] = model[key];
            }
          });

          // Get timestamp properties from model and cast them
          // to `Date` objects (if needed).
          forEach(['created_at', 'updated_at', 'deleted_at'], function(key) {
            properties[key] = cast('date', model[key]);
          });

          // Get schema-defined properties from model and cast
          // them to the appropriate type (if needed).
          forEach(schema.properties, function(field, key) {
            properties[key] = cast(field.type, model[key]);
          });

          return properties;
        };

        /**
         * @ngdoc method
         * @name PouchModel#getEscapedProperties
         *
         * @returns {Object}
         *
         * @description
         * Retrieves the same properties of this model instance
         * returned by calling `getProperties`, except all of the
         * private properties (prefixed with `_`) are properly
         * escaped.
         */        
        PouchModel.prototype.getEscapedProperties = function() {
          return escapeProperties(this.getProperties());
        };

        /**
         *
         */
        PouchModel.prototype.reset = function() {
          extend(this, this.getPreviousProperties());
        };

        /**
         *
         */
        PouchModel.prototype.getAttachment = function(property, success, error) {
          if (!schema.properties[property]) {
            throw $pouchModelMinErr('getAttachment', 'Specified `property` not defined in schema');
          }

          if (schema.properties[property].type !== 'file') {
            throw $pouchModelMinErr('getAttachment', 'Specified `property` is not of type `file`');
          }

          var deferred = $q.defer();

          var model = this;
          var adapter = this.isRemote() ?
            PouchModel.adapters.remote :
            PouchModel.adapters.local;

          adapter.getAttachment(this.getEscapedProperties(), property)
            .then(function(result) {
              var url = result instanceof Blob ? URL.createObjectURL(result) : result;

              // Execute the 'success' callback (if provided).
              if (isFunction(success)) {
                success.call(model, url);
              }

              // Resolve the promise.
              deferred.resolve(url);
            })
            .catch(function(exception) {

              // Execute the 'error' callback (if provided).
              if (isFunction(error)) {
                error.call(model, exception);
              }

              // Reject the promise and throw an error
              deferred.reject(exception);
              throw $pouchModelMinErr('getAttachment', 'Unable to complete operation');
            });

          return deferred.promise;
        };

        /**
         *
         */
        PouchModel.prototype.setAttachment = function(property, blob, name, type) {
          if (!schema.properties[property]) {
            throw $pouchModelMinErr('setAttachment', 'Specified `property` not defined in schema');
          }

          if (schema.properties[property].type !== 'file') {
            throw $pouchModelMinErr('setAttachment', 'Specified `property` is not of type `file`');
          }

          if (!blob) {
            throw $pouchModelMinErr('setAttachment', 'Invalid `blob` provided');
          }

          var deferred = $q.defer();

          var model = this;
          var adapter = this.isRemote() ?
            PouchModel.adapters.remote :
            PouchModel.adapters.local;

          var name = name || blob.name || 'blob';
          var type = type || blob.type || 'application/octet-stream';

          this._attachments[property] = {
            blob: blob,
            name: name,
            type: type,
            isNew: true
          };
        };

        /**
         * @ngdoc method
         * @name PouchModel#validate
         *
         * @returns {Object}
         *
         * @description
         * Gets JSON schema validation result using Tiny Validator
         * for v4 JSON Schema.
         *
         * {@link https://github.com/geraintluff/tv4 `tv4`}
         */
        PouchModel.prototype.validate = function() {
          return tv4.validateResult(this, schema);
        };

        /**
         * @ngdoc method
         * @name PouchModel#isValid
         *
         * @returns {Boolean}
         *
         * @description
         * Gets flag indicating if model is valid using Tiny
         * Validator for v4 JSON Schema.
         *
         * {@link https://github.com/geraintluff/tv4 `tv4`}
         */
        PouchModel.prototype.isValid = function() {
          return this.validate().valid;
        };

        /**
         * @ngdoc method
         * @name PouchModel#isNew
         *
         * @returns {Boolean}
         *
         * @description
         * Gets flag indicating if model has been saved.
         */
        PouchModel.prototype.isNew = function() {
          return !this.created_at;
        };

        /**
         * @ngdoc method
         * @name PouchModel#isDeleted
         *
         * @returns {Boolean}
         *
         * @description
         * Gets flag indicating if model has been deleted.
         */
        PouchModel.prototype.isDeleted = function() {
          return !!this.deleted_at;
        };

        /**
         * @ngdoc method
         * @name PouchModel#isDirty
         *
         * @returns {Boolean}
         *
         * @description
         * Gets flag indicating if properties have changed since
         * the last-persisted or initialized state of this model.
         */
        PouchModel.prototype.isDirty = function() {
          var oldProperties = this.getPreviousProperties();
          var newProperties = this.getProperties();
          return !equals(oldProperties, newProperties);
        };

/*
        (continued in src/factories/pouch-model/_7_outro.js)
        ...
        return PouchModel;
      };

      return pouchModelFactory;
    }
  ]);
*/

/*
angular.module('pouch-model')
  .factory('$pouchModel', ['$q', '$http', '$pouchModelDatabase',
    function($q, $http, $pouchModelDatabase) {
      var pouchModelFactory = function(schema, options) {
        function PouchModel(properties, remote) {}
        ...
        (continued from src/factories/pouch-model/_6_instance.js)
*/

        return PouchModel;
      };

      pouchModelFactory.utils = {
        MD5: MD5,
        UUID: UUID,
        diff: diff
      };

      return pouchModelFactory;
    }
  ]);

/* EOF */

/**
 * @ngdoc directive
 * @name pmAttachment
 *
 * @description
 * Used for binding a `PouchModel` instance to an
 * `input[type="file"]` element.
 */
angular.module('pouch-model')
  .directive('pmAttachment', function() {
    return {
      restrict: 'A',
      scope: {
        ngModel: '='
      },
      link: function(scope, element, attrs, controller) {
        if (!element[0] || !element[0].matchesSelector('input[type="file"]')) {
          throw $pouchModelMinErr('pmAttachment', 'Element must be `input[type="file"]`');
        }

        var reset = function() {
          element.val('');
        };

        scope.$watch('ngModel', reset);

        element.on('change', function(evt) {
          var model = scope.ngModel;
          if (!model || !angular.isFunction(model.setAttachment)) {
            throw $pouchModelMinErr('pmAttachment', 'No valid `ngModel` found in scope');
          }

          var property = attrs.pmAttachment;
          var attachment = evt.target.files[0];

          model.setAttachment(property, attachment);
          
          // reset();
        });
      }
    }
  });

})(window, window.angular);
