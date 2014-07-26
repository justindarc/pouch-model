'use strict';

describe('Factory: $pouchModel', function() {

  // Injected dependencies
  var $rootScope,
      $pouchModel;

  // Load the `pouch-model` module
  beforeEach(module('pouch-model'));

  // Inject dependencies
  beforeEach(inject(function(_$rootScope_, _$pouchModel_) {
    $rootScope = _$rootScope_;
    $pouchModel = _$pouchModel_;
  }));

  it('should define a `$pouchModel` factory', function() {
    expect($pouchModel).toBeDefined();
  });

  it('should return a `PouchModel` class', function() {
    var PouchModel = $pouchModel({
      type: 'PouchModel'
    });

    expect(typeof PouchModel).toEqual('function');
    expect(PouchModel.prototype.getType()).toEqual('PouchModel');
    expect(PouchModel.prototype.constructor).toEqual(PouchModel);
    expect(PouchModel.query).toBeDefined();
    expect(PouchModel.get).toBeDefined();
  });
});
