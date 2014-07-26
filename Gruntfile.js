'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Configurable paths for the library
  var config = {
    src: require('./bower.json').srcPath || 'src',
    example: 'example',
    dist: 'dist'
  };

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    yeoman: config,

    // Express server
    express: {
      options: {
        port: process.env.PORT || 9000
      },
      dev: {
        options: {
          script: '<%= yeoman.example %>/server/app.js',
          debug: true
        }
      }
    },

    open: {
      server: {
        url: 'http://localhost:<%= express.options.port %>'
      }
    },

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      bower: {
        files: ['bower.json'],
        tasks: ['wiredep']
      },
      js: {
        files: ['<%= yeoman.src %>/**/*'],
        tasks: ['build', 'newer:jshint:all'],
        options: {
          livereload: '<%= connect.options.livereload %>'
        }
      },
      jsTest: {
        files: ['test/spec/{,*/}*.js'],
        tasks: ['newer:jshint:test', 'karma']
      },
      // styles: {
      //   files: ['<%= yeoman.src %>/styles/{,*/}*.css'],
      //   tasks: ['newer:copy:styles']
      // },
      gruntfile: {
        files: ['Gruntfile.js']
      },
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          '<%= yeoman.src %>/{,*/}*.html',
          '.tmp/styles/{,*/}*.css',
          '<%= yeoman.src %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
        ]
      },
      express: {
        files: [
          '<%= yeoman.example %>/server/**/*.{js,json}'
        ],
        tasks: ['express:dev', 'wait'],
        options: {
          livereload: true,
          nospawn: true // Without this option specified express won't be reloaded
        }
      }
    },

    // The actual grunt server settings
    connect: {
      options: {
        port: 9000,
        // Change this to '0.0.0.0' to access the server from outside.
        hostname: 'localhost',
        livereload: 35729
      },
      livereload: {
        options: {
          open: true,
          middleware: function (connect) {
            return [
              connect.static('.tmp'),
              connect().use(
                '/bower_components',
                connect.static('./bower_components')
              ),
              connect.static(config.src)
            ];
          }
        }
      },
      test: {
        options: {
          port: 9001,
          middleware: function (connect) {
            return [
              connect.static('.tmp'),
              connect.static('test'),
              connect().use(
                '/bower_components',
                connect.static('./bower_components')
              ),
              connect.static(config.src)
            ];
          }
        }
      },
      dist: {
        options: {
          open: true,
          base: '<%= yeoman.dist %>'
        }
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: {
        src: [
          'Gruntfile.js',
          '<%= yeoman.src %>/scripts/{,*/}*.js'
        ]
      },
      test: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: ['test/spec/{,*/}*.js']
      }
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= yeoman.dist %>/{,*/}*',
            '!<%= yeoman.dist %>/.git*'
          ]
        }]
      },
      server: '.tmp'
    },

    // Automatically inject Bower components into the src
    wiredep: {
      src: {
        src: ['<%= yeoman.src %>/index.html'],
        ignorePath:  /\.\.\//
      }
    },

    // Renames files for browser caching purposes
    filerev: {
      dist: {
        src: [
          '<%= yeoman.dist %>/scripts/{,*/}*.js',
          '<%= yeoman.dist %>/styles/{,*/}*.css',
          '<%= yeoman.dist %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}',
          '<%= yeoman.dist %>/styles/fonts/*'
        ]
      }
    },

    // Reads HTML for usemin blocks to enable smart builds that automatically
    // concat, minify and revision files. Creates configurations in memory so
    // additional tasks can operate on them
    useminPrepare: {
      html: '<%= yeoman.src %>/index.html',
      options: {
        dest: '<%= yeoman.dist %>',
        flow: {
          html: {
            steps: {
              js: ['concat', 'uglifyjs'],
              css: ['cssmin']
            },
            post: {}
          }
        }
      }
    },

    // Performs rewrites based on filerev and the useminPrepare configuration
    usemin: {
      html: ['<%= yeoman.dist %>/{,*/}*.html'],
      css: ['<%= yeoman.dist %>/styles/{,*/}*.css'],
      options: {
        assetsDirs: ['<%= yeoman.dist %>','<%= yeoman.dist %>/images']
      }
    },

    // ng-annotate tries to make the code safe for minification automatically
    // by using the Angular long form for dependency injection.
    ngAnnotate: {
      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/concat/scripts',
          src: ['*.js', '!oldieshim.js'],
          dest: '.tmp/concat/scripts'
        }]
      }
    },

    // Replace Google CDN references
    cdnify: {
      dist: {
        html: ['<%= yeoman.dist %>/*.html']
      }
    },

    // Concatenate source files into single output file
    concat: {
      js: {
        src: [
          // Banner
          '<%= yeoman.src %>/_intro.js',

          // `pouch-model` module
          '<%= yeoman.src %>/pouch-model.js',

          // `$pouchModelDatabaseProvider`
          '<%= yeoman.src %>/providers/pouch-model-database.js',

          // `$pouchModelSyncProvider`
          '<%= yeoman.src %>/providers/pouch-model-sync.js',

          // `$pouchModel` factory
          '<%= yeoman.src %>/factories/pouch-model/_1_intro.js',
          '<%= yeoman.src %>/factories/pouch-model/_2_route.js',
          '<%= yeoman.src %>/factories/pouch-model/_3_factory.js',
          '<%= yeoman.src %>/factories/pouch-model/_4_class.js',
          '<%= yeoman.src %>/factories/pouch-model/_5_adapters.js',
          '<%= yeoman.src %>/factories/pouch-model/_6_instance.js',
          '<%= yeoman.src %>/factories/pouch-model/_7_outro.js',

          // `pmAttachment` directive
          '<%= yeoman.src %>/directives/pm-attachment.js',

          // Footer
          '<%= yeoman.src %>/_outro.js'
        ],
        dest: '<%= yeoman.dist %>/pouch-model.js',
        options: {
          // banner: grunt.file.read('src/_intro.js'),
          // footer: grunt.file.read('src/_outro.js')
        }
      }
    },

    // Copies remaining files to places other tasks can use
    // copy: {
    //   dist: {
    //     files: [{
    //       expand: true,
    //       dot: true,
    //       cwd: '<%= yeoman.src %>',
    //       dest: '<%= yeoman.dist %>',
    //       src: [
    //         '*.{ico,png,txt}',
    //         '.htaccess',
    //         '*.html',
    //         'views/{,*/}*.html',
    //         'images/{,*/}*.{webp}',
    //         'fonts/*'
    //       ]
    //     }, {
    //       expand: true,
    //       cwd: '.tmp/images',
    //       dest: '<%= yeoman.dist %>/images',
    //       src: ['generated/*']
    //     }]
    //   },
    //   styles: {
    //     expand: true,
    //     cwd: '<%= yeoman.src %>/styles',
    //     dest: '.tmp/styles/',
    //     src: '{,*/}*.css'
    //   }
    // },

    uglify: {
      dist: {
        files: {
          '<%= yeoman.dist %>/pouch-model.min.js': [
            '<%= yeoman.dist %>/pouch-model.js'
          ]
        }
      }
    },

    // Run some tasks in parallel to speed up the build process
    concurrent: {
      server: [
        // 'copy:styles'
      ],
      test: [
        // 'copy:styles'
      ],
      dist: [
        // 'copy:styles'
      ]
    },

    // Test settings
    karma: {
      unit: {
        configFile: 'test/karma.conf.js',
        singleRun: true
      }
    }
  });

  // Used for delaying livereload until after server has restarted
  grunt.registerTask('wait', function () {
    grunt.log.ok('Waiting for server reload...');

    var done = this.async();

    setTimeout(function () {
      grunt.log.writeln('Done waiting!');
      done();
    }, 1500);
  });

  grunt.registerTask('express-keepalive', 'Keep grunt running', function() {
    this.async();
  });

  grunt.registerTask('serve', 'Compile then start a connect web server', function (target) {
    if (target === 'dist') {
      return grunt.task.run(['build', 'connect:dist:keepalive']);
    }

    grunt.task.run([
      'build',
      'clean:server',
      'concurrent:server',
      'wiredep',
      'express:dev',
      'wait',
      'open',
      'watch'
    ]);
  });

  grunt.registerTask('server', 'DEPRECATED TASK. Use the "serve" task instead', function (target) {
    grunt.log.warn('The `server` task has been deprecated. Use `grunt serve` to start a server.');
    grunt.task.run(['serve:' + target]);
  });

  grunt.registerTask('test', [
    'build',
    'concurrent:test',
    'connect:test',
    'karma'
  ]);

  grunt.registerTask('build', [
    'clean:dist',
    'wiredep',
    'useminPrepare',
    'concurrent:dist',
    'concat',
    'ngAnnotate',
    // 'copy:dist',
    'cdnify',
    // 'cssmin',
    'uglify',
    'filerev',
    'usemin'
  ]);

  grunt.registerTask('default', [
    'newer:jshint',
    'test',
    'build'
  ]);
};
