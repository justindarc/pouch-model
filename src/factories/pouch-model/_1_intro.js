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
