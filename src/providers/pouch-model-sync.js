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
