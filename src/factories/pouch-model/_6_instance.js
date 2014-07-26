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
