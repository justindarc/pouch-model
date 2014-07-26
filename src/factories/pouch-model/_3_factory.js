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
