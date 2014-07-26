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
