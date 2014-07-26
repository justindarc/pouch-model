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
