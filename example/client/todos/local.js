'use strict';

angular
  .module('pouch-model-todos-example', [
    'pouch-model'
  ])

  .config(function($pouchModelDatabaseProvider, $pouchModelSyncProvider) {
    $pouchModelDatabaseProvider.setup('pouch-model-todos-example');
  })

  /**
   * `Todo` service using `$pouchModel`
   */
  .factory('Todo', function($pouchModel) {
    var Todo = $pouchModel({
      type: 'Todo',
      properties: {
        'title': {
          type: 'string',
          default: 'Enter a title'
        },
        'completed': {
          type: 'boolean',
          default: false,
          indexed: true
        },
        'order': {
          type: 'number',
          default: 1
        }
      }
    }, {
      adapters: {
        primary: 'local'
      },
      indexes: [
        ['completed', 'order']
      ]
    });
    
    return Todo;
  })

  /**
   * `User` service using `$pouchModel`
   */
  .factory('User', function($pouchModel) {
    var User = $pouchModel({
      type: 'User',
      properties: {
        'email': {
          type: 'string',
          indexed: true
        },
        'first_name': {
          type: 'string'
        },
        'last_name': {
          type: 'string'
        }
      }
    }, {
      adapters: {
        primary: 'local'
      },
      singular: true
    });
    
    return User;
  })

  .filter('debug', function() {
    return function(value) {
      return JSON.stringify(value, null, 2);
    }
  })

  .controller('TodosController', function($scope, $window, Todo, User) {
    $scope.currentScope = $window.localStorage.getItem('currentScope') || 'user@example.com';

    $scope.$watch('currentScope', function(newScope, oldScope) {
      $window.localStorage.setItem('currentScope', newScope);

      Todo.setScope(newScope);
      User.setScope(newScope);

      $scope.performQueries();
    });

    Todo.on('after', 'change', function() {
      $scope.todos.refresh();
      $scope.completedTodos.refresh();

      $scope.newTodo();
    });

    $scope.performQueries = function() {
      Todo.query(function(todos) {
        $scope.todos = todos;
        $scope.newTodo();

        // DEBUG
        window.todos = $scope.todos;
        window.todo = $scope.currentTodo;
        window.Todo = Todo;
      });

      Todo.query({
        completed: true,
        order: 1
      }, function(completedTodos) {
        $scope.completedTodos = completedTodos;
      });

      User.get(function(user) {
        $scope.currentUser = user;
      });
    };

    $scope.newTodo = function() {
      $scope.currentTodo = new Todo();
    };

    $scope.editTodo = function(id) {
      Todo.get({ id: id }, function(todo) {
        $scope.currentTodo = todo;
      });
    };

    $scope.saveTodo = function(todo) {
      todo.$save();
    };

    $scope.removeTodo = function(todo) {
      todo.$remove();
    };

    $scope.saveUser = function() {
      $scope.currentUser.$save();
    };
  });
