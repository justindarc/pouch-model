'use strict';

angular
  .module('pouch-model-pictures-example', [
    'pouch-model'
  ])

  .config(function($pouchModelDatabaseProvider, $pouchModelSyncProvider) {
    $pouchModelDatabaseProvider.setup('pouch-model-pictures-example', { size: 50 });
  })

  /**
   * `Picture` service using `$pouchModel`
   */
  .factory('Picture', function($pouchModel) {
    var Picture = $pouchModel({
      type: 'Picture',
      properties: {
        'file': {
          type: 'file'
        },
        'caption': {
          type: 'string'
        }
      }
    }, {
      adapters: {
        primary: 'local'
      }
    });
    
    return Picture;
  })

  .filter('debug', function() {
    return function(value) {
      return JSON.stringify(value, null, 2);
    }
  })

  .controller('PicturesController', function($scope, $window, Picture) {
    var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

    $scope.performQueries = function() {
      Picture.query(function(pictures) {
        $scope.pictures = pictures;
        $scope.newPicture();

        // DEBUG
        window.picture = $scope.currentPicture;
        window.Picture = Picture;
      });
    };

    $scope.newPicture = function() {
      $scope.currentPicture = new Picture();
      $scope.currentPictureAttachment = BLANK_IMG;
    };

    $scope.editPicture = function(id) {
      Picture.get({ id: id }, function(picture) {
        $scope.currentPicture = picture;

        picture.getAttachment('file', function(result) {
          $scope.currentPictureAttachment = result;
        });
      });
    };

    $scope.savePicture = function(picture) {
      picture.$save(function() {
        $scope.performQueries();
      });
    };

    $scope.removePicture = function(picture) {
      picture.$remove(function() {
        $scope.performQueries();
      });
    };

    $scope.performQueries();
  });
