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
