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
