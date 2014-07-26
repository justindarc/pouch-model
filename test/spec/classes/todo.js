'use strict';

describe('Class: Todo', function() {

  // Injected dependencies
  var $rootScope,
      $pouchModel;

  // Globals
  var Todo;

  var waitForPromise = function(promise, callback) {
    var resolved = false;
    promise.finally(function() {
      resolved = true;
    });

    var checkResolved = function() {
      $rootScope.$apply(); // Resolve promises

      if (resolved) {
        callback(promise);
        return;
      }

      setTimeout(checkResolved, 10);
    };

    checkResolved();
  };

  // Load the `pouch-model` module
  beforeEach(module('pouch-model'));

  // Inject dependencies
  beforeEach(inject(function(_$rootScope_, _$pouchModel_) {
    $rootScope = _$rootScope_;
    $pouchModel = _$pouchModel_;
  }));

  // Set up globals
  beforeEach(function() {
    Todo = $pouchModel({
      type: 'Todo',
      properties: {
        'title': {
          type: 'string',
          default: 'foo'
        },
        'completed': {
          type: 'boolean',
          default: false,
          indexed: true
        },
        'order': {
          type: 'number',
          default: 123,
          indexed: true
        }
      }
    });
  });

  it('should create a `Todo` instance', function() {
    var todo = new Todo();

    expect(todo.getType()).toEqual('Todo');
    expect(todo.constructor).toEqual(Todo);
    expect(todo instanceof Todo).toBe(true);
    expect(todo.$save).toBeDefined();
    expect(todo.$create).toBeDefined();
    expect(todo.$update).toBeDefined();
    expect(todo.$delete).toBeDefined();
    expect(todo.$remove).toBeDefined();
  });

  it('should define default properties', function() {
    var todo = new Todo();

    expect(todo.title).toEqual('foo');
    expect(todo.completed).toEqual(false);
    expect(todo.order).toEqual(123);
  });

  it('should not have timestamps before it is created', function() {
    var todo = new Todo();

    expect(todo.created_at).toBeUndefined();
    expect(todo.updated_at).toBeUndefined();
    expect(todo.deleted_at).toBeUndefined();
  });

  it('should not have an `_id` before it is created', function() {
    var todo = new Todo();

    expect(todo._id).toBeUndefined();
  });

  it('should have an `_id` after it is created', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      expect(todo._id).toBeDefined();
      done();
    });
  });

  it('should not have a `_rev` before it is created', function() {
    var todo = new Todo();

    expect(todo._rev).toBeUndefined();
  });

  it('should have a `_rev` after it is created', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      expect(todo._rev).toBeDefined();
      done();
    });
  });

  it('should only have `created_at` and `updated_at` timestamps after it is created', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      expect(todo.created_at).toBeDefined();
      expect(todo.updated_at).toBeDefined();
      expect(todo.deleted_at).toBeNull();
      done();
    });
  });

  it('should only have `created_at` and `updated_at` timestamps after it is updated', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      waitForPromise(todo.$update(), function() {
        expect(todo.created_at).toBeDefined();
        expect(todo.updated_at).toBeDefined();
        expect(todo.deleted_at).toBeNull();
        done();
      });
    });
  });

  it('should have `created_at`, `updated_at` and `deleted_at` timestamps after it is deleted', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      waitForPromise(todo.$delete(), function() {
        expect(todo.created_at).toBeDefined();
        expect(todo.updated_at).toBeDefined();
        expect(todo.deleted_at).toBeDefined();
        done();
      });
    });
  });

  it('should have matching `created_at` and `updated_at` timestamps after it is created', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      expect(todo.created_at).toEqual(todo.updated_at);
      done();
    });
  });

  it('should not have matching `created_at` and `updated_at` timestamps after it is updated', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      waitForPromise(todo.$update(), function() {
        expect(todo.created_at).not.toEqual(todo.updated_at);
        done();
      });
    });    
  });

  it('should indicate `isNew()` before it is created', function() {
    var todo = new Todo();

    expect(todo.isNew()).toEqual(true);
  });

  it('should no longer indicate `isNew()` after it is created', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      expect(todo.isNew()).toEqual(false);
      done();
    });
  });

  it('should return a promise after calling `$save()`', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$save(), function(promise) {
      expect(promise.then).toBeDefined();
      expect(promise.catch).toBeDefined();
      expect(promise.finally).toBeDefined();
      done();
    });
  });

  it('should return a promise after calling `$create()`', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function(promise) {
      expect(promise.then).toBeDefined();
      expect(promise.catch).toBeDefined();
      expect(promise.finally).toBeDefined();
      done();
    });
  });

  it('should return a promise after calling `$update()`', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      waitForPromise(todo.$update(), function(promise) {
        expect(promise.then).toBeDefined();
        expect(promise.catch).toBeDefined();
        expect(promise.finally).toBeDefined();
        done();
      });
    });
  });

  it('should return a promise after calling `$delete()`', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      waitForPromise(todo.$delete(), function(promise) {
        expect(promise.then).toBeDefined();
        expect(promise.catch).toBeDefined();
        expect(promise.finally).toBeDefined();
        done();
      });
    });
  });

  it('should not throw an exception for trying to `$save()` an instance twice', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$save(), function() {
      expect(function() {
        todo.$save();
      }).not.toThrow();
      done();
    });
  });

  it('should throw an exception for trying to `$create()` an instance that is not new', function(done) {
    var todo = new Todo();

    waitForPromise(todo.$create(), function() {
      expect(function() {
        todo.$create();
      }).toThrow();
      done();
    });
  });

  it('should throw an exception for trying to `$update()` an instance that is new', function() {
    var todo = new Todo();
    
    expect(function() {
      todo.$update();
    }).toThrow();
  });

  it('should throw an exception for trying to `$delete()` an instance that is new', function() {
    var todo = new Todo();
    
    expect(function() {
      todo.$delete();
    }).toThrow();
  });
});
