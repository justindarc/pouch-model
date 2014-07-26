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
